import { LEARNING_STATE_KEY, LearningStateError, parseLearningState, readLearningState, serializeLearningState } from './learning-state.mjs'
import { PRACTICE_RESULTS_KEY, PracticeResultsError, parsePracticeResults, readPracticeResults, serializePracticeResults } from './practice-results.mjs'
import { lessonRegistry } from './lesson-registry.mjs'

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
