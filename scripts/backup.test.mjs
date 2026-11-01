import test from 'node:test'
import assert from 'node:assert/strict'
import { exportBackup, importBackup, parseBackup, serializeBackup } from '../src/backup.mjs'
import { exportLocalData, LOCAL_DATA_KEY, readLocalData, serializeLocalData } from '../src/local-data.mjs'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import { createInitialMapState, MAP_STATE_KEY, readMapState, saveMapState, serializeMapState } from '../src/map-state.mjs'
import { fixedInstance } from './question-contract.fixture.mjs'

function makeStorage(entries = {}) {
  const values = new Map(Object.entries(entries))
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  }
}

function file(text) {
  return { size: new TextEncoder().encode(text).byteLength, text: async () => text }
}

function emptyLocalData(storage = makeStorage()) {
  return JSON.parse(exportLocalData(() => storage))
}

function completedMapState() {
  const state = createInitialMapState(lessonRegistry)
  const id = lessonRegistry.lessons[0].lessonId
  state.lessons[id] = { ...state.lessons[id], status: 'completed', completedAt: '2026-10-30T01:00:00.000Z' }
  state.positions[id] = { x: 120, y: -30 }
  return state
}

test('integrated backup round-trips practice data, manual progress and positions', async () => {
  const savedData = { schemaVersion: 2, questionInstances: [fixedInstance], answerAttempts: [], reviewEvents: [] }
  const source = makeStorage({ [LOCAL_DATA_KEY]: serializeLocalData(savedData) })
  const manual = completedMapState()
  saveMapState(manual, null, lessonRegistry, () => source)
  const backup = exportBackup(() => source)
  assert.equal(parseBackup(backup).kind, 'backup')
  const destination = makeStorage()
  let confirmations = 0
  const result = await importBackup(file(backup), (state) => {
    confirmations++
    assert.equal(state.kind, 'backup')
    assert.equal(state.existing.mapState.status, 'missing')
    return true
  }, { getStorage: () => destination })
  assert.equal(confirmations, 1)
  assert.equal(result.status, 'imported')
  assert.deepEqual(readMapState(lessonRegistry, () => destination).state.positions, manual.positions)
  assert.deepEqual(JSON.parse(destination.getItem(MAP_STATE_KEY)).lessons, manual.lessons)
  assert.deepEqual(readLocalData(() => destination).data, savedData)
})

test('legacy backup replaces practice data only and leaves existing map-state raw untouched', async () => {
  const legacy = exportLocalData(() => makeStorage())
  const mapRaw = serializeMapState(completedMapState())
  const destination = makeStorage({ [MAP_STATE_KEY]: mapRaw })
  const result = await importBackup(file(legacy), () => true, { getStorage: () => destination })
  assert.equal(result.kind, 'legacy')
  assert.equal(destination.getItem(MAP_STATE_KEY), mapRaw)
  assert.equal(destination.getItem(LOCAL_DATA_KEY), legacy)
})

test('integrated import always confirms replacement and cancellation preserves null and valid empty raw', async () => {
  const localRaw = exportLocalData(() => makeStorage())
  const storage = makeStorage({ [LOCAL_DATA_KEY]: localRaw, [MAP_STATE_KEY]: serializeMapState(createInitialMapState(lessonRegistry)) })
  const before = Object.fromEntries(storage.values)
  let confirmations = 0
  const result = await importBackup(file(serializeBackup(emptyLocalData(), completedMapState())), () => {
    confirmations++
    return false
  }, { getStorage: () => storage })
  assert.equal(confirmations, 1)
  assert.equal(result.status, 'cancelled')
  assert.deepEqual(Object.fromEntries(storage.values), before)

  const missingPractice = makeStorage({ [MAP_STATE_KEY]: serializeMapState(completedMapState()) })
  const missingResult = await importBackup(file(serializeBackup(emptyLocalData(), completedMapState())), (state) => {
    assert.equal(state.existing.localData.status, 'missing')
    assert.equal(state.existing.localData.counts.questionInstances, 0)
    assert.equal(state.existing.mapState.completedLessons, 1)
    return false
  }, { getStorage: () => missingPractice })
  assert.equal(missingResult.status, 'cancelled')
  assert.equal(missingPractice.getItem(LOCAL_DATA_KEY), null)
})

