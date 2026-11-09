export const previewExerciseDefinitions = Object.freeze({
  mean: Object.freeze({ initialIndex: 438, count: 1331 }),
  deviation: Object.freeze({ initialIndex: 95, count: 189 }),
  variance: Object.freeze({ initialIndex: 1, count: 6 }),
  'standard-deviation': Object.freeze({ initialIndex: 8, count: 15 }),
})

const formatTenths = (value) => `${Math.floor(value / 10)}.${value % 10}`

function getMeanValues(index) {
  return [
    95 + Math.floor(index / 121),
    95 + Math.floor(index / 11) % 11,
    95 + index % 11,
  ]
}

function getMeanMultiset(index) {
  return getMeanValues(index).sort((left, right) => left - right).join(',')
}

function getDefinition(id, index) {
  const definition = previewExerciseDefinitions[id]
  if (!definition) throw new RangeError(`Unknown preview exercise: ${id}`)
  if (!Number.isInteger(index) || index < 0 || index >= definition.count) {
    throw new RangeError(`Preview exercise index must be an integer from 0 to ${definition.count - 1}`)
  }
  return definition
}

export function generateDescriptiveStatisticsPreviewExercise(id, index) {
  getDefinition(id, index)

  if (id === 'mean') {
    const values = getMeanValues(index)
    const sum = values.reduce((total, value) => total + value, 0)
    const meanThousandths = Math.round(sum * 100 / 3)
    const mean = `${Math.floor(meanThousandths / 1000)}.${String(meanThousandths % 1000).padStart(3, '0')}`
    const exact = sum % 3 === 0
    const measurements = values.map(formatTenths)
    const sumText = formatTenths(sum)
    return {
      prompt: `別ロットの製品を3個測定したところ、寸法は${measurements.join(' mm、')} mmでした。3個の算術平均を求め、単位も答えてください。`,
      answer: `算術平均は${exact ? '' : '約'}${mean} mmです。`,
      solution: `${measurements.join(' + ')} = ${sumText} mm、${sumText} / 3 ${exact ? '=' : '≈'} ${mean} mmです。合計を測定数で割ると、そのロットの中心を表す平均が求められます。`,
    }
  }

  if (id === 'deviation') {
    const mean = 190 + Math.floor(index / 9)
    const distance = index % 9 + 1
    const values = [mean - distance, mean, mean + distance]
    const deviations = [-distance, 0, distance]
    const formatDeviation = (value) => `${value < 0 ? '−' : value > 0 ? '+' : ''}${formatTenths(Math.abs(value))} mm`
    const measurements = values.map(formatTenths)
    const calculations = values.map((value, position) => `${formatTenths(value)} − ${formatTenths(mean)} = ${formatDeviation(deviations[position])}`)
    return {
      prompt: `製品寸法の平均は${formatTenths(mean)} mmでした。測定値は${measurements.join(' mm、')} mmです。それぞれの偏差（測定値 − 平均）を求めてください。`,
      answer: `偏差は${deviations.map(formatDeviation).join('、')}です。`,
      solution: `${calculations.join('；')}です。測定値から平均を引き、負号は平均より小さいこと、正号は大きいことを表します。`,
    }
  }

  if (id === 'variance') {
    const sampleSize = index + 4
    return {
      prompt: `ある工程の製品寸法は同じ分布に従い、その分散は有限だとします。工程から製品を${sampleSize}個、互いに独立に無作為抽出しました。工程全体の分散を不偏に推定するには、偏差平方和を何で割りますか。標本数を n とした式と、この分母を使う理由を考えてください。`,
      answer: `n − 1 で割ります。この標本では n − 1 = ${sampleSize - 1} です。`,
      solution: '標本平均を使うと、偏差平方和を n で割る方法は母分散を平均的に小さく見積もります。n − 1 で割る不偏分散は、その偏りを補正し、同じ条件の標本を繰り返したとき平均として母分散を推定します。',
    }
  }

  const root = index + 1
  const varianceHundredths = root * root
  const variance = `${Math.floor(varianceHundredths / 100)}.${String(varianceHundredths % 100).padStart(2, '0')}`
  const standardDeviation = formatTenths(root)
  return {
    prompt: `ある測定データの分散は${variance} mm²でした。標準偏差を求め、単位も答えてください。`,
    answer: `標準偏差は${standardDeviation} mmです。`,
    solution: `標準偏差は分散の平方根です。√(${variance} mm²) = ${standardDeviation} mmとなり、単位は元の測定値と同じmmに戻ります。`,
  }
}

export function nextPreviewExerciseIndex(id, index, random = Math.random) {
  const { count } = getDefinition(id, index)
  if (typeof random !== 'function') throw new TypeError('random must be a function')
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('random must return a number from 0 inclusive to 1 exclusive')
  }
  const firstOffset = Math.floor(value * (count - 1)) + 1
  const currentMean = id === 'mean' ? getMeanMultiset(index) : null
  for (let skipped = 0; skipped < count - 1; skipped += 1) {
    const offset = (firstOffset - 1 + skipped) % (count - 1) + 1
    const nextIndex = (index + offset) % count
    if (id !== 'mean' || getMeanMultiset(nextIndex) !== currentMean) return nextIndex
  }
  throw new RangeError('Preview exercise has no different numeric variant')
}
