import assert from 'node:assert/strict'
import test from 'node:test'
import { exportLocalData, importLocalData, parseLocalData, serializeLocalData } from '../src/local-data.mjs'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import { deriveProgress } from '../src/progress-data.mjs'
import { gradeQuestionAnswer } from '../src/question-grading.mjs'
import { createQuestionInstance } from '../src/question-contract.mjs'
import { fixedDefinition } from './question-contract.fixture.mjs'

const DAY_MS = 24 * 60 * 60 * 1000
const emptyData = () => ({ schemaVersion: 2, questionInstances: [], answerAttempts: [], reviewEvents: [] })
const findLesson = (progress, lessonId) => progress.lessons.find((lesson) => lesson.lessonId === lessonId)

function makeInstance(instanceId, lessonRefs, feedbackRef, questionId = 'q-progress-shared') {
  const definition = structuredClone(fixedDefinition)
  definition.questionId = questionId
  definition.lessonRefs = lessonRefs
  const content = definition.content
  const wrongChoice = content.choices.find((choice) => choice.id !== content.correctAnswer)
  content.feedbackRules = [{
    choiceId: wrongChoice.id,
    explanation: '誤答内容を確認します。',
    lessonRef: feedbackRef,
  }]
  return createQuestionInstance(definition, { instanceId })
}

function makeAttempt(instance, attemptId, correct, attemptedAt) {
  const content = instance.questionDefinitionSnapshot.content
  const answer = correct
    ? content.correctAnswer
    : content.choices.find((choice) => choice.id !== content.correctAnswer).id
  return {
    attemptId,
    instanceId: instance.instanceId,
    answer,
    gradingResult: gradeQuestionAnswer(instance, answer),
    attemptedAt,
  }
}

function makeReview(reviewEventId, sourceAttemptId, targetRef, reviewedAt) {
  return { reviewEventId, sourceAttemptId, targetRef, reviewedAt }
}

test('empty, unanswered, correct-only, and mixed attempts keep observed states and denominators explicit', () => {
  const now = Date.parse('2026-10-27T00:00:00.000Z')
  const empty = findLesson(deriveProgress(emptyData(), lessonRegistry, now), 'descriptive-statistics')
  assert.equal(empty.state, '演習記録なし')
  assert.equal(empty.correctRate, null)
  assert.equal(empty.lastAttemptAt, null)

  const unanswered = makeInstance('progress-unanswered', ['descriptive-statistics#variance'], 'descriptive-statistics#variance')
  const correctOnly = makeInstance('progress-correct', ['descriptive-statistics#variance'], 'descriptive-statistics#variance')
  const wrongOnly = makeInstance('progress-wrong', ['descriptive-statistics#variance'], 'descriptive-statistics#variance')
  const data = {
    ...emptyData(),
    questionInstances: [unanswered, correctOnly, wrongOnly],
    answerAttempts: [
      makeAttempt(correctOnly, 'progress-correct-attempt', true, '2026-10-25T00:00:00.000Z'),
      makeAttempt(wrongOnly, 'progress-wrong-attempt', false, '2026-10-26T00:00:00.000Z'),
    ],
  }
  const progress = findLesson(deriveProgress(data, lessonRegistry, now), 'descriptive-statistics')
  assert.equal(progress.state, '未回答の出題あり')
  assert.equal(progress.questionInstanceCount, 3)
  assert.equal(progress.answeredInstanceCount, 2)
  assert.equal(progress.unansweredInstanceCount, 1)
  assert.equal(progress.attemptCount, 2)
  assert.equal(progress.correctCount, 1)
  assert.equal(progress.incorrectCount, 1)
  assert.equal(progress.correctRate, 0.5)
  assert.equal(progress.reviewCandidates.length, 1)
})

test('repeated answers count as attempts while multiple section refs in one unit count each instance once', () => {
  const refs = ['descriptive-statistics#variance', 'descriptive-statistics#mean', 'math-algebra-sigma#sigma']
  const first = makeInstance('progress-shared-1', refs, 'descriptive-statistics#variance')
  const second = makeInstance('progress-shared-2', refs, 'descriptive-statistics#variance')
  const unanswered = makeInstance('progress-shared-3', refs, 'descriptive-statistics#variance')
  assert.equal(first.questionId, second.questionId)
  const data = {
    ...emptyData(),
    questionInstances: [first, second, unanswered],
    answerAttempts: [
      makeAttempt(first, 'shared-attempt-a', false, '2026-10-25T00:00:00.000Z'),
      makeAttempt(first, 'shared-attempt-b', true, '2026-10-26T00:00:00.000Z'),
      makeAttempt(second, 'shared-attempt-c', false, '2026-10-26T00:00:00.000Z'),
    ],
  }
  const progress = deriveProgress(data, lessonRegistry, Date.parse('2026-10-27T00:00:00.000Z'))
  const descriptive = findLesson(progress, 'descriptive-statistics')
  const sigma = findLesson(progress, 'math-algebra-sigma')
  assert.equal(descriptive.questionInstanceCount, 3)
  assert.equal(descriptive.answeredInstanceCount, 2)
  assert.equal(descriptive.unansweredInstanceCount, 1)
  assert.equal(descriptive.attemptCount, 3)
  assert.equal(descriptive.correctCount, 1)
  assert.equal(descriptive.incorrectCount, 2)
  assert.equal(descriptive.reviewCandidates[0].attemptCount, 2)
  assert.deepEqual(descriptive.reviewCandidates[0].attemptIds, ['shared-attempt-c', 'shared-attempt-a'])
  assert.equal(descriptive.reviewCandidates[0].attemptId, 'shared-attempt-c')
  assert.equal(sigma.questionInstanceCount, 3)
  assert.equal(sigma.attemptCount, 3)
  assert.equal(descriptive.attemptCount + sigma.attemptCount, 6)
  assert.equal(data.answerAttempts.length, 3)
})

