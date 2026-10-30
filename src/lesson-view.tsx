import { useRef, type ReactNode, type RefObject } from 'react'
import { lessonRegistry } from './lesson-registry.mjs'
import { availablePracticeQuestions } from './practice-actions.mjs'
import { parseLessonRef, type IncludedLessonDefinition, type LessonDefinition, type LessonRegistry } from './lesson-contract.mjs'
import { routeToHash, type AppRoute } from './resolve-screen.mjs'
import type { NavigationIntent } from './route-history.mjs'
import { FigureRef } from './figures/figure-ref'
import type { ProgressData } from './progress-data.mjs'
import type { ManualLessonProgress, ManualProgressCommand } from './manual-progress.mjs'

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

function LessonCard({ lesson, registry, progress }: {
  lesson: LessonDefinition
  registry: LessonRegistry
  progress: ProgressData | null
}) {
  const observation = progress?.lessons.find((item) => item.lessonId === lesson.lessonId)
  const progressText = observation && <p className="lesson-observation">
    状態：{observation.state} · 回答試行：{observation.attemptCount}回 · 誤答からの復習候補：{observation.reviewCandidates.length ? 'あり' : 'なし'}
  </p>
  if (lesson.availability === 'included') return <article className="lesson-card">
    <h3><InternalLink route={{ kind: 'lesson-id', lessonId: lesson.lessonId, sectionId: null }}>{lesson.title}</InternalLink></h3>
    <p className="lesson-status">収録済み：{lesson.sections.length} / {lesson.declaredSectionIds.length} 節</p>
    {progressText}
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
    {progressText}
    <p>学習目標：{lesson.learningObjectives.join(' ')}</p>
    <p>収録範囲：教材は未収録です。</p>
    <p>未収録の節ID：{lesson.declaredSectionIds.length ? lesson.declaredSectionIds.join('、') : '未登録'}</p>
    <ReferenceGroups lesson={lesson} headingLevel={4} registry={registry} />
  </article>
}

export function LessonDetailCard({ lesson, registry = lessonRegistry, manualProgress, manualProgressDisabled = false, onManualProgressAction, headingRef, onClose }: {
  lesson: LessonDefinition
  registry?: LessonRegistry
  manualProgress: ManualLessonProgress
  manualProgressDisabled?: boolean
  onManualProgressAction: (action: ManualProgressCommand) => void
  headingRef?: RefObject<HTMLHeadingElement | null>
  onClose: () => void
}) {
  const hasPractice = lesson.availability === 'included'
    && availablePracticeQuestions().some((question) => lesson.questionIds.includes(question.questionId))
  const markCompletedRef = useRef<HTMLButtonElement>(null)
  const reopenRef = useRef<HTMLButtonElement>(null)
  const applyProgressAction = (action: ManualProgressCommand, nextActionRef: RefObject<HTMLButtonElement | null>) => {
    onManualProgressAction(action)
    window.requestAnimationFrame(() => nextActionRef.current?.focus({ preventScroll: true }))
  }
  const manualStatus = manualProgress.status === 'not-started' ? '未開始'
    : manualProgress.status === 'started' ? '学習中' : '完了'

  return <aside className="lesson-detail-card" aria-labelledby={`lesson-detail-title-${lesson.lessonId}`}>
    <header className="lesson-detail-header">
      <div>
        <h2 id={`lesson-detail-title-${lesson.lessonId}`} ref={headingRef} tabIndex={-1}>{lesson.title}</h2>
        <p className="lesson-status">{lesson.availability === 'included'
          ? `収録済み：${lesson.sections.length} / ${lesson.declaredSectionIds.length} 節`
          : '未収録'}</p>
      </div>
      <button type="button" className="lesson-detail-close" onClick={onClose} aria-label={`${lesson.title}の詳細を閉じる`}>閉じる</button>
    </header>
    <div className="lesson-detail-content">
      <section aria-labelledby={`lesson-detail-objectives-${lesson.lessonId}`}>
        <h3 id={`lesson-detail-objectives-${lesson.lessonId}`}>学習目標</h3>
        <ul className="lesson-objectives">{lesson.learningObjectives.map((objective, index) => <li key={objective}>
          <label className="lesson-objective-check">
            <input
              type="checkbox"
              checked={manualProgress.checks[index] ?? false}
              disabled={manualProgressDisabled}
              onChange={(event) => onManualProgressAction({ type: 'check', index, checked: event.currentTarget.checked })}
            />
            <span>{objective}</span>
          </label>
        </li>)}</ul>
      </section>
      <section className="manual-progress-controls" aria-labelledby={`manual-progress-title-${lesson.lessonId}`}>
        <h3 id={`manual-progress-title-${lesson.lessonId}`}>手動進捗</h3>
        <p className="manual-progress-status" aria-live="polite">手動進捗：{manualStatus}</p>
        <p className="manual-progress-notice">手動進捗とチェックはこのブラウザーに保存され、演習記録とは別です。統合バックアップに含まれます。</p>
        <div className="manual-progress-actions">
          {manualProgress.status === 'not-started' && <button type="button" disabled={manualProgressDisabled} onClick={() => applyProgressAction({ type: 'start' }, markCompletedRef)}>Start</button>}
          {manualProgress.status !== 'completed' && <button ref={markCompletedRef} type="button" disabled={manualProgressDisabled} onClick={() => applyProgressAction({ type: 'complete' }, reopenRef)}>Mark completed</button>}
          {manualProgress.status === 'completed' && <button ref={reopenRef} type="button" disabled={manualProgressDisabled} onClick={() => applyProgressAction({ type: 'reopen' }, markCompletedRef)}>Reopen</button>}
        </div>
      </section>
      <ReferenceGroups lesson={lesson} registry={registry} />
      <nav className="lesson-detail-actions" aria-label={`${lesson.title}の関連画面`}>
        {lesson.availability === 'included' && <InternalLink
          route={{ kind: 'lesson-id', lessonId: lesson.lessonId, sectionId: null }}
        >解説を読む</InternalLink>}
        {hasPractice && <InternalLink route={{ kind: 'practice' }}>演習問題一覧を開く（全単元共通）</InternalLink>}
        <InternalLink route={{ kind: 'progress' }}>全単元の演習記録・集計を見る</InternalLink>
      </nav>
    </div>
  </aside>
}

