import { useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import type { IncludedLessonDefinition, LessonBodyBlock, LessonRegistry } from './lesson-contract.mjs'
import { parseLessonRef } from './lesson-contract.mjs'
import { lessonRegistry } from './lesson-registry.mjs'
import { routeToHash } from './resolve-screen.mjs'
import { FigureRef } from './figures/figure-ref'
import { generateDescriptiveStatisticsPreviewExercise, nextPreviewExerciseIndex, previewExerciseDefinitions } from './descriptive-statistics-preview-exercises.mjs'

const inlineCategories: Record<string, string> = {
  mean: 'mean-deviation',
  deviation: 'mean-deviation',
  variance: 'unbiased-variance',
  'standard-deviation': 'variance-standard-deviation',
}

function CourseReference({ targetRef, label, intent = 'review', registry }: {
  targetRef: string
  label: string
  intent?: 'normal' | 'review'
  registry: LessonRegistry
}) {
  const parsed = parseLessonRef(targetRef)
  const lesson = parsed && registry.lessons.find((item) => item.lessonId === parsed.lessonId)
  if (!parsed || lesson?.availability !== 'included') return <span className="lesson-reference-unavailable">{label}（教材を開けません）</span>
  if (lesson.lessonId === 'descriptive-statistics') return <a href={routeToHash({ kind: 'course-lesson', courseId: lesson.lessonId, sectionId: parsed.sectionId ?? lesson.sections[0].sectionId })} data-nav-intent={intent}>{label}</a>
  return <a href={routeToHash({ kind: 'lesson-id', lessonId: lesson.lessonId, sectionId: parsed.sectionId })} data-nav-intent={intent}>{label}</a>
}

function MathText({ text }: { text: string }) {
  const parts: ReactNode[] = []
  const marker = /([_^])(?:\{([^{}]*)\}|([A-Za-z0-9]))/gu
  const matches = [...text.matchAll(marker)]
  if (matches.length !== (text.match(/[_^]/gu) ?? []).length) return <>{text}</>
  let end = 0
  matches.forEach((match, index) => {
    const position = match.index
    if (position > end) parts.push(text.slice(end, position))
    parts.push(match[1] === '_' ? <sub key={index}>{match[2] ?? match[3]}</sub> : <sup key={index}>{match[2] ?? match[3]}</sup>)
    end = position + match[0].length
  })
  parts.push(text.slice(end))
  return <>{parts}</>
}

function InlineExercise({ exerciseId, onFirstGrade }: {
  exerciseId: string
  onFirstGrade: (categoryId: string, isCorrect: boolean) => void
}) {
  const id = useId()
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [index, setIndex] = useState(() => previewExerciseDefinitions[exerciseId as keyof typeof previewExerciseDefinitions]?.initialIndex ?? 0)
  const [answers, setAnswers] = useState<string[]>([])
  const [feedback, setFeedback] = useState('')
  const [graded, setGraded] = useState(false)
  const exercise = generateDescriptiveStatisticsPreviewExercise(exerciseId as keyof typeof previewExerciseDefinitions, index)
  const grade = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = exercise.fields.map((_, fieldIndex) => {
      const text = (answers[fieldIndex] ?? '').normalize('NFKC').replace(/−/gu, '-')
      return text && /^[+-]?\d+(\.\d+)?$/u.test(text) ? Number(text) : Number.NaN
    })
    if (parsed.some((value) => !Number.isFinite(value))) {
      setFeedback('すべての答えを数字で入力してください。')
      return
    }
    const correct = parsed.length === exercise.answers.length && parsed.every((value, fieldIndex) => Math.abs(value - exercise.answers[fieldIndex]) < 1e-6)
    if (!graded) onFirstGrade(inlineCategories[exerciseId] ?? 'comprehensive', correct)
    setGraded(true)
    setFeedback(correct ? '正解です。解説を開いて計算を確認できます。' : '違います。値−平均、または二乗和の式を確認してください。')
    if (correct && detailsRef.current) detailsRef.current.open = true
  }
  const regenerate = () => {
    setIndex((current) => nextPreviewExerciseIndex(exerciseId as keyof typeof previewExerciseDefinitions, current))
    setAnswers([])
    setFeedback('')
    setGraded(false)
    if (detailsRef.current) detailsRef.current.open = false
  }

  return <section className="course-inline-exercise" aria-labelledby={`${id}-title`}>
    <h4 id={`${id}-title`}>確認問題</h4>
    <p>{exercise.prompt}</p>
    <form onSubmit={grade}>
      {exercise.fields.map((field, fieldIndex) => <label className="course-inline-field" key={field.label} htmlFor={`${id}-${fieldIndex}`}>
        {field.label}
        <input id={`${id}-${fieldIndex}`} type="text" inputMode="decimal" autoComplete="off" value={answers[fieldIndex] ?? ''}
          onChange={(event) => {
            const value = event.currentTarget.value
            setAnswers((current) => Array.from({ length: exercise.fields.length }, (_, index) =>
              index === fieldIndex ? value : current[index] ?? ''))
          }} />
        <span>{field.unit}</span>
      </label>)}
      <div className="course-inline-actions"><button type="submit">答え合わせ</button><button type="button" onClick={regenerate}>別の問題</button></div>
    </form>
    <p role="status" aria-live="polite">{feedback}</p>
    <details ref={detailsRef}><summary>解説を見る</summary><p>{exercise.solution}</p></details>
  </section>
}