test('cross-unit feedback and review visits keep feedback target, visit target, and source attempt separate', () => {
  const varianceRef = 'descriptive-statistics#variance'
  const sigmaRef = 'math-algebra-sigma#sigma'
  const a = makeInstance('progress-a', [varianceRef], varianceRef)
  const b = makeInstance('progress-b', [varianceRef], varianceRef)
  const c = makeInstance('progress-c', [varianceRef], sigmaRef)
  const d = makeInstance('progress-d', [varianceRef], varianceRef)
  const attempts = [
    makeAttempt(a, 'attempt-a', false, '2026-10-25T00:00:00.000Z'),
    makeAttempt(b, 'attempt-b', false, '2026-10-26T00:00:00.000Z'),
    makeAttempt(c, 'attempt-c', false, '2026-10-27T00:00:00.000Z'),
    makeAttempt(d, 'attempt-d', false, '2026-10-24T00:00:00.000Z'),
  ]
  const data = {
    ...emptyData(),
    questionInstances: [a, b, c, d],
    answerAttempts: attempts,
    reviewEvents: [
      makeReview('review-a', 'attempt-a', varianceRef, '2026-10-25T01:00:00.000Z'),
      makeReview('review-b', 'attempt-b', varianceRef, '2026-10-26T01:00:00.000Z'),
      makeReview('review-c', 'attempt-c', varianceRef, '2026-10-27T01:00:00.000Z'),
      makeReview('review-d', 'attempt-d', sigmaRef, '2026-10-24T01:00:00.000Z'),
    ],
  }
  const progress = deriveProgress(data, lessonRegistry, Date.parse('2026-10-28T00:00:00.000Z'))
  const descriptive = findLesson(progress, 'descriptive-statistics')
  const sigma = findLesson(progress, 'math-algebra-sigma')
  const varianceCandidate = descriptive.reviewCandidates.find((candidate) => candidate.reference === varianceRef)
  const sigmaCandidate = sigma.reviewCandidates.find((candidate) => candidate.reference === sigmaRef)
  const varianceVisits = descriptive.reviewVisits.find((visit) => visit.reference === varianceRef)

  assert.equal(varianceCandidate.attemptCount, 3)
  assert.equal(varianceCandidate.attemptId, 'attempt-b')
  assert.equal(varianceCandidate.visitCount, 3)
  assert.equal(varianceCandidate.representativeVisitCount, 1)
  assert.equal(varianceVisits.sourceVisits.find((source) => source.attemptId === 'attempt-c').visitCount, 1)
  assert.equal(varianceCandidate.sourceLessonIds.includes('math-algebra-sigma'), false)
  assert.equal(sigmaCandidate.attemptId, 'attempt-c')
  assert.equal(sigmaCandidate.sourceLessonIds[0], 'descriptive-statistics')
  assert.equal(sigmaCandidate.crossUnitAttemptCount, 1)
  assert.equal(sigmaCandidate.visitCount, 1)
  assert.equal(sigmaCandidate.representativeVisitCount, 0)
  assert.equal(sigma.state, '演習記録なし')
  assert.equal(sigma.questionInstanceCount, 0)
  assert.equal(sigma.attemptCount, 0)
})

