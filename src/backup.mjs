import {
  LOCAL_DATA_KEY, LOCAL_DATA_MAX_BYTES, LocalDataError, exportLocalData, importLocalData,
  parseLocalData, readLocalData, serializeLocalData,
} from './local-data.mjs'
import { lessonRegistry } from './lesson-registry.mjs'
import {
  MAP_STATE_KEY, MAP_STATE_MAX_BYTES, MapStateError, createInitialMapState, parseMapState, readMapState, serializeMapState,
} from './map-state.mjs'
import {
  LEARNING_STATE_KEY, LearningStateError, parseLearningState, readLearningState, serializeLearningState,
} from './learning-state.mjs'
import {
  PRACTICE_RESULTS_KEY, PracticeResultsError, parsePracticeResults, readPracticeResults,
  serializePracticeResults,
} from './practice-results.mjs'

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

export const LEARNING_BACKUP_FORMAT = 'sfqc-learning-backup'
export const LEARNING_RECOVERY_FORMAT = 'sfqc-learning-recovery-raw'
export const LEARNING_BACKUP_MAX_BYTES = 74_752
export const LEARNING_BACKUP_ENVELOPE_MAX_BYTES = 1_024

export class LearningBackupError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'LearningBackupError'
    this.code = code
  }
}

const learningStorageKeys = [
  { name: 'learningState', key: LEARNING_STATE_KEY },
  { name: 'practiceResults', key: PRACTICE_RESULTS_KEY },
]

function learningFail(code, message) {
  throw new LearningBackupError(code, message)
}

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength
}

function checkLearningBackupSize(text, learningState, practiceResults) {
  if (byteLength(text) > LEARNING_BACKUP_MAX_BYTES) learningFail('too-large', '統合バックアップのサイズが上限を超えています。')
  const overhead = byteLength(text) - byteLength(JSON.stringify(learningState)) - byteLength(JSON.stringify(practiceResults))
  if (overhead > LEARNING_BACKUP_ENVELOPE_MAX_BYTES) learningFail('too-large', '統合バックアップの外枠が上限を超えています。')
}

export function serializeLearningBackup(learningState, practiceResults, registry = lessonRegistry) {
  const normalizedLearningState = JSON.parse(serializeLearningState(learningState, registry))
  const normalizedPracticeResults = JSON.parse(serializePracticeResults(practiceResults))
  const text = JSON.stringify({
    format: LEARNING_BACKUP_FORMAT,
    version: 1,
    learningState: normalizedLearningState,
    practiceResults: normalizedPracticeResults,
  })
  checkLearningBackupSize(text, normalizedLearningState, normalizedPracticeResults)
  return text
}

export function parseLearningBackup(text, registry = lessonRegistry) {
  if (typeof text !== 'string') learningFail('invalid-json', '統合バックアップのJSONを読み込めません。')
  if (byteLength(text) > LEARNING_BACKUP_MAX_BYTES) learningFail('too-large', '統合バックアップのサイズが上限を超えています。')
  let value
  try { value = JSON.parse(text) } catch { learningFail('invalid-json', '統合バックアップのJSONを解析できません。') }
  if (!isRecord(value) || value.format !== LEARNING_BACKUP_FORMAT) {
    learningFail('invalid-schema', '新形式の統合バックアップではありません。')
  }
  if (value.version !== 1) {
    if (typeof value.version === 'number') learningFail('unsupported-version', '未対応の統合バックアップ形式です。')
    learningFail('invalid-schema', '統合バックアップの形式が不正です。')
  }
  if (!hasExactKeys(value, ['format', 'version', 'learningState', 'practiceResults'])) {
    learningFail('invalid-schema', '統合バックアップの形式が不正です。')
  }
  let learningState
  let practiceResults
  try {
    learningState = parseLearningState(JSON.stringify(value.learningState), registry).state
    practiceResults = parsePracticeResults(JSON.stringify(value.practiceResults))
    serializeLearningState(learningState, registry)
  } catch (error) {
    if (error instanceof LearningStateError || error instanceof PracticeResultsError) throw error
    learningFail('invalid-schema', '統合バックアップの形式が不正です。')
  }
  const canonical = JSON.stringify({
    format: LEARNING_BACKUP_FORMAT, version: 1, learningState, practiceResults,
  })
  checkLearningBackupSize(canonical, learningState, practiceResults)
  return { learningState, practiceResults }
}

