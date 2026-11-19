/** @typedef {{ coefficient: bigint; scale: number }} Decimal */

const inputDecimalPattern = /^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?$/u

/** @param {Decimal} value @returns {Decimal} */
function normalizeDecimal(value) {
  let { coefficient, scale } = value
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n
    scale -= 1
  }
  return { coefficient, scale }
}

/** @param {unknown} value @returns {Decimal | null} */
function parseDecimal(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!inputDecimalPattern.test(text)) return null
  const unsigned = text.startsWith('+') || text.startsWith('-') ? text.slice(1) : text
  const [integerPart, rawFractionalPart = ''] = unsigned.split('.')
  let end = rawFractionalPart.length
  while (end > 0 && rawFractionalPart[end - 1] === '0') end -= 1
  const fractionalPart = rawFractionalPart.slice(0, end)
  const sign = text.startsWith('-') ? -1n : 1n
  return {
    coefficient: sign * BigInt(integerPart + fractionalPart),
    scale: fractionalPart.length,
  }
}

/** @param {unknown} value @returns {value is string} */
export function isValidDecimalAnswer(value) {
  return parseDecimal(value) !== null
}

/** @param {number} digits @returns {bigint} */
function powerOfTen(digits) {
  return 10n ** BigInt(digits)
}

/** @param {Decimal} value @param {number} digits @returns {Decimal} */
function roundDecimal(value, digits) {
  if (value.scale <= digits) return value
  const divisor = powerOfTen(value.scale - digits)
  const absoluteCoefficient = value.coefficient < 0n ? -value.coefficient : value.coefficient
  const quotient = absoluteCoefficient / divisor
  const remainder = absoluteCoefficient % divisor
  const rounded = quotient + (remainder * 2n >= divisor ? 1n : 0n)
  return normalizeDecimal({
    coefficient: value.coefficient < 0n ? -rounded : rounded,
    scale: digits,
  })
}

/** @param {Decimal} value @param {number} scale @returns {bigint} */
function coefficientAtScale(value, scale) {
  return value.coefficient * powerOfTen(scale - value.scale)
}

/** @param {Decimal} left @param {Decimal} right @returns {-1 | 0 | 1} */
function compareDecimal(left, right) {
  const scale = Math.max(left.scale, right.scale)
  const leftCoefficient = coefficientAtScale(left, scale)
  const rightCoefficient = coefficientAtScale(right, scale)
  return leftCoefficient < rightCoefficient ? -1 : leftCoefficient > rightCoefficient ? 1 : 0
}

/** @param {unknown} answer @param {unknown} expected @param {unknown} roundingDigits @returns {import('./question-grading.d.mts').DecimalAnswerGradingResult} */
export function gradeDecimalAnswer(answer, expected, roundingDigits) {
  if (typeof roundingDigits !== 'number' || !Number.isSafeInteger(roundingDigits)
    || roundingDigits < 0 || Object.is(roundingDigits, -0)) {
    return { status: 'invalid', reason: 'invalid-rounding-digits' }
  }
  const expectedValue = parseDecimal(expected)
  if (expectedValue === null) return { status: 'invalid', reason: 'invalid-expected-value' }
  const answerValue = parseDecimal(answer)
  if (answerValue === null) return { status: 'invalid', reason: 'invalid-answer-format' }
  return {
    status: 'graded',
    isCorrect: compareDecimal(roundDecimal(answerValue, roundingDigits), roundDecimal(expectedValue, roundingDigits)) === 0,
  }
}

/** @param {Array<{ id: string }>} fields @param {Array<{ fieldId: string; expected: string; roundingDigits: number }>} expectedAnswers @param {Record<string, unknown>} answers @returns {import('./question-grading.d.mts').ExerciseNumericGradingResult} */
export function gradeNumericExerciseAnswers(fields, expectedAnswers, answers) {
  if (!Array.isArray(fields) || fields.length === 0 || !Array.isArray(expectedAnswers)
    || typeof answers !== 'object' || answers === null) {
    return { status: 'invalid', reason: 'invalid-grading-definition' }
  }

  /** @type {import('./question-grading.d.mts').DecimalAnswerGradingResult[]} */
  const results = fields.map((field) => {
    if (!field || typeof field.id !== 'string') return gradeDecimalAnswer('', undefined, 0)
    const expected = expectedAnswers.find((answer) => answer?.fieldId === field.id)
    const answer = answers[field.id]
    const normalized = typeof answer === 'string' ? answer.normalize('NFKC').replace(/−/gu, '-') : answer
    return gradeDecimalAnswer(normalized, expected?.expected, expected?.roundingDigits)
  })
  const fieldIds = fields.map((field) => field?.id)
  const expectedIds = expectedAnswers.map((answer) => answer?.fieldId)
  if (results.some((result) => result.status === 'invalid' && result.reason !== 'invalid-answer-format')
    || fieldIds.some((id, index) => typeof id !== 'string' || fieldIds.indexOf(id) !== index)
    || expectedIds.length !== fieldIds.length
    || expectedIds.some((id, index) => !fieldIds.includes(id) || expectedIds.indexOf(id) !== index)) {
    return { status: 'invalid', reason: 'invalid-grading-definition' }
  }
  if (results.some((result) => result.status === 'invalid')) {
    return { status: 'invalid', reason: 'invalid-answer-format' }
  }
  return { status: 'graded', isCorrect: results.every((result) => result.status === 'graded' && result.isCorrect) }
}
