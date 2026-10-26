import assert from 'node:assert/strict'
import test from 'node:test'
import {
  exportLocalData,
  importLocalData,
  LOCAL_DATA_KEY,
  LOCAL_DATA_MAX_BYTES,
  LOCAL_DATA_MAX_INSTANCES,
  LocalDataError,
  migrateLocalData,
  parseLocalData,
  readLocalData,
  saveLocalData,
  serializeLocalData,
} from '../src/local-data.mjs'
import { gradeQuestionAnswer } from '../src/question-grading.mjs'
import { fixedInstance, generatedInstance } from './question-contract.fixture.mjs'

const fixtureData = {
  schemaVersion: 2,
  questionInstances: [fixedInstance, generatedInstance],
  answerAttempts: [],
  reviewEvents: [],
}
const fixtureJson = serializeLocalData(fixtureData)
const oldFixtureJson = JSON.stringify({ schemaVersion: 1, questionInstances: [fixedInstance, generatedInstance] })

class MemoryStorage {
  value = null
  writes = 0
  failRead = false
  failWrite = false
  reads = 0
  onRead = null

  getItem(key) {
    assert.equal(key, LOCAL_DATA_KEY)
    if (this.failRead) throw new Error('read failed')
    this.reads += 1
    this.onRead?.(this, this.reads)
    return this.value
  }

  setItem(key, value) {
    assert.equal(key, LOCAL_DATA_KEY)
    this.writes += 1
    if (this.failWrite) throw new Error('quota exceeded')
    this.value = value
  }
}

function fileFor(text) {
  let reads = 0
  return {
    file: {
      size: new TextEncoder().encode(text).byteLength,
      async text() {
        reads += 1
        return text
      },
    },
    reads: () => reads,
  }
}

function errorCode(error, code) {
  return error instanceof LocalDataError && error.code === code
}

function makeAttempt(instance, attemptId, answer, attemptedAt = '2026-10-26T00:00:00.000Z') {
  const gradingResult = gradeQuestionAnswer(instance, answer)
  assert.equal(gradingResult.status, 'graded')
  return { attemptId, instanceId: instance.instanceId, answer, gradingResult, attemptedAt }
}

function makeReview(reviewEventId, sourceAttemptId, targetRef = 'future-lesson#section') {
  return { reviewEventId, targetRef, sourceAttemptId, reviewedAt: '2026-10-26T00:01:00.000Z' }
}

function historyFixture() {
  const attempt1 = makeAttempt(fixedInstance, 'attempt-1', 'A')
  const attempt2 = makeAttempt(generatedInstance, 'attempt-2', ' +1.030 ')
  const attempt3 = makeAttempt(generatedInstance, 'attempt-3', ' +20.0 ')
  return {
    schemaVersion: 2,
    questionInstances: [fixedInstance, generatedInstance],
    answerAttempts: [attempt1, attempt2, attempt3],
    reviewEvents: [makeReview('review-1', attempt1.attemptId), makeReview('review-2', attempt1.attemptId)],
  }
}

test('非空fixtureを保存して新しい読込から同じsnapshotを取得できる', async () => {
  const storage = new MemoryStorage()
  const { file } = fileFor(fixtureJson)
  const result = await importLocalData(file, () => assert.fail('初回保存では確認しない'), () => storage)

  assert.equal(result.status, 'imported')
  assert.deepEqual(readLocalData(() => storage).data, fixtureData)
  assert.equal(storage.writes, 1)
  assert.equal(Object.isFrozen(result.data.questionInstances[0].questionDefinitionSnapshot.content), true)
})

test('JSONの書出し・読込みを往復してsnapshotとUTF-8 byte数を保つ', async () => {
  const storage = new MemoryStorage()
  storage.value = fixtureJson
  const backup = exportLocalData(() => storage)
  assert.equal(new Blob([backup]).size, new TextEncoder().encode(backup).byteLength)
  assert.ok(backup.length < new TextEncoder().encode(backup).byteLength, '日本語が含まれるfixtureを使う')

  const destination = new MemoryStorage()
  const { file } = fileFor(backup)
  const result = await importLocalData(file, () => false, () => destination)
  assert.equal(result.status, 'imported')
  assert.deepEqual(readLocalData(() => destination).data, fixtureData)
})

