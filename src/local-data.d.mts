import type { ReadonlyQuestionInstance } from './question-contract.mjs'

export const LOCAL_DATA_KEY: 'sfqc:local-data'
export const LOCAL_DATA_MAX_BYTES: 1_048_576
export const LOCAL_DATA_MAX_INSTANCES: 500

export type LocalDataErrorCode =
  | 'invalid-json'
  | 'invalid-schema'
  | 'unsupported-version'
  | 'too-large'
  | 'too-many-instances'
  | 'storage-unavailable'
  | 'file-read-failed'
  | 'storage-changed'
  | 'storage-write-failed'

export class LocalDataError extends Error {
  code: LocalDataErrorCode
}

export type LocalData = {
  readonly schemaVersion: 1
  readonly questionInstances: readonly ReadonlyQuestionInstance[]
}

export type LocalDataReadResult =
  | { status: 'missing'; raw: null; data: LocalData }
  | { status: 'ok'; raw: string; data: LocalData }
  | { status: 'invalid'; raw: string; error: LocalDataError }
  | { status: 'unreadable'; error: LocalDataError }

export function parseLocalData(text: string): LocalData
export function serializeLocalData(value: unknown): string
export function readLocalData(getStorage?: () => Storage): LocalDataReadResult
export function exportLocalData(getStorage?: () => Storage): string
export function importLocalData(
  file: Pick<File, 'size' | 'text'>,
  confirmReplacement: (state: { damaged: boolean; existingCount?: number }) => boolean | Promise<boolean>,
  getStorage?: () => Storage,
): Promise<
  | { status: 'cancelled' }
  | { status: 'imported'; data: LocalData; raw: string }
>
