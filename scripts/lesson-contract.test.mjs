import assert from 'node:assert/strict'
import test from 'node:test'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import {
  exerciseDefinitionId,
  generateExerciseInstance,
  getExerciseCatalogErrors,
  getExerciseGradingData,
  getExerciseQuestionDisplay,
  parseLessonRef,
  validateLessonRegistry,
} from '../src/lesson-contract.mjs'
import { lessonRegistryFixture } from './lesson-contract.fixture.mjs'
import { PRACTICE_CATEGORY_IDS } from '../src/practice-results.mjs'
import { generateLessonExercise } from '../src/lesson-exercise-adapters.mjs'

const copy = (value) => structuredClone(value)
const lesson = (registry, lessonId) => registry.lessons.find((item) => item.lessonId === lessonId)
const collectKeys = (value) => value && typeof value === 'object'
  ? [...Object.keys(value), ...Object.values(value).flatMap(collectKeys)] : []

test('LessonRef parser validates stable syntax without requiring a current registry entry', () => {
  assert.deepEqual(parseLessonRef('future-lesson#section'), { lessonId: 'future-lesson', sectionId: 'section' })
  assert.deepEqual(parseLessonRef('future-lesson'), { lessonId: 'future-lesson', sectionId: null })
  for (const value of ['future_lesson', 'future-lesson#bad_section', 'future-lesson#', '', null]) {
    assert.equal(parseLessonRef(value), null)
  }
})

test('fixture and the six included lessons satisfy the contract and keep other lessons planned', () => {
  assert.equal(validateLessonRegistry(lessonRegistryFixture), true)
  assert.equal(validateLessonRegistry(lessonRegistry), true)
  assert.equal(lessonRegistry.lessons.length, 34)
  assert.equal(lessonRegistry.curriculumRevision, 4)
  assert.ok(lesson(lessonRegistry, 'descriptive-statistics').declaredSectionIds.includes('variance'))
  assert.ok(lesson(lessonRegistry, 'math-algebra-sigma').declaredSectionIds.includes('sigma'))
  assert.deepEqual(lesson(lessonRegistry, 'descriptive-statistics').declaredSectionIds, ['mean', 'deviation', 'variance', 'standard-deviation'])
  assert.equal(lesson(lessonRegistry, 'descriptive-statistics').availability, 'included')
  assert.equal(lesson(lessonRegistry, 'descriptive-statistics').revision, 5)
  const expectedSections = new Map([
    ['data-types', ['observation-unit', 'counting', 'types']],
    ['math-arithmetic', ['operations']],
    ['math-ratios-percentages', ['ratio']],
    ['math-powers-roots', ['powers-roots']],
    ['math-algebra-sigma', ['sigma']],
    ['descriptive-statistics', ['mean', 'deviation', 'variance', 'standard-deviation']],
  ])
  const includedLessons = lessonRegistry.lessons.filter((item) => item.availability === 'included')
  assert.deepEqual(includedLessons.map((item) => item.lessonId).sort(), [...expectedSections.keys()].sort())
  for (const item of lessonRegistry.lessons) {
    const sectionIds = expectedSections.get(item.lessonId)
    if (!sectionIds) {
      assert.equal(item.availability, 'planned')
      assert.equal(item.revision, 1)
      continue
    }
    assert.equal(item.revision, item.lessonId === 'descriptive-statistics' ? 5 : item.lessonId === 'data-types' ? 4 : 2)
    assert.deepEqual(item.declaredSectionIds, sectionIds)
    assert.equal(item.sections.length, sectionIds.length)
    const paragraphs = item.sections.flatMap((section) => section.blocks
      .filter((block) => block.kind === 'paragraph')
      .map((block) => block.parts.filter((part) => part.kind === 'text').map((part) => part.text).join('')))
    if (item.lessonId === 'data-types') {
      assert.ok(item.overview.some((block) => block.kind === 'table'))
      assert.ok(item.sections[0].blocks.some((block) => block.kind === 'table'))
    } else if (item.lessonId !== 'descriptive-statistics') {
      assert.ok(paragraphs.some((paragraph) => paragraph.includes('例：')))
      assert.ok(paragraphs.some((paragraph) => paragraph.startsWith('出典')))
    } else {
      assert.equal(item.references.length, 4)
      assert.ok(item.overview.some((block) => block.kind === 'table'))
    }
  }
  assert.equal(lessonRegistry.officialSourceItemIds.length, 64)
  assert.deepEqual(lessonRegistry.exerciseCatalog.categories.map(({ categoryId }) => categoryId), PRACTICE_CATEGORY_IDS)
  assert.deepEqual(lessonRegistry.exerciseCatalog.definitions
    .filter(({ placement }) => placement.kind === 'section').map(({ exerciseId }) => exerciseId),
  ['identify-observation-unit', 'defect-aggregation', 'classify-record', 'mean', 'deviation', 'variance', 'standard-deviation'])
  assert.equal(lessonRegistry.exerciseCatalog.definitions.length, 22)
  assert.equal(lessonRegistry.exerciseCatalog.generators.find(({ generatorId }) =>
    generatorId === 'descriptive-statistics-independent').types.length, 15)
  assert.deepEqual(lesson(lessonRegistry, 'data-types').sourceRefs, ['jsa-l3', 'jsa-l4'])
  assert.deepEqual(lesson(lessonRegistry, 'data-types').commonPrerequisites, [])
  assert.ok(lessonRegistry.sources.every((source) => source.url.endsWith('.pdf')))
  assert.ok(lessonRegistry.sources.find((source) => source.sourceId === 'jsa-l2').citations
    .some((citation) => citation.sourceItemId === 'SRC-0062' && citation.location === 'p.1「品質保証：プロセス保証」'))
})

