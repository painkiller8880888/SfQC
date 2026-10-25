import { getQuestionDefinition } from './question-registry.mjs'

/** @typedef {{ generationRuleVersion: number; seed: string }} GenerationOptions */

/** @param {unknown} value @returns {value is GenerationOptions} */
function isGenerationOptions(value) {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype) return false
    const keys = Reflect.ownKeys(value)
    if (keys.length !== 2 || !keys.includes('generationRuleVersion') || !keys.includes('seed')) return false
    const version = Object.getOwnPropertyDescriptor(value, 'generationRuleVersion')
    const seed = Object.getOwnPropertyDescriptor(value, 'seed')
    return version?.enumerable === true && 'value' in version && Number.isSafeInteger(version.value)
      && seed?.enumerable === true && 'value' in seed && typeof seed.value === 'string'
  } catch {
    return false
  }
}

/** @param {string} seed @returns {number} */
function hashSeed(seed) {
  let hash = 2166136261
  for (const byte of new TextEncoder().encode(seed)) {
    hash = Math.imul(hash ^ byte, 16777619) >>> 0
  }
  return hash
}

/** @param {string} questionId @param {unknown} options @returns {import('./question-contract.mjs').QuestionContent} */
export function generateQuestionContent(questionId, options) {
  if (typeof questionId !== 'string' || !isGenerationOptions(options) || options.seed.trim() === '') {
    throw new TypeError('Invalid generated question request')
  }
  const definition = getQuestionDefinition(questionId)
  if (definition.kind !== 'generated' || options.generationRuleVersion !== definition.generator.generationRuleVersion) {
    throw new TypeError('Unsupported generated question or rule version')
  }

  const d = hashSeed(options.seed) % 9 + 1
  const low = 10 - d
  const high = 10 + d
  const squaredDeviationSum = 2 * d * d
  const correctAnswer = (squaredDeviationSum / 3).toFixed(3)
  const knownWrongAnswer = (d * d).toFixed(3)

  return {
    format: 'numeric',
    prompt: '母集団全体の測定値から母分散を求めてください。答えは小数第3位までです。',
    conditions: '母集団の全測定値は' + low + ' mm、10 mm、' + high + ' mmです。分母はN=3で、単位はmm²です。',
    parameters: { d },
    correctAnswer,
    grading: { type: 'numeric', unit: 'mm²', roundingDigits: 3, absoluteTolerance: '0' },
    solution: '平均は(' + low + ' + 10 + ' + high + ')/3 = 10 mmです。偏差は−' + d + ', 0, +' + d
      + ' mmで、偏差平方和は' + d + '² + 0² + ' + d + '² = ' + squaredDeviationSum
      + ' mm²です。母分散は' + squaredDeviationSum + '/3 mm²なので、小数第3位まででは'
      + correctAnswer + ' mm²です。',
    feedbackRules: [
      {
        answer: knownWrongAnswer,
        explanation: 'この値は偏差平方和をn−1=2で割った値です。母集団全体の分散ではN=3で割ります。',
        lessonRef: 'descriptive-statistics#variance',
      },
    ],
    defaultFeedback: '母分散では偏差平方和を母集団の個数Nで割ります。',
  }
}
