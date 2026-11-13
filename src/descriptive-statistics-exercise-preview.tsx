import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { LessonReference } from './lesson-view'
import {
  createDescriptiveStatisticsExercisePreviewState,
  descriptiveStatisticsExerciseCategories,
  generateDescriptiveStatisticsExercisePreviewQuestion,
  nextDescriptiveStatisticsExercisePreviewState,
} from './descriptive-statistics-exercise-preview-data.mjs'
import type {
  DescriptiveStatisticsExercisePreviewState,
} from './descriptive-statistics-exercise-preview-data.mjs'
import practiceStyles from './course-practice.css?inline'

const sectionLabels: Record<string, string> = {
  mean: '1 平均',
  deviation: '2 偏差',
  variance: '3 範囲と分散',
  'standard-deviation': '4 標準偏差',
}

function parseAnswer(text: string) {
  const value = text.normalize('NFKC').replace(/−/gu, '-').replace(/\s+/gu, '')
  if (!value || !/^[+-]?\d+(\.\d+)?$/u.test(value)) return Number.NaN
  return Number(value)
}

function ExerciseCard({ categoryIndex, state, onGrade, onRegenerate }: {
  categoryIndex: number
  state: DescriptiveStatisticsExercisePreviewState
  onGrade: (correct: boolean) => void
  onRegenerate: () => void
}) {
  const id = useId()
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const gradedQuestionRef = useRef('')
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState({ kind: '', text: '' })
  const question = generateDescriptiveStatisticsExercisePreviewQuestion(categoryIndex, state.typeIndex, state.seed)
  const questionKey = descriptiveStatisticsExerciseCategories[categoryIndex].id + ':' + state.seed + ':' + state.typeIndex
  const titleId = `${id}-title`

  useEffect(() => {
    setAnswer('')
    setFeedback({ kind: '', text: '' })
    gradedQuestionRef.current = ''
    if (detailsRef.current) detailsRef.current.open = false
  }, [state.seed, state.typeIndex])

  const checkAnswer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    let correct: boolean
    if (question.type === 'choice') {
      const selected = event.currentTarget.querySelector<HTMLInputElement>('input[name="answer"]:checked')?.value
      if (selected === undefined) {
        setFeedback({ kind: 'ng', text: '選択肢を選んでください。' })
        return
      }
      correct = Number(selected) === question.answer
    } else {
      const value = parseAnswer(answer)
      if (Number.isNaN(value)) {
        setFeedback({ kind: 'ng', text: '数字で入力してください（例：12、−2、+3、0.5）。' })
        return
      }
      correct = Math.abs(value - Number(question.answer)) < 1e-6
    }
    if (gradedQuestionRef.current !== questionKey) {
      gradedQuestionRef.current = questionKey
      onGrade(correct)
    }
    if (correct) {
      setFeedback({ kind: 'ok', text: '正解です。' })
      if (detailsRef.current) detailsRef.current.open = true
    } else {
      setFeedback({ kind: 'ng', text: '違います。考え直すか、「解説を見る」で考え方を確認してください。' })
    }
  }

  return <section className="ds-practice-question" aria-labelledby={titleId} data-practice-category={categoryIndex} data-practice-type={state.typeIndex} data-practice-seed={state.seed}>
    <div className="ds-practice-question-heading">
      <h2 id={titleId}>問{categoryIndex + 1}：{descriptiveStatisticsExerciseCategories[categoryIndex].title}</h2>
      <p>確認する節：{question.sections.map((sectionId, index) => <span key={sectionId}>
        {index > 0 && '・'}<LessonReference
          targetRef={`descriptive-statistics#${sectionId}`}
          label={sectionLabels[sectionId] ?? sectionId}
          intent="review"
        />
      </span>)}</p>
    </div>
    <p className="ds-practice-prompt">{question.prompt}</p>
    {question.table && <div className="ds-practice-table-wrap">
      <table>
        <caption>ラインごとに測った値</caption>
        <thead><tr><th scope="col">ライン</th>{question.table.rows[0].values.map((_, index) => <th scope="col" key={index}>{index + 1}個目</th>)}</tr></thead>
        <tbody>{question.table.rows.map((row) => <tr key={row.label}>
          <th scope="row">{row.label}</th>{row.values.map((value, index) => <td className="num" key={index}>{value}</td>)}
        </tr>)}</tbody>
      </table>
    </div>}
    {question.calculation && <div className="ds-practice-calculation" aria-label="計算過程">
      {question.calculation.map((step) => <p key={step}>{step}</p>)}
    </div>}
    <form className="ds-practice-answer" onSubmit={checkAnswer}>
      {question.type === 'choice' ? <fieldset>
        <legend>選択肢を1つ選んでください</legend>
        {question.choices.map((choice, index) => <label className="ds-practice-choice" htmlFor={`${id}-choice-${index}`} key={choice}>
          <input id={`${id}-choice-${index}`} type="radio" name="answer" value={index} />
          <span><b>{String.fromCharCode('ア'.charCodeAt(0) + index)}：</b>{choice}</span>
        </label>)}
      </fieldset> : <label className="ds-practice-number" htmlFor={`${id}-answer`}>
        答え
        <input
          id={`${id}-answer`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={answer}
          onChange={(event) => setAnswer(event.currentTarget.value)}
        />
        <span>{question.unit}</span>
      </label>}
      <div className="ds-exercise-actions">
        <button className="ds-button ds-button-primary" type="submit">答え合わせ</button>
        <button className="ds-button" type="button" onClick={onRegenerate}>この問題を入れ替える</button>
      </div>
    </form>
    <p className={`ds-exercise-feedback ${feedback.kind}`} role="status" aria-live="polite">{feedback.text}</p>
    <details ref={detailsRef}>
      <summary>解説を見る</summary>
      <p className="ds-exercise-solution">{question.explanation}</p>
    </details>
  </section>
}