test('fixed and seeded exercise APIs keep display data separate from grading and explanations', () => {
  assert.equal(exerciseDefinitionId('data-types', 'observed-counts'), 'data-types:observed-counts')
  const fixed = generateExerciseInstance(lessonRegistryFixture, 'data-types', 'observed-counts', undefined, {})
  const fixedRepeat = generateExerciseInstance(lessonRegistryFixture, 'data-types', 'observed-counts', undefined, {})
  assert.equal(fixed.instanceId, fixedRepeat.instanceId)
  assert.deepEqual(getExerciseQuestionDisplay(fixed), getExerciseQuestionDisplay(fixedRepeat))
  assert.deepEqual(getExerciseGradingData(fixed), getExerciseGradingData(fixedRepeat))
  const fixedDisplay = getExerciseQuestionDisplay(fixed)
  assert.equal(fixed.mode, 'fixed')
  assert.deepEqual(fixedDisplay.response.fields.map(({ id }) => id), ['alpha-count', 'beta-count'])
  assert.ok(!collectKeys(fixedDisplay).some((key) => ['evaluation', 'solution', 'expected', 'correctChoiceId', 'explanation'].includes(key)))
  assert.deepEqual(getExerciseGradingData(fixed).evaluation, { type: 'numeric', answers: [
    { fieldId: 'alpha-count', expected: '2', roundingDigits: 0 },
    { fieldId: 'beta-count', expected: '3', roundingDigits: 0 },
  ] })

  const fixedChoice = generateExerciseInstance(lessonRegistryFixture, 'data-types', 'classify-unit', undefined, {})
  const choiceDisplay = getExerciseQuestionDisplay(fixedChoice)
  const choiceGrading = getExerciseGradingData(fixedChoice)
  assert.ok(!collectKeys(choiceDisplay).includes('correctChoiceId'))
  assert.equal(choiceGrading.evaluation.correctChoiceId, 'count-the-product')
  assert.equal(choiceGrading.solution.choiceFeedback[0].misconception, '製品の個数と傷の件数を同じ単位で数えています。')

  let calls = 0
  const generatedQuestion = (seed, sectionRef = 'data-types#types') => ({
    display: {
      prompt: '観測した個数を入力してください。',
      response: { type: 'numeric', fields: [{ id: 'count', label: '個数', unit: '個', roundingDigits: 0 }] },
      reviewSectionRefs: [sectionRef],
    },
    evaluation: { type: 'numeric', answers: [{ fieldId: 'count', expected: String(seed % 10), roundingDigits: 0 }] },
    solution: { explanation: `観測数は ${seed % 10} 個です。` },
  })
  const generators = { 'fixture-counts': (_definition, seed) => { calls += 1; return generatedQuestion(seed) } }
  const instance = generateExerciseInstance(lessonRegistryFixture, 'data-types', 'generated-counts', 48291, generators)
  assert.equal(calls, 1)
  assert.equal(instance.instanceId, 'data-types:generated-counts@1:seed:48291')
  assert.equal(getExerciseGradingData(instance).evaluation.answers[0].expected, '1')
  assert.equal(instance.instanceId, generateExerciseInstance(lessonRegistryFixture, 'data-types', 'generated-counts', 48291, generators).instanceId)
  assert.notEqual(instance.instanceId, generateExerciseInstance(lessonRegistryFixture, 'data-types', 'generated-counts', 7, generators).instanceId)
  const changedMode = copy(lessonRegistryFixture)
  const modeDefinition = changedMode.exerciseCatalog.definitions.find(({ exerciseId }) => exerciseId === 'generated-counts')
  modeDefinition.generation.kind = 'index'
  modeDefinition.generation.maximum = 100
  const modeType = changedMode.exerciseCatalog.generators[0].types[0]
  modeType.mode = 'index'
  modeType.maximum = 100
  assert.notEqual(instance.instanceId,
    generateExerciseInstance(changedMode, 'data-types', 'generated-counts', 7, generators).instanceId)
  assert.throws(() => generateExerciseInstance(lessonRegistryFixture, 'data-types', 'generated-counts', -1, generators), RangeError)
  assert.throws(() => generateExerciseInstance(lessonRegistryFixture, 'data-types', 'generated-counts', 1.5, generators), RangeError)
  assert.throws(() => generateExerciseInstance(lessonRegistryFixture, 'data-types', 'generated-counts', 0x100000000, generators), RangeError)
  assert.throws(() => generateExerciseInstance(lessonRegistryFixture, 'data-types', 'generated-counts', 0, {}), /Unknown exercise generator/u)
  assert.throws(() => generateExerciseInstance(lessonRegistryFixture, 'data-types', 'observed-counts', 0, {}), RangeError)

  const revised = copy(lessonRegistryFixture)
  revised.exerciseCatalog.definitions.find(({ exerciseId }) => exerciseId === 'generated-counts').revision = 2
  assert.notEqual(instance.instanceId,
    generateExerciseInstance(revised, 'data-types', 'generated-counts', 48291, generators).instanceId)
  const revisedFixed = copy(lessonRegistryFixture)
  revisedFixed.exerciseCatalog.definitions.find(({ exerciseId }) => exerciseId === 'observed-counts').revision = 2
  assert.notEqual(fixed.instanceId,
    generateExerciseInstance(revisedFixed, 'data-types', 'observed-counts', undefined, {}).instanceId)
  assert.throws(() => generateExerciseInstance(lessonRegistryFixture, 'data-types', 'generated-counts', 0, {
    'fixture-counts': (_definition, seed) => generatedQuestion(seed, 'data-types#missing'),
  }), /data-types:generated-counts.*reviewSectionRefs/u)
})