test('damaged raw requires rescue download and explicit preservation confirmation before any write', async () => {
  const localRaw = '{broken'
  const mapRaw = serializeMapState(createInitialMapState(lessonRegistry))
  const storage = makeStorage({ [LOCAL_DATA_KEY]: localRaw, [MAP_STATE_KEY]: mapRaw })
  const rescueFiles = []
  const canceled = await importBackup(file(serializeBackup(emptyLocalData(), completedMapState())), () => true, {
    getStorage: () => storage,
    requestRecoveryDownload: (raw) => { rescueFiles.push(JSON.parse(raw)); return true },
    confirmRecovery: () => false,
  })
  assert.deepEqual(rescueFiles[0].raw, { [LOCAL_DATA_KEY]: localRaw, [MAP_STATE_KEY]: mapRaw })
  assert.deepEqual(canceled, { status: 'cancelled', phase: 'recovery' })
  assert.equal(storage.getItem(LOCAL_DATA_KEY), localRaw)
  assert.equal(storage.getItem(MAP_STATE_KEY), mapRaw)

  await assert.rejects(importBackup(file(serializeBackup(emptyLocalData(), completedMapState())), () => true, {
    getStorage: () => storage, requestRecoveryDownload: () => false, confirmRecovery: () => true,
  }), (error) => error.code === 'recovery-download-failed')
  assert.equal(storage.getItem(LOCAL_DATA_KEY), localRaw)
})

test('raw changes after rescue confirmation abort integration and preserve the competing update', async () => {
  const localRaw = '{broken'
  const mapRaw = serializeMapState(createInitialMapState(lessonRegistry))
  const storage = makeStorage({ [LOCAL_DATA_KEY]: localRaw, [MAP_STATE_KEY]: mapRaw })
  await assert.rejects(importBackup(file(serializeBackup(emptyLocalData(), completedMapState())), () => true, {
    getStorage: () => storage,
    requestRecoveryDownload: () => true,
    confirmRecovery: () => { storage.setItem(LOCAL_DATA_KEY, 'external update'); return true },
  }), (error) => error.code === 'storage-changed')
  assert.equal(storage.getItem(LOCAL_DATA_KEY), 'external update')
  assert.equal(storage.getItem(MAP_STATE_KEY), mapRaw)
})

test('second-key write failure rolls back only the value written by this import', async () => {
  const existingMapRaw = serializeMapState(createInitialMapState(lessonRegistry))
  const existingLocalRaw = exportLocalData(() => makeStorage())
  const base = makeStorage({ [LOCAL_DATA_KEY]: existingLocalRaw, [MAP_STATE_KEY]: existingMapRaw })
  const storage = {
    ...base,
    getItem: base.getItem,
    removeItem: base.removeItem,
    setItem: (key, value) => {
      if (key === LOCAL_DATA_KEY) throw new Error('quota')
      base.setItem(key, value)
    },
  }
  await assert.rejects(importBackup(file(serializeBackup(emptyLocalData(), completedMapState())), () => true, {
    getStorage: () => storage,
  }), (error) => error.code === 'storage-write-failed')
  assert.equal(base.getItem(MAP_STATE_KEY), existingMapRaw)
  assert.equal(base.getItem(LOCAL_DATA_KEY), existingLocalRaw)
})

test('rollback keeps another tab update and provides original raw when a key cannot be rolled back', async () => {
  const existingMapRaw = serializeMapState(createInitialMapState(lessonRegistry))
  const existingLocalRaw = exportLocalData(() => makeStorage())
  const competingMapRaw = '{other tab map update}'
  const competingLocalRaw = '{other tab practice update}'
  const base = makeStorage({ [LOCAL_DATA_KEY]: existingLocalRaw, [MAP_STATE_KEY]: existingMapRaw })
  const storage = {
    ...base,
    getItem: base.getItem,
    removeItem: base.removeItem,
    setItem: (key, value) => {
      base.setItem(key, value)
      if (key === MAP_STATE_KEY) {
        base.setItem(MAP_STATE_KEY, competingMapRaw)
        base.setItem(LOCAL_DATA_KEY, competingLocalRaw)
      }
    },
  }
  let rescue
  await assert.rejects(importBackup(file(serializeBackup(emptyLocalData(), completedMapState())), () => true, {
    getStorage: () => storage,
    requestRecoveryDownload: (text) => { rescue = JSON.parse(text); return true },
  }), (error) => error.code === 'storage-changed' && error.recoveryRequired === true)
  assert.equal(base.getItem(MAP_STATE_KEY), competingMapRaw)
  assert.equal(base.getItem(LOCAL_DATA_KEY), competingLocalRaw)
  assert.deepEqual(rescue.raw, { [LOCAL_DATA_KEY]: existingLocalRaw, [MAP_STATE_KEY]: existingMapRaw })
})

test('recovery raw is not accepted by ordinary backup import', () => {
  assert.throws(() => parseBackup(JSON.stringify({ format: 'sfqc-recovery-raw', schemaVersion: 1, raw: {} })), (error) => error.code === 'invalid-schema')
})
