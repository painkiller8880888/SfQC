import { validateQuestionInstance } from './question-contract.mjs'

/** @typedef {import('./question-contract.mjs').ReadonlyQuestionInstance} ReadonlyQuestionInstance */
/** @typedef {import('./question-grading.d.mts').QuestionGradingResult} QuestionGradingResult */
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
  const [integerPart, fractionalPart = ''] = unsigned.split('.')
  const sign = text.startsWith('-') ? -1n : 1n
  return normalizeDecimal({
    coefficient: sign * BigInt(integerPart + fractionalPart),
    scale: fractionalPart.length,
  })
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

/** @param {Decimal} left @param {Decimal} right @returns {Decimal} */
function subtractDecimal(left, right) {
  const scale = Math.max(left.scale, right.scale)
  return normalizeDecimal({
    coefficient: coefficientAtScale(left, scale) - coefficientAtScale(right, scale),
    scale,
  })
}

/** @param {Decimal} value @returns {Decimal} */
function absoluteDecimal(value) {
  return value.coefficient < 0n ? { coefficient: -value.coefficient, scale: value.scale } : value
}

/** @param {Decimal} left @param {Decimal} right @returns {Decimal} */
function multiplyDecimal(left, right) {
  return normalizeDecimal({
    coefficient: left.coefficient * right.coefficient,
    scale: left.scale + right.scale,
  })
}

/** @returns {QuestionGradingResult} */
function correctResult() {
  return { status: 'graded', isCorrect: true, feedback: null }
}

/** @param {ReadonlyQuestionInstance} instance @param {unknown} answer @returns {QuestionGradingResult} */
export function gradeQuestionAnswer(instance, answer) {
  if (!validateQuestionInstance(instance)) return { status: 'invalid', reason: 'invalid-instance' }

  const snapshot = instance.questionDefinitionSnapshot
  const content = snapshot.content
  if (content.format === 'single-choice') {
    if (typeof answer !== 'string' || !content.choices.some((choice) => choice.id === answer)) {
      return { status: 'invalid', reason: 'invalid-answer-format' }
    }
    if (answer === content.correctAnswer) return correctResult()

    const rule = content.feedbackRules.find((item) => item.choiceId === answer)
    return rule
      ? {
          status: 'graded',
          isCorrect: false,
          feedback: {
            source: 'rule',
            explanation: rule.explanation,
            lessonRef: rule.lessonRef,
            matchedRule: { kind: 'single-choice', choiceId: rule.choiceId },
          },
        }
      : {
          status: 'graded',
          isCorrect: false,
          feedback: { source: 'default', explanation: content.defaultFeedback, lessonRef: snapshot.lessonRefs[0] },
        }
  }

  if (content.format !== 'numeric' || typeof answer !== 'string') {
    return { status: 'invalid', reason: 'invalid-answer-format' }
  }

  const inputValue = parseDecimal(answer)
  const expectedValue = parseDecimal(content.correctAnswer)
  if (inputValue === null) return { status: 'invalid', reason: 'invalid-answer-format' }
  if (expectedValue === null) return { status: 'invalid', reason: 'invalid-instance' }

  const digits = content.grading.roundingDigits
  const roundedInput = roundDecimal(inputValue, digits)
  const roundedExpected = roundDecimal(expectedValue, digits)
  const difference = absoluteDecimal(subtractDecimal(roundedInput, roundedExpected))
  const absoluteTolerance = content.grading.absoluteTolerance === undefined
    ? null
    : parseDecimal(content.grading.absoluteTolerance)
  const relativeTolerance = content.grading.relativeTolerance === undefined
    ? null
    : parseDecimal(content.grading.relativeTolerance)
  const withinAbsoluteTolerance = absoluteTolerance !== null
    && compareDecimal(difference, absoluteTolerance) <= 0
  const withinRelativeTolerance = roundedExpected.coefficient !== 0n
    && relativeTolerance !== null
    && compareDecimal(difference, multiplyDecimal(absoluteDecimal(roundedExpected), relativeTolerance)) <= 0

  if (withinAbsoluteTolerance || withinRelativeTolerance) return correctResult()

  const matchingRules = content.feedbackRules.filter((rule) => {
    const ruleAnswer = parseDecimal(rule.answer)
    return ruleAnswer !== null && compareDecimal(roundDecimal(ruleAnswer, digits), roundedInput) === 0
  })
  if (matchingRules.length === 1) {
    const rule = matchingRules[0]
    return {
      status: 'graded',
      isCorrect: false,
      feedback: {
        source: 'rule',
        explanation: rule.explanation,
        lessonRef: rule.lessonRef,
        matchedRule: { kind: 'numeric', answer: rule.answer },
      },
    }
  }

  return {
    status: 'graded',
    isCorrect: false,
    feedback: { source: 'default', explanation: content.defaultFeedback, lessonRef: snapshot.lessonRefs[0] },
  }
}
