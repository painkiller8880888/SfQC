import assert from 'node:assert/strict'
import test from 'node:test'
import { createRouteHistoryState, navigateRouteHistory, updateRouteHistoryState, validateRouteHistoryState } from '../src/route-history.mjs'
import { routeToHash } from '../src/resolve-screen.mjs'

const lesson = (lessonId, sectionId) => ({ kind: 'lesson-id', lessonId, sectionId })

test('four review visits return to the original feedback and preserve its state', () => {
  const originalRoute = { kind: 'feedback-id', attemptId: 'attempt/42' }
  let state = createRouteHistoryState(originalRoute, routeToHash(originalRoute), {
    entryId: 'feedback-entry', draft: 'saved answer', scrollY: 240,
  })
  const reviewRoutes = [
    lesson('descriptive-statistics', 'variance'),
    lesson('math-algebra-sigma', 'sigma'),
    lesson('math-powers-roots', 'powers-roots'),
    lesson('math-arithmetic', 'operations'),
  ]

  reviewRoutes.forEach((route, index) => {
    state = navigateRouteHistory(state, route, routeToHash(route), 'review', { entryId: `review-${index}` })
    assert.equal(state.returnStack.length, index + 1)
  })

  for (let index = reviewRoutes.length - 1; index >= 0; index -= 1) {
    const frame = state.returnStack.at(-1)
    state = navigateRouteHistory(state, frame.route, frame.routeHash, 'return', { entryId: `return-${index}` })
    assert.equal(state.returnStack.length, index)
  }
  assert.equal(state.routeHash, routeToHash(originalRoute))
  assert.equal(state.entryId, 'return-0')
  assert.equal(state.draft, 'saved answer')
  assert.equal(state.scrollY, 240)
  assert.equal(state.returnStack.length, 0)
})

test('section changes keep review history, normal navigation clears it, and resume uses attempt answer', () => {
  const feedback = { kind: 'feedback-id', attemptId: 'attempt-1' }
  const firstLesson = lesson('descriptive-statistics', 'variance')
  const review = navigateRouteHistory(
    createRouteHistoryState(feedback, routeToHash(feedback), { entryId: 'feedback' }),
    firstLesson, routeToHash(firstLesson), 'review', { entryId: 'review' },
  )
  const section = lesson('descriptive-statistics', 'standard-deviation')
  const changedSection = navigateRouteHistory(review, section, routeToHash(section), 'section', { entryId: 'section' })
  assert.equal(changedSection.returnStack.length, 1)

  const normalRoute = { kind: 'progress' }
  const normal = navigateRouteHistory(changedSection, normalRoute, routeToHash(normalRoute), 'normal', { entryId: 'normal' })
  assert.equal(normal.returnStack.length, 0)

  const practice = { kind: 'practice-id', instanceId: 'instance-1' }
  const resumed = navigateRouteHistory(review, practice, routeToHash(practice), 'resume', {
    entryId: 'resume', attemptId: 'attempt-1', answer: '3.14',
  })
  assert.equal(resumed.draft, '3.14')
  assert.equal(resumed.resumeAttemptId, 'attempt-1')
  assert.equal(resumed.returnStack.length, 0)
  assert.throws(() => navigateRouteHistory(review, normalRoute, routeToHash(normalRoute), 'resume', {
    attemptId: 'attempt-1', answer: '3.14',
  }), TypeError)
})

test('history state validates route, entry, draft, position and flat frames', () => {
  const route = lesson('math-algebra-sigma', 'sigma')
  const state = createRouteHistoryState(route, routeToHash(route), { entryId: 'valid' })
  assert.equal(validateRouteHistoryState(state, state.routeHash), state)
  assert.equal(validateRouteHistoryState({ ...state, version: 2 }, state.routeHash), null)
  assert.equal(validateRouteHistoryState({ ...state, routeHash: '#/map' }, state.routeHash), null)
  assert.equal(validateRouteHistoryState({ ...state, entryId: '' }, state.routeHash), null)
  assert.equal(validateRouteHistoryState({ ...state, scrollY: -1 }, state.routeHash), null)
  assert.equal(validateRouteHistoryState({ ...state, extra: true }, state.routeHash), null)
  assert.equal(validateRouteHistoryState({ ...state, returnStack: [{ ...state, returnStack: [] }] }, state.routeHash), null)
  assert.equal(validateRouteHistoryState({ ...state, returnStack: [{ ...state, routeHash: '#/map' }] }, state.routeHash), null)
  const sparseStack = []
  sparseStack.length = 1
  assert.equal(validateRouteHistoryState({ ...state, returnStack: sparseStack }, state.routeHash), null)

  const withDraft = updateRouteHistoryState(state, { draft: 'unfinished response', scrollY: 88 })
  assert.equal(withDraft.entryId, state.entryId)
  assert.equal(withDraft.draft, 'unfinished response')
  assert.equal(withDraft.scrollY, 88)
})

test('separate history entries for the same practice instance keep independent drafts', () => {
  const route = { kind: 'practice-id', instanceId: 'same-instance' }
  const hash = routeToHash(route)
  const first = updateRouteHistoryState(
    createRouteHistoryState(route, hash, { entryId: 'first-entry' }),
    { draft: 'choice-A' },
  )
  const second = navigateRouteHistory(first, route, hash, 'normal', { entryId: 'second-entry' })
  const secondDraft = updateRouteHistoryState(second, { draft: ' 1.030 ' })

  assert.equal(first.routeHash, secondDraft.routeHash)
  assert.equal(first.route.instanceId, secondDraft.route.instanceId)
  assert.notEqual(first.entryId, secondDraft.entryId)
  assert.equal(first.draft, 'choice-A')
  assert.equal(secondDraft.draft, ' 1.030 ')
  assert.equal(validateRouteHistoryState(first, hash).draft, 'choice-A')
  assert.equal(validateRouteHistoryState(secondDraft, hash).draft, ' 1.030 ')
})