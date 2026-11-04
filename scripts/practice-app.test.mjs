import assert from 'node:assert/strict'
import test from 'node:test'
import { act, createElement, StrictMode } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { exportLocalData, importLocalData, readLocalData } from '../src/local-data.mjs'
import { serializeBackup } from '../src/backup.mjs'
import { createRouteHistoryState, navigateRouteHistory } from '../src/route-history.mjs'
import { routeToHash } from '../src/resolve-screen.mjs'
import { createInitialMapState, MAP_STATE_KEY, readMapState, saveMapState } from '../src/map-state.mjs'
import { createMapPocGraph } from '../src/map-poc-graph.mjs'
import { lessonDomains } from '../src/lesson-contract.mjs'
import { lessonRegistry } from '../src/lesson-registry.mjs'

const THEME_STORAGE_KEY = 'sfqc:theme-preference'
const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)'

const globalKeys = [
  'window', 'document', 'navigator', 'Element', 'HTMLElement', 'Node', 'Event', 'MouseEvent',
  'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'IS_REACT_ACT_ENVIRONMENT',
]

class TestResizeObserver {
  constructor(callback, measureFlowNodes = false) {
    this.callback = callback
    this.measureFlowNodes = measureFlowNodes
  }

  observe(target) {
    if (!this.measureFlowNodes || !target.classList?.contains('react-flow__node')) return
    const width = target.offsetWidth
    const height = target.offsetHeight
    if (width && height) this.callback([{ target, contentRect: { width, height } }], this)
  }
  unobserve() {}
  disconnect() {}
}

function installMatchMedia(window, initialTheme = 'light', available = true) {
  let systemTheme = initialTheme
  const listeners = new Set()
  const mediaQuery = {
    media: THEME_MEDIA_QUERY,
    onchange: null,
    get matches() { return systemTheme === 'dark' },
    addEventListener(type, listener) {
      if (type === 'change') listeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'change') listeners.delete(listener)
    },
    addListener(listener) { listeners.add(listener) },
    removeListener(listener) { listeners.delete(listener) },
  }
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: available ? (query) => {
      assert.equal(query, THEME_MEDIA_QUERY)
      return mediaQuery
    } : undefined,
  })
  return {
    get listenerCount() { return listeners.size },
    async setTheme(theme) {
      systemTheme = theme
      await act(async () => {
        const event = new window.Event('change')
        Object.defineProperty(event, 'matches', { value: systemTheme === 'dark' })
        for (const listener of [...listeners]) listener(event)
        mediaQuery.onchange?.(event)
      })
    },
  }
}

async function createHarness({ strict = false, confirm = () => true, measureFlowNodes = false, systemTheme = 'light', supportsMatchMedia = true } = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://sfqc.test/SfQC/#/practice',
    pretendToBeVisual: true,
  })
  const previousGlobals = new Map(globalKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const previousMetrics = new Map(['offsetWidth', 'offsetHeight'].map((key) => [
    key, Object.getOwnPropertyDescriptor(dom.window.HTMLElement.prototype, key),
  ]))
  const media = installMatchMedia(dom.window, systemTheme, supportsMatchMedia)
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
    ResizeObserver: measureFlowNodes
      ? class extends TestResizeObserver {
        constructor(callback) {
          super(callback, true)
        }
      }
      : TestResizeObserver,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  }
  dom.window.scrollTo = () => {}
  dom.window.confirm = confirm
  dom.window.document.head.insertAdjacentHTML('beforeend', '<style>.react-flow__pane { z-index: 1 }</style>')
  for (const [key, dimension] of [['offsetWidth', 1024], ['offsetHeight', 640]]) {
    Object.defineProperty(dom.window.HTMLElement.prototype, key, {
      configurable: true,
      get() {
        const inlineSize = Number.parseFloat(this.style?.[key === 'offsetWidth' ? 'width' : 'height'] ?? '')
        return Number.isFinite(inlineSize) ? inlineSize : this.classList?.contains('react-flow') ? dimension : 0
      },
    })
  }
  const server = await createServer({
    configFile: 'vite.config.ts',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  const { default: App } = await server.ssrLoadModule('/src/App.tsx')
  const { createRoot } = await import('react-dom/client')
  const host = dom.window.document.getElementById('root')
  let root = createRoot(host)
  let mounted = false
  const renderApp = () => root.render(strict ? createElement(StrictMode, null, createElement(App)) : createElement(App))
  const mount = async () => {
    await act(async () => renderApp())
    mounted = true
  }
  const unmount = async () => {
    if (!mounted) return
    await act(async () => root.unmount())
    mounted = false
  }
  await mount()

  return {
    dom,
    host,
    setSystemTheme: media.setTheme,
    get mediaListenerCount() { return media.listenerCount },
    loadModule: (id) => server.ssrLoadModule(id),
    mount,
    unmount,
    async remountAt(hash) {
      await unmount()
      dom.window.history.replaceState(null, '', dom.window.location.pathname + hash)
      root = createRoot(host)
      await mount()
    },
    async remount() {
      await unmount()
      root = createRoot(host)
      await mount()
    },
    async close() {
      await unmount()
      await server.close()
      dom.window.close()
      for (const key of globalKeys) {
        const descriptor = previousGlobals.get(key)
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete globalThis[key]
      }
      for (const [key, descriptor] of previousMetrics) {
        if (descriptor) Object.defineProperty(dom.window.HTMLElement.prototype, key, descriptor)
        else delete dom.window.HTMLElement.prototype[key]
      }
    },
  }
}

function buttonFor(host, text) {
  return [...host.querySelectorAll('button')].find((button) => button.textContent.includes(text))
}

function linkFor(host, text) {
  return [...host.querySelectorAll('a')].find((anchor) => anchor.textContent.includes(text))
}

function assertProgressReviewEvidence(host, attemptId, instanceId) {
  const progress = host.querySelector('.progress-view')
  assert.ok(progress, 'expected the progress view to render')

  const candidate = progress.querySelector('[aria-label="基本統計量の誤答候補"]')
  assert.ok(candidate, 'expected the saved variance mistake to appear as a review candidate')
  assert.match(candidate.textContent, /この節を指定した誤答：1回/u)
  assert.match(candidate.textContent, /復習先への総訪問：1回/u)
  assert.match(candidate.textContent, /代表誤答からの訪問：1回/u)
  assert.equal(linkFor(candidate, '基本統計量：範囲と分散')?.getAttribute('href'),
    '#/lesson/descriptive-statistics/variance')
  assert.equal(linkFor(candidate, '誤答と復習先を見る')?.getAttribute('href'),
    routeToHash({ kind: 'feedback-id', attemptId }))
  assert.equal(linkFor(candidate, '同じ出題へ戻る')?.getAttribute('href'),
    routeToHash({ kind: 'practice-id', instanceId }))

  const visits = progress.querySelector('[aria-label="基本統計量への復習訪問"]')
  assert.ok(visits, 'expected the recorded variance visit to appear')
  assert.match(visits.textContent, /総訪問：1回/u)
  assert.equal(linkFor(visits, '基本統計量：範囲と分散')?.getAttribute('href'),
    '#/lesson/descriptive-statistics/variance')
}

function linkForRoute(host, route) {
  return [...host.querySelectorAll('a')].find((anchor) => anchor.getAttribute('href') === routeToHash(route))
}

function questionOption(host, questionId) {
  return [...host.querySelectorAll('.practice-question-list > li')]
    .find((item) => item.textContent.includes(questionId))
}

async function click(element) {
  assert.ok(element, 'expected an interactive element')
  await act(async () => element.click())
}

async function changeControl(window, control, value) {
  await act(async () => {
    const prototype = control instanceof window.HTMLSelectElement
      ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(control, value)
    control.dispatchEvent(new window.Event('input', { bubbles: true }))
    control.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
}

async function changeTextInput(window, input, value) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, value)
    input.dispatchEvent(new window.InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }))
    input.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
}

async function waitForHistory(window, method) {
  await act(async () => {
    window.history[method]()
    await new Promise((resolve) => window.setTimeout(resolve, 20))
  })
}

async function settleEffects(window) {
  await act(async () => new Promise((resolve) => window.setTimeout(resolve, 30)))
}

async function pressKey(window, target, key) {
  let event
  await act(async () => {
    event = new window.KeyboardEvent('keydown', {
      key,
      code: key === ' ' ? 'Space' : key,
      bubbles: true,
      cancelable: true,
    })
    target.dispatchEvent(event)
    await new Promise((resolve) => window.requestAnimationFrame(resolve))
  })
  return event
}

async function dispatchReactFlowMouseEvent(window, target, type, x, y, buttons) {
  await act(async () => {
    target.dispatchEvent(new window.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons,
      clientX: x,
      clientY: y,
    }))
    await new Promise((resolve) => window.requestAnimationFrame(resolve))
  })
}

function renderedPosition(node) {
  const match = node.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/u)
  assert.ok(match, `expected node position transform, got: ${node.style.transform}`)
  return { x: Number(match[1]), y: Number(match[2]) }
}

function savedMap(window) {
  return readMapState(lessonRegistry, () => window.localStorage).state
}

test('theme follows the system, saves manual choices, and stays separate from learning data', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    const themeSelect = () => app.host.querySelector('#theme-preference')
    const theme = () => app.host.querySelector('.app-shell').dataset.theme
    const localDataBefore = window.localStorage.getItem('sfqc:local-data')
    const mapStateBefore = window.localStorage.getItem(MAP_STATE_KEY)
    assert.equal(themeSelect().value, 'system')
    assert.equal(theme(), 'light')
    assert.equal(app.mediaListenerCount, 1)
    await click(linkFor(app.host, '学習マップ'))
    await settleEffects(window)
    const routeBefore = window.location.hash
    assert.ok(app.host.querySelector('.react-flow').classList.contains('light'))

    await app.setSystemTheme('dark')
    assert.equal(theme(), 'dark')
    assert.ok(app.host.querySelector('.react-flow').classList.contains('dark'))
    await changeControl(window, themeSelect(), 'light')
    assert.equal(theme(), 'light')
    assert.ok(app.host.querySelector('.react-flow').classList.contains('light'))
    assert.equal(app.mediaListenerCount, 0)
    assert.equal(window.localStorage.getItem(THEME_STORAGE_KEY), 'light')
    await app.setSystemTheme('dark')
    assert.equal(theme(), 'light')
    await app.remount()
    assert.equal(themeSelect().value, 'light')
    assert.equal(theme(), 'light')
    assert.equal(app.mediaListenerCount, 0)

    await changeControl(window, themeSelect(), 'dark')
    assert.equal(theme(), 'dark')
    assert.ok(app.host.querySelector('.react-flow').classList.contains('dark'))
    assert.equal(window.localStorage.getItem(THEME_STORAGE_KEY), 'dark')
    await app.setSystemTheme('light')
    assert.equal(theme(), 'dark')
    await app.remount()
    assert.equal(themeSelect().value, 'dark')
    assert.equal(theme(), 'dark')

    await app.setSystemTheme('light')
    await changeControl(window, themeSelect(), 'system')
    assert.equal(themeSelect().value, 'system')
    assert.equal(window.localStorage.getItem(THEME_STORAGE_KEY), null)
    assert.equal(theme(), 'light')
    assert.ok(app.host.querySelector('.react-flow').classList.contains('light'))
    assert.equal(app.mediaListenerCount, 1)
    await app.setSystemTheme('dark')
    assert.equal(theme(), 'dark')
    assert.ok(app.host.querySelector('.react-flow').classList.contains('dark'))
    await app.remount()
    assert.equal(themeSelect().value, 'system')
    assert.equal(theme(), 'dark')
    assert.equal(window.location.hash, routeBefore)
    assert.equal(window.localStorage.getItem('sfqc:local-data'), localDataBefore)
    assert.equal(window.localStorage.getItem(MAP_STATE_KEY), mapStateBefore)

    await app.unmount()
    assert.equal(app.mediaListenerCount, 0)
  } finally {
    await app.close()
  }
})

test('invalid or unreadable theme preferences fall back to system mode', async () => {
  const app = await createHarness({ systemTheme: 'dark' })
  const { window } = app.dom
  const storage = window.localStorage
  const storagePrototype = Object.getPrototypeOf(storage)
  const originalGet = Object.getOwnPropertyDescriptor(storagePrototype, 'getItem')
  try {
    const themeSelect = () => app.host.querySelector('#theme-preference')
    storage.setItem(THEME_STORAGE_KEY, 'sepia')
    await app.remount()
    assert.equal(themeSelect().value, 'system')
    assert.equal(app.host.querySelector('.app-shell').dataset.theme, 'dark')

    Object.defineProperty(storagePrototype, 'getItem', {
      configurable: true,
      writable: true,
      value(key) {
        if (key === THEME_STORAGE_KEY) throw new window.DOMException('storage unavailable', 'SecurityError')
        return originalGet.value.call(this, key)
      },
    })
    await app.remount()
    assert.equal(themeSelect().value, 'system')
    assert.equal(app.host.querySelector('.app-shell').dataset.theme, 'dark')
  } finally {
    if (originalGet) Object.defineProperty(storagePrototype, 'getItem', originalGet)
    else delete storagePrototype.getItem
    await app.close()
  }
})

