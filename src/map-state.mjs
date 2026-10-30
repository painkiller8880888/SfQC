export const MAP_STATE_KEY = 'sfqc:map-state:v1'
export const MAP_STATE_MAX_BYTES = 65_536

const lessonIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u

export class MapStateError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'MapStateError'
    this.code = code
  }
}

function fail(code, message) {
  throw new MapStateError(code, message)
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

function hasOnlyKeys(value, keys) {
  return isRecord(value) && Reflect.ownKeys(value).length === keys.length
    && Reflect.ownKeys(value).every((key) => keys.includes(key))
}

function isDenseArray(value) {
  return Array.isArray(value) && Reflect.ownKeys(value).length === value.length + 1
    && Reflect.ownKeys(value).includes('length')
    && Array.from({ length: value.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      return descriptor?.enumerable === true && 'value' in descriptor && descriptor.value !== undefined
    }).every(Boolean)
}

function isTextArray(value) {
  return isDenseArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0)
}

function validateTimestamp(value) {
  return typeof value === 'string' && timestampPattern.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}

function validateLessonProgress(value) {
  return hasOnlyKeys(value, ['status', 'checks', 'completedAt', 'lessonRevision', 'objectives'])
    && ['not-started', 'started', 'completed'].includes(value.status)
    && isDenseArray(value.checks) && value.checks.every((check) => typeof check === 'boolean')
    && (value.status === 'completed' ? validateTimestamp(value.completedAt) : value.completedAt === null)
    && Number.isSafeInteger(value.lessonRevision) && value.lessonRevision > 0
    && isTextArray(value.objectives) && value.checks.length === value.objectives.length
}

function validateMapState(value) {
  if (!isRecord(value)) {
    fail('invalid-schema', '手動進捗の保存形式が不正です。')
  }
  if (value.schemaVersion !== 1) {
    if (typeof value.schemaVersion === 'number') fail('unsupported-version', '未対応の手動進捗形式です。')
    fail('invalid-schema', '手動進捗の保存形式が不正です。')
  }
  if (!hasOnlyKeys(value, ['schemaVersion', 'curriculumRevision', 'lessons', 'positions'])) {
    fail('invalid-schema', '手動進捗の保存形式が不正です。')
  }
  if (!Number.isSafeInteger(value.curriculumRevision) || value.curriculumRevision <= 0 || !isRecord(value.lessons) || !isRecord(value.positions)) {
    fail('invalid-schema', '手動進捗の保存形式が不正です。')
  }
  for (const [lessonId, progress] of Object.entries(value.lessons)) {
    if (!lessonIdPattern.test(lessonId) || !validateLessonProgress(progress)) {
      fail('invalid-schema', '単元の手動進捗またはチェック項目が不正です。')
    }
  }
  for (const [lessonId, position] of Object.entries(value.positions)) {
    if (!lessonIdPattern.test(lessonId) || !hasOnlyKeys(position, ['x', 'y'])
      || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      fail('invalid-schema', '学習マップの配置データが不正です。')
    }
  }
  return value
}

function checkByteLimit(text) {
  if (new TextEncoder().encode(text).byteLength > MAP_STATE_MAX_BYTES) {
    fail('too-large', '手動進捗の保存サイズが上限（64 KiB）を超えています。元の保存データは変更していません。')
  }
}

function objectiveChecks(previousObjectives, previousChecks, currentObjectives) {
  const next = currentObjectives.map(() => false)
  for (let nextIndex = 0; nextIndex < currentObjectives.length; nextIndex++) {
    const objective = currentObjectives[nextIndex]
    const oldMatches = previousObjectives.flatMap((item, index) => item === objective ? [index] : [])
    const newMatches = currentObjectives.filter((item) => item === objective).length
    if (oldMatches.length === 1 && newMatches === 1) next[nextIndex] = previousChecks[oldMatches[0]]
  }
  return next
}

export function createInitialMapState(registry) {
  return {
    schemaVersion: 1,
    curriculumRevision: registry.curriculumRevision,
    lessons: Object.fromEntries(registry.lessons.map((lesson) => [lesson.lessonId, {
      status: 'not-started',
      checks: lesson.learningObjectives.map(() => false),
      completedAt: null,
      lessonRevision: lesson.revision,
      objectives: [...lesson.learningObjectives],
    }])),
    positions: {},
  }
}

