import { lessonRegistry } from './lesson-registry.mjs'
import { createQuestionInstance } from './question-contract.mjs'
import { generateQuestionContent } from './question-generator.mjs'
import { gradeQuestionAnswer } from './question-grading.mjs'
import { questionRegistry, getQuestionDefinition } from './question-registry.mjs'
import { LocalDataError, readLocalData, saveLocalData } from './local-data.mjs'

export function availablePracticeQuestions() {
  const includedQuestionIds = new Set(lessonRegistry.lessons
    .filter((lesson) => lesson.availability === 'included')
    .flatMap((lesson) => lesson.questionIds))
  return questionRegistry.filter((question) => includedQuestionIds.has(question.questionId))
}

function readWritableData() {
  const current = readLocalData()
  if (current.status === 'invalid' || current.status === 'unreadable') throw current.error
  return current
}

function uniqueValue(used) {
  const randomUUID = globalThis.crypto?.randomUUID
  if (typeof randomUUID !== 'function') throw new Error('このブラウザーでは安全なIDを生成できません。')
  let value
  do value = randomUUID.call(globalThis.crypto)
  while (typeof value !== 'string' || value.length === 0 || used.has(value))
  used.add(value)
  return value
}

function saveInstance(current, instance) {
  const saved = saveLocalData({
    ...current.data,
    questionInstances: [...current.data.questionInstances, instance],
  })
  return { instance: saved.data.questionInstances.at(-1), data: saved.data, raw: saved.raw }
}

export function createPracticeInstance(questionId) {
  const definition = availablePracticeQuestions().find((item) => item.questionId === questionId)
  if (!definition) throw new TypeError('この問題は現在利用できません。')

  const current = readWritableData()
  const instanceIds = new Set(current.data.questionInstances.map((instance) => instance.instanceId))
  const instanceId = uniqueValue(instanceIds)
  if (definition.kind === 'fixed') {
    return saveInstance(current, createQuestionInstance(definition, { instanceId }))
  }

  const seeds = new Set(current.data.questionInstances
    .filter((instance) => instance.kind === 'generated' && instance.questionId === questionId)
    .map((instance) => instance.seed))
  const seed = uniqueValue(seeds)
  const content = generateQuestionContent(questionId, {
    generationRuleVersion: definition.generator.generationRuleVersion,
    seed,
  })
  return saveInstance(current, createQuestionInstance(definition, { instanceId, content, seed }))
}

export function createSimilarPractice(instance) {
  const current = readWritableData()
  const savedInstance = current.data.questionInstances.find((item) => item.instanceId === instance?.instanceId)
  if (!savedInstance || savedInstance.kind !== 'generated' || instance?.kind !== 'generated') {
    throw new TypeError('この出題から類題を作成できません。')
  }
  const definition = availablePracticeQuestions().find((item) => item.questionId === savedInstance.questionId)
  if (!definition || definition.kind !== 'generated') {
    throw new TypeError('この問題の生成ルールは利用できないため、類題を作成できません。')
  }

  const instanceIds = new Set(current.data.questionInstances.map((item) => item.instanceId))
  const instanceId = uniqueValue(instanceIds)
  const seeds = new Set(current.data.questionInstances
    .filter((item) => item.kind === 'generated' && item.questionId === definition.questionId)
    .map((item) => item.seed))
  const seed = uniqueValue(seeds)
  const content = generateQuestionContent(definition.questionId, {
    generationRuleVersion: definition.generator.generationRuleVersion,
    seed,
  })
  return saveInstance(current, createQuestionInstance(definition, { instanceId, content, seed }))
}

export function submitPracticeAnswer(instance, answer) {
  const current = readWritableData()
  const savedInstance = current.data.questionInstances.find((item) => item.instanceId === instance?.instanceId)
  if (!savedInstance || JSON.stringify(savedInstance) !== JSON.stringify(instance)) {
    throw new Error('保存済みの出題snapshotが変更されています。最新の出題を開き直してください。')
  }

  const gradingResult = gradeQuestionAnswer(savedInstance, answer)
  if (gradingResult.status === 'invalid') return gradingResult

  const attemptIds = new Set(current.data.answerAttempts.map((attempt) => attempt.attemptId))
  const attempt = {
    attemptId: uniqueValue(attemptIds),
    instanceId: savedInstance.instanceId,
    answer,
    gradingResult,
    attemptedAt: new Date().toISOString(),
  }
  const saved = saveLocalData({
    ...current.data,
    answerAttempts: [...current.data.answerAttempts, attempt],
  })
  return { status: 'saved', attempt: saved.data.answerAttempts.at(-1), data: saved.data, raw: saved.raw }
}
