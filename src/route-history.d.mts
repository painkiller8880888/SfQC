import type { AppRoute } from './resolve-screen.mjs'

export const ROUTE_HISTORY_VERSION: 2

export type RouteHistoryFocusTarget = {
  exerciseId: string
  linkIndex: number
}

export type RouteHistoryFrame = {
  routeHash: string
  route: AppRoute
  scrollY: number
  /** Missing in existing version 2 browser history entries. */
  entryId?: string
  /** Missing in existing version 2 browser history entries. */
  focusTarget?: RouteHistoryFocusTarget | null
}

export type RouteHistoryState = {
  version: 2
  routeHash: string
  route: AppRoute
  entryId: string
  scrollY: number
  returnStack: RouteHistoryFrame[]
}

export function validateRouteHistoryState(value: unknown, expectedHash: string): RouteHistoryState | null
export function createRouteHistoryState(
  route: AppRoute,
  routeHash: string,
  options?: Partial<Pick<RouteHistoryState, 'entryId' | 'scrollY' | 'returnStack'>>,
): RouteHistoryState
export type NavigationIntent = 'normal' | 'review' | 'section' | 'return'
export function navigateRouteHistory(
  state: RouteHistoryState,
  route: AppRoute,
  routeHash: string,
  intent?: NavigationIntent,
  options?: { entryId?: string; focusTarget?: RouteHistoryFocusTarget | null },
): RouteHistoryState | null
export function updateRouteHistoryState(
  state: RouteHistoryState,
  patch: Partial<Pick<RouteHistoryState, 'scrollY'>>,
): RouteHistoryState
