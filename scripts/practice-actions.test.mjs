import assert from 'node:assert/strict'
import test from 'node:test'
import { createQuestionInstance } from '../src/question-contract.mjs'
import { createPracticeInstance, createSimilarPractice, recordReviewEvent, submitPracticeAnswer, availablePracticeQuestions } from '../src/practice-actions.mjs'
import { LOCAL_DATA_MAX_INSTANCES, LocalDataError, readLocalData, serializeLocalData } from '../src/local-data.mjs'
import { getQuestionDefinition, questionRegistry } from '../src/question-registry.mjs'

function memoryStorage() {
  return {
    value: null,
    failWrites: false,
    getItem() { return this.value },
    setItem(_key, value) {
      if (this.failWrites) throw new Error('quota exceeded')
      this.value = value
    },
  }
}

function withStorage(storage, run) {
  const previousWindow = globalThis.window
  globalThis.window = { localStorage: storage }
  try {
    return run()
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
}

test('practice selection exposes only included questions and saves unique fixed and generated snapshots', () => {
  withStorage(memoryStorage(), () => {
    const availableIds = new Set(availablePracticeQuestions().map((question) => question.questionId))
    assert.ok(availableIds.size > 0)
    assert.ok([...availableIds].every((id) => questionRegistry.some((question) => question.questionId === id)))

    const fixedId = 'q-desc-var-sc-001'
    const firstFixed = createPracticeInstance(fixedId)
    const secondFixed = createPracticeInstance(fixedId)
    assert.equal(firstFixed.instance.kind, 'fixed')
    assert.notEqual(firstFixed.instance.instanceId, secondFixed.instance.instanceId)

    const generatedId = 'q-desc-var-gen-num-001'
    const firstGenerated = createPracticeInstance(generatedId)
    const similar = createSimilarPractice(firstGenerated.instance)
    const newStart = createPracticeInstance(generatedId)
    assert.equal(firstGenerated.instance.kind, 'generated')
    assert.equal(similar.instance.kind, 'generated')
    assert.notEqual(firstGenerated.instance.instanceId, similar.instance.instanceId)
    assert.notEqual(firstGenerated.instance.seed, similar.instance.seed)
    assert.notEqual(firstGenerated.instance.seed, newStart.instance.seed)
    assert.equal(similar.data.questionInstances.length, 4)
    assert.throws(() => createSimilarPractice(firstFixed.instance), /類題/u)
  })
})

test('answer grading leaves invalid responses unrecorded and appends immutable attempts to their saved instance', () => {
  withStorage(memoryStorage(), () => {
    const started = createPracticeInstance('q-desc-var-num-001')
    const snapshotBefore = JSON.stringify(started.instance)
    const invalid = submitPracticeAnswer(started.instance, '1e0')
    assert.deepEqual(invalid, { status: 'invalid', reason: 'invalid-answer-format' })
    assert.equal(readLocalData().data.answerAttempts.length, 0)

    const first = submitPracticeAnswer(started.instance, '1.013')
    const second = submitPracticeAnswer(started.instance, '0.676')
    assert.equal(first.status, 'saved')
    assert.equal(second.status, 'saved')
    assert.notEqual(first.attempt.attemptId, second.attempt.attemptId)
    assert.equal(first.attempt.instanceId, started.instance.instanceId)
    assert.equal(second.attempt.instanceId, started.instance.instanceId)
    assert.equal(first.attempt.gradingResult.isCorrect, true)
    assert.equal(second.attempt.gradingResult.isCorrect, false)
    assert.equal(JSON.stringify(readLocalData().data.questionInstances[0]), snapshotBefore)
    assert.equal(readLocalData().data.answerAttempts.length, 2)
  })
})

test('write failure and the 500-snapshot limit never report a saved answer or duplicate history', () => {
  const storage = memoryStorage()
  withStorage(storage, () => {
    const started = createPracticeInstance('q-desc-var-sc-001')
    const before = storage.value
    storage.failWrites = true
    assert.throws(
      () => submitPracticeAnswer(started.instance, 'A'),
      (error) => error instanceof LocalDataError && error.code === 'storage-write-failed',
    )
    assert.equal(storage.value, before)
    storage.failWrites = false

    const definition = getQuestionDefinition('q-desc-var-sc-001')
    const fullHistory = Array.from({ length: LOCAL_DATA_MAX_INSTANCES }, (_, index) =>
      createQuestionInstance(definition, { instanceId: 'at-limit-' + index }))
    storage.value = serializeLocalData({
      schemaVersion: 2, questionInstances: fullHistory, answerAttempts: [], reviewEvents: [],
    })
    const fullBefore = storage.value
    assert.throws(
      () => createPracticeInstance(definition.questionId),
      (error) => error instanceof LocalDataError && error.code === 'too-many-instances',
    )
    assert.equal(storage.value, fullBefore)
    assert.equal(readLocalData().data.questionInstances.length, LOCAL_DATA_MAX_INSTANCES)
  })
})

test('review events append only for saved wrong attempts and preserve all existing records', () => {
  const storage = memoryStorage()
  withStorage(storage, () => {
    const started = createPracticeInstance('q-desc-var-num-001')
    const wrong = submitPracticeAnswer(started.instance, '1.030')
    const correct = submitPracticeAnswer(started.instance, '1.013')
    assert.equal(wrong.status, 'saved')
    assert.equal(correct.status, 'saved')
    const before = readLocalData().data

    const first = recordReviewEvent('descriptive-statistics#variance', wrong.attempt.attemptId)
    const second = recordReviewEvent('descriptive-statistics#variance', wrong.attempt.attemptId)
    assert.equal(first.event.targetRef, 'descriptive-statistics#variance')
    assert.equal(first.event.sourceAttemptId, wrong.attempt.attemptId)
    assert.match(first.event.reviewedAt, /^\d{4}-\d{2}-\d{2}T/u)
    assert.notEqual(first.event.reviewEventId, second.event.reviewEventId)

    const after = readLocalData().data
    assert.deepEqual(after.questionInstances, before.questionInstances)
    assert.deepEqual(after.answerAttempts, before.answerAttempts)
    assert.equal(after.reviewEvents.length, 2)
    assert.deepEqual(after.reviewEvents[0], first.event)
    assert.deepEqual(after.reviewEvents[1], second.event)

    const savedRaw = storage.value
    assert.throws(() => recordReviewEvent('not a lesson ref', wrong.attempt.attemptId), TypeError)
    assert.throws(() => recordReviewEvent('descriptive-statistics#variance', 'missing-attempt'), TypeError)
    assert.throws(() => recordReviewEvent('descriptive-statistics#variance', correct.attempt.attemptId), TypeError)
    assert.equal(storage.value, savedRaw)

    storage.failWrites = true
    assert.throws(
      () => recordReviewEvent('math-algebra-sigma#sigma', wrong.attempt.attemptId),
      (error) => error instanceof LocalDataError && error.code === 'storage-write-failed',
    )
    assert.equal(storage.value, savedRaw)
    assert.equal(readLocalData().data.reviewEvents.length, 2)
  })
})
