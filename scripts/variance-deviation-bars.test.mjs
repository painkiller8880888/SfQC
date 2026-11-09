import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeMeasurements } from '../src/figures/interactive-variance-comparison-data.mjs'
import {
  chart,
  mean,
  meanFractionLabel,
  observations,
  sumOfSquaredDeviations,
  sumOfSquaredDeviationsLabel,
} from '../src/figures/variance-deviation-bars-data.mjs'

const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} should be close to ${expected}`)

test('variance figure data and its SVG coordinates match the fixed example', () => {
  assert.deepEqual(observations.map(({ number, value }) => ({ number, value })), [
    { number: 1, value: 1 },
    { number: 2, value: 2.2 },
    { number: 3, value: 3 },
  ])
  closeTo(mean, 31 / 15)
  assert.equal(meanFractionLabel, '31/15')
  assert.equal(observations[1].value.toFixed(3), '2.200')
  assert.equal(observations[1].value, 2.2)
  observations.forEach((observation, index) => {
    closeTo(observation.deviation, [-16 / 15, 2 / 15, 14 / 15][index])
    closeTo(observation.squaredDeviation, [256 / 225, 4 / 225, 196 / 225][index])
    assert.equal(observation.deviationLabel, ['−16/15', '+2/15', '+14/15'][index])
    assert.equal(observation.squaredDeviationLabel, ['256/225', '4/225', '196/225'][index])
  })
  closeTo(observations.reduce((sum, observation) => sum + observation.deviation, 0), 0)
  closeTo(sumOfSquaredDeviations, 456 / 225)
  closeTo(sumOfSquaredDeviations, 152 / 75)
  assert.equal(sumOfSquaredDeviationsLabel, '456/225 = 152/75')

  assert.deepEqual(chart.ticks.map(({ value }) => value), [1, 1.5, 2, 2.5, 3])
  chart.ticks.forEach((tick, index) => closeTo(tick.y, [156, 123, 90, 57, 24][index]))
  assert.deepEqual(chart.points.map(({ x }) => x), [88, 200, 312])
  chart.points.forEach((point, index) => closeTo(point.y, [156, 76.8, 24][index]))
  closeTo(chart.meanLine.x1, 48)
  closeTo(chart.meanLine.y1, 85.6)
  closeTo(chart.meanLine.x2, 336)
  closeTo(chart.meanLine.y2, 85.6)
  const expectedDeviationLines = [
    [88, 85.6, 88, 156],
    [200, 85.6, 200, 76.8],
    [312, 85.6, 312, 24],
  ]
  chart.deviationLines.forEach((line, index) => {
    assert.equal(line.observation, index + 1)
    const coordinates = ['x1', 'y1', 'x2', 'y2']
    coordinates.forEach((key, coordinateIndex) => closeTo(line[key], expectedDeviationLines[index][coordinateIndex]))
  })
})

test('interactive variance comparison statistics match the three guided states and edge cases', () => {
  const initialA = summarizeMeasurements([1, 2.2, 3])
  const initialB = summarizeMeasurements([1.8, 2, 2.4])
  const shiftedB = summarizeMeasurements([1.9, 2.1, 2.5])
  const widenedB = summarizeMeasurements([1.6, 2, 2.6])
  const allEqual = summarizeMeasurements([2, 2, 2])
  const bounds = summarizeMeasurements([1, 3, 2])

  closeTo(initialA.mean, 31 / 15)
  initialA.deviations.forEach((deviation, index) => closeTo(deviation, [-16 / 15, 2 / 15, 14 / 15][index]))
  closeTo(initialA.sumOfSquaredDeviations, 152 / 75)
  closeTo(initialA.variance, 152 / 225)
  closeTo(initialA.standardDeviation, Math.sqrt(152) / 15)

  closeTo(initialB.mean, 31 / 15)
  initialB.deviations.forEach((deviation, index) => closeTo(deviation, [-4 / 15, -1 / 15, 5 / 15][index]))
  closeTo(initialB.sumOfSquaredDeviations, 14 / 75)
  closeTo(initialB.variance, 14 / 225)
  closeTo(initialB.standardDeviation, Math.sqrt(14) / 15)

  closeTo(shiftedB.mean, 13 / 6)
  shiftedB.deviations.forEach((deviation, index) => closeTo(deviation, initialB.deviations[index]))
  closeTo(shiftedB.variance, initialB.variance)
  closeTo(shiftedB.standardDeviation, initialB.standardDeviation)

  closeTo(widenedB.mean, 31 / 15)
  widenedB.deviations.forEach((deviation, index) => closeTo(deviation, [-7 / 15, -1 / 15, 8 / 15][index]))
  closeTo(widenedB.sumOfSquaredDeviations, 38 / 75)
  closeTo(widenedB.variance, 38 / 225)
  closeTo(widenedB.standardDeviation, Math.sqrt(38) / 15)

  allEqual.deviations.forEach((deviation) => closeTo(deviation, 0))
  closeTo(allEqual.mean, 2)
  closeTo(allEqual.sumOfSquaredDeviations, 0)
  closeTo(allEqual.variance, 0)
  closeTo(allEqual.standardDeviation, 0)
  closeTo(bounds.mean, 2)
  closeTo(bounds.variance, 2 / 3)
})