test('data-types uses a shared overview and places one exercise after each section explanation', () => {
  const dataTypes = lesson(lessonRegistry, 'data-types')
  assert.deepEqual(dataTypes.overview.map(({ kind }) => kind), ['paragraph', 'paragraph', 'table', 'paragraph'])
  assert.equal(dataTypes.overview[0].parts[0].text, '検査で基準を超える傷が3件見つかりました。しかし不適合品は2個です。なぜでしょうか？')
  assert.deepEqual(dataTypes.overview[2].rows, [
    ['A', '3', '2'], ['B', '1', '1'], ['C', '1', '0'], ['D〜J', '0', '0'],
  ])
  assert.deepEqual(dataTypes.sections.map(({ sectionId, blocks }) => {
    assert.equal(blocks[0].kind, 'paragraph')
    assert.ok(blocks.some(({ kind, summary }) => kind === 'details' && summary.startsWith('もっと正確に')))
    assert.equal(blocks.at(-1).kind, 'exerciseSlot')
    return [sectionId, blocks.at(-1).exerciseId]
  }), [
    ['observation-unit', 'identify-observation-unit'],
    ['counting', 'defect-aggregation'],
    ['types', 'classify-record'],
  ])
  assert.equal(dataTypes.figures.length, 0)
  assert.equal(dataTypes.references.length, 3)
  assert.ok(dataTypes.references.every(({ details }) => details.includes('2026-11-20')))
  assert.ok(lesson(lessonRegistry, 'population-sample').commonPrerequisites.includes('data-types#observation-unit'))
  assert.ok(lesson(lessonRegistry, 'descriptive-statistics').commonPrerequisites.includes('data-types#types'))

  const definitions = lessonRegistry.exerciseCatalog.definitions.filter(({ lessonId }) => lessonId === 'data-types')
  assert.deepEqual(definitions.map(({ placement }) => placement.sectionId), dataTypes.declaredSectionIds)
  assert.ok(definitions.every(({ revision }) => revision === 2))
  assert.deepEqual(definitions.map(({ generation }) => generation.kind), ['fixed', 'index', 'fixed'])
  assert.deepEqual(definitions[1].generation, {
    kind: 'index', generatorId: 'data-types-cases', typeId: 'defect-aggregation', minimum: 0, maximum: 1,
  })
})

