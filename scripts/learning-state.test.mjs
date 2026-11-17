import assert from 'node:assert/strict'
import test from 'node:test'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import {
  LEARNING_STATE_KEY, LEARNING_STATE_MAX_BYTES, LearningStateError,
  parseLearningState, readLearningState, saveLearningState, serializeLearningState,
} from '../src/learning-state.mjs'

const firstLesson = lessonRegistry.lessons[0]
const timestamp = '2026-11-12T12:34:56.789Z'

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

const emptyState = () => ({ schemaVersion: 2, lessons: {} })

test('v2 starts unfinished, ignores the old key, and preserves valid unresolved lesson IDs', () => {
  const oldRaw = '{"schemaVersion":1,"lessons":{"descriptive-statistics":{"completedAt":"2026-11-12T12:34:56.789Z"}},"positions":{}}'
  const fixture = memoryStorage({ 'sfqc:learning-state:v1': oldRaw })
  const missing = readLearningState(lessonRegistry, () => fixture.storage)
  assert.equal(missing.status, 'missing')
  assert.equal(missing.state.schemaVersion, 2)
  assert.ok(lessonRegistry.lessons.every((lesson) => missing.state.lessons[lesson.lessonId].completedAt === null))
  assert.deepEqual(fixture.access, [['getItem', LEARNING_STATE_KEY]])
  assert.equal(fixture.values.get('sfqc:learning-state:v1'), oldRaw)

  const oldRegistry = { ...lessonRegistry, lessons: [firstLesson] }
  const raw = serializeLearningState({
    schemaVersion: 2,
    lessons: { [firstLesson.lessonId]: { completedAt: null }, 'retired-lesson': { completedAt: timestamp } },
  }, oldRegistry)
  const current = memoryStorage({ [LEARNING_STATE_KEY]: raw })
  const read = readLearningState(lessonRegistry, () => current.storage)
  assert.deepEqual(read.unresolvedIds, { lessons: ['retired-lesson'] })
  assert.deepEqual(read.state.lessons[lessonRegistry.lessons[1].lessonId], { completedAt: null })
  const candidate = structuredClone(read.state)
  candidate.lessons[firstLesson.lessonId].completedAt = timestamp
  const saved = saveLearningState(candidate, raw, lessonRegistry, () => current.storage)
  assert.equal(saved.status, 'saved')
  assert.deepEqual(parseLearningState(saved.candidateRaw).state.lessons['retired-lesson'], { completedAt: timestamp })
})

test('v2 rejects changes to unresolved IDs, positions, malformed values, planned completion, and unknown fields', () => {
  const registry = { ...lessonRegistry, lessons: [firstLesson] }
  const initial = serializeLearningState({
    schemaVersion: 2,
    lessons: { [firstLesson.lessonId]: { completedAt: null }, 'removed-lesson': { completedAt: null } },
  }, registry)
  const read = parseLearningState(initial, registry)
  const fixture = memoryStorage({ [LEARNING_STATE_KEY]: initial })
  for (const change of [
    (state) => { delete state.lessons['removed-lesson'] },
    (state) => { state.lessons['removed-lesson'] = { completedAt: timestamp } },
  ]) {
    const current = structuredClone(read.state)
    change(current)
    assert.equal(saveLearningState(current, initial, registry, () => fixture.storage).status, 'not-written')
  }
  assert.equal(fixture.calls.writes.length, 0)

  const planned = lessonRegistry.lessons.find((lesson) => lesson.availability === 'planned')
  if (planned) assert.throws(() => serializeLearningState({
    schemaVersion: 2, lessons: { [planned.lessonId]: { completedAt: timestamp } },
  }, { ...lessonRegistry, lessons: [planned] }), (error) => error instanceof LearningStateError && error.code === 'invalid-schema')
  for (const invalid of [
    { schemaVersion: 1, lessons: {} },
    { schemaVersion: 2, lessons: { 'bad id': { completedAt: null } } },
    { schemaVersion: 2, lessons: { 'unknown-lesson': { completedAt: '2026-02-30T00:00:00.000Z' } } },
    { schemaVersion: 2, lessons: {}, positions: {} },
  ]) assert.throws(() => serializeLearningState(invalid, registry), LearningStateError)
})

