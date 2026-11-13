export const PRACTICE_RESULTS_KEY: 'sfqc:practice-results:v1'
export const PRACTICE_RESULTS_MAX_BYTES: 8_192
export const PRACTICE_RESULTS_MAX_RECORDS: 25
export const PRACTICE_CATEGORY_IDS: readonly [
  'mean-deviation', 'data-transformation', 'unbiased-variance', 'comprehensive', 'variance-standard-deviation',
]
export type PracticeRecord = { categoryId: typeof PRACTICE_CATEGORY_IDS[number]; isCorrect: boolean; attemptedAt: string }
export type PracticeResults = { schemaVersion: 1; records: PracticeRecord[] }
export type PracticeResultsStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type PracticeResultsErrorCode = 'invalid-json' | 'invalid-schema' | 'unsupported-version' | 'too-large'
  | 'storage-unavailable' | 'storage-write-failed'
export class PracticeResultsError extends Error { code: PracticeResultsErrorCode }
export type PracticeResultsReadResult =
  | { status: 'missing'; raw: null; results: PracticeResults }
  | { status: 'ok'; raw: string; results: PracticeResults }
  | { status: 'invalid' | 'unsupported'; raw?: string; error: PracticeResultsError }
  | { status: 'unreadable'; error: PracticeResultsError }
export type PracticeResultSaveResult = {
  status: 'saved' | 'not-written' | 'conflict' | 'unknown'
  expectedRaw: string | null
  candidateRaw: string | null
  latest: PracticeResultsReadResult
  record?: PracticeRecord
  error?: PracticeResultsError
}
export function parsePracticeResults(text: string): PracticeResults
export function serializePracticeResults(value: unknown): string
export function readPracticeResults(getStorage?: () => PracticeResultsStorage): PracticeResultsReadResult
export function appendPracticeResult(input: { categoryId: typeof PRACTICE_CATEGORY_IDS[number]; isCorrect: boolean; attemptedAt?: string }, expectedRaw: string | null, getStorage?: () => PracticeResultsStorage): PracticeResultSaveResult
export function recheckPracticeResult(pending: PracticeResultSaveResult, getStorage?: () => PracticeResultsStorage): PracticeResultSaveResult
