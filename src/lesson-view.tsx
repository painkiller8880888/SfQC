import { useId, useImperativeHandle, useRef, useState, type FormEvent, type ReactNode, type Ref, type RefObject } from 'react'
import { lessonRegistry } from './lesson-registry.mjs'
import {
  getExerciseGradingData,
  getExerciseQuestionDisplay,
  parseLessonRef,
  type ExerciseGenerator,
  type ExerciseInstance,
  type ExerciseQuestionDisplay,
  type IncludedLessonDefinition,
  type LessonDefinition,
  type LessonRegistry,
} from './lesson-contract.mjs'
import { routeToHash, type AppRoute } from './resolve-screen.mjs'
import type { NavigationIntent } from './route-history.mjs'
import { FigureRef } from './figures/figure-ref'
import { hasCoursePractice, type CourseProgress } from './course-progress.mjs'
import { getManualProgressLabel, type ManualLessonProgress, type ManualProgressCommand, type ManualProgressState } from './manual-progress.mjs'
import { gradeNumericExerciseAnswers } from './question-grading.mjs'
import { generateLessonExercise, lessonExerciseGenerators } from './lesson-exercise-adapters.mjs'
import './course-practice.css'

export function resolveLessonRef(reference: string, registry: LessonRegistry = lessonRegistry): AppRoute | null {
  const parsed = parseLessonRef(reference)
  const lesson = parsed && registry.lessons.find((item) => item.lessonId === parsed.lessonId)
  if (!parsed || lesson?.availability !== 'included') return null
  if (parsed.sectionId && !lesson.sections.some((section) => section.sectionId === parsed.sectionId)) return null
  return parsed.lessonId === 'descriptive-statistics'
    ? { kind: 'course-lesson', courseId: parsed.lessonId, sectionId: parsed.sectionId ?? lesson.sections[0].sectionId }
    : { kind: 'lesson-id', lessonId: parsed.lessonId, sectionId: parsed.sectionId }
}

export function lessonRefLabel(reference: string, registry: LessonRegistry = lessonRegistry) {
  const parsed = parseLessonRef(reference)
  if (!parsed) return reference
  const lesson = registry.lessons.find((item) => item.lessonId === parsed.lessonId)
  if (!lesson) return reference
  if (!parsed.sectionId) return lesson.title
  const section = lesson.availability === 'included'
    ? lesson.sections.find((item) => item.sectionId === parsed.sectionId)
    : undefined
  return section ? `${lesson.title}：${section.title}` : `${lesson.title}（節ID ${parsed.sectionId}）`
}

export function LessonReference({ targetRef, label, intent = 'review', ariaLabel, registry = lessonRegistry, onClick }: {
  targetRef: string
  label?: string
  intent?: NavigationIntent
  ariaLabel?: string
  registry?: LessonRegistry
  onClick?: () => void
}) {
  const parsed = parseLessonRef(targetRef)
  const lesson = parsed && registry.lessons.find((item) => item.lessonId === parsed.lessonId)
  const route = resolveLessonRef(targetRef, registry)
  const text = label ?? lessonRefLabel(targetRef, registry)
  if (onClick && lesson && parsed) return <button type="button" className="lesson-reference-button" onClick={onClick}>{text}</button>
  if (route) return <a href={routeToHash(route)} data-nav-intent={intent} aria-label={ariaLabel}>{text}</a>
  const status = !lesson ? '教材未登録' : lesson.availability === 'planned' ? '未収録' : '節未収録'
  return <span className="lesson-reference-unavailable">{text}（{status}）</span>
}

const descriptiveStatisticsSectionLabels: Readonly<Record<string, string>> = {
  mean: '1 平均',
  deviation: '2 偏差',
  variance: '3 範囲と分散',
  'standard-deviation': '4 標準偏差',
}
const exerciseChoiceLabels = ['ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ']

function exerciseReviewLabel(targetRef: string, registry: LessonRegistry) {
  const parsed = parseLessonRef(targetRef)
  const lesson = parsed && registry.lessons.find((item) => item.lessonId === parsed.lessonId)
  if (!parsed?.sectionId || !lesson || lesson.availability !== 'included') return undefined
  const section = lesson.sections.find((item) => item.sectionId === parsed.sectionId)
  if (!section) return undefined
  return lesson.lessonId === 'descriptive-statistics'
    ? descriptiveStatisticsSectionLabels[section.sectionId] ?? section.title
    : lessonRefLabel(targetRef, registry)
}

export type ExerciseAttemptSnapshot = {
  answers: Record<string, string>
  selectedChoiceId: string
  latestGrade: boolean | null
  feedback: { kind: string; text: string } | null
  choiceFeedback: { misconception: string; reviewSectionRefs?: string[] } | null
  solutionOpen: boolean
}

