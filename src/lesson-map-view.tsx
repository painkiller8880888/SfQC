import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import './lesson-map-view.css'
import { deriveLessonGraph } from './lesson-graph.mjs'
import { lessonDomainColors, lessonDomains, type LessonDomain } from './lesson-contract.mjs'
import { lessonRegistry } from './lesson-registry.mjs'
import type { ManualProgressCommand, ManualProgressState } from './manual-progress.mjs'
import type { CourseProgress } from './course-progress.mjs'
import { LessonDetailCard } from './lesson-view'

const lessonGraph = deriveLessonGraph(lessonRegistry)

export function getMapProgressSummary(progress: CourseProgress | null, lessonId: string) {
  const observation = progress?.lessons.find((item) => item.lessonId === lessonId)
  if (!observation) return {
    label: '集計未確認',
    ariaLabel: '演習集計未確認、正答数と試行数は不明',
  }
  const counts = `${observation.correctCount}/${observation.attemptCount}回`
  if (observation.correctRate === null) return {
    label: observation.hasPractice ? '未記録（試行0回）' : '演習なし',
    ariaLabel: observation.hasPractice ? `正答率未記録、正答数/試行数 ${counts}` : 'この単元には現在、保存対象の演習がありません',
  }
  const percentage = Math.round(observation.correctRate * 100)
  return {
    label: `${percentage}%（${counts}）`,
    ariaLabel: `正答率${percentage}%、正答数/試行数 ${counts}`,
  }
}

type LessonMapViewProps = {
  selectedLessonId: string | null
  progress: CourseProgress | null
  manualProgress: ManualProgressState
  manualProgressDisabled?: boolean
  onManualProgressAction: (lessonId: string, action: ManualProgressCommand) => void
  onSelectionChange: (lessonId: string | null) => void
  onAuthorExport: (json: string) => boolean
  clearSelectionRef: { current: (() => void) | null }
}