test('theme stays usable when storage writes fail or matchMedia is unavailable', async () => {
  const app = await createHarness()
  const { window } = app.dom
  const storage = window.localStorage
  const storagePrototype = Object.getPrototypeOf(storage)
  const originalSet = Object.getOwnPropertyDescriptor(storagePrototype, 'setItem')
  const originalRemove = Object.getOwnPropertyDescriptor(storagePrototype, 'removeItem')
  const localDataBefore = storage.getItem('sfqc:local-data')
  const mapStateBefore = storage.getItem(MAP_STATE_KEY)
  try {
    Object.defineProperty(storagePrototype, 'setItem', {
      configurable: true,
      writable: true,
      value(key, value) {
        if (key === THEME_STORAGE_KEY) throw new window.DOMException('storage unavailable', 'SecurityError')
        return originalSet.value.call(this, key, value)
      },
    })
    const themeSelect = () => app.host.querySelector('#theme-preference')
    await changeControl(window, themeSelect(), 'dark')
    assert.equal(themeSelect().value, 'dark')
    assert.equal(app.host.querySelector('.app-shell').dataset.theme, 'dark')
    assert.equal(storage.getItem(THEME_STORAGE_KEY), null)

    Object.defineProperty(storagePrototype, 'setItem', originalSet)
    storage.setItem(THEME_STORAGE_KEY, 'dark')
    await app.remount()
    Object.defineProperty(storagePrototype, 'removeItem', {
      configurable: true,
      writable: true,
      value(key) {
        if (key === THEME_STORAGE_KEY) throw new window.DOMException('storage unavailable', 'SecurityError')
        return originalRemove.value.call(this, key)
      },
    })
    await app.setSystemTheme('light')
    await changeControl(window, themeSelect(), 'system')
    assert.equal(themeSelect().value, 'system')
    assert.equal(app.host.querySelector('.app-shell').dataset.theme, 'light')
    assert.equal(storage.getItem(THEME_STORAGE_KEY), 'dark')
    assert.equal(storage.getItem('sfqc:local-data'), localDataBefore)
    assert.equal(storage.getItem(MAP_STATE_KEY), mapStateBefore)
  } finally {
    if (originalSet) Object.defineProperty(storagePrototype, 'setItem', originalSet)
    else delete storagePrototype.setItem
    if (originalRemove) Object.defineProperty(storagePrototype, 'removeItem', originalRemove)
    else delete storagePrototype.removeItem
    await app.close()
  }

  const fallbackApp = await createHarness({ systemTheme: 'dark', supportsMatchMedia: false })
  try {
    assert.equal(fallbackApp.host.querySelector('#theme-preference').value, 'system')
    assert.equal(fallbackApp.host.querySelector('.app-shell').dataset.theme, 'light')
    assert.equal(fallbackApp.mediaListenerCount, 0)
  } finally {
    await fallbackApp.close()
  }
})

test('fixed practice saves drafts per history entry, preserves attempts, and retries a saved result navigation', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    assert.equal(app.host.querySelector('a[href="#/feedback"]'), null)

    const originalPushState = window.history.pushState.bind(window.history)
    let failNextPracticeNavigation = true
    let failNextFeedbackNavigation = false
    window.history.pushState = (state, title, url) => {
      const hash = new URL(url, window.location.href).hash
      if (failNextPracticeNavigation && hash.startsWith('#/practice/')) {
        failNextPracticeNavigation = false
        throw new window.DOMException('history unavailable', 'SecurityError')
      }
      if (failNextFeedbackNavigation && hash.startsWith('#/feedback/')) {
        failNextFeedbackNavigation = false
        throw new window.DOMException('history unavailable', 'SecurityError')
      }
      originalPushState(state, title, url)
    }

    const choiceOption = questionOption(app.host, 'q-desc-var-sc-001')
    await click(buttonFor(choiceOption, 'この問題を始める'))
    let data = readLocalData().data
    assert.equal(data.questionInstances.length, 1)
    assert.equal(window.location.hash, '#/practice')
    assert.match(app.host.textContent, /出題snapshotは保存済み/u)
    await click(buttonFor(app.host, '保存済みの画面を開く'))

    const instance = readLocalData().data.questionInstances[0]
    const snapshotBefore = JSON.stringify(instance)
    const route = { kind: 'practice-id', instanceId: instance.instanceId }
    const routeHash = routeToHash(route)
    assert.equal(window.location.hash, routeHash)
    assert.equal(readLocalData().data.questionInstances.length, 1)
    assert.equal(app.host.querySelector('a[href="#/feedback"]'), null)

    await click(buttonFor(app.host, '回答を送信する'))
    assert.match(app.host.textContent, /選択肢を1つ選んでください/u)
    assert.equal(readLocalData().data.answerAttempts.length, 0)
    const radioB = [...app.host.querySelectorAll('input[type="radio"]')].find((input) => input.value === 'B')
    await click(radioB)
    assert.equal(app.host.querySelector('.practice-error'), null)
    const firstEntry = window.history.state
    assert.equal(firstEntry.draft, 'B')

    const secondEntry = navigateRouteHistory(firstEntry, route, routeHash, 'normal', { entryId: 'second-practice-entry' })
    originalPushState(secondEntry, '', window.location.pathname + routeHash)
    await act(async () => window.dispatchEvent(new window.PopStateEvent('popstate')))
    assert.equal(window.history.state.entryId, 'second-practice-entry')
    assert.equal([...app.host.querySelectorAll('input[type="radio"]')].some((input) => input.checked), false)

    const radioA = [...app.host.querySelectorAll('input[type="radio"]')].find((input) => input.value === 'A')
    await click(radioA)
    assert.equal(window.history.state.draft, 'A')
    await waitForHistory(window, 'back')
    assert.equal(window.history.state.entryId, firstEntry.entryId)
    assert.equal([...app.host.querySelectorAll('input[type="radio"]')].find((input) => input.value === 'B').checked, true)
    await waitForHistory(window, 'forward')
    assert.equal(window.history.state.entryId, 'second-practice-entry')
    assert.equal([...app.host.querySelectorAll('input[type="radio"]')].find((input) => input.value === 'A').checked, true)

    failNextFeedbackNavigation = true
    const form = app.host.querySelector('form')
    await act(async () => {
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    })
    data = readLocalData().data
    assert.equal(data.answerAttempts.length, 1)
    const firstAttempt = data.answerAttempts[0]
    assert.equal(firstAttempt.instanceId, instance.instanceId)
    assert.equal(firstAttempt.answer, 'A')
    assert.equal(window.location.hash, routeHash)
    assert.match(app.host.textContent, /回答は保存済みですが/u)
    await click(buttonFor(app.host, '保存済みの画面を開く'))
    assert.equal(window.location.hash, routeToHash({ kind: 'feedback-id', attemptId: firstAttempt.attemptId }))
    assert.equal(readLocalData().data.answerAttempts.length, 1)
    assert.match(app.host.textContent, /mmは偏差の単位です。分散では偏差を二乗します。/u)

    await click(linkFor(app.host, '同じ出題を再開する'))
    assert.equal(window.location.hash, routeHash)
    assert.equal([...app.host.querySelectorAll('input[type="radio"]')].find((input) => input.value === 'A').checked, true)
    const retryAnswer = [...app.host.querySelectorAll('input[type="radio"]')].find((input) => input.value === 'B')
    await click(retryAnswer)
    await click(buttonFor(app.host, '回答を送信する'))

    const attempts = readLocalData().data.answerAttempts
    assert.equal(attempts.length, 2)
    assert.notEqual(attempts[0].attemptId, attempts[1].attemptId)
    assert.equal(attempts[0].answer, 'A')
    assert.equal(attempts[1].answer, 'B')
    assert.ok(attempts.every((attempt) => attempt.instanceId === instance.instanceId))
    assert.equal(JSON.stringify(readLocalData().data.questionInstances[0]), snapshotBefore)

    await app.remountAt(routeHash)
    assert.match(app.host.textContent, /分散s²の単位/u)
    assert.equal(readLocalData().data.answerAttempts.length, 2)
    assert.equal(readLocalData().data.questionInstances.length, 1)
  } finally {
    await app.close()
  }
})

test('generated practice creates a separate seed and records the numeric input exactly', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    const generatedId = 'q-desc-var-gen-num-001'
    const option = questionOption(app.host, generatedId)
    await click(buttonFor(option, 'この問題を始める'))
    const first = readLocalData().data.questionInstances[0]
    assert.equal(first.kind, 'generated')

    await click(buttonFor(app.host, '別の類題を解く'))
    const similar = readLocalData().data.questionInstances[1]
    assert.equal(similar.kind, 'generated')
    assert.notEqual(similar.instanceId, first.instanceId)
    assert.notEqual(similar.seed, first.seed)
    assert.equal(JSON.stringify(readLocalData().data.questionInstances[0]), JSON.stringify(first))

    const input = app.host.querySelector('input[type="text"]')
    assert.ok(input)
    assert.match(app.host.textContent, /単位：mm²/u)
    await changeTextInput(window, input, '')
    await click(buttonFor(app.host, '回答を送信する'))
    assert.match(app.host.textContent, /数値を入力してください/u)
    assert.equal(readLocalData().data.answerAttempts.length, 0)

    const exactAnswer = similar.questionDefinitionSnapshot.content.correctAnswer
    await changeTextInput(window, app.host.querySelector('input[type="text"]'), ' ' + exactAnswer + ' ')
    assert.equal(window.history.state.draft, ' ' + exactAnswer + ' ')
    assert.equal(app.host.querySelector('.practice-error'), null)
    await click(buttonFor(app.host, '回答を送信する'))
    const attempt = readLocalData().data.answerAttempts[0]
    assert.equal(attempt.instanceId, similar.instanceId)
    assert.equal(attempt.answer, ' ' + exactAnswer + ' ')
    assert.equal(attempt.gradingResult.isCorrect, true)
    assert.equal(readLocalData().data.questionInstances.length, 2)
  } finally {
    await app.close()
  }
})

test('practice recovery clears after leaving its history entry and submitting again after browser back', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    const originalPushState = window.history.pushState.bind(window.history)
    let failNextFeedbackNavigation = true
    window.history.pushState = (state, title, url) => {
      const hash = new URL(url, window.location.href).hash
      if (failNextFeedbackNavigation && hash.startsWith('#/feedback/')) {
        failNextFeedbackNavigation = false
        throw new window.DOMException('history unavailable', 'SecurityError')
      }
      originalPushState(state, title, url)
    }

    const option = questionOption(app.host, 'q-desc-var-sc-001')
    await click(buttonFor(option, 'この問題を始める'))
    const instance = readLocalData().data.questionInstances[0]
    const practiceHash = routeToHash({ kind: 'practice-id', instanceId: instance.instanceId })
    assert.equal(window.location.hash, practiceHash)

    const radioA = [...app.host.querySelectorAll('input[type="radio"]')].find((input) => input.value === 'A')
    await click(radioA)
    await click(buttonFor(app.host, '回答を送信する'))
    assert.equal(readLocalData().data.answerAttempts.length, 1)
    assert.match(app.host.textContent, /回答は保存済みですが/u)
    assert.equal(window.location.hash, practiceHash)

    await click(app.host.querySelector('.site-brand'))
    assert.equal(window.location.hash, '#/map')
    await waitForHistory(window, 'back')
    assert.equal(window.location.hash, practiceHash)
    assert.equal(app.host.querySelector('.practice-recovery'), null)

    const submit = buttonFor(app.host, '回答を送信する')
    assert.ok(submit)
    assert.equal(submit.disabled, false)
    const radioB = [...app.host.querySelectorAll('input[type="radio"]')].find((input) => input.value === 'B')
    await click(radioB)
    await click(submit)

    const attempts = readLocalData().data.answerAttempts
    assert.equal(attempts.length, 2)
    assert.equal(attempts[1].answer, 'B')
    assert.equal(window.location.hash, routeToHash({ kind: 'feedback-id', attemptId: attempts[1].attemptId }))
    assert.equal(app.host.querySelector('.practice-recovery'), null)
  } finally {
    await app.close()
  }
})

