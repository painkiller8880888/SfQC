import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createQuestionInstance,
  restoreQuestionInstance,
  validateQuestionContent,
  validateQuestionDefinition,
  validateQuestionInstance,
} from '../src/question-contract.mjs'
import {
  fixedDefinition,
  fixedInstance,
  generatedContent,
  generatedDefinition,
  generatedInstance,
  numericDefinition,
} from './question-contract.fixture.mjs'

const copy = (value) => structuredClone(value)

test('fixed and generated definitions produce valid JSON snapshots', () => {
  assert.equal(validateQuestionDefinition(fixedDefinition), true)
  assert.equal(validateQuestionDefinition(numericDefinition), true)
  assert.equal(validateQuestionDefinition(generatedDefinition), true)
  assert.equal(validateQuestionInstance(fixedInstance), true)
  assert.equal(validateQuestionInstance(generatedInstance), true)
  assert.deepEqual(JSON.parse(JSON.stringify(fixedInstance)), fixedInstance)
  assert.deepEqual(JSON.parse(JSON.stringify(generatedInstance)), generatedInstance)

  for (const instance of [fixedInstance, generatedInstance]) {
    assert.equal(Object.isFrozen(instance), true)
    assert.equal(Object.isFrozen(instance.questionDefinitionSnapshot), true)
    assert.equal(Object.isFrozen(instance.questionDefinitionSnapshot.content), true)
  }
  assert.equal(Object.isFrozen(fixedInstance.questionDefinitionSnapshot.content.choices), true)
  assert.equal(Object.isFrozen(fixedInstance.questionDefinitionSnapshot.content.choices[0]), true)
  assert.throws(() => { fixedInstance.questionDefinitionSnapshot.content.choices[0].label = '変更' }, TypeError)
  assert.throws(() => fixedInstance.questionDefinitionSnapshot.content.choices.push({ id: 'D', label: '追加' }), TypeError)
  assert.throws(() => { generatedInstance.questionDefinitionSnapshot.content.parameters['sample-size'] = 8 }, TypeError)
})

test('definition unions reject fields and unresolved answers from the other branch', () => {
  const fixedWithGenerator = { ...copy(fixedDefinition), generator: generatedDefinition.generator }
  const generatedWithContent = { ...copy(generatedDefinition), content: fixedDefinition.content }
  assert.equal(validateQuestionDefinition(fixedWithGenerator), false)
  assert.equal(validateQuestionDefinition(generatedWithContent), false)
  assert.equal(validateQuestionDefinition({ ...copy(generatedDefinition), contentTemplate: { ...generatedDefinition.contentTemplate, correctAnswer: '5' } }), false)
})

test('unknown fields, undefined, unsafe integers, and non-finite parameter values are rejected', () => {
  assert.equal(validateQuestionDefinition({ ...copy(fixedDefinition), extra: true }), false)
  assert.equal(validateQuestionDefinition({ ...copy(fixedDefinition), revision: Number.MAX_SAFE_INTEGER + 1 }), false)
  assert.equal(validateQuestionContent({ ...copy(numericDefinition.content), extra: true }), false)
  assert.equal(validateQuestionContent({ ...copy(numericDefinition.content), parameters: { count: Number.NaN } }), false)

  const withUndefined = { ...copy(fixedDefinition), optional: undefined }
  assert.equal(validateQuestionDefinition(withUndefined), false)
})

test('numeric contracts preserve decimal strings and reject unsupported notation or tolerances', () => {
  assert.equal(validateQuestionContent(numericDefinition.content), true)
  assert.equal(validateQuestionContent({ ...copy(numericDefinition.content), correctAnswer: '1e0' }), false)
  assert.equal(validateQuestionContent({ ...copy(numericDefinition.content), correctAnswer: '01.013' }), false)
  assert.equal(validateQuestionContent({
    ...copy(numericDefinition.content),
    grading: { ...numericDefinition.content.grading, absoluteTolerance: '-0.001' },
  }), false)
  assert.equal(validateQuestionContent({
    ...copy(numericDefinition.content),
    grading: { ...numericDefinition.content.grading, roundingDigits: 1.5 },
  }), false)
  assert.equal(validateQuestionContent({
    ...copy(numericDefinition.content),
    correctAnswer: '0.000',
    grading: { type: 'numeric', unit: 'mm²', roundingDigits: 3, relativeTolerance: '0.005' },
  }), false)
  assert.equal(validateQuestionContent({ ...copy(numericDefinition.content), correctAnswer: '-0.000' }), true)
})

