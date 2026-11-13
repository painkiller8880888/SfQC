import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { act, createElement, StrictMode } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { serializeLearningBackup } from '../src/backup.mjs'
import { createMapPocGraph } from '../src/map-poc-graph.mjs'
import { lessonDomainColors, lessonDomains } from '../src/lesson-contract.mjs'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import {
  generateDescriptiveStatisticsPreviewExercise,
  previewExerciseDefinitions,
} from '../src/descriptive-statistics-preview-exercises.mjs'
import { generateDescriptiveStatisticsExercisePreviewQuestion } from '../src/descriptive-statistics-exercise-preview-data.mjs'
import { LEARNING_STATE_KEY, readLearningState, serializeLearningState } from '../src/learning-state.mjs'
import { PRACTICE_RESULTS_KEY } from '../src/practice-results.mjs'

const THEME_STORAGE_KEY = 'sfqc:theme-preference'
const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)'
const LOCAL_DATA_KEY = 'sfqc:local-data'
const MAP_STATE_KEY = 'sfqc:map-state:v1'

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

function installMatchMedia(window, initialTheme = 'light', available = true, listenersAvailable = true) {
  let systemTheme = initialTheme
  const listeners = new Set()
  const mediaQuery = {
    media: THEME_MEDIA_QUERY,
    onchange: null,
    get matches() { return systemTheme === 'dark' },
  }
  if (listenersAvailable) Object.assign(mediaQuery, {
    addEventListener(type, listener) {
      if (type === 'change') listeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'change') listeners.delete(listener)
    },
    addListener(listener) { listeners.add(listener) },
    removeListener(listener) { listeners.delete(listener) },
  })
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

async function createHarness({ strict = false, confirm = () => true, measureFlowNodes = false, systemTheme = 'light', supportsMatchMedia = true, supportsMatchMediaListeners = true } = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://sfqc.test/SfQC/#/course/descriptive-statistics/practice',
    pretendToBeVisual: true,
  })
  const previousGlobals = new Map(globalKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const previousMetrics = new Map(['offsetWidth', 'offsetHeight'].map((key) => [
    key, Object.getOwnPropertyDescriptor(dom.window.HTMLElement.prototype, key),
  ]))
  const media = installMatchMedia(dom.window, systemTheme, supportsMatchMedia, supportsMatchMediaListeners)
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
  dom.window.scrollBy = () => {}
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  if (measureFlowNodes) Object.defineProperty(dom.window, 'DOMMatrixReadOnly', {
    configurable: true,
    value: class {
      constructor(transform) {
        this.m22 = Number(/scale\(\s*([-+.\deE]+)/u.exec(transform ?? '')?.[1] ?? 1)
      }
    },
  })
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

async function submitWrongIndependentJudgement(app, window) {
  await app.remountAt('#/course/descriptive-statistics/practice')
  const card = app.host.querySelector('.ds-practice-question[data-practice-category="0"]')
  const question = generateDescriptiveStatisticsExercisePreviewQuestion(
    0, Number(card.dataset.practiceType), Number(card.dataset.practiceSeed),
  )
  if (question.type === 'choice') {
    const wrongIndex = question.answer === 0 ? 1 : 0
    await click(card.querySelector(`input[type="radio"][value="${wrongIndex}"]`))
  } else {
    await changeTextInput(window, card.querySelector('input[type="text"]'), String(Number(question.answer) + 1))
  }
  await act(async () => card.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
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
  return readLearningState(lessonRegistry, () => window.localStorage).state
}

test('initial app load repairs a retired v1 history state from the current URL', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    const routeHash = '#/course/descriptive-statistics/lesson/variance'
    const route = { kind: 'course-lesson', courseId: 'descriptive-statistics', sectionId: 'variance' }
    const legacyState = {
      version: 1, routeHash, route, entryId: 'legacy-entry', draft: 'old answer', scrollY: 400,
      resumeAttemptId: 'old-attempt', returnStack: [],
    }
    await app.unmount()
    window.history.replaceState(legacyState, '', window.location.pathname + routeHash)
    await app.remount()
    await settleEffects(window)

    assert.equal(window.location.hash, routeHash)
    assert.equal(window.history.state.version, 2)
    assert.deepEqual(Object.keys(window.history.state).sort(), [
      'entryId', 'returnStack', 'route', 'routeHash', 'scrollY', 'version',
    ])
    assert.equal(window.history.state.scrollY, 0)
    assert.equal(app.host.querySelectorAll('.course-section').length, 4)
    assert.match(app.host.textContent, /URLの復帰情報は利用できないため/u)
  } finally {
    await app.close()
  }
})

test('pre-render theme bootstrap honors saved choices and falls back to the system theme', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  const script = /<script>\s*([\s\S]*?)\s*<\/script>/u.exec(html)?.[1]
  assert.ok(script)
  const resolveTheme = ({ savedPreference = null, systemTheme = 'light', storageThrows = false, matchMediaAvailable = true } = {}) => {
    const document = { documentElement: { dataset: {} } }
    const window = {
      localStorage: {
        getItem(key) {
          assert.equal(key, THEME_STORAGE_KEY)
          if (storageThrows) throw new Error('storage unavailable')
          return savedPreference
        },
      },
      matchMedia(query) {
        assert.equal(query, THEME_MEDIA_QUERY)
        if (!matchMediaAvailable) throw new Error('matchMedia unavailable')
        return { matches: systemTheme === 'dark' }
      },
    }
    runInNewContext(script, { document, window })
    return document.documentElement.dataset.theme
  }

  assert.equal(resolveTheme({ systemTheme: 'dark' }), 'dark')
  assert.equal(resolveTheme({ savedPreference: 'light', systemTheme: 'dark' }), 'light')
  assert.equal(resolveTheme({ storageThrows: true, systemTheme: 'dark' }), 'dark')
  assert.equal(resolveTheme({ storageThrows: true, matchMediaAvailable: false }), 'light')
  assert.equal(resolveTheme({ savedPreference: 'sepia', systemTheme: 'dark' }), 'dark')

  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
  assert.match(css, /:root\[data-theme="dark"\]/u)
  assert.match(css, /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme\]\)/u)
})

