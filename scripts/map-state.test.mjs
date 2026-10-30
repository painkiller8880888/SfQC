import test from 'node:test'
import assert from 'node:assert/strict'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import { createInitialMapState, MAP_STATE_KEY, MAP_STATE_MAX_BYTES, parseMapState, readMapState, saveMapState, serializeMapState } from '../src/map-state.mjs'

function storageWith(raw = null) {
  const values = new Map(raw === null ? [] : [[MAP_STATE_KEY, raw]])
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

test('missing map state initializes in memory and persists only on explicit save', () => {
  const storage = storageWith()
  const read = readMapState(lessonRegistry, () => storage)
  assert.equal(read.status, 'missing')
  assert.equal(Object.keys(read.state.lessons).length, 34)
  assert.equal(storage.getItem(MAP_STATE_KEY), null)
  const saved = saveMapState(read.state, read.raw, lessonRegistry, () => storage)
  assert.equal(readMapState(lessonRegistry, () => storage).status, 'ok')
  assert.equal(saved.status, 'saved')
})

test('lesson revision resets its checks but keeps status and time; curriculum revision alone does not reset checks', () => {
  const source = createInitialMapState(lessonRegistry)
  const lesson = lessonRegistry.lessons[0]
  source.lessons[lesson.lessonId] = { ...source.lessons[lesson.lessonId], status: 'completed', completedAt: '2026-10-30T00:00:00.000Z', checks: source.lessons[lesson.lessonId].checks.map(() => true) }
  source.curriculumRevision++
  const registry = { ...lessonRegistry, curriculumRevision: lessonRegistry.curriculumRevision + 2,
    lessons: lessonRegistry.lessons.map((item) => item.lessonId === lesson.lessonId ? { ...item, revision: item.revision + 1 } : item) }
  const migrated = parseMapState(serializeMapState(source), registry)
  assert.deepEqual(migrated.changedLessonIds, [lesson.lessonId])
  assert.equal(migrated.state.lessons[lesson.lessonId].status, 'completed')
  assert.equal(migrated.state.lessons[lesson.lessonId].completedAt, '2026-10-30T00:00:00.000Z')
  assert.ok(migrated.state.lessons[lesson.lessonId].checks.every((check) => !check))
})

test('same-revision objective edits retain only unique exact matches and preserve unknown lesson IDs and positions', () => {
  const state = createInitialMapState(lessonRegistry)
  const lesson = lessonRegistry.lessons[0]
  state.lessons[lesson.lessonId].checks[0] = true
  state.lessons['future-topic'] = { ...state.lessons[lesson.lessonId] }
  state.positions['future-topic'] = { x: 4, y: -3 }
  const registry = { ...lessonRegistry, lessons: lessonRegistry.lessons.map((item) => item.lessonId === lesson.lessonId
    ? { ...item, learningObjectives: ['新しい目標', ...item.learningObjectives] } : item) }
  const migrated = parseMapState(serializeMapState(state), registry)
  assert.equal(migrated.state.lessons[lesson.lessonId].checks[0], false)
  assert.equal(migrated.state.lessons[lesson.lessonId].checks[1], true)
  assert.deepEqual(migrated.state.positions['future-topic'], { x: 4, y: -3 })
  assert.ok(migrated.state.lessons['future-topic'])
})

test('corrupt, unsupported, oversize and storage conflicts never overwrite existing map state', () => {
  assert.throws(() => parseMapState('{', lessonRegistry), (error) => error.code === 'invalid-json')
  assert.throws(() => parseMapState(JSON.stringify({ schemaVersion: 8 }), lessonRegistry), (error) => error.code === 'unsupported-version')
  const storage = storageWith('{bad')
  const damaged = storage.getItem(MAP_STATE_KEY)
  assert.equal(readMapState(lessonRegistry, () => storage).status, 'invalid')
  assert.throws(() => saveMapState(createInitialMapState(lessonRegistry), damaged, lessonRegistry, () => storage), (error) => error.code === 'invalid-json')
  assert.equal(storage.getItem(MAP_STATE_KEY), damaged)
  const read = readMapState(lessonRegistry, () => storageWith())
  const changed = storageWith(serializeMapState(read.state))
  changed.setItem(MAP_STATE_KEY, '{}')
  assert.throws(() => saveMapState(read.state, read.raw, lessonRegistry, () => changed), (error) => error.code === 'storage-changed')
  assert.throws(() => serializeMapState({ ...read.state, positions: Object.fromEntries(Array.from({ length: 2000 }, (_, i) => ['lesson-' + i, { x: i, y: i }])) }), (error) => error.code === 'too-large')
})

test('map state accepts exactly 64 KiB of UTF-8 and rejects one byte more', () => {
  const state = createInitialMapState(lessonRegistry)
  state.lessons['future-topic'] = {
    status: 'not-started', checks: [false], completedAt: null, lessonRevision: 1, objectives: ['x'],
  }
  const sizeWithOneByte = new TextEncoder().encode(serializeMapState(state)).byteLength
  state.lessons['future-topic'].objectives[0] = 'x'.repeat(MAP_STATE_MAX_BYTES - sizeWithOneByte + 1)
  const atLimit = serializeMapState(state)
  assert.equal(new TextEncoder().encode(atLimit).byteLength, MAP_STATE_MAX_BYTES)
  assert.equal(readMapState(lessonRegistry, () => storageWith(atLimit)).status, 'ok')
  state.lessons['future-topic'].objectives[0] += 'x'
  assert.throws(() => serializeMapState(state), (error) => error.code === 'too-large')
})

test('map-state validation rejects sparse check and objective arrays', () => {
  const state = createInitialMapState(lessonRegistry)
  const lessonId = lessonRegistry.lessons[0].lessonId
  state.lessons[lessonId].checks = Array(1)
  assert.throws(() => serializeMapState(state), (error) => error.code === 'invalid-schema')
  state.lessons[lessonId].checks = [false]
  state.lessons[lessonId].objectives = Array(1)
  assert.throws(() => serializeMapState(state), (error) => error.code === 'invalid-schema')
})
