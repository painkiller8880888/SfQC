import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveCourseProgress } from '../src/course-progress.mjs'
import { lessonRegistry } from '../src/lesson-registry.mjs'

test('course progress keeps manual completion independent and sorts category rates stably', () => {
  const learningState = {
    schemaVersion: 1,
    lessons: {
      'descriptive-statistics': { completedAt: '2026-11-12T10:00:00.000Z' },
      'data-types': { completedAt: null },
    },
    positions: {},
  }
  const records = [
    { categoryId: 'mean-deviation', isCorrect: true, attemptedAt: '2026-11-01T00:00:00.000Z' },
    { categoryId: 'mean-deviation', isCorrect: true, attemptedAt: '2026-11-02T00:00:00.000Z' },
    { categoryId: 'mean-deviation', isCorrect: false, attemptedAt: '2026-11-03T00:00:00.000Z' },
    { categoryId: 'data-transformation', isCorrect: true, attemptedAt: '2026-11-04T00:00:00.000Z' },
    { categoryId: 'data-transformation', isCorrect: false, attemptedAt: '2026-11-05T00:00:00.000Z' },
    { categoryId: 'data-transformation', isCorrect: false, attemptedAt: '2026-11-06T00:00:00.000Z' },
    { categoryId: 'unbiased-variance', isCorrect: false, attemptedAt: '2026-11-07T00:00:00.000Z' },
    { categoryId: 'unbiased-variance', isCorrect: false, attemptedAt: '2026-11-08T00:00:00.000Z' },
    { categoryId: 'comprehensive', isCorrect: true, attemptedAt: '2026-11-09T00:00:00.000Z' },
    { categoryId: 'comprehensive', isCorrect: true, attemptedAt: '2026-11-10T00:00:00.000Z' },
    { categoryId: 'comprehensive', isCorrect: false, attemptedAt: '2026-11-10T01:00:00.000Z' },
    { categoryId: 'comprehensive', isCorrect: false, attemptedAt: '2026-11-10T02:00:00.000Z' },
    { categoryId: 'comprehensive', isCorrect: false, attemptedAt: '2026-11-10T03:00:00.000Z' },
    { categoryId: 'comprehensive', isCorrect: false, attemptedAt: '2026-11-10T04:00:00.000Z' },
  ]
  const progress = deriveCourseProgress(learningState, { schemaVersion: 1, records })
  const descriptive = progress.lessons.find((item) => item.lessonId === 'descriptive-statistics')
  const otherLessons = progress.lessons.filter((item) => item.correctRate === null).map((item) => item.lessonId)

  assert.equal(descriptive.completedAt, '2026-11-12T10:00:00.000Z')
  assert.equal(descriptive.attemptCount, records.length)
  assert.equal(descriptive.correctCount, 5)
  assert.equal(descriptive.correctRate, 5 / 14)
  assert.deepEqual(otherLessons, lessonRegistry.lessons.filter((item) => item.lessonId !== 'descriptive-statistics').map((item) => item.lessonId))
  assert.deepEqual(progress.categories.map((item) => item.categoryId), [
    'unbiased-variance', 'data-transformation', 'comprehensive', 'mean-deviation', 'variance-standard-deviation',
  ])
  assert.equal(progress.categories[1].correctRate, progress.categories[2].correctRate)
  assert.equal(progress.categories.at(-1).correctRate, null)
})

test('unrated categories stay in registry order and saved results do not complete a lesson', () => {
  const progress = deriveCourseProgress(null, { schemaVersion: 1, records: [
    { categoryId: 'variance-standard-deviation', isCorrect: true, attemptedAt: '2026-11-13T00:00:00.000Z' },
  ] })
  const completed = progress.lessons.find((item) => item.lessonId === 'descriptive-statistics')
  assert.equal(completed.completedAt, null)
  assert.deepEqual(progress.categories.slice(1).map((item) => item.categoryId), [
    'mean-deviation', 'data-transformation', 'unbiased-variance', 'comprehensive',
  ])
})
