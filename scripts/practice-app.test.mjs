import assert from 'node:assert/strict'
import test from 'node:test'
import { act, createElement } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { exportLocalData, importLocalData, readLocalData } from '../src/local-data.mjs'
import { createRouteHistoryState, navigateRouteHistory } from '../src/route-history.mjs'
import { routeToHash } from '../src/resolve-screen.mjs'

const globalKeys = [
  'window', 'document', 'navigator', 'Element', 'HTMLElement', 'Node', 'Event', 'MouseEvent',
  'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'IS_REACT_ACT_ENVIRONMENT',
]

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function createHarness() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://sfqc.test/SfQC/#/practice',
    pretendToBeVisual: true,
  })
  const previousGlobals = new Map(globalKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const previousMetrics = new Map(['offsetWidth', 'offsetHeight'].map((key) => [
    key, Object.getOwnPropertyDescriptor(dom.window.HTMLElement.prototype, key),
  ]))
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
    ResizeObserver: TestResizeObserver,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  }
  dom.window.scrollTo = () => {}
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
  const mount = async () => act(async () => root.render(createElement(App)))
  const unmount = async () => act(async () => root.unmount())
  await mount()

  return {
    dom,
    host,
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
    assert.equal(app.host.querySelector('.map-selection').textContent, `選択中: ${lessonNode.textContent}`)

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
