import assert from 'node:assert/strict'
import test from 'node:test'
import { act, createElement } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { readLocalData } from '../src/local-data.mjs'
import { navigateRouteHistory } from '../src/route-history.mjs'
import { routeToHash } from '../src/resolve-screen.mjs'

const globalKeys = [
  'window', 'document', 'navigator', 'Element', 'HTMLElement', 'Node', 'Event', 'MouseEvent',
  'IS_REACT_ACT_ENVIRONMENT',
]

async function createHarness() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://sfqc.test/SfQC/#/practice',
    pretendToBeVisual: true,
  })
  const previousGlobals = new Map(globalKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  }
  dom.window.scrollTo = () => {}
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
    async close() {
      await unmount()
      await server.close()
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
