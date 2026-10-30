import type { LessonRegistry } from './lesson-contract.mjs'

export type ManualProgressStatus = 'not-started' | 'started' | 'completed'

export type ManualLessonProgress = {
  status: ManualProgressStatus
  checks: boolean[]
  completedAt: string | null
}

export type ManualProgressState = Record<string, ManualLessonProgress>

export type ManualProgressCommand =
  | { type: 'start' }
  | { type: 'check'; index: number; checked: boolean }
  | { type: 'complete' }
  | { type: 'reopen' }

export type ManualProgressAction = Exclude<ManualProgressCommand, { type: 'complete' }> | {
  type: 'complete'
  completedAt: string
}

export function createInitialManualProgress(registry: LessonRegistry): ManualProgressState
export function updateManualProgress(
  current: ManualProgressState,
  lessonId: string,
  action: ManualProgressAction,
): ManualProgressState
export function countCompletedManualProgress(progress: ManualProgressState, registry: LessonRegistry): number
