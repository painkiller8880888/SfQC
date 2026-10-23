import assert from 'node:assert/strict'
import test from 'node:test'
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