test('空データを受け入れ、復元snapshotを入力から独立させる', () => {
  assert.deepEqual(parseLocalData('{"schemaVersion":2,"questionInstances":[],"answerAttempts":[],"reviewEvents":[]}'), {
    schemaVersion: 2,
    questionInstances: [],
    answerAttempts: [],
    reviewEvents: [],
  })
  const restored = parseLocalData(fixtureJson)
  assert.notEqual(restored.questionInstances[0], fixedInstance)
  assert.notEqual(restored.questionInstances[0].questionDefinitionSnapshot, fixedInstance.questionDefinitionSnapshot)
  assert.equal(Object.isFrozen(restored.questionInstances[0]), true)
})

test('不正JSON、schema、version、snapshot、重複IDを拒否する', () => {
  const badSnapshot = structuredClone(fixtureData)
  badSnapshot.questionInstances[1].questionDefinitionRevision += 1
  const duplicateId = structuredClone(fixtureData)
  duplicateId.questionInstances[1].instanceId = fixedInstance.instanceId
  const cases = [
    ['{', 'invalid-json'],
    ['[]', 'invalid-schema'],
    ['{"schemaVersion":1}', 'invalid-schema'],
    ['{"schemaVersion":1,"questionInstances":[],"extra":true}', 'invalid-schema'],
    ['{"schemaVersion":"1","questionInstances":[]}', 'invalid-schema'],
    ['{"schemaVersion":2,"questionInstances":[],"answerAttempts":[],"reviewEvents":[],"extra":true}', 'invalid-schema'],
    ['{"schemaVersion":3,"questionInstances":[],"answerAttempts":[],"reviewEvents":[]}', 'unsupported-version'],
    [JSON.stringify({ schemaVersion: 1, questionInstances: 'no' }), 'invalid-schema'],
    [JSON.stringify(badSnapshot), 'invalid-schema'],
    [JSON.stringify(duplicateId), 'invalid-schema'],
  ]
  for (const [json, code] of cases) assert.throws(() => parseLocalData(json), (error) => errorCode(error, code))
})

test('後半のsnapshotが不正なら全体を拒否し、保存値を書き換えない', async () => {
  const storage = new MemoryStorage()
  storage.value = fixtureJson
  const invalid = structuredClone(fixtureData)
  invalid.questionInstances[1].questionDefinitionSnapshot.content.correctAnswer = 'invalid'
  const { file } = fileFor(JSON.stringify(invalid))
  await assert.rejects(importLocalData(file, () => assert.fail('検証失敗時に置換確認しない'), () => storage), (error) => errorCode(error, 'invalid-schema'))
  assert.equal(storage.value, fixtureJson)
  assert.equal(storage.writes, 0)
})

test('2 MiBちょうどのJSONを受け入れ、超過時はファイルを読まない', async () => {
  const exact = `${fixtureJson}${' '.repeat(LOCAL_DATA_MAX_BYTES - new TextEncoder().encode(fixtureJson).byteLength)}`
  const storage = new MemoryStorage()
  const exactFile = fileFor(exact)
  assert.equal(exactFile.file.size, LOCAL_DATA_MAX_BYTES)
  const result = await importLocalData(exactFile.file, () => false, () => storage)
  assert.equal(result.status, 'imported')
  assert.equal(exactFile.reads(), 1)

  const previousValue = storage.value
  const tooLarge = { size: LOCAL_DATA_MAX_BYTES + 1, async text() { assert.fail('上限確認前に全文を読まない') } }
  await assert.rejects(importLocalData(tooLarge, () => true, () => storage), (error) => errorCode(error, 'too-large'))
  assert.equal(storage.value, previousValue)
})

test('500件を受け入れ、501件はsnapshotの検証前に拒否する', () => {
  const instances = Array.from({ length: LOCAL_DATA_MAX_INSTANCES }, (_, index) => ({
    ...structuredClone(fixedInstance),
    instanceId: `fixture-${index}`,
  }))
  assert.equal(parseLocalData(serializeLocalData({ ...fixtureData, questionInstances: instances })).questionInstances.length, 500)
  const tooMany = [{ invalid: true }, ...Array.from({ length: LOCAL_DATA_MAX_INSTANCES }, (_, index) => ({ instanceId: `other-${index}` }))]
  assert.throws(
    () => parseLocalData(JSON.stringify({ schemaVersion: 2, questionInstances: tooMany, answerAttempts: [], reviewEvents: [] })),
    (error) => errorCode(error, 'too-many-instances'),
  )
})

