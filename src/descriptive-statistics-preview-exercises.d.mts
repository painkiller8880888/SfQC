export type PreviewExerciseId = 'mean' | 'deviation' | 'variance' | 'standard-deviation'

export type PreviewExerciseDefinition = Readonly<{ initialIndex: number; count: number }>

export type DescriptiveStatisticsPreviewExercise = Readonly<{
  prompt: string
  fields: readonly Readonly<{ label: string; unit: string }>[]
  answers: readonly string[]
  solution: string
}>

export const previewExerciseDefinitions: Readonly<Record<PreviewExerciseId, PreviewExerciseDefinition>>

export function generateDescriptiveStatisticsPreviewExercise(
  id: PreviewExerciseId,
  index: number,
): DescriptiveStatisticsPreviewExercise

export function nextPreviewExerciseIndex(
  id: PreviewExerciseId,
  index: number,
  random?: () => number,
): number
