import { parseLessonRef } from './lesson-contract.mjs'
import { restoreQuestionInstance } from './question-contract.mjs'
import { gradeQuestionAnswer } from './question-grading.mjs'

export const LOCAL_DATA_KEY = 'sfqc:local-data'
export const LOCAL_DATA_MAX_BYTES = 2_097_152
export const LOCAL_DATA_MAX_INSTANCES = 500

const instanceKeys = ['questionInstances']
const appendOnlyKeys = ['questionInstances', 'answerAttempts', 'reviewEvents']
const answerKeys = ['attemptId', 'instanceId', 'answer', 'gradingResult', 'attemptedAt']
const reviewKeys = ['reviewEventId', 'targetRef', 'sourceAttemptId', 'reviewedAt']
const decimalPattern = /^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?$/u
const utcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u

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
    fail('too-large', 'JSONのサイズが上限（2 MiB）を超えています。履歴は自動削除しません。未編集のバックアップを保管し、複製したJSONで不要な記録を整理してください。')
  }
}

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return false
  return Reflect.ownKeys(value).every((key) => {
    if (typeof key !== 'string') return false
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return descriptor?.enumerable === true && 'value' in descriptor && descriptor.value !== undefined
  })
}

function isArray(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false
  const keys = Reflect.ownKeys(value)
  return keys.length === value.length + 1
    && keys.includes('length')
    && Array.from({ length: value.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      return descriptor?.enumerable === true && 'value' in descriptor && descriptor.value !== undefined
    }).every(Boolean)
}

function hasOnlyKeys(value, allowed) {
  return isRecord(value)
    && Reflect.ownKeys(value).length === allowed.length
    && Reflect.ownKeys(value).every((key) => allowed.includes(key))
}

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isUtcTimestamp(value) {
  if (typeof value !== 'string' || !utcTimestampPattern.test(value)) return false
  try {
    return new Date(value).toISOString() === value
  } catch {
    return false
  }
}

function emptyData() {
  return Object.freeze({
    schemaVersion: 2,
    questionInstances: Object.freeze([]),
    answerAttempts: Object.freeze([]),
    reviewEvents: Object.freeze([]),
  })
}

function restoreInstances(value) {
  if (!isArray(value)) fail('invalid-schema', '出題snapshotの配列が不正です。')
  if (value.length > LOCAL_DATA_MAX_INSTANCES) {
    fail('too-many-instances', '出題snapshotの件数が上限（500件）を超えています。')
  }
  const ids = new Set()
  const byId = new Map()
  const instances = value.map((instance) => {
    if (!isRecord(instance) || typeof instance.instanceId !== 'string' || ids.has(instance.instanceId)) {
      fail('invalid-schema', '出題snapshotの形式またはIDが不正です。')
    }
    ids.add(instance.instanceId)
    try {
      const restored = restoreQuestionInstance(instance)
      byId.set(restored.instanceId, restored)
      return restored
    } catch {
      fail('invalid-schema', '出題snapshotの形式が不正です。')
    }
  })
  return { instances: Object.freeze(instances), byId }
}

function isAnswerValid(instance, answer) {
  if (typeof answer !== 'string') return false
  const content = instance.questionDefinitionSnapshot.content
  return content.format === 'single-choice'
    ? content.choices.some((choice) => choice.id === answer)
    : decimalPattern.test(answer.trim())
}

function restoreGradingResult(value, instance) {
  if (!hasOnlyKeys(value, ['status', 'isCorrect', 'feedback']) || value.status !== 'graded') {
    fail('invalid-schema', '解答試行の採点結果が不正です。')
  }
  if (value.isCorrect === true && value.feedback === null) {
    return Object.freeze({ status: 'graded', isCorrect: true, feedback: null })
  }
  if (value.isCorrect !== false || !isRecord(value.feedback)) {
    fail('invalid-schema', '解答試行の採点結果が不正です。')
  }

  const feedback = value.feedback
  const content = instance.questionDefinitionSnapshot.content
  if (feedback.source === 'default') {
    if (!hasOnlyKeys(feedback, ['source', 'explanation', 'lessonRef'])
      || feedback.explanation !== content.defaultFeedback
      || feedback.lessonRef !== instance.questionDefinitionSnapshot.lessonRefs[0]) {
      fail('invalid-schema', '共通フィードバックが出題snapshotと一致しません。')
    }
    return Object.freeze({
      status: 'graded',
      isCorrect: false,
      feedback: Object.freeze({ source: 'default', explanation: feedback.explanation, lessonRef: feedback.lessonRef }),
    })
  }

  if (feedback.source !== 'rule'
    || !hasOnlyKeys(feedback, ['source', 'explanation', 'lessonRef', 'matchedRule'])
    || !isRecord(feedback.matchedRule)) {
    fail('invalid-schema', '誤答フィードバックが不正です。')
  }

  const matchedRule = feedback.matchedRule
  const rule = content.format === 'single-choice'
    && hasOnlyKeys(matchedRule, ['kind', 'choiceId'])
    && matchedRule.kind === 'single-choice'
    ? content.feedbackRules.find((item) => item.choiceId === matchedRule.choiceId)
    : content.format === 'numeric'
      && hasOnlyKeys(matchedRule, ['kind', 'answer'])
      && matchedRule.kind === 'numeric'
      ? content.feedbackRules.find((item) => item.answer === matchedRule.answer)
      : null
  if (!rule || feedback.explanation !== rule.explanation || feedback.lessonRef !== rule.lessonRef) {
    fail('invalid-schema', '個別フィードバックが出題snapshotと一致しません。')
  }

  return Object.freeze({
    status: 'graded',
    isCorrect: false,
    feedback: Object.freeze({
      source: 'rule',
      explanation: feedback.explanation,
      lessonRef: feedback.lessonRef,
      matchedRule: Object.freeze({ ...matchedRule }),
    }),
  })
}

