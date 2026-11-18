import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDescriptiveStatisticsExercisePreviewState,
  descriptiveStatisticsExerciseCategories,
  generateDescriptiveStatisticsExercisePreviewQuestion,
  generateDescriptiveStatisticsExercisePreviewQuestionById,
  nextDescriptiveStatisticsExercisePreviewState,
} from '../src/descriptive-statistics-exercise-preview-data.mjs'
import { generateExerciseInstance, getExerciseGradingData, getExerciseQuestionDisplay } from '../src/lesson-contract.mjs'
import { lessonExerciseGenerators } from '../src/lesson-exercise-adapters.mjs'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import { descriptiveStatisticsExerciseBaseline } from './descriptive-statistics-exercise-baseline.fixture.mjs'

function legacyQuestionFromInstance(instance) {
  const display = getExerciseQuestionDisplay(instance)
  const { evaluation, solution } = getExerciseGradingData(instance)
  const question = {
    prompt: display.prompt,
    sections: display.reviewSectionRefs.map((reference) => reference.split('#')[1]),
    explanation: solution.explanation,
    ...(display.table ? { table: display.table } : {}),
    ...(display.calculations ? { calculation: display.calculations } : {}),
  }
  if (display.response.type === 'choice' && evaluation.type === 'choice') {
    return {
      ...question,
      type: 'choice',
      choices: display.response.choices.map(({ text }) => text),
      answer: display.response.choices.findIndex(({ id }) => id === evaluation.correctChoiceId),
    }
  }
  if (display.response.type === 'numeric' && evaluation.type === 'numeric') {
    return {
      ...question,
      type: 'numeric',
      unit: display.response.fields[0].unit,
      answer: evaluation.answers[0].expected,
    }
  }
  throw new TypeError('Exercise display and grading data do not match')
}

test('exercise preview covers the five lesson areas with deterministic question variants', () => {
  const expectedSections = [
    [['deviation'], ['mean'], ['deviation']],
    [['deviation'], ['variance', 'standard-deviation'], ['standard-deviation']],
    [['variance'], ['variance'], ['variance']],
    [['variance', 'standard-deviation'], ['variance', 'standard-deviation'], ['mean', 'deviation', 'variance']],
    [['standard-deviation'], ['standard-deviation'], ['standard-deviation']],
  ]

  assert.deepEqual(descriptiveStatisticsExerciseCategories.map(({ title }) => title), [
    '平均と偏差', 'データの変換', '不偏分散', '総合', '分散と標準偏差',
  ])
  for (let categoryIndex = 0; categoryIndex < expectedSections.length; categoryIndex += 1) {
    for (let typeIndex = 0; typeIndex < 3; typeIndex += 1) {
      const first = generateDescriptiveStatisticsExercisePreviewQuestion(categoryIndex, typeIndex, 48291)
      assert.deepEqual(first, generateDescriptiveStatisticsExercisePreviewQuestion(categoryIndex, typeIndex, 48291))
      assert.deepEqual(first.sections, expectedSections[categoryIndex][typeIndex])
      assert.ok(first.prompt.length > 0)
      assert.ok(first.explanation.length > 0)
      if (first.type === 'choice') {
        assert.equal(first.choices.length, 4)
        assert.ok(Number.isInteger(first.answer) && first.answer >= 0 && first.answer < first.choices.length)
        assert.equal(new Set(first.choices).size, first.choices.length)
      } else {
        assert.match(first.answer, /^[+-]?\d+(\.\d+)?$/u)
        assert.ok(first.unit.length > 0)
        assert.ok(first.explanation.includes(String(first.answer)))
      }
    }
  }
})

test('generated line comparison table agrees with the asked standard-deviation difference', () => {
  for (let seed = 0; seed < 100; seed += 1) {
    const question = generateDescriptiveStatisticsExercisePreviewQuestion(3, 0, seed)
    const standardDeviation = ({ values }) => {
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length
      const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
      return Math.sqrt(variance)
    }
    const [left, right] = question.table.rows
    assert.equal(Math.abs(standardDeviation(left) - standardDeviation(right)), Number(question.answer))
  }
})

test('integrated calculation question presents one consistent mistake at each step', () => {
  const foundErrors = new Set()
  const parseSigned = (value) => Number(value.replace('−', '-').replace(/^\+/u, ''))
  for (let seed = 0; seed < 100; seed += 1) {
    const question = generateDescriptiveStatisticsExercisePreviewQuestion(3, 2, seed)
    const [, rawValues, rawCount, rawTotal] = question.calculation[0].match(/① 平均 = \(([^)]+)\) ÷ (\d+) = (\d+) ÷/u)
    const values = rawValues.split(' + ').map(Number)
    const count = Number(rawCount)
    const total = values.reduce((sum, value) => sum + value, 0)
    const mean = total / count
    const deviations = values.map((value) => value - mean)
    foundErrors.add(question.answer)
    assert.equal(question.choices[question.answer], `${['①', '②', '③', '④'][question.answer]} ${['平均', '偏差', '偏差平方和', '分散'][question.answer]}の計算`)
    assert.ok(question.explanation.startsWith(['①', '②', '③', '④'][question.answer]))
    if (question.answer === 0) assert.notEqual(Number(rawTotal), total)
    if (question.answer === 1) {
      const shownDeviations = question.calculation[1].slice('② 偏差 = '.length).split('、').map(parseSigned)
      assert.notDeepEqual(shownDeviations, deviations)
    }
    if (question.answer === 2) {
      const shownTotal = Number(question.calculation[2].match(/= (\d+)$/u)[1])
      assert.notEqual(shownTotal, deviations.reduce((sum, value) => sum + value ** 2, 0))
    }
    if (question.answer === 3) assert.equal(Number(question.calculation[3].match(/S ÷ (\d+)/u)[1]), count)
  }
  assert.deepEqual([...foundErrors].sort(), [0, 1, 2, 3])
})