type ExerciseQuestionCardProps = {
  instance: ExerciseInstance | null
  initialAttempt?: ExerciseAttemptSnapshot | null
  attemptRef?: Ref<() => ExerciseAttemptSnapshot>
  title: string
  headingLevel?: 2 | 3 | 4
  exerciseId?: string
  registry?: LessonRegistry
  error?: string | null
  onFirstGrade?: (correct: boolean) => void
  onRegenerate?: () => void
  regenerateLabel?: string
  dataPracticeCategory?: number
  dataPracticeType?: number
  dataPracticeSeed?: number
  className?: string
}

function quantityCellClass(value: number | string, columnLabel?: string) {
  if (columnLabel?.includes('コード') || columnLabel?.endsWith('番号')) return undefined
  return typeof value === 'number' || /^[−+-]?\d+(?:\.\d+)?(?:\s*(?:mm²?|件|個))?$/u.test(value) ? 'num' : undefined
}

function ExerciseQuestionBody({ formId, display, grading, registry, onFirstGrade, initialAttempt, attemptRef }: {
  formId: string
  initialAttempt?: ExerciseAttemptSnapshot | null
  attemptRef?: Ref<() => ExerciseAttemptSnapshot>
  display: ExerciseQuestionDisplay
  grading: ReturnType<typeof getExerciseGradingData>
  registry: LessonRegistry
  onFirstGrade?: (correct: boolean) => void
}) {
  const id = useId()
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [answers, setAnswers] = useState<Record<string, string>>(initialAttempt?.answers ?? {})
  const [selectedChoiceId, setSelectedChoiceId] = useState(initialAttempt?.selectedChoiceId ?? '')
  const [latestGrade, setLatestGrade] = useState(initialAttempt?.latestGrade ?? null)
  const [feedback, setFeedback] = useState(initialAttempt?.feedback ?? null)
  const [choiceFeedback, setChoiceFeedback] = useState(initialAttempt?.choiceFeedback ?? null)
  const firstGradeSent = useRef(latestGrade !== null)

  useImperativeHandle(attemptRef, () => () => ({
    answers, selectedChoiceId, latestGrade, feedback, choiceFeedback,
    solutionOpen: detailsRef.current?.open ?? false,
  }), [answers, selectedChoiceId, latestGrade, feedback, choiceFeedback])

  const checkAnswer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    let correct: boolean
    let selectedFeedback: typeof choiceFeedback = null
    if (display.response.type === 'choice') {
      if (grading.evaluation.type !== 'choice') {
        setFeedback({ kind: 'error', text: 'この問題を採点できません。' })
        return
      }
      const correctChoiceId = grading.evaluation.correctChoiceId
      if (!display.response.choices.some((choice) => choice.id === correctChoiceId)) {
        setFeedback({ kind: 'error', text: 'この問題を採点できません。' })
        return
      }
      if (!selectedChoiceId) {
        setFeedback({ kind: 'ng', text: '選択肢を選んでください。' })
        return
      }
      correct = selectedChoiceId === correctChoiceId
      selectedFeedback = correct ? null : grading.solution.choiceFeedback?.find((item) => item.choiceId === selectedChoiceId) ?? null
    } else {
      if (grading.evaluation.type !== 'numeric') {
        setFeedback({ kind: 'error', text: 'この問題を採点できません。' })
        return
      }
      const result = gradeNumericExerciseAnswers(display.response.fields, grading.evaluation.answers, answers)
      if (result.status === 'invalid') {
        setFeedback({ kind: result.reason === 'invalid-grading-definition' ? 'error' : 'ng', text: result.reason === 'invalid-grading-definition'
          ? 'この問題を採点できません。' : '入力形式を確認し、未回答の欄を埋めてください（例：12、−2、0.5）。' })
        return
      }
      correct = result.isCorrect
    }

    setLatestGrade(correct)
    setChoiceFeedback(selectedFeedback)
    setFeedback(null)
    if (correct && detailsRef.current) detailsRef.current.open = true
    if (!firstGradeSent.current) {
      firstGradeSent.current = true
      // The caller records only the first valid grade for this instance.
      onFirstGrade?.(correct)
    }
  }

  const tables = Array.isArray(display.table) ? display.table : display.table ? [display.table] : []
  const statusText = feedback?.text ?? (latestGrade === null ? '' : latestGrade
    ? '正解です。解説で考え方を確認できます。' : '違います。考え直すか、解説を確認してください。')

  return <>
    <p className="ds-practice-prompt">{display.prompt}</p>
    {tables.map((table, tableIndex) => <div className="ds-practice-table-wrap" tabIndex={0} key={tableIndex}>
      <table>
        {table.caption && <caption>{table.caption}</caption>}
        <thead><tr><th scope="col">{table.rowHeaderLabel ?? ''}</th>{table.rows[0].values.map((_, index) => <th scope="col" key={index}>
          {table.columnLabels?.[index] ?? String(index + 1)}
        </th>)}</tr></thead>
        <tbody>{table.rows.map((row, rowIndex) => <tr key={rowIndex}>
          <th scope="row">{row.label}</th>{row.values.map((value, index) => <td key={index} className={quantityCellClass(value, table.columnLabels?.[index])}>{value}</td>)}
        </tr>)}</tbody>
      </table>
    </div>)}
    {display.calculations && <div className="ds-practice-calculation" aria-label="計算過程">
      {display.calculations.map((calculation, index) => <p key={index}>{calculation}</p>)}
    </div>}
    <form id={formId} className="ds-practice-answer" onSubmit={checkAnswer}>
      {display.response.type === 'choice' ? <fieldset>
        <legend>選択肢を1つ選んでください</legend>
        {display.response.choices.map((choice, index) => <label className="ds-practice-choice" htmlFor={`${id}-choice-${index}`} key={choice.id}>
          <input id={`${id}-choice-${index}`} type="radio" name={`${id}-answer`} value={choice.id}
            checked={selectedChoiceId === choice.id} onChange={() => setSelectedChoiceId(choice.id)} />
          <span><b>{exerciseChoiceLabels[index] ?? String(index + 1)}：</b>{choice.text}</span>
        </label>)}
      </fieldset> : display.response.fields.map((field, index) => {
        const roundingInstruction = field.roundingInstruction ?? (field.roundingDigits === 0
          ? '整数に丸めて判定します' : `小数第${field.roundingDigits}位まで丸めて判定します`)
        return <label className="ds-practice-number" htmlFor={`${id}-answer-${index}`} key={field.id}>
          {field.label}
          <input id={`${id}-answer-${index}`} type="text" inputMode="decimal" autoComplete="off" value={answers[field.id] ?? ''}
            onChange={(changeEvent) => {
              const value = changeEvent.currentTarget.value
              setAnswers((current) => ({ ...current, [field.id]: value }))
            }} />
          <span>{field.unit ? `${field.unit}、${roundingInstruction}` : roundingInstruction}</span>
        </label>
      })}
    </form>
    <p className={`ds-exercise-feedback ${feedback?.kind ?? (latestGrade === null ? '' : latestGrade ? 'ok' : 'ng')}`} role="status" aria-live="polite">{statusText}</p>
    {feedback && latestGrade !== null && <p className="ds-exercise-latest-grade">最新の有効判定：{latestGrade ? '正解' : '不正解'}</p>}
    {choiceFeedback && <>
      <p className="ds-exercise-misconception">{choiceFeedback.misconception}</p>
      {choiceFeedback.reviewSectionRefs?.length ? <p className="ds-exercise-review-links">復習先：{choiceFeedback.reviewSectionRefs.map((targetRef, index) => <span key={`${targetRef}-${index}`}>
        {index > 0 && '・'}<LessonReference targetRef={targetRef} registry={registry} />
      </span>)}</p> : null}
    </>}
    <details ref={detailsRef} open={initialAttempt?.solutionOpen}>
      <summary>解説を見る</summary>
      {grading.solution.steps?.length ? <ol className="ds-exercise-steps">{grading.solution.steps.map((step, index) => <li key={index}>{step}</li>)}</ol> : null}
      <p className="ds-exercise-solution">{grading.solution.explanation}</p>
    </details>
  </>
}

