// @ts-check
import { createQuestionInstance, restoreQuestionInstance } from '../src/question-contract.mjs'
import { getQuestionDefinition } from '../src/question-registry.mjs'

/** @param {string} questionId @returns {import('../src/question-contract.mjs').FixedQuestionDefinition} */
function fixedQuestion(questionId) {
  const definition = getQuestionDefinition(questionId)
  if (definition.kind !== 'fixed') throw new TypeError('Fixed question required')
  return structuredClone(definition)
}

export const fixedDefinition = fixedQuestion('q-desc-var-sc-001')
export const numericDefinition = fixedQuestion('q-desc-var-num-001')
/** @type {import('../src/question-contract.mjs').GeneratedQuestionDefinition} */
export const generatedDefinition = {
  kind: 'generated',
  questionId: 'q-generated-mean-001',
  revision: 1,
  lessonRefs: ['descriptive-statistics#mean'],
  difficulty: '標準',
  sources: [],
  generator: {
    generationRuleVersion: 1,
    parameters: { 'sample-size': { type: 'integer', min: 2, max: 10 } },
  },
  contentTemplate: {
    format: 'numeric',
    promptTemplate: 'n個の値の平均を求めます。',
    conditionsTemplate: '標本サイズはnです。',
    correctAnswerTemplate: 'sum / sample-size',
    unit: '個',
    roundingDigits: 0,
    absoluteTolerance: '0',
    solutionTemplate: '合計をnで割ります。',
    feedbackRulesTemplate: [
      { answerTemplate: 'sum', explanationTemplate: '合計と平均を区別します。', lessonRef: 'descriptive-statistics#mean' },
    ],
    defaultFeedbackTemplate: '平均の式を確認します。',
  },
}

/** @type {import('../src/question-contract.mjs').QuestionContent} */
export const generatedContent = {
  format: 'numeric',
  prompt: '4個の値の平均を求めます。',
  conditions: '値の合計は20、標本サイズは4です。',
  parameters: { 'sample-size': 4 },
  correctAnswer: '5',
  grading: { type: 'numeric', unit: '個', roundingDigits: 0, absoluteTolerance: '0' },
  solution: '20 / 4 = 5です。',
  feedbackRules: [
    { answer: '20', explanation: '合計と平均を区別します。', lessonRef: 'descriptive-statistics#mean' },
  ],
  defaultFeedback: '平均の式を確認します。',
}

export const fixedInstance = createQuestionInstance(fixedDefinition, { instanceId: 'attempt-question-1' })
export const generatedInstance = createQuestionInstance(generatedDefinition, {
  instanceId: 'attempt-question-2',
  content: generatedContent,
  seed: ' seed-1 ',
})

export function assertReadonlyInstanceTypes() {
  const fixed = createQuestionInstance(fixedDefinition, { instanceId: 'type-check' })
  if (fixed.questionDefinitionSnapshot.content.format === 'single-choice') {
    // @ts-expect-error returned snapshots are deeply readonly
    fixed.questionDefinitionSnapshot.content.choices[0].label = '変更'
    // @ts-expect-error returned arrays are readonly
    fixed.questionDefinitionSnapshot.content.choices.push({ id: 'D', label: '追加' })
  }

  const generated = createQuestionInstance(generatedDefinition, {
    instanceId: 'type-check',
    content: generatedContent,
    seed: 's',
  })
  if (generated.questionDefinitionSnapshot.content.format === 'numeric') {
    // @ts-expect-error nested generated content is readonly too
    generated.questionDefinitionSnapshot.content.grading.unit = '変更'
  }

  const restored = restoreQuestionInstance(fixedInstance)
  if (restored.kind === 'fixed' && restored.questionDefinitionSnapshot.content.format === 'single-choice') {
    // @ts-expect-error restored snapshots are deeply readonly
    restored.questionDefinitionSnapshot.content.choices[0].label = '変更'
    // @ts-expect-error restored snapshot arrays are readonly
    restored.questionDefinitionSnapshot.content.choices.push({ id: 'D', label: '追加' })
  }
}