test('single-choice content rejects duplicate normalized labels and invalid references', () => {
  const duplicateLabels = copy(fixedDefinition.content)
  duplicateLabels.choices[1].label = '  mm  '
  assert.equal(validateQuestionContent(duplicateLabels), false)

  const missingFeedbackChoice = copy(fixedDefinition.content)
  missingFeedbackChoice.feedbackRules[0].choiceId = 'D'
  assert.equal(validateQuestionContent(missingFeedbackChoice), false)

  const correctChoiceFeedback = copy(fixedDefinition.content)
  correctChoiceFeedback.feedbackRules[0].choiceId = correctChoiceFeedback.correctAnswer
  assert.equal(validateQuestionContent(correctChoiceFeedback), false)
  assert.equal(validateQuestionDefinition({ ...copy(fixedDefinition), content: correctChoiceFeedback }), false)
  assert.throws(() => createQuestionInstance({ ...copy(fixedDefinition), content: correctChoiceFeedback }, { instanceId: 'correct-feedback' }), TypeError)

  const duplicateFeedbackChoice = copy(fixedDefinition.content)
  duplicateFeedbackChoice.feedbackRules[1].choiceId = duplicateFeedbackChoice.feedbackRules[0].choiceId
  assert.equal(validateQuestionContent(duplicateFeedbackChoice), false)
  assert.equal(validateQuestionDefinition({ ...copy(fixedDefinition), content: duplicateFeedbackChoice }), false)
  assert.throws(() => createQuestionInstance({ ...copy(fixedDefinition), content: duplicateFeedbackChoice }, { instanceId: 'duplicate-feedback' }), TypeError)

  const invalidSnapshot = copy(fixedInstance)
  invalidSnapshot.questionDefinitionSnapshot.content.feedbackRules[0].choiceId = 'B'
  assert.equal(validateQuestionInstance(invalidSnapshot), false)
  const invalidDuplicateSnapshot = copy(fixedInstance)
  invalidDuplicateSnapshot.questionDefinitionSnapshot.content.feedbackRules[1].choiceId = 'A'
  assert.equal(validateQuestionInstance(invalidDuplicateSnapshot), false)

  const numericWithChoices = { ...copy(numericDefinition.content), choices: [] }
  assert.equal(validateQuestionContent(numericWithChoices), false)
})

test('generated instance creation enforces integer parameter ranges and preserves seed text', () => {
  const atMinimum = { ...copy(generatedContent), parameters: { 'sample-size': 2 } }
  const atMaximum = { ...copy(generatedContent), parameters: { 'sample-size': 10 } }
  assert.equal(validateQuestionInstance(createQuestionInstance(generatedDefinition, { instanceId: 'min', content: atMinimum, seed: 's' })), true)
  assert.equal(validateQuestionInstance(createQuestionInstance(generatedDefinition, { instanceId: 'max', content: atMaximum, seed: 's' })), true)
  assert.equal(generatedInstance.seed, ' seed-1 ')

  const outsideRange = { ...copy(generatedContent), parameters: { 'sample-size': 11 } }
  const mismatchedUnit = { ...copy(generatedContent), grading: { ...generatedContent.grading, unit: 'mm' } }
  const mismatchedFeedbackRef = copy(generatedContent)
  mismatchedFeedbackRef.feedbackRules[0].lessonRef = 'unrelated#section'
  const missingFeedbackRule = { ...copy(generatedContent), feedbackRules: [] }
  assert.throws(() => createQuestionInstance(generatedDefinition, { instanceId: 'bad-range', content: outsideRange, seed: 's' }), TypeError)
  assert.throws(() => createQuestionInstance(generatedDefinition, { instanceId: 'bad-template', content: mismatchedUnit, seed: 's' }), TypeError)
  assert.throws(() => createQuestionInstance(generatedDefinition, { instanceId: 'bad-feedback-ref', content: mismatchedFeedbackRef, seed: 's' }), TypeError)
  assert.throws(() => createQuestionInstance(generatedDefinition, { instanceId: 'missing-feedback', content: missingFeedbackRule, seed: 's' }), TypeError)
  assert.throws(() => createQuestionInstance(generatedDefinition, { instanceId: 'blank-seed', content: generatedContent, seed: '  ' }), TypeError)
  assert.throws(() => createQuestionInstance(fixedDefinition, { instanceId: 'bad-fixed', seed: 's' }), TypeError)

  const zeroDefinition = copy(generatedDefinition)
  zeroDefinition.contentTemplate.relativeTolerance = '0.005'
  const zeroContent = copy(generatedContent)
  zeroContent.correctAnswer = '-0.000'
  zeroContent.grading.relativeTolerance = '0.005'
  assert.equal(validateQuestionDefinition(zeroDefinition), true)
  assert.equal(validateQuestionContent(zeroContent), true)
  assert.equal(validateQuestionInstance(createQuestionInstance(zeroDefinition, { instanceId: 'zero-both-tolerances', content: zeroContent, seed: 's' })), true)
})

