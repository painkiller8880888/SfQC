import { restoreQuestionInstance } from './question-contract.mjs'

export const LOCAL_DATA_KEY = 'sfqc:local-data'
export const LOCAL_DATA_MAX_BYTES = 1_048_576
export const LOCAL_DATA_MAX_INSTANCES = 500

export class LocalDataError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'LocalDataError'
    this.code = code
  }
}

function fail(code, message) {
  throw new LocalDataError(code, message)
}

function checkByteLimit(text) {
  if (new TextEncoder().encode(text).byteLength > LOCAL_DATA_MAX_BYTES) {
    fail('too-large', 'JSONのサイズが上限（1 MiB）を超えています。')
  }
}

function restoreData(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || Reflect.ownKeys(value).length !== 2
    || !Object.hasOwn(value, 'schemaVersion')
    || !Object.hasOwn(value, 'questionInstances')) {
    fail('invalid-schema', 'データ形式が不正です。')
  }
  if (value.schemaVersion !== 1) {
    if (typeof value.schemaVersion === 'number') {
      fail('unsupported-version', `未対応のデータ形式です（schemaVersion: ${value.schemaVersion}）。`)
    }
    fail('invalid-schema', 'データ形式が不正です。')
  }
  if (!Array.isArray(value.questionInstances)) {
    fail('invalid-schema', '出題snapshotの配列が不正です。')
  }
  if (value.questionInstances.length > LOCAL_DATA_MAX_INSTANCES) {
    fail('too-many-instances', '出題snapshotの件数が上限（500件）を超えています。')
  }

  const ids = new Set()
  for (const instance of value.questionInstances) {
    if (instance === null || typeof instance !== 'object' || Array.isArray(instance)
      || typeof instance.instanceId !== 'string' || ids.has(instance.instanceId)) {
      fail('invalid-schema', '出題snapshotの形式またはIDが不正です。')
    }
    ids.add(instance.instanceId)
  }

  try {
    return Object.freeze({
      schemaVersion: 1,
      questionInstances: Object.freeze(value.questionInstances.map(restoreQuestionInstance)),
    })
  } catch {
    fail('invalid-schema', '出題snapshotの形式が不正です。')
  }
}

export function parseLocalData(text) {
  if (typeof text !== 'string') fail('invalid-json', 'JSONを読み込めません。')
  checkByteLimit(text)
  let value
  try {
    value = JSON.parse(text)
  } catch {
    fail('invalid-json', 'JSONを解析できません。ファイルの内容を確認してください。')
  }
  return restoreData(value)
}

export function serializeLocalData(value) {
  let data
  try {
    data = restoreData(value)
  } catch (error) {
    if (error instanceof LocalDataError) throw error
    fail('invalid-schema', 'データ形式が不正です。')
  }
  const text = JSON.stringify(data)
  checkByteLimit(text)
  return text
}

function emptyData() {
  return Object.freeze({ schemaVersion: 1, questionInstances: Object.freeze([]) })
}

function readStorage(storage) {
  let raw
  try {
    raw = storage.getItem(LOCAL_DATA_KEY)
  } catch {
    return { status: 'unreadable', error: new LocalDataError('storage-unavailable', 'ブラウザ内の保存データを読み取れません。') }
  }
  if (raw === null) return { status: 'missing', raw: null, data: emptyData() }
  try {
    return { status: 'ok', raw, data: parseLocalData(raw) }
  } catch (error) {
    return { status: 'invalid', raw, error }
  }
}

export function readLocalData(getStorage = () => window.localStorage) {
  try {
    return readStorage(getStorage())
  } catch {
    return { status: 'unreadable', error: new LocalDataError('storage-unavailable', 'ブラウザ内の保存データを読み取れません。') }
  }
}

export function exportLocalData(getStorage = () => window.localStorage) {
  const state = readLocalData(getStorage)
  if (state.status === 'invalid' || state.status === 'unreadable') throw state.error
  return serializeLocalData(state.data)
}

export async function importLocalData(file, confirmReplacement, getStorage = () => window.localStorage) {
  if (file.size > LOCAL_DATA_MAX_BYTES) {
    fail('too-large', 'JSONのサイズが上限（1 MiB）を超えています。')
  }

  let data
  try {
    data = parseLocalData(await file.text())
  } catch (error) {
    if (error instanceof LocalDataError) throw error
    fail('file-read-failed', '選択したファイルを読み込めませんでした。')
  }
  const raw = serializeLocalData(data)

  let storage
  try {
    storage = getStorage()
  } catch {
    fail('storage-unavailable', 'ブラウザ内の保存データを読み取れません。')
  }
  const before = readStorage(storage)
  if (before.status === 'unreadable') throw before.error
  if (before.status !== 'missing') {
    const replace = await confirmReplacement({
      damaged: before.status === 'invalid',
      existingCount: before.status === 'ok' ? before.data.questionInstances.length : undefined,
    })
    if (!replace) return { status: 'cancelled' }
  }

  const current = readStorage(storage)
  if (current.status === 'unreadable') throw current.error
  if (current.status !== before.status || current.raw !== before.raw) {
    fail('storage-changed', '確認中に保存データが変更されたため、復元を中止しました。最新の内容を確認してからやり直してください。')
  }
  try {
    storage.setItem(LOCAL_DATA_KEY, raw)
  } catch {
    fail('storage-write-failed', 'ブラウザ内への保存に失敗しました。既存データはそのままです。')
  }
  return { status: 'imported', data, raw }
}
