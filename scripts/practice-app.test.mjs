import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { act, createElement, StrictMode } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { serializeLearningBackup } from '../src/backup.mjs'
import { deriveLessonGraph } from '../src/lesson-graph.mjs'
import { lessonDomainColors, lessonDomains } from '../src/lesson-contract.mjs'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import {
  generateDescriptiveStatisticsPreviewExercise,
  previewExerciseDefinitions,
} from '../src/descriptive-statistics-preview-exercises.mjs'
import { generateDescriptiveStatisticsExercisePreviewQuestion } from '../src/descriptive-statistics-exercise-preview-data.mjs'
import { LEARNING_STATE_KEY, readLearningState, serializeLearningState } from '../src/learning-state.mjs'
import { PRACTICE_RESULTS_KEY, serializePracticeResults } from '../src/practice-results.mjs'
import { lessonRegistryFixture } from './lesson-contract.fixture.mjs'

const THEME_STORAGE_KEY = 'sfqc:theme-preference'
const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)'
const LOCAL_DATA_KEY = 'sfqc:local-data'
const MAP_STATE_KEY = 'sfqc:map-state:v1'

const globalKeys = [
  'window', 'document', 'navigator', 'Element', 'HTMLElement', 'Node', 'Event', 'MouseEvent',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'IS_REACT_ACT_ENVIRONMENT',
]

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

