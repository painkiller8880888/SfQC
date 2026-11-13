import assert from 'node:assert/strict'
import test from 'node:test'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import {
  LEARNING_STATE_KEY, LEARNING_STATE_MAX_BYTES, LearningStateError,
  parseLearningState, readLearningState, saveLearningState, serializeLearningState,
} from '../src/learning-state.mjs'

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  const access = []
  const calls = { reads: new Map(), writes: [] }
  const config = { failGet: () => false, failSet: () => false, afterSet: () => {} }
  const storage = {
    getItem(key) {
      access.push(['getItem', key])
      const count = (calls.reads.get(key) ?? 0) + 1
      calls.reads.set(key, count)
      if (config.failGet(key, count)) throw new Error('read failed')
      return values.get(key) ?? null
    },
    setItem(key, value) {
      access.push(['setItem', key])
      calls.writes.push([key, value])
      if (config.failSet(key, value, calls.writes.length)) throw new Error('write failed')
      values.set(key, value)
      config.afterSet(key, value)
    },
    removeItem(key) { access.push(['removeItem', key]); values.delete(key) },
  }
  return { storage, values, access, calls, config }
}

const firstLesson = lessonRegistry.lessons[0]
const timestamp = '2026-11-12T12:34:56.789Z'

test('learning state fills new registry lessons in memory and preserves unresolved entries on known edits', () => {
  const oldRegistry = { ...lessonRegistry, lessons: [firstLesson] }
  const oldRaw = serializeLearningState({
    schemaVersion: 1,
    lessons: {
      [firstLesson.lessonId]: { completedAt: null },
      'retired-lesson': { completedAt: timestamp },
    },
    positions: { 'retired-lesson': { x: 18, y: -3 } },
  }, oldRegistry)
  const savedOldKey = '{old practice data}'
  const savedMapKey = '{old map data}'
  const fixture = memoryStorage({
    [LEARNING_STATE_KEY]: oldRaw,
    'sfqc:local-data': savedOldKey,
    'sfqc:map-state:v1': savedMapKey,
  })
  const read = readLearningState(lessonRegistry, () => fixture.storage)
  assert.equal(read.status, 'ok')
  assert.deepEqual(read.unresolvedIds, { lessons: ['retired-lesson'], positions: ['retired-lesson'] })
  assert.deepEqual(read.state.lessons[lessonRegistry.lessons[1].lessonId], { completedAt: null })
  assert.deepEqual(read.state.positions['retired-lesson'], { x: 18, y: -3 })
  assert.equal(fixture.calls.writes.length, 0)
  assert.equal(fixture.values.get(LEARNING_STATE_KEY), oldRaw)

  const candidate = structuredClone(read.state)
  candidate.lessons[firstLesson.lessonId].completedAt = timestamp
  const saved = saveLearningState(candidate, oldRaw, lessonRegistry, () => fixture.storage)
  assert.equal(saved.status, 'saved')
  const confirmed = parseLearningState(saved.candidateRaw)
  assert.deepEqual(confirmed.state.lessons['retired-lesson'], { completedAt: timestamp })
  assert.deepEqual(confirmed.state.positions['retired-lesson'], { x: 18, y: -3 })
  assert.equal(fixture.values.get('sfqc:local-data'), savedOldKey)
  assert.equal(fixture.values.get('sfqc:map-state:v1'), savedMapKey)
  assert.ok(fixture.access.every(([, key]) => !['sfqc:local-data', 'sfqc:map-state:v1'].includes(key)))
})

test('learning state rejects unresolved edits, additions, malformed values, planned completion, and unknown fields', () => {
  const registry = { ...lessonRegistry, lessons: [firstLesson] }
  const baselineState = {
    schemaVersion: 1,
    lessons: { [firstLesson.lessonId]: { completedAt: null }, 'removed-lesson': { completedAt: null } },
    positions: { 'removed-lesson': { x: 1, y: 2 } },
  }
  const initial = serializeLearningState(baselineState, registry)
  const read = parseLearningState(initial, registry)
  const fixture = memoryStorage({ [LEARNING_STATE_KEY]: initial })

  for (const change of [
    (state) => { delete state.lessons['removed-lesson'] },
    (state) => { state.lessons['removed-lesson'] = { completedAt: timestamp } },
    (state) => { delete state.positions['removed-lesson'] },
    (state) => { state.positions['new-unresolved'] = { x: 2, y: 3 } },
  ]) {
    const current = structuredClone(read.state)
    change(current)
    const result = saveLearningState(current, initial, registry, () => fixture.storage)
    assert.equal(result.status, 'not-written')
  }
  assert.equal(fixture.calls.writes.length, 0)

  const planned = lessonRegistry.lessons.find((lesson) => lesson.availability === 'planned')
  if (planned) {
    const plannedRegistry = { ...lessonRegistry, lessons: [planned] }
    assert.throws(() => serializeLearningState({
      schemaVersion: 1, lessons: { [planned.lessonId]: { completedAt: timestamp } }, positions: {},
    }, plannedRegistry), (error) => error instanceof LearningStateError && error.code === 'invalid-schema')
  }
  for (const invalid of [
    { schemaVersion: 2, lessons: {}, positions: {} },
    { schemaVersion: 1, lessons: { 'bad id': { completedAt: null } }, positions: {} },
    { schemaVersion: 1, lessons: { 'unknown-lesson': { completedAt: '2026-02-30T00:00:00.000Z' } }, positions: {} },
    { schemaVersion: 1, lessons: {}, positions: { 'unknown-lesson': { x: Infinity, y: 0 } } },
    { schemaVersion: 1, lessons: {}, positions: {}, extra: true },
  ]) assert.throws(() => serializeLearningState(invalid, registry), LearningStateError)
})

