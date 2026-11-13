export const PRACTICE_RESULTS_KEY = 'sfqc:practice-results:v1'
export const PRACTICE_RESULTS_MAX_BYTES = 8_192
export const PRACTICE_RESULTS_MAX_RECORDS = 25
export const PRACTICE_CATEGORY_IDS = Object.freeze([
  'mean-deviation', 'data-transformation', 'unbiased-variance', 'comprehensive', 'variance-standard-deviation',
])

const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u

export class PracticeResultsError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'PracticeResultsError'
    this.code = code
  }
}

function fail(code, message) {
  throw new PracticeResultsError(code, message)
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

function isDenseArray(value) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype
    && Reflect.ownKeys(value).length === value.length + 1
    && Array.from({ length: value.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      return descriptor?.enumerable === true && 'value' in descriptor && descriptor.value !== undefined
    }).every(Boolean)
}

function isTimestamp(value) {
  if (typeof value !== 'string' || !timestampPattern.test(value)) return false
  try { return new Date(value).toISOString() === value } catch { return false }
}

function checkSize(text) {
  if (new TextEncoder().encode(text).byteLength > PRACTICE_RESULTS_MAX_BYTES) {
    fail('too-large', '演習判定の保存サイズが上限（8 KiB）を超えています。')
  }
}

function validate(value) {
  if (!isRecord(value)) fail('invalid-schema', '演習判定の保存形式が不正です。')
  if (value.schemaVersion !== 1) {
    if (typeof value.schemaVersion === 'number') fail('unsupported-version', '未対応の演習判定形式です。')
    fail('invalid-schema', '演習判定の保存形式が不正です。')
  }
  if (!hasExactKeys(value, ['schemaVersion', 'records']) || !isDenseArray(value.records)
    || value.records.length > PRACTICE_RESULTS_MAX_RECORDS) {
    fail('invalid-schema', '演習判定の保存形式または件数が不正です。')
  }
  const records = value.records.map((record) => {
    if (!hasExactKeys(record, ['categoryId', 'isCorrect', 'attemptedAt'])
      || !PRACTICE_CATEGORY_IDS.includes(record.categoryId)
      || typeof record.isCorrect !== 'boolean' || !isTimestamp(record.attemptedAt)) {
      fail('invalid-schema', '演習判定の形式、カテゴリ、日時が不正です。')
    }
    return { categoryId: record.categoryId, isCorrect: record.isCorrect, attemptedAt: record.attemptedAt }
  })
  return { schemaVersion: 1, records }
}

function initialResults() {
  return { schemaVersion: 1, records: [] }
}

export function parsePracticeResults(text) {
  if (typeof text !== 'string') fail('invalid-json', '演習判定のJSONを読み込めません。')
  checkSize(text)
  let value
  try { value = JSON.parse(text) } catch { fail('invalid-json', '演習判定のJSONを解析できません。') }
  try { return validate(value) } catch (error) {
    if (error instanceof PracticeResultsError) throw error
    fail('invalid-schema', '演習判定の保存形式が不正です。')
  }
}

export function serializePracticeResults(value) {
  try {
    const text = JSON.stringify(validate(value))
    checkSize(text)
    return text
  } catch (error) {
    if (error instanceof PracticeResultsError) throw error
    fail('invalid-schema', '演習判定の保存形式が不正です。')
  }
}

function readFromStorage(storage) {
  let raw
  try { raw = storage.getItem(PRACTICE_RESULTS_KEY) } catch {
    return { status: 'unreadable', error: new PracticeResultsError('storage-unavailable', '演習判定を読み取れません。') }
  }
  if (raw === null) return { status: 'missing', raw: null, results: initialResults() }
  if (typeof raw !== 'string') return { status: 'invalid', error: new PracticeResultsError('invalid-schema', '演習判定の保存形式が不正です。') }
  try { return { status: 'ok', raw, results: parsePracticeResults(raw) } } catch (error) {
    const normalized = error instanceof PracticeResultsError ? error : new PracticeResultsError('invalid-schema', '演習判定の保存形式が不正です。')
    return { status: normalized.code === 'unsupported-version' ? 'unsupported' : 'invalid', raw, error: normalized }
  }
}

function getStorageSafely(getStorageFactory) {
  try { return getStorageFactory() } catch { return null }
}

export function readPracticeResults(getStorageFactory = () => window.localStorage) {
  const storage = getStorageSafely(getStorageFactory)
  return storage
    ? readFromStorage(storage)
    : { status: 'unreadable', error: new PracticeResultsError('storage-unavailable', '演習判定を読み取れません。') }
}

function result(status, expectedRaw, candidateRaw, latest, record, error) {
  return { status, expectedRaw, candidateRaw, latest, ...(record ? { record } : {}), ...(error ? { error } : {}) }
}