function getLearningStorage(getStorageFactory) {
  try { return getStorageFactory() } catch { return null }
}

function readLearningPair(storage, registry) {
  return {
    learningState: readLearningState(registry, () => storage),
    practiceResults: readPracticeResults(() => storage),
  }
}

function pairIsReadable(pair) {
  return pair.learningState.status !== 'unreadable' && pair.practiceResults.status !== 'unreadable'
}

function pairRaws(pair) {
  if (!pairIsReadable(pair)) return null
  return { learningState: pair.learningState.raw, practiceResults: pair.practiceResults.raw }
}

function sameRawPair(left, right) {
  return left !== null && right !== null
    && left.learningState === right.learningState && left.practiceResults === right.practiceResults
}

function learningRecoveryRaw(rawPair) {
  return serializeLearningRecoveryRaw(rawPair.learningState, rawPair.practiceResults)
}

export function serializeLearningRecoveryRaw(learningRaw, practiceRaw) {
  if (!(learningRaw === null || typeof learningRaw === 'string')
    || !(practiceRaw === null || typeof practiceRaw === 'string')) {
    learningFail('invalid-schema', '復旧rawの値が不正です。')
  }
  return JSON.stringify({
    format: LEARNING_RECOVERY_FORMAT,
    version: 1,
    raw: { [LEARNING_STATE_KEY]: learningRaw, [PRACTICE_RESULTS_KEY]: practiceRaw },
  })
}

export function exportLearningBackup(getStorageFactory = () => window.localStorage, registry = lessonRegistry) {
  const storage = getLearningStorage(getStorageFactory)
  if (!storage) learningFail('storage-unavailable', '新形式の保存データを読み取れません。')
  const pair = readLearningPair(storage, registry)
  if (pair.learningState.status === 'invalid' || pair.learningState.status === 'unsupported'
    || pair.learningState.status === 'unreadable') throw pair.learningState.error
  if (pair.practiceResults.status === 'invalid' || pair.practiceResults.status === 'unsupported'
    || pair.practiceResults.status === 'unreadable') throw pair.practiceResults.error
  return serializeLearningBackup(pair.learningState.state, pair.practiceResults.results, registry)
}

function learningBackupSummary(pair, registry) {
  const state = pair.learningState
  const results = pair.practiceResults
  return {
    learningState: {
      status: state.status,
      completedLessons: state.state
        ? registry.lessons.filter((lesson) => state.state.lessons[lesson.lessonId]
          && state.state.lessons[lesson.lessonId].completedAt !== null).length : 0,
    },
    practiceResults: { status: results.status, records: results.results?.records.length ?? 0 },
  }
}

function pairHasDamagedData(pair) {
  return ['invalid', 'unsupported'].includes(pair.learningState.status)
    || ['invalid', 'unsupported'].includes(pair.practiceResults.status)
}

function latestResult(status, beforeRaw, candidateRaw, latest, recoveryRaw, extra = {}) {
  return { status, beforeRaw, candidateRaw, latest, ...(recoveryRaw ? { recoveryRaw } : {}), ...extra }
}

function makePending(beforeRaw, candidateRaw, attemptedKeys, cancelled = false, rollbackAttempted = false) {
  return { beforeRaw, candidateRaw, attemptedKeys: [...attemptedKeys], cancelled, rollbackAttempted }
}

function restoreLearningRaw(storage, key, raw) {
  if (raw === null) storage.removeItem(key)
  else storage.setItem(key, raw)
}

function currentRaw(pair) {
  return {
    learningState: pair.learningState.raw,
    practiceResults: pair.practiceResults.raw,
  }
}

