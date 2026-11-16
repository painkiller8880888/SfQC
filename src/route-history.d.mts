import type { AppRoute } from './resolve-screen.mjs'

export const ROUTE_HISTORY_VERSION: 2

export type RouteHistoryFrame = {
  routeHash: string
  route: AppRoute
  scrollY: number
}

export type RouteHistoryState = RouteHistoryFrame & {
  version: 2
  entryId: string
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
  options?: { entryId?: string },
): RouteHistoryState | null
export function updateRouteHistoryState(
  state: RouteHistoryState,
  patch: Partial<Pick<RouteHistoryState, 'scrollY'>>,
): RouteHistoryState