function migrateMapState(value, registry) {
  const lessons = { ...value.lessons }
  const changedLessonIds = []
  for (const lesson of registry.lessons) {
    const saved = lessons[lesson.lessonId]
    if (!saved) {
      lessons[lesson.lessonId] = {
        status: 'not-started', checks: lesson.learningObjectives.map(() => false), completedAt: null,
        lessonRevision: lesson.revision, objectives: [...lesson.learningObjectives],
      }
      continue
    }
    let checks = saved.checks
    if (saved.lessonRevision !== lesson.revision) {
      checks = lesson.learningObjectives.map(() => false)
      changedLessonIds.push(lesson.lessonId)
    } else if (saved.objectives.length !== lesson.learningObjectives.length
      || saved.objectives.some((objective, index) => objective !== lesson.learningObjectives[index])) {
      checks = objectiveChecks(saved.objectives, saved.checks, lesson.learningObjectives)
      changedLessonIds.push(lesson.lessonId)
    }
    lessons[lesson.lessonId] = {
      ...saved,
      checks: [...checks],
      lessonRevision: lesson.revision,
      objectives: [...lesson.learningObjectives],
    }
  }
  return {
    state: { ...value, curriculumRevision: registry.curriculumRevision, lessons },
    changedLessonIds,
  }
}

export function parseMapState(text, registry) {
  if (typeof text !== 'string') fail('invalid-json', '手動進捗のJSONを読み込めません。')
  checkByteLimit(text)
  let value
  try {
    value = JSON.parse(text)
  } catch {
    fail('invalid-json', '手動進捗のJSONを解析できません。')
  }
  return migrateMapState(validateMapState(value), registry)
}

export function serializeMapState(value) {
  validateMapState(value)
  const text = JSON.stringify(value)
  checkByteLimit(text)
  return text
}

export function readMapState(registry, getStorage = () => window.localStorage) {
  let storage
  try {
    storage = getStorage()
  } catch {
    return { status: 'unreadable', error: new MapStateError('storage-unavailable', '手動進捗を読み取れません。') }
  }
  let raw
  try {
    raw = storage.getItem(MAP_STATE_KEY)
  } catch {
    return { status: 'unreadable', error: new MapStateError('storage-unavailable', '手動進捗を読み取れません。') }
  }
  if (raw === null) return { status: 'missing', raw: null, state: createInitialMapState(registry), changedLessonIds: [] }
  try {
    const { state, changedLessonIds } = parseMapState(raw, registry)
    return {
      status: changedLessonIds.length || JSON.parse(raw).curriculumRevision !== registry.curriculumRevision ? 'migrated' : 'ok',
      raw, state, changedLessonIds,
    }
  } catch (error) {
    return { status: error instanceof MapStateError && error.code === 'unsupported-version' ? 'unsupported' : 'invalid', raw, error }
  }
}

export function saveMapState(value, expectedRaw, registry, getStorage = () => window.localStorage) {
  const raw = serializeMapState(value)
  let storage
  try {
    storage = getStorage()
  } catch {
    fail('storage-unavailable', '手動進捗を読み取れません。')
  }
  let current
  try {
    current = storage.getItem(MAP_STATE_KEY)
  } catch {
    fail('storage-unavailable', '手動進捗を読み取れません。')
  }
  if (current !== expectedRaw) fail('storage-changed', '別の画面で手動進捗が変更されました。再読み込みしてから操作してください。')
  if (current !== null) {
    const before = readMapState(registry, () => storage)
    if (before.status === 'invalid' || before.status === 'unsupported' || before.status === 'unreadable') throw before.error
  }
  // shortcut: compare-and-set is not atomic in localStorage; use transactional storage if strict multi-tab exclusion becomes required.
  try {
    storage.setItem(MAP_STATE_KEY, raw)
  } catch {
    fail('storage-write-failed', '手動進捗を保存できませんでした。既存データはそのままです。')
  }
  return { status: 'saved', state: value, raw }
}