test('wrong feedback logs review links, keeps their origin through nested lessons, and resumes the same attempt', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    const instanceLink = questionOption(app.host, 'q-desc-var-num-001')
    await click(buttonFor(instanceLink, 'この問題を始める'))
    const instance = readLocalData().data.questionInstances[0]
    const snapshot = JSON.stringify(instance)
    await changeTextInput(window, app.host.querySelector('input[type="text"]'), '1.030')
    await click(buttonFor(app.host, '回答を送信する'))
    const attemptA = readLocalData().data.answerAttempts[0]
    assert.equal(attemptA.answer, '1.030')
    assert.equal(attemptA.gradingResult.isCorrect, false)
    assert.match(app.host.textContent, /何を記述または推定するのかを確認し、分母と丸めの位置を見直します。/u)

    await click(linkFor(app.host, '同じ出題を再開する'))
    assert.equal(app.host.querySelector('input[type="text"]').value, '1.030')
    await changeTextInput(window, app.host.querySelector('input[type="text"]'), '1.040')
    await click(buttonFor(app.host, '回答を送信する'))
    const attemptB = readLocalData().data.answerAttempts[1]
    assert.equal(attemptB.answer, '1.040')
    assert.notEqual(attemptA.attemptId, attemptB.attemptId)

    await waitForHistory(window, 'back')
    await waitForHistory(window, 'back')
    assert.equal(window.location.hash, routeToHash({ kind: 'feedback-id', attemptId: attemptA.attemptId }))
    assert.match(app.host.textContent, /あなたの回答：1\.030/u)

    const order = []
    const storage = window.Storage.prototype
    const writeStorage = storage.setItem
    let firstEventWrite = true
    Object.defineProperty(storage, 'setItem', {
      configurable: true,
      value(key, value) {
        order.push('setItem')
        if (firstEventWrite) {
          firstEventWrite = false
          assert.ok(app.host.querySelector('#feedback-title'), 'route stays on feedback until the event is saved')
        }
        return writeStorage.call(this, key, value)
      },
    })
    const replaceState = window.history.replaceState.bind(window.history)
    window.history.replaceState = (...args) => {
      order.push('replaceState')
      return replaceState(...args)
    }
    const pushState = window.history.pushState.bind(window.history)
    window.history.pushState = (...args) => {
      order.push('pushState')
      return pushState(...args)
    }
    const scrolledHeadings = []
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value() { scrolledHeadings.push(this.id) },
    })

    const variance = { kind: 'lesson-id', lessonId: 'descriptive-statistics', sectionId: 'variance' }
    await click(linkForRoute(app.host, variance))
    await settleEffects(window)
    assert.deepEqual(order.slice(0, 3), ['replaceState', 'pushState', 'setItem'])
    assert.equal(window.location.hash, routeToHash(variance))
    assert.equal(window.document.activeElement.id, 'route-lesson-title')
    assert.deepEqual(scrolledHeadings, ['route-lesson-title'])
    let data = readLocalData().data
    assert.equal(data.reviewEvents.length, 1)
    assert.equal(data.reviewEvents[0].targetRef, 'descriptive-statistics#variance')
    assert.equal(data.reviewEvents[0].sourceAttemptId, attemptA.attemptId)

    const mean = { kind: 'lesson-id', lessonId: 'descriptive-statistics', sectionId: 'mean' }
    await click(linkForRoute(app.host, mean))
    assert.equal(readLocalData().data.reviewEvents.length, 1)
    await click(linkForRoute(app.host, variance))
    await waitForHistory(window, 'back')
    await waitForHistory(window, 'forward')
    assert.equal(readLocalData().data.reviewEvents.length, 1)

    const sigma = { kind: 'lesson-id', lessonId: 'math-algebra-sigma', sectionId: 'sigma' }
    const powers = { kind: 'lesson-id', lessonId: 'math-powers-roots', sectionId: null }
    const arithmetic = { kind: 'lesson-id', lessonId: 'math-arithmetic', sectionId: null }
    await click(linkForRoute(app.host, sigma))
    await click(linkFor(app.host, '1段戻る'))
    await click(linkForRoute(app.host, sigma))
    await click(linkForRoute(app.host, powers))
    await click(linkForRoute(app.host, arithmetic))
    data = readLocalData().data
    assert.deepEqual(data.reviewEvents.map((event) => event.targetRef), [
      'descriptive-statistics#variance',
      'math-algebra-sigma#sigma',
      'math-algebra-sigma#sigma',
      'math-powers-roots',
      'math-arithmetic',
    ])
    assert.ok(data.reviewEvents.every((event) => event.sourceAttemptId === attemptA.attemptId))

    await waitForHistory(window, 'back')
    await waitForHistory(window, 'forward')
    assert.equal(readLocalData().data.reviewEvents.length, 5)
    const scrollToCalls = []
    window.scrollTo = (x, y) => scrollToCalls.push([x, y])
    window.history.replaceState({ ...window.history.state, scrollY: 321 }, '', window.location.href)
    await app.remount()
    await settleEffects(window)
    assert.match(app.host.textContent, /四則計算と単位/u)
    assert.deepEqual(scrollToCalls, [[0, 321]])
    assert.equal(readLocalData().data.reviewEvents.length, 5)

    for (const route of [powers, sigma, variance, { kind: 'feedback-id', attemptId: attemptA.attemptId }]) {
      await click(linkFor(app.host, '1段戻る'))
      assert.equal(window.location.hash, routeToHash(route))
      assert.equal(readLocalData().data.reviewEvents.length, 5)
    }
    assert.match(app.host.textContent, /あなたの回答：1\.030/u)
    await click(linkFor(app.host, '同じ出題を再開する'))
    const resumedInput = app.host.querySelector('input[type="text"]')
    assert.equal(resumedInput.value, '1.030')
    await changeTextInput(window, resumedInput, '1.050')
    await click(buttonFor(app.host, '回答を送信する'))

    let attempts = readLocalData().data.answerAttempts
    assert.equal(attempts.length, 3)
    assert.deepEqual(attempts.slice(0, 2), [attemptA, attemptB])
    assert.equal(attempts[2].answer, '1.050')
    assert.ok(attempts.every((attempt) => attempt.instanceId === instance.instanceId))
    assert.equal(JSON.stringify(readLocalData().data.questionInstances[0]), snapshot)

    const feedbackB = { kind: 'feedback-id', attemptId: attemptB.attemptId }
    const feedbackBHash = routeToHash(feedbackB)
    window.history.pushState(
      createRouteHistoryState(feedbackB, feedbackBHash, { entryId: 'old-feedback-b' }),
      '',
      window.location.pathname + feedbackBHash,
    )
    await act(async () => window.dispatchEvent(new window.PopStateEvent('popstate')))
    assert.match(app.host.textContent, /あなたの回答：1\.040/u)
    await click(linkForRoute(app.host, variance))
    attempts = readLocalData().data.answerAttempts
    assert.equal(readLocalData().data.reviewEvents.at(-1).sourceAttemptId, attemptB.attemptId)
    assert.deepEqual(attempts.slice(0, 2), [attemptA, attemptB])
    assert.equal(JSON.stringify(readLocalData().data.questionInstances[0]), snapshot)
  } finally {
    await app.close()
  }
})

test('P2 learning journey keeps the same question through review, progress, and JSON restore', async () => {
  let app = await createHarness()
  try {
    const { window } = app.dom
    const variance = { kind: 'lesson-id', lessonId: 'descriptive-statistics', sectionId: 'variance' }
    await click(linkFor(app.host, '学習マップ'))
    await click(buttonFor(app.host, '教材一覧'))
    await click(linkForRoute(app.host, variance))
    assert.ok(app.host.querySelector('.variance-figure svg[role="img"]'))
    assert.match(app.host.querySelector('.variance-figure').textContent, /偏差平方和/u)

    await click(linkFor(app.host, '利用できる演習問題を選ぶ'))
    await click(buttonFor(questionOption(app.host, 'q-desc-var-num-001'), 'この問題を始める'))
    const instance = readLocalData().data.questionInstances[0]
    const snapshot = JSON.stringify(instance)
    await changeTextInput(window, app.host.querySelector('input[type="text"]'), '1.030')
    await click(buttonFor(app.host, '回答を送信する'))
    const incorrect = readLocalData().data.answerAttempts[0]
    assert.equal(incorrect.answer, '1.030')
    assert.equal(incorrect.gradingResult.isCorrect, false)

    const sigma = { kind: 'lesson-id', lessonId: 'math-algebra-sigma', sectionId: 'sigma' }
    const powers = { kind: 'lesson-id', lessonId: 'math-powers-roots', sectionId: null }
    const arithmetic = { kind: 'lesson-id', lessonId: 'math-arithmetic', sectionId: null }
    await click(linkForRoute(app.host, variance))
    await click(linkForRoute(app.host, sigma))
    await click(linkForRoute(app.host, powers))
    await click(linkForRoute(app.host, arithmetic))
    assert.deepEqual(readLocalData().data.reviewEvents.map((event) => event.targetRef), [
      'descriptive-statistics#variance', 'math-algebra-sigma#sigma', 'math-powers-roots', 'math-arithmetic',
    ])
    assert.ok(readLocalData().data.reviewEvents.every((event) => event.sourceAttemptId === incorrect.attemptId))

    for (const route of [powers, sigma, variance, { kind: 'feedback-id', attemptId: incorrect.attemptId }]) {
      await click(linkFor(app.host, '1段戻る'))
      assert.equal(window.location.hash, routeToHash(route))
    }
    await click(linkFor(app.host, '同じ出題を再開する'))
    assert.equal(window.location.hash, routeToHash({ kind: 'practice-id', instanceId: instance.instanceId }))
    const input = app.host.querySelector('input[type="text"]')
    assert.equal(input.value, '1.030')
    await changeTextInput(window, input, '1.013')
    await click(buttonFor(app.host, '回答を送信する'))
    const data = readLocalData().data
    const correct = data.answerAttempts[1]
    assert.equal(correct.answer, '1.013')
    assert.equal(correct.gradingResult.isCorrect, true)
    assert.notEqual(correct.attemptId, incorrect.attemptId)
    assert.ok(data.answerAttempts.every((attempt) => attempt.instanceId === instance.instanceId))
    assert.equal(JSON.stringify(data.questionInstances[0]), snapshot)
    assert.match(app.host.textContent, /正解です。/u)

    await click(linkFor(app.host, '進捗'))
    assert.match(app.host.querySelector('.progress-view').textContent, /回答試行：2回（正答 1回・誤答 1回）/u)
    assert.match(app.host.querySelector('.progress-view').textContent, /正答割合：1 \/ 2回（50\.0%）/u)
    assertProgressReviewEvidence(app.host, incorrect.attemptId, instance.instanceId)
    const exported = exportLocalData(() => window.localStorage)
    const expected = JSON.parse(exported)

    const originalApp = app
    app = null
    await originalApp.close()
    app = await createHarness()
    assert.equal(readLocalData().status, 'missing')
    const imported = await importLocalData(
      { size: Buffer.byteLength(exported), text: async () => exported },
      () => assert.fail('a missing destination must not ask to replace data'),
      () => app.dom.window.localStorage,
    )
    assert.equal(imported.status, 'imported')
    assert.deepEqual(imported.data, expected)
    await app.remountAt('#/progress')
    const progressText = app.host.querySelector('.progress-view').textContent
    assert.match(progressText, /回答試行：2回（正答 1回・誤答 1回）/u)
    assert.match(progressText, /正答割合：1 \/ 2回（50\.0%）/u)
    assertProgressReviewEvidence(app.host, incorrect.attemptId, instance.instanceId)
    assert.deepEqual(JSON.parse(exportLocalData(() => app.dom.window.localStorage)), expected)
    await app.remount()
    assert.equal(app.dom.window.location.hash, '#/progress')
    assert.match(app.host.querySelector('.progress-view').textContent, /回答試行：2回（正答 1回・誤答 1回）/u)
    assertProgressReviewEvidence(app.host, incorrect.attemptId, instance.instanceId)
    assert.deepEqual(JSON.parse(exportLocalData(() => app.dom.window.localStorage)), expected)
  } finally {
    await app?.close()
  }
})

test('review event storage failure keeps the lesson navigation, announces the failure, and still focuses and scrolls', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    await click(buttonFor(questionOption(app.host, 'q-desc-var-num-001'), 'この問題を始める'))
    await changeTextInput(window, app.host.querySelector('input[type="text"]'), '1.030')
    await click(buttonFor(app.host, '回答を送信する'))
    const attempt = readLocalData().data.answerAttempts[0]
    const target = { kind: 'lesson-id', lessonId: 'descriptive-statistics', sectionId: 'variance' }
    const savedRaw = window.localStorage.getItem('sfqc:local-data')

    const pushState = window.history.pushState.bind(window.history)
    window.history.pushState = (state, title, url) => {
      if (new URL(url, window.location.href).hash === routeToHash(target)) {
        throw new window.DOMException('history unavailable', 'SecurityError')
      }
      pushState(state, title, url)
    }
    await click(linkForRoute(app.host, target))
    assert.equal(window.location.hash, routeToHash({ kind: 'feedback-id', attemptId: attempt.attemptId }))
    assert.equal(window.localStorage.getItem('sfqc:local-data'), savedRaw)
    assert.equal(readLocalData().data.reviewEvents.length, 0)

    window.history.pushState = pushState
    Object.defineProperty(window.Storage.prototype, 'setItem', {
      configurable: true,
      value() { throw new window.DOMException('quota exceeded', 'QuotaExceededError') },
    })
    let scrollCount = 0
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value() { scrollCount += 1 },
    })
    await click(linkForRoute(app.host, target))
    await settleEffects(window)

    assert.equal(window.location.hash, routeToHash(target))
    assert.match(app.host.textContent, /復習先には移動しましたが、誤答からの復習訪問を保存できませんでした/u)
    assert.equal(app.host.querySelector('[role="status"]').textContent,
      '復習先には移動しましたが、誤答からの復習訪問を保存できませんでした。保存データを確認してください。')
    assert.equal(readLocalData().data.reviewEvents.length, 0)
    assert.equal(window.localStorage.getItem('sfqc:local-data'), savedRaw)
    assert.equal(window.document.activeElement.id, 'route-lesson-title')
    assert.equal(scrollCount, 1)
  } finally {
    await app.close()
  }
})

