import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveRoute, resolveScreen, routeToHash } from '../src/resolve-screen.mjs'

test('empty hash and root alias open the learning map', () => {
  assert.equal(resolveScreen(''), 'map')
  assert.equal(resolveScreen('#/'), 'map')
})

test('supported screen aliases and course routes resolve to their screens', () => {
  assert.deepEqual(
    ['map', 'lesson', 'progress', 'data'].map((screen) => resolveScreen('#/' + screen)),
    ['map', 'lesson', 'progress', 'data'],
  )
  assert.equal(resolveScreen('#/practice'), 'not-found')
  assert.equal(resolveScreen('#/feedback'), 'not-found')
  assert.equal(resolveScreen('#/course/descriptive-statistics/practice'), 'practice')
})

test('legacy practice, feedback, and basic-statistics lesson URLs are retired', () => {
  for (const hash of [
    '#/practice', '#/practice/instance-1', '#/feedback', '#/feedback/attempt-1',
    '#/lesson/descriptive-statistics', '#/lesson/descriptive-statistics/mean',
  ]) {
    assert.deepEqual(resolveRoute(hash), { kind: 'not-found' }, hash)
  }
  assert.equal(resolveScreen('#/lesson/math-algebra-sigma'), 'lesson')
  assert.deepEqual(resolveRoute('#/lesson/math-algebra-sigma/sigma'), {
    kind: 'lesson-id', lessonId: 'math-algebra-sigma', sectionId: 'sigma',
  })
})

test('course lesson and practice routes resolve as stable IDs and round-trip', () => {
  const lesson = { kind: 'course-lesson', courseId: 'descriptive-statistics', sectionId: 'standard-deviation' }
  const practice = { kind: 'course-practice', courseId: 'descriptive-statistics' }
  assert.equal(routeToHash(lesson), '#/course/descriptive-statistics/lesson/standard-deviation')
  assert.equal(routeToHash(practice), '#/course/descriptive-statistics/practice')
  assert.deepEqual(resolveRoute(routeToHash(lesson)), lesson)
  assert.deepEqual(resolveRoute(routeToHash(practice)), practice)
  assert.equal(resolveScreen(routeToHash(lesson)), 'lesson')
  assert.equal(resolveScreen(routeToHash(practice)), 'practice')
  for (const route of [
    { kind: 'course-lesson', courseId: 5, sectionId: 'mean' },
    { kind: 'course-lesson', courseId: 'descriptive-statistics', sectionId: {} },
    { kind: 'course-practice', courseId: {} },
    { kind: 'lesson-id', lessonId: 'descriptive-statistics', sectionId: null },
  ]) assert.throws(() => routeToHash(route), TypeError)
  for (const hash of ['#/course/descriptive-statistics/lesson/', '#/course/descriptive-statistics/practice/extra', '#/course/%20/practice']) {
    assert.deepEqual(resolveRoute(hash), { kind: 'not-found' }, hash)
  }
})

test('unknown and malformed routes are not found', () => {
  for (const hash of [
    '#/unknown', '#/lesson?lessonId=descriptive-statistics', '#/lesson/math-algebra-sigma/%20',
    '#/practice/', '#/feedback/%E0%A4%A', '#/feedback/x/extra', '#/lesson/%20',
  ]) assert.deepEqual(resolveRoute(hash), { kind: 'not-found' }, hash)
})