test('same-time candidate ties are stable across input order and representative visits use both IDs', () => {
  const reference = 'descriptive-statistics#variance'
  const first = makeInstance('progress-tie-a', [reference], reference)
  const second = makeInstance('progress-tie-b', [reference], reference)
  const firstAttempt = makeAttempt(first, 'attempt-a', false, '2026-10-26T00:00:00.000Z')
  const secondAttempt = makeAttempt(second, 'attempt-b', false, '2026-10-26T00:00:00.000Z')
  const data = {
    ...emptyData(),
    questionInstances: [first, second],
    answerAttempts: [firstAttempt, secondAttempt],
    reviewEvents: [
      makeReview('tie-review-a', 'attempt-a', reference, '2026-10-26T01:00:00.000Z'),
      makeReview('tie-review-b', 'attempt-b', reference, '2026-10-26T02:00:00.000Z'),
      makeReview('tie-review-c', 'attempt-b', reference, '2026-10-26T03:00:00.000Z'),
    ],
  }
  const summarize = (value) => findLesson(deriveProgress(value, lessonRegistry, Date.parse('2026-10-27T00:00:00.000Z')), 'descriptive-statistics').reviewCandidates[0]
  const normal = summarize(data)
  const reversed = summarize({
    ...data,
    questionInstances: [...data.questionInstances].reverse(),
    answerAttempts: [...data.answerAttempts].reverse(),
    reviewEvents: [...data.reviewEvents].reverse(),
  })
  assert.equal(normal.attemptId, 'attempt-a')
  assert.deepEqual(normal.attemptIds, ['attempt-a', 'attempt-b'])
  assert.equal(normal.representativeVisitCount, 1)
  assert.deepEqual(reversed, normal)
})

test('latest attempt is chronological and elapsed days respect 24-hour boundaries and future timestamps', () => {
  const reference = 'descriptive-statistics#variance'
  const instance = makeInstance('progress-time', [reference], reference)
  const earlier = makeAttempt(instance, 'time-earlier', false, '2026-10-24T00:00:00.000Z')
  const latest = makeAttempt(instance, 'time-latest', true, '2026-10-26T00:00:00.000Z')
  const data = { ...emptyData(), questionInstances: [instance], answerAttempts: [latest, earlier] }
  const calculate = (now) => findLesson(deriveProgress(data, lessonRegistry, now), 'descriptive-statistics')
  const latestAt = Date.parse(latest.attemptedAt)
  assert.equal(calculate(latestAt + DAY_MS - 1).daysSinceLastAttempt, 0)
  assert.equal(calculate(latestAt + DAY_MS).daysSinceLastAttempt, 1)
  assert.equal(calculate(latestAt - 1).daysSinceLastAttempt, 0)
  assert.equal(calculate(latestAt - 1).hasFutureAttempt, true)
  assert.equal(calculate(latestAt + 1).hasFutureAttempt, false)
  assert.equal(calculate(latestAt + DAY_MS).lastAttemptAt, latest.attemptedAt)
})

test('unavailable saved references remain listed and distinguish unregistered, planned, and missing sections', () => {
  const instance = makeInstance('progress-unavailable', [
    'descriptive-statistics#missing-section',
    'mean-inference#z',
    'not-in-registry#topic',
  ], 'not-in-registry#topic')
  const attempt = makeAttempt(instance, 'unavailable-attempt', false, '2026-10-26T00:00:00.000Z')
  const data = {
    ...emptyData(),
    questionInstances: [instance],
    answerAttempts: [attempt],
    reviewEvents: [makeReview('unavailable-review', attempt.attemptId, 'mean-inference#z', '2026-10-26T01:00:00.000Z')],
  }
  const unavailable = deriveProgress(data, lessonRegistry, Date.parse('2026-10-27T00:00:00.000Z')).unavailableReferences
  assert.deepEqual(unavailable, [
    { reference: 'descriptive-statistics#missing-section', status: 'missing-section' },
    { reference: 'mean-inference#z', status: 'planned' },
    { reference: 'not-in-registry#topic', status: 'unregistered' },
  ])
})

test('save, reload, export, and import preserve the same derived progress at a fixed time', async () => {
  const reference = 'descriptive-statistics#variance'
  const instance = makeInstance('progress-round-trip', [reference], reference)
  const attempt = makeAttempt(instance, 'round-trip-attempt', false, '2026-10-26T00:00:00.000Z')
  const data = {
    ...emptyData(),
    questionInstances: [instance],
    answerAttempts: [attempt],
    reviewEvents: [makeReview('round-trip-review', attempt.attemptId, reference, '2026-10-26T01:00:00.000Z')],
  }
  const now = Date.parse('2026-10-27T00:00:00.000Z')
  const original = deriveProgress(data, lessonRegistry, now)
  const raw = serializeLocalData(data)
  const reloaded = parseLocalData(raw)
  assert.deepEqual(deriveProgress(reloaded, lessonRegistry, now), original)

  const exportStorage = { getItem: () => raw }
  const exported = exportLocalData(() => exportStorage)
  let importedRaw = null
  const importStorage = {
    getItem: () => importedRaw,
    setItem: (_key, value) => { importedRaw = value },
  }
  const imported = await importLocalData({ size: Buffer.byteLength(exported), text: async () => exported }, () => true, () => importStorage)
  assert.equal(imported.status, 'imported')
  assert.deepEqual(deriveProgress(imported.data, lessonRegistry, now), original)
  assert.deepEqual(deriveProgress(parseLocalData(importedRaw), lessonRegistry, now), original)
})
