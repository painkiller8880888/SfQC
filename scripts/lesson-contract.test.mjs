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
  assert.equal(lesson(lessonRegistry, 'descriptive-statistics').revision, 7)
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
    assert.equal(item.revision, item.lessonId === 'data-types' ? 9 : item.lessonId === 'descriptive-statistics' ? 7 : 2)
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
  const unitBlocks = dataTypes.sections.find(({ sectionId }) => sectionId === 'observation-unit').blocks
  assert.match(unitBlocks[0].parts[0].text, /まず何を一つの観測対象とするかを決めます。.*製品1個につき1行の記録を作ります/u)
  assert.match(unitBlocks[1].parts[0].text, /観測単位を決めてから.*傷1件につき1行/u)
  assert.deepEqual(unitBlocks.filter(({ kind }) => kind === 'table').map(({ caption }) => caption), ['基準を超えた傷の明細（1行＝傷1件）'])

  const typesBlocks = dataTypes.sections.find(({ sectionId }) => sectionId === 'types').blocks
  const figureBlock = typesBlocks.find(({ kind }) => kind === 'figureRef')
  assert.equal(dataTypes.figures.length, 1)
  const [figure] = dataTypes.figures
  assert.equal(figure.figureId, figureBlock.figureId)
  assert.equal(figure.kind, 'diagram')
  assert.equal(figure.rendererRef, 'code:data-type-flow')
  assert.match(figure.altText, /種類・判定ならカテゴリ.*測った値は計量値、数えた値は計数値/u)
  assert.ok(typesBlocks.some(({ kind, text }) => kind === 'heading' && text === '記録と集計の違い'))
  assert.deepEqual(typesBlocks.filter(({ kind }) => kind === 'table').map(({ caption, rows }) => [caption, rows]), [
    ['製品ごとの適合状態', [
      ['P-01', '1', '不適合'], ['P-02', '0', '適合'], ['P-03', '1', '不適合'], ['P-04', '0', '適合'],
    ]],
  ])
  assert.equal(typesBlocks.find(({ kind }) => kind === 'formula').parts[0].text, '不適合品数 = 1 + 0 + 1 + 0 = 2 個')
  assert.ok(typesBlocks.some(({ kind, parts }) => kind === 'paragraph' && /カテゴリのコード.*離散的な計数値/u.test(parts[0].text)))
  const codeExplanation = typesBlocks.find(({ kind, parts }) => kind === 'paragraph' && parts[0].text.includes('0/1の合計'))
  assert.match(codeExplanation.parts[0].text, /明細の行数は不適合品数と一致するとは限りません。.*製品番号を重複なく数えます/u)
  assert.match(codeExplanation.parts[0].text, /0\/1の合計は常に、集計した行にある1の個数です。.*過不足なく1回ずつ1.*全製品を1製品1行.*この条件/u)
  const details = typesBlocks.find(({ kind }) => kind === 'details')
  assert.match(details.blocks[0].parts[0].text, /記録から漏れると過少計上の原因.*複数行で1と記録すると過大計上の原因.*漏れと重複.*数が打ち消し合い、合計だけでは誤りに気づけない/u)
  assert.equal(dataTypes.references.length, 3)
  assert.ok(dataTypes.references.every(({ details }) => details.includes('2026-11-20')))
  assert.ok(lesson(lessonRegistry, 'population-sample').commonPrerequisites.includes('data-types#observation-unit'))
  assert.ok(lesson(lessonRegistry, 'descriptive-statistics').commonPrerequisites.includes('data-types#types'))

  const definitions = lessonRegistry.exerciseCatalog.definitions.filter(({ lessonId }) => lessonId === 'data-types')
  assert.deepEqual(definitions.map(({ placement }) => placement.sectionId), dataTypes.declaredSectionIds)
  assert.deepEqual(definitions.map(({ revision }) => revision), [5, 7, 5])
  assert.deepEqual(definitions.map(({ generation }) => generation.kind), ['fixed', 'index', 'fixed'])
  assert.deepEqual(definitions[1].generation, {
    kind: 'index', generatorId: 'data-types-cases', typeId: 'defect-aggregation', minimum: 0, maximum: 2,
  })
})