test('learning state uses a UTF-8 byte limit and reports unreadable, invalid, and unsupported storage', () => {
  const state = { schemaVersion: 1, lessons: {}, positions: {} }
  const small = serializeLearningState(state, { ...lessonRegistry, lessons: [] })
  const tooLarge = { schemaVersion: 1, lessons: { ['x'.repeat(LEARNING_STATE_MAX_BYTES)]: { completedAt: null } }, positions: {} }
  assert.throws(() => serializeLearningState(tooLarge, { ...lessonRegistry, lessons: [] }), (error) => error.code === 'too-large')
  assert.equal(new TextEncoder().encode(small).byteLength < LEARNING_STATE_MAX_BYTES, true)

  assert.equal(readLearningState(lessonRegistry, () => { throw new Error() }).status, 'unreadable')
  assert.equal(readLearningState(lessonRegistry, () => ({ getItem() { throw new Error() } })).status, 'unreadable')
  assert.equal(readLearningState(lessonRegistry, () => ({ getItem() { return '{' } })).status, 'invalid')
  assert.equal(readLearningState(lessonRegistry, () => ({ getItem() { return '{"schemaVersion":2,"lessons":{},"positions":{}}' } })).status, 'unsupported')

  const fixture = memoryStorage({ [LEARNING_STATE_KEY]: small })
  fixture.config.failSet = () => true
  const first = lessonRegistry.lessons[0]
  const changed = { schemaVersion: 1, lessons: { [first.lessonId]: { completedAt: timestamp } }, positions: {} }
  const save = saveLearningState(changed, small, { ...lessonRegistry, lessons: [first] }, () => fixture.storage)
  assert.equal(save.status, 'not-written')
  assert.equal(fixture.values.get(LEARNING_STATE_KEY), small)

  const afterWrite = memoryStorage()
  afterWrite.config.failSet = (key, value) => { afterWrite.values.set(key, value); return true }
  const confirmed = saveLearningState(state, null, { ...lessonRegistry, lessons: [] }, () => afterWrite.storage)
  assert.equal(confirmed.status, 'saved')
})

test('learning save distinguishes a post-write unknown result from a stale raw conflict', () => {
  const registry = { ...lessonRegistry, lessons: [firstLesson] }
  const state = serializeLearningState({ schemaVersion: 1, lessons: {}, positions: {} }, registry)
  const fixture = memoryStorage()
  fixture.config.failGet = (key, count) => key === LEARNING_STATE_KEY && count === 2
  const unknown = saveLearningState({ schemaVersion: 1, lessons: { [firstLesson.lessonId]: { completedAt: null } }, positions: {} }, null,
    registry, () => fixture.storage)
  assert.equal(unknown.status, 'unknown')
  assert.equal(fixture.values.get(LEARNING_STATE_KEY), unknown.candidateRaw)
  fixture.config.failGet = () => false
  const altered = { schemaVersion: 1, lessons: { [firstLesson.lessonId]: { completedAt: timestamp } }, positions: {} }
  const external = serializeLearningState(altered, registry)
  fixture.values.set(LEARNING_STATE_KEY, external)
  const conflict = saveLearningState({ schemaVersion: 1, lessons: {}, positions: {} }, state, registry, () => fixture.storage)
  assert.equal(conflict.status, 'conflict')
  assert.equal(fixture.values.get(LEARNING_STATE_KEY), external)
})

test('registry rename starts the new lesson empty and leaves the former ID unresolved', () => {
  const renamed = { ...firstLesson, lessonId: 'renamed-topic' }
  const registry = { ...lessonRegistry, lessons: [renamed] }
  const raw = serializeLearningState({
    schemaVersion: 1, lessons: { [firstLesson.lessonId]: { completedAt: timestamp } },
    positions: { [firstLesson.lessonId]: { x: 9, y: 4 } },
  }, { ...lessonRegistry, lessons: [firstLesson] })
  const parsed = parseLearningState(raw, registry)
  assert.deepEqual(parsed.state.lessons['renamed-topic'], { completedAt: null })
  assert.deepEqual(parsed.unresolvedIds, { lessons: [firstLesson.lessonId], positions: [firstLesson.lessonId] })
  assert.equal(parsed.state.positions['renamed-topic'], undefined)
  assert.deepEqual(parsed.state.positions[firstLesson.lessonId], { x: 9, y: 4 })
})
