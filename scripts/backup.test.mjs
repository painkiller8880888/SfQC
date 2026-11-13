import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LEARNING_BACKUP_ENVELOPE_MAX_BYTES, LEARNING_BACKUP_MAX_BYTES, LEARNING_RECOVERY_FORMAT,
  exportBackup, exportLearningBackup, importBackup, importLearningBackup, parseBackup, parseLearningBackup,
  recheckLearningBackupImport, serializeBackup, serializeLearningBackup, serializeLearningRecoveryRaw,
} from '../src/backup.mjs'
import { exportLocalData, LOCAL_DATA_KEY, readLocalData, serializeLocalData } from '../src/local-data.mjs'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import { createInitialMapState, MAP_STATE_KEY, readMapState, saveMapState, serializeMapState } from '../src/map-state.mjs'
import { fixedInstance } from './question-contract.fixture.mjs'
import { LEARNING_STATE_KEY, LEARNING_STATE_MAX_BYTES, serializeLearningState } from '../src/learning-state.mjs'
import { PRACTICE_RESULTS_KEY, PRACTICE_RESULTS_MAX_BYTES, serializePracticeResults } from '../src/practice-results.mjs'

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

function emptyLearningState() {
  return {
    schemaVersion: 1,
    lessons: Object.fromEntries(lessonRegistry.lessons.map((lesson) => [lesson.lessonId, { completedAt: null }])),
    positions: {},
  }
}

function emptyPracticeResults() {
  return { schemaVersion: 1, records: [] }
}

function learningStorage(entries = {}) {
  const values = new Map(Object.entries(entries))
  const access = []
  const reads = new Map()
  const writes = []
  const config = { failGet: () => false, failSet: () => false, afterSet: () => {} }
  const storage = {
    getItem(key) {
      access.push(['getItem', key])
      const count = (reads.get(key) ?? 0) + 1
      reads.set(key, count)
      if (config.failGet(key, count)) throw new Error('read failed')
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      access.push(['setItem', key])
      writes.push([key, value])
      if (config.failSet(key, value, writes.length)) throw new Error('write failed')
      values.set(key, value)
      config.afterSet(key, value)
    },
    removeItem(key) { access.push(['removeItem', key]); values.delete(key) },
  }
  return { storage, values, access, reads, writes, config }
}

