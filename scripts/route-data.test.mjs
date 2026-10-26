import assert from 'node:assert/strict'
import test from 'node:test'
import { fixedInstance } from './question-contract.fixture.mjs'
import { gradeQuestionAnswer } from '../src/question-grading.mjs'
import { resolveRouteData, validateRouteHistoryReferences } from '../src/route-data.mjs'
import { createRouteHistoryState, navigateRouteHistory } from '../src/route-history.mjs'
import { routeToHash } from '../src/resolve-screen.mjs'

const emptyData = {
  schemaVersion: 2,
  questionInstances: [],
  answerAttempts: [],
  reviewEvents: [],
}
const read = (data = emptyData) => ({ status: 'ok', raw: JSON.stringify(data), data })

test('known lessons, sections, snapshots and attempts resolve from their source registries', () => {
  assert.equal(resolveRouteData({ kind: 'lesson-id', lessonId: 'descriptive-statistics', sectionId: 'variance' }, read()).status, 'lesson')
  assert.equal(resolveRouteData({ kind: 'lesson-id', lessonId: 'descriptive-statistics', sectionId: null }, read()).status, 'lesson')

  const answer = fixedInstance.questionDefinitionSnapshot.content.correctAnswer
  const attempt = {
    attemptId: 'saved-attempt',
    instanceId: fixedInstance.instanceId,
    answer,
    gradingResult: gradeQuestionAnswer(fixedInstance, answer),
    attemptedAt: '2026-10-26T00:00:00.000Z',
  }
  const data = { ...emptyData, questionInstances: [fixedInstance], answerAttempts: [attempt] }
  assert.equal(resolveRouteData({ kind: 'practice-id', instanceId: fixedInstance.instanceId }, read(data)).status, 'practice')
  const feedback = resolveRouteData({ kind: 'feedback-id', attemptId: attempt.attemptId }, read(data))
  assert.equal(feedback.status, 'feedback')
  if (feedback.status === 'feedback') {
    assert.equal(feedback.instance.instanceId, fixedInstance.instanceId)
    assert.equal(feedback.attempt.answer, answer)
  }
})

test('unknown IDs in valid data stay distinct from damaged local data', () => {
  assert.deepEqual(resolveRouteData({ kind: 'feedback-id', attemptId: 'missing' }, read()), {
    status: 'unknown-id', target: 'attempt',
  })
  const error = new Error('保存データが破損しています。')
  assert.deepEqual(resolveRouteData({ kind: 'practice-id', instanceId: 'missing' }, {
    status: 'invalid', raw: '{}', error,
  }), { status: 'data-error', error })
})

test('attempts without their referenced snapshot report a data error', () => {
  const attempt = {
    attemptId: 'orphan', instanceId: 'missing-snapshot', answer: '1',
    gradingResult: { status: 'graded', isCorrect: false, feedback: null },
    attemptedAt: '2026-10-26T00:00:00.000Z',
  }
  assert.equal(resolveRouteData({ kind: 'feedback-id', attemptId: 'orphan' }, read({
    ...emptyData, answerAttempts: [attempt],
  })).status, 'data-error')
})

test('resume references must point to an attempt for the same practice snapshot', () => {
  const answer = fixedInstance.questionDefinitionSnapshot.content.correctAnswer
  const attempt = {
    attemptId: 'resume-attempt', instanceId: fixedInstance.instanceId, answer,
    gradingResult: gradeQuestionAnswer(fixedInstance, answer), attemptedAt: '2026-10-26T00:00:00.000Z',
  }
  const saved = read({ ...emptyData, questionInstances: [fixedInstance], answerAttempts: [attempt] })
  const practice = { kind: 'practice-id', instanceId: fixedInstance.instanceId }
  const resume = createRouteHistoryState(practice, routeToHash(practice), {
    entryId: 'resume-entry', resumeAttemptId: attempt.attemptId, draft: answer,
  })
  const review = { kind: 'lesson-id', lessonId: 'math-algebra-sigma', sectionId: 'sigma' }
  const fromReview = navigateRouteHistory(resume, review, routeToHash(review), 'review', { entryId: 'review-entry' })
  assert.equal(validateRouteHistoryReferences(fromReview, saved), true)
  assert.equal(validateRouteHistoryReferences(fromReview, read()), false)

  const mismatched = createRouteHistoryState({ kind: 'practice-id', instanceId: 'other-instance' }, '#/practice/other-instance', {
    entryId: 'bad-resume', resumeAttemptId: attempt.attemptId,
  })
  assert.equal(validateRouteHistoryReferences(mismatched, saved), false)
  assert.equal(validateRouteHistoryReferences(mismatched, { status: 'invalid', raw: '{}', error: new Error('bad') }), false)
})
