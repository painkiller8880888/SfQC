import assert from 'node:assert/strict'
import test from 'node:test'
import { applyRouteNavigationEffect, refreshRouteView, resolveRouteView } from '../src/route-view.mjs'
import { createRouteHistoryState } from '../src/route-history.mjs'
import { routeToHash } from '../src/resolve-screen.mjs'

const emptyData = { schemaVersion: 2, questionInstances: [], answerAttempts: [], reviewEvents: [] }

test('new course routes resolve without loading legacy local-data storage', () => {
  const route = { kind: 'course-lesson', courseId: 'descriptive-statistics', sectionId: 'mean' }
  const hash = routeToHash(route)
  const state = createRouteHistoryState(route, hash)
  const view = resolveRouteView(hash, state, 'initial', 0)
  assert.equal(view.route.kind, 'course-lesson')
  assert.equal(view.resolved.status, 'lesson')
  assert.equal(view.storedData.status, 'missing')
  const practiceHash = routeToHash({ kind: 'course-practice', courseId: 'descriptive-statistics' })
  assert.equal(resolveRouteView(practiceHash, null, 'initial', 1).resolved.status, 'course-practice')
})

test('a direct course deep link focuses and scrolls to its section when history state is absent', () => {
  const hash = '#/course/descriptive-statistics/lesson/variance'
  const view = resolveRouteView(hash, null, 'initial', 0)
  assert.equal(view.navigation, 'section')

  const page = { activeElement: null, scrolledTo: false }
  const sectionHeading = {
    focus(options) {
      assert.deepEqual(options, { preventScroll: true })
      page.activeElement = sectionHeading
    },
    scrollIntoView() { page.scrolledTo = true },
  }
  applyRouteNavigationEffect(view.navigation, view.historyState, {
    heading: null,
    sectionHeading,
    scrollTo() {},
  })
  assert.equal(page.activeElement, sectionHeading)
  assert.equal(page.scrolledTo, true)
})

test('refreshing migrated data keeps the scheduled first-load scroll restoration valid', () => {
  const route = { kind: 'lesson-id', lessonId: 'descriptive-statistics', sectionId: 'variance' }
  const hash = routeToHash(route)
  const historyState = createRouteHistoryState(route, hash, {
    entryId: 'initial-entry',
    scrollY: 700,
  })
  const initial = resolveRouteView(hash, historyState, 'initial', 0, {
    status: 'legacy',
    raw: JSON.stringify({ schemaVersion: 1, questionInstances: [] }),
    data: emptyData,
  })

  const refreshed = refreshRouteView(initial, { status: 'ok', raw: '{}', data: emptyData })

  assert.equal(refreshed.navigation, 'refresh')
  assert.equal(refreshed.navigationId, initial.navigationId)
  assert.equal(refreshed.historyState.entryId, initial.historyState.entryId)
  assert.equal(refreshed.historyState.scrollY, 700)
})

test('explicit return focuses the destination heading and keeps its saved scroll position', () => {
  const page = { activeElement: null, scrollY: 0 }
  let focusOptions
  const heading = {
    focus(options) {
      focusOptions = options
      page.activeElement = heading
    },
    scrollIntoView() {},
  }
  const historyState = { scrollY: 640 }

  applyRouteNavigationEffect('return', historyState, {
    heading,
    sectionHeading: null,
    scrollTo(_x, y) { page.scrollY = y },
  })

  assert.equal(page.activeElement, heading)
  assert.deepEqual(focusOptions, { preventScroll: true })
  assert.equal(page.scrollY, 640)
})