export function ExerciseQuestionCard({ instance, title, headingLevel = 2, exerciseId, registry = lessonRegistry,
  initialAttempt, attemptRef, error, onFirstGrade, onRegenerate, regenerateLabel = 'この問題を入れ替える',
  dataPracticeCategory, dataPracticeType, dataPracticeSeed, className = '' }: ExerciseQuestionCardProps) {
  const id = useId()
  let display: ExerciseQuestionDisplay | null = null
  let grading: ReturnType<typeof getExerciseGradingData> | null = null
  if (instance) {
    try {
      display = getExerciseQuestionDisplay(instance)
      grading = getExerciseGradingData(instance)
    } catch {
      // A stale or invalid instance must not break the rest of the lesson.
    }
  }
  const Heading = headingLevel === 2 ? 'h2' : headingLevel === 3 ? 'h3' : 'h4'
  const questionError = error ?? (instance && !display ? 'この問題を表示できません。' : null)

  return <section className={`ds-practice-question ${className}`.trim()} aria-labelledby={`${id}-title`}
    data-exercise-id={exerciseId ?? instance?.exerciseId}
    data-practice-category={dataPracticeCategory} data-practice-type={dataPracticeType} data-practice-seed={dataPracticeSeed}>
    <div className="ds-practice-question-heading">
      <Heading id={`${id}-title`}>{title}</Heading>
      {!!display?.reviewSectionRefs.length && <p>確認する節：{display.reviewSectionRefs.map((targetRef, index) => {
        return <span key={`${targetRef}-${index}`}>
          {index > 0 && '・'}<LessonReference targetRef={targetRef} label={exerciseReviewLabel(targetRef, registry)} intent="review" registry={registry} />
        </span>
      })}</p>}
    </div>
    {questionError && <p className="ds-exercise-error" role="status">{questionError}</p>}
    {instance && display && grading
      ? <ExerciseQuestionBody key={instance.instanceId} formId={`${id}-form`} display={display} grading={grading}
        registry={registry} onFirstGrade={onFirstGrade} initialAttempt={initialAttempt} attemptRef={attemptRef} />
      : !questionError && <p className="ds-exercise-error">この問題を表示できません。</p>}
    <div className="ds-exercise-actions">
      {instance && display && grading && <button className="ds-button ds-button-primary" type="submit" form={`${id}-form`}>答え合わせ</button>}
      {onRegenerate && <button className="ds-button" type="button" onClick={onRegenerate}>{regenerateLabel}</button>}
    </div>
  </section>
}