test('the fixed data-types exercises contain their own tables and the inspection conditions', () => {
  const observation = getExerciseQuestionDisplay(generateLessonExercise('data-types', 'identify-observation-unit'))
  assert.match(observation.prompt, /検査した製品をすべて.*基準を超えた傷をすべて.*2つの表/u)
  assert.deepEqual(observation.table.map(({ caption }) => caption), ['検査対象の製品一覧（1行＝製品1個）', '基準を超えた傷の明細'])
  assert.deepEqual(observation.table[0].rows.map(({ label, values }) => [label, ...values]), [
    ['P-01', 2], ['P-02', 1], ['P-03', 1], ['P-04', 0], ['P-05', 1],
  ])
  assert.deepEqual(observation.table[1].rows.map(({ label, values }) => [label, ...values]), [
    ['傷1', 'P-01'], ['傷2', 'P-01'], ['傷3', 'P-03'],
  ])

  const classificationInstance = generateLessonExercise('data-types', 'classify-record')
  const classification = getExerciseQuestionDisplay(classificationInstance)
  assert.match(classification.prompt, /^検査した5個をすべて、1製品1行で記録しました。適合状態コードは0＝適合、1＝不適合です。/u)
  assert.deepEqual(classification.table.columnLabels, [
    '長さ（mm・整数記録）', '基準を超えた傷（件）', '適合状態コード（0／1）',
  ])
  assert.deepEqual(classification.table.rows.map(({ label, values }) => [label, ...values]), [
    ['Q-01', 14, 0, 0], ['Q-02', 11, 2, 1], ['Q-03', 16, 1, 1], ['Q-04', 15, 0, 0], ['Q-05', 11, 3, 1],
  ])

  let nonconformingProducts = 0
  let nonconformities = 0
  for (const { values: [, scratches, code] } of classification.table.rows) {
    assert.equal(code, Number(scratches > 0))
    nonconformingProducts += code
    nonconformities += scratches
  }
  assert.equal(nonconformingProducts, 3)
  assert.equal(nonconformities, 6)
  const { solution } = getExerciseGradingData(classificationInstance)
  assert.match(solution.steps.at(-1), /0 \+ 1 \+ 1 \+ 0 \+ 1 = 3.*不適合品数は3個/u)
  assert.match(solution.explanation, /全製品を1製品1行.*Q-02、Q-03、Q-05.*1回ずつ1.*不適合品数3個/u)
  assert.match(solution.choiceFeedback.find(({ choiceId }) => choiceId === 'choice-2').misconception,
    /コードの合計は不適合品数（3個）.*不適合数は.*6件/u)
})

