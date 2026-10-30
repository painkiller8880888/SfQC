import {
  LOCAL_DATA_KEY, LOCAL_DATA_MAX_BYTES, LocalDataError, exportLocalData, importLocalData,
  parseLocalData, readLocalData, serializeLocalData,
} from './local-data.mjs'
import { lessonRegistry } from './lesson-registry.mjs'
import {
  MAP_STATE_KEY, MAP_STATE_MAX_BYTES, MapStateError, createInitialMapState, parseMapState, readMapState, serializeMapState,
} from './map-state.mjs'

export const RECOVERY_FORMAT = 'sfqc-recovery-raw'
export const BACKUP_ENVELOPE_MAX_BYTES = 1_024
export const BACKUP_MAX_BYTES = LOCAL_DATA_MAX_BYTES + MAP_STATE_MAX_BYTES + BACKUP_ENVELOPE_MAX_BYTES

function fail(code, message) {
  throw new LocalDataError(code, message)
}

function checkBackupSize(text) {
  if (new TextEncoder().encode(text).byteLength > BACKUP_MAX_BYTES) {
    fail('too-large', '統合バックアップのサイズが上限を超えています。保存データは変更していません。')
  }
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

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    fail('invalid-json', 'JSONを解析できません。ファイルの内容を確認してください。')
  }
}

export function serializeBackup(localData, mapState) {
  const normalizedLocalData = JSON.parse(serializeLocalData(localData))
  const normalizedMapState = JSON.parse(serializeMapState(mapState))
  const text = JSON.stringify({
    format: 'sfqc-backup',
    schemaVersion: 1,
    localData: normalizedLocalData,
    mapState: normalizedMapState,
  })
  checkBackupSize(text)
  return text
}

export function parseBackup(text, registry = lessonRegistry) {
  if (typeof text !== 'string') fail('invalid-json', 'JSONを読み込めません。')
  checkBackupSize(text)
  const value = parseJson(text)
  if (!isRecord(value) || value.format !== 'sfqc-backup') {
    return { kind: 'legacy', data: parseLocalData(text) }
  }
  if (value.schemaVersion !== 1) fail('unsupported-version', '未対応の統合バックアップ形式です。')
  if (!hasExactKeys(value, ['format', 'schemaVersion', 'localData', 'mapState'])) {
    fail('invalid-schema', '統合バックアップの形式が不正です。')
  }
  if (!isRecord(value.localData) || value.localData.schemaVersion !== 2) {
    fail('invalid-schema', '統合バックアップの演習記録はschemaVersion 2である必要があります。')
  }
  const data = parseLocalData(JSON.stringify(value.localData))
  const { state, changedLessonIds } = parseMapState(JSON.stringify(value.mapState), registry)
  return { kind: 'backup', data, mapState: state, changedLessonIds }
}

export function exportBackup(getStorage = () => window.localStorage, registry = lessonRegistry) {
  let storage
  try { storage = getStorage() } catch { fail('storage-unavailable', '保存データを読み取れません。') }
  const { local, map } = snapshot(storage, registry)
  if (local.status === 'invalid' || local.status === 'unreadable') throw local.error
  if (map.status === 'invalid' || map.status === 'unsupported' || map.status === 'unreadable') throw map.error
  return serializeBackup(local.data, map.state)
}

export function serializeRecoveryRaw(localRaw, mapRaw) {
  return JSON.stringify({
    format: RECOVERY_FORMAT,
    schemaVersion: 1,
    raw: { [LOCAL_DATA_KEY]: localRaw, [MAP_STATE_KEY]: mapRaw },
  })
}

function rawPair(storage) {
  try {
    return { localRaw: storage.getItem(LOCAL_DATA_KEY), mapRaw: storage.getItem(MAP_STATE_KEY) }
  } catch {
    fail('storage-unavailable', '両方の保存データを読み取れないため、復元を中止しました。')
  }
}

function samePair(left, right) {
  return left.localRaw === right.localRaw && left.mapRaw === right.mapRaw
}

