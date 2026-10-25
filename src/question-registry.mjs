/** @type {import('./question-contract.mjs').QuestionDefinition[]} */
export const questionRegistry = [
  {
    kind: 'fixed',
    questionId: 'q-desc-var-sc-001',
    revision: 1,
    lessonRefs: ['descriptive-statistics#variance'],
    difficulty: '基礎',
    sources: [],
    content: {
      format: 'single-choice',
      prompt: '分散s²の単位として正しいものを選んでください。元の測定値の単位はmmです。',
      conditions: '分散の式では平均との差（偏差）を二乗して集計します。',
      parameters: {},
      choices: [
        { id: 'A', label: 'mm' },
        { id: 'B', label: 'mm²' },
        { id: 'C', label: 'mm⁻¹' },
      ],
      correctAnswer: 'B',
      grading: { type: 'single-choice' },
      solution: '偏差はmmで表され、分散では偏差を二乗するため、単位もmm²になります。',
      feedbackRules: [
        { choiceId: 'A', explanation: 'mmは偏差の単位です。分散では偏差を二乗します。', lessonRef: 'descriptive-statistics#variance' },
        { choiceId: 'C', explanation: '分散の計算に単位を逆数にする操作はありません。', lessonRef: 'descriptive-statistics#variance' },
      ],
      defaultFeedback: '偏差と分散の単位を、二乗する計算に沿って確認します。',
    },
  },
  {
    kind: 'fixed',
    questionId: 'q-desc-var-num-001',
    revision: 1,
    lessonRefs: ['descriptive-statistics#variance'],
    difficulty: '標準',
    sources: [],
    content: {
      format: 'numeric',
      prompt: '標本とみなす測定値1.000 mm、2.200 mm、3.000 mmから、母分散の不偏推定量である不偏分散を求めてください。結果は小数第3位までです。入力値は採点時に小数第3位へ丸めます。',
      conditions: '母分散の不偏推定量である不偏分散 s² = Σ(xᵢ − x̄)² / (n−1) です。単位はmm²です。',
      parameters: { x1: '1.000', x2: '2.200', x3: '3.000' },
      correctAnswer: '1.013',
      grading: { type: 'numeric', unit: 'mm²', roundingDigits: 3, absoluteTolerance: '0.002', relativeTolerance: '0.005' },
      solution: '標本平均は(1.000 + 2.200 + 3.000)/3 = 31/15 mmです。偏差平方和は(−16/15)² + (2/15)² + (14/15)² = 456/225 = 152/75 mm²です。n−1=2で割ると、76/75 = 1.013333… mm²なので、1.013 mm²です。',
      feedbackRules: [
        { answer: '0.676', explanation: 'これは偏差平方和をn=3で割った標本内の分散です。母分散の不偏推定量ではn−1=2で割ります。', lessonRef: 'descriptive-statistics#variance' },
      ],
      defaultFeedback: '何を記述または推定するのかを確認し、分母と丸めの位置を見直します。',
    },
  },
  {
    kind: 'fixed',
    questionId: 'q-desc-mean-sc-001',
    revision: 1,
    lessonRefs: ['descriptive-statistics#mean'],
    difficulty: '基礎',
    sources: [],
    content: {
      format: 'single-choice',
      prompt: '測定値2 mm、4 mm、6 mmの算術平均を選んでください。',
      conditions: '3つの値は同じ量を表し、単位はすべてmmです。',
      parameters: { x1: 2, x2: 4, x3: 6 },
      choices: [
        { id: 'A', label: '4 mm' },
        { id: 'B', label: '12 mm' },
        { id: 'C', label: '6 mm' },
      ],
      correctAnswer: 'A',
      grading: { type: 'single-choice' },
      solution: '(2 + 4 + 6)/3 = 12/3 = 4 mmです。',
      feedbackRules: [
        { choiceId: 'B', explanation: '12 mmは合計です。平均を求めるには、合計を値の個数3で割ります。', lessonRef: 'descriptive-statistics#mean' },
        { choiceId: 'C', explanation: '6 mmは合計をn−1=2で割った値です。平均では値の個数n=3で割ります。', lessonRef: 'descriptive-statistics#mean' },
      ],
      defaultFeedback: '値の合計と個数を使って、平均の式を確かめます。',
    },
  },
  {
    kind: 'fixed',
    questionId: 'q-desc-sd-sc-001',
    revision: 1,
    lessonRefs: ['descriptive-statistics#standard-deviation'],
    difficulty: '基礎',
    sources: [],
    content: {
      format: 'single-choice',
      prompt: '分散が4 mm²のとき、標準偏差を選んでください。',
      conditions: '標準偏差は分散の非負の平方根です。',
      parameters: { variance: '4' },
      choices: [
        { id: 'A', label: '2 mm' },
        { id: 'B', label: '4 mm²' },
        { id: 'C', label: '2 mm²' },
      ],
      correctAnswer: 'A',
      grading: { type: 'single-choice' },
      solution: '√(4 mm²) = 2 mmです。平方根を取ると単位もmmに戻ります。',
      feedbackRules: [
        { choiceId: 'B', explanation: '4 mm²は分散の値です。標準偏差では分散の平方根を取ります。', lessonRef: 'descriptive-statistics#standard-deviation' },
        { choiceId: 'C', explanation: '数値の平方根は2ですが、標準偏差の単位は分散の単位を平方根にしたmmです。', lessonRef: 'descriptive-statistics#standard-deviation' },
      ],
      defaultFeedback: '平方根を取ることと、単位が元のmmに戻ることを確認します。',
    },
  },
  {
    kind: 'generated',
    questionId: 'q-desc-var-gen-num-001',
    revision: 1,
    lessonRefs: ['descriptive-statistics#variance'],
    difficulty: '標準',
    sources: [],
    generator: {
      generationRuleVersion: 1,
      parameters: { d: { type: 'integer', min: 1, max: 9 } },
    },
    contentTemplate: {
      format: 'numeric',
      promptTemplate: '母集団全体の測定値から母分散を求めてください。',
      conditionsTemplate: 'dは1〜9 mmの整数です。測定値は(10−d), 10, (10+d) mmで、この3値を母集団全体として扱います。',
      correctAnswerTemplate: '2d²/3を小数第3位へ丸めた値',
      unit: 'mm²',
      roundingDigits: 3,
      absoluteTolerance: '0',
      solutionTemplate: '平均は10 mm、偏差は−d, 0, +d mm、偏差平方和は2d² mm²です。母分散は2d²/3 mm²です。',
      feedbackRulesTemplate: [
        { answerTemplate: 'd²', explanationTemplate: 'd²は偏差平方和をn−1=2で割った値です。母分散ではN=3で割ります。', lessonRef: 'descriptive-statistics#variance' },
      ],
      defaultFeedbackTemplate: '母分散では偏差平方和を母集団の個数Nで割ります。',
    },
  },
]

/** @param {string} questionId @returns {import('./question-contract.mjs').QuestionDefinition} */
export function getQuestionDefinition(questionId) {
  const definition = questionRegistry.find((question) => question.questionId === questionId)
  if (!definition) throw new TypeError('Unknown question ID')
  return definition
}