function createAppTestServer() {
  return createServer({
    configFile: 'vite.config.ts',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
}

async function createHarness({
  strict = false,
  confirm = () => true,
  systemTheme = 'light',
  supportsMatchMedia = true,
  supportsMatchMediaListeners = true,
  url = 'https://sfqc.test/SfQC/#/course/descriptive-statistics/practice',
  historyState,
  sharedServer,
  localStorageEntries = {},
  viewportWidth,
  viewportHeight,
} = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url,
    pretendToBeVisual: true,
  })
  if (viewportWidth !== undefined) Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: viewportWidth })
  if (viewportHeight !== undefined) Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: viewportHeight })
  for (const [key, value] of Object.entries(localStorageEntries)) dom.window.localStorage.setItem(key, value)
  if (historyState !== undefined) dom.window.history.replaceState(historyState, '', url)
  const previousGlobals = new Map(globalKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
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
  dom.window.confirm = confirm
  const ownsServer = sharedServer === undefined
  const server = sharedServer ?? await createAppTestServer()
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
      if (ownsServer) await server.close()
      dom.window.close()
      for (const key of globalKeys) {
        const descriptor = previousGlobals.get(key)
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete globalThis[key]
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
    await click(card.querySelectorAll('input[type="radio"]')[wrongIndex])
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

function savedMap(window) {
  return readLearningState(lessonRegistry, () => window.localStorage).state
}

const retiredLegacyRouteHashes = [
  '#/practice', '#/practice/legacy-instance', '#/feedback', '#/feedback/legacy-attempt',
  '#/lesson/descriptive-statistics',
  ...lessonRegistry.lessons.find((lesson) => lesson.lessonId === 'descriptive-statistics')
    .sections.map((section) => `#/lesson/descriptive-statistics/${section.sectionId}`),
]

const otherIncludedLessonRoutes = lessonRegistry.lessons
  .filter((lesson) => lesson.availability === 'included' && lesson.lessonId !== 'descriptive-statistics')
  .flatMap((lesson) => [
    { lesson, sectionId: null },
    ...lesson.sections.map((section) => ({ lesson, sectionId: section.sectionId })),
  ])

function testDocumentUrl(hash) {
  return `https://sfqc.test/SfQC/${hash}`
}

function retiredV1HistoryState(routeHash) {
  const [kind, id, sectionId] = routeHash.slice(2).split('/')
  const route = kind === 'practice'
    ? (id ? { kind: 'practice-id', instanceId: id } : { kind: 'practice' })
    : kind === 'feedback'
      ? (id ? { kind: 'feedback-id', attemptId: id } : { kind: 'feedback' })
      : { kind: 'lesson-id', lessonId: id, sectionId: sectionId ?? null }
  return {
    version: 1,
    routeHash,
    route,
    entryId: 'retired-v1-entry',
    draft: 'retired answer draft',
    scrollY: 400,
    resumeAttemptId: route.kind === 'practice-id' ? 'retired-attempt' : null,
    returnStack: [],
  }
}

function v2LessonHistoryState(routeHash, lesson, sectionId) {
  return {
    version: 2,
    routeHash,
    route: { kind: 'lesson-id', lessonId: lesson.lessonId, sectionId },
    entryId: `test-${lesson.lessonId}-${sectionId ?? 'overview'}`,
    scrollY: 0,
    returnStack: [],
  }
}

function assertRetiredRoute(app, routeHash) {
  const { window } = app.dom
  assert.equal(window.location.hash, routeHash)
  assert.equal(window.history.state.version, 2)
  assert.equal(window.history.state.routeHash, routeHash)
  assert.equal(window.history.state.route.kind, 'not-found')
  assert.match(app.host.querySelector('#page-title')?.textContent ?? '', /画面が見つかりません/u)
  assert.equal(app.host.querySelector('.course-section'), null)
  assert.equal(app.host.querySelector('.lesson-body'), null)
  assert.equal(app.host.querySelector('.ds-practice-question'), null)
}

function assertIncludedLessonRoute(app, lesson, sectionId) {
  const { window } = app.dom
  const routeHash = `#/lesson/${lesson.lessonId}${sectionId === null ? '' : `/${sectionId}`}`
  const section = sectionId === null ? null : lesson.sections.find((item) => item.sectionId === sectionId)
  const pageTitle = section?.title ?? lesson.title
  assert.equal(window.location.hash, routeHash)
  assert.equal(window.history.state.version, 2)
  assert.equal(window.history.state.routeHash, routeHash)
  assert.deepEqual(window.history.state.route, { kind: 'lesson-id', lessonId: lesson.lessonId, sectionId })
  assert.equal(app.host.querySelector('#page-title')?.textContent, pageTitle)
  assert.equal(window.document.title, section
    ? `${section.title} | ${lesson.title} | SfQC`
    : `${lesson.title} | SfQC`)
  assert.ok(app.host.querySelector('.lesson-panel'))
  if (lesson.overview) {
    assert.equal(app.host.querySelectorAll('.course-section').length, lesson.sections.length)
    assert.equal(app.host.querySelector('.course-section-nav [aria-current="location"]')?.textContent, section?.title)
  } else {
    assert.equal(app.host.querySelector('.lesson-body') !== null, section !== null)
    assert.equal(app.host.querySelector('.course-section'), null)
  }
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

test('retired legacy URLs stay not-found after a full document load and reload', async () => {
  const server = await createAppTestServer()
  try {
    for (const routeHash of retiredLegacyRouteHashes) {
      const initial = await createHarness({
        sharedServer: server,
        url: testDocumentUrl(routeHash),
        historyState: retiredV1HistoryState(routeHash),
      })
      let repairedHistoryState
      try {
        await settleEffects(initial.dom.window)
        assertRetiredRoute(initial, routeHash)
        repairedHistoryState = JSON.parse(JSON.stringify(initial.dom.window.history.state))
      } finally {
        await initial.close()
      }

      const reloaded = await createHarness({
        sharedServer: server,
        url: testDocumentUrl(routeHash),
        historyState: repairedHistoryState,
      })
      try {
        await settleEffects(reloaded.dom.window)
        assertRetiredRoute(reloaded, routeHash)
      } finally {
        await reloaded.close()
      }
    }
  } finally {
    await server.close()
  }
})

test('the other five included lesson overview and section URLs survive a full document reload', async () => {
  assert.equal(new Set(otherIncludedLessonRoutes.map(({ lesson }) => lesson.lessonId)).size, 5)
  const server = await createAppTestServer()
  try {
    for (const { lesson, sectionId } of otherIncludedLessonRoutes) {
      const routeHash = `#/lesson/${lesson.lessonId}${sectionId === null ? '' : `/${sectionId}`}`
      const initial = await createHarness({ sharedServer: server, url: testDocumentUrl(routeHash) })
      let historyState
      try {
        await settleEffects(initial.dom.window)
        assertIncludedLessonRoute(initial, lesson, sectionId)
        historyState = JSON.parse(JSON.stringify(initial.dom.window.history.state))
      } finally {
        await initial.close()
      }

      const reloaded = await createHarness({
        sharedServer: server,
        url: testDocumentUrl(routeHash),
        historyState,
      })
      try {
        await settleEffects(reloaded.dom.window)
        assertIncludedLessonRoute(reloaded, lesson, sectionId)
      } finally {
        await reloaded.close()
      }
    }
  } finally {
    await server.close()
  }
})

test('Back and Forward restore retired routes safely and preserve other included lesson routes', async () => {
  const server = await createAppTestServer()
  const baseHash = '#/course/descriptive-statistics/lesson/mean'
  const app = await createHarness({ sharedServer: server, url: testDocumentUrl(baseHash) })
  try {
    const { window } = app.dom
    await settleEffects(window)
    const baseState = JSON.parse(JSON.stringify(window.history.state))
    const baseUrl = window.location.pathname + baseHash
    const assertBaseRoute = () => {
      assert.equal(window.location.hash, baseHash)
      assert.equal(window.history.state.version, 2)
      assert.equal(window.history.state.route.kind, 'course-lesson')
      assert.equal(app.host.querySelector('#page-title')?.textContent, '平均')
      assert.ok(app.host.querySelector('.course-section'))
    }

    for (const routeHash of retiredLegacyRouteHashes) {
      window.history.pushState(retiredV1HistoryState(routeHash), '', window.location.pathname + routeHash)
      window.history.pushState(baseState, '', baseUrl)

      await waitForHistory(window, 'back')
      assertRetiredRoute(app, routeHash)
      await waitForHistory(window, 'forward')
      assertBaseRoute()
    }

    for (const { lesson, sectionId } of otherIncludedLessonRoutes) {
      const routeHash = `#/lesson/${lesson.lessonId}${sectionId === null ? '' : `/${sectionId}`}`
      window.history.pushState(v2LessonHistoryState(routeHash, lesson, sectionId), '', window.location.pathname + routeHash)
      window.history.pushState(baseState, '', baseUrl)

      await waitForHistory(window, 'back')
      assertIncludedLessonRoute(app, lesson, sectionId)
      await waitForHistory(window, 'forward')
      assertBaseRoute()
    }
  } finally {
    await app.close()
    await server.close()
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
    assert.equal(app.host.querySelector('.app-shell').dataset.theme, 'light')

    await app.setSystemTheme('dark')
    assert.equal(theme(), 'dark')
    assert.equal(documentTheme(), 'dark')
    assert.equal(app.host.querySelector('.app-shell').dataset.theme, 'dark')
    await changeControl(window, themeSelect(), 'light')
    assert.equal(theme(), 'light')
    assert.equal(documentTheme(), 'light')
    assert.equal(app.host.querySelector('.app-shell').dataset.theme, 'light')
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
    assert.equal(app.host.querySelector('.app-shell').dataset.theme, 'dark')
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
    assert.equal(app.host.querySelector('.app-shell').dataset.theme, 'light')
    assert.equal(app.mediaListenerCount, 1)
    await app.setSystemTheme('dark')
    assert.equal(theme(), 'dark')
    assert.equal(documentTheme(), 'dark')
    assert.equal(app.host.querySelector('.app-shell').dataset.theme, 'dark')
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

test('integrated learning map renders all registry lessons in five categories with accessible direct prerequisites', async () => {
  const app = await createHarness({ url: 'https://sfqc.test/SfQC/#/map' })
  try {
    const buttons = [...app.host.querySelectorAll('.map-lesson-button')]
    const ids = buttons.map((button) => button.dataset.lessonId)
    const graph = deriveLessonGraph(lessonRegistry)
    const columns = [...app.host.querySelectorAll('.map-domain-column')]
    assert.equal(columns.length, 5)
    assert.equal(buttons.length, 34)
    assert.equal(new Set(ids).size, 34)
    assert.deepEqual([...ids].sort(), lessonRegistry.lessons.map((lesson) => lesson.lessonId).sort())
    assert.equal(lessonRegistry.lessons.filter((lesson) => lesson.availability === 'included').length, 6)
    assert.equal(lessonRegistry.lessons.filter((lesson) => lesson.availability === 'planned').length, 28)
    assert.equal(app.host.querySelectorAll('.map-lesson-availability').length, 28)
    assert.equal(app.host.querySelector('.map-selection').textContent.includes('おすすめの学習順を示しません'), true)
    assert.equal(app.host.querySelectorAll('.map-domain-grid svg').length, 0)
    assert.equal(buttonFor(app.host, '配置編集'), undefined)
    assert.equal(buttonFor(app.host, 'Re-layout'), undefined)

    const selectedId = 'descriptive-statistics'
    await click(app.host.querySelector(`[data-lesson-id="${selectedId}"]`))
    const selected = app.host.querySelector(`[data-lesson-id="${selectedId}"]`)
    assert.equal(selected.getAttribute('aria-pressed'), 'true')
    assert.match(selected.getAttribute('aria-label'), /^基本統計量/u)
    assert.ok(app.host.querySelector('.lesson-detail-card'))
    const expectedPrerequisiteIds = graph.commonPrerequisiteEdges
      .filter((edge) => edge.target === selectedId).map((edge) => edge.source).sort()
    const highlighted = [...app.host.querySelectorAll('.map-lesson-button.is-prerequisite')]
      .map((button) => button.dataset.lessonId).sort()
    assert.deepEqual(highlighted, expectedPrerequisiteIds)
    assert.equal(app.host.querySelectorAll('.map-prerequisite-badge').length, expectedPrerequisiteIds.length)
    assert.equal(app.host.querySelectorAll('.map-mode-toggle').length, 0)
    assert.equal(app.host.querySelectorAll('.primary-nav button').length, 2)
    assert.deepEqual([...app.host.querySelector('.map-heading').children].map((element) => element.tagName), ['H1', 'P'])
    assert.match(app.host.querySelector('.map-heading p').textContent, /手動完了/u)
    for (const id of expectedPrerequisiteIds) {
      const prerequisite = app.host.querySelector(`[data-lesson-id="${id}"]`)
      assert.equal(prerequisite.getAttribute('aria-pressed'), 'false')
      const description = app.host.querySelector(`#${prerequisite.getAttribute('aria-describedby')}`)
      assert.match(description.textContent, /基本統計量/u)
      assert.match(description.textContent, /直接の共通必須前提/u)
    }

    const selectedScopeButton = buttonFor(app.host, '選択範囲')
    assert.equal(selectedScopeButton.disabled, false)
    const historyLength = app.dom.window.history.length
    await click(selectedScopeButton)
    const expectedScopeIds = ['descriptive-statistics', 'data-types', 'math-ratios-percentages', 'math-powers-roots']
    assert.deepEqual([...app.host.querySelectorAll('.map-lesson-button')].map((button) => button.dataset.lessonId).sort(), expectedScopeIds.sort())
    assert.equal(app.host.querySelector('[data-lesson-id="math-arithmetic"]'), null,
      'scope filtering excludes indirect prerequisites')
    assert.equal(buttonFor(app.host, '選択範囲').classList.contains('is-current'), true)
    assert.equal(app.dom.window.history.length, historyLength)
    assert.equal(app.dom.window.location.hash, '#/map')

    await click(buttonFor(app.host, '教材一覧'))
    assert.ok(app.host.querySelector('.map-list-content'))
    assert.equal(app.host.querySelector('.primary-nav button[aria-pressed="true"]').textContent, '教材一覧')
    await click(buttonFor(app.host, '学習マップ'))
    assert.equal(app.dom.window.location.hash, '#/map')
    assert.equal(app.host.querySelector(`[data-lesson-id="${selectedId}"]`).getAttribute('aria-pressed'), 'true')
    assert.deepEqual([...app.host.querySelectorAll('.map-lesson-button')].map((button) => button.dataset.lessonId).sort(), expectedScopeIds.sort())
    const remountedTile = app.host.querySelector(`[data-lesson-id="${selectedId}"]`)
    await click(buttonFor(app.host.querySelector('.lesson-detail-card'), '閉じる'))
    await settleEffects(app.dom.window)
    assert.equal(app.dom.window.document.activeElement, remountedTile,
      'closing detail after switching views restores focus to the selected tile')
    assert.equal(buttonFor(app.host, '選択範囲').classList.contains('is-current'), false,
      'desktop close clears selection and returns to the full map')
    assert.equal(app.host.querySelectorAll('.map-lesson-button').length, 34)

    app.host.querySelector('.map-grid-scroll').scrollTop = 220
    await click(remountedTile)
    await click(linkFor(app.host, '解説を読む'))
    assert.equal(app.dom.window.location.hash, '#/course/descriptive-statistics/lesson/mean')
    assert.equal(app.dom.window.history.state.scrollY, 0, 'the grid scroll stays separate from route window scroll')
    await waitForHistory(app.dom.window, 'back')
    await settleEffects(app.dom.window)
    assert.equal(app.dom.window.location.hash, '#/map')
    assert.equal(app.dom.window.history.state.scrollY, 0)
    const routeRemountedTile = app.host.querySelector(`[data-lesson-id="${selectedId}"]`)
    await click(buttonFor(app.host.querySelector('.lesson-detail-card'), '閉じる'))
    await settleEffects(app.dom.window)
    assert.equal(app.dom.window.document.activeElement, routeRemountedTile,
      'closing detail after returning from a lesson restores focus to the selected tile')
  } finally {
    await app.close()
  }
})

test('map, list, and detail keep manual completion independent from recent accuracy', async () => {
  const prerequisiteId = deriveLessonGraph(lessonRegistry).commonPrerequisiteEdges
    .find((edge) => edge.target === 'descriptive-statistics').source
  const learningState = serializeLearningState({ schemaVersion: 2, lessons: {
    'descriptive-statistics': { completedAt: '2026-11-14T00:00:00.000Z' },
    [prerequisiteId]: { completedAt: '2026-11-14T00:30:00.000Z' },
  } })
  const practiceResults = serializePracticeResults({ schemaVersion: 1, records: [
    { categoryId: 'mean-deviation', isCorrect: false, attemptedAt: '2026-11-14T01:00:00.000Z' },
  ] })
  const app = await createHarness({
    url: 'https://sfqc.test/SfQC/#/map',
    localStorageEntries: { [LEARNING_STATE_KEY]: learningState, [PRACTICE_RESULTS_KEY]: practiceResults },
  })
  try {
    const { host } = app
    const descriptiveTile = host.querySelector('[data-lesson-id="descriptive-statistics"]')
    assert.ok(descriptiveTile.classList.contains('is-completed'))
    assert.ok(descriptiveTile.classList.contains('has-rate'))
    assert.equal(descriptiveTile.querySelector('.map-lesson-rate strong').textContent, '0')
    assert.match(descriptiveTile.querySelector('.map-lesson-rate').textContent, /直近正答率（%）/u)
    assert.doesNotMatch(descriptiveTile.querySelector('.map-lesson-rate').textContent, /試行|回/u)
    const noRateTile = host.querySelector('[data-lesson-id="math-arithmetic"]')
    assert.ok(!noRateTile.classList.contains('has-rate'))
    assert.equal(noRateTile.querySelector('.map-lesson-rate'), null)
    assert.match(noRateTile.querySelector('.map-progress-summary').textContent, /演習成績：演習なし/u)
    assert.equal(host.querySelector('[data-lesson-id="mean-inference"] .map-lesson-rate'), null)
    assert.match(host.querySelector('[data-lesson-id="mean-inference"]').textContent, /未収録/u)
    await click(descriptiveTile)
    assert.ok(host.querySelector('[data-lesson-id="descriptive-statistics"]').classList.contains('is-selected'))
    assert.ok(host.querySelector('[data-lesson-id="descriptive-statistics"] .map-selected-badge'))
    const completedPrerequisite = host.querySelector(`[data-lesson-id="${prerequisiteId}"]`)
    assert.ok(completedPrerequisite.classList.contains('is-completed'))
    assert.ok(completedPrerequisite.classList.contains('is-prerequisite'))
    assert.ok(completedPrerequisite.querySelector('.map-prerequisite-badge'))
    assert.ok(host.querySelector('.map-legend-completed'))
    assert.ok(host.querySelector('.map-legend-selected'))
    assert.ok(host.querySelector('.map-legend-prerequisite'))

    let detail = host.querySelector('.lesson-detail-card')
    assert.match(detail.querySelector('.manual-progress-status').textContent, /完了/u)
    assert.equal(detail.querySelector('.lesson-accuracy-rate strong').textContent, '0')
    await click(buttonFor(detail, '未完了に戻す'))
    detail = host.querySelector('.lesson-detail-card')
    assert.match(detail.querySelector('.manual-progress-status').textContent, /未完了/u)
    assert.equal(detail.querySelector('.lesson-accuracy-rate strong').textContent, '0')
    await click(buttonFor(detail, '完了にする'))
    assert.equal(host.querySelector('.lesson-detail-card .lesson-accuracy-rate strong').textContent, '0')

    await click(buttonFor(host, '教材一覧'))
    const listCard = [...host.querySelectorAll('.lesson-card')]
      .find((card) => card.textContent.includes('基本統計量'))
    assert.equal(listCard.querySelector('.lesson-card-rate strong').textContent, '0')
    assert.match(listCard.querySelector('.lesson-observation').textContent, /手動進捗：完了/u)
    assert.doesNotMatch(host.querySelector('.map-list-content').textContent, /回答試行|試行数/u)
  } finally {
    await app.close()
  }
})

test('map keeps confirmed learning state when practice data cannot be read', async () => {
  const learningState = serializeLearningState({ schemaVersion: 2, lessons: {
    'descriptive-statistics': { completedAt: '2026-11-14T00:00:00.000Z' },
  } })
  const app = await createHarness({
    url: 'https://sfqc.test/SfQC/#/map',
    localStorageEntries: { [LEARNING_STATE_KEY]: learningState, [PRACTICE_RESULTS_KEY]: '{broken' },
  })
  try {
    const tile = app.host.querySelector('[data-lesson-id="descriptive-statistics"]')
    assert.match(tile.querySelector('.map-manual-status').textContent, /手動進捗：完了/u)
    assert.match(tile.querySelector('.map-progress-summary').textContent, /演習成績：集計未確認/u)
    assert.equal(tile.querySelector('.map-lesson-rate'), null)
    assert.equal(app.host.querySelector('.manual-progress-count').textContent, '手動完了 1 / 34')
    await click(tile)
    assert.match(app.host.querySelector('.lesson-detail-card .manual-progress-status').textContent, /完了/u)
    assert.match(app.host.querySelector('.lesson-detail-card .lesson-accuracy').textContent, /集計未確認/u)
  } finally {
    await app.close()
  }
})

test('map keeps recent accuracy when learning data is unconfirmed', async () => {
  const practiceResults = serializePracticeResults({ schemaVersion: 1, records: [
    { categoryId: 'mean-deviation', isCorrect: false, attemptedAt: '2026-11-14T01:00:00.000Z' },
  ] })
  const damagedLearningState = '{"schemaVersion":2,"lessons":{"descriptive-statistics":{"completedAt":"invalid"}}}'
  const app = await createHarness({
    url: 'https://sfqc.test/SfQC/#/map',
    localStorageEntries: { [LEARNING_STATE_KEY]: damagedLearningState, [PRACTICE_RESULTS_KEY]: practiceResults },
  })
  try {
    const tile = app.host.querySelector('[data-lesson-id="descriptive-statistics"]')
    assert.match(tile.querySelector('.map-manual-status').textContent, /手動進捗：未確認/u)
    assert.equal(tile.querySelector('.map-lesson-rate strong').textContent, '0')
    assert.equal(app.host.querySelector('.manual-progress-count'), null)
    await click(tile)
    const detail = app.host.querySelector('.lesson-detail-card')
    assert.match(detail.querySelector('.manual-progress-status').textContent, /未確認/u)
    assert.equal(buttonFor(detail, '完了にする'), undefined)
    assert.equal(detail.querySelector('.lesson-accuracy-rate strong').textContent, '0')
  } finally {
    await app.close()
  }
})

test('keyboard-style map selection restores tile focus below a sticky header', async () => {
  const app = await createHarness({ url: 'https://sfqc.test/SfQC/#/map' })
  const { window } = app.dom
  const originalGetBoundingClientRect = window.HTMLElement.prototype.getBoundingClientRect
  try {
    let pageScrollY = 50
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 240 })
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => pageScrollY })
    window.scrollBy = ({ top }) => { pageScrollY += top }
    const header = app.host.querySelector('.site-header')
    header.style.position = 'sticky'
    const button = app.host.querySelector('[data-lesson-id="descriptive-statistics"]')
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value() {
        if (this === header) return { top: 0, right: 320, bottom: 52, left: 0, width: 320, height: 52 }
        if (this === button) {
          const top = 90 - pageScrollY
          return { top, right: 300, bottom: top + 40, left: 0, width: 300, height: 40 }
        }
        if (this.matches('.lesson-detail-header h2')) {
          const top = 150 - pageScrollY
          return { top, right: 300, bottom: top + 24, left: 0, width: 300, height: 24 }
        }
        return originalGetBoundingClientRect.call(this)
      },
    })
    button.focus()
    await act(async () => button.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 0 })))
    await settleEffects(window)
    const heading = app.host.querySelector('#lesson-detail-title-descriptive-statistics')
    assert.equal(button.getAttribute('aria-pressed'), 'true')
    assert.equal(window.document.activeElement, heading)

    const event = await pressKey(window, heading, 'Escape')
    assert.equal(event.defaultPrevented, true)
    assert.equal(button.getAttribute('aria-pressed'), 'false')
    assert.equal(window.document.activeElement, button)
    const headerRect = header.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    assert.ok(buttonRect.top >= headerRect.bottom, 'the restored tile is below the sticky header')
    assert.ok(buttonRect.bottom <= window.innerHeight, 'the restored tile is inside the viewport')
  } finally {
    await app.close()
  }
})

