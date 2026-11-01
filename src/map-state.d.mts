import type { LessonRegistry } from './lesson-contract.mjs'
import type { ManualLessonProgress } from './manual-progress.mjs'

export const MAP_STATE_KEY: 'sfqc:map-state:v1'
export const MAP_STATE_MAX_BYTES: 65_536
export type MapStateStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type MapStateLesson = ManualLessonProgress & {
  lessonRevision: number
  objectives: string[]
}
export type MapState = {
  schemaVersion: 1
  curriculumRevision: number
  lessons: Record<string, MapStateLesson>
  positions: Record<string, { x: number; y: number }>
}
export type MapStateErrorCode = 'invalid-json' | 'invalid-schema' | 'unsupported-version' | 'too-large'
  | 'storage-unavailable' | 'storage-changed' | 'storage-write-failed'
export class MapStateError extends Error { code: MapStateErrorCode }

export function createInitialMapState(registry: LessonRegistry): MapState
export function parseMapState(text: string, registry: LessonRegistry): { state: MapState; changedLessonIds: string[] }
export function serializeMapState(value: unknown): string
export function readMapState(registry: LessonRegistry, getStorage?: () => MapStateStorage):
  | { status: 'missing'; raw: null; state: MapState; changedLessonIds: [] }
  | { status: 'ok' | 'migrated'; raw: string; state: MapState; changedLessonIds: string[] }
  | { status: 'invalid' | 'unsupported' | 'unreadable'; raw?: string; error: MapStateError }
export function saveMapState(value: MapState, expectedRaw: string | null, registry: LessonRegistry, getStorage?: () => MapStateStorage):
  { status: 'saved'; state: MapState; raw: string }
