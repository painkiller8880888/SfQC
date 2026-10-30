import assert from 'node:assert/strict'
import test from 'node:test'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import {
  countCompletedManualProgress,
  createInitialManualProgress,
  updateManualProgress,
} from '../src/manual-progress.mjs'

test('manual progress initializes independently for every registry lesson and objective', () => {
  const progress = createInitialManualProgress(lessonRegistry)

  assert.deepEqual(Object.keys(progress), lessonRegistry.lessons.map((lesson) => lesson.lessonId))
  for (const lesson of lessonRegistry.lessons) {
    assert.deepEqual(progress[lesson.lessonId], {
      status: 'not-started',
      checks: lesson.learningObjectives.map(() => false),
      completedAt: null,
    })
  }

  const [first, second] = lessonRegistry.lessons
  const started = updateManualProgress(progress, first.lessonId, { type: 'start' })
  assert.equal(started[first.lessonId].status, 'started')
  assert.equal(progress[first.lessonId].status, 'not-started')
  assert.strictEqual(started[second.lessonId], progress[second.lessonId])
  assert.equal(countCompletedManualProgress(started, lessonRegistry), 0)
})

test('manual progress follows explicit transitions, keeps checks, and only clears completion time on reopen', () => {
  const progress = createInitialManualProgress(lessonRegistry)
  const lessonId = lessonRegistry.lessons[0].lessonId
  const timestamp = '2026-10-30T12:34:56.000Z'
  const objectiveCount = progress[lessonId].checks.length

  assert.strictEqual(updateManualProgress(progress, lessonId, { type: 'check', index: 0, checked: false }), progress)
  let current = updateManualProgress(progress, lessonId, { type: 'check', index: 0, checked: true })
  assert.equal(current[lessonId].status, 'started')
  assert.equal(current[lessonId].checks[0], true)
  assert.strictEqual(updateManualProgress(current, lessonId, { type: 'start' }), current)

  for (let index = 1; index < objectiveCount; index += 1) {
    current = updateManualProgress(current, lessonId, { type: 'check', index, checked: true })
  }
  assert.equal(current[lessonId].status, 'started', 'checking every objective does not complete the lesson')
  assert.ok(current[lessonId].checks.every(Boolean))

  const completed = updateManualProgress(current, lessonId, { type: 'complete', completedAt: timestamp })
  assert.equal(completed[lessonId].status, 'completed')
  assert.equal(completed[lessonId].completedAt, timestamp)
  assert.deepEqual(completed[lessonId].checks, current[lessonId].checks)
  assert.strictEqual(updateManualProgress(completed, lessonId, { type: 'complete', completedAt: '2026-10-31T00:00:00.000Z' }), completed)
  assert.strictEqual(updateManualProgress(completed, lessonId, { type: 'start' }), completed)

  const changedWhileCompleted = updateManualProgress(completed, lessonId, { type: 'check', index: 0, checked: false })
  assert.equal(changedWhileCompleted[lessonId].status, 'completed')
  assert.equal(changedWhileCompleted[lessonId].completedAt, timestamp)
  assert.equal(changedWhileCompleted[lessonId].checks[0], false)

  const reopened = updateManualProgress(changedWhileCompleted, lessonId, { type: 'reopen' })
  assert.equal(reopened[lessonId].status, 'started')
  assert.equal(reopened[lessonId].completedAt, null)
  assert.deepEqual(reopened[lessonId].checks, changedWhileCompleted[lessonId].checks)
  assert.strictEqual(updateManualProgress(reopened, lessonId, { type: 'reopen' }), reopened)
  assert.equal(countCompletedManualProgress(reopened, lessonRegistry), 0)
})

test('manual progress allows unchecked completion and ignores unknown lessons or invalid check indexes', () => {
  const progress = createInitialManualProgress(lessonRegistry)
  const lessonId = lessonRegistry.lessons[0].lessonId
  const completed = updateManualProgress(progress, lessonId, {
    type: 'complete',
    completedAt: '2026-10-30T12:34:56.000Z',
  })

  assert.equal(completed[lessonId].status, 'completed')
  assert.ok(completed[lessonId].checks.every((checked) => !checked))
  assert.strictEqual(updateManualProgress(progress, 'missing-lesson', { type: 'start' }), progress)
  for (const index of [-1, 0.5, progress[lessonId].checks.length]) {
    assert.strictEqual(updateManualProgress(progress, lessonId, { type: 'check', index, checked: true }), progress)
  }
  assert.strictEqual(updateManualProgress(progress, lessonId, { type: 'check', index: 0, checked: 'yes' }), progress)
  assert.equal(countCompletedManualProgress({ ...completed, unknown: { status: 'completed' } }, lessonRegistry), 1)
})
