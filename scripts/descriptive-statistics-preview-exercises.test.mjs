import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generateDescriptiveStatisticsPreviewExercise,
  nextPreviewExerciseIndex,
  previewExerciseDefinitions,
} from '../src/descriptive-statistics-preview-exercises.mjs'
import { gradeDecimalAnswer } from '../src/question-grading.mjs'
import { generateLessonExercise } from '../src/lesson-exercise-adapters.mjs'
import { getExerciseGradingData, getExerciseQuestionDisplay } from '../src/lesson-contract.mjs'
import { lessonRegistry } from '../src/lesson-registry.mjs'

function valuesFromQuestion(prompt) {
  const match = prompt.match(/(?:ところ、|3本は )((?:\d+ mm、){2}\d+ mm)/u)
  assert.ok(match, `expected three displayed measurements in: ${prompt}`)
  return match[1].split('、').map((value) => Number(value.replace(/ mm$/u, '')))
}
const measurements = (index) => valuesFromQuestion(generateDescriptiveStatisticsPreviewExercise('mean', index).prompt)
const multisetKey = (values) => values.slice().sort((a, b) => a - b).join(',')

test('preview exercises reproduce the four reviewed seed questions and calculations', () => {
  const expected = {
    mean: {
      prompt: '別のライン C から3本を測ったところ、98 mm、103 mm、102 mm でした。平均は何 mm ですか。',
      fields: [{ label: '平均', unit: 'mm' }],
      answers: ['101'],
      steps: ['(98 + 103 + 102) mm = 303 mm', '303 mm ÷ 3 = 101 mm'],
      solution: '測定値の合計を測定した本数で割ると、平均が求まります。',
    },
    deviation: {
      prompt: '別のライン D の平均は 102 mm でした。測った3本は 100 mm、106 mm、100 mm です。それぞれの偏差（値 − 平均）を求めてください。',
      fields: [{ label: '1本目', unit: 'mm' }, { label: '2本目', unit: 'mm' }, { label: '3本目', unit: 'mm' }],
      answers: ['-2', '4', '-2'],
      steps: ['1本目：100 mm − 102 mm = −2 mm', '2本目：106 mm − 102 mm = +4 mm', '3本目：100 mm − 102 mm = −2 mm'],
      solution: '偏差は、測定値が平均からどちらへどれだけ離れているかを表します。偏差が 0 mm のとき、測定値は平均と同じです。',
    },
    variance: {
      prompt: '別のライン E から3本を測ったところ、97 mm、101 mm、102 mm でした。偏差平方和 S と、n − 1 で割る不偏分散 V を求めてください。',
      fields: [{ label: 'S', unit: 'mm²' }, { label: 'V', unit: 'mm²' }],
      answers: ['14', '7'],
      steps: [
        '平均 = (97 + 101 + 102) mm ÷ 3 = 100 mm',
        '偏差は −3 mm、+1 mm、+2 mm',
        'S = (−3 mm)² + (+1 mm)² + (+2 mm)² = 14 mm²',
        'V = 14 mm² ÷ (3 − 1) = 7 mm²',
      ],
      solution: '偏差平方和 S は、平均からのずれを二乗して足した値です。S を n − 1 で割ると不偏分散 V が求まります。',
    },
    'standard-deviation': {
      prompt: '別のライン F から3本を測ったところ、97 mm、100 mm、103 mm でした。n − 1 で割った不偏分散から求める標準偏差 s は何 mm ですか。',
      fields: [{ label: 's', unit: 'mm' }],
      answers: ['3'],
      steps: [
        '平均 = (97 + 100 + 103) mm ÷ 3 = 100 mm',
        '偏差は −3 mm、0 mm、+3 mm',
        'S = (−3 mm)² + (0 mm)² + (+3 mm)² = 18 mm²',
        'V = 18 mm² ÷ (3 − 1) = 9 mm²',
        's = √(9 mm²) = 3 mm',
      ],
      solution: '不偏分散の平方根を取ると標準偏差が求まります。単位が測定値と同じ mm に戻るので、平均の周りの散らばりを長さとして読めます。',
    },
  }

  for (const [id, expectedExercise] of Object.entries(expected)) {
    const exercise = generateDescriptiveStatisticsPreviewExercise(id, previewExerciseDefinitions[id].initialIndex)
    assert.deepEqual(exercise, expectedExercise)
    assert.ok(!exercise.prompt.includes(exercise.solution), `${id} should keep its explanation out of the question`)

    const instance = generateLessonExercise('descriptive-statistics', id, previewExerciseDefinitions[id].initialIndex)
    const display = getExerciseQuestionDisplay(instance)
    const { evaluation, solution } = getExerciseGradingData(instance)
    assert.equal(display.prompt, exercise.prompt)
    assert.deepEqual(display.response.type === 'numeric' ? display.response.fields.map(({ label, unit }) => ({ label, unit })) : [], exercise.fields)
    assert.deepEqual(evaluation.type === 'numeric' ? evaluation.answers.map(({ expected: answer }) => answer) : [], exercise.answers)
    assert.equal(solution.explanation, exercise.solution)
    assert.deepEqual(solution.steps, exercise.steps)
    assert.equal(Object.hasOwn(display, 'evaluation'), false)
    assert.equal(Object.hasOwn(display, 'solution'), false)
  }
})

