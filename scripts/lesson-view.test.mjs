import assert from 'node:assert/strict'
import test from 'node:test'
import { act, createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import { deriveCourseProgress } from '../src/course-progress.mjs'
import { deriveLessonGraph } from '../src/lesson-graph.mjs'

function createManualProgress() {
  return Object.fromEntries(lessonRegistry.lessons.map((lesson) => [lesson.lessonId, { completedAt: null }]))
}

test('registry-driven map, references, lesson blocks, and app routes render only available lessons', async () => {
  const server = await createServer({
    configFile: 'vite.config.ts',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  const previousWindow = globalThis.window
  try {
    const { getLessonAccuracyDisplay, ExerciseQuestionCard, LessonDetailCard, LessonMap, LessonReference, LessonRouteContent, resolveLessonRef } = await server.ssrLoadModule('/src/lesson-view.tsx')
    const render = (component, props = {}) => renderToStaticMarkup(createElement(component, props))
    const emptyProgress = deriveCourseProgress(null, { schemaVersion: 1, records: [] }, lessonRegistry)
    const manualProgress = createManualProgress()
    const map = render(LessonMap, { progress: emptyProgress, manualProgress, manualProgressConfirmed: true })
    const included = lessonRegistry.lessons.filter((lesson) => lesson.availability === 'included')
    const expectedSectionRoutes = new Set(included.flatMap((lesson) => lesson.sections
      .map((section) => lesson.lessonId === 'descriptive-statistics'
        ? `#/course/${lesson.lessonId}/lesson/${section.sectionId}`
        : `#/lesson/${lesson.lessonId}/${section.sectionId}`)))
    const mapSectionRoutes = new Set([...map.matchAll(/href="(#\/(?:course|lesson)\/[^"]+)"/gu)]
      .map((match) => match[1])
      .filter((href) => href.startsWith('#/course/') || href.split('/').length === 4))

    assert.deepEqual([...mapSectionRoutes].sort(), [...expectedSectionRoutes].sort())
    assert.match(map, /収録済みの単元/u)
    assert.match(map, /未収録の単元/u)
    assert.match(map, /学習目標/u)
    assert.match(map, /共通必須前提/u)
    assert.match(map, /方法条件付き必須/u)
    assert.match(map, /任意復習/u)
    assert.match(map, /未収録の節ID/u)
    assert.doesNotMatch(map, /href="#\/lesson\/mean-inference/u)
    assert.equal(resolveLessonRef('math-algebra-sigma#sigma').kind, 'lesson-id')
    assert.equal(resolveLessonRef('math-algebra-sigma#missing'), null)
    assert.equal(resolveLessonRef('mean-inference#z'), null)
    assert.equal(resolveLessonRef('future-lesson'), null)
    assert.deepEqual(resolveLessonRef('descriptive-statistics#variance'), {
      kind: 'course-lesson', courseId: 'descriptive-statistics', sectionId: 'variance',
    })
    assert.deepEqual(resolveLessonRef('descriptive-statistics'), {
      kind: 'course-lesson', courseId: 'descriptive-statistics', sectionId: 'mean',
    })
    assert.equal(resolveLessonRef('math-algebra-sigma').sectionId, null)

    const reviewRegistry = structuredClone(lessonRegistry)
    const otherLesson = reviewRegistry.lessons.find((lesson) => lesson.lessonId === 'math-powers-roots')
    otherLesson.sections[0].sectionId = 'variance'
    otherLesson.declaredSectionIds = ['variance']
    const reviewDefinition = reviewRegistry.exerciseCatalog.definitions.find((definition) => definition.exerciseId === 'mean')
    reviewDefinition.generation = {
      kind: 'fixed',
      question: {
        display: {
          prompt: '式を確認してください。',
          response: { type: 'numeric', fields: [{ id: 'answer', label: '答え', unit: '', roundingDigits: 0 }] },
          reviewSectionRefs: ['math-powers-roots#variance'],
        },
        evaluation: { type: 'numeric', answers: [{ fieldId: 'answer', expected: '2', roundingDigits: 0 }] },
        solution: { explanation: '式を確認します。' },
      },
    }
    const { generateExerciseInstance } = await server.ssrLoadModule('/src/lesson-contract.mjs')
    const reviewInstance = generateExerciseInstance(reviewRegistry, 'descriptive-statistics', 'mean', undefined)
    const reviewCard = render(ExerciseQuestionCard, { instance: reviewInstance, title: '確認問題', registry: reviewRegistry })
    assert.match(reviewCard, /href="#\/lesson\/math-powers-roots\/variance"/u)
    assert.ok(reviewCard.includes(`>${otherLesson.title}：${otherLesson.sections[0].title}</a>`))
    assert.doesNotMatch(reviewCard, /3 範囲と分散/u)

    const courseProgress = deriveCourseProgress(null, { schemaVersion: 1, records: [
      { categoryId: 'mean-deviation', isCorrect: false, attemptedAt: '2026-10-26T00:00:00.000Z' },
    ] }, lessonRegistry)
    const descriptive = lessonRegistry.lessons.find((lesson) => lesson.lessonId === 'descriptive-statistics')
    const accuracyFor = (values) => getLessonAccuracyDisplay(descriptive, deriveCourseProgress(null, {
      schemaVersion: 1,
      records: values.map((isCorrect, index) => ({
        categoryId: 'mean-deviation', isCorrect, attemptedAt: `2026-10-27T00:00:${String(index).padStart(2, '0')}.000Z`,
      })),
    }, lessonRegistry))
    assert.deepEqual(getLessonAccuracyDisplay(descriptive, null), { label: '集計未確認', value: null })
    assert.deepEqual(getLessonAccuracyDisplay(descriptive, emptyProgress), { label: '未記録', value: null })
    assert.deepEqual(getLessonAccuracyDisplay(lessonRegistry.lessons.find((lesson) => lesson.lessonId === 'math-arithmetic'), null), {
      label: '演習なし', value: null,
    })
    assert.deepEqual(accuracyFor([false]), { label: '直近正答率（%）', value: 0 })
    assert.deepEqual(accuracyFor([true, true, true, false]), { label: '直近正答率（%）', value: 75 })
    assert.deepEqual(accuracyFor([true]), { label: '直近正答率（%）', value: 100 })
    const progressMap = render(LessonMap, { progress: courseProgress, manualProgress, manualProgressConfirmed: true })
    assert.match(progressMap, /演習成績：演習なし/u)
    assert.match(progressMap, /<p class="lesson-card-rate"><span>直近正答率（%）<\/span><strong aria-label="直近正答率 0 パーセント">0<\/strong><\/p>/u)
    assert.doesNotMatch(progressMap, /回答試行|試行数/u)

    const conditional = render(LessonReference, { targetRef: 'mean-inference#z' })
    assert.match(conditional, /未収録/u)
    assert.doesNotMatch(conditional, /<a\b/u)

    const descriptiveCard = render(LessonDetailCard, {
      lesson: descriptive,
      manualProgress: manualProgress[descriptive.lessonId],
      manualProgressConfirmed: true,
      progress: courseProgress,
      onManualProgressAction: () => {},
      onClose: () => {},
    })
    assert.match(descriptiveCard, /<h2[^>]*>基本統計量<\/h2>/u)
    assert.match(descriptiveCard, /収録済み：4 \/ 4 節/u)
    assert.ok(descriptiveCard.indexOf('演習問題一覧を開く') < descriptiveCard.indexOf('手動進捗'))
    assert.ok(descriptiveCard.indexOf('手動進捗') < descriptiveCard.indexOf('演習成績'))
    assert.ok(descriptiveCard.indexOf('演習成績') < descriptiveCard.indexOf('学習目標'))
    assert.match(descriptiveCard, /学習目標/u)
    assert.match(descriptiveCard, /手動進捗：未完了/u)
    assert.match(descriptiveCard, /手動完了はこのブラウザーに保存され、演習記録とは別に集計されます。バックアップに含まれます。/u)
    assert.equal((descriptiveCard.match(/type="checkbox"/gu) ?? []).length, 0)
    assert.doesNotMatch(descriptiveCard, />Start<\/button>/u)
    assert.match(descriptiveCard, />完了にする<\/button>/u)
    assert.match(descriptiveCard, />0<\/strong>/u)
    assert.doesNotMatch(descriptiveCard, /回答試行|試行数/u)
    assert.match(descriptiveCard, /href="#\/course\/descriptive-statistics\/lesson\/mean" data-nav-intent="normal">解説を読む/u)
    assert.match(descriptiveCard, /href="#\/course\/descriptive-statistics\/practice" data-nav-intent="normal">演習問題一覧を開く/u)
    assert.match(descriptiveCard, /href="#\/progress" data-nav-intent="normal">進捗を見る/u)
    assert.match(descriptiveCard, /共通必須前提/u)
    assert.match(descriptiveCard, /任意復習/u)
    assert.doesNotMatch(descriptiveCard, /方法条件付き必須/u)

    const planned = lessonRegistry.lessons.find((lesson) => lesson.lessonId === 'mean-inference')
    const plannedCard = render(LessonDetailCard, {
      lesson: planned,
      manualProgress: manualProgress[planned.lessonId],
      manualProgressConfirmed: true,
      progress: emptyProgress,
      onManualProgressAction: () => {},
      onClose: () => {},
    })
    assert.match(plannedCard, /母平均の区間推定・検定/u)
    assert.match(plannedCard, /未収録/u)
    assert.match(plannedCard, /<h3[^>]*>演習成績<\/h3><p>未収録<\/p>/u)
    assert.match(plannedCard, /方法条件付き必須/u)
    assert.match(plannedCard, /適用条件/u)
    assert.doesNotMatch(plannedCard, />完了にする<|>未完了に戻す</u)
    assert.doesNotMatch(plannedCard, /href="#\/lesson\/mean-inference/u)
    assert.doesNotMatch(plannedCard, /href="#\/practice"/u)

    const mapPrerequisiteControl = render(LessonReference, {
      targetRef: 'sampling-distributions#common', onClick: () => {},
    })
    assert.match(mapPrerequisiteControl, /^<button type="button" class="lesson-reference-button">/u)
    assert.doesNotMatch(mapPrerequisiteControl, /href=/u)
    assert.match(render(LessonReference, { targetRef: 'descriptive-statistics' }),
      /^<a href="#\/course\/descriptive-statistics\/lesson\/mean"/u)

    const arithmetic = lessonRegistry.lessons.find((lesson) => lesson.lessonId === 'math-arithmetic')
    const arithmeticCard = render(LessonDetailCard, {
      lesson: arithmetic,
      manualProgress: manualProgress[arithmetic.lessonId],
      manualProgressConfirmed: true,
      progress: emptyProgress,
      onManualProgressAction: () => {},
      onClose: () => {},
    })
    assert.doesNotMatch(arithmeticCard, /演習問題一覧を開く/u)

    const { DescriptiveStatisticsCourse } = await server.ssrLoadModule('/src/descriptive-statistics-course.tsx')
    const variance = render(DescriptiveStatisticsCourse, {
      lesson: descriptive,
      activeSectionId: 'variance',
      sectionHeadingRef: { current: null },
    })
    assert.match(variance, /id="course-section-variance"/u)
    assert.equal((variance.match(/class="course-section"/gu) ?? []).length, 4)
    assert.equal((variance.match(/class="interactive-variance-comparison/g) ?? []).length, 4)
    assert.equal((variance.match(/class="ds-practice-question course-inline-exercise"/gu) ?? []).length, 4)
    assert.match(variance, /href="#\/lesson\/math-algebra-sigma\/sigma" data-nav-intent="review"/u)
    assert.match(variance, /n − 1/u)
    assert.match(variance, /class="course-references"/u)
    const referencesStart = variance.indexOf('class="course-references"')
    const referencesEnd = variance.indexOf('</details>', referencesStart)
    const creditPosition = variance.indexOf('class="lesson-credit"')
    assert.ok(referencesEnd >= referencesStart && creditPosition > referencesEnd,
      'the credit stays visible after the collapsible reference details')
    assert.match(variance, /href="#\/course\/descriptive-statistics\/practice"/u)

    const mathBridge = lessonRegistry.lessons.find((lesson) => lesson.lessonId === 'math-powers-roots')
    assert.ok(mathBridge)
    const mathBridgeRoute = render(LessonRouteContent, {
      lesson: mathBridge,
      sectionId: mathBridge.sections[0].sectionId,
      sectionHeadingRef: { current: null },
    })
    assert.match(mathBridgeRoute, /この単元の演習は準備中です。/u)
    assert.doesNotMatch(mathBridgeRoute, /href="#\/practice"/u)

    const formulaLesson = {
      ...mathBridge,
      commonPrerequisites: [],
      conditionalPrerequisites: [],
      optionalReviews: [],
      sections: [{
        sectionId: 'variance',
        title: '式の表示',
        blocks: [
          { kind: 'paragraph', parts: [{ kind: 'text', text: 'x_i + x_{mean} + y^2' }] },
          { kind: 'paragraph', parts: [{ kind: 'text', text: 'x_{unfinished' }] },
          { kind: 'formula', parts: [{ kind: 'mathText', text: 'Σ_{i=1}^{n} x_i + x^2' }] },
          { kind: 'formula', parts: [{ kind: 'mathText', text: 'x_{i=1' }] },
          { kind: 'formula', parts: [{ kind: 'mathText', text: 'x_{a_{i}}' }] },
        ],
      }],
    }
    const formulas = render(LessonRouteContent, {
      lesson: formulaLesson,
      sectionId: 'variance',
      sectionHeadingRef: { current: null },
    })
    assert.match(formulas, /class="lesson-paragraph"><span>x<sub>i<\/sub> \+ x<sub>mean<\/sub> \+ y<sup>2<\/sup><\/span><\/p>/u)
    assert.match(formulas, /class="lesson-paragraph"><span>x_\{unfinished<\/span><\/p>/u)
    assert.match(formulas, /Σ<sub>i=1<\/sub><sup>n<\/sup> x<sub>i<\/sub> \+ x<sup>2<\/sup>/u)
    assert.match(formulas, /class="lesson-formula">x_\{i=1<\/p>/u)
    assert.match(formulas, /class="lesson-formula">x_\{a_\{i\}\}<\/p>/u)
    assert.doesNotMatch(formulas, /共通必須前提|方法条件付き必須|任意復習/u)

    globalThis.window = {
      location: { hash: '#/map', pathname: '/SfQC/', search: '' },
      history: { state: null },
      localStorage: { getItem: () => null },
    }
    const { default: App } = await server.ssrLoadModule('/src/App.tsx')
    const appMap = render(App)
    assert.doesNotMatch(appMap, /href="#\/lesson"/u)
    assert.doesNotMatch(appMap, /aria-label="この画面から移動"/u)

    globalThis.window.location.hash = '#/progress'
    const progressScreen = render(App)
    assert.match(progressScreen, /進捗の見方/u)
    assert.doesNotMatch(progressScreen, /学習状況や復習対象の表示は/u)
    globalThis.window.localStorage.getItem = () => '{broken'
    const invalidProgressScreen = render(App)
    assert.match(invalidProgressScreen, /進捗を集計できません/u)
    assert.doesNotMatch(invalidProgressScreen, /演習記録なし/u)
    globalThis.window.localStorage.getItem = () => null

    globalThis.window.location.hash = '#/lesson'
    const legacyLessonRoute = render(App)
    assert.match(legacyLessonRoute, /単元を選んでください/u)
    assert.doesNotMatch(legacyLessonRoute, /variance-figure/u)

    globalThis.window.location.hash = '#/course/descriptive-statistics/lesson/variance'
    const actualVarianceRoute = render(App)
    assert.match(actualVarianceRoute, /<h1[^>]*>範囲と分散<\/h1>/u)
    assert.match(actualVarianceRoute, /class="course-sections"/u)
    assert.match(actualVarianceRoute, /class="ds-practice-question course-inline-exercise"/u)
    assert.doesNotMatch(actualVarianceRoute, /<h1[^>]*>範囲と分散 \| 基本統計量/u)

    globalThis.window.location.hash = '#/practice'
    const retiredPracticeRoute = render(App)
    assert.match(retiredPracticeRoute, /画面が見つかりません/u)
    assert.doesNotMatch(retiredPracticeRoute, /基本統計量の演習/u)
    globalThis.window.location.hash = '#/course/descriptive-statistics/practice'
    const coursePractice = render(App)
    assert.match(coursePractice, /基本統計量の演習/u)
    assert.match(coursePractice, /問1：平均と偏差/u)
    for (const hash of [
      '#/practice/missing-instance', '#/feedback', '#/feedback/missing-attempt',
      '#/lesson/descriptive-statistics', '#/lesson/descriptive-statistics/variance',
    ]) {
      globalThis.window.location.hash = hash
      assert.match(render(App), /画面が見つかりません/u, hash)
    }
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
    await server.close()
  }
})

test('all common prerequisite edges are listed in the target lesson detail card', async () => {
  const server = await createServer({
    configFile: 'vite.config.ts',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  try {
    const { LessonDetailCard } = await server.ssrLoadModule('/src/lesson-view.tsx')
    const manualProgress = createManualProgress()
    const emptyProgress = deriveCourseProgress(null, { schemaVersion: 1, records: [] }, lessonRegistry)
    const { commonPrerequisiteEdges } = deriveLessonGraph(lessonRegistry)
    assert.equal(commonPrerequisiteEdges.length, 64)

    for (const target of lessonRegistry.lessons) {
      const edges = commonPrerequisiteEdges.filter((edge) => edge.target === target.lessonId)
      if (!edges.length) continue
      const card = renderToStaticMarkup(createElement(LessonDetailCard, {
        lesson: target,
        manualProgress: manualProgress[target.lessonId],
        manualProgressConfirmed: true,
        progress: emptyProgress,
        onManualProgressAction: () => {},
        onClose: () => {},
      }))
      const commonGroup = card.match(/<section class="reference-group"><h3>共通必須前提<\/h3>[\s\S]*?<\/section>/u)?.[0]
      assert.ok(commonGroup, `${target.lessonId} has prerequisite edges but no common-prerequisite card group`)
      for (const edge of edges) {
        const source = lessonRegistry.lessons.find((lesson) => lesson.lessonId === edge.source)
        assert.ok(source && commonGroup.includes(source.title), `${edge.source} is missing from ${edge.target}'s common-prerequisite card`)
      }
    }
  } finally {
    await server.close()
  }
})

test('lesson exercise slots advance past a failed input and reset after regeneration succeeds', async () => {
  const server = await createServer({
    configFile: 'vite.config.ts',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://sfqc.test/SfQC/#/lesson/descriptive-statistics/variance',
    pretendToBeVisual: true,
  })
  const globalKeys = [
    'window', 'document', 'navigator', 'Element', 'HTMLElement', 'Node', 'Event', 'MouseEvent',
    'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'IS_REACT_ACT_ENVIRONMENT',
  ]
  const previousGlobals = new Map(globalKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  }

  let root
  try {
    const { LessonRouteContent } = await server.ssrLoadModule('/src/lesson-view.tsx')
    const { createRoot } = await import('react-dom/client')
    const registry = structuredClone(lessonRegistry)
    const lesson = registry.lessons.find((item) => item.lessonId === 'math-powers-roots')
    const section = lesson.sections[0]
    section.blocks = [{ kind: 'exerciseSlot', exerciseId: 'variance' }]
    const definition = registry.exerciseCatalog.definitions.find((item) => item.lessonId === 'descriptive-statistics'
      && item.exerciseId === 'variance')
    definition.lessonId = lesson.lessonId
    definition.placement = { kind: 'section', sectionId: section.sectionId }
    definition.generation.maximum = 2
    const generator = registry.exerciseCatalog.generators.find((item) => item.generatorId === definition.generation.generatorId)
    generator.types.find((item) => item.typeId === definition.generation.typeId).maximum = 2
    const attemptedInputs = []
    const exerciseGenerators = {
      [definition.generation.generatorId]: (_exerciseDefinition, input) => {
        attemptedInputs.push(input)
        if (input === 1) throw new Error('permanent generation failure at 1')
        return {
          display: {
            prompt: `入力 ${input} の問題`,
            response: { type: 'numeric', fields: [{ id: 'answer', label: '答え', unit: '', roundingDigits: 0 }] },
            reviewSectionRefs: ['descriptive-statistics#variance'],
          },
          evaluation: { type: 'numeric', answers: [{ fieldId: 'answer', expected: String(input), roundingDigits: 0 }] },
          solution: { explanation: `入力 ${input} の解説` },
        }
      },
    }
    const host = dom.window.document.getElementById('root')
    root = createRoot(host)
    await act(async () => root.render(createElement(LessonRouteContent, {
      lesson,
      sectionId: section.sectionId,
      sectionHeadingRef: { current: null },
      registry,
      exerciseGenerators,
    })))

    const card = host.querySelector('[data-exercise-id="variance"]')
    const regenerate = [...card.querySelectorAll('button')].find((button) => button.textContent.includes('別の問題'))
    assert.match(card.querySelector('.ds-practice-prompt').textContent, /入力 0/u)
    await act(async () => {
      const input = card.querySelector('input[type="text"]')
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, '0')
      input.dispatchEvent(new dom.window.InputEvent('input', { bubbles: true, inputType: 'insertText', data: '0' }))
      input.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    })
    await act(async () => card.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })))
    assert.match(card.querySelector('.ds-exercise-feedback').textContent, /正解/u)
    assert.equal(card.querySelector('details').open, true)

    regenerate.focus()
    await act(async () => regenerate.click())
    assert.deepEqual(attemptedInputs, [0, 1])
    assert.equal([...card.querySelectorAll('button')].find((button) => button.textContent.includes('別の問題')), regenerate)
    assert.equal(dom.window.document.activeElement, regenerate)
    assert.match(card.querySelector('.ds-practice-prompt').textContent, /入力 0/u)
    assert.equal(card.querySelector('input[type="text"]').value, '0')
    assert.match(card.querySelector('.ds-exercise-feedback').textContent, /正解/u)
    assert.equal(card.querySelector('details').open, true)
    assert.match(card.querySelector('.ds-exercise-error').textContent, /表示できませんでした/u)

    await act(async () => regenerate.click())
    assert.deepEqual(attemptedInputs, [0, 1, 2])
    assert.equal([...card.querySelectorAll('button')].find((button) => button.textContent.includes('別の問題')), regenerate)
    assert.equal(dom.window.document.activeElement, regenerate)
    assert.match(card.querySelector('.ds-practice-prompt').textContent, /入力 2/u)
    assert.equal(card.querySelector('input[type="text"]').value, '')
    assert.equal(card.querySelector('.ds-exercise-feedback').textContent, '')
    assert.equal(card.querySelector('details').open, false)
    assert.equal(card.querySelector('.ds-exercise-error'), null)

    await act(async () => regenerate.click())
    assert.deepEqual(attemptedInputs, [0, 1, 2, 0])
    assert.match(card.querySelector('.ds-practice-prompt').textContent, /入力 0/u)
    assert.equal(card.querySelector('input[type="text"]').value, '')
    assert.equal(card.querySelector('details').open, false)
    assert.equal(dom.window.document.activeElement, regenerate)
  } finally {
    if (root) await act(async () => root.unmount())
    await server.close()
    dom.window.close()
    for (const key of globalKeys) {
      const descriptor = previousGlobals.get(key)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})
