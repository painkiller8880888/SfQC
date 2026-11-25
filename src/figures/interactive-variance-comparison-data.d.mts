export type MeasurementValues = readonly [number, number, number]

export type MeasurementSummary = {
  mean: number
  deviations: readonly [number, number, number]
  sumOfSquaredDeviations: number
  variance: number
  standardDeviation: number
}

export declare const measurementRange: Readonly<{ minimum: number; maximum: number }>
export declare const standardDeviationPlotRange: typeof measurementRange

export declare function summarizeMeasurements(values: MeasurementValues): MeasurementSummary

export declare const varianceSimulation: Readonly<{
  population: readonly number[]
  trueVariance: number
  count: number
  byN: number
  byNMinusOne: number
  scale: number
}>
