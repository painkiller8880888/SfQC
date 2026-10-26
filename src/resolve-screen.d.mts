export type ScreenKind =
  | 'map'
  | 'lesson'
  | 'practice'
  | 'feedback'
  | 'progress'
  | 'data'
  | 'not-found'

export type AppRoute =
  | { kind: 'map' }
  | { kind: 'lesson' }
  | { kind: 'lesson-id'; lessonId: string; sectionId: string | null }
  | { kind: 'practice' }
  | { kind: 'practice-id'; instanceId: string }
  | { kind: 'feedback' }
  | { kind: 'feedback-id'; attemptId: string }
  | { kind: 'progress' }
  | { kind: 'data' }
  | { kind: 'not-found' }

export function resolveRoute(hash: string): AppRoute
export function routeToHash(route: AppRoute): string
export function sameRoute(left: AppRoute | null | undefined, right: AppRoute | null | undefined): boolean
export function screenForRoute(route: AppRoute): ScreenKind
export function resolveScreen(hash: string): ScreenKind
