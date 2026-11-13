import type { LessonRegistry } from './lesson-contract.mjs'

export const LEARNING_STATE_KEY: 'sfqc:learning-state:v1'
export const LEARNING_STATE_MAX_BYTES: 65_536
export type LearningStateStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
export type LearningState = {
  schemaVersion: 1
  lessons: Record<string, { completedAt: string | null }>
  positions: Record<string, { x: number; y: number }>
}
export type LearningStateUnresolvedIds = { lessons: string[]; positions: string[] }
export type LearningStateErrorCode = 'invalid-json' | 'invalid-schema' | 'unsupported-version' | 'too-large'
  | 'storage-unavailable' | 'storage-write-failed' | 'unresolved-changed'
export class LearningStateError extends Error { code: LearningStateErrorCode }
export type LearningStateReadResult =
  | { status: 'missing'; raw: null; state: LearningState; unresolvedIds: LearningStateUnresolvedIds }
  | { status: 'ok'; raw: string; state: LearningState; unresolvedIds: LearningStateUnresolvedIds }
  | { status: 'invalid' | 'unsupported'; raw?: string; error: LearningStateError }
  | { status: 'unreadable'; error: LearningStateError }
export type LearningStateSaveResult =
  | { status: 'saved'; expectedRaw: string | null; candidateRaw: string; latest: LearningStateReadResult; state: LearningState; raw: string }
  | { status: 'not-written' | 'conflict' | 'unknown'; expectedRaw: string | null; candidateRaw: string | null; latest: LearningStateReadResult; error?: LearningStateError }
export function parseLearningState(text: string, registry?: LessonRegistry): { state: LearningState; unresolvedIds: LearningStateUnresolvedIds }
export function serializeLearningState(value: unknown, registry?: LessonRegistry): string
export function readLearningState(registry?: LessonRegistry, getStorage?: () => LearningStateStorage): LearningStateReadResult
export function saveLearningState(value: unknown, expectedRaw: string | null, registry?: LessonRegistry, getStorage?: () => LearningStateStorage): LearningStateSaveResult