export function DescriptiveStatisticsExercisePreview({ currentLessonHref, onFirstGrade }: {
  currentLessonHref: string
  onFirstGrade?: (categoryId: string, isCorrect: boolean) => void
}) {
  const [questions, setQuestions] = useState(() => descriptiveStatisticsExerciseCategories.map((_, index) =>
    createDescriptiveStatisticsExercisePreviewState(index)))
  const [grades, setGrades] = useState<(boolean | null)[]>(() => Array(descriptiveStatisticsExerciseCategories.length).fill(null))
  const questionListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = practiceStyles
    document.head.append(style)
    return () => style.remove()
  }, [])

  const regenerateOne = (categoryIndex: number) => {
    setQuestions((current) => current.map((state, index) => index === categoryIndex
      ? nextDescriptiveStatisticsExercisePreviewState(categoryIndex, state) : state))
    setGrades((current) => current.map((grade, index) => index === categoryIndex ? null : grade))
  }
  const regenerateAll = () => {
    setQuestions((current) => current.map((state, index) => nextDescriptiveStatisticsExercisePreviewState(index, state)))
    setGrades(Array(descriptiveStatisticsExerciseCategories.length).fill(null))
    questionListRef.current?.scrollIntoView?.({ block: 'start' })
  }
  const answered = grades.filter((grade) => grade !== null).length
  const correct = grades.filter(Boolean).length

  return <section className="lesson-panel course-practice" aria-label="基本統計量の演習">
    <div className="course-practice-content">
      <header className="ds-practice-header">
        <p>平均、偏差、分散、標準偏差の理解を確かめる5問です。5つの分野から1問ずつ出題します。問題ごとに内容を入れ替えて、考え方を繰り返し確認できます。</p>
        <div className="ds-practice-toolbar">
          <button className="ds-button ds-button-primary" type="button" onClick={regenerateAll}>別の問題にする（5問すべて）</button>
          <p role="status" aria-live="polite">{answered === 0 ? '' : `正解 ${correct} / 5 問（答え合わせ済み ${answered} 問）${correct === 5 ? '　全問正解です。' : ''}`}</p>
        </div>
      </header>
      <div className="ds-practice-list" ref={questionListRef}>
        {questions.map((state, categoryIndex) => <ExerciseCard
          key={categoryIndex}
          categoryIndex={categoryIndex}
          state={state}
          onGrade={(isCorrect) => {
            setGrades((current) => current.map((grade, index) => index === categoryIndex ? isCorrect : grade))
            onFirstGrade?.(descriptiveStatisticsExerciseCategories[categoryIndex].id, isCorrect)
          }}
          onRegenerate={() => regenerateOne(categoryIndex)}
        />)}
      </div>
      <div className="ds-practice-footer">
        <button className="ds-button ds-button-primary" type="button" onClick={regenerateAll}>別の問題にする（5問すべて）</button>
        <p><a href={currentLessonHref} data-nav-intent="normal">基本統計量の解説に戻る</a></p>
      </div>
    </div>
  </section>
}