test('pointer selection scrolls a mobile detail heading into the viewport', async () => {
  const app = await createHarness({ url: 'https://sfqc.test/SfQC/#/map', viewportWidth: 320, viewportHeight: 600 })
  const { window } = app.dom
  try {
    let pageScrollY = 0
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => pageScrollY })
    window.scrollBy = ({ top }) => { pageScrollY += top }
    const originalGetBoundingClientRect = window.HTMLElement.prototype.getBoundingClientRect
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value() {
        if (this.matches('.lesson-detail-header')) {
          const top = 1000 - pageScrollY
          return { top, right: 300, bottom: top + 72, left: 0, width: 300, height: 72 }
        }
        if (this.matches('.lesson-detail-header h2')) {
          const top = 1010 - pageScrollY
          return { top, right: 300, bottom: top + 24, left: 0, width: 300, height: 24 }
        }
        return originalGetBoundingClientRect.call(this)
      },
    })
    const button = app.host.querySelector('[data-lesson-id="descriptive-statistics"]')
    await act(async () => button.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 })))
    await settleEffects(window)

    const heading = app.host.querySelector('#lesson-detail-title-descriptive-statistics')
    const detailHeader = app.host.querySelector('.lesson-detail-header')
    const rect = detailHeader.getBoundingClientRect()
    assert.ok(rect.top >= 0, 'the mobile detail header is visible after pointer selection')
    assert.ok(rect.bottom <= window.innerHeight, 'the mobile detail header is inside the viewport')
    assert.ok(heading.getBoundingClientRect().top >= rect.top)
    assert.notEqual(window.document.activeElement, heading, 'pointer selection does not move keyboard focus')
    await click(buttonFor(app.host, '閉じる'))
    await settleEffects(window)
    assert.equal(app.host.querySelector('.lesson-detail-card'), null)
    assert.equal(button.getAttribute('aria-pressed'), 'true', 'mobile return keeps the current lesson selected')
    assert.equal(window.document.activeElement, button)
  } finally {
    await app.close()
  }
})

test('mobile keyboard return closes only the detail and preserves the selected scope', async () => {
  const app = await createHarness({ url: 'https://sfqc.test/SfQC/#/map', viewportWidth: 375, viewportHeight: 700 })
  const { window } = app.dom
  try {
    const tile = app.host.querySelector('[data-lesson-id="descriptive-statistics"]')
    tile.focus()
    await act(async () => tile.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 0 })))
    await settleEffects(window)
    const heading = app.host.querySelector('#lesson-detail-title-descriptive-statistics')
    assert.equal(window.document.activeElement, heading)

    const escape = await pressKey(window, heading, 'Escape')
    await settleEffects(window)
    assert.equal(escape.defaultPrevented, true)
    assert.equal(app.host.querySelector('.lesson-detail-card'), null)
    assert.equal(tile.getAttribute('aria-pressed'), 'true')
    assert.equal(window.document.activeElement, tile)

    await click(buttonFor(app.host, '選択範囲'))
    const expectedScopeIds = ['descriptive-statistics', 'data-types', 'math-ratios-percentages', 'math-powers-roots']
    assert.deepEqual([...app.host.querySelectorAll('.map-lesson-button')].map((button) => button.dataset.lessonId).sort(), expectedScopeIds.sort())
    await click(tile)
    await click(buttonFor(app.host.querySelector('.lesson-detail-card'), '閉じる'))
    assert.equal(buttonFor(app.host, '選択範囲').classList.contains('is-current'), true)
    assert.deepEqual([...app.host.querySelectorAll('.map-lesson-button')].map((button) => button.dataset.lessonId).sort(), expectedScopeIds.sort())
  } finally {
    await app.close()
  }
})

test('map detail follows the 768px breakpoint and restores focus when resizing hides its target', async () => {
  const app = await createHarness({ url: 'https://sfqc.test/SfQC/#/map', viewportWidth: 769, viewportHeight: 700 })
  const { window } = app.dom
  try {
    const tile = app.host.querySelector('[data-lesson-id="descriptive-statistics"]')
    tile.focus()
    await act(async () => tile.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 })))
    assert.equal(window.document.activeElement?.getAttribute('data-lesson-id'), 'descriptive-statistics')
    assert.equal(app.host.querySelector('.map-graph-layout').classList.contains('is-mobile-detail-open'), false)

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 768 })
    await act(async () => window.dispatchEvent(new window.Event('resize')))
    await settleEffects(window)
    assert.equal(app.host.querySelector('.map-graph-layout').classList.contains('is-mobile-detail-open'), true)
    assert.equal(window.document.activeElement?.id, 'lesson-detail-title-descriptive-statistics')

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 767 })
    await act(async () => window.dispatchEvent(new window.Event('resize')))
    assert.equal(app.host.querySelector('.map-graph-layout').classList.contains('is-mobile-detail-open'), true)

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 769 })
    await act(async () => window.dispatchEvent(new window.Event('resize')))
    assert.equal(app.host.querySelector('.map-graph-layout').classList.contains('has-detail'), true)
    assert.equal(app.host.querySelector('.map-graph-layout').classList.contains('is-mobile-detail-open'), false)
    assert.equal(window.document.activeElement?.id, 'lesson-detail-title-descriptive-statistics')
  } finally {
    await app.close()
  }
})

test('map detail prerequisite buttons select known planned lessons without leaving the map', async () => {
  const app = await createHarness({ url: 'https://sfqc.test/SfQC/#/map' })
  try {
    await click(app.host.querySelector('[data-lesson-id="mean-inference"]'))
    await click(buttonFor(app.host, '選択範囲'))
    const samplingButton = buttonFor(app.host.querySelector('.lesson-detail-card'), '標本分布')
    assert.ok(samplingButton, 'a planned prerequisite can be selected in map detail')
    assert.equal(samplingButton.tagName, 'BUTTON')
    assert.equal(app.host.querySelector('.lesson-detail-card a[href="#/lesson/sampling-distributions/common"]'), null,
      'map-only selection does not expose an unavailable lesson URL')
    await click(samplingButton)
    await settleEffects(app.dom.window)
    assert.equal(app.dom.window.location.hash, '#/map')
    assert.equal(app.host.querySelector('[data-lesson-id="sampling-distributions"]').getAttribute('aria-pressed'), 'true')
    assert.match(app.host.querySelector('.lesson-detail-card h2').textContent, /標本分布/u)
    assert.equal(buttonFor(app.host, '選択範囲').classList.contains('is-current'), true)
  } finally {
    await app.close()
  }

  const mobileApp = await createHarness({ url: 'https://sfqc.test/SfQC/#/map', viewportWidth: 320, viewportHeight: 700 })
  try {
    await click(mobileApp.host.querySelector('[data-lesson-id="mean-inference"]'))
    await click(buttonFor(mobileApp.host.querySelector('.lesson-detail-card'), '閉じる'))
    await click(buttonFor(mobileApp.host, '選択範囲'))
    await click(mobileApp.host.querySelector('[data-lesson-id="mean-inference"]'))
    await click(buttonFor(mobileApp.host.querySelector('.lesson-detail-card'), '標本分布'))
    await settleEffects(mobileApp.dom.window)
    assert.equal(mobileApp.dom.window.location.hash, '#/map')
    assert.equal(mobileApp.host.querySelector('.lesson-detail-card'), null)
    assert.equal(mobileApp.host.querySelector('[data-lesson-id="sampling-distributions"]').getAttribute('aria-pressed'), 'true')
    assert.equal(mobileApp.dom.window.document.activeElement, mobileApp.host.querySelector('[data-lesson-id="sampling-distributions"]'))
    const visibleIds = [...mobileApp.host.querySelectorAll('.map-lesson-button')].map((button) => button.dataset.lessonId).sort()
    assert.deepEqual(visibleIds, ['population-sample', 'descriptive-statistics', 'random-variables', 'sampling-distributions'].sort())
  } finally {
    await mobileApp.close()
  }
})

test('desktop prerequisite selection scrolls and focuses its card in both map scopes', async () => {
  for (const scope of ['all', 'selected']) {
    const app = await createHarness({ url: 'https://sfqc.test/SfQC/#/map', viewportWidth: 1024, viewportHeight: 600 })
    const { window } = app.dom
    const originalGetBoundingClientRect = window.HTMLElement.prototype.getBoundingClientRect
    try {
      await click(app.host.querySelector('[data-lesson-id="mean-inference"]'))
      await click(buttonFor(app.host, scope === 'all' ? '全体' : '選択範囲'))
      assert.equal(buttonFor(app.host, scope === 'all' ? '全体' : '選択範囲').classList.contains('is-current'), true)

      const grid = app.host.querySelector('.map-grid-scroll')
      Object.defineProperties(grid, {
        clientHeight: { configurable: true, value: 200 },
        scrollHeight: { configurable: true, value: 1000 },
        clientWidth: { configurable: true, value: 420 },
        scrollWidth: { configurable: true, value: 1000 },
      })
      const prerequisite = app.host.querySelector('[data-lesson-id="sampling-distributions"]')
      assert.ok(prerequisite, `${scope} scope includes the selected prerequisite card`)
      Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
        configurable: true,
        value() {
          if (this === grid) return { top: 120, right: 500, bottom: 320, left: 80, width: 420, height: 200 }
          if (this === prerequisite) {
            const top = 350 - grid.scrollTop
            const left = 520 - grid.scrollLeft
            return { top, right: left + 120, bottom: top + 40, left, width: 120, height: 40 }
          }
          return originalGetBoundingClientRect.call(this)
        },
      })

      await click(buttonFor(app.host.querySelector('.lesson-detail-card'), '標本分布'))
      await settleEffects(window)
      const gridRect = grid.getBoundingClientRect()
      const cardRect = prerequisite.getBoundingClientRect()
      assert.ok(cardRect.top >= gridRect.top && cardRect.bottom <= gridRect.bottom,
        `${scope} scope scrolls the target card into the grid viewport`)
      assert.ok(cardRect.left >= gridRect.left && cardRect.right <= gridRect.right,
        `${scope} scope scrolls the target card across into the grid viewport`)
      assert.equal(window.document.activeElement, prerequisite)
      assert.match(app.host.querySelector('.lesson-detail-card h2').textContent, /標本分布/u)
    } finally {
      Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: originalGetBoundingClientRect,
      })
      await app.close()
    }
  }
})

