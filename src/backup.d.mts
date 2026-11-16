import type { LessonRegistry } from './lesson-contract.mjs'
import type { LearningState, LearningStateReadResult, LearningStateStorage } from './learning-state.mjs'
import type { PracticeResults, PracticeResultsReadResult, PracticeResultsStorage } from './practice-results.mjs'

export const LEARNING_BACKUP_FORMAT: 'sfqc-learning-backup'
export const LEARNING_RECOVERY_FORMAT: 'sfqc-learning-recovery-raw'
export const LEARNING_BACKUP_MAX_BYTES: 74_752
export const LEARNING_BACKUP_ENVELOPE_MAX_BYTES: 1_024
export class LearningBackupError extends Error { code: string }
export type LearningBackupStorage = LearningStateStorage & PracticeResultsStorage & {
  removeItem(key: string): void
}
export type LearningBackup = { learningState: LearningState; practiceResults: PracticeResults }
export type LearningBackupPending = {
  beforeRaw: { learningState: string | null; practiceResults: string | null }
  candidateRaw: { learningState: string; practiceResults: string }
  attemptedKeys: Array<'learningState' | 'practiceResults'>
  cancelled: boolean
  rollbackAttempted: boolean
}
export type LearningBackupImportLatest = {
  learningState: LearningStateReadResult
  practiceResults: PracticeResultsReadResult
}
export type LearningBackupImportConfirmation = {
  existing: {
    learningState: { status: string; completedLessons: number }
    practiceResults: { status: string; records: number }
  }
  imported: {
    learningState: { completedLessons: number }
    practiceResults: { records: number }
  }
}
type LearningBackupImportBase = {
  beforeRaw: LearningBackupPending['beforeRaw'] | null
  candidateRaw: LearningBackupPending['candidateRaw']
  latest: LearningBackupImportLatest
  recoveryRaw?: string
  pending?: LearningBackupPending
  rollbackAttempted?: boolean
  error?: Error
}
export type LearningBackupImportResult =
  | (LearningBackupImportBase & { status: 'imported'; learningState: LearningState; practiceResults: PracticeResults })
  | (LearningBackupImportBase & { status: 'cancelled' | 'not-applied' | 'rolled-back' | 'unknown' | 'conflict' | 'recovery-required' })
export function serializeLearningBackup(learningState: unknown, practiceResults: unknown, registry?: LessonRegistry): string
export function parseLearningBackup(text: string, registry?: LessonRegistry): LearningBackup
export function exportLearningBackup(getStorage?: () => LearningBackupStorage, registry?: LessonRegistry): string
export function serializeLearningRecoveryRaw(learningRaw: string | null, practiceRaw: string | null): string
export function recheckLearningBackupImport(
  pending: LearningBackupPending,
  registry?: LessonRegistry,
  getStorage?: () => LearningBackupStorage,
): LearningBackupImportResult
export function importLearningBackup(
  file: { size: number; text(): Promise<string> },
  confirmReplacement: (confirmation: LearningBackupImportConfirmation) => boolean | Promise<boolean>,
  options?: {
    getStorage?: () => LearningBackupStorage
    registry?: LessonRegistry
    requestRecoveryDownload?: (json: string) => boolean | Promise<boolean>
    confirmRecovery?: () => boolean | Promise<boolean>
  },
): Promise<LearningBackupImportResult>