function InternalLink({ route, intent = 'normal', children, current }: {
  route: AppRoute
  intent?: NavigationIntent
  children: ReactNode
  current?: boolean
}) {
  if (current) return <span aria-current="page">{children}（閲覧中）</span>
  return <a href={routeToHash(route)} data-nav-intent={intent}>{children}</a>
}

function ReferenceGroups({ lesson, currentRef, headingLevel = 3, registry = lessonRegistry, onMapPrerequisiteSelect }: {
  lesson: LessonDefinition
  currentRef?: string
  headingLevel?: 3 | 4
  registry?: LessonRegistry
  onMapPrerequisiteSelect?: (targetRef: string) => void
}) {
  const conditionals = lesson.conditionalPrerequisites.filter((item) => !currentRef || item.methodSectionRef === currentRef)
  const optionalReviews = lesson.optionalReviews.filter((item) => !currentRef || item.fromRef === currentRef)
  const Heading = headingLevel === 4 ? 'h4' : 'h3'

  return <>
    {lesson.commonPrerequisites.length > 0 && <section className="reference-group">
      <Heading>共通必須前提</Heading>
      <p>この単元を学ぶ前に必要な内容です。</p>
      <ul>{lesson.commonPrerequisites.map((reference) => <li key={reference}>
        <LessonReference targetRef={reference} registry={registry}
          onClick={onMapPrerequisiteSelect ? () => onMapPrerequisiteSelect(reference) : undefined} />
      </li>)}</ul>
    </section>}
    {conditionals.length > 0 && <section className="reference-group">
      <Heading>方法条件付き必須</Heading>
      <p>選ぶ方法や条件に応じて必要になる内容です。</p>
      <ul>{conditionals.map((item) => <li key={item.conditionId}>
        <p>方法節：<LessonReference targetRef={item.methodSectionRef} registry={registry} /></p>
        <p>適用条件：{item.condition}</p>
        <p>必要な前提：<LessonReference targetRef={item.prerequisiteRef} registry={registry} /></p>
      </li>)}</ul>
    </section>}
    {optionalReviews.length > 0 && <section className="reference-group">
      <Heading>任意復習</Heading>
      <ul>{optionalReviews.map((item) => <li key={item.fromRef + item.targetRef}>
        <LessonReference targetRef={item.targetRef} registry={registry} />
        <p>{item.context}</p>
      </li>)}</ul>
    </section>}
  </>
}

function MathText({ text }: { text: string }) {
  // shortcut: handles only single-character and brace-group subscripts/superscripts, extend when new math notation is added.
  const parts: ReactNode[] = []
  const marker = /([_^])(?:\{([^{}]*)\}|([A-Za-z0-9]))/gu
  const matches = [...text.matchAll(marker)]
  if (matches.length !== (text.match(/[_^]/gu) ?? []).length) return <>{text}</>
  let end = 0
  let index = 0
  for (const match of matches) {
    const position = match.index
    if (position > end) parts.push(text.slice(end, position))
    const value = match[2] ?? match[3]
    parts.push(match[1] === '_'
      ? <sub key={index}>{value}</sub>
      : <sup key={index}>{value}</sup>)
    end = position + match[0].length
    index += 1
  }
  parts.push(text.slice(end))
  return <>{parts}</>
}

