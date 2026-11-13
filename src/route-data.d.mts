import type { IncludedLessonDefinition, LessonDefinition } from './lesson-contract.mjs'
import type { AppRoute } from './resolve-screen.mjs'

export type RouteDataResult =
  | { status: 'screen' }
  | { status: 'lesson'; lesson: IncludedLessonDefinition; section: IncludedLessonDefinition['sections'][number] | null }
  | { status: 'course-practice'; lesson: IncludedLessonDefinition }
  | { status: 'unknown-id'; target: 'lesson' | 'section' }
  | { status: 'unavailable-lesson'; lesson: Exclude<LessonDefinition, IncludedLessonDefinition> }

export function resolveRouteData(route: AppRoute): RouteDataResult