test('storageの未設定・読み取り・書き込み失敗で既存データを失わない', async () => {
  const missing = new MemoryStorage()
  assert.equal(readLocalData(() => missing).status, 'missing')
  assert.equal(missing.writes, 0)
  assert.equal(readLocalData(() => { throw new Error('blocked') }).status, 'unreadable')

  const failingRead = new MemoryStorage()
  failingRead.failRead = true
  assert.equal(readLocalData(() => failingRead).status, 'unreadable')

  const failingWrite = new MemoryStorage()
  failingWrite.value = fixtureJson
  failingWrite.failWrite = true
  const { file } = fileFor(fixtureJson)
  await assert.rejects(importLocalData(file, () => true, () => failingWrite), (error) => errorCode(error, 'storage-write-failed'))
  assert.equal(failingWrite.value, fixtureJson)
  assert.equal(failingWrite.writes, 1)
})

test('保存済みデータの置換キャンセルは破損・非対応versionを含めて元の値を保つ', async () => {
  const existingValues = [
    [fixtureJson, false],
    ['{broken', true],
    ['{"schemaVersion":1,"unknown":true}', true],
    ['{"schemaVersion":3,"questionInstances":[],"answerAttempts":[],"reviewEvents":[]}', true],
  ]
  for (const [existing, damaged] of existingValues) {
    const storage = new MemoryStorage()
    storage.value = existing
    const { file } = fileFor(fixtureJson)
    let state
    const result = await importLocalData(file, (current) => { state = current; return false }, () => storage)
    assert.deepEqual(result, { status: 'cancelled' })
    assert.equal(storage.value, existing)
    assert.equal(storage.writes, 0)
    assert.equal(state.damaged, damaged)
  }
})

test('確認後に保存値が変わった場合は置換しない', async () => {
  const storage = new MemoryStorage()
  storage.value = fixtureJson
  const changedValue = JSON.stringify({ schemaVersion: 1, questionInstances: [] })
  const { file } = fileFor(fixtureJson)
  await assert.rejects(importLocalData(file, () => { storage.value = changedValue; return true }, () => storage), (error) => errorCode(error, 'storage-changed'))
  assert.equal(storage.value, changedValue)
  assert.equal(storage.writes, 0)
})

test('保存JSONも2 MiB上限を超える場合は書出しを拒否する', () => {
  const large = structuredClone(fixedInstance)
  large.questionDefinitionSnapshot.content.prompt = 'x'.repeat(LOCAL_DATA_MAX_BYTES)
  const oversized = JSON.stringify({ ...fixtureData, questionInstances: [large] })
  assert.ok(new TextEncoder().encode(oversized).byteLength > LOCAL_DATA_MAX_BYTES)
  assert.throws(() => serializeLocalData({ ...fixtureData, questionInstances: [large] }), (error) => errorCode(error, 'too-large'))
  assert.throws(() => exportLocalData(() => ({
    getItem() { return oversized },
    setItem() {},
  })), (error) => errorCode(error, 'too-large'))
})

test('v1の非空fixtureを副作用なくv2へ移行し、backup/import/reloadでもsnapshotを保つ', async () => {
  const storage = new MemoryStorage()
  storage.value = oldFixtureJson
  const legacy = readLocalData(() => storage)
  assert.equal(legacy.status, 'legacy')
  assert.deepEqual(legacy.data.questionInstances, fixtureData.questionInstances)
  assert.equal(storage.writes, 0)
  assert.equal(JSON.parse(exportLocalData(() => storage)).schemaVersion, 2)
  assert.equal(storage.writes, 0)

  const migrated = migrateLocalData(legacy.raw, legacy.data, () => storage)
  assert.equal(migrated.status, 'saved')
  assert.equal(JSON.parse(storage.value).schemaVersion, 2)
  assert.equal(storage.writes, 1)
  migrateLocalData(legacy.raw, legacy.data, () => storage)
  assert.equal(storage.writes, 1)
  assert.deepEqual(readLocalData(() => storage).data.questionInstances, fixtureData.questionInstances)

  const destination = new MemoryStorage()
  const { file } = fileFor(exportLocalData(() => storage))
  await importLocalData(file, () => assert.fail('空の保存先では確認しない'), () => destination)
  assert.deepEqual(readLocalData(() => destination).data.questionInstances, fixtureData.questionInstances)
})

