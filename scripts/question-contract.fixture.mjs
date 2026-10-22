// @ts-check
import { createQuestionInstance } from '../src/question-contract.mjs'

/** @type {import('../src/question-contract.mjs').FixedQuestionDefinition} */
export const fixedDefinition = {
  kind: 'fixed',
  questionId: 'q-desc-var-sc-001',
  revision: 1,
  lessonRefs: ['descriptive-statistics#variance'],
  difficulty: '基礎',
  sources: [],
  content: {
    format: 'single-choice',
    prompt: '分散の単位を選んでください。',
    conditions: '測定値の単位はmmです。',
    parameters: {},
    choices: [
      { id: 'A', label: 'mm' },
      { id: 'B', label: 'mm²' },
      { id: 'C', label: 'mm⁻¹' },
    ],
    correctAnswer: 'B',
    grading: { type: 'single-choice' },
    solution: '偏差を二乗するため、単位も二乗されます。',
    feedbackRules: [
      { choiceId: 'A', explanation: '偏差と分散の単位を確認します。', lessonRef: 'descriptive-statistics#variance' },
      { choiceId: 'C', explanation: '単位を逆数にする計算はありません。', lessonRef: 'descriptive-statistics#variance' },
    ],
    defaultFeedback: '分散の式で単位を順に確認します。',
  },
}

/** @type {import('../src/question-contract.mjs').FixedQuestionDefinition} */
export const numericDefinition = {
  kind: 'fixed',
  questionId: 'q-desc-var-num-001',
  revision: 1,
  lessonRefs: ['descriptive-statistics#variance'],
  difficulty: '標準',
  sources: [],
  content: {
    format: 'numeric',
    prompt: '標本分散を小数第3位まで求めてください。',
    conditions: '測定値は1.000 mm、2.200 mm、3.000 mm、分母はn−1です。',
    parameters: { x1: '1.000', x2: '2.200', x3: '3.000' },
    correctAnswer: '1.013',
    grading: { type: 'numeric', unit: 'mm²', roundingDigits: 3, absoluteTolerance: '0.002', relativeTolerance: '0.005' },
    solution: '標本分散は76/75 = 1.013333… mm²です。',
    feedbackRules: [
      { answer: '0.676', explanation: '分母をn−1にします。', lessonRef: 'descriptive-statistics#variance' },
    ],
    defaultFeedback: '分散の式と丸め位置を確認します。',
  },
}

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
