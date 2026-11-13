import type { LessonRegistry } from './lesson-contract.mjs'
import type { LocalData, LocalDataCounts } from './local-data.mjs'
import type { MapState } from './map-state.mjs'
import type { LearningState, LearningStateReadResult, LearningStateStorage } from './learning-state.mjs'
import type { PracticeResults, PracticeResultsReadResult, PracticeResultsStorage } from './practice-results.mjs'

export const RECOVERY_FORMAT: 'sfqc-recovery-raw'
export const BACKUP_ENVELOPE_MAX_BYTES: 1_024
export const BACKUP_MAX_BYTES: number
export type BackupStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
export function serializeBackup(localData: unknown, mapState: unknown): string
export function parseBackup(text: string, registry?: LessonRegistry):
  | { kind: 'legacy'; data: LocalData }
  | { kind: 'backup'; data: LocalData; mapState: MapState; changedLessonIds: string[] }
export function exportBackup(getStorage?: () => BackupStorage, registry?: LessonRegistry): string
export function serializeRecoveryRaw(localRaw: string | null, mapRaw: string | null): string

export type BackupImportConfirmation =
  | { kind: 'legacy'; damaged: boolean; existingCounts?: LocalDataCounts; importCounts: LocalDataCounts }
  | {
    kind: 'backup'
    existing: {
      localData: { status: string; counts: LocalDataCounts }
      mapState: { status: string; completedLessons: number }
    }
    imported: { localData: LocalDataCounts; mapState: { completedLessons: number } }
  }

export type BackupImportResult =
  | { status: 'cancelled'; kind: 'legacy' | 'backup'; phase?: 'recovery' }
  | { status: 'imported'; kind: 'legacy'; data: LocalData; raw: string }
  | {
    status: 'imported'; kind: 'backup'; data: LocalData; raw: string
    mapState: MapState; mapRaw: string; changedLessonIds: string[]
  }

export function importBackup(
  file: { size: number; text(): Promise<string> },
  confirmReplacement: (state: BackupImportConfirmation) => boolean | Promise<boolean>,
  options?: {
    getStorage?: () => BackupStorage
    registry?: LessonRegistry
    requestRecoveryDownload?: (json: string) => boolean | Promise<boolean>
    confirmRecovery?: () => boolean | Promise<boolean>
  },
  ): Promise<BackupImportResult>
export function exportLegacyLocalData(getStorage?: () => BackupStorage): string

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
