import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveRoute, resolveScreen, routeToHash } from '../src/resolve-screen.mjs'

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

test('unknown and malformed routes are not found', () => {
  for (const hash of ['#/unknown', '#/lesson?lessonId=descriptive-statistics', '#/lesson/descriptive-statistics/%20']) {
    assert.equal(resolveScreen(hash), 'not-found', hash)
  }
})

test('ID routes resolve without checking whether the ID exists', () => {
  assert.deepEqual(resolveRoute('#/lesson/descriptive-statistics/variance'), {
    kind: 'lesson-id', lessonId: 'descriptive-statistics', sectionId: 'variance',
  })
  assert.deepEqual(resolveRoute('#/practice/not-in-storage'), { kind: 'practice-id', instanceId: 'not-in-storage' })
  assert.deepEqual(resolveRoute('#/feedback/not-in-storage'), { kind: 'feedback-id', attemptId: 'not-in-storage' })
  assert.equal(resolveScreen('#/lesson/descriptive-statistics'), 'lesson')
  assert.equal(resolveScreen('#/practice/not-in-storage'), 'practice')
})

test('practice and feedback IDs round-trip each URL segment exactly once', () => {
  for (const id of ['a/b', 'a#b', 'a%b', '日本語', '%2F']) {
    const practice = routeToHash({ kind: 'practice-id', instanceId: id })
    const feedback = routeToHash({ kind: 'feedback-id', attemptId: id })
    assert.deepEqual(resolveRoute(practice), { kind: 'practice-id', instanceId: id })
    assert.deepEqual(resolveRoute(feedback), { kind: 'feedback-id', attemptId: id })
  }
})

test('empty IDs, malformed encoding and extra path segments are rejected', () => {
  for (const hash of ['#/practice/', '#/practice/%', '#/feedback/%E0%A4%A', '#/feedback/x/extra', '#/lesson/%20']) {
    assert.equal(resolveRoute(hash).kind, 'not-found', hash)
  }
})