test('data-types cases reproduce the product record and the independent two-row detail', () => {
  const productCase = generateLessonExercise('data-types', 'defect-aggregation', 0)
  const productDisplay = getExerciseQuestionDisplay(productCase)
  assert.deepEqual(productDisplay.table, {
    caption: '製品ごとの検査記録（1行＝製品1個）',
    rowHeaderLabel: '製品番号',
    columnLabels: ['見つかった傷（件）', '基準を超えた傷（件）'],
    rows: [
      { label: 'P-01', values: [4, 3] }, { label: 'P-02', values: [1, 0] },
      { label: 'P-03', values: [2, 1] }, { label: 'P-04', values: [0, 0] },
      { label: 'P-05', values: [1, 0] }, { label: 'P-06', values: [0, 0] },
    ],
  })
  const detailCase = generateLessonExercise('data-types', 'defect-aggregation', 1)
  const detailDisplay = getExerciseQuestionDisplay(detailCase)
  assert.match(detailDisplay.prompt, /検査対象は P-01〜P-05 の5個/u)
  assert.deepEqual(detailDisplay.table, {
    caption: '基準を超えた傷の明細（1行＝傷1件）',
    rowHeaderLabel: '傷番号',
    columnLabels: ['製品番号'],
    rows: [{ label: '傷1', values: ['P-01'] }, { label: '傷2', values: ['P-03'] }],
  })
  assert.throws(() => generateLessonExercise('data-types', 'defect-aggregation', 2), RangeError)
  assert.throws(() => generateLessonExercise('data-types', 'classify-record', 0), RangeError)

  const answerPositions = []
  for (const [exerciseId, input, sectionId, answer] of [
    ['identify-observation-unit', undefined, 'observation-unit', /検査した製品は一覧の5個/u],
    ['defect-aggregation', 0, 'counting', /^不適合品2個、不適合4件。/u],
    ['defect-aggregation', 1, 'observation-unit', /^不適合品2個、不適合2件。製品番号を重複なく数える/u],
    ['classify-record', undefined, 'types', /コードの合計2は不適合品数（2個）。$/u],
  ]) {
    const instance = generateLessonExercise('data-types', exerciseId, input)
    const duplicate = generateLessonExercise('data-types', exerciseId, input)
    const display = getExerciseQuestionDisplay(instance)
    const grading = getExerciseGradingData(instance)
    assert.deepEqual(getExerciseQuestionDisplay(duplicate), display)
    assert.deepEqual(getExerciseGradingData(duplicate), grading)
    assert.ok(!collectKeys(display).some((key) => ['evaluation', 'solution', 'correctChoiceId', 'explanation'].includes(key)))
    const position = display.response.choices.findIndex(({ id }) => id === grading.evaluation.correctChoiceId)
    assert.match(display.response.choices[position].text, answer)
    answerPositions.push(position)
    assert.ok(grading.solution.steps.length >= 2)
    assert.deepEqual(display.reviewSectionRefs, [`data-types#${sectionId}`])
    assert.deepEqual(grading.solution.choiceFeedback.map(({ choiceId }) => choiceId), display.response.choices
      .filter(({ id }) => id !== grading.evaluation.correctChoiceId).map(({ id }) => id))
    assert.ok(grading.solution.choiceFeedback.every(({ reviewSectionRefs }) =>
      reviewSectionRefs.length === 1 && reviewSectionRefs[0] === display.reviewSectionRefs[0]))
  }
  assert.equal(new Set(answerPositions).size, 4)

  const wrongReason = detailDisplay.response.choices.find(({ text }) => text.includes('明細の1行は製品1個'))
  assert.match(wrongReason.text, /^不適合品2個、不適合2件。/u)
  assert.match(getExerciseGradingData(detailCase).solution.choiceFeedback
    .find(({ choiceId }) => choiceId === wrongReason.id).misconception, /数は合っていますが、理由が誤り/u)
})

test('exercise tables accept text and numeric cells with matching column metadata', () => {
  const legacy = copy(lessonRegistryFixture)
  const legacyQuestion = legacy.exerciseCatalog.definitions.find(({ exerciseId }) => exerciseId === 'observed-counts').generation.question
  legacyQuestion.display.table = { rows: [{ label: '観測', values: [1, 0] }] }
  assert.equal(validateLessonRegistry(legacy), true)

  const labeled = copy(legacy)
  labeled.exerciseCatalog.definitions.find(({ exerciseId }) => exerciseId === 'observed-counts').generation.question.display.table = {
    caption: '製品ごとの記録',
    rowHeaderLabel: '製品番号',
    columnLabels: ['適合状態', '傷の件数'],
    rows: [{ label: 'P-01', values: ['不適合', 2] }],
  }
  assert.equal(validateLessonRegistry(labeled), true)

  for (const mutate of [
    (table) => { table.caption = ' ' },
    (table) => { table.rowHeaderLabel = ' ' },
    (table) => { table.columnLabels = ['不適合品コード'] },
    (table) => { table.columnLabels[0] = '' },
    (table) => { table.rows.push({ label: 'P-02', values: [0] }) },
    (table) => { table.rows[0].values[0] = '' },
    (table) => { table.rows[0].values[0] = true },
    (table) => { table.rows[0].values[1] = Infinity },
  ]) {
    const invalid = copy(labeled)
    mutate(invalid.exerciseCatalog.definitions.find(({ exerciseId }) => exerciseId === 'observed-counts').generation.question.display.table)
    assert.equal(validateLessonRegistry(invalid), false)
  }
})