function statusOfLocal(state) {
  if (state.status === 'invalid') return state.error?.code === 'unsupported-version' ? 'unsupported' : 'damaged'
  if (state.status === 'unreadable') return 'unreadable'
  return state.status
}

function statusOfMap(state) {
  return state.status === 'invalid' ? 'damaged' : state.status
}

function snapshot(storage, registry) {
  const raw = rawPair(storage)
  let local
  if (raw.localRaw === null) {
    local = { status: 'missing', raw: null, data: parseLocalData('{"schemaVersion":2,"questionInstances":[],"answerAttempts":[],"reviewEvents":[]}') }
  } else {
    try {
      local = { status: 'ok', raw: raw.localRaw, data: parseLocalData(raw.localRaw) }
    } catch (error) {
      local = { status: 'invalid', raw: raw.localRaw, error }
    }
  }
  let map
  if (raw.mapRaw === null) {
    map = { status: 'missing', raw: null, state: createInitialMapState(registry), changedLessonIds: [] }
  } else {
    try {
      const result = parseMapState(raw.mapRaw, registry)
      map = { status: result.changedLessonIds.length || JSON.parse(raw.mapRaw).curriculumRevision !== registry.curriculumRevision ? 'migrated' : 'ok', raw: raw.mapRaw, ...result }
    } catch (error) {
      map = { status: error instanceof MapStateError && error.code === 'unsupported-version' ? 'unsupported' : 'invalid', raw: raw.mapRaw, error }
    }
  }
  return { ...raw, local, map }
}

function counts(data) {
  return {
    questionInstances: data.questionInstances.length,
    answerAttempts: data.answerAttempts.length,
    reviewEvents: data.reviewEvents.length,
  }
}

function completedCount(mapState, registry) {
  return registry.lessons.reduce((count, lesson) => count + (mapState.lessons[lesson.lessonId]?.status === 'completed' ? 1 : 0), 0)
}

function restoreRaw(storage, key, raw) {
  if (raw === null) storage.removeItem(key)
  else storage.setItem(key, raw)
}

async function sendRecovery(snapshotState, requestRecoveryDownload) {
  if (!requestRecoveryDownload) return false
  try {
    return (await requestRecoveryDownload(serializeRecoveryRaw(snapshotState.localRaw, snapshotState.mapRaw))) === true
  } catch {
    return false
  }
}

