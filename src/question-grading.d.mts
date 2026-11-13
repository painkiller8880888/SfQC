export type DecimalAnswerGradingResult =
  | { readonly status: 'graded'; readonly isCorrect: boolean }
  | { readonly status: 'invalid'; readonly reason: 'invalid-answer-format' }
  | { readonly status: 'invalid'; readonly reason: 'invalid-expected-value' }
  | { readonly status: 'invalid'; readonly reason: 'invalid-rounding-digits' }

export declare function gradeDecimalAnswer(answer: unknown, expected: unknown, roundingDigits: unknown): DecimalAnswerGradingResult
