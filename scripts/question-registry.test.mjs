import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createQuestionInstance,
  restoreQuestionInstance,
  validateQuestionContent,
  validateQuestionDefinition,
  validateQuestionInstance,
} from '../src/question-contract.mjs'
import { generateQuestionContent } from '../src/question-generator.mjs'
import { getQuestionDefinition, questionRegistry } from '../src/question-registry.mjs'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import { validateLessonRegistry } from '../src/lesson-contract.mjs'

const questionIds = [
  'q-desc-var-sc-001',
  'q-desc-var-num-001',
  'q-desc-mean-sc-001',
  'q-desc-sd-sc-001',
  'q-desc-var-gen-num-001',
]

function independentFNV1a(seed) {
  let hash = 2166136261
  for (const byte of new TextEncoder().encode(seed)) hash = Math.imul(hash ^ byte, 16777619) >>> 0
  return hash
}

test('production question definitions validate and resolve from the included lesson', () => {
  assert.equal(validateLessonRegistry(lessonRegistry), true)
  assert.deepEqual(questionRegistry.map((definition) => definition.questionId), questionIds)
  const descriptive = lessonRegistry.lessons.find((lesson) => lesson.lessonId === 'descriptive-statistics')
  assert.deepEqual(descriptive.questionIds, questionIds)

  for (const definition of questionRegistry) {
    assert.equal(validateQuestionDefinition(definition), true, definition.questionId)
    assert.strictEqual(getQuestionDefinition(definition.questionId), definition)
    const feedback = definition.kind === 'fixed' ? definition.content.feedbackRules : definition.contentTemplate.feedbackRulesTemplate
    for (const reference of [...definition.lessonRefs, ...feedback.map((rule) => rule.lessonRef)]) {
      const [lessonId, sectionId] = reference.split('#')
      const lesson = lessonRegistry.lessons.find((item) => item.lessonId === lessonId && item.availability === 'included')
      assert.ok(lesson, reference)
      assert.ok(lesson.sections.some((section) => section.sectionId === sectionId), reference)
    }
    if (definition.kind === 'fixed') {
      const instance = createQuestionInstance(definition, { instanceId: 'registry-' + definition.questionId })
      assert.equal(validateQuestionInstance(instance), true, definition.questionId)
    }
  }
  assert.throws(() => getQuestionDefinition('q-not-registered'), TypeError)
})

test('single-choice wrong answers have distinct, complete feedback', () => {
  for (const questionId of ['q-desc-var-sc-001', 'q-desc-mean-sc-001', 'q-desc-sd-sc-001']) {
    const content = getQuestionDefinition(questionId).content
    const incorrectChoiceIds = content.choices
      .filter((choice) => choice.id !== content.correctAnswer)
      .map((choice) => choice.id)
      .sort()
    assert.deepEqual(content.feedbackRules.map((rule) => rule.choiceId).sort(), incorrectChoiceIds)
    assert.ok(content.feedbackRules.every((rule) => rule.lessonRef === getQuestionDefinition(questionId).lessonRefs[0]))
  }

  const mean = getQuestionDefinition('q-desc-mean-sc-001').content
  assert.equal(mean.correctAnswer, 'A')
  assert.equal(mean.choices.find((choice) => choice.id === 'A').label, '4 mm')
  assert.notEqual(mean.feedbackRules.find((rule) => rule.choiceId === 'B').explanation,
    mean.feedbackRules.find((rule) => rule.choiceId === 'C').explanation)

  const standardDeviation = getQuestionDefinition('q-desc-sd-sc-001').content
  assert.equal(standardDeviation.correctAnswer, 'A')
  assert.equal(standardDeviation.choices.find((choice) => choice.id === 'A').label, '2 mm')
  assert.notEqual(standardDeviation.feedbackRules.find((rule) => rule.choiceId === 'B').explanation,
    standardDeviation.feedbackRules.find((rule) => rule.choiceId === 'C').explanation)
})

test('fixed variance calculation preserves units, n−1, tolerances, and known error', () => {
  const { content } = getQuestionDefinition('q-desc-var-num-001')
  assert.equal(validateQuestionContent(content), true)
  assert.equal(content.prompt, '標本とみなす測定値1.000 mm、2.200 mm、3.000 mmから、母分散の不偏推定量である不偏分散を求めてください。結果は小数第3位までです。入力値は採点時に小数第3位へ丸めます。')
  assert.match(content.conditions, /n−1/u)
  assert.match(content.conditions, /mm²/u)
  assert.equal(content.correctAnswer, '1.013')
  assert.deepEqual(content.grading, {
    type: 'numeric',
    unit: 'mm²',
    roundingDigits: 3,
    absoluteTolerance: '0.002',
    relativeTolerance: '0.005',
  })
  assert.equal(content.feedbackRules[0].answer, '0.676')
  assert.match(content.feedbackRules[0].explanation, /n=3/u)
  assert.match(content.solution, /31\/15 mm/u)
  assert.match(content.solution, /−16\/15.*2\/15.*14\/15/u)
  assert.match(content.solution, /152\/75 mm²/u)
  assert.match(content.solution, /76\/75 = 1.013333/u)
})

