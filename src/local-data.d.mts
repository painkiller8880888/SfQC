import type { ReadonlyQuestionInstance } from './question-contract.mjs'
import type { QuestionGradingResult } from './question-grading.mjs'
import type { LessonRef } from './lesson-contract.mjs'

export const LOCAL_DATA_KEY: 'sfqc:local-data'
export const LOCAL_DATA_MAX_BYTES: 2_097_152
export const LOCAL_DATA_MAX_INSTANCES: 500

export type GradedQuestionResult = Extract<QuestionGradingResult, { readonly status: 'graded' }>

export type AnswerAttempt = {
  readonly attemptId: string
  readonly instanceId: string
  readonly answer: string
  readonly gradingResult: GradedQuestionResult
  readonly attemptedAt: string
}

export type ReviewEvent = {
  readonly reviewEventId: string
  readonly targetRef: LessonRef
  readonly sourceAttemptId: string
  readonly reviewedAt: string
}

export type LocalData = {
  readonly schemaVersion: 2
  readonly questionInstances: readonly ReadonlyQuestionInstance[]
  readonly answerAttempts: readonly AnswerAttempt[]
  readonly reviewEvents: readonly ReviewEvent[]
}

export type LocalDataCounts = {
  readonly questionInstances: number
  readonly answerAttempts: number
  readonly reviewEvents: number
}

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
  | 'history-modified'

export class LocalDataError extends Error {
  code: LocalDataErrorCode
}

export type LocalDataReadResult =
  | { status: 'missing'; raw: null; data: LocalData }
  | { status: 'ok'; raw: string; data: LocalData }
  | { status: 'legacy'; raw: string; data: LocalData }
  | { status: 'invalid'; raw: string; error: LocalDataError }
  | { status: 'unreadable'; error: LocalDataError }

export type LocalDataWriteResult = {
  status: 'saved'
  data: LocalData
  raw: string
}

export function parseLocalData(text: string): LocalData
export function serializeLocalData(value: unknown): string
export function readLocalData(getStorage?: () => Storage): LocalDataReadResult
export function exportLocalData(getStorage?: () => Storage): string
export function saveLocalData(value: unknown, getStorage?: () => Storage): LocalDataWriteResult
export function migrateLocalData(
  expectedRaw: string,
  value: unknown,
  getStorage?: () => Storage,
): LocalDataWriteResult
export function importLocalData(
  file: Pick<File, 'size' | 'text'>,
  confirmReplacement: (state: {
    damaged: boolean
    existingCounts?: LocalDataCounts
    importCounts: LocalDataCounts
  }) => boolean | Promise<boolean>,
  getStorage?: () => Storage,
): Promise<
  | { status: 'cancelled' }
  | { status: 'imported'; data: LocalData; raw: string }
>
