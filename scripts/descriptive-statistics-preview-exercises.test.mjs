import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generateDescriptiveStatisticsPreviewExercise,
  nextPreviewExerciseIndex,
  previewExerciseDefinitions,
} from '../src/descriptive-statistics-preview-exercises.mjs'

const measurements = (index) => {
  const prompt = generateDescriptiveStatisticsPreviewExercise('mean', index).prompt
  return prompt.match(/ところ、(.+?) でした/u)[1]
    .split(' mm、')
    .map((value) => Number(value.replace(/ mm$/u, '')))
}

test('preview exercises reproduce the four reviewed seed questions and calculations', () => {
  const expected = {
    mean: {
      prompt: '別のライン C から3本を測ったところ、98 mm、103 mm、102 mm でした。平均は何 mm ですか。',
      fields: [{ label: '平均', unit: 'mm' }],
      answers: [101],
      solution: '98 + 103 + 102 = 303、303 ÷ 3 = 101 mm',
    },
    deviation: {
      prompt: '別のライン D の平均は 102 mm でした。測った3本は 100 mm、106 mm、100 mm です。それぞれの偏差（値 − 平均）を求めてください。',
      fields: [{ label: '1本目', unit: 'mm' }, { label: '2本目', unit: 'mm' }, { label: '3本目', unit: 'mm' }],
      answers: [-2, 4, -2],
      solution: '100 − 102 = −2　106 − 102 = +4　100 − 102 = −2　(mm)',
    },
    variance: {
      prompt: '別のライン E から3本を測ったところ、97 mm、101 mm、102 mm でした。偏差平方和 S と、n − 1 で割る不偏分散 V を求めてください。',
      fields: [{ label: 'S', unit: 'mm²' }, { label: 'V', unit: 'mm²' }],
      answers: [14, 7],
      solution: '平均 = 300 ÷ 3 = 100 mm。偏差は −3、+1、+2。S = (−3)² + (+1)² + (+2)² = 9 + 1 + 4 = 14 mm²。V = 14 ÷ 2 = 7 mm²',
    },
    'standard-deviation': {
      prompt: '別のライン F から3本を測ったところ、97 mm、100 mm、103 mm でした。n − 1 で割った不偏分散から求める標準偏差 s は何 mm ですか。',
      fields: [{ label: 's', unit: 'mm' }],
      answers: [3],
      solution: '平均 = 100 mm、偏差は −3、0、+3。S = 18 mm²、V = 18 ÷ 2 = 9 mm²、s = √9 = 3 mm',
    },
  }

  for (const [id, expectedExercise] of Object.entries(expected)) {
    const exercise = generateDescriptiveStatisticsPreviewExercise(id, previewExerciseDefinitions[id].initialIndex)
    assert.deepEqual(exercise, expectedExercise)
    assert.ok(!exercise.prompt.includes(exercise.solution), `${id} should keep its explanation out of the question`)
  }
})

test('every generated question is a distinct valid numeric exercise', () => {
  for (const [id, { count }] of Object.entries(previewExerciseDefinitions)) {
    const prompts = new Set()
    for (let index = 0; index < count; index += 1) {
      const exercise = generateDescriptiveStatisticsPreviewExercise(id, index)
      assert.ok(exercise.prompt.length)
      assert.ok(exercise.solution.length)
      assert.equal(exercise.fields.length, exercise.answers.length)
      assert.ok(exercise.answers.every(Number.isFinite))
      assert.ok(!prompts.has(exercise.prompt), `${id} repeats a displayed problem at index ${index}`)
      prompts.add(exercise.prompt)
    }
    assert.equal(prompts.size, count)
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
