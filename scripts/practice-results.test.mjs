import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PRACTICE_CATEGORY_IDS, PRACTICE_RESULTS_KEY, PRACTICE_RESULTS_MAX_RECORDS, PracticeResultsError,
  appendPracticeResult, parsePracticeResults, readPracticeResults, recheckPracticeResult, serializePracticeResults,
} from '../src/practice-results.mjs'

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  const access = []
  const reads = new Map()
  const writes = []
  const config = { failGet: () => false, failSet: () => false }
  const storage = {
    getItem(key) {
      access.push(['getItem', key])
      const count = (reads.get(key) ?? 0) + 1
      reads.set(key, count)
      if (config.failGet(key, count)) throw new Error('read failed')
      return values.get(key) ?? null
    },
    setItem(key, value) {
      access.push(['setItem', key])
      writes.push([key, value])
      if (config.failSet(key, value, writes.length)) throw new Error('write failed')
      values.set(key, value)
    },
    removeItem(key) { access.push(['removeItem', key]); values.delete(key) },
  }
  return { storage, values, access, reads, writes, config }
}

function record(index, attemptedAt = `2026-11-${String(index).padStart(2, '0')}T00:00:00.000Z`) {
  return { categoryId: PRACTICE_CATEGORY_IDS[index % PRACTICE_CATEGORY_IDS.length], isCorrect: index % 2 === 0, attemptedAt }
}

test('practice results validate the fixed categories and strict UTC record shape', () => {
  assert.deepEqual(PRACTICE_CATEGORY_IDS, [
    'mean-deviation', 'data-transformation', 'unbiased-variance', 'comprehensive', 'variance-standard-deviation',
  ])
  const raw = serializePracticeResults({ schemaVersion: 1, records: [record(1)] })
  assert.deepEqual(parsePracticeResults(raw), { schemaVersion: 1, records: [record(1)] })
  for (const invalid of [
    { schemaVersion: 2, records: [] },
    { schemaVersion: 1, records: [{ ...record(1), categoryId: 'other' }] },
    { schemaVersion: 1, records: [{ ...record(1), isCorrect: 'true' }] },
    { schemaVersion: 1, records: [{ ...record(1), attemptedAt: '2026-02-30T00:00:00.000Z' }] },
    { schemaVersion: 1, records: [{ ...record(1), answer: 'leak' }] },
    { schemaVersion: 1, records: Array(26).fill(record(1)) },
  ]) assert.throws(() => serializePracticeResults(invalid), PracticeResultsError)
  assert.throws(() => parsePracticeResults('{'), (error) => error.code === 'invalid-json')
})

test('practice results keep only the newest 25 in append order without timestamp sorting', () => {
  const past = Array.from({ length: 25 }, (_, index) => record(index, `2099-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`))
  const raw = serializePracticeResults({ schemaVersion: 1, records: past })
  const fixture = memoryStorage({ [PRACTICE_RESULTS_KEY]: raw })
  const saved = appendPracticeResult({ categoryId: 'comprehensive', isCorrect: true }, raw, () => fixture.storage)
  assert.equal(saved.status, 'saved')
  const parsed = parsePracticeResults(saved.candidateRaw)
  assert.equal(parsed.records.length, PRACTICE_RESULTS_MAX_RECORDS)
  assert.deepEqual(parsed.records.slice(0, 2), past.slice(1, 3))
  assert.deepEqual(parsed.records.at(-1), saved.record)
  assert.ok(saved.record.attemptedAt < past.at(-1).attemptedAt)
  assert.equal(fixture.writes.length, 1)
  assert.equal(fixture.writes[0][0], PRACTICE_RESULTS_KEY)
})

test('practice save reports storage failures, invalid data, and raw conflicts without overwrite', () => {
  const empty = serializePracticeResults({ schemaVersion: 1, records: [] })
  const failing = memoryStorage()
  failing.config.failSet = () => true
  assert.equal(appendPracticeResult({ categoryId: 'mean-deviation', isCorrect: true }, null, () => failing.storage).status, 'not-written')
  assert.equal(failing.values.has(PRACTICE_RESULTS_KEY), false)

  const persistedThenThrew = memoryStorage()
  persistedThenThrew.config.failSet = (key, value) => { persistedThenThrew.values.set(key, value); return true }
  assert.equal(appendPracticeResult({ categoryId: 'mean-deviation', isCorrect: true }, null, () => persistedThenThrew.storage).status, 'saved')

  const invalid = memoryStorage({ [PRACTICE_RESULTS_KEY]: '{' })
  assert.equal(readPracticeResults(() => invalid.storage).status, 'invalid')
  assert.equal(appendPracticeResult({ categoryId: 'mean-deviation', isCorrect: true }, '{', () => invalid.storage).status, 'not-written')
  assert.equal(invalid.values.get(PRACTICE_RESULTS_KEY), '{')

  const changed = memoryStorage({ [PRACTICE_RESULTS_KEY]: empty })
  const external = serializePracticeResults({ schemaVersion: 1, records: [record(4)] })
  changed.values.set(PRACTICE_RESULTS_KEY, external)
  const conflict = appendPracticeResult({ categoryId: 'mean-deviation', isCorrect: true }, empty, () => changed.storage)
  assert.equal(conflict.status, 'conflict')
  assert.equal(changed.values.get(PRACTICE_RESULTS_KEY), external)
  assert.equal(changed.writes.length, 0)
})

test('unknown practice writes can be rechecked once without adding the same attempt again', () => {
  const fixture = memoryStorage()
  fixture.config.failGet = (key, count) => key === PRACTICE_RESULTS_KEY && count === 2
  const unknown = appendPracticeResult({ categoryId: 'variance-standard-deviation', isCorrect: false }, null, () => fixture.storage)
  assert.equal(unknown.status, 'unknown')
  assert.equal(parsePracticeResults(unknown.candidateRaw).records.length, 1)
  assert.equal(fixture.writes.length, 1)
  fixture.config.failGet = () => false
  const saved = recheckPracticeResult(unknown, () => fixture.storage)
  assert.equal(saved.status, 'saved')
  assert.equal(fixture.writes.length, 1)

  const competing = serializePracticeResults({ schemaVersion: 1, records: [record(2)] })
  fixture.values.set(PRACTICE_RESULTS_KEY, competing)
  const conflict = recheckPracticeResult(unknown, () => fixture.storage)
  assert.equal(conflict.status, 'conflict')
  assert.equal(fixture.values.get(PRACTICE_RESULTS_KEY), competing)
  assert.equal(fixture.writes.length, 1)
})