function LessonGraph({ selectedLessonId: initialSelectedLessonId, progress, manualProgress, manualProgressDisabled,
  onManualProgressAction, onSelectionChange, onAuthorExport, clearSelectionRef }: LessonMapViewProps) {
  const [selectedLessonId, setSelectedLessonId] = useState(initialSelectedLessonId)
  const [authorEditorOpen, setAuthorEditorOpen] = useState(false)
  const [draftDomains, setDraftDomains] = useState<Record<string, LessonDomain>>(() =>
    Object.fromEntries(lessonRegistry.lessons.map((lesson) => [lesson.lessonId, lesson.domain])))
  const [draftColors, setDraftColors] = useState<Record<LessonDomain, string>>(() => ({ ...lessonDomainColors }))
  const initialDraftSnapshot = useMemo(() => JSON.stringify({
    domains: Object.fromEntries(lessonRegistry.lessons.map((lesson) => [lesson.lessonId, lesson.domain])),
    colors: lessonDomainColors,
  }), [])
  const [lastExportSnapshot, setLastExportSnapshot] = useState(initialDraftSnapshot)
  const [authorExportMessage, setAuthorExportMessage] = useState('')
  const authorEditorButtonRef = useRef<HTMLButtonElement>(null)
  const firstAuthorControlRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const detailHeadingRef = useRef<HTMLHeadingElement>(null)
  const selectedButtonRef = useRef<HTMLButtonElement | null>(null)
  const focusFrameRef = useRef<number | null>(null)

  const selectedLesson = lessonRegistry.lessons.find((lesson) => lesson.lessonId === selectedLessonId)
  const selectedTitle = selectedLesson?.title ?? ''
  const directPrerequisiteIds = new Set(lessonGraph.commonPrerequisiteEdges
    .filter((edge) => edge.target === selectedLessonId)
    .map((edge) => edge.source))
  const selectedDomain = selectedLesson ? draftDomains[selectedLesson.lessonId] ?? selectedLesson.domain : null
  const selectedDomainLabel = selectedDomain ? lessonDomains[selectedDomain] : null
  const draftSnapshot = JSON.stringify({ domains: draftDomains, colors: draftColors })
  const hasUnexportedChanges = draftSnapshot !== lastExportSnapshot
  const domainColorStyle = authorEditorOpen ? Object.fromEntries(Object.entries(draftColors)
    .map(([domain, color]) => [`--map-author-domain-${domain}`, color])) as CSSProperties : undefined

  const scrollFocusTargetIntoView = useCallback((element: HTMLElement) => {
    const grid = gridRef.current
    if (grid?.contains(element) && grid.scrollHeight > grid.clientHeight) {
      const gridRect = grid.getBoundingClientRect()
      const elementRect = element.getBoundingClientRect()
      const delta = elementRect.top < gridRect.top
        ? elementRect.top - gridRect.top
        : elementRect.bottom > gridRect.bottom ? elementRect.bottom - gridRect.bottom : 0
      if (delta) grid.scrollTop += delta
      return
    }
    const rect = element.getBoundingClientRect()
    const delta = rect.top < 8 ? rect.top - 8 : rect.bottom > window.innerHeight - 8 ? rect.bottom - window.innerHeight + 8 : 0
    if (delta) window.scrollBy({ top: delta, behavior: 'instant' })
  }, [])

  const focusDetail = useCallback(() => {
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current)
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null
      const heading = detailHeadingRef.current
      heading?.focus({ preventScroll: true })
      if (heading) scrollFocusTargetIntoView(heading)
    })
  }, [scrollFocusTargetIntoView])

  const selectLesson = (lessonId: string, button: HTMLButtonElement, moveFocus: boolean) => {
    selectedButtonRef.current = button
    setSelectedLessonId(lessonId)
    onSelectionChange(lessonId)
    if (moveFocus) focusDetail()
  }

  const clearSelection = useCallback((restoreFocus = false) => {
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current)
    focusFrameRef.current = null
    setSelectedLessonId(null)
    onSelectionChange(null)
    if (restoreFocus) {
      const button = selectedButtonRef.current
      if (button?.isConnected) {
        button.focus({ preventScroll: true })
        scrollFocusTargetIntoView(button)
      }
    }
  }, [onSelectionChange, scrollFocusTargetIntoView])

  useEffect(() => {
    if (!import.meta.env.DEV || !authorEditorOpen) return
    const frame = window.requestAnimationFrame(() => firstAuthorControlRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [authorEditorOpen])

  useEffect(() => {
    clearSelectionRef.current = () => clearSelection(true)
    return () => {
      if (clearSelectionRef.current) clearSelectionRef.current = null
      if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current)
    }
  }, [clearSelection, clearSelectionRef])

  const exportDomainDraft = () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      curriculumRevision: lessonRegistry.curriculumRevision,
      domainColors: draftColors,
      lessonDomainChanges: lessonRegistry.lessons.flatMap((lesson) => {
        const to = draftDomains[lesson.lessonId] ?? lesson.domain
        return to === lesson.domain ? [] : [{ lessonId: lesson.lessonId, from: lesson.domain, to }]
      }),
    }, null, 2)
    if (!onAuthorExport(json)) {
      setAuthorExportMessage('JSONを書き出せませんでした。変更は保持されています。もう一度お試しください。')
      return
    }
    setLastExportSnapshot(draftSnapshot)
    setAuthorExportMessage('書き出し操作を開始しました。ファイルの保存先を確認してください。')
  }

  const closeAuthorEditor = () => {
    setAuthorEditorOpen(false)
    window.requestAnimationFrame(() => authorEditorButtonRef.current?.focus({ preventScroll: true }))
  }

  const updateDraftDomain = (lessonId: string, value: string) => {
    if (Object.hasOwn(lessonDomains, value)) {
      setDraftDomains((current) => ({ ...current, [lessonId]: value as LessonDomain }))
      setAuthorExportMessage('')
    }
  }

  return (
    <div className={`map-graph-layout${selectedLesson ? ' has-detail' : ''}${authorEditorOpen ? ' map-author-open' : ''}`} style={domainColorStyle}>
      <section className="map-graph-view" aria-label="分野別学習マップ">
        <div className="map-graph-toolbar">
          <p className="map-selection" aria-live="polite">
            {selectedLesson ? `選択中: ${selectedTitle}。分野: ${selectedDomainLabel}。` : '分野ごとの単元です。'}
            {' '}分類内の表示順は、おすすめの学習順を示しません。
            {selectedLesson && (directPrerequisiteIds.size
              ? ` 選択した単元の直接の共通必須前提 ${directPrerequisiteIds.size} 件を強調しています。`
              : ' 選択した単元に直接の共通必須前提はありません。')}
          </p>
          {import.meta.env.DEV && <div className="map-graph-actions">
            <button ref={authorEditorButtonRef} type="button" aria-expanded={authorEditorOpen}
              onClick={() => setAuthorEditorOpen((open) => !open)}>{authorEditorOpen ? '分野編集を閉じる' : '分野編集'}</button>
          </div>}
          <ul className="map-domain-legend" aria-label="教材分野の凡例">
            {Object.entries(lessonDomains).map(([domain, label]) => (
              <li key={domain}><span className={`map-domain-swatch map-domain-${domain}`} aria-hidden="true" />{label}</li>
            ))}
          </ul>
        </div>
        <div ref={gridRef} className="map-grid-scroll">
          <div className="map-domain-grid" aria-label="5分類の学習マップ">
            {Object.entries(lessonDomains).map(([domain, label]) => {
              const lessons = lessonRegistry.lessons.filter((lesson) => (draftDomains[lesson.lessonId] ?? lesson.domain) === domain)
              return <section className={`map-domain-column map-domain-${domain}`} key={domain} aria-labelledby={`map-domain-${domain}`}>
                <h2 id={`map-domain-${domain}`}><span className="map-domain-swatch" aria-hidden="true" />{label}<span className="map-domain-count">{lessons.length}単元</span></h2>
                <ul>
                  {lessons.map((lesson) => {
                    const selected = lesson.lessonId === selectedLessonId
                    const prerequisite = directPrerequisiteIds.has(lesson.lessonId)
                    const status = manualProgress[lesson.lessonId]?.status ?? 'not-started'
                    const statusLabel = status === 'completed' ? '完了' : status === 'started' ? '学習中' : '未開始'
                    const progressSummary = getMapProgressSummary(progress, lesson.lessonId)
                    return <li key={lesson.lessonId}>
                      <button
                        type="button"
                        className={`map-lesson-button${selected ? ' is-selected' : ''}${prerequisite ? ' is-prerequisite' : ''}${status === 'completed' ? ' is-completed' : ''}`}
                        data-lesson-id={lesson.lessonId}
                        aria-label={`${lesson.title}（${lesson.availability === 'planned' ? '未収録、' : ''}手動進捗：${statusLabel}）`}
                        aria-pressed={selected}
                        aria-describedby={prerequisite ? `map-prerequisite-${lesson.lessonId}` : undefined}
                        onClick={(event) => selectLesson(lesson.lessonId, event.currentTarget, event.detail === 0)}
                      >
                        <span className="map-lesson-title">{lesson.title}</span>
                        <span className="map-lesson-status">
                          {lesson.availability === 'planned' && <span className="map-lesson-availability">未収録</span>}
                          <span className={`map-manual-status${status === 'completed' ? ' is-completed' : ''}`}>{statusLabel}</span>
                          <span className="map-progress-summary" aria-label={progressSummary.ariaLabel}>{progressSummary.label}</span>
                        </span>
                        {prerequisite && <span className="map-prerequisite-badge" aria-hidden="true">前提</span>}
                        {prerequisite && <span className="visually-hidden" id={`map-prerequisite-${lesson.lessonId}`}>
                          「{selectedTitle}」の直接の共通必須前提です。
                        </span>}
                      </button>
                    </li>
                  })}
                </ul>
              </section>
            })}
          </div>
        </div>
      </section>
      {selectedLesson && <LessonDetailCard
        key={selectedLesson.lessonId}
        lesson={selectedLesson}
        manualProgress={manualProgress[selectedLesson.lessonId]}
        manualProgressDisabled={manualProgressDisabled}
        onManualProgressAction={(action) => onManualProgressAction(selectedLesson.lessonId, action)}
        headingRef={detailHeadingRef}
        onClose={() => clearSelection(true)}
      />}
      {import.meta.env.DEV && authorEditorOpen && <section className="map-author-editor" aria-label="教材分野と色の編集">
        <header className="map-author-header">
          <div className="map-author-summary" aria-live="polite">
            <span>{selectedLesson?.title ?? '教材を選択すると、現在の分野を表示します。'}</span>
            {selectedDomainLabel && <span>{selectedDomainLabel}</span>}
          </div>
          <button type="button" onClick={closeAuthorEditor}>閉じる</button>
        </header>
        <div className="map-author-content">
          <p className="map-author-warning">draftは一時保存です。画面移動、表示切替、再読み込みで失われます。</p>
          <fieldset className="map-author-color-fields">
            <legend>分野の色（全体に反映）</legend>
            {Object.entries(lessonDomains).map(([domain, label], index) => (
              <label key={domain}>
                <span>{label}</span>
                <input ref={index === 0 ? firstAuthorControlRef : undefined} type="color" value={draftColors[domain as LessonDomain]}
                  onChange={(event) => {
                    const color = event.currentTarget.value
                    setDraftColors((current) => ({ ...current, [domain]: color }))
                    setAuthorExportMessage('')
                  }} />
              </label>
            ))}
          </fieldset>
          <fieldset className="map-author-domain-fields">
            <legend>単元の分野</legend>
            {lessonRegistry.lessons.map((lesson) => (
              <label key={lesson.lessonId}>
                <span>{lesson.title}</span>
                <select value={draftDomains[lesson.lessonId] ?? lesson.domain}
                  onChange={(event) => updateDraftDomain(lesson.lessonId, event.currentTarget.value)}>
                  {Object.entries(lessonDomains).map(([domain, domainLabel]) => <option key={domain} value={domain}>{domainLabel}</option>)}
                </select>
              </label>
            ))}
          </fieldset>
          <p className="map-author-dirty" role="status" aria-live="polite">
            {hasUnexportedChanges ? '未書き出しの変更があります。' : '変更はありません。'}
          </p>
          <button type="button" onClick={exportDomainDraft}>レビュー用JSONを書き出す</button>
          <p className="map-author-export-message" role="status" aria-live="polite">{authorExportMessage}</p>
        </div>
      </section>}
    </div>
  )
}

export function LessonMapView(props: LessonMapViewProps) {
  return <LessonGraph {...props} />
}
