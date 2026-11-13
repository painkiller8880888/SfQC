import { lessonRegistry } from './lesson-registry.mjs'

export const LEARNING_STATE_KEY = 'sfqc:learning-state:v1'
export const LEARNING_STATE_MAX_BYTES = 65_536

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u

export class LearningStateError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'LearningStateError'
    this.code = code
  }
}

function fail(code, message) {
  throw new LearningStateError(code, message)
}

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return (prototype === Object.prototype || prototype === null)
    && Reflect.ownKeys(value).every((key) => {
      const descriptor = typeof key === 'string' && Object.getOwnPropertyDescriptor(value, key)
      return descriptor?.enumerable === true && 'value' in descriptor && descriptor.value !== undefined
    })
}

function hasExactKeys(value, keys) {
  return isRecord(value) && Reflect.ownKeys(value).length === keys.length
    && Reflect.ownKeys(value).every((key) => keys.includes(key))
}

function isTimestamp(value) {
  if (typeof value !== 'string' || !timestampPattern.test(value)) return false
  try { return new Date(value).toISOString() === value } catch { return false }
}

function checkSize(text) {
  if (new TextEncoder().encode(text).byteLength > LEARNING_STATE_MAX_BYTES) {
    fail('too-large', '手動進捗・マップ配置の保存サイズが上限（64 KiB）を超えています。')
  }
}

function validateAndComplete(value, registry) {
  if (!isRecord(value)) fail('invalid-schema', '手動進捗の保存形式が不正です。')
  if (value.schemaVersion !== 1) {
    if (typeof value.schemaVersion === 'number') fail('unsupported-version', '未対応の手動進捗形式です。')
    fail('invalid-schema', '手動進捗の保存形式が不正です。')
  }
  if (!hasExactKeys(value, ['schemaVersion', 'lessons', 'positions'])
    || !isRecord(value.lessons) || !isRecord(value.positions)) {
    fail('invalid-schema', '手動進捗の保存形式が不正です。')
  }

  const registryLessons = new Map(registry.lessons.map((lesson) => [lesson.lessonId, lesson]))
  const lessons = { ...value.lessons }
  const positions = { ...value.positions }
  for (const [lessonId, progress] of Object.entries(lessons)) {
    if (!idPattern.test(lessonId) || !hasExactKeys(progress, ['completedAt'])
      || !(progress.completedAt === null || isTimestamp(progress.completedAt))
      || (registryLessons.get(lessonId)?.availability === 'planned' && progress.completedAt !== null)) {
      fail('invalid-schema', '単元の手動進捗または完了日時が不正です。')
    }
  }
  for (const [lessonId, position] of Object.entries(positions)) {
    if (!idPattern.test(lessonId) || !hasExactKeys(position, ['x', 'y'])
      || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      fail('invalid-schema', '学習マップの配置データが不正です。')
    }
  }
  for (const lesson of registry.lessons) lessons[lesson.lessonId] ??= { completedAt: null }
  return {
    state: { schemaVersion: 1, lessons, positions },
    unresolvedIds: {
      lessons: Object.keys(value.lessons).filter((lessonId) => !registryLessons.has(lessonId)),
      positions: Object.keys(value.positions).filter((lessonId) => !registryLessons.has(lessonId)),
    },
  }
}

function initialState(registry) {
  return validateAndComplete({ schemaVersion: 1, lessons: {}, positions: {} }, registry).state
}

export function parseLearningState(text, registry = lessonRegistry) {
  if (typeof text !== 'string') fail('invalid-json', '手動進捗のJSONを読み込めません。')
  checkSize(text)
  let value
  try { value = JSON.parse(text) } catch { fail('invalid-json', '手動進捗のJSONを解析できません。') }
  try { return validateAndComplete(value, registry) } catch (error) {
    if (error instanceof LearningStateError) throw error
    fail('invalid-schema', '手動進捗の保存形式が不正です。')
  }
}

export function serializeLearningState(value, registry = lessonRegistry) {
  try {
    const { state } = validateAndComplete(value, registry)
    const text = JSON.stringify(state)
    checkSize(text)
    return text
  } catch (error) {
    if (error instanceof LearningStateError) throw error
    fail('invalid-schema', '手動進捗の保存形式が不正です。')
  }
}

function readFromStorage(storage, registry) {
  let raw
  try { raw = storage.getItem(LEARNING_STATE_KEY) } catch {
    return { status: 'unreadable', error: new LearningStateError('storage-unavailable', '手動進捗を読み取れません。') }
  }
  if (raw === null) return { status: 'missing', raw: null, state: initialState(registry), unresolvedIds: { lessons: [], positions: [] } }
  if (typeof raw !== 'string') {
    return { status: 'invalid', error: new LearningStateError('invalid-schema', '手動進捗の保存形式が不正です。') }
  }
  try {
    return { status: 'ok', raw, ...parseLearningState(raw, registry) }
  } catch (error) {
    const normalized = error instanceof LearningStateError ? error : new LearningStateError('invalid-schema', '手動進捗の保存形式が不正です。')
    return { status: normalized.code === 'unsupported-version' ? 'unsupported' : 'invalid', raw, error: normalized }
  }
}