function restoreAttempts(value, instancesById) {
  if (!isArray(value)) fail('invalid-schema', '解答試行の配列が不正です。')
  const ids = new Set()
  const byId = new Map()
  const attempts = value.map((attempt) => {
    if (!hasOnlyKeys(attempt, answerKeys)
      || !isText(attempt.attemptId) || ids.has(attempt.attemptId)
      || !isText(attempt.instanceId) || !instancesById.has(attempt.instanceId)
      || !isUtcTimestamp(attempt.attemptedAt)) {
      fail('invalid-schema', '解答試行の形式、ID、出題参照、日時が不正です。')
    }
    const instance = instancesById.get(attempt.instanceId)
    if (!isAnswerValid(instance, attempt.answer)) {
      fail('invalid-schema', '解答試行の回答形式が出題snapshotと一致しません。')
    }
    const gradingResult = restoreGradingResult(attempt.gradingResult, instance)
    if (!sameJsonValue(gradingResult, gradeQuestionAnswer(instance, attempt.answer))) {
      fail('invalid-schema', '回答と採点結果が一致しません。')
    }
    const restored = Object.freeze({
      attemptId: attempt.attemptId,
      instanceId: attempt.instanceId,
      answer: attempt.answer,
      gradingResult,
      attemptedAt: attempt.attemptedAt,
    })
    ids.add(restored.attemptId)
    byId.set(restored.attemptId, restored)
    return restored
  })
  return { attempts: Object.freeze(attempts), byId }
}

function restoreReviews(value, attemptsById) {
  if (!isArray(value)) fail('invalid-schema', '復習イベントの配列が不正です。')
  const ids = new Set()
  const events = value.map((event) => {
    if (!hasOnlyKeys(event, reviewKeys)
      || !isText(event.reviewEventId) || ids.has(event.reviewEventId)
      || typeof event.targetRef !== 'string' || !parseLessonRef(event.targetRef)
      || !isText(event.sourceAttemptId) || !isUtcTimestamp(event.reviewedAt)) {
      fail('invalid-schema', '復習イベントの形式、ID、参照、日時が不正です。')
    }
    if (attemptsById.get(event.sourceAttemptId)?.gradingResult.isCorrect !== false) {
      fail('invalid-schema', '復習イベントは保存済みの誤答試行を参照する必要があります。')
    }
    ids.add(event.reviewEventId)
    return Object.freeze({
      reviewEventId: event.reviewEventId,
      targetRef: event.targetRef,
      sourceAttemptId: event.sourceAttemptId,
      reviewedAt: event.reviewedAt,
    })
  })
  return Object.freeze(events)
}

function restoreData(value, allowLegacy = false) {
  if (!isRecord(value)) fail('invalid-schema', 'データ形式が不正です。')
  if (value.schemaVersion !== 1 && value.schemaVersion !== 2) {
    if (typeof value.schemaVersion === 'number') {
      fail('unsupported-version', '未対応のデータ形式です（schemaVersion: ' + value.schemaVersion + '）。')
    }
    fail('invalid-schema', 'データ形式が不正です。')
  }
  if (value.schemaVersion === 1 && !allowLegacy) {
    fail('invalid-schema', '保存データはschemaVersion 2である必要があります。')
  }
  const expectedKeys = value.schemaVersion === 1
    ? ['schemaVersion', ...instanceKeys]
    : ['schemaVersion', 'questionInstances', 'answerAttempts', 'reviewEvents']
  if (!hasOnlyKeys(value, expectedKeys)) fail('invalid-schema', 'データ形式が不正です。')

  const { instances, byId: instancesById } = restoreInstances(value.questionInstances)
  const { attempts, byId: attemptsById } = restoreAttempts(value.schemaVersion === 1 ? [] : value.answerAttempts, instancesById)
  const reviewEvents = restoreReviews(value.schemaVersion === 1 ? [] : value.reviewEvents, attemptsById)
  return Object.freeze({
    schemaVersion: 2,
    questionInstances: instances,
    answerAttempts: attempts,
    reviewEvents,
  })
}