test('basic statistics course covers the worked comparison, drills, code figures, and sources', () => {
  const descriptive = lesson(lessonRegistry, 'descriptive-statistics')
  const allBlocks = (blocks) => blocks.flatMap((block) => [
    block,
    ...(block.kind === 'details' ? allBlocks(block.blocks) : []),
  ])
  const allCourseBlocks = [
    ...allBlocks(descriptive.overview),
    ...descriptive.sections.flatMap((section) => allBlocks(section.blocks)),
  ]
  const courseText = JSON.stringify({ overview: descriptive.overview, sections: descriptive.sections })

  assert.equal(validateLessonRegistry(lessonRegistry), true)
  assert.deepEqual(descriptive.declaredSectionIds, ['mean', 'deviation', 'variance', 'standard-deviation'])
  assert.equal(descriptive.revision, 5)
  assert.ok(courseText.includes('100 mm'))
  assert.ok(courseText.includes('偏差'))
  assert.ok(courseText.includes('偏差平方和'))
  assert.ok(courseText.includes('不偏分散'))
  assert.ok(courseText.includes('n − 1'))
  assert.ok(courseText.includes('標準偏差'))
  assert.deepEqual(allCourseBlocks.filter((block) => block.kind === 'exerciseSlot').map((block) => block.exerciseId),
    ['mean', 'deviation', 'variance', 'standard-deviation'])
  assert.equal(descriptive.figures.length, 5)
  assert.ok(descriptive.figures.every((figure) => figure.rendererRef.startsWith('code:')))
  assert.ok(descriptive.references.some((reference) => reference.url.includes('openstax.org')))
  assert.match(descriptive.credit, /Solarized/u)

  const sampleVariance = (values) => {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
  }
  const lineA = [98, 100, 102]
  const lineB = [99, 100, 101]
  assert.equal(lineA.reduce((sum, value) => sum + value, 0) / lineA.length, 100)
  assert.equal(lineB.reduce((sum, value) => sum + value, 0) / lineB.length, 100)
  assert.equal(sampleVariance(lineA), 4)
  assert.equal(sampleVariance(lineB), 1)
  assert.equal(Math.sqrt(sampleVariance(lineA)), 2)
  assert.equal(Math.sqrt(sampleVariance(lineB)), 1)
})
test('paragraphs, equation token order, and the registered variance figure stay explicit', () => {
  const variance = lesson(lessonRegistryFixture, 'descriptive-statistics').sections.find((section) => section.sectionId === 'variance')
  const formula = variance.blocks.find((block) => block.kind === 'formula')
  assert.deepEqual(formula.parts.map((part) => part.kind), ['mathText', 'mathSymbol', 'mathText'])
  assert.equal(formula.parts[1].symbol, 'Σ')
  assert.equal(formula.parts[1].lessonRef.targetRef, 'math-algebra-sigma#sigma')
  assert.equal(formula.parts.map((part) => part.kind === 'mathSymbol' ? part.symbol : part.text).join(''), 's² = 1/(n−1) Σ (xᵢ−x̄)²')
  assert.equal(variance.blocks.find((block) => block.kind === 'figureRef').figureId, 'FIG-DESC-VAR-001')
  assert.equal(lesson(lessonRegistryFixture, 'descriptive-statistics').figures[0].rendererRef, 'code:variance-deviation-bars')

  const registeredLesson = lesson(lessonRegistry, 'descriptive-statistics')
  const registeredVariance = registeredLesson.sections.find((section) => section.sectionId === 'variance')
  const registeredFigure = registeredLesson.figures.find((figure) => figure.figureId === 'FIG-DS-VARIANCE')
  assert.ok(registeredVariance.blocks.some((block) => block.kind === 'figureRef' && block.figureId === registeredFigure.figureId))
  assert.equal(registeredFigure.rendererRef, 'code:interactive-variance-comparison')
  assert.deepEqual(registeredFigure.axes.map(({ axis, label, scale }) => ({ axis, label, scale })), [
    { axis: 'x', label: '測定値（mm）', scale: 'linear' },
    { axis: 'y', label: 'ラインと観測番号', scale: 'categorical' },
  ])
  assert.match(registeredFigure.altText, /ライン A と B.*平均/u)
})

