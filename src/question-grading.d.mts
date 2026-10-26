import type { DecimalString, ReadonlyQuestionInstance } from './question-contract.mjs'

export type QuestionGradingFeedback =
  | {
      readonly source: 'rule'
      readonly explanation: string
      readonly lessonRef: string
      readonly matchedRule:
        | { readonly kind: 'single-choice'; readonly choiceId: string }
        | { readonly kind: 'numeric'; readonly answer: DecimalString }
    }
  | {
      readonly source: 'default'
      readonly explanation: string
      readonly lessonRef: string
    }

export type QuestionGradingResult =
  | { readonly status: 'graded'; readonly isCorrect: true; readonly feedback: null }
  | { readonly status: 'graded'; readonly isCorrect: false; readonly feedback: QuestionGradingFeedback }
  | { readonly status: 'invalid'; readonly reason: 'invalid-instance' | 'invalid-answer-format' }

export declare function gradeQuestionAnswer(
  instance: ReadonlyQuestionInstance,
  answer: unknown,
): QuestionGradingResult
