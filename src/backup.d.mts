import type { LessonRegistry } from './lesson-contract.mjs'
import type { LocalData, LocalDataCounts } from './local-data.mjs'
import type { MapState } from './map-state.mjs'

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
