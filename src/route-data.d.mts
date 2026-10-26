import type { IncludedLessonDefinition } from './lesson-contract.mjs'
import type { AnswerAttempt, LocalData, LocalDataReadResult } from './local-data.mjs'
import type { ReadonlyQuestionInstance } from './question-contract.mjs'
import type { AppRoute } from './resolve-screen.mjs'
import type { RouteHistoryState } from './route-history.mjs'

type RouteLocalDataReadResult = LocalDataReadResult
  | { status: 'migration-failed'; raw: string; data: LocalData; error: Error }

export type RouteDataResult =
  | { status: 'screen' }
  | { status: 'lesson'; lesson: IncludedLessonDefinition; section: IncludedLessonDefinition['sections'][number] | null }
  | { status: 'practice'; data: LocalData; instance: ReadonlyQuestionInstance }
  | { status: 'feedback'; data: LocalData; attempt: AnswerAttempt; instance: ReadonlyQuestionInstance }
  | { status: 'unknown-id'; target: 'lesson' | 'section' | 'instance' | 'attempt' }
  | { status: 'unavailable-lesson'; lesson: Exclude<import('./lesson-contract.mjs').LessonDefinition, IncludedLessonDefinition> }
  | { status: 'data-error'; error: Error }

export function resolveRouteData(route: AppRoute, readResult: RouteLocalDataReadResult): RouteDataResult
export function validateRouteHistoryReferences(state: RouteHistoryState, readResult: RouteLocalDataReadResult): boolean