function getRawAtStorage(storage, key) {
  try { return { readable: true, raw: storage.getItem(key) } } catch { return { readable: false } }
}

function recoveryOutcome(storage, beforeRaw, candidateRaw, registry, recoveryRaw, attemptedKeys, priorRollbackAttempted = false) {
  const latest = readLearningPair(storage, registry)
  if (!pairIsReadable(latest)) {
    const pending = makePending(beforeRaw, candidateRaw, attemptedKeys, false, priorRollbackAttempted)
    return latestResult('recovery-required', beforeRaw, candidateRaw, latest, recoveryRaw, { pending, rollbackAttempted: priorRollbackAttempted })
  }
  let rollbackAttempted = priorRollbackAttempted
  for (const { name, key } of [...learningStorageKeys].reverse()) {
    if (!attemptedKeys.includes(name) || beforeRaw[name] === candidateRaw[name]) continue
    const current = getRawAtStorage(storage, key)
    if (!current.readable) {
      const pending = makePending(beforeRaw, candidateRaw, attemptedKeys, false, rollbackAttempted)
      return latestResult('recovery-required', beforeRaw, candidateRaw, readLearningPair(storage, registry), recoveryRaw, { pending, rollbackAttempted })
    }
    if (current.raw !== candidateRaw[name]) continue
    rollbackAttempted = true
    try { restoreLearningRaw(storage, key, beforeRaw[name]) } catch { /* The verification below reports the partial restore. */ }
  }
  const confirmed = readLearningPair(storage, registry)
  const confirmedRaw = pairRaws(confirmed)
  const complete = sameRawPair(beforeRaw, confirmedRaw)
  const pending = makePending(beforeRaw, candidateRaw, attemptedKeys, false, rollbackAttempted)
  if (complete) {
    return latestResult(rollbackAttempted ? 'rolled-back' : 'not-applied', beforeRaw, candidateRaw, confirmed, recoveryRaw,
      { pending, rollbackAttempted })
  }
  return latestResult('recovery-required', beforeRaw, candidateRaw, confirmed, recoveryRaw, { pending, rollbackAttempted })
}

function validatePending(pending, registry) {
  if (!isRecord(pending) || !hasExactKeys(pending, ['beforeRaw', 'candidateRaw', 'attemptedKeys', 'cancelled', 'rollbackAttempted'])
    || !isRecord(pending.beforeRaw) || !isRecord(pending.candidateRaw)
    || !hasExactKeys(pending.beforeRaw, ['learningState', 'practiceResults'])
    || !hasExactKeys(pending.candidateRaw, ['learningState', 'practiceResults'])
    || !['learningState', 'practiceResults'].every((key) => pending.beforeRaw[key] === null || typeof pending.beforeRaw[key] === 'string')
    || !['learningState', 'practiceResults'].every((key) => typeof pending.candidateRaw[key] === 'string')
    || !Array.isArray(pending.attemptedKeys) || Reflect.ownKeys(pending.attemptedKeys).length !== pending.attemptedKeys.length + 1
    || !pending.attemptedKeys.every((key) => learningStorageKeys.some((item) => item.name === key))
    || typeof pending.cancelled !== 'boolean' || typeof pending.rollbackAttempted !== 'boolean') {
    learningFail('invalid-pending', 'バックアップ復元の再確認情報が不正です。')
  }
  parseLearningState(pending.candidateRaw.learningState, registry)
  parsePracticeResults(pending.candidateRaw.practiceResults)
  return pending
}

