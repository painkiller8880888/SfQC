export type DescriptiveStatisticsExercisePreviewState = { typeIndex: number; seed: number }

type QuestionBase = {
  prompt: string
  sections: string[]
  explanation: string
  steps?: string[]
  table?: {
    caption: string
    rowHeaderLabel: string
    columnLabels: string[]
    rows: { label: string; values: number[] }[]
  }
  calculation?: string[]
}

export type DescriptiveStatisticsExercisePreviewQuestion = QuestionBase & (
  | { type: 'numeric'; unit: string; answer: string }
  | {
    type: 'choice'
    choices: string[]
    answer: number
    choiceFeedback: { choiceIndex: number; misconception: string; sections: string[] }[]
  }
)

export const descriptiveStatisticsExerciseCategories: readonly {
  id: 'mean-deviation' | 'data-transformation' | 'unbiased-variance' | 'comprehensive' | 'variance-standard-deviation'
  title: string
  typeIds: readonly string[]
}[]

export function makeRepeatedEndpointMeasurements(mean: number, radius: number): number[]

export function createDescriptiveStatisticsExercisePreviewState(
  categoryIndex: number,
  random?: () => number,
): DescriptiveStatisticsExercisePreviewState

export function nextDescriptiveStatisticsExercisePreviewState(
  categoryIndex: number,
  current: DescriptiveStatisticsExercisePreviewState,
  random?: () => number,
): DescriptiveStatisticsExercisePreviewState

export function generateDescriptiveStatisticsExercisePreviewQuestion(
  categoryIndex: number,
  typeIndex: number,
  seed: number,
): DescriptiveStatisticsExercisePreviewQuestion

export function generateDescriptiveStatisticsExercisePreviewQuestionById(
  categoryId: string,
  typeId: string,
  seed: number,
): DescriptiveStatisticsExercisePreviewQuestion
