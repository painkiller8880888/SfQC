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
  if (id === 'standard-deviation') return { m: 95 + Math.floor(index / 6), d: index % 6 + 1 }
  return {
    m: 95 + Math.floor(index / 25),
    a: Math.floor(index / 5) % 5 + 1,
    b: index % 5 + 1,
  }
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

export function generateDescriptiveStatisticsPreviewExercise(id, index) {
  const parameters = getParameters(id, index)

  if (id === 'mean') {
    const { values } = makeMeasurements(parameters)
    const total = values.reduce((sum, value) => sum + value, 0)
    return {
      prompt: `別のライン C から3本を測ったところ、${joinMm(values)} でした。平均は何 mm ですか。`,
      fields: [{ label: '平均', unit: 'mm' }],
      answers: [decimalAnswer(parameters.m)],
      solution: `${values.join(' + ')} = ${total}、${total} ÷ 3 = ${parameters.m} mm`,
    }
  }

  if (id === 'deviation') {
    const { deviations, values } = makeMeasurements(parameters)
    return {
      prompt: `別のライン D の平均は ${parameters.m} mm でした。測った3本は ${joinMm(values)} です。それぞれの偏差（値 − 平均）を求めてください。`,
      fields: [1, 2, 3].map((number) => ({ label: `${number}本目`, unit: 'mm' })),
      answers: deviations.map(decimalAnswer),
      solution: `${values.map((value, index) => `${value} − ${parameters.m} = ${formatDeviation(deviations[index])}`).join('　')}　(mm)`,
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
      solution: `平均 = ${values.reduce((sum, value) => sum + value, 0)} ÷ 3 = ${parameters.m} mm。偏差は ${deviations.map(formatDeviation).join('、')}。S = ${deviations.map((deviation) => `(${formatDeviation(deviation)})²`).join(' + ')} = ${deviations.map((deviation) => deviation ** 2).join(' + ')} = ${sumOfSquares} mm²。V = ${sumOfSquares} ÷ 2 = ${variance} mm²`,
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
    solution: `平均 = ${m} mm、偏差は −${d}、0、+${d}。S = ${sumOfSquares} mm²、V = ${sumOfSquares} ÷ 2 = ${variance} mm²、s = √${variance} = ${d} mm`,
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
