import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generateDescriptiveStatisticsPreviewExercise,
  nextPreviewExerciseIndex,
  previewExerciseDefinitions,
} from '../src/descriptive-statistics-preview-exercises.mjs'

test('preview exercises use the planned fixed examples and correct calculations', () => {
  const examples = {
    mean: {
      prompt: '別ロットの製品を3個測定したところ、寸法は9.8 mm、10.1 mm、10.4 mmでした。3個の算術平均を求め、単位も答えてください。',
      answer: '算術平均は10.100 mmです。',
      contains: '30.3 / 3 = 10.100 mm',
    },
    deviation: {
      prompt: '製品寸法の平均は20.0 mmでした。測定値は19.4 mm、20.0 mm、20.6 mmです。それぞれの偏差（測定値 − 平均）を求めてください。',
      answer: '偏差は−0.6 mm、0.0 mm、+0.6 mmです。',
      contains: '19.4 − 20.0 = −0.6 mm',
    },
    variance: {
      prompt: 'ある工程の製品寸法は同じ分布に従い、その分散は有限だとします。工程から製品を5個、互いに独立に無作為抽出しました。工程全体の分散を不偏に推定するには、偏差平方和を何で割りますか。標本数を n とした式と、この分母を使う理由を考えてください。',
      answer: 'n − 1 で割ります。この標本では n − 1 = 4 です。',
      contains: '同じ条件の標本を繰り返したとき平均として母分散を推定',
    },
    'standard-deviation': {
      prompt: 'ある測定データの分散は0.81 mm²でした。標準偏差を求め、単位も答えてください。',
      answer: '標準偏差は0.9 mmです。',
      contains: '√(0.81 mm²) = 0.9 mm',
    },
  }

  for (const [id, expected] of Object.entries(examples)) {
    const index = previewExerciseDefinitions[id].initialIndex
    const actual = generateDescriptiveStatisticsPreviewExercise(id, index)
    assert.equal(actual.prompt, expected.prompt)
    assert.equal(actual.answer, expected.answer)
    assert.ok(actual.solution.includes(expected.contains))
    assert.deepEqual(actual, generateDescriptiveStatisticsPreviewExercise(id, index))
  }
})

test('all finite seed candidates are distinct and stay within their specified values', () => {
  for (const [id, { count }] of Object.entries(previewExerciseDefinitions)) {
    const prompts = new Set()
    for (let index = 0; index < count; index += 1) {
      const exercise = generateDescriptiveStatisticsPreviewExercise(id, index)
      assert.ok(exercise.prompt.length)
      assert.ok(exercise.answer.length)
      assert.ok(exercise.solution.length)
      assert.ok(!prompts.has(exercise.prompt), `${id} repeats a displayed problem at index ${index}`)
      prompts.add(exercise.prompt)
    }
    assert.equal(prompts.size, count)
  }
})

test('preview exercise boundaries cover rounding, ranges, and seed validation', () => {
  assert.equal(generateDescriptiveStatisticsPreviewExercise('mean', 0).answer, '算術平均は9.500 mmです。')
  assert.equal(generateDescriptiveStatisticsPreviewExercise('mean', 1).answer, '算術平均は9.533 mmです。')
  assert.equal(generateDescriptiveStatisticsPreviewExercise('mean', 1330).answer, '算術平均は10.500 mmです。')
  assert.equal(generateDescriptiveStatisticsPreviewExercise('deviation', 0).answer, '偏差は−0.1 mm、0.0 mm、+0.1 mmです。')
  assert.equal(generateDescriptiveStatisticsPreviewExercise('deviation', 188).answer, '偏差は−0.9 mm、0.0 mm、+0.9 mmです。')
  assert.equal(generateDescriptiveStatisticsPreviewExercise('variance', 0).answer, 'n − 1 で割ります。この標本では n − 1 = 3 です。')
  assert.equal(generateDescriptiveStatisticsPreviewExercise('variance', 5).answer, 'n − 1 で割ります。この標本では n − 1 = 8 です。')
  assert.equal(generateDescriptiveStatisticsPreviewExercise('standard-deviation', 0).answer, '標準偏差は0.1 mmです。')
  assert.equal(generateDescriptiveStatisticsPreviewExercise('standard-deviation', 14).answer, '標準偏差は1.5 mmです。')
  assert.match(generateDescriptiveStatisticsPreviewExercise('standard-deviation', 14).prompt, /2\.25 mm²/u)

  assert.throws(() => generateDescriptiveStatisticsPreviewExercise('unknown', 0), RangeError)
  assert.throws(() => generateDescriptiveStatisticsPreviewExercise('mean', -1), RangeError)
  assert.throws(() => generateDescriptiveStatisticsPreviewExercise('mean', 1331), RangeError)
  assert.throws(() => generateDescriptiveStatisticsPreviewExercise('mean', 0.5), RangeError)
})

test('regeneration always selects another finite seed, including at both ends', () => {
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

  assert.throws(() => nextPreviewExerciseIndex('mean', 0, () => -0.1), RangeError)
  assert.throws(() => nextPreviewExerciseIndex('mean', 0, () => 1), RangeError)
  assert.throws(() => nextPreviewExerciseIndex('mean', 0, () => Number.NaN), RangeError)
  assert.throws(() => nextPreviewExerciseIndex('mean', 0, null), TypeError)
})
