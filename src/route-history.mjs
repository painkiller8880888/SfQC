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

function isFrame(value) {
  return hasOnlyKeys(value, ['routeHash', 'route', 'scrollY'])
    && Reflect.ownKeys(value).length === 3
    && routeMatchesHash(value.route, value.routeHash)
    && Number.isFinite(value.scrollY) && value.scrollY >= 0
}

export function validateRouteHistoryState(value, expectedHash) {
  if (!hasOnlyKeys(value, ['version', 'routeHash', 'route', 'entryId', 'scrollY', 'returnStack'])
    || Reflect.ownKeys(value).length !== 6) return null
  if (value.version !== ROUTE_HISTORY_VERSION || value.routeHash !== expectedHash
    || !routeMatchesHash(value.route, value.routeHash)
    || typeof value.entryId !== 'string' || value.entryId.length === 0
    || !Number.isFinite(value.scrollY) || value.scrollY < 0
    || !isFrameArray(value.returnStack)) return null
  return value
}

function newEntryId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createRouteHistoryState(route, routeHash, options = {}) {
  if (!routeMatchesHash(route, routeHash)) throw new TypeError('Route and hash do not match')
  const state = {
    version: ROUTE_HISTORY_VERSION,
    routeHash,
    route,
    entryId: options.entryId ?? newEntryId(),
    scrollY: options.scrollY ?? 0,
    returnStack: options.returnStack ?? [],
  }
  if (!validateRouteHistoryState(state, routeHash)) throw new TypeError('Invalid route history state')
  return state
}

function frameFor(state) {
  return { routeHash: state.routeHash, route: state.route, scrollY: state.scrollY }
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
    return frame ? createRouteHistoryState(frame.route, frame.routeHash, {
      entryId: options.entryId,
      scrollY: frame.scrollY,
      returnStack: state.returnStack.slice(0, -1),
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

  const returnStack = intent === 'review' ? [...state.returnStack, frameFor(state)]
    : intent === 'section' ? state.returnStack
      : []
  return createRouteHistoryState(route, routeHash, { entryId: options.entryId, returnStack })
}

export function updateRouteHistoryState(state, patch) {
  if (!validateRouteHistoryState(state, state.routeHash)
    || !hasOnlyKeys(patch, ['scrollY'])) throw new TypeError('Invalid route history update')
  const updated = { ...state, ...patch }
  if (!validateRouteHistoryState(updated, state.routeHash)) throw new TypeError('Invalid route history update')
  return updated
}