export function LessonMap({ registry = lessonRegistry, progress }: {
  registry?: LessonRegistry
  progress: ProgressData | null
}) {
  const included = registry.lessons.filter((lesson) => lesson.availability === 'included')
  const planned = registry.lessons.filter((lesson) => lesson.availability === 'planned')
  return <div className="lesson-map">
    {!progress && <p className="storage-alert">保存データを確認できないため、進捗は表示していません。</p>}
    <section aria-labelledby="included-lessons-title">
      <h2 id="included-lessons-title">収録済みの単元</h2>
      <p>リンクから単元の概要または収録済みの節を開けます。</p>
      <div className="lesson-card-list">{included.map((lesson) => <LessonCard key={lesson.lessonId} lesson={lesson} registry={registry} progress={progress} />)}</div>
    </section>
    <section aria-labelledby="planned-lessons-title">
      <h2 id="planned-lessons-title">未収録の単元</h2>
      <p>学習目標と予定節IDを示します。教材本文はなく、学習を開始するリンクもありません。</p>
      <div className="lesson-card-list">{planned.map((lesson) => <LessonCard key={lesson.lessonId} lesson={lesson} registry={registry} progress={progress} />)}</div>
    </section>
  </div>
}

function formatLocalDate(value: string | null) {
  return value === null ? '記録なし' : new Date(value).toLocaleString('ja-JP')
}

function SavedProgressLink({ route, children, canResolveRoute, unavailableMessage }: {
  route: Extract<AppRoute, { kind: 'feedback-id' | 'practice-id' }>
  children: ReactNode
  canResolveRoute: (route: Extract<AppRoute, { kind: 'feedback-id' | 'practice-id' }>) => boolean
  unavailableMessage: string
}) {
  return canResolveRoute(route)
    ? <InternalLink route={route} intent="normal">{children}</InternalLink>
    : <span className="lesson-reference-unavailable">{unavailableMessage}</span>
}