test('closing mobile detail restores the opening page scroll before focusing its card', async () => {
  const app = await createHarness({ url: 'https://sfqc.test/SfQC/#/map', viewportWidth: 375, viewportHeight: 600 })
  const { window } = app.dom
  const originalGetBoundingClientRect = window.HTMLElement.prototype.getBoundingClientRect
  try {
    let pageScrollY = 500
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => pageScrollY })
    window.scrollTo = (_x, y) => { pageScrollY = y }
    window.scrollBy = ({ top }) => { pageScrollY += top }
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value() {
        if (this.matches('.lesson-detail-header h2')) {
          const top = 1210 - pageScrollY
          return { top, right: 300, bottom: top + 24, left: 0, width: 300, height: 24 }
        }
        if (this.matches('[data-lesson-id="descriptive-statistics"]')) {
          const top = 620 - pageScrollY
          return { top, right: 300, bottom: top + 40, left: 0, width: 300, height: 40 }
        }
        return originalGetBoundingClientRect.call(this)
      },
    })
    const openingScrollY = pageScrollY
    const tile = app.host.querySelector('[data-lesson-id="descriptive-statistics"]')
    await click(tile)
    await settleEffects(window)
    assert.notEqual(pageScrollY, openingScrollY, 'opening the detail changes the simulated page scroll')

    pageScrollY = 760
    await click(buttonFor(app.host.querySelector('.lesson-detail-card'), '閉じる'))
    await settleEffects(window)
    assert.equal(pageScrollY, openingScrollY, 'closing the detail restores the page scroll from before it opened')
    assert.equal(window.document.activeElement, tile)
    const cardRect = tile.getBoundingClientRect()
    assert.ok(cardRect.top >= 0 && cardRect.bottom <= window.innerHeight, 'the focused map card stays visible')
  } finally {
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: originalGetBoundingClientRect,
    })
    await app.close()
  }
})

test('map list section links focus and scroll to the requested heading in both course layouts', async () => {
  const app = await createHarness({ url: testDocumentUrl('#/map') })
  const { window } = app.dom
  const scrollTargets = []
  window.HTMLElement.prototype.scrollIntoView = function () { scrollTargets.push(this) }

  try {
    await click(buttonFor(app.host, '教材一覧'))
    for (const [hash, sectionId] of [
      ['#/course/descriptive-statistics/lesson/variance', 'variance'],
      ['#/lesson/data-types/counting', 'counting'],
    ]) {
      const source = app.host.querySelector('.map-list-content .section-list a[href="' + hash + '"]')
      await click(source)
      await settleEffects(window)
      const heading = app.host.querySelector('#course-section-' + sectionId)
      assert.ok(heading)
      assert.equal(window.location.hash, hash)
      assert.equal(window.document.activeElement, heading)
      assert.equal(scrollTargets.at(-1), heading)
      await waitForHistory(window, 'back')
      await settleEffects(window)
      assert.equal(window.location.hash, '#/map')
      assert.ok(app.host.querySelector('.map-list-content'))
    }
  } finally {
    await app.close()
  }
})

test('list history return restores the source link, window scroll, and list mode', async () => {
  const app = await createHarness({ url: 'https://sfqc.test/SfQC/#/map' })
  const { window } = app.dom
  const originalGetBoundingClientRect = window.HTMLElement.prototype.getBoundingClientRect
  try {
    let pageScrollY = 0
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => pageScrollY })
    window.scrollTo = (_x, y) => { pageScrollY = y }
    window.scrollBy = ({ top }) => { pageScrollY += top }
    await click(buttonFor(app.host, '教材一覧'))
    pageScrollY = 340
    const sourceLink = app.host.querySelector('.map-list-content .lesson-card h3 a')
    const sourceHref = sourceLink.getAttribute('href')
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value() {
        if (this.matches('.map-list-content .lesson-card h3 a')) {
          const top = 40 + 340 - pageScrollY
          return { top, right: 300, bottom: top + 24, left: 0, width: 300, height: 24 }
        }
        return originalGetBoundingClientRect.call(this)
      },
    })
    await click(sourceLink)
    await waitForHistory(window, 'back')
    await settleEffects(window)
    await settleEffects(window)
    const restoredLink = [...app.host.querySelectorAll('.map-list-content .lesson-card h3 a')]
      .find((anchor) => anchor.getAttribute('href') === sourceHref)
    assert.ok(restoredLink)
    assert.equal(window.location.hash, '#/map')
    assert.equal(window.history.state.scrollY, 340)
    assert.equal(pageScrollY, 340)
    assert.equal(window.document.activeElement, restoredLink)
    assert.equal(app.host.querySelector('.map-grid-scroll'), null,
      'list restoration does not query or focus the unmounted graph')
  } finally {
    Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: originalGetBoundingClientRect,
    })
    await app.close()
  }

  const fallbackApp = await createHarness({ url: 'https://sfqc.test/SfQC/#/map' })
  try {
    await click(buttonFor(fallbackApp.host, '教材一覧'))
    await click(linkFor(fallbackApp.host, '進捗'))
    await waitForHistory(fallbackApp.dom.window, 'back')
    await settleEffects(fallbackApp.dom.window)
    await settleEffects(fallbackApp.dom.window)
    assert.ok(fallbackApp.host.querySelector('.map-list-content'))
    assert.equal(fallbackApp.dom.window.document.activeElement, fallbackApp.host.querySelector('#included-lessons-title'))
    assert.equal(fallbackApp.host.querySelector('.map-grid-scroll'), null)
  } finally {
    await fallbackApp.close()
  }
})

test('map snapshots restore independent selections and graph scroll for separate history entries', async () => {
  const app = await createHarness({ url: 'https://sfqc.test/SfQC/#/map' })
  const { window } = app.dom
  try {
    const firstTile = app.host.querySelector('[data-lesson-id="descriptive-statistics"]')
    await click(firstTile)
    app.host.querySelector('.map-grid-scroll').scrollTop = 110
    await click(linkFor(app.host.querySelector('.lesson-detail-card'), '解説を読む'))
    await click(linkFor(app.host, '学習マップ'))

    await click(app.host.querySelector('[data-lesson-id="data-types"]'))
    app.host.querySelector('.map-grid-scroll').scrollTop = 45
    await click(buttonFor(app.host, '教材一覧'))
    await click(linkFor(app.host, '進捗'))
    await waitForHistory(window, 'back')
    await settleEffects(window)
    assert.ok(app.host.querySelector('.map-list-content'))

    await waitForHistory(window, 'back')
    await waitForHistory(window, 'back')
    await settleEffects(window)
    await settleEffects(window)
    assert.equal(window.location.hash, '#/map')
    assert.ok(app.host.querySelector('.map-grid-scroll'))
    assert.equal(app.host.querySelector('[data-lesson-id="descriptive-statistics"]').getAttribute('aria-pressed'), 'true')
    assert.equal(app.host.querySelector('[data-lesson-id="data-types"]').getAttribute('aria-pressed'), 'false')
    assert.equal(app.host.querySelector('.map-grid-scroll').scrollTop, 110)
    assert.equal(window.document.activeElement, app.host.querySelector('[data-lesson-id="descriptive-statistics"]'))

    await waitForHistory(window, 'forward')
    await waitForHistory(window, 'forward')
    await settleEffects(window)
    await settleEffects(window)
    assert.ok(app.host.querySelector('.map-list-content'))
    assert.equal(app.host.querySelector('.primary-nav button[aria-pressed="true"]').textContent, '教材一覧')
    await click(buttonFor(app.host, '学習マップ'))
    await settleEffects(window)
    assert.equal(app.host.querySelector('[data-lesson-id="data-types"]').getAttribute('aria-pressed'), 'true')
    assert.equal(app.host.querySelector('.map-grid-scroll').scrollTop, 45)
  } finally {
    await app.close()
  }
})

test('development domain and color editor remains attached to the grid', async () => {
  const app = await createHarness({ url: 'https://sfqc.test/SfQC/#/map' })
  const { window } = app.dom
  try {
    await click(buttonFor(app.host, '分野編集'))
    assert.equal(app.host.querySelectorAll('.map-lesson-button').length, 34)
    assert.ok(app.host.querySelector('.map-author-editor'))
    const lessonId = 'math-arithmetic'
    const originalTile = app.host.querySelector(`[data-lesson-id="${lessonId}"]`)
    originalTile.focus()
    await act(async () => originalTile.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 0 })))
    await settleEffects(window)
    assert.equal(window.document.activeElement, app.host.querySelector(`#lesson-detail-title-${lessonId}`))
    const lessonEditor = [...app.host.querySelectorAll('.map-author-domain-fields label')]
      .find((label) => label.textContent.includes(lessonRegistry.lessons.find((lesson) => lesson.lessonId === lessonId).title))
    const select = lessonEditor.querySelector('select')
    await changeControl(app.dom.window, select, 'quality-methods')
    const movedTile = app.host.querySelector(`[data-lesson-id="${lessonId}"]`)
    assert.notEqual(movedTile, originalTile)
    assert.equal(movedTile.closest('.map-domain-column').querySelector('h2').textContent.includes('品質管理手法'), true)
    assert.equal(movedTile.dataset.lessonId, lessonId)
    const colors = app.host.querySelectorAll('.map-author-color-fields input[type="color"]')
    await changeControl(app.dom.window, colors[0], '#123456')
    assert.equal(app.host.querySelector('.map-graph-layout').style.getPropertyValue('--map-author-domain-math-foundations'), '#123456')
    assert.ok(buttonFor(app.host, 'レビュー用JSONを書き出す'))
    assert.equal(buttonFor(app.host, 'Re-layout'), undefined)
    await click(buttonFor(app.host.querySelector('.lesson-detail-card'), '閉じる'))
    await settleEffects(window)
    assert.equal(window.document.activeElement, movedTile)
  } finally {
    await app.close()
  }
})

test('old manual completion stays untouched while new v2 progress starts unfinished and saves without positions', async () => {
  const oldRaw = '{"schemaVersion":1,"lessons":{"descriptive-statistics":{"completedAt":"2026-11-12T12:34:56.789Z"}},"positions":{"descriptive-statistics":{"x":15,"y":20}}}'
  const practiceRaw = '{"schemaVersion":1,"records":[]}'
  const app = await createHarness({
    url: 'https://sfqc.test/SfQC/#/map',
    localStorageEntries: { 'sfqc:learning-state:v1': oldRaw, [PRACTICE_RESULTS_KEY]: practiceRaw },
  })
  try {
    const { window } = app.dom
    assert.ok([...app.host.querySelectorAll('.map-manual-status')].every((node) => node.textContent.includes('手動進捗：未完了')))
    assert.equal(savedMap(window).schemaVersion, 2)
    assert.equal(savedMap(window).positions, undefined)
    assert.equal(window.localStorage.getItem('sfqc:learning-state:v1'), oldRaw)

    await click(linkFor(app.host, 'データ管理'))
    assert.match(app.host.textContent, /旧 v1 の手動完了は引き継がれず/u)
    assert.match(app.host.textContent, /旧 v1 raw は読み取り・削除せず保全/u)
    assert.match(app.host.textContent, /旧 version 1 backup は読み込めません/u)

    await click(linkFor(app.host, '学習マップ'))
    await click(app.host.querySelector('[data-lesson-id="descriptive-statistics"]'))
    await click(buttonFor(app.host.querySelector('.lesson-detail-card'), '完了にする'))
    await settleEffects(window)
    const saved = savedMap(window)
    assert.equal(saved.schemaVersion, 2)
    assert.equal(saved.positions, undefined)
    assert.ok(saved.lessons['descriptive-statistics'].completedAt)
    assert.equal(window.localStorage.getItem('sfqc:learning-state:v1'), oldRaw)
    assert.equal(window.localStorage.getItem(PRACTICE_RESULTS_KEY), practiceRaw)

    const backup = JSON.parse(serializeLearningBackup(saved, { schemaVersion: 1, records: [] }))
    assert.equal(backup.version, 2)
    assert.equal(backup.learningState.schemaVersion, 2)
    assert.equal(backup.learningState.positions, undefined)
    assert.equal(backup.practiceResults.schemaVersion, 1)
  } finally {
    await app.close()
  }
})

