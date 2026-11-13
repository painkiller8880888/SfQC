import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDescriptiveStatisticsExercisePreviewState,
  descriptiveStatisticsExerciseCategories,
  generateDescriptiveStatisticsExercisePreviewQuestion,
  nextDescriptiveStatisticsExercisePreviewState,
} from '../src/descriptive-statistics-exercise-preview-data.mjs'

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
