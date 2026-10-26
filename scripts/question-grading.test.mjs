import assert from 'node:assert/strict'
import test from 'node:test'
import { createQuestionInstance } from '../src/question-contract.mjs'
import { generateQuestionContent } from '../src/question-generator.mjs'
import { gradeQuestionAnswer } from '../src/question-grading.mjs'
import { getQuestionDefinition, questionRegistry } from '../src/question-registry.mjs'

function productionInstances() {
  return questionRegistry.map((definition) => {
    if (definition.kind === 'fixed') {
      return createQuestionInstance(definition, { instanceId: 'grading-' + definition.questionId })
    }
    const seed = 'issue-21-grading'
    return createQuestionInstance(definition, {
      instanceId: 'grading-' + definition.questionId,
      content: generateQuestionContent(definition.questionId, {
        generationRuleVersion: definition.generator.generationRuleVersion,
        seed,
      }),
      seed,
    })
  })
}

function numericInstance(overrides = {}) {
  const baseContent = {
    format: 'numeric',
    prompt: '十進数を入力してください。',
    conditions: '合成テスト用の採点条件です。',
    parameters: {},
    correctAnswer: '100',
    grading: { type: 'numeric', unit: '個', roundingDigits: 3, absoluteTolerance: '0', relativeTolerance: '0' },
    solution: '合成テスト用の解説です。',
    feedbackRules: [{ answer: '0', explanation: '典型的な値の例です。', lessonRef: 'test#numeric' }],
    defaultFeedback: '原因を特定できないため、式を確認します。',
  }
  const grading = { ...baseContent.grading, ...overrides.grading }
  for (const key of Object.keys(grading)) if (grading[key] === undefined) delete grading[key]
  const content = {
    ...baseContent,
    ...overrides,
    grading,
  }
  return createQuestionInstance({
    kind: 'fixed',
    questionId: 'grading-synthetic-numeric',
    revision: 1,
    lessonRefs: ['test#numeric'],
    difficulty: '基礎',
    sources: [],
    content,
  }, { instanceId: 'synthetic-numeric' })
}

function choiceInstance() {
  return createQuestionInstance({
    kind: 'fixed',
    questionId: 'grading-synthetic-choice',
    revision: 1,
    lessonRefs: ['test#choice'],
    difficulty: '基礎',
    sources: [],
    content: {
      format: 'single-choice',
      prompt: '選択肢を選んでください。',
      conditions: '合成テスト用の条件です。',
      parameters: {},
      choices: [{ id: 'A', label: '正答' }, { id: 'B', label: '既知の誤答' }, { id: 'C', label: '未知の誤答' }],
      correctAnswer: 'A',
      grading: { type: 'single-choice' },
      solution: '合成テスト用の解説です。',
      feedbackRules: [{ choiceId: 'B', explanation: '個別説明です。', lessonRef: 'test#choice' }],
      defaultFeedback: '共通説明です。',
    },
  }, { instanceId: 'synthetic-choice' })
}

function assertJsonCompatible(value) {
  assert.deepEqual(JSON.parse(JSON.stringify(value)), value)
}

test('all production snapshots grade correct and known wrong answers with their saved feedback', () => {
  for (const instance of productionInstances()) {
    const content = instance.questionDefinitionSnapshot.content
    const correct = gradeQuestionAnswer(instance, content.correctAnswer)
    assert.deepEqual(correct, { status: 'graded', isCorrect: true, feedback: null }, instance.questionId)
    assertJsonCompatible(correct)

    if (content.format === 'single-choice') {
      for (const rule of content.feedbackRules) {
        const result = gradeQuestionAnswer(instance, rule.choiceId)
        assert.equal(result.status, 'graded')
        assert.equal(result.isCorrect, false)
        assert.equal(result.feedback.source, 'rule')
        assert.deepEqual(result.feedback.matchedRule, { kind: 'single-choice', choiceId: rule.choiceId })
        assert.equal(result.feedback.lessonRef, rule.lessonRef)
        assertJsonCompatible(result)
      }
    } else {
      for (const rule of content.feedbackRules) {
        const result = gradeQuestionAnswer(instance, rule.answer)
        assert.equal(result.status, 'graded')
        assert.equal(result.isCorrect, false)
        assert.equal(result.feedback.source, 'rule')
        assert.deepEqual(result.feedback.matchedRule, { kind: 'numeric', answer: rule.answer })
        assert.equal(result.feedback.lessonRef, rule.lessonRef)
        assertJsonCompatible(result)
      }
      const unknown = gradeQuestionAnswer(instance, '987654321.123')
      assert.equal(unknown.status, 'graded')
      assert.equal(unknown.isCorrect, false)
      assert.deepEqual(unknown.feedback, {
        source: 'default',
        explanation: content.defaultFeedback,
        lessonRef: instance.questionDefinitionSnapshot.lessonRefs[0],
      })
      assertJsonCompatible(unknown)
    }
  }
})