test('theme follows the system, saves manual choices, and stays separate from learning data', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    const themeSelect = () => app.host.querySelector('#theme-preference')
    const theme = () => app.host.querySelector('.app-shell').dataset.theme
    const documentTheme = () => window.document.documentElement.dataset.theme
    const localDataBefore = window.localStorage.getItem('sfqc:local-data')
    const mapStateBefore = window.localStorage.getItem(MAP_STATE_KEY)
    assert.equal(themeSelect().value, 'system')
    assert.equal(theme(), 'light')
    assert.equal(documentTheme(), 'light')
    assert.equal(app.mediaListenerCount, 1)
    await click(linkFor(app.host, '学習マップ'))
    await settleEffects(window)
    const routeBefore = window.location.hash
    assert.ok(app.host.querySelector('.react-flow').classList.contains('light'))

    await app.setSystemTheme('dark')
    assert.equal(theme(), 'dark')
    assert.equal(documentTheme(), 'dark')
    assert.ok(app.host.querySelector('.react-flow').classList.contains('dark'))
    await changeControl(window, themeSelect(), 'light')
    assert.equal(theme(), 'light')
    assert.equal(documentTheme(), 'light')
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
    assert.equal(documentTheme(), 'dark')
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
    assert.equal(documentTheme(), 'light')
    assert.ok(app.host.querySelector('.react-flow').classList.contains('light'))
    assert.equal(app.mediaListenerCount, 1)
    await app.setSystemTheme('dark')
    assert.equal(theme(), 'dark')
    assert.equal(documentTheme(), 'dark')
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

test('system theme reads matchMedia even when its change listener APIs are unavailable', async () => {
  const app = await createHarness({ systemTheme: 'dark', supportsMatchMediaListeners: false })
  try {
    assert.equal(app.host.querySelector('#theme-preference').value, 'system')
    assert.equal(app.host.querySelector('.app-shell').dataset.theme, 'dark')
    assert.equal(app.dom.window.document.documentElement.dataset.theme, 'dark')
    assert.equal(app.mediaListenerCount, 0)
  } finally {
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
    assert.equal(linkFor(detail, '解説を読む')?.getAttribute('href'), '#/course/descriptive-statistics/lesson/mean')
    assert.equal(linkFor(detail, '演習問題一覧を開く')?.getAttribute('href'), '#/course/descriptive-statistics/practice')
    assert.equal(linkFor(detail, '進捗を見る')?.getAttribute('href'), '#/progress')

    await click(linkFor(detail, '演習問題一覧を開く'))
    assert.equal(app.dom.window.location.hash, '#/course/descriptive-statistics/practice')
    assert.equal(app.host.querySelectorAll('.ds-practice-question').length, 5)
    await click(linkFor(app.host, '学習マップ'))
    assert.equal(app.host.querySelector('.react-flow__node.selected')?.dataset.id, 'descriptive-statistics')
    assert.ok(app.host.querySelector('.lesson-detail-card'))

    await click(linkFor(app.host.querySelector('.lesson-detail-card'), '解説を読む'))
    assert.equal(app.dom.window.location.hash, '#/course/descriptive-statistics/lesson/mean')
    assert.match(app.host.querySelector('.lesson-panel').textContent, /量的データの平均/u)
    await click(linkFor(app.host, '学習マップ'))
    assert.ok(app.host.querySelector('.lesson-detail-card'))

    await click(linkFor(app.host.querySelector('.lesson-detail-card'), '進捗を見る'))
    assert.equal(app.dom.window.location.hash, '#/progress')
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

    assert.equal(buttonFor(app.host.querySelector('.lesson-detail-card'), 'Mark completed'), undefined)
    assert.match(app.host.querySelector('.lesson-detail-card .manual-progress-notice').textContent, /教材未収録のため完了登録できません/u)
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
    assert.equal(selected.getAttribute('aria-label'), '基本統計量（分野：データ・記述統計、正答率未記録、正答数/試行数 0/0回、手動進捗：未開始）')
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
    const mathFoundationColor = app.host.querySelector('.map-author-color-fields input[type="color"]')
    assert.equal(mathFoundationColor.value, lessonDomainColors['math-foundations'])
    assert.equal(mapLayout().style.getPropertyValue('--map-author-domain-math-foundations'), mathFoundationColor.value)
    await changeControl(window, mathFoundationColor, '#000000')
    assert.equal(mapLayout().style.getPropertyValue('--map-author-domain-math-foundations'), '#000000')
    await changeControl(window, mathFoundationColor, lessonDomainColors['math-foundations'])
    assert.equal(mapLayout().style.getPropertyValue('--map-author-domain-math-foundations'), lessonDomainColors['math-foundations'])
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
    assert.equal(nodeFor('descriptive-statistics').getAttribute('aria-label'), '基本統計量（分野：品質管理手法、正答率未記録、正答数/試行数 0/0回、手動進捗：未開始、選択中）')
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
    assert.ok(node)
    const nodes = [...app.host.querySelectorAll('.react-flow__node')]
    assert.equal(nodes.length, lessonRegistry.lessons.length)
    assert.ok(nodes.every((item) => item.getAttribute('tabindex') === '0'))
    const nodeHelp = app.host.querySelector('[id^="react-flow__node-desc-"]')
    assert.match(nodeHelp.textContent, /EnterまたはSpace/u)
    assert.match(nodeHelp.textContent, /Escape/u)
    assert.doesNotMatch(nodeHelp.textContent, /矢印キー|Delete|削除/u)
    assert.equal(app.host.querySelector('.react-flow__controls').getAttribute('aria-label'), 'グラフ操作')
    assert.equal(app.host.querySelector('.react-flow__controls-zoomin').getAttribute('aria-label'), '拡大')
    assert.equal(app.host.querySelector('.react-flow__controls-zoomout').getAttribute('aria-label'), '縮小')
    assert.equal(app.host.querySelector('.react-flow__controls-fitview').getAttribute('aria-label'), 'グラフ全体を表示')
    node.focus()
    await pressKey(window, node, 'Enter')
    assert.equal(app.host.querySelectorAll('.react-flow__node.selected').length, 1)
    assert.equal(window.document.activeElement, app.host.querySelector('.lesson-detail-header h2'))
    assert.match(app.host.querySelector('.lesson-detail-card').textContent, /未収録/u)
    assert.match(app.host.querySelector('.lesson-detail-card').textContent, /方法条件付き必須/u)
    assert.doesNotMatch(app.host.querySelector('.lesson-detail-card').innerHTML, /href="#\/lesson\/mean-inference/u)
    assert.equal(linkFor(app.host.querySelector('.lesson-detail-card'), '演習問題一覧を開く'), undefined)

    await pressKey(window, node, ' ')
    assert.equal(window.document.activeElement, app.host.querySelector('.lesson-detail-header h2'))

    await click(buttonFor(app.host.querySelector('.lesson-detail-card'), '閉じる'))
    await settleEffects(window)
    assert.equal(app.host.querySelectorAll('.react-flow__node.selected').length, 0)
    assert.equal(window.document.activeElement, app.host.querySelector('.react-flow__node[data-id="mean-inference"]'))

    const keyboardNode = app.host.querySelector('.react-flow__node[data-id="mean-inference"]')
    keyboardNode.focus()
    await pressKey(window, keyboardNode, 'Enter')
    const escapeEvent = await pressKey(window, app.host.querySelector('.lesson-detail-header h2'), 'Escape')
    await settleEffects(window)
    assert.equal(escapeEvent.defaultPrevented, true)
    assert.equal(app.host.querySelectorAll('.react-flow__node.selected').length, 0)
    assert.equal(window.document.activeElement, app.host.querySelector('.react-flow__node[data-id="mean-inference"]'))

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
    await escapeFrom(() => linkFor(app.host.querySelector('.lesson-detail-card'), '進捗を見る'))
    await escapeFrom(() => buttonFor(app.host, 'Re-layout'))
    await escapeFrom(() => buttonFor(app.host, 'マップ表示'))

    await click(buttonFor(app.host, '配置編集'))
    assert.match(nodeHelp.textContent, /矢印キー/u)
    await click(buttonFor(app.host, '配置編集'))

    await click(app.host.querySelector('.react-flow__node[data-id="mean-inference"]'))
    await click(buttonFor(app.host, '閉じる'))
    assert.equal(app.host.querySelectorAll('.react-flow__node.selected').length, 0)
    assert.equal(window.document.activeElement, buttonFor(app.host, '全体表示'))

    keyboardNode.focus()
    await pressKey(window, keyboardNode, 'Enter')
    const pointerReselectedNode = app.host.querySelector('.react-flow__node[data-id="descriptive-statistics"]')
    await click(pointerReselectedNode)
    assert.equal(app.host.querySelector('.react-flow__node.selected')?.dataset.id, 'descriptive-statistics')
    await click(buttonFor(app.host.querySelector('.lesson-detail-card'), '閉じる'))
    await settleEffects(window)
    assert.equal(app.host.querySelectorAll('.react-flow__node.selected').length, 0)
    assert.equal(window.document.activeElement, buttonFor(app.host, '全体表示'))
    assert.notEqual(window.document.activeElement, keyboardNode)
  } finally {
    await app.close()
  }
})

test('integrated learning map keeps keyboard and fallback focus visible without scrolling on pointer open', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    let pageScrollY = 100
    let headingDocumentY = 120
    let fitViewDocumentY = 120
    const scrollCalls = []
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 240 })
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => pageScrollY })
    window.scrollBy = (options) => {
      scrollCalls.push(options)
      pageScrollY += options.top
    }
    await click(linkFor(app.host, '学習マップ'))
    const header = app.host.querySelector('.site-header')
    const fitViewButton = buttonFor(app.host, '全体表示')
    header.style.position = 'sticky'
    const originalGetBoundingClientRect = window.HTMLElement.prototype.getBoundingClientRect
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value() {
        if (this === header) return { top: 0, right: 320, bottom: 76, left: 0, width: 320, height: 76 }
        if (this === fitViewButton) {
          const top = fitViewDocumentY - pageScrollY
          return { top, right: 120, bottom: top + 40, left: 0, width: 120, height: 40 }
        }
        if (this.matches('.lesson-detail-header h2')) {
          const top = headingDocumentY - pageScrollY
          return { top, right: 300, bottom: top + 24, left: 0, width: 300, height: 24 }
        }
        if (this.classList?.contains('react-flow__node')) {
          const top = 330 - pageScrollY
          return { top, right: 180, bottom: top + 60, left: 0, width: 180, height: 60 }
        }
        return originalGetBoundingClientRect.call(this)
      },
    })
    const settleFocusFrames = () => act(async () => new Promise((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))
    }))

    const node = app.host.querySelector('.react-flow__node[data-id="mean-inference"]')
    node.focus()
    await pressKey(window, node, 'Enter')
    await settleFocusFrames()
    const heading = app.host.querySelector('.lesson-detail-header h2')
    assert.equal(window.document.activeElement, heading)
    assert.equal(pageScrollY, 36, 'keyboard opening scrolls the heading below the sticky header')
    assert.equal(heading.getBoundingClientRect().top, 84)

    await click(buttonFor(app.host.querySelector('.lesson-detail-card'), '閉じる'))
    await settleFocusFrames()
    assert.equal(window.document.activeElement, node)
    assert.equal(pageScrollY, 158, 'keyboard close scrolls the restored node into the page viewport')
    assert.equal(node.getBoundingClientRect().bottom, 232)

    pageScrollY = 100
    headingDocumentY = 500
    scrollCalls.length = 0
    await click(node)
    assert.equal(scrollCalls.length, 0, 'pointer selection does not scroll the page to the card heading')
    assert.equal(pageScrollY, 100)
    assert.equal(app.host.querySelector('.lesson-detail-header h2').getBoundingClientRect().top, 400)
    await click(buttonFor(app.host.querySelector('.lesson-detail-card'), '閉じる'))
    await settleFocusFrames()
    assert.equal(window.document.activeElement, fitViewButton)
    assert.equal(pageScrollY, 36, 'pointer close scrolls the fallback focus below the sticky header')
    assert.equal(fitViewButton.getBoundingClientRect().top, 84)
    assert.deepEqual(scrollCalls, [{ top: -64, behavior: 'instant' }])
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
    assert.equal(window.document.activeElement, app.host.querySelector('.react-flow__node[data-id="descriptive-statistics"]'))

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
    assert.equal(window.document.activeElement, buttonFor(app.host, '教材一覧'))

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
    const state = readLearningState(lessonRegistry, () => window.localStorage).state
    state.positions = positions
    window.localStorage.setItem(LEARNING_STATE_KEY, serializeLearningState(state))
    const rawBaseline = window.localStorage.getItem(LEARNING_STATE_KEY)

    await app.remountAt('#/map')
    await settleEffects(window)
    assert.deepEqual(renderedPosition(app.host.querySelector(`.react-flow__node[data-id="${nodeId}"]`)), confirmedPosition)

    Object.defineProperty(storagePrototype, 'setItem', {
      configurable: true,
      writable: true,
      value: function (key, value) {
        if (key === LEARNING_STATE_KEY) mapWriteCount += 1
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
    assert.equal(window.localStorage.getItem(LEARNING_STATE_KEY), rawBaseline)
    assert.equal(mapWriteCount, 0)

    await dispatchReactFlowMouseEvent(window, window, 'mousemove', dragOrigin[0], dragOrigin[1], 1)
    await settleEffects(window)
    assert.deepEqual(renderedPosition(app.host.querySelector(`.react-flow__node[data-id="${nodeId}"]`)), confirmedPosition)
    assert.equal(window.localStorage.getItem(LEARNING_STATE_KEY), rawBaseline)
    assert.equal(mapWriteCount, 0)

    await dispatchReactFlowMouseEvent(window, window, 'mouseup', dragOrigin[0], dragOrigin[1], 0)
    await settleEffects(window)
    assert.deepEqual(renderedPosition(app.host.querySelector(`.react-flow__node[data-id="${nodeId}"]`)), confirmedPosition)
    assert.deepEqual(savedMap(window).positions, positions)
    assert.equal(window.localStorage.getItem(LEARNING_STATE_KEY), rawBaseline)
    assert.equal(mapWriteCount, 0)

    const zeroNode = app.host.querySelector(`.react-flow__node[data-id="${nodeId}"]`)
    await dispatchReactFlowMouseEvent(window, zeroNode, 'mousedown', startX, startY, 1)
    await dispatchReactFlowMouseEvent(window, window, 'mousemove', startX, startY, 1)
    await dispatchReactFlowMouseEvent(window, window, 'mouseup', startX, startY, 0)
    await settleEffects(window)
    assert.deepEqual(renderedPosition(app.host.querySelector(`.react-flow__node[data-id="${nodeId}"]`)), confirmedPosition)
    assert.equal(window.localStorage.getItem(LEARNING_STATE_KEY), rawBaseline)
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
    assert.equal(window.localStorage.getItem(LEARNING_STATE_KEY), null)

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
    const rawAfterMoves = window.localStorage.getItem(LEARNING_STATE_KEY)
    await click(buttonFor(app.host, '全体表示'))
    await settleEffects(window)
    assert.equal(window.localStorage.getItem(LEARNING_STATE_KEY), rawAfterMoves)

    window.confirm = () => false
    const beforeCancelPosition = renderedPosition(app.host.querySelector(`.react-flow__node[data-id="${id}"]`))
    const beforeCancelViewport = app.host.querySelector('.react-flow__viewport').style.transform
    const beforeCancelSelection = app.host.querySelector('.react-flow__node.selected')?.dataset.id
    await click(buttonFor(app.host, 'Re-layout'))
    assert.equal(window.localStorage.getItem(LEARNING_STATE_KEY), rawAfterMoves)
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
        if (key === LEARNING_STATE_KEY) mapWriteCount += 1
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

test('failed layout save retains the target change for explicit retry', async () => {
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
        if (key === LEARNING_STATE_KEY && failMapWrite) {
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
    assert.equal(window.localStorage.getItem(LEARNING_STATE_KEY), null)
    assert.match(app.host.querySelector('.map-route-messages').textContent, /保存できませんでした/u)
    await click(buttonFor(app.host.querySelector('.practice-recovery'), '未保存の変更を再試行'))
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
    const external = readLearningState(lessonRegistry, () => window.localStorage).state
    external.positions = Object.fromEntries(defaults.map(({ id, position }) => [id, {
      x: position.x + 30,
      y: position.y - 20,
    }]))
    window.localStorage.setItem(LEARNING_STATE_KEY, serializeLearningState(external))
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

    await click(buttonFor(app.host.querySelector('.practice-recovery'), '未保存の変更を再試行'))
    const afterFirstRetry = savedMap(window).positions
    assert.equal(Object.keys(afterFirstRetry).length, 34)
    await click(buttonFor(app.host, '配置編集'))

    const secondId = 'math-arithmetic'
    await click(app.host.querySelector(`.react-flow__node[data-id="${secondId}"]`))
    selected = app.host.querySelector(`.react-flow__node[data-id="${secondId}"]`)
    selected.focus()
    await pressKey(window, selected, 'ArrowRight')
    const finalPositions = savedMap(window).positions
    assert.equal(Object.keys(finalPositions).length, 34)
    for (const [id, position] of Object.entries(external.positions)) {
      assert.deepEqual(finalPositions[id], id === secondId ? { ...position, x: position.x + 5 }
        : id === firstId ? afterFirstRetry[id] : position)
    }
  } finally {
    await app.close()
  }
})

test('manual completion detects an external learning-state update and keeps its map positions', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    await click(linkFor(app.host, '学習マップ'))
    const id = 'descriptive-statistics'
    await click(app.host.querySelector(`.react-flow__node[data-id="${id}"]`))
    const stylesBefore = Object.fromEntries([...app.host.querySelectorAll('.react-flow__node')]
      .map((node) => [node.dataset.id, node.style.transform]))
    const viewportBefore = app.host.querySelector('.react-flow__viewport').style.transform
    const external = readLearningState(lessonRegistry, () => window.localStorage).state
    external.positions = Object.fromEntries(createMapPocGraph().nodes.map(({ id: lessonId, position }) => [lessonId, {
      x: position.x + 24,
      y: position.y - 16,
    }]))
    window.localStorage.setItem(LEARNING_STATE_KEY, serializeLearningState(external))

    await click(buttonFor(app.host.querySelector('.lesson-detail-card'), 'Mark completed'))
    await settleEffects(window)
    assert.deepEqual(savedMap(window).positions, external.positions)
    for (const lessonId of Object.keys(external.positions)) {
      assert.notEqual(app.host.querySelector(`.react-flow__node[data-id="${lessonId}"]`).style.transform, stylesBefore[lessonId])
    }
    assert.equal(app.host.querySelector('.react-flow__node.selected')?.dataset.id, id)
    assert.equal(app.host.querySelector('.react-flow__viewport').style.transform, viewportBefore)

    await click(buttonFor(app.host.querySelector('.practice-recovery'), '未保存の変更を再試行'))
    assert.deepEqual(savedMap(window).positions, external.positions)
    assert.ok(savedMap(window).lessons[id].completedAt)
  } finally {
    await app.close()
  }
})

test('unknown manual save keeps its candidate, blocks restore, and confirms it after repeated read failures', async () => {
  let confirmations = 0
  const app = await createHarness({ confirm: () => { confirmations += 1; return true } })
  const { window } = app.dom
  const previousGet = window.Storage.prototype.getItem
  const previousSet = window.Storage.prototype.setItem
  let writeCompleted = false
  let unreadableReads = 2
  let learningWriteCount = 0
  window.Storage.prototype.setItem = function (key, value) {
    if (key === LEARNING_STATE_KEY) {
      learningWriteCount += 1
      writeCompleted = true
    }
    return previousSet.call(this, key, value)
  }
  window.Storage.prototype.getItem = function (key) {
    if (key === LEARNING_STATE_KEY && writeCompleted && unreadableReads > 0) {
      unreadableReads -= 1
      throw new Error('temporary learning-state read failure')
    }
    return previousGet.call(this, key)
  }
  try {
    await click(linkFor(app.host, '学習マップ'))
    await click(app.host.querySelector('.react-flow__node[data-id="descriptive-statistics"]'))
    await click(buttonFor(app.host.querySelector('.lesson-detail-card'), 'Mark completed'))
    assert.match(app.host.textContent, /手動進捗の変更をメモリ上に保持/u)
    assert.match(app.host.textContent, /再読み込みすると失われます/u)
    const unloadEvent = new window.Event('beforeunload', { cancelable: true })
    await act(async () => window.dispatchEvent(unloadEvent))
    assert.equal(unloadEvent.defaultPrevented, true, 'warn before the in-memory candidate can be lost')
    assert.equal(learningWriteCount, 1)
    const candidateRaw = previousGet.call(window.localStorage, LEARNING_STATE_KEY)
    assert.ok(JSON.parse(candidateRaw).lessons['descriptive-statistics'].completedAt)

    await click(linkFor(app.host, 'データ管理'))
    const fileInput = app.host.querySelector('#backup-file')
    assert.equal(fileInput.disabled, true)
    const backup = serializeLearningBackup(
      { schemaVersion: 1, lessons: {}, positions: {} }, { schemaVersion: 1, records: [] },
    )
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new window.File([backup], 'backup.json', { type: 'application/json' })],
    })
    await act(async () => fileInput.dispatchEvent(new window.Event('change', { bubbles: true })))
    assert.match(app.host.querySelector('.data-message').textContent, /保存状態を確認してから、バックアップを復元/u)
    assert.equal(confirmations, 0)
    assert.equal(learningWriteCount, 1)

    await click(buttonFor(app.host.querySelector('.practice-recovery'), '手動進捗の保存状態を再確認'))
    assert.match(app.host.textContent, /再確認を続けてください/u)
    assert.equal(learningWriteCount, 1)
    await click(buttonFor(app.host.querySelector('.practice-recovery'), '手動進捗の保存状態を再確認'))
    assert.equal(app.host.querySelector('.practice-recovery'), null)
    assert.equal(learningWriteCount, 1, 'a matching candidate is confirmed without being applied twice')
    assert.equal(previousGet.call(window.localStorage, LEARNING_STATE_KEY), candidateRaw)
    assert.ok(savedMap(window).lessons['descriptive-statistics'].completedAt)
  } finally {
    window.Storage.prototype.getItem = previousGet
    window.Storage.prototype.setItem = previousSet
    await app.close()
  }
})