export function ProgressView({ progress, registry = lessonRegistry, canResolveRoute, unavailableMessage }: {
  progress: ProgressData
  registry?: LessonRegistry
  canResolveRoute: (route: Extract<AppRoute, { kind: 'feedback-id' | 'practice-id' }>) => boolean
  unavailableMessage: string
}) {
  return <section className="progress-view" aria-labelledby="progress-summary-title">
    <div className="progress-guidance" aria-labelledby="progress-summary-title">
      <h2 id="progress-summary-title">記録の見方</h2>
      <p>正答割合は正答回数 ÷ 回答回数です。分子と母数を表示し、同じ出題への再回答も回答回数に含めます。記録が少ない場合や繰り返し回答だけでは理解度を判断できません。</p>
      <p>教材の閲覧履歴は保存していないため、「演習記録なし」は未学習を意味しません。復習訪問は教材への移動記録で、復習完了や理解の証拠ではありません。後の正答や訪問があっても過去の誤答候補は残ります。</p>
    </div>

    <section aria-labelledby="progress-lessons-title">
      <h2 id="progress-lessons-title">単元ごとの記録</h2>
      <div className="progress-card-list">
        {progress.lessons.map((item) => {
          const lesson = registry.lessons.find((candidate) => candidate.lessonId === item.lessonId)
          const title = lesson?.title ?? `${item.lessonId}（現在の教材に未登録）`
          const hasActivity = item.questionInstanceCount > 0 || item.reviewCandidates.length > 0 || item.reviewVisits.length > 0
          return <details className="progress-card" key={item.lessonId} open={hasActivity}>
            <summary>
              <strong>{title}</strong>{lesson?.availability === 'planned' && <span className="lesson-status">（未収録）</span>}
              {' — '}{item.state} · 回答試行：{item.attemptCount}回 · 誤答からの復習候補：{item.reviewCandidates.length ? 'あり' : 'なし'}
            </summary>
            <div className="progress-card-detail">
              <p>保存済み出題snapshot：{item.questionInstanceCount}件 · 回答済み出題ID：{item.answeredInstanceCount}件 · 未回答出題：{item.unansweredInstanceCount}件</p>
              <p>回答試行：{item.attemptCount}回（正答 {item.correctCount}回・誤答 {item.incorrectCount}回）</p>
              <p>正答割合：{item.correctRate === null ? '回答記録なし' : `${item.correctCount} / ${item.attemptCount}回（${(item.correctRate * 100).toFixed(1)}%）`}</p>
              <p>最終回答：{formatLocalDate(item.lastAttemptAt)}{item.daysSinceLastAttempt === null ? '' : item.hasFutureAttempt
                ? ' · 経過日数 0日'
                : ` · ${item.daysSinceLastAttempt}日前`}</p>
              {item.hasFutureAttempt && <p className="progress-clock-note">記録日時が端末時刻より未来です（端末時計のずれの可能性があります）。</p>}

              <section className="progress-subsection" aria-label={`${title}の誤答候補`}>
                <h3>過去の誤答からの復習候補</h3>
                {item.reviewCandidates.length === 0 ? <p>候補の記録はありません。</p> : <ul>
                  {item.reviewCandidates.map((candidate) => <li key={candidate.reference}>
                    <p>復習先：<LessonReference targetRef={candidate.reference} intent="normal" registry={registry} /></p>
                    <p>この節を指定した誤答：{candidate.attemptCount}回 · 最終誤答：{formatLocalDate(candidate.latestAttemptAt)}</p>
                    {candidate.crossUnitAttemptCount > 0 && <p>別単元に属する出題の誤答{candidate.crossUnitAttemptCount}件からも、この教材が復習先に指定されています。</p>}
                    <p>復習先への総訪問：{candidate.visitCount}回（最終 {formatLocalDate(candidate.lastVisitedAt)}） · 代表誤答からの訪問：{candidate.representativeVisitCount}回（最終 {formatLocalDate(candidate.representativeLastVisitedAt)}）</p>
                    <p><SavedProgressLink route={{ kind: 'feedback-id', attemptId: candidate.attemptId }} canResolveRoute={canResolveRoute} unavailableMessage={unavailableMessage}>誤答と復習先を見る</SavedProgressLink></p>
                    <p><SavedProgressLink route={{ kind: 'practice-id', instanceId: candidate.instanceId }} canResolveRoute={canResolveRoute} unavailableMessage={unavailableMessage}>同じ出題へ戻る</SavedProgressLink></p>
                  </li>)}
                </ul>}
              </section>

              {item.reviewVisits.length > 0 && <section className="progress-subsection" aria-label={`${title}への復習訪問`}>
                <h3>記録された復習先への訪問</h3>
                <ul>{item.reviewVisits.map((visit) => <li key={visit.reference}>
                  <LessonReference targetRef={visit.reference} intent="normal" registry={registry} />
                  {' · 総訪問：'}{visit.visitCount}回（最終 {formatLocalDate(visit.lastVisitedAt)}）
                </li>)}</ul>
              </section>}
            </div>
          </details>
        })}
      </div>
    </section>

    {progress.unavailableReferences.length > 0 && <section aria-labelledby="progress-unavailable-title">
      <h2 id="progress-unavailable-title">現在の教材にない参照</h2>
      <p>保存時の参照を残しています。教材未登録・未収録・存在しない節は開けません。</p>
      <ul>{progress.unavailableReferences.map((item) => <li key={item.reference}>
        {item.status === 'invalid-reference'
          ? `${item.reference}（参照形式を確認できません）`
          : <LessonReference targetRef={item.reference} intent="normal" registry={registry} />}
      </li>)}</ul>
    </section>}
  </section>
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
