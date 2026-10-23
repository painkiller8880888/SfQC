const values = [1, 2.2, 3]
const deviationLabels = ['−16/15', '+2/15', '+14/15']
const squaredDeviationLabels = ['256/225', '4/225', '196/225']

export const mean = values.reduce((sum, value) => sum + value, 0) / values.length
export const meanFractionLabel = '31/15'
export const observations = values.map((value, index) => {
  const deviation = value - mean

  return {
    number: index + 1,
    value,
    deviation,
    squaredDeviation: deviation ** 2,
    deviationLabel: deviationLabels[index],
    squaredDeviationLabel: squaredDeviationLabels[index],
  }
})
export const sumOfSquaredDeviations = observations.reduce((sum, observation) => sum + observation.squaredDeviation, 0)
export const sumOfSquaredDeviationsLabel = '456/225 = 152/75'

const plot = { left: 48, right: 336, top: 24, bottom: 156 }
const observationXs = [88, 200, 312]
const yFor = (value) => plot.bottom - ((value - 1) / 2) * (plot.bottom - plot.top)
const meanY = yFor(mean)

export const chart = {
  width: 360,
  height: 180,
  ticks: [1, 1.5, 2, 2.5, 3].map((value) => ({ value, y: yFor(value), label: value.toFixed(1) })),
  points: observations.map((observation, index) => ({ ...observation, x: observationXs[index], y: yFor(observation.value) })),
  meanLine: { x1: plot.left, y1: meanY, x2: plot.right, y2: meanY },
  deviationLines: observations.map((observation, index) => ({
    observation: observation.number,
    x1: observationXs[index],
    y1: meanY,
    x2: observationXs[index],
    y2: yFor(observation.value),
  })),
}
