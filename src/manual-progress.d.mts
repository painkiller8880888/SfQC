export type ManualLessonProgress = { completedAt: string | null }

export type ManualProgressState = Record<string, ManualLessonProgress>

export type ManualProgressCommand = { type: 'complete' | 'reopen' }

export function getManualProgressLabel(
  lesson: { availability: string },
  progress: ManualLessonProgress | undefined,
  confirmed: boolean,
): string | null