test('v2 keeps UTF-8 size and storage error handling', () => {
  const state = emptyState()
  const registry = { ...lessonRegistry, lessons: [] }
  const small = serializeLearningState(state, registry)
  const tooLarge = { schemaVersion: 2, lessons: { ['x'.repeat(LEARNING_STATE_MAX_BYTES)]: { completedAt: null } } }
  assert.throws(() => serializeLearningState(tooLarge, registry), (error) => error.code === 'too-large')
  assert.ok(new TextEncoder().encode(small).byteLength < LEARNING_STATE_MAX_BYTES)

  assert.equal(readLearningState(lessonRegistry, () => { throw new Error() }).status, 'unreadable')
  assert.equal(readLearningState(lessonRegistry, () => ({ getItem() { throw new Error() } })).status, 'unreadable')
  assert.equal(readLearningState(lessonRegistry, () => ({ getItem() { return '{' } })).status, 'invalid')
  assert.equal(readLearningState(lessonRegistry, () => ({ getItem() { return '{"schemaVersion":1,"lessons":{}}' } })).status, 'unsupported')

  const fixture = memoryStorage({ [LEARNING_STATE_KEY]: small })
  fixture.config.failSet = () => true
  const changed = { schemaVersion: 2, lessons: { [firstLesson.lessonId]: { completedAt: timestamp } } }
  const failed = saveLearningState(changed, small, { ...lessonRegistry, lessons: [firstLesson] }, () => fixture.storage)
  assert.equal(failed.status, 'not-written')
  assert.equal(fixture.values.get(LEARNING_STATE_KEY), small)

  const afterWrite = memoryStorage()
  afterWrite.config.failSet = (key, value) => { afterWrite.values.set(key, value); return true }
  assert.equal(saveLearningState(state, null, registry, () => afterWrite.storage).status, 'saved')
})

test('learning save distinguishes a post-write unknown result from a stale raw conflict', () => {
  const registry = { ...lessonRegistry, lessons: [firstLesson] }
  const raw = serializeLearningState(emptyState(), registry)
  const fixture = memoryStorage()
  fixture.config.failGet = (key, count) => key === LEARNING_STATE_KEY && count === 2
  const unknown = saveLearningState({ schemaVersion: 2, lessons: { [firstLesson.lessonId]: { completedAt: null } } }, null,
    registry, () => fixture.storage)
  assert.equal(unknown.status, 'unknown')
  assert.equal(fixture.values.get(LEARNING_STATE_KEY), unknown.candidateRaw)

  fixture.config.failGet = () => false
  const external = serializeLearningState({ schemaVersion: 2, lessons: { [firstLesson.lessonId]: { completedAt: timestamp } } }, registry)
  fixture.values.set(LEARNING_STATE_KEY, external)
  assert.equal(saveLearningState(emptyState(), raw, registry, () => fixture.storage).status, 'conflict')
  assert.equal(fixture.values.get(LEARNING_STATE_KEY), external)
})

test('registry rename starts the new lesson empty and preserves the former ID as unresolved', () => {
  const renamed = { ...firstLesson, lessonId: 'renamed-topic' }
  const originalRegistry = { ...lessonRegistry, lessons: [firstLesson] }
  const renamedRegistry = { ...lessonRegistry, lessons: [renamed] }
  const raw = serializeLearningState({ schemaVersion: 2,
    lessons: { [firstLesson.lessonId]: { completedAt: timestamp } } }, originalRegistry)
  const parsed = parseLearningState(raw, renamedRegistry)
  assert.deepEqual(parsed.state.lessons['renamed-topic'], { completedAt: null })
  assert.deepEqual(parsed.unresolvedIds, { lessons: [firstLesson.lessonId] })
  assert.deepEqual(parsed.state.lessons[firstLesson.lessonId], { completedAt: timestamp })
})
