export const previewExerciseDefinitions = Object.freeze({
  mean: Object.freeze({ initialIndex: 161, count: 275 }),
  deviation: Object.freeze({ initialIndex: 183, count: 275 }),
  variance: Object.freeze({ initialIndex: 135, count: 275 }),
  'standard-deviation': Object.freeze({ initialIndex: 32, count: 66 }),
})

function getParameters(id, index) {
  const definition = previewExerciseDefinitions[id]
  if (!definition) throw new RangeError(`Unknown preview exercise: ${id}`)
  if (!Number.isInteger(index) || index < 0 || index >= definition.count) {
    throw new RangeError(`Preview exercise index must be an integer from 0 to ${definition.count - 1}`)
  }
  // At a mean of 100 mm, symmetric spreads of 1 and 2 mm reproduce the worked examples.
  if (id === 'standard-deviation') {
    const m = 95 + Math.floor(index / 6)
    const d = index % 6 + 1
    return { m: m === 100 && d <= 2 ? 106 : m, d }
  }
  const m = 95 + Math.floor(index / 25)
  const a = Math.floor(index / 5) % 5 + 1
  const b = index % 5 + 1
  return { m: m === 100 && a === b && a <= 2 ? 106 : m, a, b }
}

function makeMeasurements({ m, a, b }) {
  const deviations = [-a, b, a - b]
  return { deviations, values: deviations.map((deviation) => m + deviation) }
}

function formatDeviation(value) {
  return `${value < 0 ? '−' : value > 0 ? '+' : ''}${Math.abs(value)}`
}

function joinMm(values) {
  return `${values.join(' mm、')} mm`
}

function decimalAnswer(value) {
  if (!Number.isSafeInteger(value)) throw new RangeError('preview exercise answer must be a safe integer')
  return String(value)
}

function varianceSteps({ values, mean, deviations, sumOfSquares, variance }) {
  return [
    `平均 = (${values.join(' + ')}) mm ÷ 3 = ${mean} mm`,
    `偏差は ${joinMm(deviations.map(formatDeviation))}`,
    `S = ${deviations.map((deviation) => `(${formatDeviation(deviation)} mm)²`).join(' + ')} = ${sumOfSquares} mm²`,
    `V = ${sumOfSquares} mm² ÷ (3 − 1) = ${variance} mm²`,
  ]
}

export function generateDescriptiveStatisticsPreviewExercise(id, index) {
  const parameters = getParameters(id, index)

  if (id === 'mean') {
    const { values } = makeMeasurements(parameters)
    const total = values.reduce((sum, value) => sum + value, 0)
    return {
      prompt: `別のライン C から3本を測ったところ、${joinMm(values)} でした。平均は何 mm ですか。`,
      fields: [{ label: '平均', unit: 'mm' }],
      answers: [decimalAnswer(parameters.m)],
      steps: [`(${values.join(' + ')}) mm = ${total} mm`, `${total} mm ÷ 3 = ${parameters.m} mm`],
      solution: '測定値の合計を測定した本数で割ると、平均が求まります。',
    }
  }

  if (id === 'deviation') {
    const { deviations, values } = makeMeasurements(parameters)
    return {
      prompt: `別のライン D の平均は ${parameters.m} mm でした。測った3本は ${joinMm(values)} です。それぞれの偏差（値 − 平均）を求めてください。`,
      fields: [1, 2, 3].map((number) => ({ label: `${number}本目`, unit: 'mm' })),
      answers: deviations.map(decimalAnswer),
      steps: values.map((value, index) => `${index + 1}本目：${value} mm − ${parameters.m} mm = ${formatDeviation(deviations[index])} mm`),
      solution: '偏差は、測定値が平均からどちらへどれだけ離れているかを表します。偏差が 0 mm のとき、測定値は平均と同じです。',
    }
  }

  if (id === 'variance') {
    const { deviations, values } = makeMeasurements(parameters)
    const sumOfSquares = deviations.reduce((sum, deviation) => sum + deviation ** 2, 0)
    const variance = sumOfSquares / 2
    return {
      prompt: `別のライン E から3本を測ったところ、${joinMm(values)} でした。偏差平方和 S と、n − 1 で割る不偏分散 V を求めてください。`,
      fields: [{ label: 'S', unit: 'mm²' }, { label: 'V', unit: 'mm²' }],
      answers: [sumOfSquares, variance].map(decimalAnswer),
      steps: varianceSteps({ values, mean: parameters.m, deviations, sumOfSquares, variance }),
      solution: '偏差平方和 S は、平均からのずれを二乗して足した値です。S を n − 1 で割ると不偏分散 V が求まります。',
    }
  }

  const { m, d } = parameters
  const values = [m - d, m, m + d]
  const sumOfSquares = 2 * d ** 2
  const variance = d ** 2
  return {
    prompt: `別のライン F から3本を測ったところ、${joinMm(values)} でした。n − 1 で割った不偏分散から求める標準偏差 s は何 mm ですか。`,
    fields: [{ label: 's', unit: 'mm' }],
    answers: [decimalAnswer(d)],
    steps: [
      ...varianceSteps({ values, mean: m, deviations: [-d, 0, d], sumOfSquares, variance }),
      `s = √(${variance} mm²) = ${d} mm`,
    ],
    solution: '不偏分散の平方根を取ると標準偏差が求まります。単位が測定値と同じ mm に戻るので、平均の周りの散らばりを長さとして読めます。',
  }
}

export function nextPreviewExerciseIndex(id, index, random = Math.random) {
  const { count } = previewExerciseDefinitions[id] ?? {}
  getParameters(id, index)
  if (typeof random !== 'function') throw new TypeError('random must be a function')
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('random must return a number from 0 inclusive to 1 exclusive')
  }
  const firstOffset = Math.floor(value * (count - 1)) + 1
  const currentMeasurements = id === 'mean' ? makeMeasurements(getParameters(id, index)).values.slice().sort((a, b) => a - b) : null
  for (let skipped = 0; skipped < count - 1; skipped += 1) {
    const offset = (firstOffset - 1 + skipped) % (count - 1) + 1
    const nextIndex = (index + offset) % count
    if (id !== 'mean') return nextIndex
    const nextMeasurements = makeMeasurements(getParameters(id, nextIndex)).values.slice().sort((a, b) => a - b)
    if (nextMeasurements.some((measurement, position) => measurement !== currentMeasurements[position])) return nextIndex
  }
  throw new RangeError('Preview exercise has no different numeric variant')
}