test('map and progress show derived observations, and progress links use normal navigation without logging a visit', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    await click(buttonFor(questionOption(app.host, 'q-desc-var-num-001'), 'この問題を始める'))
    await changeTextInput(window, app.host.querySelector('input[type="text"]'), '1.030')
    await click(buttonFor(app.host, '回答を送信する'))
    const attempt = readLocalData().data.answerAttempts[0]
    assert.equal(attempt.gradingResult.isCorrect, false)
    assert.equal(attempt.gradingResult.feedback.lessonRef, 'descriptive-statistics#variance')

    await click(linkFor(app.host, '学習マップ'))
    await click(buttonFor(app.host, '教材一覧'))
    const descriptiveCard = [...app.host.querySelectorAll('.lesson-card')]
      .find((card) => card.querySelector('h3').textContent.includes('基本統計量'))
    assert.match(descriptiveCard.textContent, /状態：回答記録あり/u)
    assert.match(descriptiveCard.textContent, /回答試行：1回/u)
    assert.match(descriptiveCard.textContent, /復習候補：あり/u)
    assert.doesNotMatch(descriptiveCard.textContent, /正答割合|最終回答|訪問：/u)

    await click(linkFor(app.host, '進捗'))
    assert.equal(window.location.hash, '#/progress')
    const feedbackLink = linkFor(app.host, '誤答と復習先を見る')
    assert.equal(feedbackLink.dataset.navIntent, 'normal')
    await click(feedbackLink)
    assert.equal(window.location.hash, routeToHash({ kind: 'feedback-id', attemptId: attempt.attemptId }))
    assert.deepEqual(window.history.state.returnStack, [])
    assert.equal(readLocalData().data.reviewEvents.length, 0)

    await click(linkFor(app.host, '進捗'))
    const practiceLink = linkFor(app.host, '同じ出題へ戻る')
    assert.equal(practiceLink.dataset.navIntent, 'normal')
    await click(practiceLink)
    assert.equal(window.location.hash, routeToHash({ kind: 'practice-id', instanceId: attempt.instanceId }))
    assert.deepEqual(window.history.state.returnStack, [])
    assert.equal(window.history.state.resumeAttemptId, null)
    assert.equal(app.host.querySelector('input[type="text"]').value, '')
    assert.equal(readLocalData().data.reviewEvents.length, 0)
  } finally {
    await app.close()
  }
})

test('integrated learning map switches views and restores graph selection and viewport across navigation', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    await click(linkFor(app.host, '学習マップ'))

    assert.equal(app.host.querySelectorAll('.react-flow__node').length, 34)
    assert.ok(app.host.querySelector('#page-title'))

    const lessonNode = [...app.host.querySelectorAll('.react-flow__node')]
      .find((node) => node.textContent.includes('基本統計量'))
    assert.ok(lessonNode)
    assert.equal(app.host.querySelector('.lesson-detail-card'), null)
    const selectedId = lessonNode.dataset.id
    await click(lessonNode)
    assert.equal(app.host.querySelectorAll('.react-flow__node.selected').length, 1)
    assert.equal(app.host.querySelector('.map-selection').textContent,
      `選択中: ${lessonNode.querySelector('.map-node-title').textContent}。分野: ${lessonNode.querySelector('.map-node-domain').textContent}。直接の共通必須前提 3 件を強調しています`)

    const viewport = app.host.querySelector('.react-flow__viewport')
    const beforeZoom = viewport.style.transform
    await click(app.host.querySelector('.react-flow__controls-zoomin'))
    const zoomedTransform = viewport.style.transform
    assert.notEqual(zoomedTransform, beforeZoom)

    const listButton = buttonFor(app.host, '教材一覧')
    await click(listButton)
    await click(buttonFor(app.host, 'マップ表示'))
    assert.equal(app.host.querySelector('.react-flow__viewport').style.transform, zoomedTransform)

    await click(app.host.querySelector('.react-flow__controls-zoomin'))
    await click(app.host.querySelector('.react-flow__controls-zoomin'))
    await click(buttonFor(app.host, '全体表示'))
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 220)))
    const fitViewTransform = app.host.querySelector('.react-flow__viewport').style.transform

    listButton.focus()
    await click(listButton)
    assert.equal(window.document.activeElement, listButton)
    assert.ok(app.host.querySelector('.lesson-card'))
    await click(buttonFor(app.host, 'マップ表示'))
    assert.equal(app.host.querySelector('.react-flow__viewport').style.transform, fitViewTransform)
    assert.equal(app.host.querySelectorAll('.react-flow__node.selected').length, 1)
    assert.equal(app.host.querySelector('.react-flow__node.selected').dataset.id, selectedId)

    await click(buttonFor(app.host, 'Re-layout'))
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 220)))
    assert.equal(app.host.querySelectorAll('.react-flow__node.selected').length, 1)
    assert.equal(app.host.querySelector('.react-flow__node.selected').dataset.id, selectedId)
    const relayoutTransform = app.host.querySelector('.react-flow__viewport').style.transform

    await click(linkFor(app.host, '進捗'))
    await click(linkFor(app.host, '学習マップ'))
    assert.equal(app.host.querySelectorAll('.react-flow__node.selected').length, 1)
    assert.equal(app.host.querySelector('.react-flow__node.selected').dataset.id, selectedId)
    assert.equal(app.host.querySelector('.react-flow__viewport').style.transform, relayoutTransform)
  } finally {
    await app.close()
  }
})

test('integrated learning map details use available lesson references and existing routes', async () => {
  const app = await createHarness()
  try {
    await click(linkFor(app.host, '学習マップ'))
    const descriptiveNode = [...app.host.querySelectorAll('.react-flow__node')]
      .find((node) => node.dataset.id === 'descriptive-statistics')
    await click(descriptiveNode)
    const detail = app.host.querySelector('.lesson-detail-card')
    assert.ok(detail)
    assert.match(detail.textContent, /学習目標/u)
    assert.match(detail.textContent, /共通必須前提/u)
    assert.match(detail.textContent, /任意復習/u)
    assert.equal(linkFor(detail, '解説を読む')?.getAttribute('href'), '#/lesson/descriptive-statistics')
    assert.equal(linkFor(detail, '演習問題一覧を開く（全単元共通）')?.getAttribute('href'), '#/practice')
    assert.equal(linkFor(detail, '全単元の演習記録・集計を見る')?.getAttribute('href'), '#/progress')

    await click(linkFor(detail, '演習問題一覧を開く（全単元共通）'))
    assert.equal(app.dom.window.location.hash, '#/practice')
    await click(linkFor(app.host, '学習マップ'))
    assert.equal(app.host.querySelector('.react-flow__node.selected')?.dataset.id, 'descriptive-statistics')
    assert.ok(app.host.querySelector('.lesson-detail-card'))

    await click(linkFor(app.host.querySelector('.lesson-detail-card'), '解説を読む'))
    assert.equal(app.dom.window.location.hash, '#/lesson/descriptive-statistics')
    assert.match(app.host.querySelector('.lesson-panel').textContent, /学習目標/u)
    await click(linkFor(app.host, '学習マップ'))
    assert.ok(app.host.querySelector('.lesson-detail-card'))

    await click(linkFor(app.host.querySelector('.lesson-detail-card'), '全単元の演習記録・集計を見る'))
    assert.equal(app.dom.window.location.hash, '#/progress')
  } finally {
    await app.close()
  }
})

test('manual map progress stays separate from practice data, supports explicit controls, and persists on reload', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    await click(buttonFor(questionOption(app.host, 'q-desc-var-num-001'), 'この問題を始める'))
    await changeTextInput(window, app.host.querySelector('input[type="text"]'), '1.030')
    await click(buttonFor(app.host, '回答を送信する'))
    assert.equal(readLocalData().data.answerAttempts[0].gradingResult.isCorrect, false)
    let savedPracticeData = window.localStorage.getItem('sfqc:local-data')
    assert.ok(savedPracticeData)
    await click(linkFor(app.host, '学習マップ'))

    assert.match(app.host.textContent, /手動完了 0 \/ 34/u)
    assert.match(app.host.querySelector('.map-toolbar').textContent, /手動進捗とチェックはこのブラウザーに保存され、演習記録とは別です。統合バックアップに含まれます。/u)
    await click(app.host.querySelector('.react-flow__node[data-id="descriptive-statistics"]'))
    let detail = app.host.querySelector('.lesson-detail-card')
    assert.match(detail.querySelector('.manual-progress-status').textContent, /手動進捗：未開始/u)
    assert.match(detail.textContent, /手動進捗とチェックはこのブラウザーに保存され、演習記録とは別です。統合バックアップに含まれます。/u)

    await click(buttonFor(detail, 'Start'))
    await settleEffects(window)
    detail = app.host.querySelector('.lesson-detail-card')
    assert.match(detail.querySelector('.manual-progress-status').textContent, /手動進捗：学習中/u)
    assert.equal(buttonFor(detail, 'Start'), undefined)
    assert.equal(window.document.activeElement, buttonFor(detail, 'Mark completed'))

    for (const checkbox of detail.querySelectorAll('input[type="checkbox"]')) await click(checkbox)
    detail = app.host.querySelector('.lesson-detail-card')
    assert.ok([...detail.querySelectorAll('input[type="checkbox"]')].every((checkbox) => checkbox.checked))
    assert.match(detail.querySelector('.manual-progress-status').textContent, /手動進捗：学習中/u)
    assert.match(app.host.textContent, /手動完了 0 \/ 34/u)

    await click(buttonFor(detail, 'Mark completed'))
    await settleEffects(window)
    detail = app.host.querySelector('.lesson-detail-card')
    assert.match(detail.querySelector('.manual-progress-status').textContent, /手動進捗：完了/u)
    assert.match(app.host.textContent, /手動完了 1 \/ 34/u)
    assert.equal(window.document.activeElement, buttonFor(detail, 'Reopen'))
    await click(detail.querySelector('input[type="checkbox"]'))
    detail = app.host.querySelector('.lesson-detail-card')
    assert.match(detail.querySelector('.manual-progress-status').textContent, /手動進捗：完了/u)
    assert.match(app.host.textContent, /手動完了 1 \/ 34/u)

    await click(buttonFor(detail, 'Reopen'))
    await settleEffects(window)
    detail = app.host.querySelector('.lesson-detail-card')
    assert.match(detail.querySelector('.manual-progress-status').textContent, /手動進捗：学習中/u)
    assert.equal(detail.querySelector('input[type="checkbox"]').checked, false)
    assert.match(app.host.textContent, /手動完了 0 \/ 34/u)
    assert.equal(window.document.activeElement, buttonFor(detail, 'Mark completed'))

    await click(app.host.querySelector('.react-flow__node[data-id="math-arithmetic"]'))
    detail = app.host.querySelector('.lesson-detail-card')
    assert.match(detail.querySelector('.manual-progress-status').textContent, /手動進捗：未開始/u)
    assert.ok([...detail.querySelectorAll('input[type="checkbox"]')].every((checkbox) => !checkbox.checked))
    await click(buttonFor(detail, 'Mark completed'))
    await settleEffects(window)
    assert.match(app.host.textContent, /手動完了 1 \/ 34/u)

    await click(buttonFor(app.host, 'Reopen'))
    await settleEffects(window)
    await click(app.host.querySelector('.react-flow__node[data-id="descriptive-statistics"]'))
    detail = app.host.querySelector('.lesson-detail-card')
    assert.match(detail.querySelector('.manual-progress-status').textContent, /手動進捗：学習中/u)
    assert.equal(detail.querySelector('input[type="checkbox"]').checked, false)

    await click(linkFor(detail, '解説を読む'))
    await click(linkFor(app.host, '学習マップ'))
    assert.match(app.host.querySelector('.lesson-detail-card .manual-progress-status').textContent, /手動進捗：学習中/u)
    await click(buttonFor(app.host, '教材一覧'))
    await click(buttonFor(app.host, 'マップ表示'))
    detail = app.host.querySelector('.lesson-detail-card')
    assert.match(detail.querySelector('.manual-progress-status').textContent, /手動進捗：学習中/u)
    await click(detail.querySelector('input[type="checkbox"]'))
    detail = app.host.querySelector('.lesson-detail-card')
    const checkedObjectives = [...detail.querySelectorAll('input[type="checkbox"]')].map((checkbox) => checkbox.checked)
    assert.ok(checkedObjectives[0])
    assert.equal(buttonFor(detail, 'Start'), undefined)
    assert.ok(buttonFor(detail, 'Mark completed'))
    assert.equal(buttonFor(detail, 'Reopen'), undefined)
    assert.equal(window.localStorage.getItem('sfqc:local-data'), savedPracticeData)
    assert.ok(window.localStorage.getItem(MAP_STATE_KEY))

    await click(linkFor(detail, '演習問題一覧を開く（全単元共通）'))
    assert.equal(window.location.hash, '#/practice')
    await click(buttonFor(questionOption(app.host, 'q-desc-var-num-001'), 'この問題を始める'))
    await changeTextInput(window, app.host.querySelector('input[type="text"]'), '1.013')
    await click(buttonFor(app.host, '回答を送信する'))
    assert.equal(readLocalData().data.answerAttempts.length, 2)
    assert.equal(readLocalData().data.answerAttempts.at(-1).gradingResult.isCorrect, true)
    assert.notEqual(window.localStorage.getItem('sfqc:local-data'), savedPracticeData)
    savedPracticeData = window.localStorage.getItem('sfqc:local-data')

    await click(linkFor(app.host, '学習マップ'))
    assert.equal(window.location.hash, '#/map')
    detail = app.host.querySelector('.lesson-detail-card')
    assert.match(detail.querySelector('.manual-progress-status').textContent, /手動進捗：学習中/u)
    assert.deepEqual([...detail.querySelectorAll('input[type="checkbox"]')].map((checkbox) => checkbox.checked), checkedObjectives)
    assert.equal(buttonFor(detail, 'Start'), undefined)
    assert.ok(buttonFor(detail, 'Mark completed'))
    assert.equal(buttonFor(detail, 'Reopen'), undefined)

    await click(buttonFor(detail, 'Mark completed'))
    await settleEffects(window)
    detail = app.host.querySelector('.lesson-detail-card')
    assert.match(detail.querySelector('.manual-progress-status').textContent, /手動進捗：完了/u)
    assert.deepEqual([...detail.querySelectorAll('input[type="checkbox"]')].map((checkbox) => checkbox.checked), checkedObjectives)
    assert.equal(buttonFor(detail, 'Start'), undefined)
    assert.equal(buttonFor(detail, 'Mark completed'), undefined)
    assert.ok(buttonFor(detail, 'Reopen'))
    assert.equal(window.localStorage.getItem('sfqc:local-data'), savedPracticeData)

    await click(linkFor(detail, '演習問題一覧を開く（全単元共通）'))
    await click(buttonFor(questionOption(app.host, 'q-desc-var-num-001'), 'この問題を始める'))
    await changeTextInput(window, app.host.querySelector('input[type="text"]'), '1.030')
    await click(buttonFor(app.host, '回答を送信する'))
    assert.equal(readLocalData().data.answerAttempts.length, 3)
    assert.equal(readLocalData().data.answerAttempts.at(-1).gradingResult.isCorrect, false)
    assert.notEqual(window.localStorage.getItem('sfqc:local-data'), savedPracticeData)
    savedPracticeData = window.localStorage.getItem('sfqc:local-data')

    await click(linkFor(app.host, '学習マップ'))
    assert.equal(window.location.hash, '#/map')
    detail = app.host.querySelector('.lesson-detail-card')
    assert.match(detail.querySelector('.manual-progress-status').textContent, /手動進捗：完了/u)
    assert.deepEqual([...detail.querySelectorAll('input[type="checkbox"]')].map((checkbox) => checkbox.checked), checkedObjectives)
    assert.equal(buttonFor(detail, 'Start'), undefined)
    assert.equal(buttonFor(detail, 'Mark completed'), undefined)
    assert.ok(buttonFor(detail, 'Reopen'))
    assert.equal(window.localStorage.getItem('sfqc:local-data'), savedPracticeData)

    assert.equal(window.localStorage.getItem('sfqc:local-data'), savedPracticeData)
    await app.remountAt('#/map')
    assert.match(app.host.textContent, /手動完了 1 \/ 34/u)
    await click(app.host.querySelector('.react-flow__node[data-id="descriptive-statistics"]'))
    detail = app.host.querySelector('.lesson-detail-card')
    assert.match(detail.querySelector('.manual-progress-status').textContent, /手動進捗：完了/u)
    assert.deepEqual([...detail.querySelectorAll('input[type="checkbox"]')].map((checkbox) => checkbox.checked), checkedObjectives)
    assert.equal(window.localStorage.getItem('sfqc:local-data'), savedPracticeData)
  } finally {
    await app.close()
  }
})

