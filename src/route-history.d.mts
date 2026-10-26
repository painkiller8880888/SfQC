import type { AppRoute } from './resolve-screen.mjs'

export const ROUTE_HISTORY_VERSION: 1

export type RouteHistoryFrame = {
  routeHash: string
  route: AppRoute
  draft: string
  scrollY: number
  resumeAttemptId: string | null
}

export type RouteHistoryState = RouteHistoryFrame & {
  version: 1
  entryId: string
  returnStack: RouteHistoryFrame[]
}

export function validateRouteHistoryState(value: unknown, expectedHash: string): RouteHistoryState | null
export function createRouteHistoryState(
  route: AppRoute,
  routeHash: string,
  options?: Partial<Pick<RouteHistoryState, 'entryId' | 'draft' | 'scrollY' | 'resumeAttemptId' | 'returnStack'>>,
): RouteHistoryState
export type NavigationIntent = 'normal' | 'review' | 'section' | 'resume' | 'return'
export function navigateRouteHistory(
  state: RouteHistoryState,
  route: AppRoute,
  routeHash: string,
  intent?: NavigationIntent,
  options?: { entryId?: string; attemptId?: string; answer?: string },
): RouteHistoryState | null
export function updateRouteHistoryState(
  state: RouteHistoryState,
  patch: Partial<Pick<RouteHistoryState, 'draft' | 'scrollY'>>,
): RouteHistoryState
