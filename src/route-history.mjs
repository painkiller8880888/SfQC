import { resolveRoute, sameRoute } from './resolve-screen.mjs'

export const ROUTE_HISTORY_VERSION = 1

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

function isReference(value) {
  return value === null || (typeof value === 'string' && value.length > 0)
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
  return hasOnlyKeys(value, ['routeHash', 'route', 'draft', 'scrollY', 'resumeAttemptId'])
    && Reflect.ownKeys(value).length === 5
    && routeMatchesHash(value.route, value.routeHash)
    && typeof value.draft === 'string'
    && Number.isFinite(value.scrollY) && value.scrollY >= 0
    && isReference(value.resumeAttemptId)
    && (value.resumeAttemptId === null || value.route.kind === 'practice-id')
}

export function validateRouteHistoryState(value, expectedHash) {
  if (!hasOnlyKeys(value, [
    'version', 'routeHash', 'route', 'entryId', 'draft', 'scrollY', 'resumeAttemptId', 'returnStack',
  ]) || Reflect.ownKeys(value).length !== 8) return null
  if (value.version !== ROUTE_HISTORY_VERSION || value.routeHash !== expectedHash
    || !routeMatchesHash(value.route, value.routeHash)
    || typeof value.entryId !== 'string' || value.entryId.length === 0
    || typeof value.draft !== 'string'
    || !Number.isFinite(value.scrollY) || value.scrollY < 0
    || !isReference(value.resumeAttemptId)
    || (value.resumeAttemptId !== null && value.route.kind !== 'practice-id')
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
    draft: options.draft ?? '',
    scrollY: options.scrollY ?? 0,
    resumeAttemptId: options.resumeAttemptId ?? null,
    returnStack: options.returnStack ?? [],
  }
  if (!validateRouteHistoryState(state, routeHash)) throw new TypeError('Invalid route history state')
  return state
}

function frameFor(state) {
  return {
    routeHash: state.routeHash,
    route: state.route,
    draft: state.draft,
    scrollY: state.scrollY,
    resumeAttemptId: state.resumeAttemptId,
  }
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
      draft: frame.draft,
      scrollY: frame.scrollY,
      resumeAttemptId: frame.resumeAttemptId,
      returnStack: state.returnStack.slice(0, -1),
    }) : null
  }

  if (intent === 'section' && !(state.route.kind === 'lesson-id' && route.kind === 'lesson-id'
    && state.route.lessonId === route.lessonId)) throw new TypeError('Section navigation must stay in the lesson')
  if (intent === 'review' && route.kind !== 'lesson-id') throw new TypeError('Review navigation must target a lesson')

  const returnStack = intent === 'review' ? [...state.returnStack, frameFor(state)]
    : intent === 'section' ? state.returnStack
      : []
  if (intent === 'resume') {
    if (route.kind !== 'practice-id' || typeof options.attemptId !== 'string' || options.attemptId.length === 0
      || typeof options.answer !== 'string') throw new TypeError('Invalid practice resume')
    return createRouteHistoryState(route, routeHash, {
      entryId: options.entryId,
      draft: options.answer,
      resumeAttemptId: options.attemptId,
      returnStack,
    })
  }
  if (!['normal', 'review', 'section'].includes(intent)) throw new TypeError('Invalid navigation intent')
  return createRouteHistoryState(route, routeHash, {
    entryId: options.entryId,
    returnStack,
  })
}

export function updateRouteHistoryState(state, patch) {
  if (!validateRouteHistoryState(state, state.routeHash)
    || !hasOnlyKeys(patch, ['draft', 'scrollY'])) throw new TypeError('Invalid route history update')
  const updated = { ...state, ...patch }
  if (!validateRouteHistoryState(updated, state.routeHash)) throw new TypeError('Invalid route history update')
  return updated
}