export function recheckLearningBackupImport(pending, registry = lessonRegistry, getStorageFactory = () => window.localStorage) {
  validatePending(pending, registry)
  const storage = getLearningStorage(getStorageFactory)
  const recoveryRaw = learningRecoveryRaw(pending.beforeRaw)
  if (!storage) {
    const latest = readLearningPair(null, registry)
    return latestResult(pending.rollbackAttempted ? 'recovery-required' : 'unknown', pending.beforeRaw, pending.candidateRaw,
      latest, recoveryRaw, { pending, rollbackAttempted: pending.rollbackAttempted })
  }
  const latest = readLearningPair(storage, registry)
  if (!pairIsReadable(latest)) {
    return latestResult(pending.rollbackAttempted ? 'recovery-required' : 'unknown', pending.beforeRaw, pending.candidateRaw,
      latest, recoveryRaw, { pending, rollbackAttempted: pending.rollbackAttempted })
  }
  const raw = currentRaw(latest)
  const classification = Object.fromEntries(learningStorageKeys.map(({ name }) => [name,
    pending.beforeRaw[name] === pending.candidateRaw[name] && raw[name] === pending.beforeRaw[name] ? 'unchanged'
      : raw[name] === pending.beforeRaw[name] ? 'before'
        : raw[name] === pending.candidateRaw[name] ? 'candidate' : 'other']))
  const unchangedOrBefore = Object.values(classification).every((state) => state === 'unchanged' || state === 'before')
  const unchangedOrCandidate = Object.values(classification).every((state) => state === 'unchanged' || state === 'candidate')
  if (unchangedOrBefore) {
    const status = pending.cancelled ? 'cancelled' : pending.rollbackAttempted ? 'rolled-back' : 'not-applied'
    return latestResult(status, pending.beforeRaw, pending.candidateRaw, latest, recoveryRaw,
      { pending, rollbackAttempted: pending.rollbackAttempted })
  }
  if (unchangedOrCandidate) {
    if (pending.cancelled || pending.attemptedKeys.length === 0) {
      return latestResult('conflict', pending.beforeRaw, pending.candidateRaw, latest, recoveryRaw,
        { pending, rollbackAttempted: pending.rollbackAttempted })
    }
    return latestResult('imported', pending.beforeRaw, pending.candidateRaw, latest, recoveryRaw,
      { learningState: latest.learningState.state, practiceResults: latest.practiceResults.results,
        pending, rollbackAttempted: pending.rollbackAttempted })
  }
  if (pending.cancelled) {
    return latestResult('conflict', pending.beforeRaw, pending.candidateRaw, latest, recoveryRaw,
      { pending, rollbackAttempted: pending.rollbackAttempted })
  }
  if (pending.rollbackAttempted) {
    return latestResult('recovery-required', pending.beforeRaw, pending.candidateRaw, latest, recoveryRaw,
      { pending, rollbackAttempted: true })
  }
  return recoveryOutcome(storage, pending.beforeRaw, pending.candidateRaw, registry, recoveryRaw,
    learningStorageKeys.filter(({ name }) => classification[name] === 'candidate' && pending.attemptedKeys.includes(name))
      .map(({ name }) => name), false)
}