test('manual completion rebases after a save conflict and preserves unresolved IDs', async () => {
  const app = await createHarness({ url: 'https://sfqc.test/SfQC/#/map' })
  try {
    const { window } = app.dom
    const external = savedMap(window)
    external.lessons['math-arithmetic'].completedAt = '2026-11-13T00:00:00.000Z'
    external.lessons['retired-topic'] = { completedAt: '2026-11-13T01:00:00.000Z' }
    const externalRaw = serializeLearningState(external)
    window.localStorage.setItem(LEARNING_STATE_KEY, externalRaw)

    await click(app.host.querySelector('[data-lesson-id="descriptive-statistics"]'))
    await click(buttonFor(app.host.querySelector('.lesson-detail-card'), '完了にする'))
    assert.match(app.host.textContent, /保存データが別の変更で更新されました/u)
    await click(buttonFor(app.host.querySelector('.practice-recovery'), '未保存の変更を再試行'))
    const saved = savedMap(window)
    assert.ok(saved.lessons['descriptive-statistics'].completedAt)
    assert.equal(saved.lessons['math-arithmetic'].completedAt, external.lessons['math-arithmetic'].completedAt)
    assert.equal(saved.lessons['retired-topic'].completedAt, external.lessons['retired-topic'].completedAt)
    assert.equal(app.host.querySelector('.manual-progress-count').textContent, '手動完了 2 / 34')
    assert.equal(app.host.querySelector('.practice-recovery'), null)
  } finally {
    await app.close()
  }
})

test('unknown manual save keeps its candidate until the stored result can be confirmed', async () => {
  const app = await createHarness({ url: 'https://sfqc.test/SfQC/#/map' })
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
    await click(app.host.querySelector('[data-lesson-id="descriptive-statistics"]'))
    await click(buttonFor(app.host.querySelector('.lesson-detail-card'), '完了にする'))
    assert.match(app.host.textContent, /手動進捗の変更をメモリ上に保持/u)
    assert.match(app.host.textContent, /再読み込みすると失われます/u)
    const unloadEvent = new window.Event('beforeunload', { cancelable: true })
    await act(async () => window.dispatchEvent(unloadEvent))
    assert.equal(unloadEvent.defaultPrevented, true)
    assert.equal(learningWriteCount, 1)
    const candidateRaw = previousGet.call(window.localStorage, LEARNING_STATE_KEY)
    assert.ok(JSON.parse(candidateRaw).lessons['descriptive-statistics'].completedAt)
    assert.equal(JSON.parse(candidateRaw).positions, undefined)

    await click(linkFor(app.host, 'データ管理'))
    const fileInput = app.host.querySelector('#backup-file')
    assert.equal(fileInput.disabled, true)
    const backup = serializeLearningBackup(
      { schemaVersion: 2, lessons: {} }, { schemaVersion: 1, records: [] },
    )
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new window.File([backup], 'backup.json', { type: 'application/json' })],
    })
    await act(async () => fileInput.dispatchEvent(new window.Event('change', { bubbles: true })))
    assert.match(app.host.querySelector('.data-message').textContent, /保存状態を確認してから、バックアップを復元/u)

    await click(buttonFor(app.host.querySelector('.practice-recovery'), '手動進捗の保存状態を再確認'))
    assert.match(app.host.textContent, /再確認を続けてください/u)
    await click(buttonFor(app.host.querySelector('.practice-recovery'), '手動進捗の保存状態を再確認'))
    assert.equal(app.host.querySelector('.practice-recovery'), null)
    assert.equal(learningWriteCount, 1)
    assert.equal(previousGet.call(window.localStorage, LEARNING_STATE_KEY), candidateRaw)
    assert.ok(savedMap(window).lessons['descriptive-statistics'].completedAt)
  } finally {
    window.Storage.prototype.getItem = previousGet
    window.Storage.prototype.setItem = previousSet
    await app.close()
  }
})

test('manual progress actions keep a visible focus target for every save outcome', async (t) => {
  const server = await createAppTestServer()
  const scenarios = [
    { outcome: 'saved', actionLabel: '未完了に戻す', nextLabel: '完了にする' },
    { outcome: 'conflict', actionLabel: '完了にする', nextLabel: '未完了に戻す' },
    { outcome: 'failed', actionLabel: '完了にする', nextLabel: '未完了に戻す' },
    { outcome: 'unknown', actionLabel: '完了にする', nextLabel: '未完了に戻す' },
  ]
  try {
    for (const scenario of scenarios) {
      await t.test(scenario.outcome, async () => {
        const learningState = scenario.outcome === 'saved'
          ? serializeLearningState({ schemaVersion: 2, lessons: {
            'descriptive-statistics': { completedAt: '2026-11-14T00:00:00.000Z' },
          } })
          : undefined
        const app = await createHarness({
          url: 'https://sfqc.test/SfQC/#/map',
          sharedServer: server,
          localStorageEntries: learningState ? { [LEARNING_STATE_KEY]: learningState } : {},
        })
        const { window } = app.dom
        const storagePrototype = window.Storage.prototype
        const originalGetItem = storagePrototype.getItem
        const originalSetItem = storagePrototype.setItem
        const originalFocus = window.HTMLElement.prototype.focus
        const originalGetBoundingClientRect = window.HTMLElement.prototype.getBoundingClientRect
        let writeStarted = false
        let unreadableReads = 2
        try {
          if (scenario.outcome === 'conflict') {
            const external = savedMap(window)
            external.lessons['math-arithmetic'].completedAt = '2026-11-13T00:00:00.000Z'
            window.localStorage.setItem(LEARNING_STATE_KEY, serializeLearningState(external))
          } else if (scenario.outcome === 'failed') {
            storagePrototype.setItem = function (key, value) {
              if (key === LEARNING_STATE_KEY) throw new Error('simulated storage write failure')
              return originalSetItem.call(this, key, value)
            }
          } else if (scenario.outcome === 'unknown') {
            storagePrototype.setItem = function (key, value) {
              if (key === LEARNING_STATE_KEY) writeStarted = true
              return originalSetItem.call(this, key, value)
            }
            storagePrototype.getItem = function (key) {
              if (key === LEARNING_STATE_KEY && writeStarted && unreadableReads > 0) {
                unreadableReads -= 1
                throw new Error('simulated post-write read failure')
              }
              return originalGetItem.call(this, key)
            }
          }

          await click(app.host.querySelector('[data-lesson-id="descriptive-statistics"]'))
          const detail = app.host.querySelector('.lesson-detail-card')
          const heading = detail.querySelector('.lesson-detail-header h2')
          const action = buttonFor(detail, scenario.actionLabel)
          assert.ok(action)

          let headingCanScrollIntoView = false
          let focusedAction = null
          const focusCalls = []
          Object.defineProperty(window, 'innerHeight', { configurable: true, value: 220 })
          window.HTMLElement.prototype.focus = function (options) {
            if (this === heading) {
              focusCalls.push({ target: 'heading', options })
              if (!options?.preventScroll) headingCanScrollIntoView = true
            } else if (this.matches('.manual-progress-actions button')) {
              focusCalls.push({ target: this.textContent.trim(), options })
              focusedAction = this
            }
            return originalFocus.call(this, options)
          }
          window.HTMLElement.prototype.getBoundingClientRect = function () {
            const rect = (top, height) => ({
              x: 0, y: top, top, right: 200, bottom: top + height, left: 0, width: 200, height,
            })
            if (this === heading) return rect(headingCanScrollIntoView ? 12 : 300, 24)
            if (this.matches('.manual-progress-actions button')) return rect(this === focusedAction ? 48 : 300, 40)
            return originalGetBoundingClientRect.call(this)
          }

          action.focus()
          focusCalls.length = 0
          focusedAction = null
          await click(action)
          await settleEffects(window)

          const updatedDetail = app.host.querySelector('.lesson-detail-card')
          const nextAction = buttonFor(updatedDetail, scenario.nextLabel)
          if (scenario.outcome === 'saved') {
            assert.ok(nextAction)
            assert.equal(nextAction.disabled, false)
            assert.equal(window.document.activeElement, nextAction)
            assert.deepEqual(focusCalls.at(-1), {
              target: scenario.nextLabel,
              options: { preventScroll: true },
            })
          } else {
            const disabledAction = buttonFor(updatedDetail, scenario.actionLabel)
            assert.equal(nextAction, undefined)
            assert.ok(disabledAction?.disabled)
            assert.equal(window.document.activeElement, heading)
            assert.deepEqual(focusCalls.at(-1), { target: 'heading', options: undefined })
            assert.equal(headingCanScrollIntoView, true, 'fallback focus allows the browser to reveal the heading')
            assert.ok(app.host.querySelector('.practice-recovery'))
          }

          const focused = window.document.activeElement
          const rect = focused.getBoundingClientRect()
          assert.ok(rect.top >= 0 && rect.bottom <= window.innerHeight,
            `${scenario.outcome} focus target must be inside the viewport`)
        } finally {
          storagePrototype.getItem = originalGetItem
          storagePrototype.setItem = originalSetItem
          window.HTMLElement.prototype.focus = originalFocus
          window.HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
          await app.close()
        }
      })
    }
  } finally {
    await server.close()
  }
})