function LessonExerciseSlot({ exerciseId, lesson, registry, exerciseGenerators }: {
  exerciseId: string
  lesson: IncludedLessonDefinition
  registry: LessonRegistry
  exerciseGenerators: Readonly<Record<string, ExerciseGenerator>>
}) {
  type QuestionState = { cursor: number | undefined; instance: ExerciseInstance | null; error: string | null }
  const definition = registry.exerciseCatalog?.definitions.find((item) => item.lessonId === lesson.lessonId && item.exerciseId === exerciseId)
  const generation = definition?.generation
  const initialInput = generation?.kind === 'fixed' ? undefined : generation?.minimum
  const [question, setQuestion] = useState<QuestionState>(() => {
    try {
      return { cursor: initialInput, instance: generateLessonExercise(lesson.lessonId, exerciseId, initialInput, registry, exerciseGenerators), error: null }
    } catch {
      return { cursor: initialInput, instance: null, error: 'この問題を表示できません。' }
    }
  })
  const canRegenerate = generation && generation.kind !== 'fixed' && generation.maximum > generation.minimum
  const regenerate = () => {
    if (!canRegenerate) return
    const nextInput = question.cursor === undefined || question.cursor >= generation.maximum
      ? generation.minimum : question.cursor + 1
    try {
      const instance = generateLessonExercise(lesson.lessonId, exerciseId, nextInput, registry, exerciseGenerators)
      setQuestion({ cursor: nextInput, instance, error: null })
    } catch {
      setQuestion((current) => ({ ...current, cursor: nextInput, error: current.instance
        ? '別の問題を表示できませんでした。表示中の問題を保っています。' : 'この問題を表示できません。' }))
    }
  }

  return <ExerciseQuestionCard instance={question.instance} exerciseId={exerciseId} title="確認問題" headingLevel={4}
    registry={registry} error={question.error} onRegenerate={canRegenerate ? regenerate : undefined} regenerateLabel="別の問題" />
}

function LessonBlock({ block, lesson, registry, exerciseGenerators, exerciseResetKeys, renderExercise }: {
  block: IncludedLessonDefinition['sections'][number]['blocks'][number]
  lesson: IncludedLessonDefinition
  registry: LessonRegistry
  exerciseGenerators: Readonly<Record<string, ExerciseGenerator>>
  exerciseResetKeys?: Readonly<Record<string, number>>
  renderExercise?: (exerciseId: string, key: string) => ReactNode
}) {
  if (block.kind === 'paragraph') return <p className="lesson-paragraph">
    {block.parts.map((part, index) => part.kind === 'text'
      ? <span key={index}><MathText text={part.text} /></span>
      : <LessonReference key={index} {...part} registry={registry} />)}
  </p>
  if (block.kind === 'formula') return <p className="lesson-formula">
    {block.parts.map((part, index) => part.kind === 'mathText'
      ? <MathText key={index} text={part.text} />
      : part.lessonRef
        ? <LessonReference
          key={index}
          targetRef={part.lessonRef.targetRef}
          label={part.symbol}
          ariaLabel={`${part.symbol}：${part.lessonRef.label}`}
          registry={registry}
        />
        : <span key={index}>{part.symbol}</span>)}
  </p>
  if (block.kind === 'lessonRef') return <p className="lesson-body-reference">
    <LessonReference {...block} registry={registry} />
  </p>
  if (block.kind === 'figureRef') return <FigureRef lesson={lesson} figureId={block.figureId} />
  if (block.kind === 'heading') return <h3>{block.text}</h3>
  if (block.kind === 'table') return <div className="course-table-wrap" tabIndex={0}>
    <table>
      <caption>{block.caption}</caption>
      <thead><tr>{block.columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
      <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => cellIndex === 0
        ? <th scope="row" key={cellIndex}>{cell}</th>
        : <td key={cellIndex} className={quantityCellClass(cell, block.columns[cellIndex])}>{cell}</td>)}</tr>)}</tbody>
    </table>
  </div>
  if (block.kind === 'details') return <details className="course-details"><summary>{block.summary}</summary>{block.blocks.map((child, index) => <LessonBlock key={index} block={child} lesson={lesson} registry={registry} exerciseGenerators={exerciseGenerators} exerciseResetKeys={exerciseResetKeys} renderExercise={renderExercise} />)}</details>
  const exerciseKey = lesson.lessonId + ':' + block.exerciseId
  const key = exerciseKey + ':' + (exerciseResetKeys?.[exerciseKey] ?? 0)
  if (renderExercise) return renderExercise(block.exerciseId, key)
  return <LessonExerciseSlot key={key} exerciseId={block.exerciseId} lesson={lesson} registry={registry} exerciseGenerators={exerciseGenerators} />
}

export function getLessonAccuracyDisplay(lesson: LessonDefinition, progress: CourseProgress | null) {
  if (lesson.availability === 'planned') return { label: '未収録', value: null }
  if (!hasCoursePractice(lesson.lessonId)) return { label: '演習なし', value: null }
  if (!progress) return { label: '集計未確認', value: null }
  const observation = progress.lessons.find((item) => item.lessonId === lesson.lessonId)
  if (!observation) return { label: '集計未確認', value: null }
  if (observation.attemptCount === 0 || observation.correctRate === null) return { label: '未記録', value: null }
  return { label: '直近正答率（%）', value: Math.round(observation.correctRate * 100) }
}

