import { createRouteHistoryState, validateRouteHistoryState } from './route-history.mjs'
import { resolveRoute } from './resolve-screen.mjs'
import { resolveRouteData } from './route-data.mjs'

export function resolveRouteView(hash, rawState, navigationCause, navigationId) {
  const route = resolveRoute(hash)
  const historyState = validateRouteHistoryState(rawState, hash)
  const stateNeedsRepair = historyState === null
  const navigation = stateNeedsRepair && navigationCause !== 'initial' ? 'normal'
    : stateNeedsRepair && route.kind === 'course-lesson' ? 'section'
      : navigationCause
  return {
    route,
    historyState: historyState ?? createRouteHistoryState(route, hash),
    resolved: resolveRouteData(route),
    navigation,
    navigationId,
    historyWarning: rawState !== null && stateNeedsRepair,
    stateNeedsRepair,
  }
}

export function applyRouteNavigationEffect(navigation, historyState, targets) {
  if (navigation === 'return') targets.heading?.focus({ preventScroll: true })
  if (navigation === 'restore' || navigation === 'return' || navigation === 'initial') {
    targets.scrollTo(0, historyState.scrollY)
    return
  }
  const target = navigation === 'section' || navigation === 'review'
    ? targets.sectionHeading ?? targets.heading
    : targets.heading
  target?.focus({ preventScroll: true })
  if (navigation === 'section' || navigation === 'review') target?.scrollIntoView()
  else targets.scrollTo(0, 0)
}
