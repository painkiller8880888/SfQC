import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveRouteData } from '../src/route-data.mjs'

test('included lesson and section routes resolve from the lesson registry', () => {
  const lesson = resolveRouteData({ kind: 'lesson-id', lessonId: 'math-algebra-sigma', sectionId: 'sigma' })
  assert.equal(lesson.status, 'lesson')
  if (lesson.status === 'lesson') {
    assert.equal(lesson.lesson.lessonId, 'math-algebra-sigma')
    assert.equal(lesson.section?.sectionId, 'sigma')
  }
  const overview = resolveRouteData({ kind: 'lesson-id', lessonId: 'math-algebra-sigma', sectionId: null })
  assert.equal(overview.status, 'lesson')
  if (overview.status === 'lesson') assert.equal(overview.section, null)
})

test('course routes resolve the new lesson and independent practice pages', () => {
  const lesson = resolveRouteData({ kind: 'course-lesson', courseId: 'descriptive-statistics', sectionId: 'variance' })
  assert.equal(lesson.status, 'lesson')
  if (lesson.status === 'lesson') {
    assert.equal(lesson.lesson.lessonId, 'descriptive-statistics')
    assert.equal(lesson.section?.sectionId, 'variance')
  }
  assert.equal(resolveRouteData({ kind: 'course-practice', courseId: 'descriptive-statistics' }).status, 'course-practice')
  assert.deepEqual(resolveRouteData({ kind: 'course-lesson', courseId: 'descriptive-statistics', sectionId: 'missing' }), {
    status: 'unknown-id', target: 'section',
  })
})

test('retired lesson routes and unknown IDs cannot resolve to saved snapshot data', () => {
  assert.deepEqual(resolveRouteData({ kind: 'lesson-id', lessonId: 'descriptive-statistics', sectionId: null }), {
    status: 'unknown-id', target: 'lesson',
  })
  assert.deepEqual(resolveRouteData({ kind: 'lesson-id', lessonId: 'missing-lesson', sectionId: null }), {
    status: 'unknown-id', target: 'lesson',
  })
  assert.equal(resolveRouteData({ kind: 'course-practice', courseId: 'mean-inference' }).status, 'unavailable-lesson')
  assert.deepEqual(resolveRouteData({ kind: 'map' }), { status: 'screen' })
})