test('individual regeneration changes the question type and validates its random source', () => {
  const first = createDescriptiveStatisticsExercisePreviewState(0, () => 0)
  assert.deepEqual(first, { typeIndex: 0, seed: 0 })
  const next = nextDescriptiveStatisticsExercisePreviewState(0, first, () => 0)
  assert.equal(next.typeIndex, 1)
  assert.notEqual(next.seed, first.seed)

  assert.throws(() => createDescriptiveStatisticsExercisePreviewState(5), RangeError)
  assert.throws(() => generateDescriptiveStatisticsExercisePreviewQuestion(0, 3, 1), RangeError)
  assert.throws(() => generateDescriptiveStatisticsExercisePreviewQuestion(0, 0, -1), RangeError)
  assert.throws(() => createDescriptiveStatisticsExercisePreviewState(0, () => 1), RangeError)
  assert.throws(() => nextDescriptiveStatisticsExercisePreviewState(0, first, () => Number.NaN), RangeError)
})

test('type IDs and the shared contract preserve frozen questions and resolve independently of order', () => {
  for (const { categoryId, questions } of descriptiveStatisticsExerciseBaseline.questions) {
    const category = descriptiveStatisticsExerciseCategories.find((item) => item.id === categoryId)
    for (const { typeIndex, question: expected } of questions) {
      const typeId = category.typeIds[typeIndex]
      assert.deepEqual(generateDescriptiveStatisticsExercisePreviewQuestionById(categoryId, typeId,
        descriptiveStatisticsExerciseBaseline.seed), expected)
      const instance = generateExerciseInstance(lessonRegistry, 'descriptive-statistics', typeId,
        descriptiveStatisticsExerciseBaseline.seed, lessonExerciseGenerators)
      assert.deepEqual(legacyQuestionFromInstance(instance), expected)
    }
  }
  for (const { seed, question: expected } of descriptiveStatisticsExerciseBaseline.integratedErrorSeeds) {
    const typeId = descriptiveStatisticsExerciseCategories.find(({ id }) => id === 'comprehensive').typeIds[2]
    const instance = generateExerciseInstance(lessonRegistry, 'descriptive-statistics', typeId, seed, lessonExerciseGenerators)
    assert.deepEqual(legacyQuestionFromInstance(instance), expected)
    assert.equal(expected.answer, [2, 8, 1, 0].indexOf(seed))
  }

  const category = descriptiveStatisticsExerciseCategories[0]
  const typeId = category.typeIds[0]
  const original = generateExerciseInstance(lessonRegistry, 'descriptive-statistics', typeId, 48291, lessonExerciseGenerators)
  const repeated = generateExerciseInstance(lessonRegistry, 'descriptive-statistics', typeId, 48291, lessonExerciseGenerators)
  const differentInput = generateExerciseInstance(lessonRegistry, 'descriptive-statistics', typeId, 48292, lessonExerciseGenerators)
  assert.equal(original.instanceId, repeated.instanceId)
  assert.notEqual(original.instanceId, differentInput.instanceId)

  const reordered = structuredClone(lessonRegistry)
  reordered.exerciseCatalog.categories.reverse()
  reordered.exerciseCatalog.generators[1].types.reverse()
  reordered.exerciseCatalog.definitions.reverse()
  for (const { categoryId, questions } of descriptiveStatisticsExerciseBaseline.questions) {
    const categoryDefinition = descriptiveStatisticsExerciseCategories.find((item) => item.id === categoryId)
    for (const { typeIndex, question: expected } of questions) {
      const reorderedInstance = generateExerciseInstance(reordered, 'descriptive-statistics', categoryDefinition.typeIds[typeIndex],
        descriptiveStatisticsExerciseBaseline.seed, lessonExerciseGenerators)
      assert.deepEqual(legacyQuestionFromInstance(reorderedInstance), expected)
    }
    for (const typeId of categoryDefinition.typeIds) {
      for (const seed of [0, 0xffffffff]) {
        const boundary = generateExerciseInstance(reordered, 'descriptive-statistics', typeId, seed, lessonExerciseGenerators)
        assert.deepEqual(legacyQuestionFromInstance(boundary),
          generateDescriptiveStatisticsExercisePreviewQuestionById(categoryId, typeId, seed))
      }
    }
  }
})
