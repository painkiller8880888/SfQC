import assert from 'node:assert/strict'
import test from 'node:test'
import { applyRouteNavigationEffect, resolveRouteView } from '../src/route-view.mjs'
import { createRouteHistoryState } from '../src/route-history.mjs'
import { routeToHash } from '../src/resolve-screen.mjs'

test('course routes resolve without reading stored snapshots', () => {
  const lesson = { kind: 'course-lesson', courseId: 'descriptive-statistics', sectionId: 'mean' }
  const hash = routeToHash(lesson)
  const state = createRouteHistoryState(lesson, hash)
  const view = resolveRouteView(hash, state, 'initial', 0)
  assert.equal(view.route.kind, 'course-lesson')
  assert.equal(view.resolved.status, 'lesson')
  assert.equal(Object.hasOwn(view, 'storedData'), false)
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

test('a v1 answer draft and resume frame are rejected and rebuilt from the URL as v2', () => {
  const route = { kind: 'course-lesson', courseId: 'descriptive-statistics', sectionId: 'variance' }
  const hash = routeToHash(route)
  const legacyState = {
    version: 1, routeHash: hash, route, entryId: 'old-entry', draft: 'old answer', scrollY: 700,
    resumeAttemptId: 'old-attempt', returnStack: [],
  }

  const repaired = resolveRouteView(hash, legacyState, 'restore', 4)
  assert.equal(repaired.stateNeedsRepair, true)
  assert.equal(repaired.historyWarning, true)
  assert.equal(repaired.navigation, 'normal')
  assert.equal(repaired.historyState.version, 2)
  assert.equal(repaired.historyState.routeHash, hash)
  assert.deepEqual(Object.keys(repaired.historyState).sort(), [
    'entryId', 'returnStack', 'route', 'routeHash', 'scrollY', 'version',
  ])
})

test('explicit return focuses the destination heading and restores its saved scroll position', () => {
  const page = { activeElement: null, scrollY: 0 }
  let focusOptions
  const heading = {
    focus(options) {
      focusOptions = options
      page.activeElement = heading
    },
    scrollIntoView() {},
  }
  applyRouteNavigationEffect('return', { scrollY: 640 }, {
    heading,
    sectionHeading: null,
    scrollTo(_x, y) { page.scrollY = y },
  })

  assert.equal(page.activeElement, heading)
  assert.deepEqual(focusOptions, { preventScroll: true })
  assert.equal(page.scrollY, 640)
})
