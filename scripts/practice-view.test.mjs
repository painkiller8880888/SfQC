import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { createQuestionInstance } from '../src/question-contract.mjs'
import { getQuestionDefinition, questionRegistry } from '../src/question-registry.mjs'

test('practice question selection and answer forms render accessible choice and numeric controls', async () => {
  const server = await createServer({
    configFile: 'vite.config.ts',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  try {
    const { PracticeQuestionView, PracticeSelectionView } = await server.ssrLoadModule('/src/practice-view.tsx')
    const render = (component, props) => renderToStaticMarkup(createElement(component, props))
    const questions = questionRegistry
    const selection = render(PracticeSelectionView, {
      questions,
      disabled: false,
      error: '',
      onStart() {},
    })
    assert.match(selection, /問題を選んでください/u)
    assert.match(selection, /この問題を始める/u)
    assert.match(selection, /seed生成問題/u)

    const choiceDefinition = getQuestionDefinition('q-desc-var-sc-001')
    const choiceInstance = createQuestionInstance(choiceDefinition, { instanceId: 'view-choice' })
    const choice = render(PracticeQuestionView, {
      instance: choiceInstance,
      entryId: 'entry-choice',
      draft: '',
      error: '選択肢を1つ選んでください。',
      busy: false,
      canCreateSimilar: false,
      similarUnavailableMessage: '',
      onDraftChange() { return true },
      onSubmit() {},
      onSimilar() {},
    })
    assert.match(choice, /<fieldset/u)
    assert.match(choice, /<legend>選択肢を1つ選んでください<\/legend>/u)
    assert.match(choice, /type="radio"/u)
    assert.match(choice, /aria-invalid="true"/u)
    assert.match(choice, /role="alert"/u)

    const numericDefinition = getQuestionDefinition('q-desc-var-num-001')
    const numericInstance = createQuestionInstance(numericDefinition, { instanceId: 'view-numeric' })
    const numeric = render(PracticeQuestionView, {
      instance: numericInstance,
      entryId: 'entry-numeric',
      draft: '1e0',
      error: '符号付き整数または小数の十進数で入力してください。',
      busy: false,
      canCreateSimilar: false,
      similarUnavailableMessage: '',
      onDraftChange() { return true },
      onSubmit() {},
      onSimilar() {},
    })
    assert.match(numeric, /<label[^>]*>回答を入力してください<\/label>/u)
    assert.match(numeric, /type="text" inputMode="decimal"/u)
    assert.match(numeric, /value="1e0"/u)
    assert.match(numeric, /単位：mm²/u)
    assert.match(numeric, /aria-describedby="[^"]+"/u)
  } finally {
    await server.close()
  }
})