test('invalid v2 learning state disables completion and preserves its damaged raw', async () => {
  const app = await createHarness({ url: 'https://sfqc.test/SfQC/#/map' })
  try {
    const { window } = app.dom
    const damaged = '{"schemaVersion":2,"lessons":{"descriptive-statistics":{"completedAt":"invalid"}}}'
    window.localStorage.setItem(LEARNING_STATE_KEY, damaged)
    await app.remountAt('#/map')
    await click(app.host.querySelector('[data-lesson-id="descriptive-statistics"]'))
    assert.equal(buttonFor(app.host.querySelector('.lesson-detail-card'), '完了にする'), undefined)
    assert.equal(window.localStorage.getItem(LEARNING_STATE_KEY), damaged)
    assert.equal(app.host.querySelectorAll('.map-lesson-button').length, 34)
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
    assert.match(simulation.textContent, /復元抽出では、順序も含めた3本の取り方が 125 通り/u)
    assert.match(simulation.textContent, /n で割った値の期待値は 1\.33 mm²/u)
    assert.match(simulation.textContent, /n − 1 で割った値の期待値は 2\.00 mm²/u)
    assert.equal(simulation.querySelector('.ivc-bar').getAttribute('aria-valuemax'), '6')
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
    await click(app.host.querySelector('[data-lesson-id="descriptive-statistics"]'))
    await click(buttonFor(app.host, '完了にする'))
    const learning = readLearningState(undefined, () => window.localStorage)
    assert.equal(learning.status, 'ok')
    assert.ok(learning.state.lessons['descriptive-statistics'].completedAt)
    assert.equal(learning.state.schemaVersion, 2)
    assert.equal(learning.state.positions, undefined)
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

test('general lesson slots share numeric grading and keep each question isolated when generation fails', async () => {
  const app = await createHarness()
  const { window } = app.dom
  const failedSeeds = new Set([0, 2])
  let slotRoot
  try {
    const { LessonRouteContent } = await app.loadModule('/src/lesson-view.tsx')
    const { createRoot } = await import('react-dom/client')
    const slotHost = window.document.createElement('div')
    app.host.append(slotHost)
    slotRoot = createRoot(slotHost)
    const fixtureGenerators = {
      'fixture-counts': (_definition, seed) => {
        if (seed === 0) throw new Error('fixture generation failure')
        if (failedSeeds.has(seed)) return null
        const first = seed + 1
        const second = seed + 2
        return {
          display: {
            prompt: '表の値に2を足した結果を、甲と乙の順に入力してください。',
            table: { rows: [{ label: '観測', values: [first, second] }] },
            response: { type: 'numeric', fields: [
              { id: 'first', label: '甲', unit: '個', roundingDigits: 0 },
              { id: 'second', label: '乙', unit: '個', roundingDigits: 0 },
            ] },
            reviewSectionRefs: ['data-types#types'],
          },
          evaluation: { type: 'numeric', answers: [
            { fieldId: 'first', expected: String(first + 2), roundingDigits: 0 },
            { fieldId: 'second', expected: String(second + 2), roundingDigits: 0 },
          ] },
          solution: {
            steps: [`甲：${first} + 2 = ${first + 2}`, `乙：${second} + 2 = ${second + 2}`],
            explanation: '表の観測値に2を足します。',
          },
        }
      },
    }
    await act(async () => slotRoot.render(createElement(LessonRouteContent, {
      lesson: lessonRegistryFixture.lessons.find((lesson) => lesson.lessonId === 'data-types'),
      sectionId: 'types',
      sectionHeadingRef: { current: null },
      registry: lessonRegistryFixture,
      exerciseGenerators: fixtureGenerators,
    })))

    const fixed = slotHost.querySelector('[data-exercise-id="observed-counts"]')
    const fixedInputs = fixed.querySelectorAll('input[type="text"]')
    assert.equal(fixedInputs.length, 2)
    assert.match(fixed.textContent, /データの種類：観測単位とデータ型/u)
    assert.ok(fixed.querySelector('.ds-practice-question-heading a[data-nav-intent="review"]'))
    assert.ok([...fixed.querySelectorAll('.ds-practice-number span')].every((label) => /整数に丸めて判定/u.test(label.textContent)))
    const fixedForm = fixed.querySelector('form')
    await act(async () => fixedForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.match(fixed.querySelector('.ds-exercise-feedback').textContent, /入力形式/u)
    await changeTextInput(window, fixedInputs[0], '2')
    await changeTextInput(window, fixedInputs[1], '4')
    await act(async () => fixedForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.match(fixed.querySelector('.ds-exercise-feedback').textContent, /違います/u)
    await changeTextInput(window, fixedInputs[1], '3')
    await act(async () => fixedForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.match(fixed.querySelector('.ds-exercise-feedback').textContent, /正解/u)
    assert.equal(fixed.querySelector('.ds-practice-question details').open, true,
      'a correct response opens the explanation')

    const generated = slotHost.querySelector('[data-exercise-id="generated-counts"]')
    assert.match(generated.querySelector('.ds-exercise-error').textContent, /表示できません/u)
    assert.equal(generated.querySelector('form'), null)
    let regenerate = buttonFor(generated, '別の問題')
    assert.ok(regenerate)
    await click(regenerate)
    assert.match(generated.querySelector('.ds-practice-prompt').textContent, /表の値に2/u)
    const table = generated.querySelector('table')
    assert.equal(table.querySelector('caption'), null, 'generic tables do not invent a subject-specific caption')
    assert.deepEqual([...table.querySelectorAll('thead th')].map((cell) => cell.textContent), ['', '1', '2'])
    const generatedDetails = generated.querySelector('.ds-practice-question details')
    assert.equal(generatedDetails.open, false)
    assert.deepEqual([...generatedDetails.querySelectorAll('.ds-exercise-steps li')].map((step) => step.textContent), [
      '甲：2 + 2 = 4', '乙：3 + 2 = 5',
    ])
    assert.ok(generated.querySelector('.ds-practice-question-heading a[data-nav-intent="review"]'))
    const generatedInputs = generated.querySelectorAll('input[type="text"]')
    await changeTextInput(window, generatedInputs[0], '4')
    await changeTextInput(window, generatedInputs[1], '6')
    const generatedForm = generated.querySelector('form')
    await act(async () => generatedForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.match(generated.querySelector('.ds-exercise-feedback').textContent, /違います/u)
    await changeTextInput(window, generatedInputs[1], '5')
    await act(async () => generatedForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.match(generated.querySelector('.ds-exercise-feedback').textContent, /正解/u)
    assert.equal(generatedDetails.open, true)

    regenerate = buttonFor(generated, '別の問題')
    regenerate.focus()
    const oldPrompt = generated.querySelector('.ds-practice-prompt').textContent
    await click(regenerate)
    assert.equal(buttonFor(generated, '別の問題'), regenerate, 'regeneration does not remount its focused control')
    assert.equal(window.document.activeElement, regenerate)
    assert.equal(generated.querySelector('.ds-practice-prompt').textContent, oldPrompt)
    assert.equal(generated.querySelectorAll('input[type="text"]')[0].value, '4')
    assert.equal(generated.querySelectorAll('input[type="text"]')[1].value, '5')
    assert.equal(generated.querySelector('.ds-practice-question details').open, true)
    assert.match(generated.querySelector('.ds-exercise-error').textContent, /表示できませんでした/u)

    failedSeeds.delete(2)
    await click(regenerate)
    assert.equal(generated.querySelectorAll('input[type="text"]')[0].value, '')
    assert.equal(generated.querySelectorAll('input[type="text"]')[1].value, '')
    assert.equal(generated.querySelector('.ds-practice-question details').open, false)
    assert.equal(generated.querySelector('.ds-exercise-feedback').textContent, '')
    assert.equal(window.localStorage.getItem(PRACTICE_RESULTS_KEY), null,
      'section checks never enter independent practice history')

    const choiceRegistry = structuredClone(lessonRegistryFixture)
    choiceRegistry.lessons.find((lesson) => lesson.lessonId === 'data-types').sections[0].blocks.push({
      kind: 'exerciseSlot', exerciseId: 'classify-unit',
    })
    await act(async () => slotRoot.render(createElement(LessonRouteContent, {
      lesson: choiceRegistry.lessons.find((lesson) => lesson.lessonId === 'data-types'),
      sectionId: 'types',
      sectionHeadingRef: { current: null },
      registry: choiceRegistry,
      exerciseGenerators: fixtureGenerators,
    })))
    const choice = slotHost.querySelector('[data-exercise-id="classify-unit"]')
    const choiceDetails = choice.querySelector('details')
    assert.deepEqual([...choice.querySelectorAll('.ds-practice-choice b')].map((label) => label.textContent), ['ア：', 'イ：'])
    assert.equal(choiceDetails.open, false)
    assert.ok(choiceDetails.querySelector('.ds-exercise-solution'), 'the solution stays inside the closed details')
    assert.equal(choiceDetails.querySelector('summary').textContent, '解説を見る')
    assert.equal(choiceDetails.open, false)
    await click(choice.querySelector('input[value="count-the-defects"]'))
    await act(async () => choice.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.match(choice.querySelector('.ds-exercise-feedback').textContent, /違います/u)
    assert.equal(choice.querySelector('.ds-exercise-misconception').textContent,
      '製品の個数と傷の件数を同じ単位で数えています。')
    assert.ok(choice.querySelector('.ds-exercise-review-links a[data-nav-intent="review"]'))
    assert.equal(choiceDetails.open, false, 'an incorrect choice does not expose the solution')

    const missingDefinitionRegistry = structuredClone(lessonRegistryFixture)
    missingDefinitionRegistry.exerciseCatalog.definitions = missingDefinitionRegistry.exerciseCatalog.definitions
      .filter((definition) => definition.exerciseId !== 'generated-counts')
    const missingDefinitionSection = missingDefinitionRegistry.lessons.find((lesson) => lesson.lessonId === 'data-types').sections[0]
    missingDefinitionSection.blocks.find((block) => block.kind === 'details').blocks[1].exerciseId = 'missing-counts'
    await act(async () => slotRoot.render(createElement(LessonRouteContent, {
      lesson: missingDefinitionRegistry.lessons.find((lesson) => lesson.lessonId === 'data-types'),
      sectionId: 'types',
      sectionHeadingRef: { current: null },
      registry: missingDefinitionRegistry,
      exerciseGenerators: fixtureGenerators,
    })))
    const missingDefinition = slotHost.querySelector('[data-exercise-id="missing-counts"]')
    assert.match(missingDefinition.querySelector('.ds-exercise-error').textContent, /表示できません/u)
    assert.equal(missingDefinition.querySelector('form'), null)
    assert.ok(slotHost.querySelector('[data-exercise-id="observed-counts"] form'),
      'a missing definition affects only its own question slot')
  } finally {
    if (slotRoot) await act(async () => slotRoot.unmount())
    await app.close()
  }
})

test('the map opens the data-types explanation directly and its review link restores the active case', async () => {
  const learningState = serializeLearningState({ schemaVersion: 2, lessons: {
    'data-types': { completedAt: '2026-11-14T00:00:00.000Z' },
  } })
  const practiceResults = serializePracticeResults({ schemaVersion: 1, records: [
    { categoryId: 'mean-deviation', isCorrect: false, attemptedAt: '2026-11-14T01:00:00.000Z' },
  ] })
  const app = await createHarness({ url: testDocumentUrl('#/map'), localStorageEntries: {
    [LEARNING_STATE_KEY]: learningState,
    [PRACTICE_RESULTS_KEY]: practiceResults,
  } })
  const { window } = app.dom
  const scrollTargets = []
  window.HTMLElement.prototype.scrollIntoView = function () { scrollTargets.push(this) }
  try {
    await click(app.host.querySelector('[data-lesson-id="data-types"]'))
    const explanationLink = linkFor(app.host.querySelector('.lesson-detail-card'), '解説を読む')
    assert.equal(explanationLink.getAttribute('href'), '#/lesson/data-types')
    await click(explanationLink)
    await settleEffects(window)
    assert.equal(window.location.hash, '#/lesson/data-types')
    assert.match(app.host.querySelector('.lesson-course .lesson-paragraph').textContent, /なぜでしょうか？$/u)
    assert.equal(app.host.querySelector('.lesson-course caption').textContent, '製品1個を1行にした検査記録')
    assert.deepEqual([...app.host.querySelectorAll('.course-section > h2')].map((heading) => heading.textContent),
      ['観測単位', '不適合数と不適合品数', '計量値・計数値・カテゴリ'])
    assert.equal(app.host.querySelector('.course-references summary').textContent, '出典')
    assert.equal(app.host.querySelectorAll('.course-references a').length, 3)

    const typesSection = app.host.querySelector('#section-types')
    const diagram = typesSection.querySelector('.data-type-flow [role="img"]')
    assert.match(diagram.getAttribute('aria-label'), /種類・判定ならカテゴリ.*測った値は計量値、数えた値は計数値/u)
    assert.deepEqual([...diagram.querySelectorAll('strong')].map((node) => node.textContent), ['カテゴリ', '計量値', '計数値'])
    const diagramText = [...typesSection.querySelectorAll('.data-type-flow figcaption li')].map((node) => node.textContent)
    assert.equal(diagramText.length, 2)
    assert.match(diagramText[0], /種類や判定なら、カテゴリ/u)
    assert.match(diagramText[1], /連続量.*計量値.*離散的.*計数値/u)

    const fixedClassification = typesSection.querySelector('[data-exercise-id="classify-record"]')
    const classificationTable = fixedClassification.querySelector('table')
    assert.match(fixedClassification.querySelector('.ds-practice-prompt').textContent, /^検査した5個をすべて、1製品1行で記録しました。適合状態コードは0＝適合、1＝不適合です。/u)
    assert.equal(classificationTable.caption.textContent, '分類を確認する検査記録（1行＝製品1個）')
    assert.deepEqual([...classificationTable.tBodies[0].rows].map((row) => row.cells[0].textContent), ['Q-01', 'Q-02', 'Q-03', 'Q-04', 'Q-05'])
    assert.equal(fixedClassification.querySelector('details').open, false)
    assert.equal(fixedClassification.querySelectorAll('input[type="radio"]').length, 4)

    const unitSection = app.host.querySelector('#section-observation-unit')
    const observation = unitSection.querySelector('[data-exercise-id="identify-observation-unit"]')
    assert.deepEqual([...observation.querySelectorAll('caption')].map((caption) => caption.textContent), [
      '検査対象の製品一覧（1行＝製品1個）', '基準を超えた傷の明細',
    ])
    assert.equal(unitSection.querySelector('.course-table-wrap caption').textContent, '基準を超えた傷の明細（1行＝傷1件）')
    assert.deepEqual([...observation.querySelectorAll('table')].map((table) => table.tBodies[0].rows.length), [5, 3])
    assert.equal(observation.querySelector('details').open, false)
    assert.equal(observation.querySelector('.ds-practice-question-heading a').getAttribute('href'), '#/lesson/data-types/observation-unit')

    const countingHash = '#/lesson/data-types/counting'
    await act(async () => {
      const changed = new Promise((resolve) => window.addEventListener('hashchange', resolve, { once: true }))
      window.location.hash = countingHash
      await changed
    })
    await settleEffects(window)
    assert.equal(window.location.hash, countingHash)
    const countingHeading = app.host.querySelector('#course-section-counting')
    assert.equal(window.document.activeElement, countingHeading)
    assert.equal(scrollTargets.at(-1), countingHeading)

    const card = app.host.querySelector('#section-counting [data-exercise-id="defect-aggregation"]')
    const caption = () => card.querySelector('caption').textContent
    const columnLabels = () => [...card.querySelectorAll('thead th')].map((cell) => cell.textContent)
    const tableRows = () => [...card.querySelectorAll('tbody tr')].map((row) =>
      [...row.cells].map((cell) => cell.textContent))
    const answer = async (choiceId) => {
      await click(card.querySelector(`input[value="${choiceId}"]`))
      await act(async () => card.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    }
    assert.equal(caption(), '製品ごとの検査記録（1行＝製品1個）')
    assert.deepEqual(columnLabels(), ['製品番号', '見つかった傷（件）', '基準を超えた傷（件）'])
    assert.deepEqual(tableRows(), [
      ['P-01', '4', '3'], ['P-02', '1', '0'], ['P-03', '2', '1'], ['P-04', '0', '0'], ['P-05', '1', '0'], ['P-06', '0', '0'],
    ])
    await answer('choice-0')
    assert.match(card.querySelector('.ds-exercise-feedback').textContent, /^正解です/u)
    assert.equal(card.querySelector('details').open, true)

    await click(buttonFor(card, '別の問題'))
    assert.match(card.querySelector('.ds-practice-prompt').textContent, /事例1と同じ6製品/u)
    assert.deepEqual(tableRows(), [['傷1', 'P-01'], ['傷2', 'P-01'], ['傷3', 'P-01'], ['傷4', 'P-03']])
    assert.equal(card.querySelector('input[type="radio"]:checked'), null)
    await answer('choice-0')
    assert.match(card.querySelector('.ds-exercise-misconception').textContent, /P-01の3行は同じ製品/u)
    assert.deepEqual([...card.querySelectorAll('.ds-exercise-review-links a')].map((anchor) => anchor.getAttribute('href')), [
      '#/lesson/data-types/observation-unit', '#/lesson/data-types/counting',
    ])
    await answer('choice-3')
    assert.match(card.querySelector('.ds-exercise-feedback').textContent, /^正解です/u)

    await click(buttonFor(card, '別の問題'))
    assert.equal(caption(), '基準を超えた傷の明細')
    assert.deepEqual(columnLabels(), ['傷番号', '製品番号'])
    assert.deepEqual(tableRows(), [['傷1', 'P-01'], ['傷2', 'P-03']])
    assert.equal(card.querySelector('input[type="radio"]:checked'), null)
    assert.equal(card.querySelector('.ds-exercise-feedback').textContent, '')
    assert.equal(card.querySelector('details').open, false)

    await answer('choice-0')
    assert.match(card.querySelector('.ds-exercise-feedback').textContent, /違います/u)
    assert.match(card.querySelector('.ds-exercise-misconception').textContent, /数は合っていますが、理由が誤り/u)
    const reviewLink = card.querySelector('.ds-exercise-review-links a[data-nav-intent="review"]')
    assert.equal(reviewLink.getAttribute('href'), '#/lesson/data-types/observation-unit')
    await click(reviewLink)
    await settleEffects(window)
    assert.equal(window.location.hash, '#/lesson/data-types/observation-unit')
    const reviewedHeading = app.host.querySelector('#course-section-observation-unit')
    assert.equal(window.document.activeElement, reviewedHeading)
    const returnLink = reviewedHeading.nextElementSibling.querySelector('a[data-nav-intent="return"]')
    assert.equal(returnLink.textContent, '演習に戻る')
    assert.equal(returnLink.getAttribute('href'), '#/lesson/data-types/counting')
    assert.equal(returnLink.tabIndex, 0)
    assert.equal(app.host.querySelectorAll('a[data-nav-intent="return"]').length, 1)
    await click(returnLink)
    await settleEffects(window)

    assert.equal(window.location.hash, '#/lesson/data-types/counting')
    assert.equal(card.querySelector('input[value="choice-0"]').checked, true)
    assert.match(card.querySelector('.ds-exercise-feedback').textContent, /違います/u)
    assert.equal(window.document.activeElement, reviewLink, 'return restores focus to the originating review link')
    assert.equal(caption(), '基準を超えた傷の明細')
    assert.equal(card.querySelector('details').open, false)

    await answer('choice-2')
    assert.match(card.querySelector('.ds-exercise-feedback').textContent, /^正解です/u)
    assert.equal(card.querySelector('details').open, true)
    assert.equal(card.querySelectorAll('.ds-exercise-steps li').length, 2)
    await click(buttonFor(card, '別の問題'))
    assert.equal(caption(), '製品ごとの検査記録（1行＝製品1個）', '0 → 1 → 2 → 0 returns to the first case')
    assert.equal(window.localStorage.getItem(LEARNING_STATE_KEY), learningState)
    assert.equal(window.localStorage.getItem(PRACTICE_RESULTS_KEY), practiceResults)
  } finally {
    await app.close()
  }
})

test('nested lesson reviews restore focus from the browser history frame after Back', async () => {
  const routeHash = '#/lesson/data-types/types'
  const app = await createHarness({ url: testDocumentUrl(routeHash) })
  const { window } = app.dom
  window.HTMLElement.prototype.scrollIntoView = () => {}
  let scrollY = 0
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
  window.scrollTo = (_x, y) => { scrollY = y }

  try {
    await settleEffects(window)
    const sourceEntryId = window.history.state.entryId
    scrollY = 540

    const exerciseA = app.host.querySelector('[data-exercise-id="classify-record"]')
    await click(exerciseA.querySelector('input[value="choice-0"]'))
    await act(async () => exerciseA.querySelector('form').dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true }),
    ))
    const reviewLinksA = exerciseA.querySelectorAll('a[data-nav-intent="review"]')
    const reviewLinkA = reviewLinksA[0]
    const reviewLinkIndexA = Array.from(reviewLinksA).indexOf(reviewLinkA)
    assert.ok(reviewLinkA)
    await click(reviewLinkA)
    await settleEffects(window)
    const firstReviewEntryId = window.history.state.entryId
    assert.notEqual(firstReviewEntryId, sourceEntryId)
    assert.deepEqual(window.history.state.returnStack.at(-1), {
      routeHash,
      route: { kind: 'lesson-id', lessonId: 'data-types', sectionId: 'types' },
      entryId: sourceEntryId,
      scrollY: 540,
      focusTarget: { exerciseId: 'classify-record', linkIndex: reviewLinkIndexA },
    })

    scrollY = 860
    const exerciseB = app.host.querySelector('[data-exercise-id="identify-observation-unit"]')
    await click(exerciseB.querySelector('input[value="choice-0"]'))
    await act(async () => exerciseB.querySelector('form').dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true }),
    ))
    const reviewLinksB = exerciseB.querySelectorAll('a[data-nav-intent="review"]')
    const reviewLinkB = reviewLinksB[0]
    const reviewLinkIndexB = Array.from(reviewLinksB).indexOf(reviewLinkB)
    assert.ok(reviewLinkB)
    await click(reviewLinkB)
    await settleEffects(window)
    assert.equal(window.location.hash, '#/lesson/data-types/observation-unit')
    const secondReviewEntryId = window.history.state.entryId
    assert.notEqual(secondReviewEntryId, firstReviewEntryId)
    assert.deepEqual(window.history.state.returnStack.at(-1), {
      routeHash,
      route: { kind: 'lesson-id', lessonId: 'data-types', sectionId: 'types' },
      entryId: firstReviewEntryId,
      scrollY: 860,
      focusTarget: { exerciseId: 'identify-observation-unit', linkIndex: reviewLinkIndexB },
    })

    await waitForHistory(window, 'back')
    await settleEffects(window)
    assert.equal(window.history.state.entryId, firstReviewEntryId)
    assert.equal(window.history.state.returnStack.length, 1)
    assert.deepEqual(window.history.state.returnStack[0].focusTarget, {
      exerciseId: 'classify-record', linkIndex: reviewLinkIndexA,
    })
    assert.equal(scrollY, 860)

    await click(app.host.querySelector('.return-navigation a[data-nav-intent="return"]'))
    await settleEffects(window)
    const returnedEntryId = window.history.state.entryId
    assert.notEqual(returnedEntryId, sourceEntryId)
    assert.notEqual(returnedEntryId, firstReviewEntryId)
    assert.equal(window.history.state.returnStack.length, 0)
    assert.equal(window.history.state.scrollY, 540)
    assert.equal(scrollY, 540)
    const restoredA = app.host.querySelector('[data-exercise-id="classify-record"]')
    assert.equal(restoredA.querySelector('input[value="choice-0"]').checked, true)
    assert.match(restoredA.querySelector('.ds-exercise-feedback').textContent, /違います/u)
    assert.equal(window.document.activeElement,
      restoredA.querySelectorAll('a[data-nav-intent="review"]')[reviewLinkIndexA],
      'return focus uses the frame restored from browser history, not the latest in-memory review')

    await waitForHistory(window, 'back')
    await settleEffects(window)
    assert.equal(window.history.state.entryId, firstReviewEntryId)
    await waitForHistory(window, 'forward')
    await settleEffects(window)
    assert.equal(window.history.state.entryId, returnedEntryId)
    assert.equal(scrollY, 540)
  } finally {
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
      { schemaVersion: 2, lessons: {} },
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

    const backup = serializeLearningBackup({ schemaVersion: 2, lessons: {} }, { schemaVersion: 1, records: [] })
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
    assert.equal(card.querySelector('details').open, false, 'solutions begin closed')
    if (question.table) {
      const table = card.querySelector('table')
      assert.equal(table.querySelector('caption').textContent, 'ラインごとに測った値')
      assert.deepEqual([...table.querySelectorAll('thead th')].map((cell) => cell.textContent), [
        'ライン', ...question.table.rows[0].values.map((_, index) => `${index + 1}個目`),
      ])
      assert.deepEqual([...table.querySelectorAll('tbody tr')].map((row) => [
        row.querySelector('th').textContent,
        ...[...row.querySelectorAll('td')].map((cell) => Number(cell.textContent)),
      ]), question.table.rows.map((row) => [row.label, ...row.values]))
    } else assert.equal(card.querySelector('table'), null)

    const submit = card.querySelector('form')
    await act(async () => {
      submit.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
      submit.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    })
    assert.equal(window.localStorage.getItem(PRACTICE_RESULTS_KEY), null,
      'an empty numeric answer or unselected choice must not consume the first grade')

    if (question.type === 'choice') {
      const wrongIndex = question.answer === 0 ? 1 : 0
      await click(card.querySelectorAll('input[type="radio"]')[wrongIndex])
    } else {
      await changeTextInput(window, card.querySelector('input[type="text"]'), String(Number(question.answer) + 1))
    }
    await act(async () => {
      submit.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
      submit.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    })
    assert.match(card.querySelector('.ds-exercise-feedback').textContent, /違います/u)
    assert.match(app.host.querySelector('.ds-practice-toolbar [role="status"]').textContent,
      /正解 0 \/ 5 問（答え合わせ済み 1 問）/u)
    const saved = JSON.parse(window.localStorage.getItem(PRACTICE_RESULTS_KEY))
    assert.equal(saved.records.length, 1)
    assert.equal(saved.records[0].categoryId, ['mean-deviation', 'data-transformation', 'unbiased-variance', 'comprehensive', 'variance-standard-deviation'][categoryIndex])
    assert.equal(saved.records[0].isCorrect, false)
    assert.match(saved.records[0].attemptedAt, /^\d{4}-\d{2}-\d{2}T/u)

    if (question.type === 'choice') {
      await click(card.querySelectorAll('input[type="radio"]')[question.answer])
    } else {
      await changeTextInput(window, card.querySelector('input[type="text"]'), String(question.answer))
    }
    await act(async () => submit.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.match(card.querySelector('.ds-exercise-feedback').textContent, /正解/u)
    assert.match(app.host.querySelector('.ds-practice-toolbar [role="status"]').textContent,
      /正解 0 \/ 5 問（答え合わせ済み 1 問）/u, 'the current aggregate keeps the first wrong judgment')
    assert.equal(JSON.parse(window.localStorage.getItem(PRACTICE_RESULTS_KEY)).records.length, 1)

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

test('independent practice restores the regenerated question and first judgment across nested review', async () => {
  const practiceHash = '#/course/descriptive-statistics/practice'
  const app = await createHarness()
  const { window } = app.dom
  const originalRandom = Math.random
  const cardFor = (category) => app.host.querySelector('.ds-practice-question[data-practice-category="' + category + '"]')
  const submit = async (card) => act(async () => card.querySelector('form').dispatchEvent(
    new window.Event('submit', { bubbles: true, cancelable: true }),
  ))
  const returnLink = () => window.document.activeElement.nextElementSibling?.querySelector('a[data-nav-intent="return"]')
  const openQuestions = () => [...app.host.querySelectorAll('.ds-practice-question')]
    .map((card) => [card.dataset.practiceType, card.dataset.practiceSeed, card.querySelector('.ds-practice-prompt').textContent])
  const reviewSelector = 'a[data-nav-intent="review"]'

  try {
    const initialRandomValues = [0, 10 / 2 ** 32, 0.4, 11 / 2 ** 32, 0, 12 / 2 ** 32]
    Math.random = () => initialRandomValues.shift() ?? 0.2
    await app.remountAt(practiceHash)
    const before = openQuestions()

    const regenerationRandomValues = [0.9, 314 / 2 ** 32]
    Math.random = () => regenerationRandomValues.shift() ?? 0.2
    await click(buttonFor(cardFor(2), 'この問題を入れ替える'))
    const regenerated = openQuestions()
    assert.deepEqual(regenerated[2].slice(0, 2), ['2', '314'])
    assert.notDeepEqual(regenerated[2], before[2])
    assert.deepEqual(regenerated.filter((_, index) => index !== 2), before.filter((_, index) => index !== 2))

    const choice = cardFor(2)
    const question = generateDescriptiveStatisticsExercisePreviewQuestion(2, 2, 314)
    assert.equal(question.type, 'choice')
    const wrongIndex = question.answer === 0 ? 1 : 0
    await click(choice.querySelectorAll('input[type="radio"]')[question.answer])
    await submit(choice)
    await click(choice.querySelectorAll('input[type="radio"]')[wrongIndex])
    await submit(choice)
    await changeTextInput(window, cardFor(1).querySelector('input[type="text"]'), '１２.５')

    const saved = window.localStorage.getItem(PRACTICE_RESULTS_KEY)
    assert.equal(JSON.parse(saved).records.length, 1)
    assert.equal(JSON.parse(saved).records[0].isCorrect, true)
    assert.match(choice.querySelector('.ds-exercise-feedback').textContent, /違います/u)
    assert.equal(choice.querySelector('details').open, true)

    const reviewLinks = [...choice.querySelectorAll(reviewSelector)]
    const sourceIndex = reviewLinks.length - 1
    const source = reviewLinks[sourceIndex]
    const reviewHash = source.getAttribute('href')
    await click(source)
    await settleEffects(window)
    assert.equal(window.location.hash, reviewHash)
    const firstReturn = returnLink()
    assert.equal(firstReturn?.textContent, '演習に戻る')

    const nestedSource = window.document.activeElement.closest('.course-section')
      .querySelector('a[href="#/lesson/math-algebra-sigma/sigma"]')
    assert.ok(nestedSource)
    nestedSource.closest('details').open = true
    await click(nestedSource)
    await settleEffects(window)
    assert.equal(window.history.state.returnStack.length, 2)
    const backFromNestedReview = () => app.host.querySelector('.return-navigation a[data-nav-intent="return"]')
    await click(backFromNestedReview())
    await settleEffects(window)
    assert.equal(window.location.hash, reviewHash)
    assert.equal(window.history.state.returnStack.length, 1)
    await click(backFromNestedReview())
    await settleEffects(window)

    assert.equal(window.location.hash, practiceHash)
    assert.deepEqual(openQuestions(), regenerated)
    const restored = cardFor(2)
    assert.equal(restored.querySelectorAll('input[type="radio"]')[wrongIndex].checked, true)
    assert.equal(cardFor(1).querySelector('input[type="text"]').value, '１２.５')
    assert.match(restored.querySelector('.ds-exercise-feedback').textContent, /違います/u)
    assert.equal(restored.querySelector('details').open, true)
    assert.match(app.host.querySelector('.ds-practice-toolbar [role="status"]').textContent, /正解 1 \/ 5 問（答え合わせ済み 1 問）/u)
    assert.equal(window.document.activeElement, restored.querySelectorAll(reviewSelector)[sourceIndex])
    await submit(restored)
    assert.equal(window.localStorage.getItem(PRACTICE_RESULTS_KEY), saved)

    await click(restored.querySelectorAll(reviewSelector)[sourceIndex])
    await app.remount()
    await settleEffects(window)
    Math.random = () => 0.4
    await click(app.host.querySelector('.return-navigation a[data-nav-intent="return"]'))
    await settleEffects(window)

    assert.equal(window.location.hash, practiceHash)
    assert.equal(window.document.activeElement, app.host.querySelector('#page-title'))
    assert.notDeepEqual(openQuestions(), regenerated)
    assert.equal(app.host.querySelector('.ds-practice-toolbar [role="status"]').textContent, '')
    assert.equal(app.host.querySelector('input[type="radio"]:checked'), null)
    assert.equal(cardFor(1).querySelector('input[type="text"]').value, '')
    assert.equal(window.localStorage.getItem(PRACTICE_RESULTS_KEY), saved)
  } finally {
    Math.random = originalRandom
    await app.close()
  }
})

test('regenerating a checked choice question clears its radio selection before another grade', async () => {
  const app = await createHarness()
  const { window } = app.dom
  const originalRandom = Math.random
  const initialRandomValues = [0, 10 / 2 ** 32, 0.99, 11 / 2 ** 32, 0, 12 / 2 ** 32, 0, 13 / 2 ** 32, 0, 14 / 2 ** 32]
  try {
    Math.random = () => initialRandomValues.shift() ?? 0.2
    await app.remountAt('#/course/descriptive-statistics/practice')
    let card = app.host.querySelector('.ds-practice-question[data-practice-category="1"]')
    assert.equal(card.dataset.practiceType, '2')
    const oldSeed = Number(card.dataset.practiceSeed)
    const firstQuestion = generateDescriptiveStatisticsExercisePreviewQuestion(1, 2, oldSeed)
    assert.equal(firstQuestion.type, 'choice')

    const radios = [...card.querySelectorAll('input[type="radio"]')]
    await click(radios[0])
    await act(async () => card.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(JSON.parse(window.localStorage.getItem(PRACTICE_RESULTS_KEY)).records.length, 1)

    const regenerationRandomValues = [0, 15 / 2 ** 32]
    Math.random = () => regenerationRandomValues.shift() ?? 0.2
    await click(buttonFor(card, 'この問題を入れ替える'))
    card = app.host.querySelector('.ds-practice-question[data-practice-category="1"]')
    assert.equal(card.dataset.practiceType, '0')
    assert.notEqual(Number(card.dataset.practiceSeed), oldSeed)
    assert.ok([...card.querySelectorAll('input[type="radio"]')].every((input) => !input.checked))

    await act(async () => card.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.match(card.querySelector('.ds-exercise-feedback').textContent, /選択肢を選んでください/u)
    assert.equal(JSON.parse(window.localStorage.getItem(PRACTICE_RESULTS_KEY)).records.length, 1,
      'submitting after choice-to-choice regeneration must not add another judgment')
  } finally {
    Math.random = originalRandom
    await app.close()
  }
})

test('bulk regeneration isolates a failed question and keeps its grade and saved history', async () => {
  const app = await createHarness()
  const { window } = app.dom
  const originalRandom = Math.random
  try {
    await app.remountAt('#/course/descriptive-statistics/practice')
    const cards = [...app.host.querySelectorAll('.ds-practice-question')]
    for (const categoryIndex of [0, 1]) {
      const card = cards[categoryIndex]
      const question = generateDescriptiveStatisticsExercisePreviewQuestion(
        categoryIndex, Number(card.dataset.practiceType), Number(card.dataset.practiceSeed),
      )
      if (question.type === 'choice') {
        await click(card.querySelectorAll('input[type="radio"]')[question.answer === 0 ? 1 : 0])
      } else {
        await changeTextInput(window, card.querySelector('input[type="text"]'), String(Number(question.answer) + 1))
      }
      await act(async () => card.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    }
    assert.equal(JSON.parse(window.localStorage.getItem(PRACTICE_RESULTS_KEY)).records.length, 2)
    const beforeQuestions = cards.map((card) => [card.dataset.practiceType, card.dataset.practiceSeed])
    const failedCard = cards[1]
    const failedQuestion = [failedCard.dataset.practiceType, failedCard.dataset.practiceSeed]
    const failedFeedback = failedCard.querySelector('.ds-exercise-feedback').textContent
    const answerState = (card) => [...card.querySelectorAll('input')].map((input) => [input.value, input.checked])
    const failedAnswers = answerState(failedCard)

    const randomValues = [0.1, 0.2, 1, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    Math.random = () => randomValues.shift() ?? 0.2
    await click(buttonFor(app.host, '別の問題にする（5問すべて）'))

    const after = [...app.host.querySelectorAll('.ds-practice-question')]
    assert.deepEqual([after[1].dataset.practiceType, after[1].dataset.practiceSeed], failedQuestion)
    assert.match(after[1].querySelector('.ds-exercise-error').textContent, /表示できませんでした/u)
    assert.equal(after[1].querySelector('.ds-exercise-feedback').textContent, failedFeedback)
    assert.deepEqual(answerState(after[1]), failedAnswers)
    assert.ok(after[0].dataset.practiceType !== beforeQuestions[0][0]
      || after[0].dataset.practiceSeed !== beforeQuestions[0][1])
    assert.match(app.host.querySelector('.ds-practice-toolbar [role="status"]').textContent,
      /答え合わせ済み 1 問/u, 'only the failed card stays in the current aggregate')
    assert.equal(JSON.parse(window.localStorage.getItem(PRACTICE_RESULTS_KEY)).records.length, 2,
      'bulk regeneration does not remove saved history')
  } finally {
    Math.random = originalRandom
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