export async function importLearningBackup(file, confirmReplacement, {
  getStorage: getStorageFactory = () => window.localStorage,
  registry = lessonRegistry,
  requestRecoveryDownload,
  confirmRecovery,
} = {}) {
  if (file.size > LEARNING_BACKUP_MAX_BYTES) learningFail('too-large', '選択したJSONが上限を超えています。')
  let text
  try { text = await file.text() } catch { learningFail('file-read-failed', '選択したファイルを読み込めませんでした。') }
  const imported = parseLearningBackup(text, registry)
  const candidateRaw = {
    learningState: serializeLearningState(imported.learningState, registry),
    practiceResults: serializePracticeResults(imported.practiceResults),
  }
  const storage = getLearningStorage(getStorageFactory)
  if (!storage) return latestResult('not-applied', null, candidateRaw, readLearningPair(null, registry), null,
    { error: new LearningBackupError('storage-unavailable', '新形式の保存データを読み取れません。') })
  const before = readLearningPair(storage, registry)
  if (!pairIsReadable(before)) {
    return latestResult('not-applied', null, candidateRaw, before, null,
      { error: new LearningBackupError('storage-unavailable', '新形式の保存データを読み取れないため、復元を中止しました。') })
  }
  const beforeRaw = pairRaws(before)
  const recoveryRaw = learningRecoveryRaw(beforeRaw)
  const confirmation = { existing: learningBackupSummary(before, registry), imported: {
    learningState: { completedLessons: registry.lessons.filter((lesson) => imported.learningState.lessons[lesson.lessonId]
      && imported.learningState.lessons[lesson.lessonId].completedAt !== null).length },
    practiceResults: { records: imported.practiceResults.records.length },
  } }
  let replace = false
  try { replace = await confirmReplacement(confirmation) === true } catch { replace = false }
  if (!replace) {
    const pending = makePending(beforeRaw, candidateRaw, [], true)
    const latest = readLearningPair(storage, registry)
    if (!pairIsReadable(latest)) return latestResult('unknown', beforeRaw, candidateRaw, latest, recoveryRaw, { pending })
    return latestResult(sameRawPair(beforeRaw, pairRaws(latest)) ? 'cancelled' : 'conflict', beforeRaw, candidateRaw, latest, recoveryRaw, { pending })
  }
  if (pairHasDamagedData(before)) {
    let preserved = false
    try { preserved = await requestRecoveryDownload?.(recoveryRaw) === true } catch { preserved = false }
    if (!preserved) return latestResult('not-applied', beforeRaw, candidateRaw, readLearningPair(storage, registry), recoveryRaw,
      { error: new LearningBackupError('recovery-download-failed', '元データの保全ファイルを作成できなかったため、復元を中止しました。') })
    let recoveryConfirmed = false
    try { recoveryConfirmed = await confirmRecovery?.() === true } catch { recoveryConfirmed = false }
    if (!recoveryConfirmed) {
      const pending = makePending(beforeRaw, candidateRaw, [], true)
      const latest = readLearningPair(storage, registry)
      if (!pairIsReadable(latest)) return latestResult('unknown', beforeRaw, candidateRaw, latest, recoveryRaw, { pending })
      return latestResult(sameRawPair(beforeRaw, pairRaws(latest)) ? 'cancelled' : 'conflict', beforeRaw, candidateRaw, latest, recoveryRaw, { pending })
    }
  }

  const attemptedKeys = []
  const expectedCurrent = { ...beforeRaw }
  for (const { name, key } of learningStorageKeys) {
    if (beforeRaw[name] === candidateRaw[name]) continue
    const latest = readLearningPair(storage, registry)
    if (!pairIsReadable(latest)) {
      if (attemptedKeys.length) return recoveryOutcome(storage, beforeRaw, candidateRaw, registry, recoveryRaw, attemptedKeys)
      return latestResult('not-applied', beforeRaw, candidateRaw, latest, recoveryRaw)
    }
    if (!sameRawPair(expectedCurrent, pairRaws(latest))) {
      if (attemptedKeys.length) return recoveryOutcome(storage, beforeRaw, candidateRaw, registry, recoveryRaw, attemptedKeys)
      return latestResult('conflict', beforeRaw, candidateRaw, latest, recoveryRaw)
    }
    attemptedKeys.push(name)
    // shortcut: localStorage cannot atomically compare both keys and write either one; use a transactional store for strict multi-tab exclusion.
    try { storage.setItem(key, candidateRaw[name]) } catch {
      return recoveryOutcome(storage, beforeRaw, candidateRaw, registry, recoveryRaw, attemptedKeys)
    }
    expectedCurrent[name] = candidateRaw[name]
  }

  const saved = readLearningPair(storage, registry)
  if (!pairIsReadable(saved)) {
    const pending = makePending(beforeRaw, candidateRaw, attemptedKeys)
    return latestResult('unknown', beforeRaw, candidateRaw, saved, recoveryRaw, { pending, rollbackAttempted: false })
  }
  if (!sameRawPair(candidateRaw, pairRaws(saved))) {
    return recoveryOutcome(storage, beforeRaw, candidateRaw, registry, recoveryRaw, attemptedKeys)
  }
  return latestResult('imported', beforeRaw, candidateRaw, saved, recoveryRaw,
    { learningState: saved.learningState.state, practiceResults: saved.practiceResults.results })
}
