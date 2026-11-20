import { resolveRoute, sameRoute } from './resolve-screen.mjs'

export const ROUTE_HISTORY_VERSION = 2

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasOnlyKeys(value, keys) {
  return isRecord(value) && Reflect.ownKeys(value).every((key) => typeof key === 'string' && keys.includes(key))
}

function routeMatchesHash(route, hash) {
  return typeof hash === 'string' && sameRoute(resolveRoute(hash), route)
}

function isFrameArray(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false
  const keys = Reflect.ownKeys(value)
  return keys.length === value.length + 1 && keys.includes('length')
    && Array.from({ length: value.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      return descriptor?.enumerable === true && 'value' in descriptor && isFrame(descriptor.value)
    }).every(Boolean)
}

function isFocusTarget(value) {
  return hasOnlyKeys(value, ['exerciseId', 'linkIndex'])
    && Reflect.ownKeys(value).length === 2
    && typeof value.exerciseId === 'string' && value.exerciseId.length > 0
    && Number.isSafeInteger(value.linkIndex) && value.linkIndex >= 0
}

function isFrame(value) {
  if (!hasOnlyKeys(value, ['routeHash', 'route', 'scrollY', 'entryId', 'focusTarget'])
    || !routeMatchesHash(value.route, value.routeHash)
    || !Number.isFinite(value.scrollY) || value.scrollY < 0) return false

  const keys = Reflect.ownKeys(value)
  if (keys.length === 3) return true
  return keys.length === 5
    && typeof value.entryId === 'string' && value.entryId.length > 0
    && (value.focusTarget === null || isFocusTarget(value.focusTarget))
}

export function validateRouteHistoryState(value, expectedHash) {
  if (!hasOnlyKeys(value, ['version', 'routeHash', 'route', 'entryId', 'scrollY', 'returnStack'])
    || Reflect.ownKeys(value).length !== 6) return null
  if (value.version !== ROUTE_HISTORY_VERSION || value.routeHash !== expectedHash
    || !routeMatchesHash(value.route, value.routeHash)
    || typeof value.entryId !== 'string' || value.entryId.length === 0
    || !Number.isFinite(value.scrollY) || value.scrollY < 0
    || !isFrameArray(value.returnStack)) return null
  const entryIds = [value.entryId, ...value.returnStack.map((frame) => frame.entryId).filter(Boolean)]
  if (new Set(entryIds).size !== entryIds.length) return null
  return value
}

function newEntryId(excluded = new Set()) {
  let entryId
  do {
    entryId = globalThis.crypto?.randomUUID?.()
      ?? `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`
  } while (excluded.has(entryId))
  return entryId
}

export function createRouteHistoryState(route, routeHash, options = {}) {
  if (!routeMatchesHash(route, routeHash)) throw new TypeError('Route and hash do not match')
  const returnStack = options.returnStack ?? []
  const reservedEntryIds = new Set(returnStack.map((frame) => frame.entryId).filter(Boolean))
  const entryId = options.entryId ?? newEntryId(reservedEntryIds)
  if (reservedEntryIds.has(entryId)) throw new TypeError('History entry ID must be unique')
  const state = {
    version: ROUTE_HISTORY_VERSION,
    routeHash,
    route,
    entryId,
    scrollY: options.scrollY ?? 0,
    returnStack,
  }
  if (!validateRouteHistoryState(state, routeHash)) throw new TypeError('Invalid route history state')
  return state
}

function frameFor(state, focusTarget) {
  return {
    routeHash: state.routeHash,
    route: state.route,
    entryId: state.entryId,
    scrollY: state.scrollY,
    focusTarget: focusTarget ?? null,
  }
}

function nextEntryId(state, requestedEntryId) {
  const excluded = new Set([
    state.entryId,
    ...state.returnStack.map((frame) => frame.entryId).filter(Boolean),
  ])
  if (requestedEntryId !== undefined) {
    if (excluded.has(requestedEntryId)) throw new TypeError('History entry ID must be unique')
    return requestedEntryId
  }
  return newEntryId(excluded)
}

export function navigateRouteHistory(state, route, routeHash, intent = 'normal', options = {}) {
  if (!validateRouteHistoryState(state, state.routeHash) || !routeMatchesHash(route, routeHash)) {
    throw new TypeError('Invalid route history state')
  }

  if (intent === 'return') {
    const frame = state.returnStack.at(-1)
    if (frame && (!sameRoute(route, frame.route) || routeHash !== frame.routeHash)) {
      throw new TypeError('Return target does not match the last frame')
    }
    const returnStack = frame ? state.returnStack.slice(0, -1) : []
    return frame ? createRouteHistoryState(frame.route, frame.routeHash, {
      entryId: nextEntryId(state, options.entryId),
      scrollY: frame.scrollY,
      returnStack,
    }) : null
  }

  const sameLesson = state.route.kind === 'course-lesson' && route.kind === 'course-lesson'
    ? state.route.courseId === route.courseId
    : state.route.kind === 'lesson-id' && route.kind === 'lesson-id' && state.route.lessonId === route.lessonId
  if (intent === 'section' && !sameLesson) throw new TypeError('Section navigation must stay in the lesson')
  if (intent === 'review' && route.kind !== 'lesson-id' && route.kind !== 'course-lesson') {
    throw new TypeError('Review navigation must target a lesson')
  }
  if (!['normal', 'review', 'section'].includes(intent)) throw new TypeError('Invalid navigation intent')

  const returnStack = intent === 'review' ? [...state.returnStack, frameFor(state, options.focusTarget)]
    : intent === 'section' ? state.returnStack
      : []
  return createRouteHistoryState(route, routeHash, {
    entryId: nextEntryId(state, options.entryId),
    returnStack,
  })
}

export function updateRouteHistoryState(state, patch) {
  if (!validateRouteHistoryState(state, state.routeHash)
    || !hasOnlyKeys(patch, ['scrollY'])) throw new TypeError('Invalid route history update')
  const updated = { ...state, ...patch }
  if (!validateRouteHistoryState(updated, state.routeHash)) throw new TypeError('Invalid route history update')
  return updated
}