test('unknown layout save rebases the retained node change after mismatch and can be retried', async () => {
  const app = await createHarness()
  const { window } = app.dom
  const previousGet = window.Storage.prototype.getItem
  const previousSet = window.Storage.prototype.setItem
  const initial = readLearningState(lessonRegistry, () => window.localStorage).state
  const external = { ...initial, positions: { 'external-layout': { x: 900, y: 800 } } }
  const externalRaw = serializeLearningState(external)
  let redirectWrite = true
  let externalWasWritten = false
  let hideFirstConfirmationRead = false
  let learningWriteCount = 0
  window.Storage.prototype.setItem = function (key, value) {
    if (key === LEARNING_STATE_KEY) {
      learningWriteCount += 1
      if (redirectWrite) {
        redirectWrite = false
        externalWasWritten = true
        return previousSet.call(this, key, externalRaw)
      }
    }
    return previousSet.call(this, key, value)
  }
  window.Storage.prototype.getItem = function (key) {
    if (key === LEARNING_STATE_KEY && externalWasWritten && hideFirstConfirmationRead) {
      hideFirstConfirmationRead = false
      throw new Error('temporary learning-state read failure')
    }
    return previousGet.call(this, key)
  }
  try {
    await click(linkFor(app.host, '学習マップ'))
    const id = 'descriptive-statistics'
    const originalPosition = createMapPocGraph().nodes.find((candidate) => candidate.id === id).position
    await click(app.host.querySelector(`.react-flow__node[data-id="${id}"]`))
    await click(buttonFor(app.host, '配置編集'))
    const node = app.host.querySelector(`.react-flow__node[data-id="${id}"]`)
    node.focus()
    hideFirstConfirmationRead = true
    await pressKey(window, node, 'ArrowRight')
    assert.equal(learningWriteCount, 1)
    assert.equal(previousGet.call(window.localStorage, LEARNING_STATE_KEY), externalRaw)
    assert.match(app.host.textContent, /変更をメモリ上に保持/u)

    await click(linkFor(app.host, 'データ管理'))
    await click(buttonFor(app.host.querySelector('.practice-recovery'), '手動進捗の保存状態を再確認'))
    assert.ok(buttonFor(app.host.querySelector('.practice-recovery'), '未保存の変更を再試行'))
    assert.equal(previousGet.call(window.localStorage, LEARNING_STATE_KEY), externalRaw,
      'recheck should not overwrite the newer external state')

    await click(buttonFor(app.host.querySelector('.practice-recovery'), '未保存の変更を再試行'))
    assert.equal(learningWriteCount, 2)
    const saved = readLearningState(lessonRegistry, () => window.localStorage)
    assert.equal(saved.status, 'ok')
    assert.deepEqual(saved.state.positions['external-layout'], { x: 900, y: 800 })
    assert.deepEqual(saved.state.positions[id], { x: originalPosition.x + 5, y: originalPosition.y },
      'retry applies the retained node delta once onto the latest map state')
    assert.equal(app.host.querySelector('.practice-recovery'), null)
  } finally {
    window.Storage.prototype.getItem = previousGet
    window.Storage.prototype.setItem = previousSet
    await app.close()
  }
})