test('generated single-choice content keeps the declared choice IDs and answer', () => {
  const definition = {
    kind: 'generated',
    questionId: 'q-generated-choice-001',
    revision: 1,
    lessonRefs: ['descriptive-statistics#variance'],
    difficulty: '基礎',
    sources: [],
    generator: { generationRuleVersion: 1, parameters: { count: { type: 'integer', min: 1, max: 2 } } },
    contentTemplate: {
      format: 'single-choice',
      promptTemplate: '単位を選びます。',
      conditionsTemplate: '測定値の単位はmmです。',
      choicesTemplate: fixedDefinition.content.choices.map(({ id, label }) => ({ id, labelTemplate: label })),
      correctAnswerTemplate: 'B',
      solutionTemplate: '単位を二乗します。',
      feedbackRulesTemplate: fixedDefinition.content.feedbackRules.map(({ choiceId, explanation, lessonRef }) => ({ choiceId, explanationTemplate: explanation, lessonRef })),
      defaultFeedbackTemplate: '単位を確認します。',
    },
  }
  const content = { ...copy(fixedDefinition.content), parameters: { count: 1 } }
  assert.equal(validateQuestionDefinition(definition), true)
  const generatedChoiceInstance = createQuestionInstance(definition, { instanceId: 'choice-generated', content, seed: 's' })
  assert.equal(validateQuestionInstance(generatedChoiceInstance), true)

  for (const feedbackRulesTemplate of [
    definition.contentTemplate.feedbackRulesTemplate.map((rule, index) => index === 0 ? { ...rule, choiceId: 'B' } : rule),
    definition.contentTemplate.feedbackRulesTemplate.map((rule, index) => index === 1 ? { ...rule, choiceId: 'A' } : rule),
  ]) {
    assert.equal(validateQuestionDefinition({ ...copy(definition), contentTemplate: { ...copy(definition.contentTemplate), feedbackRulesTemplate } }), false)
  }

  const answerMismatchDefinition = copy(definition)
  answerMismatchDefinition.contentTemplate.feedbackRulesTemplate = answerMismatchDefinition.contentTemplate.feedbackRulesTemplate.filter((rule) => rule.choiceId !== 'A')
  const mismatchedAnswer = {
    ...copy(content),
    correctAnswer: 'A',
    feedbackRules: content.feedbackRules.filter((rule) => rule.choiceId !== 'A'),
  }
  assert.equal(validateQuestionContent(mismatchedAnswer), true)
  assert.equal(validateQuestionDefinition(answerMismatchDefinition), true)
  assert.throws(() => createQuestionInstance(answerMismatchDefinition, { instanceId: 'choice-wrong-answer', content: mismatchedAnswer, seed: 's' }), TypeError)

  const mismatchedFeedbackBranch = copy(content)
  mismatchedFeedbackBranch.feedbackRules.reverse()
  assert.equal(validateQuestionContent(mismatchedFeedbackBranch), true)
  assert.throws(() => createQuestionInstance(definition, { instanceId: 'choice-wrong-feedback', content: mismatchedFeedbackBranch, seed: 's' }), TypeError)

  const correctBranchContent = copy(content)
  correctBranchContent.feedbackRules[0].choiceId = 'B'
  assert.equal(validateQuestionContent(correctBranchContent), false)
  assert.throws(() => createQuestionInstance(definition, { instanceId: 'choice-correct-feedback', content: correctBranchContent, seed: 's' }), TypeError)
  const invalidCorrectSnapshot = copy(generatedChoiceInstance)
  invalidCorrectSnapshot.questionDefinitionSnapshot.content.feedbackRules = correctBranchContent.feedbackRules
  assert.equal(validateQuestionInstance(invalidCorrectSnapshot), false)

  const duplicateBranchContent = copy(content)
  duplicateBranchContent.feedbackRules[1].choiceId = duplicateBranchContent.feedbackRules[0].choiceId
  assert.equal(validateQuestionContent(duplicateBranchContent), false)
  assert.throws(() => createQuestionInstance(definition, { instanceId: 'choice-duplicate-feedback', content: duplicateBranchContent, seed: 's' }), TypeError)
  const invalidDuplicateGeneratedSnapshot = copy(generatedChoiceInstance)
  invalidDuplicateGeneratedSnapshot.questionDefinitionSnapshot.content.feedbackRules = duplicateBranchContent.feedbackRules
  assert.equal(validateQuestionInstance(invalidDuplicateGeneratedSnapshot), false)
})

