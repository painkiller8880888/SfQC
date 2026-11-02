import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  applyNodeChanges,
  Background,
  Controls,
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
import { lessonRegistry } from './lesson-registry.mjs'
import type { ManualProgressCommand, ManualProgressState } from './manual-progress.mjs'
import type { MapState } from './map-state.mjs'
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

type LessonMapViewProps = {
  viewport: Viewport | null
  selectedLessonId: string | null
  manualProgress: ManualProgressState
  manualProgressDisabled?: boolean
  positions: Positions
  positionSyncRevision: number
  onLayoutSave: (positions: Positions) => LayoutSaveResult
  onManualProgressAction: (lessonId: string, action: ManualProgressCommand) => void
  onViewportChange: (viewport: Viewport) => void
  onSelectionChange: (lessonId: string | null) => void
  clearSelectionRef: { current: (() => void) | null }
}

function LessonGraph({ viewport, selectedLessonId: initialSelectedLessonId, manualProgress, manualProgressDisabled, positions, positionSyncRevision, onLayoutSave, onManualProgressAction, onViewportChange, onSelectionChange, clearSelectionRef }: LessonMapViewProps) {
  const graph = useMemo(() => createMapPocGraph(), [])
  const dagrePositions = useMemo(() => mapPositions(graph.nodes), [graph])
  const [nodes, setNodes] = useState<MapPocNode[]>(() => graph.nodes.map((node) => ({
    ...node,
    position: positions[node.id] ?? node.position,
    selected: node.id === initialSelectedLessonId,
  })))
  const [edges, , onEdgesChange] = useEdgesState(graph.edges)
  const [layoutEditing, setLayoutEditing] = useState(false)
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
  const selectedTitle = nodes.find((node) => node.selected)?.data.label ?? ''
  const selectedLessonId = nodes.find((node) => node.selected)?.id
  const selectedLesson = lessonRegistry.lessons.find((lesson) => lesson.lessonId === selectedLessonId)
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

  return (
    <div className={`map-graph-layout${selectedLesson ? ' has-detail' : ''}`}>
      <div className="map-graph-view" onKeyDownCapture={handleKeyDownCapture}>
        <div className="map-graph-toolbar">
          <p className="map-selection" aria-live="polite">選択中: {selectedTitle || 'なし'}</p>
          <div className="map-graph-actions">
            <button type="button" aria-pressed={layoutEditing} disabled={manualProgressDisabled} onClick={handleLayoutEditingToggle}>配置編集</button>
            <button ref={fitViewButtonRef} type="button" onClick={() => void fitView({ padding: 0.14, duration: 180 })}>全体表示</button>
            <button type="button" disabled={manualProgressDisabled} onClick={resetLayout}>Re-layout</button>
          </div>
        </div>
        <section ref={mapCanvasRef} className="map-canvas" aria-label="教材単元の依存関係">
          <ReactFlow<MapPocNode>
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onMove={handleMove}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onSelectionChange={handleSelectionChange}
            onInit={handleInit}
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
      {selectedLesson && <LessonDetailCard
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