test('invalid map-state disables layout editing and preserves the damaged raw', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    const damaged = '{"schemaVersion":1,"positions":{"descriptive-statistics":{"x":1e999,"y":0}}}'
    window.localStorage.setItem(LEARNING_STATE_KEY, damaged)
    await app.remountAt('#/map')
    assert.equal(buttonFor(app.host, '配置編集').disabled, true)
    assert.equal(buttonFor(app.host, 'Re-layout').disabled, true)
    assert.equal(window.localStorage.getItem(LEARNING_STATE_KEY), damaged)
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





test('published basic statistics figures remain interactive without saving measurement changes', async () => {
  const app = await createHarness()
  const { window } = app.dom
  const localRaw = 'retired local-data sentinel'
  const mapRaw = 'retired map-state sentinel'
  window.localStorage.setItem(LOCAL_DATA_KEY, localRaw)
  window.localStorage.setItem(MAP_STATE_KEY, mapRaw)
  const writeCalls = []
  const storagePrototype = Object.getPrototypeOf(window.localStorage)
  const setDescriptor = Object.getOwnPropertyDescriptor(storagePrototype, 'setItem')
  const removeDescriptor = Object.getOwnPropertyDescriptor(storagePrototype, 'removeItem')
  Object.defineProperty(storagePrototype, 'setItem', {
    ...setDescriptor,
    value(key, value) {
      if (key === LOCAL_DATA_KEY || key === MAP_STATE_KEY) writeCalls.push(['setItem', key])
      return setDescriptor.value.call(this, key, value)
    },
  })
  Object.defineProperty(storagePrototype, 'removeItem', {
    ...removeDescriptor,
    value(key) {
      if (key === LOCAL_DATA_KEY || key === MAP_STATE_KEY) writeCalls.push(['removeItem', key])
      return removeDescriptor.value.call(this, key)
    },
  })

  try {
    await app.remountAt('#/course/descriptive-statistics/lesson/mean')
    const figures = [...app.host.querySelectorAll('.interactive-variance-comparison')]
    assert.deepEqual(figures.map((figure) => figure.dataset.figureMode), ['mean', 'deviation', 'variance', 'sd'])
    const figure = (mode) => figures.find((item) => item.dataset.figureMode === mode)
    const point = (mode, series, index) => figure(mode).querySelector(`[data-k="${series}${index}"]`)
    const values = (mode) => [...figure(mode).querySelectorAll('[role="slider"]')].map((slider) => slider.getAttribute('aria-valuenow'))
    const rowValue = (mode, row, series) => figure(mode).querySelectorAll('tbody tr')[row].querySelectorAll('td')[series === 'A' ? 0 : 1].textContent

    for (const item of figures) {
      const sliders = [...item.querySelectorAll('[role="slider"]')]
      assert.equal(sliders.length, 6)
      assert.ok(sliders.every((slider) => slider.tabIndex === 0))
      assert.ok(sliders.every((slider) => slider.getAttribute('aria-valuemin') === '96' && slider.getAttribute('aria-valuemax') === '104'))
    }
    assert.deepEqual(values('mean'), ['98', '100', '102', '99', '100', '101'])
    assert.equal(rowValue('mean', 1, 'A'), '100')
    assert.equal(rowValue('mean', 1, 'B'), '100')
    assert.equal(rowValue('deviation', 1, 'A'), '−2, 0, +2')
    assert.equal(rowValue('variance', 1, 'A'), '8')
    assert.equal(rowValue('variance', 2, 'A'), '4')
    assert.equal(rowValue('sd', 2, 'A'), '2')
    assert.equal(rowValue('variance', 1, 'B'), '2')
    assert.equal(rowValue('variance', 2, 'B'), '1')
    assert.equal(rowValue('sd', 2, 'B'), '1')

    await act(async () => point('mean', 'A', 0).dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })))
    assert.equal(point('mean', 'A', 0).getAttribute('aria-valuenow'), '99')
    assert.equal(rowValue('mean', 1, 'A'), '100.33')
    assert.equal(point('deviation', 'A', 0).getAttribute('aria-valuenow'), '98', 'each section keeps its own figure state')
    await act(async () => point('mean', 'A', 0).dispatchEvent(new window.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })))
    assert.equal(point('mean', 'A', 0).getAttribute('aria-valuenow'), '104')
    await act(async () => point('mean', 'A', 0).dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })))
    assert.equal(point('mean', 'A', 0).getAttribute('aria-valuenow'), '96')
    await click(figure('mean').querySelector('.ivc-reset'))
    assert.deepEqual(values('mean'), ['98', '100', '102', '99', '100', '101'])

    const meanSvg = figure('mean').querySelector('svg')
    const chartWidth = Number(meanSvg.getAttribute('viewBox').split(' ')[2])
    const padding = chartWidth < 480 ? 22 : 32
    const pixelPerMm = (chartWidth - 2 * padding) / 8
    Object.defineProperty(meanSvg, 'getBoundingClientRect', { value: () => ({ left: 0, width: chartWidth }) })
    const draggedPoint = point('mean', 'A', 0)
    const dispatchPointer = (type, clientX) => meanSvg.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX }))
    await act(async () => {
      draggedPoint.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: padding + (98 - 96) * pixelPerMm }))
      dispatchPointer('pointermove', padding + (101 - 96) * pixelPerMm)
      dispatchPointer('pointerup', padding + (101 - 96) * pixelPerMm)
    })
    assert.equal(point('mean', 'A', 0).getAttribute('aria-valuenow'), '101')
    await click(figure('mean').querySelector('.ivc-reset'))
    assert.equal(draggedPoint.getAttribute('aria-valuenow'), '98')

    const simulation = app.host.querySelector('.ivc-simulation')
    assert.ok(simulation)
    assert.match(simulation.textContent, /全部で 125 通り/u)
    assert.match(simulation.textContent, /n で割った場合は 1\.33/u)
    assert.match(simulation.textContent, /n − 1 で割った場合は 2\.00/u)
    assert.equal(simulation.querySelector('.ivc-bar').getAttribute('aria-valuemax'), '4')
    assert.equal(simulation.querySelector('.ivc-simulation-last').textContent, 'まだ取り出していません。')
    const [oneDraw, oneHundred, reset] = simulation.querySelectorAll('.ivc-simulation-actions button')
    await click(oneDraw)
    assert.match(simulation.querySelector('.ivc-simulation-last').textContent, /1 回の平均を表示中/u)
    assert.ok([...simulation.querySelectorAll('.ivc-bar')].some((bar) => Number(bar.getAttribute('aria-valuenow')) > 0),
      'one sampled result should increment its distribution bin')
    await click(oneHundred)
    assert.match(simulation.querySelector('.ivc-simulation-last').textContent, /101 回取り出した平均/u)
    await click(reset)
    assert.equal(simulation.querySelector('.ivc-simulation-last').textContent, 'まだ取り出していません。')
    assert.ok([...simulation.querySelectorAll('.ivc-bar')].every((bar) => bar.getAttribute('aria-valuenow') === '0'))

    assert.equal(window.localStorage.getItem(LOCAL_DATA_KEY), localRaw)
    assert.equal(window.localStorage.getItem(MAP_STATE_KEY), mapRaw)
    assert.deepEqual(writeCalls, [])
  } finally {
    if (setDescriptor) Object.defineProperty(storagePrototype, 'setItem', setDescriptor)
    else delete storagePrototype.setItem
    if (removeDescriptor) Object.defineProperty(storagePrototype, 'removeItem', removeDescriptor)
    else delete storagePrototype.removeItem
    await app.close()
  }
})