test('v2のsnapshot、複数試行、同じ復習先への複数訪問を完全往復する', async () => {
  const expected = historyFixture()
  const raw = serializeLocalData(expected)
  const parsed = parseLocalData(raw)
  assert.deepEqual(parsed, expected)
  assert.equal(parsed.answerAttempts[1].answer, ' +1.030 ')
  assert.equal(parsed.answerAttempts[2].gradingResult.feedback.matchedRule.answer, '20')
  assert.deepEqual(parsed.reviewEvents.map((event) => event.targetRef), ['future-lesson#section', 'future-lesson#section'])
  assert.equal(Object.isFrozen(parsed.answerAttempts[0].gradingResult.feedback.matchedRule), true)

  const source = new MemoryStorage()
  source.value = raw
  const backup = exportLocalData(() => source)
  const destination = new MemoryStorage()
  const { file } = fileFor(backup)
  await importLocalData(file, () => assert.fail('空の保存先では確認しない'), () => destination)
  assert.deepEqual(readLocalData(() => destination).data, expected)
})

test('attempt/eventの参照、ID、採点feedback、日時、LessonRef構文を全体検証する', () => {
  const correctAttempt = makeAttempt(fixedInstance, 'correct-attempt', 'B')
  const invalidCases = [
    (data) => { data.answerAttempts[1].attemptId = data.answerAttempts[0].attemptId },
    (data) => { data.answerAttempts[0].instanceId = 'missing-instance' },
    (data) => { data.answerAttempts[0].answer = 'Z' },
    (data) => { data.answerAttempts[0].gradingResult = { status: 'invalid', reason: 'invalid-answer-format' } },
    (data) => { data.answerAttempts[0].gradingResult.feedback.matchedRule.choiceId = 'Z' },
    (data) => { data.answerAttempts[0].gradingResult.feedback.explanation = '別の説明' },
    (data) => { data.answerAttempts[1].gradingResult.feedback.explanation = '別の共通説明' },
    (data) => { data.answerAttempts[1].gradingResult.feedback.lessonRef = 'different-lesson#section' },
    (data) => { data.answerAttempts[2].gradingResult.feedback.matchedRule.answer = '21' },
    (data) => { data.reviewEvents[0].reviewEventId = data.reviewEvents[1].reviewEventId },
    (data) => { data.reviewEvents[0].sourceAttemptId = 'missing-attempt' },
    (data) => { data.answerAttempts.push(correctAttempt); data.reviewEvents[0].sourceAttemptId = 'correct-attempt' },
    (data) => { data.reviewEvents[0].targetRef = 'future-lesson#bad_section' },
    (data) => { data.answerAttempts[0].attemptedAt = '2024-02-30T00:00:00.000Z' },
    (data) => { data.answerAttempts[0].attemptedAt = '2024-02-29T00:00:00+00:00' },
    (data) => { data.reviewEvents[0].reviewedAt = '2023-02-29T00:00:00.000Z' },
  ]
  for (const change of invalidCases) {
    const data = structuredClone(historyFixture())
    change(data)
    assert.throws(() => parseLocalData(JSON.stringify(data)), (error) => errorCode(error, 'invalid-schema'))
  }
})