function learningBackup(state = emptyLearningState(), results = emptyPracticeResults()) {
  return serializeLearningBackup(state, results)
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

test('new learning backup round-trips both strict schemas and preserves unresolved IDs', () => {
  const first = lessonRegistry.lessons[0]
  const state = emptyLearningState()
  state.lessons[first.lessonId].completedAt = '2026-11-12T12:34:56.789Z'
  state.lessons['retired-lesson'] = { completedAt: '2026-11-11T00:00:00.000Z' }
  state.positions['retired-lesson'] = { x: 4.5, y: -9 }
  const results = {
    schemaVersion: 1,
    records: [{ categoryId: 'mean-deviation', isCorrect: false, attemptedAt: '2026-11-12T12:34:56.789Z' }],
  }
  const backup = serializeLearningBackup(state, results)
  const parsed = parseLearningBackup(backup)
  assert.deepEqual(parsed.learningState.lessons['retired-lesson'], state.lessons['retired-lesson'])
  assert.deepEqual(parsed.learningState.positions['retired-lesson'], state.positions['retired-lesson'])
  assert.deepEqual(parsed.practiceResults, results)
  assert.equal(new TextEncoder().encode(backup).byteLength <= LEARNING_BACKUP_MAX_BYTES, true)
  assert.equal(LEARNING_BACKUP_ENVELOPE_MAX_BYTES, 1_024)
  assert.equal(LEARNING_STATE_MAX_BYTES, 65_536)
  assert.equal(PRACTICE_RESULTS_MAX_BYTES, 8_192)
  assert.throws(() => parseBackup(backup), (error) => error.code === 'invalid-schema')

  const extra = JSON.parse(backup)
  extra.extra = true
  assert.throws(() => parseLearningBackup(JSON.stringify(extra)), (error) => error.code === 'invalid-schema')
  assert.throws(() => parseLearningBackup(serializeLearningRecoveryRaw(null, null)), (error) => error.code === 'invalid-schema')
  assert.equal(JSON.parse(serializeLearningRecoveryRaw('broken', null)).format, LEARNING_RECOVERY_FORMAT)
})

test('new backup export and import use only new keys and preserve the existing storage fields', async () => {
  const first = lessonRegistry.lessons[0]
  const state = emptyLearningState()
  state.lessons[first.lessonId].completedAt = '2026-11-12T12:34:56.789Z'
  state.positions[first.lessonId] = { x: 15, y: 20 }
  const results = { schemaVersion: 1, records: [{ categoryId: 'comprehensive', isCorrect: true, attemptedAt: '2026-11-12T12:34:56.789Z' }] }
  const source = learningStorage({
    [LEARNING_STATE_KEY]: serializeLearningState(state),
    [PRACTICE_RESULTS_KEY]: serializePracticeResults(results),
    [LOCAL_DATA_KEY]: 'old practice raw',
    [MAP_STATE_KEY]: 'old map raw',
  })
  const exported = exportLearningBackup(() => source.storage)
  assert.deepEqual(parseLearningBackup(exported), { learningState: state, practiceResults: results })
  assert.ok(source.access.every(([, key]) => key === LEARNING_STATE_KEY || key === PRACTICE_RESULTS_KEY))

  const destination = learningStorage({ [LOCAL_DATA_KEY]: 'keep practice', [MAP_STATE_KEY]: 'keep map' })
  const result = await importLearningBackup(file(exported), (confirmation) => {
    assert.equal(confirmation.existing.learningState.status, 'missing')
    assert.equal(confirmation.imported.practiceResults.records, 1)
    return true
  }, { getStorage: () => destination.storage })
  assert.equal(result.status, 'imported')
  assert.equal(destination.values.get(LEARNING_STATE_KEY), serializeLearningState(state))
  assert.equal(destination.values.get(PRACTICE_RESULTS_KEY), serializePracticeResults(results))
  assert.equal(destination.values.get(LOCAL_DATA_KEY), 'keep practice')
  assert.equal(destination.values.get(MAP_STATE_KEY), 'keep map')
  assert.ok(destination.access.every(([, key]) => key === LEARNING_STATE_KEY || key === PRACTICE_RESULTS_KEY))
})

test('new backup import requires both replacement and damaged-data preservation confirmations', async () => {
  const backup = learningBackup()
  const originalState = '{broken learning raw'
  const originalPractice = '{"schemaVersion":2,"records":[]}'
  const fixture = learningStorage({ [LEARNING_STATE_KEY]: originalState, [PRACTICE_RESULTS_KEY]: originalPractice })
  let recoveryText
  const cancelled = await importLearningBackup(file(backup), () => true, {
    getStorage: () => fixture.storage,
    requestRecoveryDownload: (text) => { recoveryText = text; return true },
    confirmRecovery: () => false,
  })
  assert.equal(cancelled.status, 'cancelled')
  assert.deepEqual(JSON.parse(recoveryText), {
    format: LEARNING_RECOVERY_FORMAT,
    version: 1,
    raw: { [LEARNING_STATE_KEY]: originalState, [PRACTICE_RESULTS_KEY]: originalPractice },
  })
  assert.equal(fixture.values.get(LEARNING_STATE_KEY), originalState)
  assert.equal(fixture.values.get(PRACTICE_RESULTS_KEY), originalPractice)
  assert.equal(fixture.writes.length, 0)

  const noPreservation = await importLearningBackup(file(backup), () => true, {
    getStorage: () => fixture.storage,
    requestRecoveryDownload: () => false,
    confirmRecovery: () => true,
  })
  assert.equal(noPreservation.status, 'not-applied')
  assert.equal(fixture.writes.length, 0)
})

test('new backup cancellation reports a concurrent update instead of claiming unchanged cancellation', async () => {
  const fixture = learningStorage()
  const external = serializePracticeResults({ schemaVersion: 1, records: [
    { categoryId: 'unbiased-variance', isCorrect: false, attemptedAt: '2026-11-12T12:34:56.789Z' },
  ] })
  const result = await importLearningBackup(file(learningBackup()), () => {
    fixture.values.set(PRACTICE_RESULTS_KEY, external)
    return false
  }, { getStorage: () => fixture.storage })
  assert.equal(result.status, 'conflict')
  assert.equal(fixture.values.get(PRACTICE_RESULTS_KEY), external)
  assert.equal(fixture.writes.length, 0)
})

test('edited backup removes unresolved entries only after the replacement confirmation', async () => {
  const original = emptyLearningState()
  original.lessons['retired-lesson'] = { completedAt: '2026-11-12T12:34:56.789Z' }
  original.positions['retired-lesson'] = { x: 7, y: 8 }
  const fixture = learningStorage({
    [LEARNING_STATE_KEY]: serializeLearningState(original),
    [PRACTICE_RESULTS_KEY]: serializePracticeResults(emptyPracticeResults()),
  })
  const result = await importLearningBackup(file(learningBackup(emptyLearningState())), () => true, { getStorage: () => fixture.storage })
  assert.equal(result.status, 'imported')
  const after = parseLearningBackup(exportLearningBackup(() => fixture.storage))
  assert.equal(after.learningState.lessons['retired-lesson'], undefined)
  assert.equal(after.learningState.positions['retired-lesson'], undefined)
})

test('unchanged backup keys are not written during import', async () => {
  const state = emptyLearningState()
  const results = emptyPracticeResults()
  const fixture = learningStorage({
    [LEARNING_STATE_KEY]: serializeLearningState(state),
    [PRACTICE_RESULTS_KEY]: serializePracticeResults(results),
  })
  const result = await importLearningBackup(file(learningBackup(state, results)), () => true, { getStorage: () => fixture.storage })
  assert.equal(result.status, 'imported')
  assert.equal(fixture.writes.length, 0)
})

test('new backup rollback restores only values still written by the import', async () => {
  const beforeState = serializeLearningState(emptyLearningState())
  const beforePractice = serializePracticeResults(emptyPracticeResults())
  const nextState = emptyLearningState()
  nextState.lessons[lessonRegistry.lessons[0].lessonId].completedAt = '2026-11-12T12:34:56.789Z'
  const backup = learningBackup(nextState, {
    schemaVersion: 1,
    records: [{ categoryId: 'data-transformation', isCorrect: true, attemptedAt: '2026-11-12T12:34:56.789Z' }],
  })
  const failsSecondWrite = learningStorage({ [LEARNING_STATE_KEY]: beforeState, [PRACTICE_RESULTS_KEY]: beforePractice })
  failsSecondWrite.config.failSet = (key) => key === PRACTICE_RESULTS_KEY
  const rolledBack = await importLearningBackup(file(backup), () => true, { getStorage: () => failsSecondWrite.storage })
  assert.equal(rolledBack.status, 'rolled-back')
  assert.equal(failsSecondWrite.values.get(LEARNING_STATE_KEY), beforeState)
  assert.equal(failsSecondWrite.values.get(PRACTICE_RESULTS_KEY), beforePractice)

  const otherTabPractice = serializePracticeResults({ schemaVersion: 1, records: [
    { categoryId: 'comprehensive', isCorrect: false, attemptedAt: '2026-11-13T00:00:00.000Z' },
  ] })
  const raced = learningStorage({ [LEARNING_STATE_KEY]: beforeState, [PRACTICE_RESULTS_KEY]: beforePractice })
  raced.config.afterSet = (key) => {
    if (key === LEARNING_STATE_KEY) raced.values.set(PRACTICE_RESULTS_KEY, otherTabPractice)
  }
  const recovered = await importLearningBackup(file(backup), () => true, { getStorage: () => raced.storage })
  assert.equal(recovered.status, 'recovery-required')
  assert.equal(raced.values.get(LEARNING_STATE_KEY), beforeState)
  assert.equal(raced.values.get(PRACTICE_RESULTS_KEY), otherTabPractice)
  assert.equal(raced.writes.some(([key]) => key === PRACTICE_RESULTS_KEY), false)
  assert.ok(recovered.recoveryRaw)
})

test('new backup import remains unknown after final read failure and recheck never reimports', async () => {
  const beforeState = serializeLearningState(emptyLearningState())
  const beforePractice = serializePracticeResults(emptyPracticeResults())
  const nextState = emptyLearningState()
  nextState.lessons[lessonRegistry.lessons[0].lessonId].completedAt = '2026-11-12T12:34:56.789Z'
  const backup = learningBackup(nextState, {
    schemaVersion: 1,
    records: [{ categoryId: 'unbiased-variance', isCorrect: true, attemptedAt: '2026-11-12T12:34:56.789Z' }],
  })
  const fixture = learningStorage({ [LEARNING_STATE_KEY]: beforeState, [PRACTICE_RESULTS_KEY]: beforePractice })
  fixture.config.failGet = (key, count) => key === PRACTICE_RESULTS_KEY && count === 4
  const unknown = await importLearningBackup(file(backup), () => true, { getStorage: () => fixture.storage })
  assert.equal(unknown.status, 'unknown')
  assert.equal(fixture.writes.length, 2)
  fixture.config.failGet = () => false
  const confirmed = recheckLearningBackupImport(unknown.pending, lessonRegistry, () => fixture.storage)
  assert.equal(confirmed.status, 'imported')
  assert.equal(fixture.writes.length, 2)

  const competing = serializePracticeResults({ schemaVersion: 1, records: [
    { categoryId: 'comprehensive', isCorrect: false, attemptedAt: '2026-11-13T00:00:00.000Z' },
  ] })
  fixture.values.set(PRACTICE_RESULTS_KEY, competing)
  const conflict = recheckLearningBackupImport(unknown.pending, lessonRegistry, () => fixture.storage)
  assert.equal(conflict.status, 'recovery-required')
  assert.equal(fixture.values.get(LEARNING_STATE_KEY), beforeState)
  assert.equal(fixture.values.get(PRACTICE_RESULTS_KEY), competing)
  assert.equal(fixture.writes.length, 3)
  assert.ok(conflict.recoveryRaw)

  const notAppliedFixture = learningStorage({ [LEARNING_STATE_KEY]: beforeState, [PRACTICE_RESULTS_KEY]: beforePractice })
  notAppliedFixture.config.failGet = (key, count) => key === PRACTICE_RESULTS_KEY && count === 4
  const notAppliedPending = await importLearningBackup(file(backup), () => true, { getStorage: () => notAppliedFixture.storage })
  notAppliedFixture.config.failGet = () => false
  notAppliedFixture.values.set(LEARNING_STATE_KEY, beforeState)
  notAppliedFixture.values.set(PRACTICE_RESULTS_KEY, beforePractice)
  assert.equal(recheckLearningBackupImport(notAppliedPending.pending, lessonRegistry, () => notAppliedFixture.storage).status, 'not-applied')
  assert.equal(notAppliedFixture.writes.length, 2)

  const rollbackFixture = learningStorage({ [LEARNING_STATE_KEY]: beforeState, [PRACTICE_RESULTS_KEY]: beforePractice })
  rollbackFixture.config.failGet = (key, count) => key === PRACTICE_RESULTS_KEY && count === 4
  const partial = await importLearningBackup(file(backup), () => true, { getStorage: () => rollbackFixture.storage })
  assert.equal(partial.status, 'unknown')
  rollbackFixture.config.failGet = () => false
  rollbackFixture.values.set(PRACTICE_RESULTS_KEY, beforePractice)
  const rolledBack = recheckLearningBackupImport(partial.pending, lessonRegistry, () => rollbackFixture.storage)
  assert.equal(rolledBack.status, 'rolled-back')
  assert.equal(rollbackFixture.values.get(LEARNING_STATE_KEY), beforeState)
  assert.equal(rollbackFixture.values.get(PRACTICE_RESULTS_KEY), beforePractice)
})

test('new backup recheck preserves a competing change to an unchanged learning key', async () => {
  const beforeState = serializeLearningState(emptyLearningState())
  const beforePractice = serializePracticeResults(emptyPracticeResults())
  const candidatePractice = { schemaVersion: 1, records: [
    { categoryId: 'unbiased-variance', isCorrect: true, attemptedAt: '2026-11-12T12:34:56.789Z' },
  ] }
  const candidatePracticeRaw = serializePracticeResults(candidatePractice)
  const fixture = learningStorage({ [LEARNING_STATE_KEY]: beforeState, [PRACTICE_RESULTS_KEY]: beforePractice })
  fixture.config.failGet = (key, count) => key === PRACTICE_RESULTS_KEY && count === 3
  const unknown = await importLearningBackup(file(learningBackup(emptyLearningState(), candidatePractice)),
    () => true, { getStorage: () => fixture.storage })
  assert.equal(unknown.status, 'unknown')
  assert.deepEqual(unknown.pending.attemptedKeys, ['practiceResults'])
  assert.equal(unknown.pending.candidateRaw.practiceResults, candidatePracticeRaw)

  fixture.config.failGet = () => false
  const otherTabState = emptyLearningState()
  otherTabState.lessons[lessonRegistry.lessons[0].lessonId].completedAt = '2026-11-13T00:00:00.000Z'
  const otherTabRaw = serializeLearningState(otherTabState)
  fixture.values.set(LEARNING_STATE_KEY, otherTabRaw)

  const rechecked = recheckLearningBackupImport(unknown.pending, lessonRegistry, () => fixture.storage)
  assert.equal(rechecked.status, 'recovery-required')
  assert.equal(fixture.values.get(LEARNING_STATE_KEY), otherTabRaw)
  assert.equal(fixture.values.get(PRACTICE_RESULTS_KEY), beforePractice)
  assert.equal(fixture.writes.some(([key]) => key === LEARNING_STATE_KEY), false)
  assert.equal(fixture.writes.filter(([key]) => key === PRACTICE_RESULTS_KEY).length, 2)
  assert.ok(rechecked.recoveryRaw)
})

test('new backup rejects malformed outer envelopes, oversized nested states, and too many imported records', () => {
  assert.throws(() => serializeLearningBackup({ ...emptyLearningState(), extra: true }, emptyPracticeResults()))
  const largeState = emptyLearningState()
  largeState.lessons['x'.repeat(LEARNING_STATE_MAX_BYTES)] = { completedAt: null }
  assert.throws(() => serializeLearningBackup(largeState, emptyPracticeResults()), (error) => error.code === 'too-large')
  const tooMany = { schemaVersion: 1, records: Array.from({ length: 26 }, (_, index) => ({
    categoryId: 'mean-deviation', isCorrect: index % 2 === 0, attemptedAt: '2026-11-12T12:34:56.789Z',
  })) }
  assert.throws(() => serializeLearningBackup(emptyLearningState(), tooMany), (error) => error.code === 'invalid-schema')
  assert.throws(() => parseLearningBackup(' '.repeat(LEARNING_BACKUP_MAX_BYTES + 1)), (error) => error.code === 'too-large')
  assert.equal(LEARNING_BACKUP_MAX_BYTES, 74_752)
})