test('section checks stay local while independent judgments and manual completion remain separate', async () => {
  const app = await createHarness()
  const { window } = app.dom
  const legacyRaw = 'leave legacy storage untouched'
  const mapRaw = 'leave retired map-state untouched'
  window.localStorage.setItem(LOCAL_DATA_KEY, legacyRaw)
  window.localStorage.setItem(MAP_STATE_KEY, mapRaw)
  const previousGet = window.Storage.prototype.getItem
  const previousSet = window.Storage.prototype.setItem
  const previousRemove = window.Storage.prototype.removeItem
  const legacyCalls = []
  const trackLegacy = (operation, key) => {
    if (key === LOCAL_DATA_KEY || key === MAP_STATE_KEY) legacyCalls.push([operation, key])
  }
  window.Storage.prototype.getItem = function (key) {
    trackLegacy('getItem', key)
    return previousGet.call(this, key)
  }
  window.Storage.prototype.setItem = function (key, value) {
    trackLegacy('setItem', key)
    return previousSet.call(this, key, value)
  }
  window.Storage.prototype.removeItem = function (key) {
    trackLegacy('removeItem', key)
    return previousRemove.call(this, key)
  }

  try {
    await app.remountAt('#/course/descriptive-statistics/lesson/mean')
    assert.equal(app.host.querySelectorAll('.course-section').length, 4)
    assert.equal(app.host.querySelectorAll('.course-inline-exercise').length, 4)
    assert.ok(app.host.querySelector('.interactive-variance-comparison'))
    assert.equal(window.localStorage.getItem(PRACTICE_RESULTS_KEY), null)

    const exercise = app.host.querySelector('.course-inline-exercise')
    const input = exercise.querySelector('input')
    await act(async () => exercise.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(window.localStorage.getItem(PRACTICE_RESULTS_KEY), null, 'invalid input must not create a judgment')

    const expected = generateDescriptiveStatisticsPreviewExercise('mean', previewExerciseDefinitions.mean.initialIndex).answers[0]
    assert.equal(typeof expected, 'string')
    await changeTextInput(window, input, '0' + expected)
    await act(async () => exercise.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.match(exercise.querySelector('[role="status"]').textContent, /入力形式/u)
    assert.equal(window.localStorage.getItem(PRACTICE_RESULTS_KEY), null, 'invalid input must not create a judgment')
    await changeTextInput(window, input, '10 1')
    await act(async () => exercise.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.match(exercise.querySelector('[role="status"]').textContent, /入力形式/u)
    assert.equal(window.localStorage.getItem(PRACTICE_RESULTS_KEY), null, 'internal whitespace must not be deleted')

    for (const [answer, feedback] of [['１０１', /正解/u], ['101.4', /正解/u], ['101.5', /違います/u]]) {
      await changeTextInput(window, input, answer)
      await act(async () => exercise.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
      assert.match(exercise.querySelector('[role="status"]').textContent, feedback)
      assert.equal(window.localStorage.getItem(PRACTICE_RESULTS_KEY), null,
        'section confirmation questions never enter independent practice history')
    }

    await click(linkFor(app.host, '学習マップ'))
    await click(app.host.querySelector('.react-flow__node[data-id="descriptive-statistics"]'))
    await click(buttonFor(app.host, 'Mark completed'))
    const learning = readLearningState(undefined, () => window.localStorage)
    assert.equal(learning.status, 'ok')
    assert.ok(learning.state.lessons['descriptive-statistics'].completedAt)
    assert.deepEqual(learning.state.positions, {})
    assert.equal(previousGet.call(window.localStorage, LOCAL_DATA_KEY), legacyRaw)
    assert.equal(previousGet.call(window.localStorage, MAP_STATE_KEY), mapRaw)
    assert.deepEqual(legacyCalls, [])
  } finally {
    window.Storage.prototype.getItem = previousGet
    window.Storage.prototype.setItem = previousSet
    window.Storage.prototype.removeItem = previousRemove
    await app.close()
  }
})

test('unknown judgment writes block backup restore until a recheck confirms the saved record', async () => {
  let confirmations = 0
  const app = await createHarness({ confirm: () => { confirmations += 1; return true } })
  const { window } = app.dom
  const previousGet = window.Storage.prototype.getItem
  const previousSet = window.Storage.prototype.setItem
  let practiceWasWritten = false
  let failPostWriteRead = true
  window.Storage.prototype.setItem = function (key, value) {
    const result = previousSet.call(this, key, value)
    if (key === PRACTICE_RESULTS_KEY) practiceWasWritten = true
    return result
  }
  window.Storage.prototype.getItem = function (key) {
    if (key === PRACTICE_RESULTS_KEY && practiceWasWritten && failPostWriteRead) {
      failPostWriteRead = false
      throw new Error('temporary read failure')
    }
    return previousGet.call(this, key)
  }
  try {
    await submitWrongIndependentJudgement(app, window)
    assert.match(app.host.textContent, /保存結果未確認/u)
    assert.equal(JSON.parse(previousGet.call(window.localStorage, PRACTICE_RESULTS_KEY)).records.length, 1)

    await click(linkFor(app.host, 'データ管理'))
    const inputFile = app.host.querySelector('#backup-file')
    Object.defineProperty(inputFile, 'files', { configurable: true, value: [new window.File(['{}'], 'backup.json')] })
    await act(async () => inputFile.dispatchEvent(new window.Event('change', { bubbles: true })))
    assert.match(app.host.querySelector('.data-message').textContent, /未保存判定の保存状態を再確認/u)
    assert.equal(confirmations, 0)

    await click(buttonFor(app.host.querySelector('.practice-recovery'), '保存状態を再確認'))
    assert.doesNotMatch(app.host.textContent, /保存結果未確認/u)
    assert.equal(JSON.parse(previousGet.call(window.localStorage, PRACTICE_RESULTS_KEY)).records.length, 1)
    assert.equal(confirmations, 0, 'the ambiguous append is rechecked and never imported again')
  } finally {
    window.Storage.prototype.getItem = previousGet
    window.Storage.prototype.setItem = previousSet
    await app.close()
  }
})

test('backup export warns about unsaved judgments and restore explicitly retains them', async () => {
  const app = await createHarness()
  const { window } = app.dom
  const previousSet = window.Storage.prototype.setItem
  let failPracticeWrite = true
  window.Storage.prototype.setItem = function (key, value) {
    if (key === PRACTICE_RESULTS_KEY && failPracticeWrite) {
      failPracticeWrite = false
      throw new Error('quota')
    }
    return previousSet.call(this, key, value)
  }
  try {
    await submitWrongIndependentJudgement(app, window)
    window.Storage.prototype.setItem = previousSet

    await click(linkFor(app.host, 'データ管理'))
    assert.match(app.host.textContent, /このバックアップには未保存の判定1件が含まれません/u)
    assert.equal(buttonFor(app.host, '全データを書き出し').disabled, false)

    const backup = serializeLearningBackup(
      { schemaVersion: 1, lessons: {}, positions: {} },
      { schemaVersion: 1, records: [] },
    )
    const fileInput = app.host.querySelector('#backup-file')
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new window.File([backup], 'learning-backup.json', { type: 'application/json' })],
    })
    await act(async () => fileInput.dispatchEvent(new window.Event('change', { bubbles: true })))
    assert.match(app.host.querySelector('.data-message').textContent, /未保存の判定は候補として保持しました/u)
    assert.match(app.host.textContent, /未保存の判定1件/u)
    assert.equal(JSON.parse(window.localStorage.getItem(PRACTICE_RESULTS_KEY)).records.length, 0)
  } finally {
    window.Storage.prototype.setItem = previousSet
    await app.close()
  }
})

test('backup restore can explicitly discard unsaved judgments after a second confirmation', async () => {
  const confirmations = []
  const answers = [false, true, true]
  const app = await createHarness({ confirm: (message) => {
    confirmations.push(message)
    return answers.shift() ?? false
  } })
  const { window } = app.dom
  const previousSet = window.Storage.prototype.setItem
  let failPracticeWrite = true
  window.Storage.prototype.setItem = function (key, value) {
    if (key === PRACTICE_RESULTS_KEY && failPracticeWrite) {
      failPracticeWrite = false
      throw new Error('quota')
    }
    return previousSet.call(this, key, value)
  }
  try {
    await submitWrongIndependentJudgement(app, window)
    window.Storage.prototype.setItem = previousSet
    await click(linkFor(app.host, 'データ管理'))

    const backup = serializeLearningBackup({ schemaVersion: 1, lessons: {}, positions: {} }, { schemaVersion: 1, records: [] })
    const fileInput = app.host.querySelector('#backup-file')
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new window.File([backup], 'learning-backup.json', { type: 'application/json' })],
    })
    await act(async () => fileInput.dispatchEvent(new window.Event('change', { bubbles: true })))
    assert.equal(confirmations.length, 3)
    assert.match(confirmations[0], /復元後も候補として保持/u)
    assert.match(confirmations[1], /破棄してバックアップを復元/u)
    assert.match(confirmations[2], /新形式のバックアップ/u)
    assert.doesNotMatch(app.host.querySelector('.data-message').textContent, /候補として保持/u)
    assert.doesNotMatch(app.host.textContent, /未保存の判定1件/u)
    assert.equal(JSON.parse(window.localStorage.getItem(PRACTICE_RESULTS_KEY)).records.length, 0)
  } finally {
    window.Storage.prototype.setItem = previousSet
    await app.close()
  }
})