test('single choice distinguishes correct, rule, default, and invalid answers', () => {
  const instance = choiceInstance()
  assert.deepEqual(gradeQuestionAnswer(instance, 'A'), { status: 'graded', isCorrect: true, feedback: null })
  assert.deepEqual(gradeQuestionAnswer(instance, 'B'), {
    status: 'graded',
    isCorrect: false,
    feedback: {
      source: 'rule', explanation: '個別説明です。', lessonRef: 'test#choice',
      matchedRule: { kind: 'single-choice', choiceId: 'B' },
    },
  })
  assert.deepEqual(gradeQuestionAnswer(instance, 'C'), {
    status: 'graded',
    isCorrect: false,
    feedback: { source: 'default', explanation: '共通説明です。', lessonRef: 'test#choice' },
  })
  assert.deepEqual(gradeQuestionAnswer(instance, 'D'), { status: 'invalid', reason: 'invalid-answer-format' })
  assert.deepEqual(gradeQuestionAnswer(instance, 1), { status: 'invalid', reason: 'invalid-answer-format' })
})

test('numeric input accepts signed decimals and outside whitespace, and rejects other syntax and units', () => {
  const instance = numericInstance({ correctAnswer: '1', grading: { absoluteTolerance: '0' } })
  for (const answer of ['+1.0', ' 1.000 ', '\t+1.0\n', '-0']) {
    const expected = answer === '-0'
      ? numericInstance({ correctAnswer: '0', grading: { absoluteTolerance: '0' } })
      : instance
    assert.equal(gradeQuestionAnswer(expected, answer).isCorrect, true, JSON.stringify(answer))
  }
  for (const answer of ['', ' \t\n', '01.0', '.5', '1.', '1,0', '1e0', '1 + 0', '1 個', '+', 1, null]) {
    assert.deepEqual(gradeQuestionAnswer(instance, answer), { status: 'invalid', reason: 'invalid-answer-format' }, String(answer))
  }
})

test('absolute and relative tolerance include their boundary and use OR', () => {
  const absolute = numericInstance({ grading: { absoluteTolerance: '0.1', relativeTolerance: '0' } })
  for (const [answer, expected] of [['100.099', true], ['100.100', true], ['100.101', false]]) {
    assert.equal(gradeQuestionAnswer(absolute, answer).isCorrect, expected, answer)
  }

  const relative = numericInstance({ grading: { absoluteTolerance: '0', relativeTolerance: '0.01' } })
  for (const [answer, expected] of [['100.999', true], ['101', true], ['101.001', false]]) {
    assert.equal(gradeQuestionAnswer(relative, answer).isCorrect, expected, answer)
  }

  const either = numericInstance({ grading: { absoluteTolerance: '0.05', relativeTolerance: '0.01' } })
  assert.equal(gradeQuestionAnswer(either, '100.5').isCorrect, true)
})

test('rounding is half away from zero, carries digits, and ignores relative tolerance when expected rounds to zero', () => {
  assert.equal(gradeQuestionAnswer(numericInstance({ correctAnswer: '1.235' }), '1.2345').isCorrect, true)
  assert.equal(gradeQuestionAnswer(numericInstance({ correctAnswer: '-1.235' }), '-1.2345').isCorrect, true)
  assert.equal(gradeQuestionAnswer(numericInstance({
    correctAnswer: '10.00', grading: { roundingDigits: 2 },
  }), '9.995').isCorrect, true)

  const zero = numericInstance({
    correctAnswer: '0.0004',
    grading: { absoluteTolerance: '0.001', relativeTolerance: '999' },
  })
  assert.equal(gradeQuestionAnswer(zero, '-0').isCorrect, true)
  assert.equal(gradeQuestionAnswer(zero, '0.001').isCorrect, true)
  assert.equal(gradeQuestionAnswer(zero, '0.002').isCorrect, false)
})

test('large exact decimals and floating-point boundary values remain exact', () => {
  const exact = '90071992547409931234567890.1234567890123'
  const instance = numericInstance({
    correctAnswer: exact,
    grading: { roundingDigits: 13 },
  })
  assert.equal(gradeQuestionAnswer(instance, exact).isCorrect, true)
  assert.equal(gradeQuestionAnswer(instance, '90071992547409931234567890.1234567890124').isCorrect, false)

  const floatingPointBoundary = numericInstance({ correctAnswer: '0.3', grading: { absoluteTolerance: '0.1', roundingDigits: 1 } })
  assert.equal(gradeQuestionAnswer(floatingPointBoundary, '0.4').isCorrect, true)
})