test('StrictMode manual progress writes once per user action and failed writes do not update the UI', async () => {
  const app = await createHarness({ strict: true })
  const storagePrototype = Object.getPrototypeOf(app.dom.window.localStorage)
  const originalDescriptor = Object.getOwnPropertyDescriptor(storagePrototype, 'setItem')
  try {
    const { window } = app.dom
    const storage = window.localStorage
    const original = storagePrototype.setItem
    let writes = 0
    let rejectWrites = false
    Object.defineProperty(storagePrototype, 'setItem', {
      configurable: true,
      writable: true,
      value: function (key, value) {
        if (key === MAP_STATE_KEY) {
          writes++
          if (rejectWrites) throw new Error('quota')
        }
        return original.call(this, key, value)
      },
    })
    assert.equal(storage.getItem(MAP_STATE_KEY), null)
    assert.equal(writes, 0)
    await click(linkFor(app.host, '学習マップ'))
    await click(app.host.querySelector('.react-flow__node[data-id="descriptive-statistics"]'))
    let detail = app.host.querySelector('.lesson-detail-card')
    await click(buttonFor(detail, 'Start'))
    await settleEffects(window)
    assert.equal(writes, 1)
    assert.match(app.host.querySelector('.manual-progress-status').textContent, /学習中/u)

    rejectWrites = true
    detail = app.host.querySelector('.lesson-detail-card')
    await click(detail.querySelector('input[type="checkbox"]'))
    await settleEffects(window)
    assert.equal(writes, 2)
    assert.equal(app.host.querySelector('.lesson-detail-card input[type="checkbox"]').checked, false)
    assert.match(app.host.querySelector('.map-route-messages').textContent, /保存できませんでした/u)
  } finally {
    if (originalDescriptor) Object.defineProperty(storagePrototype, 'setItem', originalDescriptor)
    await app.close()
  }
})

test('manual progress stops editing when the post-write map-state readback is unavailable', async () => {
  const app = await createHarness()
  const storagePrototype = Object.getPrototypeOf(app.dom.window.localStorage)
  const originalGetDescriptor = Object.getOwnPropertyDescriptor(storagePrototype, 'getItem')
  const originalSetDescriptor = Object.getOwnPropertyDescriptor(storagePrototype, 'setItem')
  const originalGet = storagePrototype.getItem
  const originalSet = storagePrototype.setItem
  let writes = 0
  let failNextMapRead = false
  try {
    const { window } = app.dom
    Object.defineProperty(storagePrototype, 'getItem', {
      configurable: true,
      writable: true,
      value: function (key) {
        if (key === MAP_STATE_KEY && failNextMapRead) {
          failNextMapRead = false
          throw new Error('blocked')
        }
        return originalGet.call(this, key)
      },
    })
    Object.defineProperty(storagePrototype, 'setItem', {
      configurable: true,
      writable: true,
      value: function (key, value) {
        if (key === MAP_STATE_KEY) {
          writes++
          originalSet.call(this, key, value)
          failNextMapRead = true
          return
        }
        return originalSet.call(this, key, value)
      },
    })
    await click(linkFor(app.host, '学習マップ'))
    await click(app.host.querySelector('.react-flow__node[data-id="descriptive-statistics"]'))
    let detail = app.host.querySelector('.lesson-detail-card')
    await click(buttonFor(detail, 'Start'))
    await settleEffects(window)
    detail = app.host.querySelector('.lesson-detail-card')
    assert.equal(writes, 1)
    assert.equal(buttonFor(detail, 'Start')?.disabled, true)
    assert.ok([...detail.querySelectorAll('input[type="checkbox"]')].every((input) => input.disabled))
    assert.match(app.host.querySelector('.map-route-messages').textContent, /読み取れません/u)

    await click(buttonFor(detail, 'Start'))
    assert.equal(writes, 1)
    assert.equal(readMapState(lessonRegistry, () => window.localStorage).status, 'ok')
  } finally {
    if (originalGetDescriptor) Object.defineProperty(storagePrototype, 'getItem', originalGetDescriptor)
    if (originalSetDescriptor) Object.defineProperty(storagePrototype, 'setItem', originalSetDescriptor)
    await app.close()
  }
})

test('manual progress clears the migration save reminder after a successful action', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    const state = createInitialMapState(lessonRegistry)
    const lessonId = 'descriptive-statistics'
    state.lessons[lessonId] = {
      ...state.lessons[lessonId], lessonRevision: state.lessons[lessonId].lessonRevision + 1,
      checks: state.lessons[lessonId].checks.map(() => true),
    }
    window.localStorage.setItem(MAP_STATE_KEY, JSON.stringify(state))
    await app.remountAt('#/map')
    assert.match(app.host.querySelector('.map-route-messages').textContent, /次の手動操作時に保存されます/u)

    await click(app.host.querySelector(`.react-flow__node[data-id="${lessonId}"]`))
    await click(buttonFor(app.host.querySelector('.lesson-detail-card'), 'Start'))
    await settleEffects(window)
    assert.doesNotMatch(app.host.querySelector('.map-route-messages').textContent, /次の手動操作時に保存されます/u)
    assert.equal(readMapState(lessonRegistry, () => window.localStorage).status, 'ok')
  } finally {
    await app.close()
  }
})

test('manual progress rejects an old tab write after another tab changes map state', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    await click(linkFor(app.host, '学習マップ'))
    await click(app.host.querySelector('.react-flow__node[data-id="descriptive-statistics"]'))
    const external = createInitialMapState(lessonRegistry)
    const id = 'descriptive-statistics'
    external.lessons[id] = { ...external.lessons[id], status: 'completed', completedAt: '2026-10-30T02:00:00.000Z' }
    saveMapState(external, null, lessonRegistry, () => window.localStorage)
    const raw = window.localStorage.getItem(MAP_STATE_KEY)
    await click(buttonFor(app.host.querySelector('.lesson-detail-card'), 'Mark completed'))
    await settleEffects(window)
    assert.equal(window.localStorage.getItem(MAP_STATE_KEY), raw)
    assert.match(app.host.querySelector('.lesson-detail-card .manual-progress-status').textContent, /完了/u)
    assert.match(app.host.querySelector('.map-route-messages').textContent, /別の画面で手動進捗が変更/u)
  } finally {
    await app.close()
  }
})

test('data manager imports integrated backups and keeps map progress when importing a legacy file', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    const prompts = []
    window.confirm = (message) => { prompts.push(message); return true }
    await click(linkFor(app.host, 'データ管理'))
    assert.ok(buttonFor(app.host, '全データを書き出し'))
    assert.ok(buttonFor(app.host, '演習記録のみを書き出し（schema v2）'))

    const map = createInitialMapState(lessonRegistry)
    map.lessons['descriptive-statistics'] = {
      ...map.lessons['descriptive-statistics'], status: 'completed', completedAt: '2026-10-30T03:00:00.000Z',
    }
    const integrated = serializeBackup(JSON.parse(exportLocalData(() => window.localStorage)), map)
    const input = app.host.querySelector('#backup-file')
    const loadFile = async (contents) => {
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [new window.File([contents], 'backup.json', { type: 'application/json' })],
      })
      await act(async () => input.dispatchEvent(new window.Event('change', { bubbles: true })))
      await settleEffects(window)
    }
    await loadFile(integrated)
    assert.equal(prompts.length, 1)
    assert.match(prompts[0], /未保存/u)
    assert.match(prompts[0], /手動完了 1単元/u)
    assert.match(app.host.querySelector('.data-message').textContent, /演習記録と手動進捗・配置を復元/u)
    const savedMapRaw = window.localStorage.getItem(MAP_STATE_KEY)
    assert.ok(savedMapRaw)

    await loadFile(exportLocalData(() => window.localStorage))
    assert.equal(prompts.length, 2)
    assert.match(prompts[1], /手動進捗と配置は維持/u)
    assert.equal(window.localStorage.getItem(MAP_STATE_KEY), savedMapRaw)
    assert.match(app.host.querySelector('.data-message').textContent, /演習記録のみを復元/u)
  } finally {
    await app.close()
  }
})

test('integrated learning map resets detail scrolling when the selected lesson changes', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    await click(linkFor(app.host, '学習マップ'))
    await click(app.host.querySelector('.react-flow__node[data-id="descriptive-statistics"]'))
    const firstContent = app.host.querySelector('.lesson-detail-content')
    firstContent.scrollTop = 400
    assert.equal(firstContent.scrollTop, 400)

    await click(app.host.querySelector('.react-flow__node[data-id="mean-inference"]'))
    const secondContent = app.host.querySelector('.lesson-detail-content')
    assert.notEqual(secondContent, firstContent)
    assert.equal(secondContent.scrollTop, 0)

    secondContent.scrollTop = 400
    const nextNode = app.host.querySelector('.react-flow__node[data-id="math-arithmetic"]')
    nextNode.focus()
    await pressKey(window, nextNode, 'Enter')
    assert.equal(window.document.activeElement, app.host.querySelector('.lesson-detail-header h2'))
    assert.equal(app.host.querySelector('.lesson-detail-content').scrollTop, 0)
  } finally {
    await app.close()
  }
})

test('integrated learning map shifts the viewport only when the selected node is clipped', async () => {
  const app = await createHarness()
  try {
    await click(linkFor(app.host, '学習マップ'))
    await settleEffects(app.dom.window)
    const canvas = app.host.querySelector('.map-canvas')
    const viewport = app.host.querySelector('.react-flow__viewport')
    const canvasRect = (width) => ({ left: 0, top: 0, right: width, bottom: 600, width, height: 600 })
    canvas.getBoundingClientRect = () => canvasRect(app.host.querySelector('.map-graph-layout.has-detail') ? 900 : 1200)

    const visibleNode = app.host.querySelector('.react-flow__node[data-id="math-arithmetic"]')
    visibleNode.getBoundingClientRect = () => ({ left: 300, top: 100, right: 572, bottom: 160, width: 272, height: 60 })
    const beforeVisibleSelection = viewport.style.transform
    await click(visibleNode)
    await settleEffects(app.dom.window)
    assert.equal(viewport.style.transform, beforeVisibleSelection)

    await click(buttonFor(app.host, '閉じる'))
    await settleEffects(app.dom.window)
    const clippedNode = app.host.querySelector('.react-flow__node[data-id="control-charts"]')
    clippedNode.getBoundingClientRect = () => ({ left: 880, top: 100, right: 1152, bottom: 160, width: 272, height: 60 })
    const beforeCorrection = viewport.style.transform
    await click(clippedNode)
    await settleEffects(app.dom.window)
    const afterCorrection = viewport.style.transform
    const transformValues = (value) => value.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\) scale\(([\d.]+)\)/u)
    const beforeValues = transformValues(beforeCorrection)
    const afterValues = transformValues(afterCorrection)
    assert.ok(beforeValues, beforeCorrection)
    assert.ok(afterValues, afterCorrection)
    assert.equal(afterValues[3], beforeValues[3])
    assert.ok(Number(afterValues[1]) < Number(beforeValues[1]))
  } finally {
    await app.close()
  }
})

