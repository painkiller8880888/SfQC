export const measurementRange = { minimum: 96, maximum: 104 }
export const standardDeviationPlotRange = { minimum: 94, maximum: 106 }

export function summarizeMeasurements(values) {
  const mean = (values[0] + values[1] + values[2]) / 3
  const deviations = values.map((value) => value - mean)
  const sumOfSquaredDeviations = deviations.reduce((sum, deviation) => sum + deviation ** 2, 0)
  const variance = sumOfSquaredDeviations / 3

  return {
    mean,
    deviations,
    sumOfSquaredDeviations,
    variance,
    standardDeviation: Math.sqrt(variance),
  }
}

export const varianceSimulation = (() => {
  const population = [98, 99, 100, 101, 102]
  const mean = population.reduce((sum, value) => sum + value, 0) / population.length
  const trueVariance = population.reduce((sum, value) => sum + (value - mean) ** 2, 0) / population.length
  let sumByN = 0
  let sumByNMinusOne = 0
  let maxByNMinusOne = 0
  let count = 0
  for (const first of population) for (const second of population) for (const third of population) {
    const statistics = summarizeMeasurements([first, second, third])
    const byNMinusOne = statistics.sumOfSquaredDeviations / 2
    sumByN += statistics.variance
    sumByNMinusOne += byNMinusOne
    maxByNMinusOne = Math.max(maxByNMinusOne, byNMinusOne)
    count += 1
  }
  return {
    population,
    trueVariance,
    count,
    byN: sumByN / count,
    byNMinusOne: sumByNMinusOne / count,
    scale: Math.ceil(maxByNMinusOne),
  }
})()
