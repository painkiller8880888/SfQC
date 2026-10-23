export type VarianceObservation = {
  number: number
  value: number
  deviation: number
  squaredDeviation: number
  deviationLabel: string
  squaredDeviationLabel: string
}

export const mean: number
export const meanFractionLabel: string
export const observations: readonly VarianceObservation[]
export const sumOfSquaredDeviations: number
export const sumOfSquaredDeviationsLabel: string
export const chart: {
  width: number
  height: number
  ticks: readonly { value: number; y: number; label: string }[]
  points: readonly (VarianceObservation & { x: number; y: number })[]
  meanLine: { x1: number; y1: number; x2: number; y2: number }
  deviationLines: readonly { observation: number; x1: number; y1: number; x2: number; y2: number }[]
}