function LessonCard({ lesson, registry, progress, manualProgress, manualProgressConfirmed }: {
  lesson: LessonDefinition
  registry: LessonRegistry
  progress: CourseProgress | null
  manualProgress: ManualProgressState
  manualProgressConfirmed: boolean
}) {
  const accuracy = getLessonAccuracyDisplay(lesson, progress)
  const manualStatus = getManualProgressLabel(lesson, manualProgress[lesson.lessonId], manualProgressConfirmed)
  const progressText = manualStatus && <p className="lesson-observation">
    手動進捗：{manualStatus}{accuracy.value === null ? <> · 演習成績：{accuracy.label}</> : null}
  </p>
  const rate = accuracy.value !== null && <p className="lesson-card-rate">
    <span>{accuracy.label}</span><strong aria-label={`直近正答率 ${accuracy.value} パーセント`}>{accuracy.value}</strong>
  </p>
  const mainRoute: AppRoute = lesson.availability === 'included' && lesson.lessonId === 'descriptive-statistics'
    ? { kind: 'course-lesson', courseId: lesson.lessonId, sectionId: lesson.sections[0].sectionId }
    : { kind: 'lesson-id', lessonId: lesson.lessonId, sectionId: null }
  if (lesson.availability === 'included') return <article className="lesson-card">
    <header className="lesson-card-header">
      <div>
        <h3 tabIndex={-1}><InternalLink route={mainRoute}>{lesson.title}</InternalLink></h3>
        <p className="lesson-status">収録済み：{lesson.sections.length} / {lesson.declaredSectionIds.length} 節</p>
      </div>
      {rate}
    </header>
    {progressText}
    <p>学習目標：{lesson.learningObjectives.join(' ')}</p>
    <nav className="section-list" aria-label={`${lesson.title}の解説節`}>
      <h4>収録した解説</h4>
      <ul>{lesson.sections.map((section) => <li key={section.sectionId}>
        <InternalLink route={lesson.lessonId === 'descriptive-statistics'
          ? { kind: 'course-lesson', courseId: lesson.lessonId, sectionId: section.sectionId }
          : { kind: 'lesson-id', lessonId: lesson.lessonId, sectionId: section.sectionId }}>
          {section.title}
        </InternalLink>
      </li>)}</ul>
    </nav>
    <ReferenceGroups lesson={lesson} headingLevel={4} registry={registry} />
  </article>

  return <article className="lesson-card lesson-card-planned">
    <h3 tabIndex={-1}>{lesson.title} <span className="lesson-status">未収録</span></h3>
    <p>学習目標：{lesson.learningObjectives.join(' ')}</p>
    <p>収録範囲：教材は未収録です。</p>
    <p>未収録の節ID：{lesson.declaredSectionIds.length ? lesson.declaredSectionIds.join('、') : '未登録'}</p>
    <ReferenceGroups lesson={lesson} headingLevel={4} registry={registry} />
  </article>
}

