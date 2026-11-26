import { useImperativeHandle, useRef, useState, type Ref } from 'react'
import { ExerciseQuestionCard, type ExerciseAttemptSnapshot } from './lesson-view'
import type { ExerciseInstance } from './lesson-contract.mjs'
import { generateLessonExercise } from './lesson-exercise-adapters.mjs'
import {
  createDescriptiveStatisticsExercisePreviewState,
  descriptiveStatisticsExerciseCategories,
  nextDescriptiveStatisticsExercisePreviewState,
} from './descriptive-statistics-exercise-preview-data.mjs'
import type {
  DescriptiveStatisticsExercisePreviewState,
} from './descriptive-statistics-exercise-preview-data.mjs'

type PracticeQuestion = {
  state: DescriptiveStatisticsExercisePreviewState
  instance: ExerciseInstance | null
  error: string | null
  presentation: { attempt: ExerciseAttemptSnapshot | null; firstGrade: boolean | null }
}

export type PracticeScreenSnapshot = { questions: PracticeQuestion[] }

function createPracticeQuestion(categoryIndex: number, state: DescriptiveStatisticsExercisePreviewState): PracticeQuestion {
  const presentation = { attempt: null, firstGrade: null }
  try {
    const exerciseId = descriptiveStatisticsExerciseCategories[categoryIndex].typeIds[state.typeIndex]
    return { state, presentation, instance: generateLessonExercise('descriptive-statistics', exerciseId, state.seed), error: null }
  } catch {
    return { state, presentation, instance: null, error: 'この問題を表示できません。' }
  }
}

export function DescriptiveStatisticsExercisePreview({ currentLessonHref, onFirstGrade, initialSnapshot, snapshotRef }: {
  currentLessonHref: string
  onFirstGrade?: (categoryId: string, isCorrect: boolean) => void
  initialSnapshot?: PracticeScreenSnapshot
  snapshotRef?: Ref<() => PracticeScreenSnapshot>
}) {
  const [questions, setQuestions] = useState(() => initialSnapshot?.questions
    ?? descriptiveStatisticsExerciseCategories.map((_, index) =>
      createPracticeQuestion(index, createDescriptiveStatisticsExercisePreviewState(index))))
  const [grades, setGrades] = useState(() => questions.map((question) => question.presentation.firstGrade))
  const questionListRef = useRef<HTMLDivElement>(null)
  const attemptRefs = useRef<((() => ExerciseAttemptSnapshot) | null)[]>([])

  const saveAttempt = (categoryIndex: number) => {
    questions[categoryIndex].presentation.attempt = attemptRefs.current[categoryIndex]?.() ?? null
  }
  useImperativeHandle(snapshotRef, () => () => {
    // Returning creates another history entry for the same presented questions.
    questions.forEach((_, index) => saveAttempt(index))
    return { questions }
  }, [questions])

  const nextQuestion = (categoryIndex: number, current: PracticeQuestion) => {
    try {
      const nextState = nextDescriptiveStatisticsExercisePreviewState(categoryIndex, current.state)
      const question = createPracticeQuestion(categoryIndex, nextState)
      if (question.instance) return { question, regenerated: true }
    } catch {
      // Keep the current question and its state when generation fails.
    }
    return { question: { ...current, error: current.instance
      ? '別の問題を表示できませんでした。表示中の問題を保っています。' : 'この問題を表示できません。' }, regenerated: false }
  }

  const regenerateOne = (categoryIndex: number) => {
    const result = nextQuestion(categoryIndex, questions[categoryIndex])
    if (result.regenerated) saveAttempt(categoryIndex)
    setQuestions((current) => current.map((question, index) => index === categoryIndex ? result.question : question))
    if (result.regenerated) setGrades((current) => current.map((grade, index) => index === categoryIndex ? null : grade))
  }

  const regenerateAll = () => {
    const results = questions.map((question, index) => nextQuestion(index, question))
    results.forEach((result, index) => {
      if (result.regenerated) saveAttempt(index)
    })
    setQuestions(results.map((result) => result.question))
    setGrades((current) => current.map((grade, index) => results[index].regenerated ? null : grade))
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
        {questions.map((question, categoryIndex) => <ExerciseQuestionCard
          key={categoryIndex}
          instance={question.instance}
          exerciseId={question.instance?.exerciseId ?? descriptiveStatisticsExerciseCategories[categoryIndex].typeIds[question.state.typeIndex]}
          title={`問${categoryIndex + 1}：${descriptiveStatisticsExerciseCategories[categoryIndex].title}`}
          headingLevel={2}
          error={question.error}
          onFirstGrade={(isCorrect) => {
            if (question.presentation.firstGrade !== null) return
            question.presentation.firstGrade = isCorrect
            setGrades((current) => current.map((grade, index) => index === categoryIndex ? isCorrect : grade))
            onFirstGrade?.(descriptiveStatisticsExerciseCategories[categoryIndex].id, isCorrect)
          }}
          onRegenerate={() => regenerateOne(categoryIndex)}
          initialAttempt={question.presentation.attempt}
          attemptRef={(getAttempt) => { attemptRefs.current[categoryIndex] = getAttempt }}
          dataPracticeCategory={categoryIndex}
          dataPracticeType={question.state.typeIndex}
          dataPracticeSeed={question.state.seed}
        />)}
      </div>
      <div className="ds-practice-footer">
        <button className="ds-button ds-button-primary" type="button" onClick={regenerateAll}>別の問題にする（5問すべて）</button>
        <p><a href={currentLessonHref} data-nav-intent="normal">基本統計量の解説に戻る</a></p>
      </div>
    </div>
  </section>
}
