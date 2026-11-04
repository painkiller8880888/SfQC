import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  applyNodeChanges,
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  type NodeChange,
  useReactFlow,
  type OnMove,
  type NodeMouseHandler,
  type OnSelectionChangeFunc,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './lesson-map-view.css'
import { createMapPocGraph, type MapPocNode } from './map-poc-graph.mjs'
import { lessonDomainColors, lessonDomains, type LessonDomain } from './lesson-contract.mjs'
import { lessonRegistry } from './lesson-registry.mjs'
import type { ManualProgressCommand, ManualProgressState } from './manual-progress.mjs'
import type { MapState } from './map-state.mjs'
import type { ProgressData } from './progress-data.mjs'
import { LessonDetailCard } from './lesson-view'

export type Positions = MapState['positions']
export type LayoutSaveResult = { ok: true; positions: Positions } | { ok: false; positions: Positions }

export function applyMapNodeChanges(nodes: MapPocNode[], changes: NodeChange<MapPocNode>[]) {
  return applyNodeChanges(changes, nodes)
}

export function mapPositions(nodes: MapPocNode[]): Positions {
  return Object.fromEntries(nodes.map(({ id, position }) => [id, { x: position.x, y: position.y }]))
}

export function samePositions(left: Positions, right: Positions) {
  const leftIds = Object.keys(left)
  const rightIds = Object.keys(right)
  return leftIds.length === rightIds.length
    && leftIds.every((id) => right[id] && left[id].x === right[id].x && left[id].y === right[id].y)
}

export function shouldSaveMapLayout(changes: NodeChange<MapPocNode>[], candidate: Positions, confirmed: Positions) {
  return changes.some((change) => change.type === 'position' && change.dragging !== true)
    && !samePositions(confirmed, candidate)
}

export function getMapProgressSummary(progress: ProgressData | null, lessonId: string) {
  const observation = progress?.lessons.find((item) => item.lessonId === lessonId)
  if (!observation) return {
    label: '集計未確認',
    ariaLabel: '演習集計未確認、正答数と試行数は不明',
  }
  const counts = `${observation.correctCount}/${observation.attemptCount}回`
  if (observation.correctRate === null) return {
    label: '—（試行0回）',
    ariaLabel: `正答率未記録、正答数/試行数 ${counts}`,
  }
  const percentage = Math.round(observation.correctRate * 100)
  return {
    label: `${percentage}%（${counts}）`,
    ariaLabel: `正答率${percentage}%、正答数/試行数 ${counts}`,
  }
}

type LessonMapViewProps = {
  theme: 'light' | 'dark'
  viewport: Viewport | null
  selectedLessonId: string | null
  progress: ProgressData | null
  manualProgress: ManualProgressState
  manualProgressDisabled?: boolean
  positions: Positions
  positionSyncRevision: number
  onLayoutSave: (positions: Positions) => LayoutSaveResult
  onManualProgressAction: (lessonId: string, action: ManualProgressCommand) => void
  onViewportChange: (viewport: Viewport) => void
  onSelectionChange: (lessonId: string | null) => void
  onAuthorModeChange: (open: boolean) => void
  onAuthorExport: (json: string) => boolean
  clearSelectionRef: { current: (() => void) | null }
}

