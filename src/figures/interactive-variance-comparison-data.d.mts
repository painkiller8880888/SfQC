export type MeasurementValues = readonly [number, number, number]

export type MeasurementSummary = {
  mean: number
  deviations: readonly [number, number, number]
  sumOfSquaredDeviations: number
  variance: number
  standardDeviation: number
}

export declare function summarizeMeasurements(values: MeasurementValues): MeasurementSummary