function BodyBlock({ block, lesson, registry, onFirstGrade }: {
  block: LessonBodyBlock
  lesson: IncludedLessonDefinition
  registry: LessonRegistry
  onFirstGrade: (categoryId: string, isCorrect: boolean) => void
}) {
  if (block.kind === 'paragraph') return <p className="lesson-paragraph">{block.parts.map((part, index) => part.kind === 'text'
    ? <span key={index}><MathText text={part.text} /></span>
    : <CourseReference key={index} targetRef={part.targetRef} label={part.label} registry={registry} />)}</p>
  if (block.kind === 'formula') return <p className="lesson-formula">{block.parts.map((part, index) => part.kind === 'mathText'
    ? <MathText key={index} text={part.text} />
    : part.lessonRef ? <CourseReference key={index} targetRef={part.lessonRef.targetRef} label={part.symbol} registry={registry} />
      : <span key={index}>{part.symbol}</span>)}</p>
  if (block.kind === 'lessonRef') return <p className="lesson-body-reference"><CourseReference targetRef={block.targetRef} label={block.label} registry={registry} /></p>
  if (block.kind === 'figureRef') return <FigureRef lesson={lesson} figureId={block.figureId} />
  if (block.kind === 'heading') return <h3>{block.text}</h3>
  if (block.kind === 'table') return <div className="course-table-wrap"><table><caption>{block.caption}</caption><thead><tr>{block.columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => cellIndex === 0
    ? <th scope="row" key={cellIndex}>{cell}</th> : <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>
  if (block.kind === 'details') return <details className="course-details"><summary>{block.summary}</summary>
    <div>{block.blocks.map((child, index) => <BodyBlock key={index} block={child} lesson={lesson} registry={registry} onFirstGrade={onFirstGrade} />)}</div>
  </details>
  return <InlineExercise exerciseId={block.exerciseId} onFirstGrade={onFirstGrade} />
}

export function DescriptiveStatisticsCourse({ lesson, activeSectionId, sectionHeadingRef, registry = lessonRegistry, onFirstGrade }: {
  lesson: IncludedLessonDefinition
  activeSectionId: string
  sectionHeadingRef: RefObject<HTMLHeadingElement | null>
  registry?: LessonRegistry
  onFirstGrade: (categoryId: string, isCorrect: boolean) => void
}) {
  return <section className="lesson-panel descriptive-statistics-course" aria-labelledby="course-title">
    <p className="lesson-context"><a href="#/map">学習マップ</a> / {lesson.title}</p>
    <h2 id="course-title" tabIndex={-1}>{lesson.title}</h2>
    <p>{lesson.learningObjectives.join(' ')}</p>
    {lesson.overview?.map((block, index) => <BodyBlock key={index} block={block} lesson={lesson} registry={registry} onFirstGrade={onFirstGrade} />)}
    <nav className="course-section-nav" aria-label={`${lesson.title}の目次`}>
      <h3>この単元の節</h3>
      <ol>{lesson.sections.map((section) => <li key={section.sectionId}>
        {section.sectionId === activeSectionId ? <span aria-current="location">{section.title}</span>
          : <a href={routeToHash({ kind: 'course-lesson', courseId: lesson.lessonId, sectionId: section.sectionId })} data-nav-intent="section">{section.title}</a>}
      </li>)}</ol>
    </nav>
    <div className="course-sections">{lesson.sections.map((section) => <section className="course-section" key={section.sectionId} id={`section-${section.sectionId}`}>
      <h2 id={`course-section-${section.sectionId}`} tabIndex={-1} ref={section.sectionId === activeSectionId ? sectionHeadingRef : undefined}>{section.title}</h2>
      {section.blocks.map((block, index) => <BodyBlock key={index} block={block} lesson={lesson} registry={registry} onFirstGrade={onFirstGrade} />)}
    </section>)}</div>
    <details className="course-references"><summary>参考資料・クレジット</summary>
      <ul>{lesson.references?.map((reference) => <li key={reference.url + reference.title}>
        <a href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a><p>{reference.details}</p>
      </li>)}</ul>
      {lesson.credit && <p>{lesson.credit}</p>}
    </details>
    <p className="lesson-actions"><a href={routeToHash({ kind: 'course-practice', courseId: lesson.lessonId })}>5分野の演習へ</a></p>
  </section>
}
