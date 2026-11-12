export type DescriptiveStatisticsExercisePreviewState = { typeIndex: number; seed: number }

type QuestionBase = {
  prompt: string
  sections: string[]
  explanation: string
  table?: { rows: { label: string; values: number[] }[] }
  calculation?: string[]
}

export type DescriptiveStatisticsExercisePreviewQuestion = QuestionBase & (
  | { type: 'numeric'; unit: string; answer: number }
  | { type: 'choice'; choices: string[]; answer: number }
)

export const descriptiveStatisticsExerciseCategories: readonly { title: string }[]

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