test('integrated learning map highlights only direct common prerequisites and clears stale highlights', async () => {
  const app = await createHarness({ measureFlowNodes: true })
  try {
    const { window } = app.dom
    Object.defineProperty(window, 'DOMMatrixReadOnly', {
      configurable: true,
      value: class {
        constructor(transform) {
          this.m22 = Number(/scale\(\s*([-+.\deE]+)/u.exec(transform)?.[1] ?? 1)
        }
      },
    })
    await click(linkFor(app.host, '学習マップ'))
    await settleEffects(window)

    const graph = createMapPocGraph()
    const node = (id) => app.host.querySelector(`.react-flow__node[data-id="${id}"]`)
    const edgeMarker = (id) => {
      const edge = [...app.host.querySelectorAll('.react-flow__edge')].find((item) => item.dataset.id === id)
      const reference = edge?.querySelector('.react-flow__edge-path').getAttribute('marker-end')
      const markerId = /^url\(['"]?#(.+?)['"]?\)$/u.exec(reference ?? '')?.[1]
      const symbol = markerId && window.document.getElementById(markerId)?.querySelector('.arrowclosed')
      assert.ok(symbol, `expected an arrow marker for edge ${id}`)
      return { reference, fill: symbol.style.fill }
    }
    const highlightedNodeIds = () => [...app.host.querySelectorAll('.react-flow__node.map-prerequisite')]
      .map((item) => item.dataset.id).sort()
    const highlightedEdgeIds = () => [...app.host.querySelectorAll('.react-flow__edge.map-prerequisite-edge')]
      .map((item) => item.dataset.id).sort()
    const defaultMarkers = new Map(graph.commonPrerequisiteEdges.map((edge) => [edge.id, edgeMarker(edge.id)]))
    const expectSelection = async (id, expectedPrerequisites) => {
      await click(node(id))
      await settleEffects(window)
      const directEdges = graph.commonPrerequisiteEdges.filter((edge) => edge.target === id)
      assert.deepEqual(highlightedNodeIds(), [...expectedPrerequisites].sort())
      assert.deepEqual(highlightedEdgeIds(), directEdges.map((edge) => edge.id).sort())
      assert.equal(app.host.querySelectorAll('.react-flow__edge').length, 64)
      assert.equal(app.host.querySelector('.react-flow__node.selected')?.dataset.id, id)
    }

    const mapStateBeforeSelection = window.localStorage.getItem(MAP_STATE_KEY)
    await expectSelection('math-arithmetic', [])
    assert.match(node('math-arithmetic').getAttribute('aria-label'), /選択中/u)
    assert.match(app.host.querySelector('.map-selection').textContent, /直接の共通必須前提はありません/u)
    await expectSelection('math-ratios-percentages', ['math-arithmetic'])
    await expectSelection('mean-inference', [
      'inference-basics', 'descriptive-statistics', 'sampling-distributions',
    ])
    const meanInferenceEdges = new Set(graph.commonPrerequisiteEdges
      .filter((edge) => edge.target === 'mean-inference').map((edge) => edge.id))
    for (const edge of graph.commonPrerequisiteEdges) {
      assert.equal(edgeMarker(edge.id).fill, meanInferenceEdges.has(edge.id) ? 'var(--map-prerequisite)' : defaultMarkers.get(edge.id).fill)
    }

    assert.match(node('descriptive-statistics').getAttribute('aria-label'), /直接の共通必須前提/u)
    assert.match(app.host.querySelector('.map-selection').textContent, /直接の共通必須前提 3 件/u)
    const highlightedEdge = app.host.querySelector('.react-flow__edge.map-prerequisite-edge')
    assert.match(highlightedEdge.getAttribute('aria-label'), /選択教材の直接前提/u)
    for (const id of [
      'population-sample', 'normal-distribution', 'law-large-numbers-clt', 'mean-difference-inference',
    ]) assert.equal(node(id).classList.contains('map-prerequisite'), false)
    assert.equal(window.localStorage.getItem(MAP_STATE_KEY), mapStateBeforeSelection)

    const selectedNode = node('mean-inference')
    const positionBefore = renderedPosition(selectedNode)
    await click(buttonFor(app.host, '配置編集'))
    selectedNode.focus()
    await pressKey(window, selectedNode, 'ArrowRight')
    await settleEffects(window)
    assert.notDeepEqual(renderedPosition(node('mean-inference')), positionBefore)
    assert.equal(app.host.querySelector('.react-flow__node.selected')?.dataset.id, 'mean-inference')
    assert.deepEqual(highlightedNodeIds(), ['descriptive-statistics', 'inference-basics', 'sampling-distributions'])

    await click(buttonFor(app.host.querySelector('.lesson-detail-card'), 'Mark completed'))
    await settleEffects(window)
    assert.match(app.host.querySelector('.manual-progress-status').textContent, /完了/u)
    assert.equal(app.host.querySelector('.react-flow__node.selected')?.dataset.id, 'mean-inference')
    assert.deepEqual(highlightedNodeIds(), ['descriptive-statistics', 'inference-basics', 'sampling-distributions'])

    await expectSelection('descriptive-statistics', [
      'data-types', 'math-powers-roots', 'math-ratios-percentages',
    ])
    assert.equal(node('qc-seven-tools').classList.contains('map-prerequisite'), false)
    assert.equal(node('mean-inference').classList.contains('map-prerequisite'), false)

    const selected = node('descriptive-statistics')
    selected.focus()
    await pressKey(window, selected, 'Escape')
    for (const edge of graph.commonPrerequisiteEdges) {
      assert.deepEqual(edgeMarker(edge.id), defaultMarkers.get(edge.id))
    }
    assert.equal(highlightedNodeIds().length, 0)
    assert.equal(highlightedEdgeIds().length, 0)
    assert.equal(selected.getAttribute('aria-label'), '基本統計量（分野：データ・記述統計）')
    assert.equal(app.host.querySelector('.map-selection').textContent, '選択中: なし')

    await click(node('mean-inference'))
    await click(app.host.querySelector('.react-flow__pane'))
    assert.equal(highlightedNodeIds().length, 0)
    assert.equal(highlightedEdgeIds().length, 0)

    await app.remountAt('#/map')
    assert.equal(highlightedNodeIds().length, 0)
    assert.equal(highlightedEdgeIds().length, 0)
    assert.equal(app.host.querySelectorAll('.react-flow__edge').length, 64)
  } finally {
    await app.close()
  }
})

test('development domain editor keeps a reviewable in-memory draft and exports only registry changes', async () => {
  // StrictMode replays state updaters after the input event to catch retained SyntheticEvent reads.
  const app = await createHarness({ strict: true })
  const { window } = app.dom
  const urlCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  const urlRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
  const anchorClick = Object.getOwnPropertyDescriptor(window.HTMLAnchorElement.prototype, 'click')
  const downloads = []
  let exportedBlob = null
  let failDownload = true
  const restoreDownloadMocks = () => {
    if (urlCreate) Object.defineProperty(URL, 'createObjectURL', urlCreate)
    else delete URL.createObjectURL
    if (urlRevoke) Object.defineProperty(URL, 'revokeObjectURL', urlRevoke)
    else delete URL.revokeObjectURL
    if (anchorClick) Object.defineProperty(window.HTMLAnchorElement.prototype, 'click', anchorClick)
    else delete window.HTMLAnchorElement.prototype.click
  }
  try {
    Object.defineProperty(window, 'DOMMatrixReadOnly', {
      configurable: true,
      value: class {
        constructor(transform) {
          this.m22 = Number(/scale\(\s*([-+.\deE]+)/u.exec(transform)?.[1] ?? 1)
        }
      },
    })
    assert.equal(buttonFor(app.host, '分野編集'), undefined)
    await click(linkFor(app.host, '学習マップ'))
    await settleEffects(window)
    assert.equal(app.host.querySelectorAll('.react-flow__node').length, 34)
    const mapLayout = () => app.host.querySelector('.map-graph-layout')
    assert.equal(app.host.querySelector('.app-shell').dataset.theme, 'light')
    assert.equal(mapLayout().style.getPropertyValue('--map-author-domain-math-foundations'), '')
    await app.setSystemTheme('dark')
    await settleEffects(window)
    assert.equal(app.host.querySelector('.app-shell').dataset.theme, 'dark')
    assert.equal(mapLayout().style.getPropertyValue('--map-author-domain-math-foundations'), '')
    await app.setSystemTheme('light')
    await settleEffects(window)
    assert.equal(app.host.querySelector('.app-shell').dataset.theme, 'light')

    const nodeFor = (id) => app.host.querySelector(`.react-flow__node[data-id="${id}"]`)
    const nodePosition = renderedPosition(nodeFor('math-arithmetic'))
    const lessonTitle = (id) => lessonRegistry.lessons.find((lesson) => lesson.lessonId === id).title
    const selectFor = (id) => [...app.host.querySelectorAll('.map-author-domain-fields label')]
      .find((label) => label.querySelector('span').textContent === lessonTitle(id)).querySelector('select')
    const domainClasses = (id) => [...nodeFor(id).classList].filter((name) => name.startsWith('map-domain-'))

    await click(nodeFor('descriptive-statistics'))
    await click(buttonFor(app.host, '分野編集'))
    await settleEffects(window)
    assert.ok(app.host.querySelector('.map-app-shell.map-author-mode'))
    assert.equal(app.host.querySelector('.map-graph-layout.has-detail'), null)
    assert.equal(app.host.querySelector('.lesson-detail-card'), null)
    assert.equal(app.host.querySelector('.react-flow__node.selected')?.dataset.id, 'descriptive-statistics')
    assert.match(app.host.querySelector('.map-author-summary').textContent, /基本統計量/u)
    assert.match(app.host.querySelector('.map-author-summary').textContent, /データ・記述統計/u)
    assert.equal(window.document.activeElement, app.host.querySelector('.map-author-color-fields input'))
    assert.equal(app.host.querySelectorAll('.map-author-domain-fields select').length, 34)
    assert.equal(app.host.querySelectorAll('.map-author-color-fields input[type="color"]').length, 5)
    assert.deepEqual([...app.host.querySelectorAll('.map-author-color-fields label > span')].map((item) => item.textContent),
      Object.values(lessonDomains))

    for (const domain of ['data-description', 'probability-distributions', 'math-foundations']) {
      await changeControl(window, selectFor('math-arithmetic'), domain)
      assert.deepEqual(domainClasses('math-arithmetic'), [`map-domain-${domain}`])
      assert.equal(nodeFor('math-arithmetic').querySelector('.map-node-domain').textContent, lessonDomains[domain])
    }
    assert.equal(app.host.querySelector('.map-author-dirty').textContent, '変更はありません。')
    assert.deepEqual(renderedPosition(nodeFor('math-arithmetic')), nodePosition)

    for (const color of app.host.querySelectorAll('.map-author-color-fields input[type="color"]')) {
      await changeControl(window, color, '#000000')
    }
    const draftColorsBeforeTheme = [...app.host.querySelectorAll('.map-author-color-fields input[type="color"]')]
      .map((input) => input.value)
    await changeControl(window, selectFor('descriptive-statistics'), 'quality-methods')
    assert.match(app.host.querySelector('.map-author-dirty').textContent, /未書き出し/u)
    assert.equal(mapLayout().style.getPropertyValue('--map-author-domain-math-foundations'), '#000000')
    await changeControl(window, app.host.querySelector('#theme-preference'), 'dark')
    assert.equal(app.host.querySelector('.app-shell').dataset.theme, 'dark')
    assert.deepEqual([...app.host.querySelectorAll('.map-author-color-fields input[type="color"]')]
      .map((input) => input.value), draftColorsBeforeTheme)
    assert.equal(mapLayout().style.getPropertyValue('--map-author-domain-math-foundations'), '#000000')
    assert.deepEqual(domainClasses('descriptive-statistics'), ['map-domain-quality-methods'])
    assert.equal(nodeFor('descriptive-statistics').querySelector('.map-node-domain').textContent, '品質管理手法')
    assert.equal(nodeFor('descriptive-statistics').getAttribute('aria-label'), '基本統計量（分野：品質管理手法、選択中）')
    for (const lesson of lessonRegistry.lessons) {
      const current = lesson.lessonId === 'descriptive-statistics' ? 'quality-methods' : lesson.domain
      assert.equal(nodeFor(lesson.lessonId).querySelector('.map-node-domain').textContent, lessonDomains[current])
    }

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value(blob) {
        if (failDownload) throw new Error('download unavailable')
        exportedBlob = blob
        return 'blob:sfqc-test'
      },
    })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value() {} })
    Object.defineProperty(window.HTMLAnchorElement.prototype, 'click', {
      configurable: true,
      writable: true,
      value() { downloads.push({ filename: this.download, href: this.href }) },
    })
    const exportButton = buttonFor(app.host, 'レビュー用JSONを書き出す')
    assert.ok(exportButton, [...app.host.querySelectorAll('.map-author-editor button')].map((button) => button.textContent))
    await click(exportButton)
    assert.match(app.host.querySelector('.map-author-export-message').textContent, /変更は保持/u)
    assert.match(app.host.querySelector('.map-author-dirty').textContent, /未書き出し/u)

    failDownload = false
    await click(buttonFor(app.host, 'レビュー用JSONを書き出す'))
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    assert.match(app.host.querySelector('.map-author-export-message').textContent, /書き出し操作を開始/u)
    assert.equal(app.host.querySelector('.map-author-dirty').textContent, '変更はありません。')
    assert.equal(downloads[0].filename, 'sfqc-lesson-domain-draft.json')
    const review = JSON.parse(await exportedBlob.text())
    assert.equal(review.schemaVersion, 1)
    assert.equal(review.curriculumRevision, lessonRegistry.curriculumRevision)
    assert.deepEqual(Object.keys(review.domainColors), Object.keys(lessonDomains))
    assert.ok(Object.values(review.domainColors).every((color) => color === '#000000'))
    assert.deepEqual(review.lessonDomainChanges, [{
      lessonId: 'descriptive-statistics', from: 'data-description', to: 'quality-methods',
    }])
    restoreDownloadMocks()

    await click(buttonFor(app.host, '閉じる'))
    await settleEffects(window)
    assert.equal(app.host.querySelector('.map-app-shell.map-author-mode'), null)
    assert.equal(mapLayout().style.getPropertyValue('--map-author-domain-math-foundations'), '')
    assert.equal(app.host.querySelector('.react-flow__node.selected')?.dataset.id, 'descriptive-statistics')
    assert.ok(app.host.querySelector('.lesson-detail-card'))
    assert.equal(window.document.activeElement, buttonFor(app.host, '分野編集'))

    await click(buttonFor(app.host, '分野編集'))
    await click(buttonFor(app.host, '教材一覧'))
    assert.equal(app.host.querySelector('.map-app-shell.map-author-mode'), null)
    await click(buttonFor(app.host, 'マップ表示'))
    assert.equal(nodeFor('descriptive-statistics').querySelector('.map-node-domain').textContent, 'データ・記述統計')
    assert.equal(buttonFor(app.host, '分野編集').getAttribute('aria-expanded'), 'false')
    assert.equal(window.localStorage.getItem(MAP_STATE_KEY), null)

    await click(buttonFor(app.host, '分野編集'))
    await click(linkFor(app.host, '進捗'))
    assert.equal(app.host.querySelector('.map-app-shell.map-author-mode'), null)
    await click(linkFor(app.host, '学習マップ'))
    assert.equal(nodeFor('descriptive-statistics').querySelector('.map-node-domain').textContent, 'データ・記述統計')
    await app.remountAt('#/map')
    assert.equal(nodeFor('descriptive-statistics').querySelector('.map-node-domain').textContent, 'データ・記述統計')
  } finally {
    restoreDownloadMocks()
    await app.close()
  }
})

