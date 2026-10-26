import assert from 'node:assert/strict'
import test from 'node:test'
import { applyRouteNavigationEffect, refreshRouteView, resolveRouteView } from '../src/route-view.mjs'
import { createRouteHistoryState } from '../src/route-history.mjs'
import { routeToHash } from '../src/resolve-screen.mjs'

const emptyData = { schemaVersion: 2, questionInstances: [], answerAttempts: [], reviewEvents: [] }

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
