import assert from 'node:assert/strict'
import test from 'node:test'
import { gradeDecimalAnswer } from '../src/question-grading.mjs'

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

test('decimal grading rejects unsupported input syntax and accepts signed decimal notation', () => {
  assert.deepEqual(gradeDecimalAnswer('+1.0', '1', 2), { status: 'graded', isCorrect: true })
  assert.deepEqual(gradeDecimalAnswer(' 1.000 ', '1', 2), { status: 'graded', isCorrect: true })
  for (const answer of ['1e0', '1 個', '01', '', '.5', '1.', '+', 1, null]) {
    assert.deepEqual(gradeDecimalAnswer(answer, '1', 2), { status: 'invalid', reason: 'invalid-answer-format' })
  }
})

test('decimal grading handles excessive precision and very large rounding settings', { timeout: 1000 }, () => {
  assert.deepEqual(gradeDecimalAnswer('1.' + '0'.repeat(100_000) + '1', '1', 2), { status: 'graded', isCorrect: true })
  assert.deepEqual(gradeDecimalAnswer('1.2', '1.3', Number.MAX_SAFE_INTEGER), { status: 'graded', isCorrect: false })
})