test('figure contracts distinguish coordinate charts from axisless diagrams', () => {
  const withDiagram = copy(lessonRegistryFixture)
  const descriptive = lesson(withDiagram, 'descriptive-statistics')
  descriptive.sections[0].blocks.push({ kind: 'figureRef', figureId: 'FIG-DIAGRAM-001' })
  descriptive.figures.push({
    kind: 'diagram',
    figureId: 'FIG-DIAGRAM-001',
    rendererRef: 'code:cause-effect-diagram',
    educationalPurpose: '要因候補を階層的に整理する。',
    legend: [],
    altText: '結果に向かう複数の原因候補を枝分かれで示す。',
  })
  assert.equal(validateLessonRegistry(withDiagram), true)

  const diagramWithAxes = copy(withDiagram)
  diagramWithAxes.lessons.find((item) => item.lessonId === 'descriptive-statistics').figures[1].axes = []
  assert.equal(validateLessonRegistry(diagramWithAxes), false)

  const chartWithoutVariable = copy(lessonRegistryFixture)
  lesson(chartWithoutVariable, 'descriptive-statistics').figures[0].variables = []
  assert.equal(validateLessonRegistry(chartWithoutVariable), false)

  const chartWithDuplicateAxis = copy(lessonRegistryFixture)
  lesson(chartWithDuplicateAxis, 'descriptive-statistics').figures[0].axes[1].axis = 'x'
  assert.equal(validateLessonRegistry(chartWithDuplicateAxis), false)
})

test('metadata references resolve planned declarations while body links require included targets', () => {
  assert.equal(validateLessonRegistry(lessonRegistryFixture), true)

  const missingLesson = copy(lessonRegistryFixture)
  lesson(missingLesson, 'descriptive-statistics').commonPrerequisites.push('not-in-registry')
  assert.equal(validateLessonRegistry(missingLesson), false)

  const missingAnchor = copy(lessonRegistryFixture)
  lesson(missingAnchor, 'descriptive-statistics').commonPrerequisites.push('math-algebra-sigma#not-declared')
  assert.equal(validateLessonRegistry(missingAnchor), false)

  const linkToPlanned = copy(lessonRegistryFixture)
  lesson(linkToPlanned, 'descriptive-statistics').sections[0].blocks[1].targetRef = 'math-ratios-percentages'
  assert.equal(validateLessonRegistry(linkToPlanned), false)

  const undefinedBodyAnchor = copy(lessonRegistryFixture)
  lesson(undefinedBodyAnchor, 'descriptive-statistics').sections[1].blocks[1].parts[1].lessonRef.targetRef = 'math-algebra-sigma#missing'
  assert.equal(validateLessonRegistry(undefinedBodyAnchor), false)
})

test('planned and included content rules reject empty or reference-only sections', () => {
  const plannedWithSections = copy(lessonRegistryFixture)
  lesson(plannedWithSections, 'math-ratios-percentages').sections = []
  assert.equal(validateLessonRegistry(plannedWithSections), false)

  const noSections = copy(lessonRegistryFixture)
  lesson(noSections, 'descriptive-statistics').sections = []
  assert.equal(validateLessonRegistry(noSections), false)

  const referenceOnly = copy(lessonRegistryFixture)
  lesson(referenceOnly, 'descriptive-statistics').sections[0].blocks = [
    { kind: 'lessonRef', label: '参照だけ', targetRef: 'data-types#types' },
  ]
  assert.equal(validateLessonRegistry(referenceOnly), false)

  const emptyParagraph = copy(lessonRegistryFixture)
  lesson(emptyParagraph, 'descriptive-statistics').sections[0].blocks = [
    { kind: 'paragraph', parts: [{ kind: 'text', text: '  ' }] },
  ]
  assert.equal(validateLessonRegistry(emptyParagraph), false)
})

test('source, section, and figure IDs must resolve without duplicates', () => {
  const duplicateLesson = copy(lessonRegistryFixture)
  duplicateLesson.lessons.push(copy(duplicateLesson.lessons[0]))
  assert.equal(validateLessonRegistry(duplicateLesson), false)

  const duplicateSource = copy(lessonRegistryFixture)
  duplicateSource.sources.push(copy(duplicateSource.sources[0]))
  assert.equal(validateLessonRegistry(duplicateSource), false)

  const duplicateSection = copy(lessonRegistryFixture)
  lesson(duplicateSection, 'descriptive-statistics').declaredSectionIds.push('variance')
  assert.equal(validateLessonRegistry(duplicateSection), false)

  const missingSourceCoverage = copy(lessonRegistryFixture)
  lesson(missingSourceCoverage, 'descriptive-statistics').sourceRefs = []
  assert.equal(validateLessonRegistry(missingSourceCoverage), false)

  const missingSecondaryCitation = copy(lessonRegistry)
  lesson(missingSecondaryCitation, 'data-types').sourceRefs = ['jsa-l3']
  assert.equal(validateLessonRegistry(missingSecondaryCitation), false)

  const unrelatedSource = copy(lessonRegistryFixture)
  lesson(unrelatedSource, 'descriptive-statistics').sourceRefs = ['scope-src-0001']
  assert.equal(validateLessonRegistry(unrelatedSource), false)

  const badUrl = copy(lessonRegistryFixture)
  badUrl.sources[0].url = 'javascript:alert(1)'
  assert.equal(validateLessonRegistry(badUrl), false)

  const badCitation = copy(lessonRegistryFixture)
  badCitation.sources[0].citations = []
  assert.equal(validateLessonRegistry(badCitation), false)

  const unresolvedFigure = copy(lessonRegistryFixture)
  lesson(unresolvedFigure, 'descriptive-statistics').sections[1].blocks[2].figureId = 'FIG-MISSING'
  assert.equal(validateLessonRegistry(unresolvedFigure), false)

  const duplicateFigure = copy(lessonRegistryFixture)
  lesson(duplicateFigure, 'math-algebra-sigma').figures.push(copy(lesson(duplicateFigure, 'descriptive-statistics').figures[0]))
  assert.equal(validateLessonRegistry(duplicateFigure), false)

  const badRenderer = copy(lessonRegistryFixture)
  lesson(badRenderer, 'descriptive-statistics').figures[0].rendererRef = 'image:generated-figure'
  assert.equal(validateLessonRegistry(badRenderer), false)
})