export function LessonDetailCard({ lesson, registry = lessonRegistry, manualProgress, manualProgressConfirmed,
  manualProgressDisabled = false, progress, onManualProgressAction, headingRef, onClose, onMapPrerequisiteSelect }: {
  lesson: LessonDefinition
  registry?: LessonRegistry
  manualProgress: ManualLessonProgress
  manualProgressConfirmed: boolean
  manualProgressDisabled?: boolean
  progress: CourseProgress | null
  onManualProgressAction: (action: ManualProgressCommand) => void
  headingRef?: RefObject<HTMLHeadingElement | null>
  onClose: () => void
  onMapPrerequisiteSelect?: (targetRef: string) => void
}) {
  const hasPractice = lesson.availability === 'included' && lesson.lessonId === 'descriptive-statistics'
  const markCompletedRef = useRef<HTMLButtonElement>(null)
  const reopenRef = useRef<HTMLButtonElement>(null)
  const localHeadingRef = useRef<HTMLHeadingElement>(null)
  const accuracy = getLessonAccuracyDisplay(lesson, progress)
  const manualStatus = getManualProgressLabel(lesson, manualProgress, manualProgressConfirmed)
  const applyProgressAction = (action: ManualProgressCommand, nextActionRef: RefObject<HTMLButtonElement | null>) => {
    onManualProgressAction(action)
    window.requestAnimationFrame(() => {
      const nextAction = nextActionRef.current
      if (nextAction && !nextAction.disabled) {
        nextAction.focus({ preventScroll: true })
        return
      }
      const detailHeading = headingRef?.current ?? localHeadingRef.current
      detailHeading?.focus()
    })
  }
  const completed = manualProgress.completedAt !== null

  return <aside className="lesson-detail-card" aria-labelledby={`lesson-detail-title-${lesson.lessonId}`}>
    <header className="lesson-detail-header">
      <div>
        <h2 id={`lesson-detail-title-${lesson.lessonId}`} ref={headingRef ?? localHeadingRef} tabIndex={-1}>{lesson.title}</h2>
        <p className="lesson-status">{lesson.availability === 'included'
          ? `収録済み：${lesson.sections.length} / ${lesson.declaredSectionIds.length} 節`
          : '未収録'}</p>
      </div>
      <button type="button" className="lesson-detail-close" onClick={onClose} aria-label={`${lesson.title}の詳細を閉じる`}>閉じる</button>
    </header>
    <div className="lesson-detail-content">
      <nav className="lesson-detail-actions" aria-label={`${lesson.title}の関連画面`}>
        {lesson.availability === 'included' && <LessonReference targetRef={lesson.lessonId} label="解説を読む"
          intent="normal" registry={registry} />}
        {hasPractice && <InternalLink route={{ kind: 'course-practice', courseId: lesson.lessonId }}>演習問題一覧を開く</InternalLink>}
        <InternalLink route={{ kind: 'progress' }}>進捗を見る</InternalLink>
      </nav>
      {manualStatus && <section className="manual-progress-controls" aria-labelledby={`manual-progress-title-${lesson.lessonId}`}>
        <h3 id={`manual-progress-title-${lesson.lessonId}`}>手動進捗</h3>
        <p className="manual-progress-status" aria-live="polite">手動進捗：{manualStatus}</p>
        <p className="manual-progress-notice">手動完了はこのブラウザーに保存され、演習記録とは別に集計されます。バックアップに含まれます。</p>
        {manualProgressConfirmed && <div className="manual-progress-actions">
          {!completed && <button ref={markCompletedRef} type="button" disabled={manualProgressDisabled} onClick={() => applyProgressAction({ type: 'complete' }, reopenRef)}>完了にする</button>}
          {completed && <button ref={reopenRef} type="button" disabled={manualProgressDisabled} onClick={() => applyProgressAction({ type: 'reopen' }, markCompletedRef)}>未完了に戻す</button>}
        </div>}
      </section>}
      <section className="lesson-accuracy" aria-labelledby={`lesson-accuracy-title-${lesson.lessonId}`}>
        <h3 id={`lesson-accuracy-title-${lesson.lessonId}`}>演習成績</h3>
        {accuracy.value === null
          ? <p>{accuracy.label}</p>
          : <p className="lesson-accuracy-rate"><span>{accuracy.label}</span><strong aria-label={`直近正答率 ${accuracy.value} パーセント`}>{accuracy.value}</strong></p>}
      </section>
      <section aria-labelledby={`lesson-detail-objectives-${lesson.lessonId}`}>
        <h3 id={`lesson-detail-objectives-${lesson.lessonId}`}>学習目標</h3>
        <ul className="lesson-objectives">{lesson.learningObjectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
      </section>
      <ReferenceGroups lesson={lesson} registry={registry} onMapPrerequisiteSelect={onMapPrerequisiteSelect} />
    </div>
  </aside>
}

export function LessonMap({ registry = lessonRegistry, progress, manualProgress, manualProgressConfirmed }: {
  registry?: LessonRegistry
  progress: CourseProgress | null
  manualProgress: ManualProgressState
  manualProgressConfirmed: boolean
}) {
  const included = registry.lessons.filter((lesson) => lesson.availability === 'included')
  const planned = registry.lessons.filter((lesson) => lesson.availability === 'planned')
  return <div className="lesson-map">
    {!progress && <p className="storage-alert">演習データを確認できないため、演習成績を表示していません。</p>}
    <section aria-labelledby="included-lessons-title">
      <h2 id="included-lessons-title" tabIndex={-1}>収録済みの単元</h2>
      <p>リンクから単元の概要または収録済みの節を開けます。</p>
      <div className="lesson-card-list">{included.map((lesson) => <LessonCard key={lesson.lessonId} lesson={lesson} registry={registry}
        progress={progress} manualProgress={manualProgress} manualProgressConfirmed={manualProgressConfirmed} />)}</div>
    </section>
    <section aria-labelledby="planned-lessons-title">
      <h2 id="planned-lessons-title" tabIndex={-1}>未収録の単元</h2>
      <p>学習目標と予定節IDを示します。教材本文はなく、学習を開始するリンクもありません。</p>
      <div className="lesson-card-list">{planned.map((lesson) => <LessonCard key={lesson.lessonId} lesson={lesson} registry={registry}
        progress={progress} manualProgress={manualProgress} manualProgressConfirmed={manualProgressConfirmed} />)}</div>
    </section>
  </div>
}

export function LessonCourse({ lesson, activeSectionId, sectionHeadingRef, sectionReturn, registry, exerciseGenerators = lessonExerciseGenerators, exerciseResetKeys, renderExercise, children }: {
  lesson: IncludedLessonDefinition
  activeSectionId: string | null
  sectionHeadingRef: RefObject<HTMLHeadingElement | null>
  sectionReturn?: ReactNode
  registry: LessonRegistry
  exerciseGenerators?: Readonly<Record<string, ExerciseGenerator>>
  exerciseResetKeys?: Readonly<Record<string, number>>
  renderExercise?: (exerciseId: string, key: string) => ReactNode
  children?: ReactNode
}) {
  const blockProps = { lesson, registry, exerciseGenerators, exerciseResetKeys, renderExercise }
  return <section className="lesson-panel lesson-course" aria-labelledby="course-title">
    <p className="lesson-context"><a href="#/map">学習マップ</a> / {lesson.title}</p>
    <h2 id="course-title" tabIndex={-1}>{lesson.title}</h2>
    <p>{lesson.learningObjectives.join(' ')}</p>
    {lesson.overview?.map((block, index) => <LessonBlock key={index} block={block} {...blockProps} />)}
    <nav className="course-section-nav" aria-label={`${lesson.title}の目次`}>
      <h3>この単元の節</h3>
      <ol>{lesson.sections.map((section) => <li key={section.sectionId}>
        {section.sectionId === activeSectionId ? <span aria-current="location">{section.title}</span>
          : <LessonReference targetRef={`${lesson.lessonId}#${section.sectionId}`} label={section.title} intent="section" registry={registry} />}
      </li>)}</ol>
    </nav>
    <div className="course-sections">{lesson.sections.map((section) => <section className="course-section" key={section.sectionId} id={`section-${section.sectionId}`}>
      <h2 id={`course-section-${section.sectionId}`} tabIndex={-1} ref={section.sectionId === activeSectionId ? sectionHeadingRef : undefined}>{section.title}</h2>
      {section.sectionId === activeSectionId && sectionReturn}
      {section.blocks.map((block, index) => <LessonBlock key={index} block={block} {...blockProps} />)}
    </section>)}</div>
    {!!lesson.references?.length && <details className="course-references"><summary>{lesson.credit ? '参考資料・クレジット' : '出典'}</summary>
      <ul>{lesson.references.map((reference) => <li key={reference.url + reference.title}>
        <a href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a><p>{reference.details}</p>
      </li>)}</ul>
    </details>}
    {lesson.credit && <p className="lesson-credit">{lesson.credit}</p>}
    {children}
  </section>
}

export function LessonRouteContent({ lesson, sectionId, sectionHeadingRef, sectionReturn, registry = lessonRegistry, exerciseGenerators = lessonExerciseGenerators, exerciseResetKeys }: {
  lesson: IncludedLessonDefinition
  sectionId: string | null
  sectionHeadingRef: RefObject<HTMLHeadingElement | null>
  sectionReturn?: ReactNode
  registry?: LessonRegistry
  exerciseGenerators?: Readonly<Record<string, ExerciseGenerator>>
  exerciseResetKeys?: Readonly<Record<string, number>>
}) {
  if (lesson.overview) return <LessonCourse key={lesson.lessonId} lesson={lesson} activeSectionId={sectionId}
    sectionHeadingRef={sectionHeadingRef} sectionReturn={sectionReturn} registry={registry} exerciseGenerators={exerciseGenerators} exerciseResetKeys={exerciseResetKeys} />

  const section = sectionId ? lesson.sections.find((item) => item.sectionId === sectionId) : undefined
  const currentRef = section ? `${lesson.lessonId}#${section.sectionId}` : undefined
  return <section className="lesson-panel" aria-labelledby="route-lesson-title">
    {section ? <>
      <p className="lesson-context">単元：<InternalLink route={{ kind: 'lesson-id', lessonId: lesson.lessonId, sectionId: null }} intent="section">{lesson.title}</InternalLink></p>
      <h2 id="route-lesson-title" ref={sectionHeadingRef} tabIndex={-1}>解説</h2>
      {sectionReturn}
      <div className="lesson-body">
        {section.blocks.map((block, index) => <LessonBlock key={index} block={block} lesson={lesson} registry={registry} exerciseGenerators={exerciseGenerators} exerciseResetKeys={exerciseResetKeys} />)}
      </div>
    </> : <>
      <h2 id="route-lesson-title" ref={sectionHeadingRef} tabIndex={-1}>学習目標</h2>
      <ul>{lesson.learningObjectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
    </>}
    <nav className="section-list" aria-label={`${lesson.title}の節`}>
      <h3>この単元の節</h3>
      <ul>{lesson.sections.map((item) => <li key={item.sectionId}>
        <InternalLink
          route={{ kind: 'lesson-id', lessonId: lesson.lessonId, sectionId: item.sectionId }}
          intent="section"
          current={item.sectionId === sectionId}
        >{item.title}</InternalLink>
      </li>)}</ul>
    </nav>
    <ReferenceGroups lesson={lesson} currentRef={currentRef} registry={registry} />
    <p className="lesson-actions">この単元の演習は準備中です。</p>
  </section>
}
