export type DecimalAnswerGradingResult =
  | { readonly status: 'graded'; readonly isCorrect: boolean }
  | { readonly status: 'invalid'; readonly reason: 'invalid-answer-format' }
  | { readonly status: 'invalid'; readonly reason: 'invalid-expected-value' }
  | { readonly status: 'invalid'; readonly reason: 'invalid-rounding-digits' }

export type ExerciseNumericGradingResult =
  | { readonly status: 'graded'; readonly isCorrect: boolean }
  | { readonly status: 'invalid'; readonly reason: 'invalid-answer-format' }
  | { readonly status: 'invalid'; readonly reason: 'invalid-grading-definition' }

export declare function isValidDecimalAnswer(value: unknown): value is string
export declare function gradeDecimalAnswer(answer: unknown, expected: unknown, roundingDigits: unknown): DecimalAnswerGradingResult
export declare function gradeNumericExerciseAnswers(
  fields: ReadonlyArray<{ id: string }>,
  expectedAnswers: ReadonlyArray<{ fieldId: string; expected: string; roundingDigits: number }>,
  answers: Readonly<Record<string, unknown>>,
): ExerciseNumericGradingResult
