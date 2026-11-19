import { useState, type ReactNode, type RefObject } from 'react'
import type { ExerciseInstance, IncludedLessonDefinition, LessonBodyBlock, LessonRegistry } from './lesson-contract.mjs'
import { parseLessonRef } from './lesson-contract.mjs'
import { lessonRegistry } from './lesson-registry.mjs'
import { routeToHash } from './resolve-screen.mjs'
import { FigureRef } from './figures/figure-ref'
import { nextPreviewExerciseIndex, previewExerciseDefinitions } from './descriptive-statistics-preview-exercises.mjs'
import { generateLessonExercise } from './lesson-exercise-adapters.mjs'
import { ExerciseQuestionCard } from './lesson-view'

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

function InlineExercise({ exerciseId, registry }: {
  exerciseId: string
  registry: LessonRegistry
}) {
  type QuestionState = { index: number; instance: ExerciseInstance | null; error: string | null }
  const definition = registry.exerciseCatalog?.definitions.find((item) => item.lessonId === 'descriptive-statistics' && item.exerciseId === exerciseId)
  const generation = definition?.generation
  const initialIndex = previewExerciseDefinitions[exerciseId as keyof typeof previewExerciseDefinitions]?.initialIndex
    ?? (generation?.kind === 'fixed' ? 0 : generation?.minimum ?? 0)
  const [question, setQuestion] = useState<QuestionState>(() => {
    try {
      return { index: initialIndex, instance: generateLessonExercise('descriptive-statistics', exerciseId, initialIndex, registry), error: null }
    } catch {
      return { index: initialIndex, instance: null, error: 'この問題を表示できません。' }
    }
  })
  const canRegenerate = generation?.kind === 'index' && generation.maximum > generation.minimum
  const regenerate = () => {
    try {
      const index = nextPreviewExerciseIndex(exerciseId as keyof typeof previewExerciseDefinitions, question.index)
      const instance = generateLessonExercise('descriptive-statistics', exerciseId, index, registry)
      setQuestion({ index, instance, error: null })
    } catch {
      setQuestion((current) => ({ ...current, error: current.instance
        ? '別の問題を表示できませんでした。表示中の問題を保っています。' : 'この問題を表示できません。' }))
    }
  }

  return <ExerciseQuestionCard instance={question.instance} exerciseId={exerciseId} title="確認問題" headingLevel={4}
    registry={registry} error={question.error} className="course-inline-exercise"
    tableCaption="ラインごとに測った値" tableRowHeaderLabel="ライン" tableColumnLabel={(index) => `${index + 1}個目`}
    onRegenerate={canRegenerate ? regenerate : undefined} regenerateLabel="別の問題" />
}

function BodyBlock({ block, lesson, registry }: {
  block: LessonBodyBlock
  lesson: IncludedLessonDefinition
  registry: LessonRegistry
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
    <div>{block.blocks.map((child, index) => <BodyBlock key={index} block={child} lesson={lesson} registry={registry} />)}</div>
  </details>
  return <InlineExercise exerciseId={block.exerciseId} registry={registry} />
}

export function DescriptiveStatisticsCourse({ lesson, activeSectionId, sectionHeadingRef, registry = lessonRegistry }: {
  lesson: IncludedLessonDefinition
  activeSectionId: string
  sectionHeadingRef: RefObject<HTMLHeadingElement | null>
  registry?: LessonRegistry
}) {
  return <section className="lesson-panel descriptive-statistics-course" aria-labelledby="course-title">
    <p className="lesson-context"><a href="#/map">学習マップ</a> / {lesson.title}</p>
    <h2 id="course-title" tabIndex={-1}>{lesson.title}</h2>
    <p>{lesson.learningObjectives.join(' ')}</p>
    {lesson.overview?.map((block, index) => <BodyBlock key={index} block={block} lesson={lesson} registry={registry} />)}
    <nav className="course-section-nav" aria-label={`${lesson.title}の目次`}>
      <h3>この単元の節</h3>
      <ol>{lesson.sections.map((section) => <li key={section.sectionId}>
        {section.sectionId === activeSectionId ? <span aria-current="location">{section.title}</span>
          : <a href={routeToHash({ kind: 'course-lesson', courseId: lesson.lessonId, sectionId: section.sectionId })} data-nav-intent="section">{section.title}</a>}
      </li>)}</ol>
    </nav>
    <div className="course-sections">{lesson.sections.map((section) => <section className="course-section" key={section.sectionId} id={`section-${section.sectionId}`}>
      <h2 id={`course-section-${section.sectionId}`} tabIndex={-1} ref={section.sectionId === activeSectionId ? sectionHeadingRef : undefined}>{section.title}</h2>
      {section.blocks.map((block, index) => <BodyBlock key={index} block={block} lesson={lesson} registry={registry} />)}
    </section>)}</div>
    <details className="course-references"><summary>参考資料・クレジット</summary>
      <ul>{lesson.references?.map((reference) => <li key={reference.url + reference.title}>
        <a href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a><p>{reference.details}</p>
      </li>)}</ul>
    </details>
    {lesson.credit && <p className="lesson-credit">{lesson.credit}</p>}
    <p className="lesson-actions"><a href={routeToHash({ kind: 'course-practice', courseId: lesson.lessonId })}>5分野の演習へ</a></p>
  </section>
}