function getStorageSafely(getStorageFactory) {
  try { return getStorageFactory() } catch { return null }
}

export function readLearningState(registry = lessonRegistry, getStorageFactory = () => window.localStorage) {
  const storage = getStorageSafely(getStorageFactory)
  return storage
    ? readFromStorage(storage, registry)
    : { status: 'unreadable', error: new LearningStateError('storage-unavailable', '手動進捗を読み取れません。') }
}

function sameUnresolvedEntries(before, candidate) {
  const sameEntries = (beforeIds, nextIds, left, right, kind) => beforeIds.length === nextIds.length
    && beforeIds.every((id) => nextIds.includes(id)
      && (kind === 'lesson'
        ? left[id].completedAt === right[id].completedAt
        : left[id].x === right[id].x && left[id].y === right[id].y))
  return sameEntries(before.unresolvedIds.lessons, candidate.unresolvedIds.lessons,
    before.state.lessons, candidate.state.lessons, 'lesson')
    && sameEntries(before.unresolvedIds.positions, candidate.unresolvedIds.positions,
      before.state.positions, candidate.state.positions, 'position')
}

function result(status, expectedRaw, candidateRaw, latest, error) {
  return { status, expectedRaw, candidateRaw, latest, ...(error ? { error } : {}) }
}

export function saveLearningState(value, expectedRaw, registry = lessonRegistry, getStorageFactory = () => window.localStorage) {
  let candidateRaw = null
  let candidate
  if (expectedRaw !== null && typeof expectedRaw !== 'string') {
    return result('not-written', null, null, readLearningState(registry, getStorageFactory),
      new LearningStateError('invalid-schema', '保存前の手動進捗を特定できません。'))
  }
  try {
    candidateRaw = serializeLearningState(value, registry)
    candidate = parseLearningState(candidateRaw, registry)
  } catch (error) {
    return result('not-written', expectedRaw, candidateRaw, readLearningState(registry, getStorageFactory), error)
  }
  const storage = getStorageSafely(getStorageFactory)
  if (!storage) return result('not-written', expectedRaw, candidateRaw, readLearningState(registry, () => { throw new Error() }), new LearningStateError('storage-unavailable', '手動進捗を読み取れません。'))
  const latest = readFromStorage(storage, registry)
  if (latest.status === 'unreadable') return result('not-written', expectedRaw, candidateRaw, latest, latest.error)
  if (latest.raw !== expectedRaw) return result('conflict', expectedRaw, candidateRaw, latest)
  if (latest.status === 'invalid' || latest.status === 'unsupported') return result('not-written', expectedRaw, candidateRaw, latest, latest.error)

  let baseline
  try {
    baseline = expectedRaw === null
      ? { state: initialState(registry), unresolvedIds: { lessons: [], positions: [] } }
      : parseLearningState(expectedRaw, registry)
  } catch (error) {
    return result('not-written', expectedRaw, candidateRaw, latest, error)
  }
  if (!sameUnresolvedEntries(baseline, candidate)) {
    return result('not-written', expectedRaw, candidateRaw, latest,
      new LearningStateError('unresolved-changed', '未解決の単元IDや配置は通常保存で変更できません。確認したバックアップから置き換えてください。'))
  }
  // shortcut: localStorage cannot compare and write atomically; use a transactional store if strict tab exclusion is required.
  try { storage.setItem(LEARNING_STATE_KEY, candidateRaw) } catch {
    const after = readFromStorage(storage, registry)
    if (after.status === 'unreadable') return result('unknown', expectedRaw, candidateRaw, after, after.error)
    if (after.raw === candidateRaw && after.status === 'ok') {
      return { ...result('saved', expectedRaw, candidateRaw, after), state: after.state, raw: after.raw }
    }
    if (after.raw !== expectedRaw) return result('conflict', expectedRaw, candidateRaw, after)
    return result('not-written', expectedRaw, candidateRaw, after,
      new LearningStateError('storage-write-failed', '手動進捗を保存できませんでした。'))
  }
  const confirmed = readFromStorage(storage, registry)
  if (confirmed.status === 'unreadable') return result('unknown', expectedRaw, candidateRaw, confirmed, confirmed.error)
  if (confirmed.raw !== candidateRaw) return result('conflict', expectedRaw, candidateRaw, confirmed)
  return { ...result('saved', expectedRaw, candidateRaw, confirmed), state: confirmed.state, raw: confirmed.raw }
}
