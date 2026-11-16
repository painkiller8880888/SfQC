import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ROUTE_HISTORY_VERSION, createRouteHistoryState, navigateRouteHistory, updateRouteHistoryState, validateRouteHistoryState,
} from '../src/route-history.mjs'
import { routeToHash } from '../src/resolve-screen.mjs'

test('review navigation preserves a return path and its scroll position across lesson sections', () => {
  const practice = { kind: 'course-practice', courseId: 'descriptive-statistics' }
  const mean = { kind: 'course-lesson', courseId: 'descriptive-statistics', sectionId: 'mean' }
  const variance = { kind: 'course-lesson', courseId: 'descriptive-statistics', sectionId: 'variance' }
  const state = createRouteHistoryState(practice, routeToHash(practice), { entryId: 'practice-entry', scrollY: 240 })
  const review = navigateRouteHistory(state, mean, routeToHash(mean), 'review', { entryId: 'review-entry' })
  const changedSection = navigateRouteHistory(review, variance, routeToHash(variance), 'section', { entryId: 'variance-entry' })

  assert.equal(changedSection.returnStack.length, 1)
  assert.deepEqual(changedSection.returnStack[0], {
    routeHash: routeToHash(practice), route: practice, scrollY: 240,
  })
  const returned = navigateRouteHistory(changedSection, practice, routeToHash(practice), 'return', { entryId: 'return-entry' })
  assert.equal(returned.returnStack.length, 0)
  assert.equal(returned.routeHash, routeToHash(practice))
  assert.equal(returned.scrollY, 240)
})

test('nested review links return in order and ordinary navigation clears the stack', () => {
  const practice = { kind: 'course-practice', courseId: 'descriptive-statistics' }
  const first = { kind: 'course-lesson', courseId: 'descriptive-statistics', sectionId: 'deviation' }
  const second = { kind: 'lesson-id', lessonId: 'math-algebra-sigma', sectionId: 'sigma' }
  let state = navigateRouteHistory(
    createRouteHistoryState(practice, routeToHash(practice), { entryId: 'practice-entry' }),
    first, routeToHash(first), 'review', { entryId: 'first-review' },
  )
  state = navigateRouteHistory(state, second, routeToHash(second), 'review', { entryId: 'second-review' })
  assert.equal(state.returnStack.length, 2)
  const returnToFirst = navigateRouteHistory(state, first, routeToHash(first), 'return', { entryId: 'return-first' })
  assert.equal(returnToFirst.returnStack.length, 1)
  const returnToPractice = navigateRouteHistory(returnToFirst, practice, routeToHash(practice), 'return', { entryId: 'return-practice' })
  assert.equal(returnToPractice.returnStack.length, 0)

  const backToFirst = navigateRouteHistory(state, first, routeToHash(first), 'return')
  const normal = navigateRouteHistory(backToFirst, { kind: 'progress' }, '#/progress', 'normal')
  assert.equal(normal.returnStack.length, 0)
})

test('version 2 validates a strict route, scroll position and flat return frames', () => {
  const route = { kind: 'course-lesson', courseId: 'descriptive-statistics', sectionId: 'variance' }
  const state = createRouteHistoryState(route, routeToHash(route), { entryId: 'valid' })
  assert.equal(ROUTE_HISTORY_VERSION, 2)
  assert.equal(validateRouteHistoryState(state, state.routeHash), state)
  assert.equal(validateRouteHistoryState({ ...state, version: 1 }, state.routeHash), null)
  assert.equal(validateRouteHistoryState({ ...state, routeHash: '#/map' }, state.routeHash), null)
  assert.equal(validateRouteHistoryState({ ...state, entryId: '' }, state.routeHash), null)
  assert.equal(validateRouteHistoryState({ ...state, scrollY: -1 }, state.routeHash), null)
  assert.equal(validateRouteHistoryState({ ...state, extra: true }, state.routeHash), null)
  assert.equal(validateRouteHistoryState({ ...state, draft: 'old answer', resumeAttemptId: 'old-attempt' }, state.routeHash), null)
  assert.equal(validateRouteHistoryState({
    ...state, returnStack: [{ ...state, returnStack: [] }],
  }, state.routeHash), null)
  const sparseStack = []
  sparseStack.length = 1
  assert.equal(validateRouteHistoryState({ ...state, returnStack: sparseStack }, state.routeHash), null)

  const updated = updateRouteHistoryState(state, { scrollY: 88 })
  assert.equal(updated.entryId, state.entryId)
  assert.equal(updated.scrollY, 88)
  assert.throws(() => updateRouteHistoryState(state, { draft: 'legacy' }), TypeError)
})