test('seed hashing is deterministic over raw UTF-8 and the declared version', () => {
  const definition = getQuestionDefinition('q-desc-var-gen-num-001')
  const expectedSeeds = [
    ['seed-1', 3597787782, 1],
    ['seed-0', 3614565401, 9],
    [' seed-1 ', 1723014044, 9],
    ['あ', 3760987057, 8],
    ['𠮷', 3241157914, 2],
  ]

  for (const [seed, hash, d] of expectedSeeds) {
    assert.equal(independentFNV1a(seed), hash)
    const options = { generationRuleVersion: definition.generator.generationRuleVersion, seed }
    const first = generateQuestionContent(definition.questionId, options)
    assert.equal(first.parameters.d, d)
    assert.deepEqual(generateQuestionContent(definition.questionId, options), first)
  }

  const firstValue = generateQuestionContent(definition.questionId, { generationRuleVersion: 1, seed: 'seed-1' })
  const otherValue = generateQuestionContent(definition.questionId, { generationRuleVersion: 1, seed: 'seed-0' })
  assert.notEqual(firstValue.parameters.d, otherValue.parameters.d)

  const seed = ' seed-1 '
  const content = generateQuestionContent(definition.questionId, { generationRuleVersion: 1, seed })
  const instance = createQuestionInstance(definition, { instanceId: 'generated-snapshot', content, seed })
  const saved = JSON.parse(JSON.stringify(instance))
  const restored = restoreQuestionInstance(saved)
  assert.equal(restored.seed, seed)
  assert.deepEqual(restored.questionDefinitionSnapshot.content, content)
  assert.equal(validateQuestionInstance(restored), true)
})

test('all nine generated populations have independent arithmetic, rounded answers, and valid snapshots', () => {
  const definition = getQuestionDefinition('q-desc-var-gen-num-001')
  const expected = [
    { d: 1, values: [9, 10, 11], correct: '0.667', knownWrong: '1.000' },
    { d: 2, values: [8, 10, 12], correct: '2.667', knownWrong: '4.000' },
    { d: 3, values: [7, 10, 13], correct: '6.000', knownWrong: '9.000' },
    { d: 4, values: [6, 10, 14], correct: '10.667', knownWrong: '16.000' },
    { d: 5, values: [5, 10, 15], correct: '16.667', knownWrong: '25.000' },
    { d: 6, values: [4, 10, 16], correct: '24.000', knownWrong: '36.000' },
    { d: 7, values: [3, 10, 17], correct: '32.667', knownWrong: '49.000' },
    { d: 8, values: [2, 10, 18], correct: '42.667', knownWrong: '64.000' },
    { d: 9, values: [1, 10, 19], correct: '54.000', knownWrong: '81.000' },
  ]
  const seedsByD = new Map()
  for (let number = 0; number < 1000 && seedsByD.size < 9; number++) {
    const seed = 'parameter-' + number
    const d = independentFNV1a(seed) % 9 + 1
    if (!seedsByD.has(d)) seedsByD.set(d, seed)
  }
  assert.equal(seedsByD.size, 9)

  for (const expectedValue of expected) {
    const seed = seedsByD.get(expectedValue.d)
    const content = generateQuestionContent(definition.questionId, { generationRuleVersion: 1, seed })
    const [low, center, high] = expectedValue.values
    const mean = expectedValue.values.reduce((sum, value) => sum + value, 0) / 3
    const squaredDeviationSum = expectedValue.values.reduce((sum, value) => sum + (value - mean) ** 2, 0)
    const independentlyRoundedPopulationVariance = (squaredDeviationSum / 3).toFixed(3)

    assert.deepEqual(content.parameters, { d: expectedValue.d })
    assert.equal(center, 10)
    assert.equal(mean, 10)
    assert.equal(squaredDeviationSum, 2 * expectedValue.d ** 2)
    assert.equal(content.correctAnswer, expectedValue.correct)
    assert.equal(content.correctAnswer, independentlyRoundedPopulationVariance)
    assert.equal(content.feedbackRules[0].answer, expectedValue.knownWrong)
    assert.equal(content.feedbackRules[0].lessonRef, definition.lessonRefs[0])
    assert.equal(content.feedbackRules[0].answer, (squaredDeviationSum / 2).toFixed(3))
    assert.match(content.conditions, new RegExp(low + ' mm、10 mm、' + high + ' mm', 'u'))
    assert.match(content.conditions, /N=3/u)
    assert.match(content.conditions, /mm²/u)
    assert.match(content.solution, /平均は/u)
    assert.match(content.solution, /偏差平方和/u)
    assert.match(content.solution, new RegExp(squaredDeviationSum + ' mm²', 'u'))
    assert.equal(validateQuestionContent(content), true)

    const instance = createQuestionInstance(definition, {
      instanceId: 'all-values-' + expectedValue.d,
      content,
      seed,
    })
    assert.equal(validateQuestionInstance(instance), true)
    const restored = restoreQuestionInstance(JSON.parse(JSON.stringify(instance)))
    assert.deepEqual(restored.questionDefinitionSnapshot.content, content)
    assert.equal(restored.seed, seed)
  }
})

test('generator rejects unknown IDs, fixed IDs, invalid options, and unsupported versions', () => {
  const valid = { generationRuleVersion: 1, seed: 'seed' }
  assert.throws(() => generateQuestionContent('q-not-registered', valid), TypeError)
  assert.throws(() => generateQuestionContent('q-desc-var-sc-001', valid), TypeError)
  assert.throws(() => generateQuestionContent('q-desc-var-gen-num-001', { generationRuleVersion: 2, seed: 'seed' }), TypeError)

  for (const options of [
    null,
    [],
    {},
    { generationRuleVersion: 1 },
    { generationRuleVersion: 1, seed: 1 },
    { generationRuleVersion: '1', seed: 'seed' },
    { generationRuleVersion: Number.NaN, seed: 'seed' },
    { generationRuleVersion: 1, seed: ' \t\n' },
    { generationRuleVersion: 1, seed: 'seed', extra: true },
    Object.assign(Object.create({ generationRuleVersion: 1 }), { seed: 'seed' }),
  ]) {
    assert.throws(() => generateQuestionContent('q-desc-var-gen-num-001', options), TypeError)
  }
  assert.throws(() => generateQuestionContent(123, valid), TypeError)
})
