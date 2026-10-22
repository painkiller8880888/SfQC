import assert from 'node:assert/strict'
import test from 'node:test'
import {
  exportLocalData,
  importLocalData,
  LOCAL_DATA_KEY,
  LOCAL_DATA_MAX_BYTES,
  LOCAL_DATA_MAX_INSTANCES,
  LocalDataError,
  parseLocalData,
  readLocalData,
  serializeLocalData,
} from '../src/local-data.mjs'
import { fixedInstance, generatedInstance } from './question-contract.fixture.mjs'

const fixtureData = { schemaVersion: 1, questionInstances: [fixedInstance, generatedInstance] }
const fixtureJson = serializeLocalData(fixtureData)

class MemoryStorage {
  value = null
  writes = 0
  failRead = false
  failWrite = false

  getItem(key) {
    assert.equal(key, LOCAL_DATA_KEY)
    if (this.failRead) throw new Error('read failed')
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
  assert.deepEqual(parseLocalData('{"schemaVersion":1,"questionInstances":[]}'), {
    schemaVersion: 1,
    questionInstances: [],
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
    ['{"schemaVersion":2,"questionInstances":[]}', 'unsupported-version'],
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

test('1 MiBちょうどのJSONを受け入れ、超過時はファイルを読まない', async () => {
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
  assert.equal(parseLocalData(serializeLocalData({ schemaVersion: 1, questionInstances: instances })).questionInstances.length, 500)
  const tooMany = [{ invalid: true }, ...Array.from({ length: LOCAL_DATA_MAX_INSTANCES }, (_, index) => ({ instanceId: `other-${index}` }))]
  assert.throws(
    () => parseLocalData(JSON.stringify({ schemaVersion: 1, questionInstances: tooMany })),
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
    ['{"schemaVersion":2,"questionInstances":[]}', true],
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

test('保存JSONも1 MiB上限を超える場合は書出しを拒否する', () => {
  const large = structuredClone(fixedInstance)
  large.questionDefinitionSnapshot.content.prompt = 'x'.repeat(LOCAL_DATA_MAX_BYTES)
  const oversized = JSON.stringify({ schemaVersion: 1, questionInstances: [large] })
  assert.ok(new TextEncoder().encode(oversized).byteLength > LOCAL_DATA_MAX_BYTES)
  assert.throws(() => serializeLocalData({ schemaVersion: 1, questionInstances: [large] }), (error) => errorCode(error, 'too-large'))
  assert.throws(() => exportLocalData(() => ({
    getItem() { return oversized },
    setItem() {},
  })), (error) => errorCode(error, 'too-large'))
})
