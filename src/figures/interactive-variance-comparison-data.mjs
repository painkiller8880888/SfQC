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
