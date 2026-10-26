import type { LocalData, LocalDataReadResult } from './local-data.mjs'
import type { RouteDataResult } from './route-data.mjs'
import type { AppRoute } from './resolve-screen.mjs'
import type { RouteHistoryState } from './route-history.mjs'

export type StoredLocalData = LocalDataReadResult
  | { status: 'migration-failed'; raw: string; data: LocalData; error: Error }

export type NavigationCause = 'initial' | 'normal' | 'review' | 'section' | 'resume' | 'return' | 'restore' | 'refresh'

export type RouteView = {
  route: AppRoute
  historyState: RouteHistoryState
  storedData: StoredLocalData
  resolved: RouteDataResult
  navigation: NavigationCause
  navigationId: number
  historyWarning: boolean
  stateNeedsRepair: boolean
}

export type RouteNavigationTargets = {
  heading: (Pick<HTMLElement, 'focus' | 'scrollIntoView'>) | null
  sectionHeading: (Pick<HTMLElement, 'focus' | 'scrollIntoView'>) | null
  scrollTo: (x: number, y: number) => void
}

export function resolveRouteView(
  hash: string,
  rawState: unknown,
  navigationCause: NavigationCause,
  navigationId: number,
  storedData?: StoredLocalData,
): RouteView

export function refreshRouteView(
  currentView: RouteView,
  storedData: StoredLocalData,
  hash?: string,
  rawState?: unknown,
): RouteView

export function applyRouteNavigationEffect(
  navigation: NavigationCause,
  historyState: RouteHistoryState,
  targets: RouteNavigationTargets,
): void
