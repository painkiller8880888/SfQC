const lessonIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
const screenKinds = ['map', 'lesson', 'practice', 'feedback', 'progress', 'data']

function hasKeys(route, keys) {
  const prototype = route && typeof route === 'object' ? Object.getPrototypeOf(route) : undefined
  return route && typeof route === 'object' && !Array.isArray(route)
    && (prototype === Object.prototype || prototype === null)
    && Reflect.ownKeys(route).length === keys.length
    && Reflect.ownKeys(route).every((key) => typeof key === 'string' && keys.includes(key))
}

function isRoute(route) {
  if (!route || typeof route !== 'object') return false
  if (screenKinds.includes(route.kind) || route.kind === 'not-found') return hasKeys(route, ['kind'])
  if (route.kind === 'lesson-id') return hasKeys(route, ['kind', 'lessonId', 'sectionId'])
    && lessonIdPattern.test(route.lessonId)
    && (route.sectionId === null || (typeof route.sectionId === 'string' && lessonIdPattern.test(route.sectionId)))
  if (route.kind === 'practice-id') return hasKeys(route, ['kind', 'instanceId'])
    && typeof route.instanceId === 'string' && route.instanceId.length > 0
  if (route.kind === 'feedback-id') return hasKeys(route, ['kind', 'attemptId'])
    && typeof route.attemptId === 'string' && route.attemptId.length > 0
  return false
}

export function resolveRoute(hash) {
  if (hash === '' || hash === '#/') return { kind: 'map' }
  if (typeof hash !== 'string' || !hash.startsWith('#/')) return { kind: 'not-found' }

  const segments = hash.slice(2).split('/')
  if (segments.length === 1) {
    return ['map', 'lesson', 'practice', 'feedback', 'progress', 'data'].includes(segments[0])
      ? { kind: segments[0] }
      : { kind: 'not-found' }
  }

  if (segments.some((segment) => segment.length === 0)) return { kind: 'not-found' }
  try {
    if (segments[0] === 'lesson' && (segments.length === 2 || segments.length === 3)) {
      const lessonId = decodeURIComponent(segments[1])
      const sectionId = segments.length === 3 ? decodeURIComponent(segments[2]) : null
      if (!lessonIdPattern.test(lessonId) || (sectionId !== null && !lessonIdPattern.test(sectionId))) {
        return { kind: 'not-found' }
      }
      return { kind: 'lesson-id', lessonId, sectionId }
    }
    if (segments[0] === 'practice' && segments.length === 2) {
      const instanceId = decodeURIComponent(segments[1])
      return instanceId ? { kind: 'practice-id', instanceId } : { kind: 'not-found' }
    }
    if (segments[0] === 'feedback' && segments.length === 2) {
      const attemptId = decodeURIComponent(segments[1])
      return attemptId ? { kind: 'feedback-id', attemptId } : { kind: 'not-found' }
    }
  } catch {
    return { kind: 'not-found' }
  }
  return { kind: 'not-found' }
}

export function routeToHash(route) {
  if (!isRoute(route) || route.kind === 'not-found') throw new TypeError('Invalid route')
  try {
    if (screenKinds.includes(route.kind)) return `#/${route.kind}`
    if (route.kind === 'lesson-id') {
      return `#/lesson/${encodeURIComponent(route.lessonId)}${route.sectionId === null ? '' : `/${encodeURIComponent(route.sectionId)}`}`
    }
    if (route.kind === 'practice-id') return `#/practice/${encodeURIComponent(route.instanceId)}`
    return `#/feedback/${encodeURIComponent(route.attemptId)}`
  } catch {
    throw new TypeError('Invalid route')
  }
}

export function sameRoute(left, right) {
  if (!isRoute(left) || !isRoute(right) || left.kind !== right.kind) return false
  if (left.kind === 'lesson-id') return left.lessonId === right.lessonId && left.sectionId === right.sectionId
  if (left.kind === 'practice-id') return left.instanceId === right.instanceId
  if (left.kind === 'feedback-id') return left.attemptId === right.attemptId
  return ['map', 'lesson', 'practice', 'feedback', 'progress', 'data', 'not-found'].includes(left.kind)
}

export function screenForRoute(route) {
  return route?.kind?.replace(/-id$/u, '') ?? 'not-found'
}

export function resolveScreen(hash) {
  return screenForRoute(resolveRoute(hash))
}