test('created snapshots are independent and remain valid without the current definition', () => {
  const sourceContent = copy(generatedContent)
  const sourceDefinition = copy(generatedDefinition)
  const instance = createQuestionInstance(sourceDefinition, {
    instanceId: 'snapshot-copy',
    content: sourceContent,
    seed: 'seed-copy',
  })
  sourceContent.parameters['sample-size'] = 8
  sourceContent.conditions = 'changed after creation'
  sourceContent.grading.unit = 'changed unit'
  sourceDefinition.revision = 2
  sourceDefinition.lessonRefs[0] = 'descriptive-statistics#variance'
  assert.equal(instance.questionDefinitionSnapshot.content.parameters['sample-size'], 4)
  assert.equal(instance.questionDefinitionSnapshot.content.conditions, '値の合計は20、標本サイズは4です。')
  assert.equal(instance.questionDefinitionSnapshot.content.grading.unit, '個')

  const parsed = JSON.parse(JSON.stringify(instance))
  assert.equal(validateQuestionDefinition(sourceDefinition), true)
  assert.equal(validateQuestionInstance(parsed), true)
  assert.equal(Object.isFrozen(parsed), false)
  assert.equal(Object.isFrozen(parsed.questionDefinitionSnapshot.content.feedbackRules), false)
  const restored = restoreQuestionInstance(parsed)
  assert.equal(Object.isFrozen(parsed), false)
  assert.equal(Object.isFrozen(restored), true)
  assert.equal(Object.isFrozen(restored.questionDefinitionSnapshot.content.feedbackRules), true)
  assert.equal(Object.isFrozen(restored.questionDefinitionSnapshot.content.feedbackRules[0]), true)
  assert.throws(() => { restored.questionDefinitionSnapshot.content.feedbackRules[0].explanation = '変更' }, TypeError)
  parsed.questionDefinitionSnapshot.content.conditions = '復元元だけ変更'
  assert.equal(restored.questionDefinitionSnapshot.revision, 1)
  assert.equal(restored.questionDefinitionSnapshot.lessonRefs[0], 'descriptive-statistics#mean')
  assert.equal(restored.questionDefinitionSnapshot.content.conditions, '値の合計は20、標本サイズは4です。')
})

test('instance validators reject mismatched identity, revision, and generation rule version', () => {
  assert.equal(validateQuestionInstance({ ...copy(generatedInstance), questionId: 'other-question' }), false)
  assert.throws(() => restoreQuestionInstance({ ...copy(generatedInstance), questionId: 'other-question' }), TypeError)
  assert.equal(validateQuestionInstance({ ...copy(generatedInstance), questionDefinitionRevision: 2 }), false)

  const mismatchedRule = copy(generatedInstance)
  mismatchedRule.questionDefinitionSnapshot.generationRuleVersion = 2
  assert.equal(validateQuestionInstance(mismatchedRule), false)
  assert.equal(validateQuestionInstance({ ...copy(fixedInstance), instanceId: '' }), false)
})