function restoreCurrentData(value) {
  try {
    return restoreData(value)
  } catch (error) {
    if (error instanceof LocalDataError) throw error
    fail('invalid-schema', 'データ形式が不正です。')
  }
}

function parseDetails(text) {
  if (typeof text !== 'string') fail('invalid-json', 'JSONを読み込めません。')
  checkByteLimit(text)
  let value
  try {
    value = JSON.parse(text)
  } catch {
    fail('invalid-json', 'JSONを解析できません。ファイルの内容を確認してください。')
  }
  return { sourceVersion: value?.schemaVersion, data: restoreData(value, true) }
}

export function parseLocalData(text) {
  return parseDetails(text).data
}

export function serializeLocalData(value) {
  const data = restoreCurrentData(value)
  const text = JSON.stringify(data)
  checkByteLimit(text)
  return text
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
    const { sourceVersion, data } = parseDetails(raw)
    return { status: sourceVersion === 1 ? 'legacy' : 'ok', raw, data }
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

function sameJsonValue(left, right) {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((item, index) => sameJsonValue(item, right[index]))
  }
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false
  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && sameJsonValue(left[key], right[key]))
}

function assertAppendOnly(before, candidate) {
  for (const key of appendOnlyKeys) {
    const previous = before.data[key]
    const next = candidate[key]
    if (next.length < previous.length
      || previous.some((item, index) => !sameJsonValue(item, next[index]))) {
      fail('history-modified', '保存済みの学習記録を削除・変更・並べ替えできません。整理する場合はバックアップを編集して確認付きで読み込んでください。')
    }
  }
}

function writeLocalData(storage, before, data) {
  const raw = JSON.stringify(data)
  checkByteLimit(raw)
  const current = readStorage(storage)
  if (current.status === 'unreadable') throw current.error
  if (current.status !== before.status || current.raw !== before.raw) {
    fail('storage-changed', '保存中にデータが変更されたため、書き込みを中止しました。最新の内容を確認してからやり直してください。')
  }
  try {
    storage.setItem(LOCAL_DATA_KEY, raw)
  } catch {
    fail('storage-write-failed', 'ブラウザ内への保存に失敗しました。既存データはそのままです。')
  }
  return { status: 'saved', data, raw }
}

function getStorageOrFail(getStorage) {
  try {
    return getStorage()
  } catch {
    fail('storage-unavailable', 'ブラウザ内の保存データを読み取れません。')
  }
}

export function saveLocalData(value, getStorage = () => window.localStorage) {
  const storage = getStorageOrFail(getStorage)
  const before = readStorage(storage)
  if (before.status === 'unreadable' || before.status === 'invalid') throw before.error
  const data = restoreCurrentData(value)
  assertAppendOnly(before, data)
  return writeLocalData(storage, before, data)
}

export function migrateLocalData(expectedRaw, value, getStorage = () => window.localStorage) {
  const storage = getStorageOrFail(getStorage)
  const before = readStorage(storage)
  if (before.status === 'unreadable') throw before.error
  const data = restoreCurrentData(value)
  if (before.status === 'ok' && sameJsonValue(before.data, data)) {
    return { status: 'saved', data: before.data, raw: before.raw }
  }
  if (before.status !== 'legacy' || before.raw !== expectedRaw) {
    fail('storage-changed', '移行前に保存データが変更されました。最新の内容を確認してください。')
  }
  assertAppendOnly(before, data)
  return writeLocalData(storage, before, data)
}

function counts(data) {
  return {
    questionInstances: data.questionInstances.length,
    answerAttempts: data.answerAttempts.length,
    reviewEvents: data.reviewEvents.length,
  }
}

export async function importLocalData(file, confirmReplacement, getStorage = () => window.localStorage) {
  if (file.size > LOCAL_DATA_MAX_BYTES) {
    fail('too-large', 'JSONのサイズが上限（2 MiB）を超えています。履歴は自動削除しません。未編集のバックアップを保管し、複製したJSONで不要な記録を整理してください。')
  }

  let data
  try {
    data = parseLocalData(await file.text())
  } catch (error) {
    if (error instanceof LocalDataError) throw error
    fail('file-read-failed', '選択したファイルを読み込めませんでした。')
  }
  const raw = serializeLocalData(data)
  const storage = getStorageOrFail(getStorage)
  const before = readStorage(storage)
  if (before.status === 'unreadable') throw before.error
  if (before.status !== 'missing') {
    const replace = await confirmReplacement({
      damaged: before.status === 'invalid',
      existingCounts: before.status === 'ok' || before.status === 'legacy' ? counts(before.data) : undefined,
      importCounts: counts(data),
    })
    if (!replace) return { status: 'cancelled' }
  }

  const result = writeLocalData(storage, before, data)
  return { status: 'imported', data: result.data, raw: result.raw }
}
