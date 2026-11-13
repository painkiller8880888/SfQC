import type { RouteDataResult } from './route-data.mjs'
import type { AppRoute } from './resolve-screen.mjs'
import type { RouteHistoryState } from './route-history.mjs'

export type NavigationCause = 'initial' | 'normal' | 'review' | 'section' | 'return' | 'restore'

export type RouteView = {
  route: AppRoute
  historyState: RouteHistoryState
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
): RouteView

export function applyRouteNavigationEffect(
  navigation: NavigationCause,
  historyState: RouteHistoryState,
  targets: RouteNavigationTargets,
): void
