export type ScreenKind =
  | 'map'
  | 'lesson'
  | 'practice'
  | 'feedback'
  | 'progress'
  | 'data'
  | 'not-found'

export function resolveScreen(hash: string): ScreenKind