test('shared and conditional prerequisites form one acyclic graph; optional reviews are excluded', () => {
  const sharedCycle = copy(lessonRegistryFixture)
  lesson(sharedCycle, 'data-types').commonPrerequisites = ['descriptive-statistics']
  assert.equal(validateLessonRegistry(sharedCycle), false)

  const combinedCycle = copy(lessonRegistryFixture)
  lesson(combinedCycle, 'data-types').conditionalPrerequisites = [{
    conditionId: 'descriptive-statistics-conditional-back-edge',
    methodSectionRef: 'data-types#types',
    condition: '特定の方法を使う場合。',
    prerequisiteRef: 'descriptive-statistics',
  }]
  assert.equal(validateLessonRegistry(combinedCycle), false)

  const conditionalCycle = copy(lessonRegistryFixture)
  lesson(conditionalCycle, 'descriptive-statistics').commonPrerequisites = []
  lesson(conditionalCycle, 'math-algebra-sigma').commonPrerequisites = []
  lesson(conditionalCycle, 'descriptive-statistics').conditionalPrerequisites = [{
    conditionId: 'descriptive-statistics-conditional-forward-edge',
    methodSectionRef: 'descriptive-statistics#mean',
    condition: '特定の方法を使う場合。',
    prerequisiteRef: 'data-types',
  }]
  lesson(conditionalCycle, 'data-types').conditionalPrerequisites = [{
    conditionId: 'data-types-conditional-back-edge',
    methodSectionRef: 'data-types#types',
    condition: '特定の方法を使う場合。',
    prerequisiteRef: 'descriptive-statistics',
  }]
  assert.equal(validateLessonRegistry(conditionalCycle), false)

  const selfCycle = copy(lessonRegistryFixture)
  lesson(selfCycle, 'descriptive-statistics').commonPrerequisites.push('descriptive-statistics')
  assert.equal(validateLessonRegistry(selfCycle), false)

  const optionalCycle = copy(lessonRegistryFixture)
  assert.equal(validateLessonRegistry(optionalCycle), true)
})

test('conditions keep method scope', () => {
  const conditional = copy(lessonRegistryFixture)
  lesson(conditional, 'descriptive-statistics').conditionalPrerequisites = [{
    conditionId: 'descriptive-mean-method',
    methodSectionRef: 'descriptive-statistics#mean',
    condition: '特定の方法を選んだ場合。',
    prerequisiteRef: 'math-ratios-percentages',
  }]
  lesson(conditional, 'math-algebra-sigma').conditionalPrerequisites = [{
    conditionId: 'descriptive-mean-method',
    methodSectionRef: 'math-algebra-sigma#sigma',
    condition: '別の方法を選んだ場合。',
    prerequisiteRef: 'math-ratios-percentages',
  }]
  assert.equal(validateLessonRegistry(conditional), false)

  const wrongMethod = copy(lessonRegistryFixture)
  lesson(wrongMethod, 'descriptive-statistics').conditionalPrerequisites = [{
    conditionId: 'descriptive-mean-method',
    methodSectionRef: 'math-algebra-sigma#sigma',
    condition: '特定の方法を選んだ場合。',
    prerequisiteRef: 'math-ratios-percentages',
  }]
  assert.equal(validateLessonRegistry(wrongMethod), false)

})

