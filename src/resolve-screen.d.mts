export type ScreenKind =
  | 'map'
  | 'lesson'
  | 'practice'
  | 'progress'
  | 'data'
  | 'not-found'

export type AppRoute =
  | { kind: 'map' }
  | { kind: 'lesson' }
  | { kind: 'lesson-id'; lessonId: string; sectionId: string | null }
  | { kind: 'course-lesson'; courseId: string; sectionId: string }
  | { kind: 'course-practice'; courseId: string }
  | { kind: 'progress' }
  | { kind: 'data' }
  | { kind: 'not-found' }

export function resolveRoute(hash: string): AppRoute
export function routeToHash(route: AppRoute): string
export function sameRoute(left: AppRoute | null | undefined, right: AppRoute | null | undefined): boolean
export function screenForRoute(route: AppRoute): ScreenKind
export function resolveScreen(hash: string): ScreenKind