export function appendPracticeResult(input, expectedRaw, getStorageFactory = () => window.localStorage) {
  let validInput = false
  try {
    validInput = hasExactKeys(input, ['categoryId', 'isCorrect']) && PRACTICE_CATEGORY_IDS.includes(input.categoryId)
      && typeof input.isCorrect === 'boolean'
  } catch { /* Treat hostile objects like any other malformed input. */ }
  if (!validInput) {
    const latest = readPracticeResults(getStorageFactory)
    return result('not-written', expectedRaw, null, latest, null,
      new PracticeResultsError('invalid-schema', '追加する演習判定が不正です。'))
  }
  if (expectedRaw !== null && typeof expectedRaw !== 'string') {
    const latest = readPracticeResults(getStorageFactory)
    return result('not-written', null, null, latest, null,
      new PracticeResultsError('invalid-schema', '保存前の演習判定を特定できません。'))
  }
  let baseline
  try { baseline = expectedRaw === null ? initialResults() : parsePracticeResults(expectedRaw) } catch (error) {
    return result('not-written', expectedRaw, null, readPracticeResults(getStorageFactory), null, error)
  }
  const record = { categoryId: input.categoryId, isCorrect: input.isCorrect, attemptedAt: new Date().toISOString() }
  const candidateResults = {
    schemaVersion: 1,
    records: [...baseline.records, record].slice(-PRACTICE_RESULTS_MAX_RECORDS),
  }
  let candidateRaw
  try { candidateRaw = serializePracticeResults(candidateResults) } catch (error) {
    return result('not-written', expectedRaw, null, readPracticeResults(getStorageFactory), record, error)
  }
  const storage = getStorageSafely(getStorageFactory)
  if (!storage) return result('not-written', expectedRaw, candidateRaw, readPracticeResults(() => { throw new Error() }), record,
    new PracticeResultsError('storage-unavailable', '演習判定を読み取れません。'))
  const latest = readFromStorage(storage)
  if (latest.status === 'unreadable') return result('not-written', expectedRaw, candidateRaw, latest, record, latest.error)
  if (latest.raw !== expectedRaw) return result('conflict', expectedRaw, candidateRaw, latest, record)
  if (latest.status === 'invalid' || latest.status === 'unsupported') return result('not-written', expectedRaw, candidateRaw, latest, record, latest.error)
  try { storage.setItem(PRACTICE_RESULTS_KEY, candidateRaw) } catch {
    const after = readFromStorage(storage)
    if (after.status === 'unreadable') return result('unknown', expectedRaw, candidateRaw, after, record, after.error)
    if (after.status === 'ok' && after.raw === candidateRaw) return result('saved', expectedRaw, candidateRaw, after, record)
    if (after.raw !== expectedRaw) return result('conflict', expectedRaw, candidateRaw, after, record)
    return result('not-written', expectedRaw, candidateRaw, after, record,
      new PracticeResultsError('storage-write-failed', '演習判定を保存できませんでした。'))
  }
  const confirmed = readFromStorage(storage)
  if (confirmed.status === 'unreadable') return result('unknown', expectedRaw, candidateRaw, confirmed, record, confirmed.error)
  if (confirmed.raw !== candidateRaw) return result('conflict', expectedRaw, candidateRaw, confirmed, record)
  return result('saved', expectedRaw, candidateRaw, confirmed, record)
}

export function recheckPracticeResult(pending, getStorageFactory = () => window.localStorage) {
  const latest = readPracticeResults(getStorageFactory)
  let validPending = false
  try {
    if (pending?.status === 'unknown'
      && (typeof pending.expectedRaw === 'string' || pending.expectedRaw === null)
      && typeof pending.candidateRaw === 'string' && pending.record) {
      const record = validate({ schemaVersion: 1, records: [pending.record] }).records[0]
      const baseline = pending.expectedRaw === null ? initialResults() : parsePracticeResults(pending.expectedRaw)
      const expected = { schemaVersion: 1, records: [...baseline.records, record].slice(-PRACTICE_RESULTS_MAX_RECORDS) }
      validPending = serializePracticeResults(expected) === pending.candidateRaw
        && JSON.stringify(expected.records.at(-1)) === JSON.stringify(record)
    }
  } catch { validPending = false }
  if (!validPending) {
    return result('not-written', pending?.expectedRaw ?? null, null, latest, null,
      new PracticeResultsError('invalid-schema', '再確認する演習判定が不正です。'))
  }
  if (latest.status === 'unreadable') return result('unknown', pending.expectedRaw, pending.candidateRaw, latest, pending.record, latest.error)
  if (latest.raw === pending.candidateRaw) return result('saved', pending.expectedRaw, pending.candidateRaw, latest, pending.record)
  return result('conflict', pending.expectedRaw, pending.candidateRaw, latest, pending.record)
}