test('unknown keys, undefined values, malformed IDs, and invalid revisions are rejected', () => {
  assert.equal(validateLessonRegistry({ ...copy(lessonRegistryFixture), extra: true }), false)
  assert.equal(validateLessonRegistry({ ...copy(lessonRegistryFixture), curriculumRevision: 0 }), false)
  assert.equal(validateLessonRegistry({ ...copy(lessonRegistryFixture), curriculumRevision: Number.NaN }), false)

  const undefinedValue = copy(lessonRegistryFixture)
  lesson(undefinedValue, 'descriptive-statistics').extra = undefined
  assert.equal(validateLessonRegistry(undefinedValue), false)

  const retiredQuestionIds = copy(lessonRegistryFixture)
  lesson(retiredQuestionIds, 'descriptive-statistics').questionIds = []
  assert.equal(validateLessonRegistry(retiredQuestionIds), false)

  const malformedId = copy(lessonRegistryFixture)
  lesson(malformedId, 'descriptive-statistics').revision = 1.5
  assert.equal(validateLessonRegistry(malformedId), false)

  const missingDomain = copy(lessonRegistryFixture)
  delete lesson(missingDomain, 'descriptive-statistics').domain
  assert.equal(validateLessonRegistry(missingDomain), false)

  const unknownDomain = copy(lessonRegistryFixture)
  lesson(unknownDomain, 'descriptive-statistics').domain = 'other'
  assert.equal(validateLessonRegistry(unknownDomain), false)
})

test('exercise contract errors identify definitions and reject broken data and nested references', () => {
  const unknownMode = copy(lessonRegistryFixture)
  unknownMode.exerciseCatalog.definitions.find(({ exerciseId }) => exerciseId === 'generated-counts').generation.kind = 'random'
  assert.equal(validateLessonRegistry(unknownMode), false)
  assert.ok(getExerciseCatalogErrors(unknownMode.exerciseCatalog, unknownMode.lessons)
    .some((error) => error.includes('data-types:generated-counts') && error.includes('generation.kind')))

  const duplicate = copy(lessonRegistryFixture)
  duplicate.exerciseCatalog.definitions.push(copy(duplicate.exerciseCatalog.definitions[0]))
  assert.equal(validateLessonRegistry(duplicate), false)

  const mismatchedFields = copy(lessonRegistryFixture)
  mismatchedFields.exerciseCatalog.definitions[0].generation.question.evaluation.answers.pop()
  assert.equal(validateLessonRegistry(mismatchedFields), false)
  assert.ok(getExerciseCatalogErrors(mismatchedFields.exerciseCatalog, mismatchedFields.lessons)
    .some((error) => error.includes('data-types:observed-counts') && error.includes('evaluation.answers')))

  const duplicateField = copy(lessonRegistryFixture)
  duplicateField.exerciseCatalog.definitions[0].generation.question.display.response.fields[1].id = 'alpha-count'
  assert.equal(validateLessonRegistry(duplicateField), false)

  const unresolvedChoice = copy(lessonRegistryFixture)
  unresolvedChoice.exerciseCatalog.definitions[2].generation.question.evaluation.correctChoiceId = 'missing-choice'
  assert.equal(validateLessonRegistry(unresolvedChoice), false)

  const unresolvedFeedback = copy(lessonRegistryFixture)
  unresolvedFeedback.exerciseCatalog.definitions[2].generation.question.solution.choiceFeedback[0].reviewSectionRefs = ['data-types#missing']
  assert.equal(validateLessonRegistry(unresolvedFeedback), false)

  const invalidDecimal = copy(lessonRegistryFixture)
  invalidDecimal.exerciseCatalog.definitions[0].generation.question.evaluation.answers[0].expected = '01'
  assert.equal(validateLessonRegistry(invalidDecimal), false)
  const acceptedDecimal = copy(lessonRegistryFixture)
  acceptedDecimal.exerciseCatalog.definitions[0].generation.question.display.response.fields[0].roundingDigits = 1
  acceptedDecimal.exerciseCatalog.definitions[0].generation.question.evaluation.answers[0] = {
    fieldId: 'alpha-count', expected: ' +2.5 ', roundingDigits: 1,
  }
  assert.equal(validateLessonRegistry(acceptedDecimal), true)

  const nestedReference = copy(lessonRegistryFixture)
  lesson(nestedReference, 'descriptive-statistics').sections.find(({ sectionId }) => sectionId === 'mean').blocks.push({
    kind: 'details', summary: '追加の説明', blocks: [{ kind: 'lessonRef', label: '利用できない節', targetRef: 'math-ratios-percentages#ratio' }],
  })
  assert.equal(validateLessonRegistry(nestedReference), false)

  const overviewSlot = copy(lessonRegistryFixture)
  lesson(overviewSlot, 'data-types').overview = [{ kind: 'exerciseSlot', exerciseId: 'observed-counts' }]
  assert.equal(validateLessonRegistry(overviewSlot), false)

  const missingSlot = copy(lessonRegistryFixture)
  lesson(missingSlot, 'data-types').sections[0].blocks = [
    { kind: 'paragraph', parts: [{ kind: 'text', text: '測定値と計数値を区別します。' }] },
  ]
  assert.equal(validateLessonRegistry(missingSlot), false)
})
