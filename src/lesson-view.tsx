import type { ReactNode, RefObject } from 'react'
import { lessonRegistry } from './lesson-registry.mjs'
import { availablePracticeQuestions } from './practice-actions.mjs'
import { parseLessonRef, type IncludedLessonDefinition, type LessonDefinition, type LessonRegistry } from './lesson-contract.mjs'
import { routeToHash, type AppRoute } from './resolve-screen.mjs'
import type { NavigationIntent } from './route-history.mjs'
import { FigureRef } from './figures/figure-ref'

export function resolveLessonRef(reference: string, registry: LessonRegistry = lessonRegistry): AppRoute | null {
  const parsed = parseLessonRef(reference)
  const lesson = parsed && registry.lessons.find((item) => item.lessonId === parsed.lessonId)
  if (!parsed || lesson?.availability !== 'included') return null
  if (parsed.sectionId && !lesson.sections.some((section) => section.sectionId === parsed.sectionId)) return null
  return { kind: 'lesson-id', lessonId: parsed.lessonId, sectionId: parsed.sectionId }
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

export function LessonReference({ targetRef, label, intent = 'review', ariaLabel, registry = lessonRegistry }: {
  targetRef: string
  label?: string
  intent?: NavigationIntent
  ariaLabel?: string
  registry?: LessonRegistry
}) {
  const route = resolveLessonRef(targetRef, registry)
  const text = label ?? lessonRefLabel(targetRef, registry)
  if (route) return <a href={routeToHash(route)} data-nav-intent={intent} aria-label={ariaLabel}>{text}</a>
  const parsed = parseLessonRef(targetRef)
  const lesson = parsed && registry.lessons.find((item) => item.lessonId === parsed.lessonId)
  const status = !lesson ? '教材未登録' : lesson.availability === 'planned' ? '未収録' : '節未収録'
  return <span className="lesson-reference-unavailable">{text}（{status}）</span>
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

function ReferenceGroups({ lesson, currentRef, headingLevel = 3, registry = lessonRegistry }: {
  lesson: LessonDefinition
  currentRef?: string
  headingLevel?: 3 | 4
  registry?: LessonRegistry
}) {
  const conditionals = lesson.conditionalPrerequisites.filter((item) => !currentRef || item.methodSectionRef === currentRef)
  const optionalReviews = lesson.optionalReviews.filter((item) => !currentRef || item.fromRef === currentRef)
  const Heading = headingLevel === 4 ? 'h4' : 'h3'

  return <>
    {lesson.commonPrerequisites.length > 0 && <section className="reference-group">
      <Heading>共通必須前提</Heading>
      <p>この単元を学ぶ前に必要な内容です。</p>
      <ul>{lesson.commonPrerequisites.map((reference) => <li key={reference}>
        <LessonReference targetRef={reference} registry={registry} />
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

function LessonBlock({ block, lesson, registry }: {
  block: IncludedLessonDefinition['sections'][number]['blocks'][number]
  lesson: IncludedLessonDefinition
  registry: LessonRegistry
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
  return <FigureRef lesson={lesson} figureId={block.figureId} />
}

function LessonCard({ lesson, registry }: { lesson: LessonDefinition; registry: LessonRegistry }) {
  if (lesson.availability === 'included') return <article className="lesson-card">
    <h3><InternalLink route={{ kind: 'lesson-id', lessonId: lesson.lessonId, sectionId: null }}>{lesson.title}</InternalLink></h3>
    <p className="lesson-status">収録済み：{lesson.sections.length} / {lesson.declaredSectionIds.length} 節</p>
    <p>学習目標：{lesson.learningObjectives.join(' ')}</p>
    <nav className="section-list" aria-label={`${lesson.title}の解説節`}>
      <h4>収録した解説</h4>
      <ul>{lesson.sections.map((section) => <li key={section.sectionId}>
        <InternalLink route={{ kind: 'lesson-id', lessonId: lesson.lessonId, sectionId: section.sectionId }}>
          {section.title}
        </InternalLink>
      </li>)}</ul>
    </nav>
    <ReferenceGroups lesson={lesson} headingLevel={4} registry={registry} />
  </article>

  return <article className="lesson-card lesson-card-planned">
    <h3>{lesson.title} <span className="lesson-status">未収録</span></h3>
    <p>学習目標：{lesson.learningObjectives.join(' ')}</p>
    <p>収録範囲：教材は未収録です。</p>
    <p>未収録の節ID：{lesson.declaredSectionIds.length ? lesson.declaredSectionIds.join('、') : '未登録'}</p>
    <ReferenceGroups lesson={lesson} headingLevel={4} registry={registry} />
  </article>
}

export function LessonMap({ registry = lessonRegistry }: { registry?: LessonRegistry }) {
  const included = registry.lessons.filter((lesson) => lesson.availability === 'included')
  const planned = registry.lessons.filter((lesson) => lesson.availability === 'planned')
  return <div className="lesson-map">
    <section aria-labelledby="included-lessons-title">
      <h2 id="included-lessons-title">収録済みの単元</h2>
      <p>リンクから単元の概要または収録済みの節を開けます。</p>
      <div className="lesson-card-list">{included.map((lesson) => <LessonCard key={lesson.lessonId} lesson={lesson} registry={registry} />)}</div>
    </section>
    <section aria-labelledby="planned-lessons-title">
      <h2 id="planned-lessons-title">未収録の単元</h2>
      <p>学習目標と予定節IDを示します。教材本文はなく、学習を開始するリンクもありません。</p>
      <div className="lesson-card-list">{planned.map((lesson) => <LessonCard key={lesson.lessonId} lesson={lesson} registry={registry} />)}</div>
    </section>
  </div>
}

export function LessonRouteContent({ lesson, sectionId, sectionHeadingRef, registry = lessonRegistry }: {
  lesson: IncludedLessonDefinition
  sectionId: string | null
  sectionHeadingRef: RefObject<HTMLHeadingElement | null>
  registry?: LessonRegistry
}) {
  const section = sectionId ? lesson.sections.find((item) => item.sectionId === sectionId) : undefined
  const currentRef = section ? `${lesson.lessonId}#${section.sectionId}` : undefined
  return <section className="lesson-panel" aria-labelledby="route-lesson-title">
    {section ? <>
      <p className="lesson-context">単元：<InternalLink route={{ kind: 'lesson-id', lessonId: lesson.lessonId, sectionId: null }} intent="section">{lesson.title}</InternalLink></p>
      <h2 id="route-lesson-title" ref={sectionHeadingRef} tabIndex={-1}>解説</h2>
      <div className="lesson-body">
        {section.blocks.map((block, index) => <LessonBlock key={index} block={block} lesson={lesson} registry={registry} />)}
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
    {availablePracticeQuestions().some((question) => lesson.questionIds.includes(question.questionId))
      ? <p className="lesson-actions"><a href="#/practice" data-nav-intent="normal">利用できる演習問題を選ぶ</a></p>
      : <p className="lesson-actions">この単元の演習は準備中です。</p>}
  </section>
}