test('every generated question is distinct from the worked examples and exposes canonical integer answers', () => {
  const lesson = lessonRegistry.lessons.find(({ lessonId }) => lessonId === 'descriptive-statistics')
  const workedExample = lesson.overview.find(({ kind, caption }) => kind === 'table' && caption === '測定した長さ（mm）')
  assert.equal(workedExample.rows.length, 2)
  const workedMultisets = new Set(workedExample.rows.map((row) => multisetKey(row.slice(1).map(Number))))

  for (const [id, { count }] of Object.entries(previewExerciseDefinitions)) {
    const prompts = new Set()
    for (let index = 0; index < count; index += 1) {
      const exercise = generateDescriptiveStatisticsPreviewExercise(id, index)
      const instance = generateLessonExercise('descriptive-statistics', id, index)
      const display = getExerciseQuestionDisplay(instance)
      const { evaluation, solution } = getExerciseGradingData(instance)
      assert.ok(exercise.prompt.length)
      assert.ok(exercise.solution.length)
      assert.equal(exercise.fields.length, exercise.answers.length)
      assert.equal(display.prompt, exercise.prompt)
      assert.equal(evaluation.type, 'numeric')
      assert.deepEqual(evaluation.answers.map(({ expected }) => expected), exercise.answers)
      assert.equal(solution.explanation, exercise.solution)
      assert.deepEqual(solution.steps, exercise.steps)
      assert.ok(!workedMultisets.has(multisetKey(valuesFromQuestion(exercise.prompt))), `${id} index ${index} repeats a worked example`)
      for (const answer of exercise.answers) {
        assert.equal(typeof answer, 'string')
        assert.match(answer, /^-?(?:0|[1-9]\d*)$/u)
        assert.ok(Number.isSafeInteger(Number(answer)))
        assert.deepEqual(gradeDecimalAnswer(answer, answer, 0), { status: 'graded', isCorrect: true })
      }
      assert.ok(!prompts.has(exercise.prompt), `${id} repeats a displayed problem at index ${index}`)
      prompts.add(exercise.prompt)
    }
    assert.equal(prompts.size, count)
  }
})

