import { useEffect, useId, useState, type FormEvent } from 'react'
import type { QuestionDefinition, ReadonlyQuestionInstance } from './question-contract.mjs'
import { LessonReference, lessonRefLabel } from './lesson-view'

function questionPrompt(question: QuestionDefinition) {
  return question.kind === 'fixed' ? question.content.prompt : question.contentTemplate.promptTemplate
}

export function PracticeSelectionView({ questions, disabled, error, onStart }: {
  questions: QuestionDefinition[]
  disabled: boolean
  error: string
  onStart: (questionId: string) => void
}) {
  return (
    <section className="practice-panel" aria-labelledby="practice-selection-title">
      <h2 id="practice-selection-title">問題を選んでください</h2>
      {questions.length === 0 ? <p>現在利用できる問題はありません。</p> : (
        <ul className="practice-question-list">
          {questions.map((question) => (
            <li key={question.questionId}>
              <h3>{question.questionId}</h3>
              <p>{questionPrompt(question)}</p>
              <p>{question.difficulty}・{question.kind === 'fixed' ? '固定問題' : 'seed生成問題'}</p>
              <button type="button" disabled={disabled} onClick={() => onStart(question.questionId)}>
                この問題を始める
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="practice-error" role="alert">{error}</p>}
    </section>
  )
}

export function PracticeQuestionView({ instance, entryId, draft, error, busy, canCreateSimilar, similarUnavailableMessage, onDraftChange, onSubmit, onSimilar }: {
  instance: ReadonlyQuestionInstance
  entryId: string
  draft: string
  error: string
  busy: boolean
  canCreateSimilar: boolean
  similarUnavailableMessage: string
  onDraftChange: (draft: string) => boolean
  onSubmit: (answer: string) => void
  onSimilar: () => void
}) {
  const content = instance.questionDefinitionSnapshot.content
  const id = useId()
  const [answer, setAnswer] = useState(draft)
  const [draftWarning, setDraftWarning] = useState(false)
  const errorId = id + '-error'

  useEffect(() => {
    setAnswer(draft)
    setDraftWarning(false)
  }, [entryId, draft])

  const updateAnswer = (value: string) => {
    setAnswer(value)
    setDraftWarning(!onDraftChange(value))
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit(answer)
  }

  return (
    <section className="practice-panel" aria-labelledby="question-title">
      <p>出題ID：<code>{instance.instanceId}</code></p>
      <h2 id="question-title">問題</h2>
      <p>{content.prompt}</p>
      <p className="practice-conditions">{content.conditions}</p>
      <form className="practice-form" noValidate onSubmit={submit}>
        {content.format === 'single-choice' ? (
          <fieldset aria-describedby={error ? errorId : undefined}>
            <legend>選択肢を1つ選んでください</legend>
            {content.choices.map((choice, index) => {
              const choiceId = id + '-choice-' + index
              return (
                <label className="practice-choice" htmlFor={choiceId} key={choice.id}>
                  <input
                    id={choiceId}
                    type="radio"
                    name={id + '-answer'}
                    value={choice.id}
                    checked={answer === choice.id}
                    aria-invalid={error ? true : undefined}
                    disabled={busy}
                    onChange={(event) => updateAnswer(event.currentTarget.value)}
                  />
                  <span>{choice.id}：{choice.label}</span>
                </label>
              )
            })}
          </fieldset>
        ) : (
          <div className="practice-numeric-field">
            <label htmlFor={id + '-answer'}>回答を入力してください</label>
            <input
              id={id + '-answer'}
              className="practice-numeric-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={answer}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              disabled={busy}
              onChange={(event) => updateAnswer(event.currentTarget.value)}
            />
            <p>単位：{content.grading.unit}</p>
          </div>
        )}
        {error && <p className="practice-error" id={errorId} role="alert">{error}</p>}
        {draftWarning && <p className="practice-warning" role="status">入力をブラウザー履歴へ保存できませんでした。画面を離れると復元できません。</p>}
        <button type="submit" disabled={busy}>回答を送信する</button>
      </form>
      {instance.kind === 'generated' && (
        <div className="practice-actions">
          <button type="button" disabled={busy || !canCreateSimilar} onClick={onSimilar}>別の類題を解く</button>
          {!canCreateSimilar && <p role="status">{similarUnavailableMessage}</p>}
        </div>
      )}
      <div className="reference-group">
        <h3>関連する解説</h3>
        <ul>{instance.questionDefinitionSnapshot.lessonRefs.map((reference) => (
          <li key={reference}>
            <LessonReference targetRef={reference} label={lessonRefLabel(reference)} intent="review" />
          </li>
        ))}</ul>
      </div>
    </section>
  )
}