test('data-types cases reproduce two formats of the same inspection and a separate inspection', () => {
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
  const sameInspection = generateLessonExercise('data-types', 'defect-aggregation', 1)
  const sameInspectionDisplay = getExerciseQuestionDisplay(sameInspection)
  assert.match(sameInspectionDisplay.prompt, /事例1と同じ6製品の検査結果/u)
  assert.equal(sameInspectionDisplay.table.caption, '基準を超えた傷の明細')
  assert.deepEqual(sameInspectionDisplay.table.rows, [
    { label: '傷1', values: ['P-01'] }, { label: '傷2', values: ['P-01'] },
    { label: '傷3', values: ['P-01'] }, { label: '傷4', values: ['P-03'] },
  ])
  assert.deepEqual(sameInspectionDisplay.table.rows.map(({ values }) => values[0]),
    productDisplay.table.rows.flatMap(({ label, values }) => Array(values[1]).fill(label)))
  const sameInspectionGrading = getExerciseGradingData(sameInspection)
  assert.match(sameInspectionGrading.solution.explanation, /同じ6製品.*別の形式.*不適合品は2個、不適合は4件/u)
  assert.match(sameInspectionGrading.solution.choiceFeedback[0].misconception, /P-01の3行は同じ製品/u)
  assert.match(sameInspectionGrading.solution.choiceFeedback[1].misconception, /P-01の傷3件をすべて含める/u)
  assert.match(sameInspectionGrading.solution.choiceFeedback[2].misconception, /P-03にも基準を超えた傷/u)

  const detailCase = generateLessonExercise('data-types', 'defect-aggregation', 2)
  const detailDisplay = getExerciseQuestionDisplay(detailCase)
  assert.match(detailDisplay.prompt, /検査対象は P-01〜P-05 の5個.*基準を超えた傷をすべて/u)
  assert.deepEqual(detailDisplay.table, {
    caption: '基準を超えた傷の明細',
    rowHeaderLabel: '傷番号',
    columnLabels: ['製品番号'],
    rows: [{ label: '傷1', values: ['P-01'] }, { label: '傷2', values: ['P-03'] }],
  })
  assert.throws(() => generateLessonExercise('data-types', 'defect-aggregation', 3), RangeError)
  assert.throws(() => generateLessonExercise('data-types', 'classify-record', 0), RangeError)

  const answerPositions = []
  for (const [exerciseId, input, sections, answer] of [
    ['identify-observation-unit', undefined, ['observation-unit'], /P-02・P-05の傷は基準内で、P-04には傷がない。検査総数は一覧の5個。$/u],
    ['defect-aggregation', 0, ['counting'], /^不適合品2個、不適合4件。/u],
    ['defect-aggregation', 1, ['observation-unit', 'counting'], /^不適合品2個、不適合4件。製品番号を重複なく数え/u],
    ['defect-aggregation', 2, ['observation-unit'], /^不適合品2個、不適合2件。製品番号を重複なく数える/u],
    ['classify-record', undefined, ['types'], /コードの合計3は不適合品数（3個）。$/u],
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
    assert.deepEqual(display.reviewSectionRefs, sections.map((sectionId) => `data-types#${sectionId}`))
    assert.deepEqual(grading.solution.choiceFeedback.map(({ choiceId }) => choiceId), display.response.choices
      .filter(({ id }) => id !== grading.evaluation.correctChoiceId).map(({ id }) => id))
    for (const { reviewSectionRefs } of grading.solution.choiceFeedback) {
      assert.deepEqual(reviewSectionRefs, display.reviewSectionRefs)
    }
    const lengths = display.response.choices.map(({ text }) => text.length)
    assert.ok(Math.max(...lengths) - Math.min(...lengths) <= 16)
  }
  assert.equal(new Set(answerPositions).size, 4)
  assert.equal(new Set(answerPositions.slice(1, 4)).size, 3)

  const wrongReason = detailDisplay.response.choices.find(({ text }) => text.includes('明細の各行を製品1個として数え'))
  assert.match(wrongReason.text, /^不適合品2個、不適合2件。.*傷の件数は明細の行数で求める。$/u)
  assert.match(getExerciseGradingData(detailCase).solution.choiceFeedback
    .find(({ choiceId }) => choiceId === wrongReason.id).misconception, /数は合っていますが、理由が誤り.*行数と不適合品数が一致/u)
  const countAllScratches = productDisplay.response.choices.find(({ text }) => text.startsWith('不適合品2個、不適合8件。'))
  assert.equal(countAllScratches.text, '不適合品2個、不適合8件。基準を超えた傷が1件以上ある製品を数え、見つかった傷の列を合計する。')
  assert.match(getExerciseGradingData(productCase).solution.choiceFeedback
    .find(({ choiceId }) => choiceId === countAllScratches.id).misconception, /8件.*基準内の傷.*4件/u)
  assert.match(getExerciseGradingData(detailCase).solution.explanation, /1行ずつ.*2個.*2件.*重複.*不適合品数より多く/u)
})

test('each observation-unit option covers the same four points in a similar length', () => {
  const instance = generateLessonExercise('data-types', 'identify-observation-unit')
  const { response } = getExerciseQuestionDisplay(instance)
  for (const { text } of response.choices) {
    assert.match(text, /^明細の1行は[^。]+。P-01の2行は[^。]+。明細にない[^。]+。検査総数は[^。]+。$/u)
  }
  const lengths = response.choices.map(({ text }) => text.length)
  assert.ok(Math.max(...lengths) - Math.min(...lengths) <= 8)
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

  const multiple = copy(labeled)
  const multipleDisplay = multiple.exerciseCatalog.definitions.find(({ exerciseId }) => exerciseId === 'observed-counts').generation.question.display
  const validTable = multipleDisplay.table
  multipleDisplay.table = [validTable, { rows: [{ label: '傷1', values: ['P-01'] }] }]
  assert.equal(validateLessonRegistry(multiple), true)
  for (const invalidTables of [[], [validTable, { rows: [] }], Array(2)]) {
    multipleDisplay.table = invalidTables
    assert.equal(validateLessonRegistry(multiple), false)
  }

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
  assert.equal(descriptive.revision, 7)
  const revisedExercises = lessonRegistry.exerciseCatalog.definitions
    .filter(({ lessonId, revision }) => lessonId === descriptive.lessonId && revision !== 2)
    .map(({ exerciseId, revision }) => [exerciseId, revision])
  assert.deepEqual(revisedExercises, [
    ['data-transformation-add-constant', 3],
    ['data-transformation-unit', 3],
    ['unbiased-variance-mean-and-sum', 3],
    ['unbiased-variance-denominator', 3],
    ['unbiased-variance-conditions', 4],
  ])
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
  assert.ok(descriptive.references.some(({ url, details }) => url.includes('openstax.org') && details.includes('例と設問は独自に作成')))
  assert.deepEqual(descriptive.references.filter(({ title }) => title.startsWith('JSA')).map(({ url }) => url), [
    'https://webdesk.jsa.or.jp/pdf/qc/md_4609.pdf#page=1', 'https://webdesk.jsa.or.jp/pdf/qc/md_4610.pdf#page=1',
  ])
  assert.match(descriptive.references.find(({ title }) => title.includes('自由度')).details, /確認日：2026-11-25/u)
  assert.match(courseText, /標本が変わると V も変わりえますが、異なる標本で同じ値/u)
  assert.match(courseText, /戻さずに単純無作為抽出.*N ÷ \(N − 1\) 倍/u)
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
