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