function LessonGraph({ theme, viewport, selectedLessonId: initialSelectedLessonId, progress, manualProgress, manualProgressDisabled, positions, positionSyncRevision, onLayoutSave, onManualProgressAction, onViewportChange, onSelectionChange, onAuthorModeChange, onAuthorExport, clearSelectionRef }: LessonMapViewProps) {
  const graph = useMemo(() => createMapPocGraph(), [])
  const dagrePositions = useMemo(() => mapPositions(graph.nodes), [graph])
  const [nodes, setNodes] = useState<MapPocNode[]>(() => graph.nodes.map((node) => ({
    ...node,
    position: positions[node.id] ?? node.position,
    selected: node.id === initialSelectedLessonId,
  })))
  const [edges, , onEdgesChange] = useEdgesState(graph.edges)
  const [layoutEditing, setLayoutEditing] = useState(false)
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
  const nodeSnapshotRef = useRef(nodes)
  const confirmedNodePositionsRef = useRef(mapPositions(nodes))
  const positionsPropRef = useRef(positions)
  const layoutEditingRef = useRef(false)
  positionsPropRef.current = positions
  const { fitView, getNodes, getViewport, setViewport } = useReactFlow()
  const mapCanvasRef = useRef<HTMLElement>(null)
  const detailHeadingRef = useRef<HTMLHeadingElement>(null)
  const fitViewButtonRef = useRef<HTMLButtonElement>(null)
  const pendingKeyboardFocusRef = useRef<string | null>(null)
  const keyboardFocusFrameRef = useRef<number | null>(null)
  const focusRestoreFrameRef = useRef<number | null>(null)
  const commitNodes = useCallback((next: MapPocNode[]) => {
    nodeSnapshotRef.current = next
    setNodes(next)
  }, [])
  const setLayoutEditingMode = useCallback((next: boolean) => {
    layoutEditingRef.current = next
    setLayoutEditing(next)
  }, [])
  const applyConfirmedPositions = useCallback((candidate: Positions) => {
    const resolved = Object.fromEntries(graph.nodes.map(({ id }) => [id, candidate[id] ?? dagrePositions[id]])) as Positions
    confirmedNodePositionsRef.current = resolved
    const current = nodeSnapshotRef.current
    const next = current.map((node) => {
      const position = resolved[node.id]
      return node.position.x === position.x && node.position.y === position.y ? node : { ...node, position }
    })
    if (next.some((node, index) => node !== current[index])) commitNodes(next)
  }, [commitNodes, dagrePositions, graph.nodes])
  const handleNodesChange = useCallback((changes: NodeChange<MapPocNode>[]) => {
    const allowPositionChanges = !manualProgressDisabled && layoutEditingRef.current
    const acceptedChanges = allowPositionChanges ? changes : changes.filter((change) => change.type !== 'position')
    const next = applyMapNodeChanges(nodeSnapshotRef.current, acceptedChanges)
    commitNodes(next)
    if (!allowPositionChanges) return
    const candidate = mapPositions(next)
    if (!shouldSaveMapLayout(changes, candidate, confirmedNodePositionsRef.current)) return
    applyConfirmedPositions(onLayoutSave(candidate).positions)
  }, [applyConfirmedPositions, commitNodes, manualProgressDisabled, onLayoutSave])
  const handleLayoutEditingToggle = () => {
    if (manualProgressDisabled) return
    setLayoutEditingMode(!layoutEditingRef.current)
  }
  const selectedTitle = String(nodes.find((node) => node.selected)?.data.label ?? '')
  const selectedLessonId = nodes.find((node) => node.selected)?.id
  const selectedLesson = lessonRegistry.lessons.find((lesson) => lesson.lessonId === selectedLessonId)
  const selectedDomain = selectedLesson ? draftDomains[selectedLesson.lessonId] ?? selectedLesson.domain : null
  const selectedDomainLabel = selectedDomain ? lessonDomains[selectedDomain] : null
  const directPrerequisiteEdges = graph.commonPrerequisiteEdges.filter((edge) => edge.target === selectedLessonId)
  const directPrerequisiteIds = new Set(directPrerequisiteEdges.map((edge) => edge.source))
  const directPrerequisiteEdgeIds = new Set(directPrerequisiteEdges.map((edge) => edge.id))
  const lessonTitles = Object.fromEntries(graph.nodes.map(({ id, data }) => [id, String(data.label)]))
  const displayNodes = nodes.map((node) => {
    const title = String(node.data.label)
    const domain = draftDomains[node.id] ?? node.data.domain
    const domainLabel = lessonDomains[domain]
    const lesson = lessonRegistry.lessons.find((item) => item.lessonId === node.id)
    const isPlanned = lesson?.availability === 'planned'
    const progressSummary = getMapProgressSummary(progress, node.id)
    const manualStatus = manualProgress[node.id]?.status ?? 'not-started'
    const manualStatusLabel = manualStatus === 'completed' ? '完了'
      : manualStatus === 'started' ? '学習中' : '未開始'
    const isCompleted = manualStatus === 'completed'
    const relation = node.selected ? '選択中'
      : directPrerequisiteIds.has(node.id) ? `「${selectedTitle}」の直接の共通必須前提` : null
    const classNames = (node.className ?? '').split(/\s+/u)
      .filter((className) => className && !className.startsWith('map-domain-'))
    return {
      ...node,
      className: [...classNames, `map-domain-${domain}`,
        directPrerequisiteIds.has(node.id) ? 'map-prerequisite' : null].filter(Boolean).join(' '),
      ariaLabel: `${title}（分野：${domainLabel}${isPlanned ? '、未収録' : ''}、${progressSummary.ariaLabel}、手動進捗：${manualStatusLabel}${relation ? `、${relation}` : ''}）`,
      data: {
        ...node.data,
        label: <>
          <span className="map-node-title">{title}</span>
          <span className="map-node-domain">{domainLabel}</span>
          <span className="map-node-progress-row">
            {isPlanned && <span className="map-node-availability">未収録</span>}
            <span className="map-node-progress">{progressSummary.label}</span>
          </span>
          <span className="map-node-completed" aria-hidden="true">{isCompleted ? '✓' : ''}</span>
        </>,
      },
    }
  })
  const domainColorStyle = authorEditorOpen ? Object.fromEntries(Object.entries(draftColors)
    .map(([domain, color]) => [`--map-author-domain-${domain}`, color])) as CSSProperties : undefined
  const draftSnapshot = JSON.stringify({ domains: draftDomains, colors: draftColors })
  const hasUnexportedChanges = draftSnapshot !== lastExportSnapshot
  const displayEdges = edges.map((edge) => {
    const highlighted = directPrerequisiteEdgeIds.has(edge.id)
    const sourceTitle = lessonTitles[edge.source] ?? edge.source
    const targetTitle = lessonTitles[edge.target] ?? edge.target
    return {
      ...edge,
      className: highlighted
        ? [edge.className, 'map-prerequisite-edge'].filter(Boolean).join(' ')
        : edge.className,
      markerEnd: highlighted
        ? { type: MarkerType.ArrowClosed, color: 'var(--map-prerequisite)' }
        : edge.markerEnd,
      ariaLabel: `${sourceTitle}から${targetTitle}への共通必須前提${highlighted ? '（選択教材の直接前提）' : ''}`,
    }
  })
  const handleMove: OnMove = useCallback((_, nextViewport) => onViewportChange(nextViewport), [onViewportChange])
  const cancelKeyboardFocus = useCallback(() => {
    pendingKeyboardFocusRef.current = null
    if (keyboardFocusFrameRef.current !== null) window.cancelAnimationFrame(keyboardFocusFrameRef.current)
    keyboardFocusFrameRef.current = null
  }, [])
  const cancelFocusRestore = useCallback(() => {
    if (focusRestoreFrameRef.current !== null) window.cancelAnimationFrame(focusRestoreFrameRef.current)
    focusRestoreFrameRef.current = null
  }, [])
  const clearSelection = useCallback((restoreFocus = false) => {
    cancelKeyboardFocus()
    cancelFocusRestore()
    commitNodes(nodeSnapshotRef.current.map((node) => node.selected ? { ...node, selected: false } : node))
    onSelectionChange(null)
    if (restoreFocus) {
      focusRestoreFrameRef.current = window.requestAnimationFrame(() => {
        focusRestoreFrameRef.current = null
        fitViewButtonRef.current?.focus({ preventScroll: true })
      })
    }
  }, [cancelFocusRestore, cancelKeyboardFocus, commitNodes, onSelectionChange])

  useEffect(() => {
    if (manualProgressDisabled) setLayoutEditingMode(false)
  }, [manualProgressDisabled, setLayoutEditingMode])

  useEffect(() => {
    onAuthorModeChange(import.meta.env.DEV && authorEditorOpen)
    return () => onAuthorModeChange(false)
  }, [authorEditorOpen, onAuthorModeChange])

  useEffect(() => {
    if (!import.meta.env.DEV || !authorEditorOpen) return
    const frame = window.requestAnimationFrame(() => firstAuthorControlRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [authorEditorOpen])

  useEffect(() => {
    const nextPositions = Object.fromEntries(graph.nodes.map(({ id }) => [
      id, positionsPropRef.current[id] ?? dagrePositions[id],
    ])) as Positions
    const previousPositions = confirmedNodePositionsRef.current
    const changedIds = new Set(graph.nodes.filter(({ id }) => {
      const previous = previousPositions[id]
      const next = nextPositions[id]
      return previous.x !== next.x || previous.y !== next.y
    }).map(({ id }) => id))
    confirmedNodePositionsRef.current = nextPositions
    if (!changedIds.size) return
    const current = nodeSnapshotRef.current
    commitNodes(current.map((node) => changedIds.has(node.id)
      ? { ...node, position: nextPositions[node.id] }
      : node))
  }, [commitNodes, dagrePositions, graph.nodes, positionSyncRevision])

  useEffect(() => {
    const clearAndRestoreFocus = () => clearSelection(true)
    clearSelectionRef.current = clearAndRestoreFocus
    return () => {
      if (clearSelectionRef.current === clearAndRestoreFocus) clearSelectionRef.current = null
      cancelKeyboardFocus()
      cancelFocusRestore()
    }
  }, [cancelFocusRestore, cancelKeyboardFocus, clearSelection, clearSelectionRef])

  const handleSelectionChange: OnSelectionChangeFunc<MapPocNode> = useCallback(({ nodes: selectedNodes }) => {
    const notifiedId = selectedNodes[0]?.id ?? null
    const latestId = getNodes().find((node) => node.selected)?.id ?? null
    if (notifiedId === latestId) onSelectionChange(latestId)
  }, [getNodes, onSelectionChange])
  const handleNodeClick: NodeMouseHandler<MapPocNode> = useCallback((event, node) => {
    cancelKeyboardFocus()
    cancelFocusRestore()
    if (event.shiftKey && node.selected) {
      clearSelection()
    }
  }, [cancelFocusRestore, cancelKeyboardFocus, clearSelection])
  const handlePaneClick = useCallback(() => clearSelection(), [clearSelection])
  const handleKeyDownCapture = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.code !== 'Space') return
    const target = event.target
    if (!(target instanceof Element)) return
    const node = target.closest<HTMLElement>('.react-flow__node[data-id]')
    const lessonId = node?.dataset.id
    if (!lessonId) return
    cancelKeyboardFocus()
    cancelFocusRestore()
    pendingKeyboardFocusRef.current = lessonId
    keyboardFocusFrameRef.current = window.requestAnimationFrame(() => {
      keyboardFocusFrameRef.current = null
      if (pendingKeyboardFocusRef.current !== lessonId) return
      pendingKeyboardFocusRef.current = null
      if (getNodes().some((currentNode) => currentNode.id === lessonId && currentNode.selected)) {
        detailHeadingRef.current?.focus({ preventScroll: true })
      }
    })
  }, [cancelFocusRestore, cancelKeyboardFocus, getNodes])
  const handleInit = useCallback(() => {
    if (viewport === null) void fitView({ padding: 0.14 })
  }, [fitView, viewport])

  useEffect(() => {
    if (!selectedLessonId) return
    const frame = window.requestAnimationFrame(() => {
      const canvas = mapCanvasRef.current
      const node = canvas?.querySelector<HTMLElement>(`.react-flow__node[data-id="${selectedLessonId}"]`)
      if (!canvas || !node) return
      const canvasRect = canvas.getBoundingClientRect()
      const nodeRect = node.getBoundingClientRect()
      const offset = (start: number, end: number, visibleStart: number, visibleEnd: number) => {
        if (end - start > visibleEnd - visibleStart) return visibleStart - start
        if (start < visibleStart) return visibleStart - start
        if (end > visibleEnd) return visibleEnd - end
        return 0
      }
      const x = offset(nodeRect.left, nodeRect.right, canvasRect.left, canvasRect.right)
      const y = offset(nodeRect.top, nodeRect.bottom, canvasRect.top, canvasRect.bottom)
      if (x === 0 && y === 0) return
      const currentViewport = getViewport()
      void setViewport({
        x: currentViewport.x + x,
        y: currentViewport.y + y,
        zoom: currentViewport.zoom,
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [getViewport, selectedLessonId, setViewport])

  const resetLayout = () => {
    if (manualProgressDisabled || !window.confirm('手動で変更した配置を破棄し、自動配置に戻しますか？')) return
    const candidate = dagrePositions
    const result = onLayoutSave(candidate)
    applyConfirmedPositions(result.positions)
    if (result.ok) window.requestAnimationFrame(() => void fitView({ padding: 0.14, duration: 180 }))
  }

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
    <div className={`map-graph-layout${selectedLesson && !authorEditorOpen ? ' has-detail' : ''}${authorEditorOpen ? ' map-author-open' : ''}`} style={domainColorStyle}>
      <div className={`map-graph-view${authorEditorOpen ? ' map-author-open' : ''}`} onKeyDownCapture={handleKeyDownCapture}>
        {import.meta.env.DEV && authorEditorOpen ? (
          <section className="map-author-editor" aria-label="教材分野と色の編集">
            <header className="map-author-header">
              <div className="map-author-summary" aria-live="polite">
                <span>{selectedLesson?.title ?? '教材を選択すると、現在の分野を表示します。'}</span>
                {selectedDomainLabel && <span>{selectedDomainLabel}</span>}
              </div>
              <div className="map-author-actions">
                <button type="button" aria-pressed={layoutEditing} disabled={manualProgressDisabled} onClick={handleLayoutEditingToggle}>配置編集</button>
                <button type="button" onClick={closeAuthorEditor}>閉じる</button>
              </div>
            </header>
            <div className="map-author-content">
              <p className="map-author-warning">draftは一時保存です。マップ/一覧の切替、画面移動、再読み込みで失われます。</p>
              <div className="map-author-actions">
                <button type="button" onClick={() => void fitView({ padding: 0.14, duration: 180 })}>全体表示</button>
                <button type="button" disabled={manualProgressDisabled} onClick={resetLayout}>Re-layout</button>
              </div>
              <fieldset className="map-author-color-fields">
                <legend>分野の色（全体に反映）</legend>
                {Object.entries(lessonDomains).map(([domain, label], index) => (
                  <label key={domain}>
                    <span>{label}</span>
                    <input
                      ref={index === 0 ? firstAuthorControlRef : undefined}
                      type="color"
                      value={draftColors[domain as LessonDomain]}
                      onChange={(event) => {
                        const color = event.currentTarget.value
                        setDraftColors((current) => ({ ...current, [domain]: color }))
                        setAuthorExportMessage('')
                      }}
                    />
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
                      {Object.entries(lessonDomains).map(([domain, label]) => (
                        <option key={domain} value={domain}>{label}</option>
                      ))}
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
          </section>
        ) : (
          <div className="map-graph-toolbar">
            <p className="map-selection" aria-live="polite">選択中: {selectedTitle || 'なし'}{selectedDomainLabel
              ? `。分野: ${selectedDomainLabel}` : ''}{selectedLessonId
              ? directPrerequisiteEdges.length
                ? `。直接の共通必須前提 ${directPrerequisiteEdges.length} 件を強調しています`
                : '。直接の共通必須前提はありません'
              : ''}</p>
            <div className="map-graph-actions">
              <button type="button" aria-pressed={layoutEditing} disabled={manualProgressDisabled} onClick={handleLayoutEditingToggle}>配置編集</button>
              <button ref={fitViewButtonRef} type="button" onClick={() => void fitView({ padding: 0.14, duration: 180 })}>全体表示</button>
              <button type="button" disabled={manualProgressDisabled} onClick={resetLayout}>Re-layout</button>
              {import.meta.env.DEV && <button ref={authorEditorButtonRef} type="button" aria-expanded={authorEditorOpen}
                onClick={() => setAuthorEditorOpen(true)}>分野編集</button>}
            </div>
            <ul className="map-domain-legend" aria-label="教材分野の凡例">
              {Object.entries(lessonDomains).map(([domain, label]) => (
                <li key={domain}><span className={`map-domain-swatch map-domain-${domain}`} aria-hidden="true" />{label}</li>
              ))}
            </ul>
          </div>
        )}
        <section ref={mapCanvasRef} className="map-canvas" aria-label="教材単元の依存関係">
          <ReactFlow<MapPocNode>
            nodes={displayNodes}
            edges={displayEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onMove={handleMove}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onSelectionChange={handleSelectionChange}
            onInit={handleInit}
            colorMode={theme}
            defaultMarkerColor={null}
            zoomOnScroll
            panOnScroll={false}
            zoomOnPinch
            panOnDrag
            nodesConnectable={false}
            nodesDraggable={layoutEditing && !manualProgressDisabled}
            edgesReconnectable={false}
            deleteKeyCode={null}
            multiSelectionKeyCode={null}
            selectionKeyCode={null}
            selectionOnDrag={false}
            fitView={false}
            defaultViewport={viewport ?? undefined}
            minZoom={0.05}
            maxZoom={2}
          >
            <Background gap={24} />
            <Controls showInteractive={false} aria-label="グラフ操作" />
          </ReactFlow>
        </section>
      </div>
      {selectedLesson && !authorEditorOpen && <LessonDetailCard
        key={selectedLesson.lessonId}
        lesson={selectedLesson}
        manualProgress={manualProgress[selectedLesson.lessonId]}
        manualProgressDisabled={manualProgressDisabled}
        onManualProgressAction={(action) => onManualProgressAction(selectedLesson.lessonId, action)}
        headingRef={detailHeadingRef}
        onClose={() => clearSelection(true)}
      />}
    </div>
  )
}

export function LessonMapView(props: LessonMapViewProps) {
  return <ReactFlowProvider><LessonGraph {...props} /></ReactFlowProvider>
}