test('course practice presents five categories, records one valid judgment, and keeps lesson review links', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    window.HTMLElement.prototype.scrollIntoView = () => {}
    await app.remountAt('#/course/descriptive-statistics/practice')
    const cards = [...app.host.querySelectorAll('.ds-practice-question')]
    assert.equal(cards.length, 5)

    const card = cards[0]
    const categoryIndex = Number(card.dataset.practiceCategory)
    const question = generateDescriptiveStatisticsExercisePreviewQuestion(
      categoryIndex, Number(card.dataset.practiceType), Number(card.dataset.practiceSeed),
    )
    assert.deepEqual([...card.querySelectorAll('.ds-practice-question-heading a')].map((link) => link.href.split('#')[1]),
      question.sections.map((sectionId) => `/course/descriptive-statistics/lesson/${sectionId}`))
    assert.ok([...card.querySelectorAll('.ds-practice-question-heading a')].every((link) => link.dataset.navIntent === 'review'),
      'a lesson link from a course exercise must focus the section and allow returning to the exercise')

    const submit = card.querySelector('form')
    await act(async () => submit.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(window.localStorage.getItem(PRACTICE_RESULTS_KEY), null,
      'an empty numeric answer or unselected choice must not consume the first grade')

    if (question.type === 'choice') {
      const wrongIndex = question.answer === 0 ? 1 : 0
      await click(card.querySelector(`input[type="radio"][value="${wrongIndex}"]`))
    } else {
      await changeTextInput(window, card.querySelector('input[type="text"]'), String(Number(question.answer) + 1))
    }
    await act(async () => submit.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.match(card.querySelector('.ds-exercise-feedback').textContent, /違います/u)
    const saved = JSON.parse(window.localStorage.getItem(PRACTICE_RESULTS_KEY))
    assert.equal(saved.records.length, 1)
    assert.equal(saved.records[0].categoryId, ['mean-deviation', 'data-transformation', 'unbiased-variance', 'comprehensive', 'variance-standard-deviation'][categoryIndex])
    assert.equal(saved.records[0].isCorrect, false)
    assert.match(saved.records[0].attemptedAt, /^\d{4}-\d{2}-\d{2}T/u)

    await act(async () => submit.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(JSON.parse(window.localStorage.getItem(PRACTICE_RESULTS_KEY)).records.length, 1,
      'grading the same generated question again must not append another judgment')

    const otherQuestions = cards.slice(1).map((item) => [item.dataset.practiceType, item.dataset.practiceSeed])
    await click(buttonFor(card, 'この問題を入れ替える'))
    const regenerated = app.host.querySelector('.ds-practice-question[data-practice-category="0"]')
    assert.equal(regenerated.querySelector('.ds-exercise-feedback').textContent, '')
    assert.deepEqual([...app.host.querySelectorAll('.ds-practice-question')].slice(1)
      .map((item) => [item.dataset.practiceType, item.dataset.practiceSeed]), otherQuestions)

    await click(regenerated.querySelector('.ds-practice-question-heading a'))
    await settleEffects(window)
    assert.match(window.location.hash, /^#\/course\/descriptive-statistics\/lesson\//u)
    assert.equal(window.document.activeElement.id,
      `course-section-${window.location.hash.split('/').at(-1)}`,
      'the lesson link must focus its referenced section')
    assert.ok(app.host.querySelector('.return-navigation a[data-nav-intent="return"]'),
      'the referenced lesson must offer a route back to the independent exercise')
    await click(app.host.querySelector('.return-navigation a[data-nav-intent="return"]'))
    await settleEffects(window)
    assert.equal(window.location.hash, '#/course/descriptive-statistics/practice')
    assert.equal(JSON.parse(window.localStorage.getItem(PRACTICE_RESULTS_KEY)).records.length, 1,
      'returning from lesson review must keep the saved first judgment')

    await click(linkFor(app.host, '進捗'))
    const categoryRows = [...app.host.querySelectorAll('.progress-subsection li')]
    assert.equal(categoryRows.length, 5)
    assert.match(categoryRows[0].textContent, /0\/1回 · 正答率 0%/u)
    assert.equal(categoryRows.slice(1).filter((row) => /記録なし（0回）/u.test(row.textContent)).length, 4)
    assert.match(app.host.querySelector('.progress-card').textContent, /未完了/u,
      'answering a question must not mark the lesson manually complete')
  } finally {
    await app.close()
  }
})

test('independent numeric practice uses strict decimal grading and saves only the first valid judgment', async () => {
  const app = await createHarness()
  const { window } = app.dom
  const originalRandom = Math.random
  const randomValues = [0.1, 1 / 2 ** 32, 0.4, 21 / 2 ** 32]
  Math.random = () => randomValues.shift() ?? 0.2
  try {
    await app.remountAt('#/course/descriptive-statistics/practice')
    const card = app.host.querySelector('.ds-practice-question[data-practice-category="1"]')
    assert.equal(card.dataset.practiceType, '1')
    assert.equal(card.dataset.practiceSeed, '21')
    const question = generateDescriptiveStatisticsExercisePreviewQuestion(1, 1, 21)
    assert.equal(question.answer, '12')
    const input = card.querySelector('input[type="text"]')
    const submit = card.querySelector('form')

    for (const invalid of ['012', '1 2']) {
      await changeTextInput(window, input, invalid)
      await act(async () => submit.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
      assert.match(card.querySelector('.ds-exercise-feedback').textContent, /入力形式/u)
      assert.equal(window.localStorage.getItem(PRACTICE_RESULTS_KEY), null, `${invalid} is invalid and must not be saved`)
    }

    await changeTextInput(window, input, '１２')
    await act(async () => submit.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.match(card.querySelector('.ds-exercise-feedback').textContent, /正解/u)
    const firstSaved = JSON.parse(window.localStorage.getItem(PRACTICE_RESULTS_KEY))
    assert.equal(firstSaved.records.length, 1)
    assert.equal(firstSaved.records[0].isCorrect, true)

    await changeTextInput(window, input, '12.4')
    await act(async () => submit.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.match(card.querySelector('.ds-exercise-feedback').textContent, /正解/u)
    assert.equal(JSON.parse(window.localStorage.getItem(PRACTICE_RESULTS_KEY)).records.length, 1)

    await changeTextInput(window, input, '12.5')
    await act(async () => submit.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.match(card.querySelector('.ds-exercise-feedback').textContent, /違います/u)
    assert.equal(JSON.parse(window.localStorage.getItem(PRACTICE_RESULTS_KEY)).records.length, 1)
  } finally {
    Math.random = originalRandom
    await app.close()
  }
})

test('progress view toggles between map order and stable lowest-accuracy order', async () => {
  const app = await createHarness()
  try {
    app.dom.window.localStorage.setItem(PRACTICE_RESULTS_KEY, JSON.stringify({ schemaVersion: 1, records: [
      { categoryId: 'mean-deviation', isCorrect: false, attemptedAt: '2026-11-13T00:00:00.000Z' },
      { categoryId: 'data-transformation', isCorrect: true, attemptedAt: '2026-11-13T00:01:00.000Z' },
    ] }))
    await app.remountAt('#/progress')
    const rows = () => [...app.host.querySelectorAll('.progress-subsection li')].map((row) => row.textContent)
    const mapOrder = rows()
    assert.match(mapOrder[0], /^平均と偏差/u)
    assert.match(mapOrder[1], /^データの変換/u)
    assert.equal(buttonFor(app.host, '学習マップ順').getAttribute('aria-pressed'), 'true')

    await click(buttonFor(app.host, '正答率の低い順'))
    assert.equal(buttonFor(app.host, '正答率の低い順').getAttribute('aria-pressed'), 'true')
    const lowOrder = rows()
    assert.match(lowOrder[0], /^平均と偏差：0\/1回 · 正答率 0%/u)
    assert.match(lowOrder[1], /^データの変換：1\/1回 · 正答率 100%/u)
    assert.deepEqual(lowOrder.slice(2).map((row) => row.split('：')[0]), ['不偏分散', '総合', '分散と標準偏差'])

    await click(buttonFor(app.host, '学習マップ順'))
    assert.deepEqual(rows(), mapOrder)
  } finally {
    await app.close()
  }
})

test('course section links update the hash and browser back and forward restore the active section', async () => {
  const app = await createHarness()
  try {
    const { window } = app.dom
    window.HTMLElement.prototype.scrollIntoView = () => {}
    await app.remountAt('#/course/descriptive-statistics/lesson/mean')
    const deviationLink = app.host.querySelector('.course-section-nav a[href="#/course/descriptive-statistics/lesson/deviation"]')
    await click(deviationLink)
    await settleEffects(window)
    assert.equal(window.location.hash, '#/course/descriptive-statistics/lesson/deviation')
    assert.equal(window.document.activeElement, app.host.querySelector('#course-section-deviation'))

    await waitForHistory(window, 'back')
    assert.equal(window.location.hash, '#/course/descriptive-statistics/lesson/mean')
    assert.ok(app.host.querySelector('#course-section-mean'))
    await waitForHistory(window, 'forward')
    assert.equal(window.location.hash, '#/course/descriptive-statistics/lesson/deviation')
    assert.ok(app.host.querySelector('#course-section-deviation'))
  } finally {
    await app.close()
  }
})

test('map layout saves to learning-state and leaves retired local data keys untouched', async () => {
  const app = await createHarness()
  const { window } = app.dom
  const legacyLocal = 'legacy local-data sentinel'
  const legacyMap = 'legacy map-state sentinel'
  window.localStorage.setItem(LOCAL_DATA_KEY, legacyLocal)
  window.localStorage.setItem(MAP_STATE_KEY, legacyMap)
  const previousGet = window.Storage.prototype.getItem
  const previousSet = window.Storage.prototype.setItem
  const previousRemove = window.Storage.prototype.removeItem
  const legacyCalls = []
  const track = (operation, key) => {
    if (key === LOCAL_DATA_KEY || key === MAP_STATE_KEY) legacyCalls.push([operation, key])
  }
  window.Storage.prototype.getItem = function (key) { track('getItem', key); return previousGet.call(this, key) }
  window.Storage.prototype.setItem = function (key, value) { track('setItem', key); return previousSet.call(this, key, value) }
  window.Storage.prototype.removeItem = function (key) { track('removeItem', key); return previousRemove.call(this, key) }
  try {
    await app.remountAt('#/map')
    await click(buttonFor(app.host, '配置編集'))
    const id = 'descriptive-statistics'
    await click(app.host.querySelector(`.react-flow__node[data-id="${id}"]`))
    const node = app.host.querySelector(`.react-flow__node[data-id="${id}"]`)
    node.focus()
    await pressKey(window, node, 'ArrowRight')

    const state = readLearningState(lessonRegistry, () => window.localStorage)
    assert.equal(state.status, 'ok')
    assert.equal(Object.keys(state.state.positions).length, lessonRegistry.lessons.length)
    const initial = createMapPocGraph().nodes.find((item) => item.id === id).position
    assert.deepEqual(state.state.positions[id], { x: initial.x + 5, y: initial.y })
    assert.equal(previousGet.call(window.localStorage, LOCAL_DATA_KEY), legacyLocal)
    assert.equal(previousGet.call(window.localStorage, MAP_STATE_KEY), legacyMap)
    assert.deepEqual(legacyCalls, [])
  } finally {
    window.Storage.prototype.getItem = previousGet
    window.Storage.prototype.setItem = previousSet
    window.Storage.prototype.removeItem = previousRemove
    await app.close()
  }
})