test('inline generated answers and steps agree with the displayed measurements, divisors, and units', () => {
  const signed = (value) => `${value < 0 ? '−' : value > 0 ? '+' : ''}${Math.abs(value)}`
  const expectedVarianceSteps = (values, mean, deviations, sumOfSquares, divisor) => [
    `平均 = (${values.join(' + ')}) mm ÷ ${values.length} = ${mean} mm`,
    `偏差は ${deviations.map((value) => `${signed(value)} mm`).join('、')}`,
    `S = ${deviations.map((value) => `(${signed(value)} mm)²`).join(' + ')} = ${sumOfSquares} mm²`,
    `V = ${sumOfSquares} mm² ÷ (${divisor + 1} − 1) = ${sumOfSquares / divisor} mm²`,
  ]

  for (const [id, { count }] of Object.entries(previewExerciseDefinitions)) {
    for (let index = 0; index < count; index += 1) {
      const exercise = generateDescriptiveStatisticsPreviewExercise(id, index)
      const values = valuesFromQuestion(exercise.prompt)
      const total = values.reduce((sum, value) => sum + value, 0)
      const mean = total / values.length
      const deviations = values.map((value) => value - mean)
      const sumOfSquares = deviations.reduce((sum, value) => sum + value ** 2, 0)
      const divisor = values.length - 1
      assert.ok(divisor > 0, `${id} must not divide by zero`)

      if (id === 'mean') {
        assert.equal(exercise.answers[0], String(mean))
        assert.deepEqual(exercise.fields.map(({ unit }) => unit), ['mm'])
        assert.deepEqual(exercise.steps, [`(${values.join(' + ')}) mm = ${total} mm`, `${total} mm ÷ 3 = ${mean} mm`])
      } else if (id === 'deviation') {
        const promptMean = Number(exercise.prompt.match(/平均は (\d+) mm/u)[1])
        const expectedDeviations = values.map((value) => value - promptMean)
        assert.equal(expectedDeviations.reduce((sum, value) => sum + value, 0), 0)
        assert.deepEqual(exercise.answers, expectedDeviations.map(String))
        assert.deepEqual(exercise.fields.map(({ unit }) => unit), ['mm', 'mm', 'mm'])
        assert.deepEqual(exercise.steps,
          values.map((value, position) => `${position + 1}本目：${value} mm − ${promptMean} mm = ${signed(expectedDeviations[position])} mm`))
      } else if (id === 'variance') {
        const sampleVariance = sumOfSquares / divisor
        assert.ok(Number.isInteger(sampleVariance))
        assert.deepEqual(exercise.answers, [String(sumOfSquares), String(sampleVariance)])
        assert.deepEqual(exercise.fields.map(({ unit }) => unit), ['mm²', 'mm²'])
        assert.deepEqual(exercise.steps, expectedVarianceSteps(values, mean, deviations, sumOfSquares, divisor))
      } else {
        const variance = sumOfSquares / divisor
        const standardDeviation = Math.sqrt(variance)
        assert.equal(standardDeviation, Number(exercise.answers[0]))
        assert.deepEqual(exercise.fields.map(({ unit }) => unit), ['mm'])
        assert.deepEqual(exercise.steps, [
          ...expectedVarianceSteps(values, mean, deviations, sumOfSquares, divisor),
          `s = √(${variance} mm²) = ${standardDeviation} mm`,
        ])
      }
    }
  }
})

test('regeneration returns a different numeric variant and validates its seed', () => {
  for (const [id, { count }] of Object.entries(previewExerciseDefinitions)) {
    for (const index of [0, Math.floor(count / 2), count - 1]) {
      for (const random of [0, 0.5, 0.999999]) {
        const next = nextPreviewExerciseIndex(id, index, () => random)
        assert.ok(next >= 0 && next < count)
        assert.notEqual(next, index)
      }
    }
    assert.equal(nextPreviewExerciseIndex(id, 0, () => 0), 1)
    assert.equal(nextPreviewExerciseIndex(id, count - 1, () => 0), 0)
    assert.equal(nextPreviewExerciseIndex(id, 0, () => 0.999999), count - 1)
  }

  const sameMeanValues = [measurements(2), measurements(7)].map((values) => values.sort((a, b) => a - b))
  assert.deepEqual(sameMeanValues[0], sameMeanValues[1])
  const next = nextPreviewExerciseIndex('mean', 2, () => 4.5 / (previewExerciseDefinitions.mean.count - 1))
  assert.notDeepEqual(measurements(next).sort((a, b) => a - b), sameMeanValues[0])

  assert.throws(() => generateDescriptiveStatisticsPreviewExercise('unknown', 0), RangeError)
  assert.throws(() => generateDescriptiveStatisticsPreviewExercise('mean', -1), RangeError)
  assert.throws(() => generateDescriptiveStatisticsPreviewExercise('mean', previewExerciseDefinitions.mean.count), RangeError)
  assert.throws(() => generateDescriptiveStatisticsPreviewExercise('mean', 0.5), RangeError)
  assert.throws(() => nextPreviewExerciseIndex('mean', 0, () => -0.1), RangeError)
  assert.throws(() => nextPreviewExerciseIndex('mean', 0, () => 1), RangeError)
  assert.throws(() => nextPreviewExerciseIndex('mean', 0, () => Number.NaN), RangeError)
  assert.throws(() => nextPreviewExerciseIndex('mean', 0, null), TypeError)
})
