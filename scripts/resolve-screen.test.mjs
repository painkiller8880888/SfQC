import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveScreen } from '../src/resolve-screen.mjs'

test('empty hash and root alias open the learning map', () => {
  assert.equal(resolveScreen(''), 'map')
  assert.equal(resolveScreen('#/'), 'map')
})

test('each known route resolves to its screen', () => {
  assert.deepEqual(
    ['map', 'lesson', 'practice', 'feedback', 'progress', 'data']
      .map((screen) => resolveScreen('#/' + screen)),
    ['map', 'lesson', 'practice', 'feedback', 'progress', 'data'],
  )
})

test('unknown and ID-bearing routes are not found', () => {
  for (const hash of [
    '#/unknown',
    '#/lesson/descriptive-statistics',
    '#/lesson?lessonId=descriptive-statistics',
  ]) {
    assert.equal(resolveScreen(hash), 'not-found', hash)
  }
})