test('integrated learning map keyboard focus and Escape work throughout the map', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    await click(linkFor(app.host, '学習マップ'))
    const node = [...app.host.querySelectorAll('.react-flow__node')]
      .find((item) => item.dataset.id === 'mean-inference')
    node.focus()
    await pressKey(window, node, 'Enter')
    assert.equal(app.host.querySelectorAll('.react-flow__node.selected').length, 1)
    assert.equal(window.document.activeElement, app.host.querySelector('.lesson-detail-header h2'))
    assert.match(app.host.querySelector('.lesson-detail-card').textContent, /未収録/u)
    assert.match(app.host.querySelector('.lesson-detail-card').textContent, /方法条件付き必須/u)
    assert.doesNotMatch(app.host.querySelector('.lesson-detail-card').innerHTML, /href="#\/lesson\/mean-inference/u)
    assert.equal(linkFor(app.host.querySelector('.lesson-detail-card'), '演習問題一覧を開く（全単元共通）'), undefined)

    await pressKey(window, node, ' ')
    assert.equal(window.document.activeElement, app.host.querySelector('.lesson-detail-header h2'))

    const escapeFrom = async (getTarget) => {
      const selected = app.host.querySelector('.react-flow__node[data-id="mean-inference"]')
      await click(selected)
      const target = getTarget()
      target.focus()
      const event = await pressKey(window, target, 'Escape')
      assert.equal(event.defaultPrevented, true)
      assert.equal(app.host.querySelectorAll('.react-flow__node.selected').length, 0)
      assert.equal(window.document.activeElement, buttonFor(app.host, '全体表示'))
    }

    await escapeFrom(() => app.host.querySelector('.react-flow__node[data-id="mean-inference"]'))
    await escapeFrom(() => linkFor(app.host.querySelector('.lesson-detail-card'), '全単元の演習記録・集計を見る'))
    await escapeFrom(() => buttonFor(app.host, 'Re-layout'))
    await escapeFrom(() => buttonFor(app.host, 'マップ表示'))

    await click(app.host.querySelector('.react-flow__node[data-id="mean-inference"]'))
    await click(buttonFor(app.host, '閉じる'))
    assert.equal(app.host.querySelectorAll('.react-flow__node.selected').length, 0)
    assert.equal(window.document.activeElement, buttonFor(app.host, '全体表示'))
  } finally {
    await app.close()
  }
})

test('integrated learning map cancels pending focus on close, view change, and route change', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    await click(linkFor(app.host, '学習マップ'))
    const node = app.host.querySelector('.react-flow__node[data-id="descriptive-statistics"]')
    await click(node)
    node.focus()
    await act(async () => {
      const detailHeading = app.host.querySelector('.lesson-detail-header h2')
      node.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
      buttonFor(app.host, '閉じる').click()
      await new Promise((resolve) => window.requestAnimationFrame(resolve))
      assert.notEqual(window.document.activeElement, detailHeading)
    })
    assert.equal(window.document.activeElement, buttonFor(app.host, '全体表示'))

    await click(node)
    node.focus()
    await act(async () => {
      const detailHeading = app.host.querySelector('.lesson-detail-header h2')
      node.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
      buttonFor(app.host, '教材一覧').click()
      await new Promise((resolve) => window.setTimeout(resolve, 30))
      assert.notEqual(window.document.activeElement, detailHeading)
    })
    assert.equal(app.host.querySelector('.lesson-detail-card'), null)

    await click(buttonFor(app.host, 'マップ表示'))
    const selectedNode = app.host.querySelector('.react-flow__node[data-id="descriptive-statistics"]')
    selectedNode.focus()
    await act(async () => {
      const detailHeading = app.host.querySelector('.lesson-detail-header h2')
      selectedNode.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
      linkFor(app.host, '進捗').click()
      await new Promise((resolve) => window.setTimeout(resolve, 30))
      assert.notEqual(window.document.activeElement, detailHeading)
    })
    assert.equal(app.dom.window.location.hash, '#/progress')
  } finally {
    await app.close()
  }
})

test('integrated learning map Re-layout keeps an empty selection empty', async () => {
  const app = await createHarness()
  try {
    await click(linkFor(app.host, '学習マップ'))
    assert.equal(app.host.querySelectorAll('.react-flow__node.selected').length, 0)
    assert.equal(app.host.querySelector('.map-selection').textContent, '選択中: なし')

    await click(buttonFor(app.host, '教材一覧'))
    await click(buttonFor(app.host, 'マップ表示'))
    assert.equal(app.host.querySelectorAll('.react-flow__node.selected').length, 0)
    assert.equal(app.host.querySelector('.map-selection').textContent, '選択中: なし')

    await click(buttonFor(app.host, 'Re-layout'))
    assert.equal(app.host.querySelectorAll('.react-flow__node.selected').length, 0)
    assert.equal(app.host.querySelector('.map-selection').textContent, '選択中: なし')
  } finally {
    await app.close()
  }
})

test('map position snapshot helpers keep dragging live until a confirmed position change', async () => {
  const app = await createHarness()
  try {
    const { applyMapNodeChanges, mapPositions, samePositions, shouldSaveMapLayout } = await app.loadModule('/src/lesson-map-view.tsx')
    const nodes = createMapPocGraph().nodes
    const id = 'descriptive-statistics'
    const original = nodes.find((node) => node.id === id).position
    const live = applyMapNodeChanges(nodes, [{
      type: 'position', id, position: { x: original.x + 17, y: original.y + 9 }, dragging: true,
    }])
    assert.deepEqual(live.find((node) => node.id === id).position, { x: original.x + 17, y: original.y + 9 })
    assert.notDeepEqual(mapPositions(live), mapPositions(nodes))
    assert.equal(shouldSaveMapLayout([{ type: 'position', id, dragging: true }], mapPositions(live), mapPositions(nodes)), false)
    assert.equal(shouldSaveMapLayout([{ type: 'select', id, selected: true }], mapPositions(live), mapPositions(nodes)), false)
    assert.equal(shouldSaveMapLayout([{ type: 'dimensions', id }], mapPositions(live), mapPositions(nodes)), false)
    assert.equal(shouldSaveMapLayout([{ type: 'position', id, dragging: false }], mapPositions(nodes), mapPositions(nodes)), false)

    const confirmed = applyMapNodeChanges(live, [{
      type: 'position', id, position: { x: original.x + 17, y: original.y + 9 }, dragging: false,
    }])
    assert.deepEqual(confirmed.find((node) => node.id === id).position, { x: original.x + 17, y: original.y + 9 })
    assert.equal(shouldSaveMapLayout([{ type: 'position', id, dragging: false }], mapPositions(confirmed), mapPositions(nodes)), true)
    assert.equal(samePositions(mapPositions(confirmed), mapPositions(live)), true)
  } finally {
    await app.close()
  }
})

test('React Flow mouse drags that return to confirmed positions do not save layout', async () => {
  const app = await createHarness({ measureFlowNodes: true })
  const { window } = app.dom
  const storagePrototype = Object.getPrototypeOf(window.localStorage)
  const originalDescriptor = Object.getOwnPropertyDescriptor(storagePrototype, 'setItem')
  const originalSet = storagePrototype.setItem
  let mapWriteCount = 0
  try {
    Object.defineProperty(window, 'DOMMatrixReadOnly', {
      configurable: true,
      value: class {
        constructor(transform) {
          this.m22 = Number(/scale\(\s*([-+.\deE]+)/u.exec(transform)?.[1] ?? 1)
        }
      },
    })
    const positions = Object.fromEntries(createMapPocGraph().nodes.map(({ id, position }) => [id, position]))
    const nodeId = 'math-arithmetic'
    const confirmedPosition = { x: positions[nodeId].x + 40, y: positions[nodeId].y + 20 }
    positions[nodeId] = confirmedPosition
    const state = createInitialMapState(lessonRegistry)
    state.positions = positions
    saveMapState(state, null, lessonRegistry, () => window.localStorage)
    const rawBaseline = window.localStorage.getItem(MAP_STATE_KEY)

    await app.remountAt('#/map')
    await settleEffects(window)
    assert.deepEqual(renderedPosition(app.host.querySelector(`.react-flow__node[data-id="${nodeId}"]`)), confirmedPosition)

    Object.defineProperty(storagePrototype, 'setItem', {
      configurable: true,
      writable: true,
      value: function (key, value) {
        if (key === MAP_STATE_KEY) mapWriteCount += 1
        return originalSet.call(this, key, value)
      },
    })

    await click(buttonFor(app.host, '配置編集'))
    await settleEffects(window)
    const node = app.host.querySelector(`.react-flow__node[data-id="${nodeId}"]`)
    assert.ok(node.classList.contains('draggable'))
    const flowBounds = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 1024, bottom: 640, width: 1024, height: 640,
    })
    app.host.querySelector('.react-flow').getBoundingClientRect = flowBounds
    app.host.querySelector('.react-flow__pane').getBoundingClientRect = flowBounds
    node.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 1024, bottom: 640, width: 1024, height: 640,
    })

    const [startX, startY] = [320, 240]
    const dragOrigin = [startX + 4, startY]
    const dragNode = app.host.querySelector(`.react-flow__node[data-id="${nodeId}"]`)
    await dispatchReactFlowMouseEvent(window, dragNode, 'mousedown', startX, startY, 1)
    await dispatchReactFlowMouseEvent(window, window, 'mousemove', dragOrigin[0], dragOrigin[1], 1)
    await dispatchReactFlowMouseEvent(window, window, 'mousemove', startX + 40, startY + 18, 1)
    await settleEffects(window)

    const outwardNode = app.host.querySelector(`.react-flow__node[data-id="${nodeId}"]`)
    assert.ok(outwardNode.classList.contains('dragging'))
    const outwardPosition = renderedPosition(outwardNode)
    assert.notDeepEqual(outwardPosition, confirmedPosition, 'the React Flow drag must move the node outward')
    assert.equal(window.localStorage.getItem(MAP_STATE_KEY), rawBaseline)
    assert.equal(mapWriteCount, 0)

    await dispatchReactFlowMouseEvent(window, window, 'mousemove', dragOrigin[0], dragOrigin[1], 1)
    await settleEffects(window)
    assert.deepEqual(renderedPosition(app.host.querySelector(`.react-flow__node[data-id="${nodeId}"]`)), confirmedPosition)
    assert.equal(window.localStorage.getItem(MAP_STATE_KEY), rawBaseline)
    assert.equal(mapWriteCount, 0)

    await dispatchReactFlowMouseEvent(window, window, 'mouseup', dragOrigin[0], dragOrigin[1], 0)
    await settleEffects(window)
    assert.deepEqual(renderedPosition(app.host.querySelector(`.react-flow__node[data-id="${nodeId}"]`)), confirmedPosition)
    assert.deepEqual(savedMap(window).positions, positions)
    assert.equal(window.localStorage.getItem(MAP_STATE_KEY), rawBaseline)
    assert.equal(mapWriteCount, 0)

    const zeroNode = app.host.querySelector(`.react-flow__node[data-id="${nodeId}"]`)
    await dispatchReactFlowMouseEvent(window, zeroNode, 'mousedown', startX, startY, 1)
    await dispatchReactFlowMouseEvent(window, window, 'mousemove', startX, startY, 1)
    await dispatchReactFlowMouseEvent(window, window, 'mouseup', startX, startY, 0)
    await settleEffects(window)
    assert.deepEqual(renderedPosition(app.host.querySelector(`.react-flow__node[data-id="${nodeId}"]`)), confirmedPosition)
    assert.equal(window.localStorage.getItem(MAP_STATE_KEY), rawBaseline)
    assert.equal(mapWriteCount, 0)
  } finally {
    if (originalDescriptor) Object.defineProperty(storagePrototype, 'setItem', originalDescriptor)
    await app.close()
  }
})

