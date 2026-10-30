import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import { questionRegistry } from '../src/question-registry.mjs'
import { deriveProgress } from '../src/progress-data.mjs'
import { gradeQuestionAnswer } from '../src/question-grading.mjs'
import { createInitialManualProgress } from '../src/manual-progress.mjs'
import { fixedInstance } from './question-contract.fixture.mjs'

test('registry-driven map, references, lesson blocks, and app routes render only available lessons', async () => {
  const server = await createServer({
    configFile: 'vite.config.ts',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  const previousWindow = globalThis.window
  try {
    const { LessonDetailCard, LessonMap, LessonReference, LessonRouteContent, ProgressView, resolveLessonRef } = await server.ssrLoadModule('/src/lesson-view.tsx')
    const render = (component, props = {}) => renderToStaticMarkup(createElement(component, props))
    const emptyData = { schemaVersion: 2, questionInstances: [], answerAttempts: [], reviewEvents: [] }
    const emptyProgress = deriveProgress(emptyData, lessonRegistry, Date.parse('2026-10-27T00:00:00.000Z'))
    const map = render(LessonMap, { progress: emptyProgress })
    const included = lessonRegistry.lessons.filter((lesson) => lesson.availability === 'included')
    const expectedSectionRoutes = new Set(included.flatMap((lesson) => lesson.sections
      .map((section) => `#/lesson/${lesson.lessonId}/${section.sectionId}`)))
    const mapSectionRoutes = new Set([...map.matchAll(/href="(#\/lesson\/[^"]+)"/gu)]
      .map((match) => match[1])
      .filter((href) => href.split('/').length === 4))

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
    assert.equal(resolveLessonRef('math-algebra-sigma').sectionId, null)

    const fixedContent = fixedInstance.questionDefinitionSnapshot.content
    const wrongAnswer = fixedContent.choices.find((choice) => choice.id !== fixedContent.correctAnswer).id
    const attempt = {
      attemptId: 'progress-ui-attempt',
      instanceId: fixedInstance.instanceId,
      answer: wrongAnswer,
      gradingResult: gradeQuestionAnswer(fixedInstance, wrongAnswer),
      attemptedAt: '2026-10-26T00:00:00.000Z',
    }
    const progress = deriveProgress({
      ...emptyData,
      questionInstances: [fixedInstance],
      answerAttempts: [attempt],
      reviewEvents: [{
        reviewEventId: 'progress-ui-review',
        sourceAttemptId: attempt.attemptId,
        targetRef: 'math-algebra-sigma#sigma',
        reviewedAt: '2026-10-26T01:00:00.000Z',
      }],
    }, lessonRegistry, Date.parse('2026-10-27T00:00:00.000Z'))
    const progressMap = render(LessonMap, { progress })
    assert.match(progressMap, /状態：回答記録あり · 回答試行：1回 · 誤答からの復習候補：あり/u)
    const progressView = render(ProgressView, {
      progress,
      canResolveRoute: () => true,
      unavailableMessage: '保存IDを開けません。',
    })
    assert.match(progressView, /回答試行：1回（正答 0回・誤答 1回）/u)
    assert.match(progressView, /href="#\/feedback\/progress-ui-attempt" data-nav-intent="normal">誤答と復習先を見る/u)
    assert.match(progressView, /href="#\/practice\/attempt-question-1" data-nav-intent="normal">同じ出題へ戻る/u)
    assert.match(progressView, /href="#\/lesson\/math-algebra-sigma\/sigma" data-nav-intent="normal"/u)
    assert.match(progressView, /href="#\/lesson\/descriptive-statistics\/variance" data-nav-intent="normal"/u)
    assert.match(progressView, /記録された復習先への訪問/u)
    const failedRouteProgress = render(ProgressView, {
      progress,
      canResolveRoute: () => false,
      unavailableMessage: '保存形式の移行に失敗したため、この保存IDは開けません。',
    })
    assert.doesNotMatch(failedRouteProgress, /href="#\/(?:feedback|practice)\//u)
    assert.match(failedRouteProgress, /保存形式の移行に失敗したため、この保存IDは開けません/u)

    const conditional = render(LessonReference, { targetRef: 'mean-inference#z' })
    assert.match(conditional, /未収録/u)
    assert.doesNotMatch(conditional, /<a\b/u)

    const descriptive = lessonRegistry.lessons.find((lesson) => lesson.lessonId === 'descriptive-statistics')
    const manualProgress = createInitialManualProgress(lessonRegistry)
    const descriptiveCard = render(LessonDetailCard, {
      lesson: descriptive,
      manualProgress: manualProgress[descriptive.lessonId],
      onManualProgressAction: () => {},
      onClose: () => {},
    })
    assert.match(descriptiveCard, /<h2[^>]*>基本統計量<\/h2>/u)
    assert.match(descriptiveCard, /収録済み：4 \/ 4 節/u)
    assert.match(descriptiveCard, /学習目標/u)
    assert.match(descriptiveCard, /手動進捗：未開始/u)
    assert.match(descriptiveCard, /手動進捗とチェックは一時的です。ページを再読み込みするとリセットされます。演習記録の保存状態とは別です。/u)
    assert.equal((descriptiveCard.match(/type="checkbox"/gu) ?? []).length, descriptive.learningObjectives.length)
    assert.match(descriptiveCard, />Start<\/button>/u)
    assert.match(descriptiveCard, />Mark completed<\/button>/u)
    assert.match(descriptiveCard, /href="#\/lesson\/descriptive-statistics" data-nav-intent="normal">解説を読む/u)
    assert.match(descriptiveCard, /href="#\/practice" data-nav-intent="normal">演習問題一覧を開く（全単元共通）/u)
    assert.match(descriptiveCard, /href="#\/progress" data-nav-intent="normal">全単元の演習記録・集計を見る/u)
    assert.match(descriptiveCard, /共通必須前提/u)
    assert.match(descriptiveCard, /任意復習/u)
    assert.doesNotMatch(descriptiveCard, /方法条件付き必須/u)

    const planned = lessonRegistry.lessons.find((lesson) => lesson.lessonId === 'mean-inference')
    const plannedCard = render(LessonDetailCard, {
      lesson: planned,
      manualProgress: manualProgress[planned.lessonId],
      onManualProgressAction: () => {},
      onClose: () => {},
    })
    assert.match(plannedCard, /母平均の区間推定・検定/u)
    assert.match(plannedCard, /未収録/u)
    assert.match(plannedCard, /方法条件付き必須/u)
    assert.match(plannedCard, /適用条件/u)
    assert.doesNotMatch(plannedCard, /href="#\/lesson\/mean-inference/u)
    assert.doesNotMatch(plannedCard, /href="#\/practice"/u)

    const arithmetic = lessonRegistry.lessons.find((lesson) => lesson.lessonId === 'math-arithmetic')
    const arithmeticCard = render(LessonDetailCard, {
      lesson: arithmetic,
      manualProgress: manualProgress[arithmetic.lessonId],
      onManualProgressAction: () => {},
      onClose: () => {},
    })
    assert.doesNotMatch(arithmeticCard, /演習問題一覧を開く/u)

    const variance = render(LessonRouteContent, {
      lesson: descriptive,
      sectionId: 'variance',
      sectionHeadingRef: { current: null },
    })
    assert.match(variance, /Σ<sub>i=1<\/sub><sup>n<\/sup>/u)
    assert.match(variance, /href="#\/lesson\/math-algebra-sigma\/sigma" data-nav-intent="review" aria-label="Σ：総和記号の読み方"/u)
    assert.equal((variance.match(/class="variance-figure"/gu) ?? []).length, 1)
    assert.ok(variance.indexOf('例：偏差平方和') < variance.indexOf('class="variance-figure"'))
    assert.ok(variance.indexOf('class="variance-figure"') < variance.indexOf('同じ3点が調べたい対象'))
    assert.match(variance, /76\/75 ≈ 1\.013 mm²/u)
    assert.match(variance, /href="#\/practice" data-nav-intent="normal">利用できる演習問題を選ぶ/u)
    assert.doesNotMatch(variance, /演習の開始・回答入力は準備中です。/u)

    const mathBridge = lessonRegistry.lessons.find((lesson) => lesson.lessonId === 'math-powers-roots')
    assert.ok(mathBridge)
    assert.equal(questionRegistry.some((question) => question.lessonRefs.some((reference) =>
      reference === 'math-powers-roots' || reference.startsWith('math-powers-roots#'))), false)
    const mathBridgeRoute = render(LessonRouteContent, {
      lesson: mathBridge,
      sectionId: mathBridge.sections[0].sectionId,
      sectionHeadingRef: { current: null },
    })
    assert.match(mathBridgeRoute, /この単元の演習は準備中です。/u)
    assert.doesNotMatch(mathBridgeRoute, /href="#\/practice"/u)

    const formulaLesson = {
      ...descriptive,
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
    assert.match(progressScreen, /記録の見方/u)
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

    globalThis.window.location.hash = '#/lesson/descriptive-statistics/variance'
    const actualVarianceRoute = render(App)
    assert.match(actualVarianceRoute, /<h1[^>]*>範囲と分散<\/h1>/u)
    assert.match(actualVarianceRoute, /class="variance-figure"/u)
    assert.doesNotMatch(actualVarianceRoute, /<h1[^>]*>範囲と分散 \| 基本統計量/u)

    globalThis.window.location.hash = '#/practice'
    const practiceSelection = render(App)
    assert.match(practiceSelection, /この問題を始める/u)
    assert.doesNotMatch(practiceSelection, /href="#\/feedback"/u)
    globalThis.window.location.hash = '#/practice/missing-instance'
    const missingPractice = render(App)
    assert.doesNotMatch(missingPractice, /href="#\/feedback"/u)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
    await server.close()
  }
})
