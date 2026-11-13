import { createRouteHistoryState, validateRouteHistoryState } from './route-history.mjs'
import { resolveRoute } from './resolve-screen.mjs'
import { resolveRouteData, validateRouteHistoryReferences } from './route-data.mjs'

const emptyLegacyData = {
  status: 'missing', raw: null,
  data: { schemaVersion: 2, questionInstances: [], answerAttempts: [], reviewEvents: [] },
}

export function resolveRouteView(
  hash,
  rawState,
  navigationCause,
  navigationId,
  storedData = emptyLegacyData,
) {
  const route = resolveRoute(hash)
  let historyState = validateRouteHistoryState(rawState, hash)
  if (historyState && (historyState.resumeAttemptId !== null
    || historyState.returnStack.some((frame) => frame.resumeAttemptId !== null))
    && !validateRouteHistoryReferences(historyState, storedData)) historyState = null
  const stateNeedsRepair = historyState === null
  const navigation = stateNeedsRepair && navigationCause !== 'initial' ? 'normal'
    : stateNeedsRepair && route.kind === 'course-lesson' ? 'section'
      : navigationCause
  return {
    route,
    historyState: historyState ?? createRouteHistoryState(route, hash),
    storedData,
    resolved: resolveRouteData(route, storedData),
    navigation,
    navigationId,
    historyWarning: rawState !== null && stateNeedsRepair,
    stateNeedsRepair,
  }
}

export function refreshRouteView(currentView, storedData, hash = currentView.historyState.routeHash, rawState = currentView.historyState) {
  return resolveRouteView(hash, rawState, 'refresh', currentView.navigationId, storedData)
}

export function applyRouteNavigationEffect(navigation, historyState, targets) {
  if (navigation === 'refresh') return
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
