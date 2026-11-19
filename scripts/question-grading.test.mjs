import assert from 'node:assert/strict'
import test from 'node:test'
import { gradeDecimalAnswer, gradeNumericExerciseAnswers, isValidDecimalAnswer } from '../src/question-grading.mjs'

test('decimal grading rounds half away from zero and compares exact values', () => {
  assert.deepEqual(gradeDecimalAnswer('1.234', '1.23', 2), { status: 'graded', isCorrect: true })
  assert.deepEqual(gradeDecimalAnswer('1.235', '1.23', 2), { status: 'graded', isCorrect: false })
  assert.deepEqual(gradeDecimalAnswer('1.5', '2', 0), { status: 'graded', isCorrect: true })
  assert.deepEqual(gradeDecimalAnswer('-1.5', '-2', 0), { status: 'graded', isCorrect: true })
  assert.deepEqual(gradeDecimalAnswer('1.4', '1.5', 0), { status: 'graded', isCorrect: false })
  assert.deepEqual(gradeDecimalAnswer('90071992547409931234567890.1234567890123',
    '90071992547409931234567890.1234567890123', 13), { status: 'graded', isCorrect: true })
})

test('decimal grading validates rounding settings and expected values before answers', () => {
  for (const digits of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '2', -0]) {
    assert.deepEqual(gradeDecimalAnswer('bad', 'bad', digits), { status: 'invalid', reason: 'invalid-rounding-digits' })
  }
  assert.deepEqual(gradeDecimalAnswer('bad', '1e0', 2), { status: 'invalid', reason: 'invalid-expected-value' })
  assert.deepEqual(gradeDecimalAnswer('bad', '1', 2), { status: 'invalid', reason: 'invalid-answer-format' })
})

test('numeric exercise grading maps fields by ID and gives definition errors priority', () => {
  const fields = [{ id: 'first' }, { id: 'second' }]
  const expected = [
    { fieldId: 'second', expected: '3', roundingDigits: 0 },
    { fieldId: 'first', expected: '2', roundingDigits: 0 },
  ]
  assert.deepEqual(gradeNumericExerciseAnswers(fields, expected, { first: '２', second: '3' }), {
    status: 'graded', isCorrect: true,
  })
  assert.deepEqual(gradeNumericExerciseAnswers(fields, expected, { first: '2', second: '' }), {
    status: 'invalid', reason: 'invalid-answer-format',
  })
  assert.deepEqual(gradeNumericExerciseAnswers(fields, [
    { fieldId: 'first', expected: 'invalid', roundingDigits: 0 }, expected[0],
  ], { first: '', second: '3' }), { status: 'invalid', reason: 'invalid-grading-definition' })
  assert.deepEqual(gradeNumericExerciseAnswers(fields, [
    { fieldId: 'first', expected: '2', roundingDigits: -1 }, expected[0],
  ], { first: '', second: '3' }), { status: 'invalid', reason: 'invalid-grading-definition' })
})

test('decimal grading rejects unsupported input syntax and accepts signed decimal notation', () => {
  assert.deepEqual(gradeDecimalAnswer('+1.0', '1', 2), { status: 'graded', isCorrect: true })
  assert.deepEqual(gradeDecimalAnswer(' 1.000 ', '1', 2), { status: 'graded', isCorrect: true })
  for (const answer of ['1e0', '1 個', '01', '', '.5', '1.', '+', 1, null]) {
    assert.deepEqual(gradeDecimalAnswer(answer, '1', 2), { status: 'invalid', reason: 'invalid-answer-format' })
  }
})

test('decimal contract validation shares grading syntax', () => {
  for (const value of ['-1', '+1.25', ' 0.5 ']) assert.equal(isValidDecimalAnswer(value), true)
  for (const value of ['01', '1e0', '1.', '1 mm', Number.POSITIVE_INFINITY]) assert.equal(isValidDecimalAnswer(value), false)
})

test('decimal grading handles excessive precision and very large rounding settings', { timeout: 1000 }, () => {
  assert.deepEqual(gradeDecimalAnswer('1.' + '0'.repeat(100_000) + '1', '1', 2), { status: 'graded', isCorrect: true })
  assert.deepEqual(gradeDecimalAnswer('1.2', '1.3', Number.MAX_SAFE_INTEGER), { status: 'graded', isCorrect: false })
})