test('maximum rounding digits do not create powers or padding based on the requested digits', { timeout: 1000 }, () => {
  const absolute = numericInstance({
    correctAnswer: '1.2',
    grading: { roundingDigits: Number.MAX_SAFE_INTEGER, absoluteTolerance: '0.1', relativeTolerance: '0' },
  })
  assert.equal(gradeQuestionAnswer(absolute, '1.3').isCorrect, true)

  const relative = numericInstance({
    correctAnswer: '100',
    grading: { roundingDigits: Number.MAX_SAFE_INTEGER, absoluteTolerance: undefined, relativeTolerance: '0.01' },
  })
  assert.equal(gradeQuestionAnswer(relative, '101').isCorrect, true)
})

test('numeric feedback preserves snapshot rule text and defaults on ambiguous matches', () => {
  const unique = numericInstance({
    feedbackRules: [{ answer: '0.6760', explanation: '典型的な値です。', lessonRef: 'test#rule' }],
  })
  const result = gradeQuestionAnswer(unique, '0.676')
  assert.equal(result.isCorrect, false)
  assert.deepEqual(result.feedback.matchedRule, { kind: 'numeric', answer: '0.6760' })
  assert.equal(result.feedback.explanation, '典型的な値です。')

  const ambiguous = numericInstance({
    grading: { roundingDigits: 2 },
    feedbackRules: [
      { answer: '0.671', explanation: '一つ目', lessonRef: 'test#one' },
      { answer: '0.674', explanation: '二つ目', lessonRef: 'test#two' },
    ],
  })
  assert.deepEqual(gradeQuestionAnswer(ambiguous, '0.673'), {
    status: 'graded',
    isCorrect: false,
    feedback: { source: 'default', explanation: '原因を特定できないため、式を確認します。', lessonRef: 'test#numeric' },
  })

  const correctPriority = numericInstance({
    feedbackRules: [{ answer: '100', explanation: '正答と重なるrule', lessonRef: 'test#rule' }],
  })
  assert.deepEqual(gradeQuestionAnswer(correctPriority, '100'), { status: 'graded', isCorrect: true, feedback: null })
})

test('invalid instances are distinct from incorrect answers', () => {
  assert.deepEqual(gradeQuestionAnswer(null, 'A'), { status: 'invalid', reason: 'invalid-instance' })
  assert.deepEqual(gradeQuestionAnswer({}, 'A'), { status: 'invalid', reason: 'invalid-instance' })

  const valid = numericInstance()
  const malformedSnapshot = JSON.parse(JSON.stringify(valid))
  malformedSnapshot.questionDefinitionSnapshot.content.format = 'unsupported'
  assert.deepEqual(gradeQuestionAnswer(malformedSnapshot, '100'), { status: 'invalid', reason: 'invalid-instance' })

  const inconsistentInstance = JSON.parse(JSON.stringify(valid))
  inconsistentInstance.questionDefinitionRevision += 1
  assert.deepEqual(gradeQuestionAnswer(inconsistentInstance, '100'), { status: 'invalid', reason: 'invalid-instance' })

  const throwingProxy = new Proxy({}, { getPrototypeOf() { throw new Error('untrusted object') } })
  assert.deepEqual(gradeQuestionAnswer(throwingProxy, '100'), { status: 'invalid', reason: 'invalid-instance' })
})

test('grading is repeatable, leaves snapshots unchanged, and ignores later definition changes', () => {
  const definition = structuredClone(getQuestionDefinition('q-desc-var-num-001'))
  assert.equal(definition.kind, 'fixed')
  const instance = createQuestionInstance(definition, { instanceId: 'repeatable-snapshot' })
  const before = JSON.stringify(instance)
  const first = gradeQuestionAnswer(instance, '1.013')
  definition.content.correctAnswer = '99'
  assert.deepEqual(gradeQuestionAnswer(instance, '1.013'), first)
  assert.equal(JSON.stringify(instance), before)
})

test('fixed variance revision 2 rejects 1.018 while revision 1 snapshots keep their saved tolerance', () => {
  const currentDefinition = structuredClone(getQuestionDefinition('q-desc-var-num-001'))
  const previousDefinition = structuredClone(currentDefinition)
  previousDefinition.revision = 1
  previousDefinition.content.grading.absoluteTolerance = '0.002'
  previousDefinition.content.grading.relativeTolerance = '0.005'

  const previousSnapshot = createQuestionInstance(previousDefinition, { instanceId: 'variance-revision-1' })
  const currentSnapshot = createQuestionInstance(currentDefinition, { instanceId: 'variance-revision-2' })

  assert.equal(previousSnapshot.questionDefinitionRevision, 1)
  assert.equal(gradeQuestionAnswer(previousSnapshot, '1.018').isCorrect, true)
  assert.equal(currentSnapshot.questionDefinitionRevision, 2)
  assert.equal(gradeQuestionAnswer(currentSnapshot, '1.018').isCorrect, false)
  assert.equal(gradeQuestionAnswer(currentSnapshot, '1.013').isCorrect, true)
  assert.equal(gradeQuestionAnswer(currentSnapshot, '1.0125').isCorrect, true)
  assert.equal(gradeQuestionAnswer(currentSnapshot, '1.0135').isCorrect, false)
})
