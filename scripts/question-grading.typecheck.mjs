// @ts-check
import { createQuestionInstance } from '../src/question-contract.mjs'
import { gradeQuestionAnswer } from '../src/question-grading.mjs'

/** @param {import('../src/question-contract.mjs').FixedQuestionDefinition} definition */
export function checkGradingTypes(definition) {
  const instance = createQuestionInstance(definition, { instanceId: 'type-check' })
  const result = gradeQuestionAnswer(instance, 'A')
  if (result.status === 'invalid') return result.reason
  if (result.isCorrect) return result.feedback
  if (result.feedback.source === 'default') return result.feedback.lessonRef
  if (result.feedback.matchedRule.kind === 'single-choice') return result.feedback.matchedRule.choiceId
  return result.feedback.matchedRule.answer
}
