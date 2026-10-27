import type { QuestionDefinition, ReadonlyQuestionInstance } from './question-contract.mjs'
import type { AnswerAttempt, LocalData } from './local-data.mjs'
import type { QuestionGradingResult } from './question-grading.mjs'

export type SavedPracticeRecord = {
  instance: ReadonlyQuestionInstance
  data: LocalData
  raw: string
}

export type SubmitPracticeResult =
  | Extract<QuestionGradingResult, { readonly status: 'invalid' }>
  | { status: 'saved'; attempt: AnswerAttempt; data: LocalData; raw: string }

export declare function availablePracticeQuestions(): QuestionDefinition[]
export declare function createPracticeInstance(questionId: string): SavedPracticeRecord
export declare function createSimilarPractice(instance: ReadonlyQuestionInstance): SavedPracticeRecord
export declare function submitPracticeAnswer(instance: ReadonlyQuestionInstance, answer: string): SubmitPracticeResult