export async function importBackup(file, confirmReplacement, {
  getStorage = () => window.localStorage,
  registry = lessonRegistry,
  requestRecoveryDownload,
  confirmRecovery,
} = {}) {
  if (file.size > BACKUP_MAX_BYTES) fail('too-large', '選択したJSONが上限を超えています。')
  let text
  try {
    text = await file.text()
  } catch {
    fail('file-read-failed', '選択したファイルを読み込めませんでした。')
  }
  const parsed = parseBackup(text, registry)
  let storage
  try {
    storage = getStorage()
  } catch {
    fail('storage-unavailable', '保存データを読み取れないため、復元を中止しました。')
  }

  if (parsed.kind === 'legacy') {
    const result = await importLocalData({ size: new TextEncoder().encode(text).byteLength, text: async () => text },
      (state) => confirmReplacement({ kind: 'legacy', ...state }), () => storage)
    return { ...result, kind: 'legacy' }
  }

  const before = snapshot(storage, registry)
  const existing = {
    localData: {
      status: statusOfLocal(before.local),
      counts: before.local.status === 'ok' || before.local.status === 'legacy' ? counts(before.local.data) : { questionInstances: 0, answerAttempts: 0, reviewEvents: 0 },
    },
    mapState: {
      status: statusOfMap(before.map),
      completedLessons: before.map.status === 'ok' || before.map.status === 'migrated'
        ? completedCount(before.map.state, registry) : 0,
    },
  }
  const imported = {
    localData: counts(parsed.data),
    mapState: { completedLessons: completedCount(parsed.mapState, registry) },
  }
  if (!await confirmReplacement({ kind: 'backup', existing, imported })) return { status: 'cancelled' }

  const damaged = ['damaged', 'unsupported'].includes(existing.localData.status)
    || ['damaged', 'unsupported'].includes(existing.mapState.status)
  if (damaged) {
    if (!await sendRecovery(before, requestRecoveryDownload)) {
      fail('recovery-download-failed', '元データの保全ファイルを書き出せなかったため、復元を中止しました。')
    }
    if (!confirmRecovery || !await confirmRecovery()) return { status: 'cancelled', phase: 'recovery' }
  }

  const current = rawPair(storage)
  if (!samePair(before, current)) fail('storage-changed', '確認後に保存データが変更されたため、統合復元を中止しました。')

  const nextMapRaw = serializeMapState(parsed.mapState)
  const nextLocalRaw = serializeLocalData(parsed.data)
  const writes = [
    { key: MAP_STATE_KEY, before: before.mapRaw, next: nextMapRaw },
    { key: LOCAL_DATA_KEY, before: before.localRaw, next: nextLocalRaw },
  ]
  const written = []
  let failure = null
  try {
    for (const write of writes) {
      // shortcut: the two localStorage keys cannot be committed atomically; use a transactional store if cross-key atomicity becomes required.
      let actual
      try { actual = storage.getItem(write.key) } catch { fail('storage-unavailable', '保存前の再確認に失敗したため、復元を中止しました。') }
      if (actual !== write.before) fail('storage-changed', '復元中に保存データが変更されたため、処理を中止しました。')
      try { storage.setItem(write.key, write.next) } catch { fail('storage-write-failed', '統合バックアップを保存できませんでした。復元を取り消します。') }
      written.push(write)
    }
  } catch (error) {
    failure = error
  }

  if (failure) {
    let rollbackComplete = true
    for (const write of written.reverse()) {
      try {
        if (storage.getItem(write.key) === write.next) restoreRaw(storage, write.key, write.before)
        else rollbackComplete = false
      } catch {
        rollbackComplete = false
      }
    }
    const currentLocalData = readLocalData(() => storage)
    const currentMapState = readMapState(registry, () => storage)
    const cannotVerify = currentLocalData.status === 'unreadable' || currentMapState.status === 'unreadable'
    if (!rollbackComplete || cannotVerify) {
      failure.recoveryDownloadFailed = !await sendRecovery(before, requestRecoveryDownload)
      failure.recoveryRequired = true
    }
    failure.currentLocalData = currentLocalData
    failure.currentMapState = currentMapState
    throw failure
  }

  const savedLocal = readLocalData(() => storage)
  const savedMap = readMapState(registry, () => storage)
  if (savedLocal.status === 'invalid' || savedLocal.status === 'unreadable'
    || savedMap.status === 'invalid' || savedMap.status === 'unsupported' || savedMap.status === 'unreadable') {
    const error = new LocalDataError('storage-unavailable', '保存後の再確認ができません。データ管理画面で状態を確認してください。')
    error.recoveryRequired = true
    error.recoveryDownloadFailed = !await sendRecovery(before, requestRecoveryDownload)
    error.currentLocalData = savedLocal
    error.currentMapState = savedMap
    throw error
  }
  if (savedLocal.raw !== nextLocalRaw || savedMap.raw !== nextMapRaw) {
    const error = new LocalDataError('storage-changed', '保存後の確認で別の画面による更新を検出しました。最新の値を読み直してください。')
    error.currentLocalData = savedLocal
    error.currentMapState = savedMap
    throw error
  }
  return {
    status: 'imported', kind: 'backup',
    data: savedLocal.data, raw: savedLocal.raw,
    mapState: savedMap.state, mapRaw: savedMap.raw,
    changedLessonIds: parsed.changedLessonIds,
  }
}

export function exportLegacyLocalData(getStorage = () => window.localStorage) {
  return exportLocalData(getStorage)
}