test('layout editing gates keyboard movement, saves all positions, confirms Re-layout, and restores after reload', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    await click(linkFor(app.host, '学習マップ'))
    const id = 'descriptive-statistics'
    const node = app.host.querySelector(`.react-flow__node[data-id="${id}"]`)
    await click(node)
    node.focus()
    const before = renderedPosition(node)
    const originalPosition = createMapPocGraph().nodes.find((candidate) => candidate.id === id).position

    await pressKey(window, node, 'ArrowRight')
    assert.deepEqual(renderedPosition(app.host.querySelector(`.react-flow__node[data-id="${id}"]`)), before)
    assert.equal(window.localStorage.getItem(MAP_STATE_KEY), null)

    const editButton = buttonFor(app.host, '配置編集')
    assert.equal(editButton.getAttribute('aria-pressed'), 'false')
    await click(editButton)
    assert.equal(editButton.getAttribute('aria-pressed'), 'true')
    const activeNode = app.host.querySelector(`.react-flow__node[data-id="${id}"]`)
    activeNode.focus()
    await pressKey(window, activeNode, 'ArrowRight')
    await pressKey(window, app.host.querySelector(`.react-flow__node[data-id="${id}"]`), 'ArrowRight')

    let map = savedMap(window)
    assert.equal(Object.keys(map.positions).length, 34)
    assert.deepEqual(map.positions[id], { x: originalPosition.x + 10, y: originalPosition.y })
    const rawAfterMoves = window.localStorage.getItem(MAP_STATE_KEY)
    await click(buttonFor(app.host, '全体表示'))
    await settleEffects(window)
    assert.equal(window.localStorage.getItem(MAP_STATE_KEY), rawAfterMoves)

    window.confirm = () => false
    const beforeCancelPosition = renderedPosition(app.host.querySelector(`.react-flow__node[data-id="${id}"]`))
    const beforeCancelViewport = app.host.querySelector('.react-flow__viewport').style.transform
    const beforeCancelSelection = app.host.querySelector('.react-flow__node.selected')?.dataset.id
    await click(buttonFor(app.host, 'Re-layout'))
    assert.equal(window.localStorage.getItem(MAP_STATE_KEY), rawAfterMoves)
    assert.deepEqual(renderedPosition(app.host.querySelector(`.react-flow__node[data-id="${id}"]`)), beforeCancelPosition)
    assert.equal(app.host.querySelector('.react-flow__viewport').style.transform, beforeCancelViewport)
    assert.equal(app.host.querySelector('.react-flow__node.selected')?.dataset.id, beforeCancelSelection)

    window.confirm = () => true
    await click(buttonFor(app.host, 'Re-layout'))
    await settleEffects(window)
    map = savedMap(window)
    const automatic = createMapPocGraph().nodes.find((candidate) => candidate.id === id).position
    assert.deepEqual(map.positions[id], automatic)
    assert.equal(app.host.querySelector('.react-flow__node.selected')?.dataset.id, beforeCancelSelection)
    const savedPosition = renderedPosition(app.host.querySelector(`.react-flow__node[data-id="${id}"]`))
    await app.remountAt('#/map')
    assert.deepEqual(renderedPosition(app.host.querySelector(`.react-flow__node[data-id="${id}"]`)), savedPosition)
    assert.deepEqual(savedMap(window).positions[id], automatic)
  } finally {
    await app.close()
  }
})

test('successful layout saves preserve consecutive moves on different nodes', async () => {
  const app = await createHarness()
  const storagePrototype = Object.getPrototypeOf(app.dom.window.localStorage)
  const originalDescriptor = Object.getOwnPropertyDescriptor(storagePrototype, 'setItem')
  const originalSet = storagePrototype.setItem
  let mapWriteCount = 0
  try {
    const { window } = app.dom
    Object.defineProperty(storagePrototype, 'setItem', {
      configurable: true,
      writable: true,
      value: function (key, value) {
        if (key === MAP_STATE_KEY) mapWriteCount += 1
        return originalSet.call(this, key, value)
      },
    })
    await click(linkFor(app.host, '学習マップ'))
    const defaults = Object.fromEntries(createMapPocGraph().nodes.map(({ id, position }) => [id, position]))
    const firstId = 'descriptive-statistics'
    const secondId = 'math-arithmetic'

    await click(buttonFor(app.host, '配置編集'))
    await click(app.host.querySelector(`.react-flow__node[data-id="${firstId}"]`))
    let node = app.host.querySelector(`.react-flow__node[data-id="${firstId}"]`)
    node.focus()
    await pressKey(window, node, 'ArrowRight')
    assert.equal(mapWriteCount, 1)
    assert.equal(Object.keys(savedMap(window).positions).length, 34)
    assert.deepEqual(savedMap(window).positions[firstId], { x: defaults[firstId].x + 5, y: defaults[firstId].y })
    assert.deepEqual(savedMap(window).positions[secondId], defaults[secondId])

    await click(app.host.querySelector(`.react-flow__node[data-id="${secondId}"]`))
    node = app.host.querySelector(`.react-flow__node[data-id="${secondId}"]`)
    node.focus()
    await pressKey(window, node, 'ArrowRight')
    const expected = Object.fromEntries(Object.entries(defaults).map(([id, position]) => [id, { ...position }]))
    expected[firstId].x += 5
    expected[secondId].x += 5
    assert.equal(mapWriteCount, 2)
    assert.deepEqual(savedMap(window).positions, expected)
  } finally {
    if (originalDescriptor) Object.defineProperty(storagePrototype, 'setItem', originalDescriptor)
    await app.close()
  }
})

test('failed layout save restores the last confirmed position before the next keyboard move', async () => {
  const app = await createHarness()
  const storagePrototype = Object.getPrototypeOf(app.dom.window.localStorage)
  const originalDescriptor = Object.getOwnPropertyDescriptor(storagePrototype, 'setItem')
  const originalSet = storagePrototype.setItem
  let failMapWrite = true
  try {
    const { window } = app.dom
    Object.defineProperty(storagePrototype, 'setItem', {
      configurable: true,
      writable: true,
      value: function (key, value) {
        if (key === MAP_STATE_KEY && failMapWrite) {
          failMapWrite = false
          throw new Error('quota')
        }
        return originalSet.call(this, key, value)
      },
    })
    await click(linkFor(app.host, '学習マップ'))
    const id = 'descriptive-statistics'
    const originalPosition = createMapPocGraph().nodes.find((candidate) => candidate.id === id).position
    await click(app.host.querySelector(`.react-flow__node[data-id="${id}"]`))
    await click(buttonFor(app.host, '配置編集'))
    let node = app.host.querySelector(`.react-flow__node[data-id="${id}"]`)
    node.focus()
    const original = renderedPosition(node)
    await pressKey(window, node, 'ArrowRight')
    assert.deepEqual(renderedPosition(app.host.querySelector(`.react-flow__node[data-id="${id}"]`)), original)
    assert.equal(window.localStorage.getItem(MAP_STATE_KEY), null)
    assert.match(app.host.querySelector('.map-route-messages').textContent, /保存できませんでした/u)

    node = app.host.querySelector(`.react-flow__node[data-id="${id}"]`)
    node.focus()
    await pressKey(window, node, 'ArrowRight')
    assert.deepEqual(savedMap(window).positions[id], { x: originalPosition.x + 5, y: originalPosition.y })
  } finally {
    if (originalDescriptor) Object.defineProperty(storagePrototype, 'setItem', originalDescriptor)
    await app.close()
  }
})

test('layout conflict adopts external positions immediately and keeps them in the next save', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    await click(linkFor(app.host, '学習マップ'))
    const defaults = createMapPocGraph().nodes
    const external = createInitialMapState(lessonRegistry)
    external.positions = Object.fromEntries(defaults.map(({ id, position }) => [id, {
      x: position.x + 30,
      y: position.y - 20,
    }]))
    saveMapState(external, null, lessonRegistry, () => window.localStorage)
    const firstId = 'descriptive-statistics'
    const stylesBefore = Object.fromEntries([...app.host.querySelectorAll('.react-flow__node')]
      .map((node) => [node.dataset.id, node.style.transform]))
    await click(app.host.querySelector(`.react-flow__node[data-id="${firstId}"]`))
    await click(buttonFor(app.host, '配置編集'))
    let selected = app.host.querySelector(`.react-flow__node[data-id="${firstId}"]`)
    selected.focus()
    const viewportBefore = app.host.querySelector('.react-flow__viewport').style.transform
    await pressKey(window, selected, 'ArrowRight')
    assert.deepEqual(savedMap(window).positions, external.positions)
    for (const id of Object.keys(external.positions)) {
      assert.notEqual(app.host.querySelector(`.react-flow__node[data-id="${id}"]`).style.transform, stylesBefore[id])
    }
    assert.equal(app.host.querySelector('.react-flow__node.selected')?.dataset.id, firstId)
    assert.equal(app.host.querySelector('.react-flow__viewport').style.transform, viewportBefore)

    const secondId = 'math-arithmetic'
    await click(app.host.querySelector(`.react-flow__node[data-id="${secondId}"]`))
    selected = app.host.querySelector(`.react-flow__node[data-id="${secondId}"]`)
    selected.focus()
    await pressKey(window, selected, 'ArrowRight')
    const finalPositions = savedMap(window).positions
    assert.equal(Object.keys(finalPositions).length, 34)
    for (const [id, position] of Object.entries(external.positions)) {
      assert.deepEqual(finalPositions[id], id === secondId ? { ...position, x: position.x + 5 } : position)
    }
  } finally {
    await app.close()
  }
})

test('normal map-state refresh synchronizes externally changed coordinates without fitting the viewport', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    await click(linkFor(app.host, '学習マップ'))
    const id = 'descriptive-statistics'
    await click(app.host.querySelector(`.react-flow__node[data-id="${id}"]`))
    const stylesBefore = Object.fromEntries([...app.host.querySelectorAll('.react-flow__node')]
      .map((node) => [node.dataset.id, node.style.transform]))
    const viewportBefore = app.host.querySelector('.react-flow__viewport').style.transform
    const external = createInitialMapState(lessonRegistry)
    external.positions = Object.fromEntries(createMapPocGraph().nodes.map(({ id: lessonId, position }) => [lessonId, {
      x: position.x + 24,
      y: position.y - 16,
    }]))
    saveMapState(external, null, lessonRegistry, () => window.localStorage)

    await click(buttonFor(app.host.querySelector('.lesson-detail-card'), 'Start'))
    await settleEffects(window)
    assert.deepEqual(savedMap(window).positions, external.positions)
    for (const lessonId of Object.keys(external.positions)) {
      assert.notEqual(app.host.querySelector(`.react-flow__node[data-id="${lessonId}"]`).style.transform, stylesBefore[lessonId])
    }
    assert.equal(app.host.querySelector('.react-flow__node.selected')?.dataset.id, id)
    assert.equal(app.host.querySelector('.react-flow__viewport').style.transform, viewportBefore)

    const positionStyles = Object.fromEntries([...app.host.querySelectorAll('.react-flow__node')]
      .map((node) => [node.dataset.id, node.style.transform]))
    await click(app.host.querySelector('.lesson-detail-card input[type="checkbox"]'))
    assert.deepEqual(savedMap(window).positions, external.positions)
    for (const lessonId of Object.keys(external.positions)) {
      assert.equal(app.host.querySelector(`.react-flow__node[data-id="${lessonId}"]`).style.transform, positionStyles[lessonId])
    }
  } finally {
    await app.close()
  }
})

test('invalid map-state disables layout editing and preserves the damaged raw', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    const damaged = '{"schemaVersion":1,"positions":{"descriptive-statistics":{"x":1e999,"y":0}}}'
    window.localStorage.setItem(MAP_STATE_KEY, damaged)
    await app.remountAt('#/map')
    assert.equal(buttonFor(app.host, '配置編集').disabled, true)
    assert.equal(buttonFor(app.host, 'Re-layout').disabled, true)
    assert.equal(window.localStorage.getItem(MAP_STATE_KEY), damaged)
    assert.equal(app.host.querySelectorAll('.react-flow__node').length, 34)
  } finally {
    await app.close()
  }
})

test('integrated learning map Shift-click clears the selected node', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    await click(linkFor(app.host, '学習マップ'))
    const lessonNode = [...app.host.querySelectorAll('.react-flow__node')]
      .find((node) => node.textContent.includes('基本統計量'))
    await click(lessonNode)
    assert.equal(app.host.querySelectorAll('.react-flow__node.selected').length, 1)

    await act(async () => {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Shift', code: 'ShiftLeft', bubbles: true }))
      lessonNode.dispatchEvent(new window.MouseEvent('click', { bubbles: true, shiftKey: true }))
      window.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'Shift', code: 'ShiftLeft', bubbles: true }))
    })

    assert.equal(app.host.querySelectorAll('.react-flow__node.selected').length, 0)
    assert.equal(app.host.querySelector('.map-selection').textContent, '選択中: なし')
  } finally {
    await app.close()
  }
})