test('通常saveは三配列の追記だけを許し、配列順と保存済み内容を守る', () => {
  const before = historyFixture()
  const storage = new MemoryStorage()
  storage.value = serializeLocalData(before)
  const candidate = structuredClone(before)
  candidate.answerAttempts[0] = {
    attemptedAt: candidate.answerAttempts[0].attemptedAt,
    gradingResult: candidate.answerAttempts[0].gradingResult,
    answer: candidate.answerAttempts[0].answer,
    instanceId: candidate.answerAttempts[0].instanceId,
    attemptId: candidate.answerAttempts[0].attemptId,
  }
  candidate.answerAttempts.push(makeAttempt(fixedInstance, 'attempt-4', 'C'))
  candidate.reviewEvents.push(makeReview('review-3', 'attempt-1', 'future-other#topic'))
  const saved = saveLocalData(candidate, () => storage)
  assert.equal(saved.status, 'saved')
  assert.equal(storage.writes, 1)
  assert.equal(readLocalData(() => storage).data.answerAttempts.length, 4)
  assert.equal(readLocalData(() => storage).data.reviewEvents.length, 3)

  const reorderCases = [
    (data) => data.questionInstances.reverse(),
    (data) => data.answerAttempts.reverse(),
    (data) => data.reviewEvents.reverse(),
    (data) => { data.answerAttempts[1].answer = '999' },
    (data) => { data.reviewEvents.pop() },
  ]
  for (const change of reorderCases) {
    const baseline = serializeLocalData(before)
    const staleStorage = new MemoryStorage()
    staleStorage.value = baseline
    const staleCandidate = structuredClone(before)
    change(staleCandidate)
    assert.throws(() => saveLocalData(staleCandidate, () => staleStorage), (error) => errorCode(error, 'history-modified'))
    assert.equal(staleStorage.value, baseline)
    assert.equal(staleStorage.writes, 0)
  }

  const instanceStorage = new MemoryStorage()
  instanceStorage.value = fixtureJson
  const fewerSnapshots = structuredClone(fixtureData)
  fewerSnapshots.questionInstances.pop()
  assert.throws(() => saveLocalData(fewerSnapshots, () => instanceStorage), (error) => errorCode(error, 'history-modified'))
  assert.equal(instanceStorage.value, fixtureJson)
})

test('saveは書き込み直前のraw変更と破損/未対応データを上書きしない', () => {
  const storage = new MemoryStorage()
  storage.value = fixtureJson
  storage.onRead = (current, count) => {
    if (count === 2) current.value = serializeLocalData({ ...fixtureData, answerAttempts: [makeAttempt(fixedInstance, 'new-attempt', 'A')] })
  }
  const changedRaw = serializeLocalData({ ...fixtureData, answerAttempts: [makeAttempt(fixedInstance, 'new-attempt', 'A')] })
  assert.throws(() => saveLocalData(fixtureData, () => storage), (error) => errorCode(error, 'storage-changed'))
  assert.equal(storage.value, changedRaw)
  assert.equal(storage.writes, 0)

  for (const raw of ['{broken', '{"schemaVersion":3}', '{"schemaVersion":2,"questionInstances":[]}']) {
    const blocked = new MemoryStorage()
    blocked.value = raw
    assert.throws(() => saveLocalData(fixtureData, () => blocked), (error) => error instanceof LocalDataError)
    assert.equal(blocked.value, raw)
    assert.equal(blocked.writes, 0)
  }
})

test('約1 MiBのv1データ移行失敗後も元rawを保ち、v2 backupから復元できる', async () => {
  const instance = structuredClone(fixedInstance)
  instance.questionDefinitionSnapshot.content.prompt = ''
  const base = JSON.stringify({ schemaVersion: 1, questionInstances: [instance] })
  instance.questionDefinitionSnapshot.content.prompt = 'x'.repeat(1_048_576 - new TextEncoder().encode(base).byteLength)
  const legacyRaw = JSON.stringify({ schemaVersion: 1, questionInstances: [instance] })
  assert.equal(new TextEncoder().encode(legacyRaw).byteLength, 1_048_576)

  const storage = new MemoryStorage()
  storage.value = legacyRaw
  storage.failWrite = true
  const legacy = readLocalData(() => storage)
  assert.equal(legacy.status, 'legacy')
  assert.throws(() => migrateLocalData(legacy.raw, legacy.data, () => storage), (error) => errorCode(error, 'storage-write-failed'))
  assert.equal(storage.value, legacyRaw)
  assert.equal(storage.writes, 1)

  const backup = exportLocalData(() => storage)
  assert.equal(JSON.parse(backup).schemaVersion, 2)
  const restoredStorage = new MemoryStorage()
  const { file } = fileFor(backup)
  await importLocalData(file, () => assert.fail('空の保存先では確認しない'), () => restoredStorage)
  assert.deepEqual(readLocalData(() => restoredStorage).data.questionInstances[0], legacy.data.questionInstances[0])
})
