import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
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
import { LessonDetailCard } from './lesson-view'

type LessonMapViewProps = {
  viewport: Viewport | null
  selectedLessonId: string | null
  onViewportChange: (viewport: Viewport) => void
  onSelectionChange: (lessonId: string | null) => void
  clearSelectionRef: { current: (() => void) | null }
}

function LessonGraph({ viewport, selectedLessonId: initialSelectedLessonId, onViewportChange, onSelectionChange, clearSelectionRef }: LessonMapViewProps) {
  const graph = useMemo(() => createMapPocGraph(), [])
  const [nodes, setNodes, onNodesChange] = useNodesState<MapPocNode>(graph.nodes.map((node) => ({
    ...node,
    selected: node.id === initialSelectedLessonId,
  })))
  const [edges, , onEdgesChange] = useEdgesState(graph.edges)
  const { fitView, getNodes } = useReactFlow()
  const detailHeadingRef = useRef<HTMLHeadingElement>(null)
  const fitViewButtonRef = useRef<HTMLButtonElement>(null)
  const pendingKeyboardFocusRef = useRef<string | null>(null)
  const keyboardFocusFrameRef = useRef<number | null>(null)
  const focusRestoreFrameRef = useRef<number | null>(null)
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
    setNodes((currentNodes) => currentNodes.map((node) => node.selected ? { ...node, selected: false } : node))
    onSelectionChange(null)
    if (restoreFocus) {
      focusRestoreFrameRef.current = window.requestAnimationFrame(() => {
        focusRestoreFrameRef.current = null
        fitViewButtonRef.current?.focus({ preventScroll: true })
      })
    }
  }, [cancelFocusRestore, cancelKeyboardFocus, onSelectionChange, setNodes])

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

  const resetLayout = () => {
    const selectedId = nodes.find((node) => node.selected)?.id ?? null
    const nextGraph = createMapPocGraph()
    setNodes(nextGraph.nodes.map((node) => ({ ...node, selected: node.id === selectedId })))
    window.requestAnimationFrame(() => void fitView({ padding: 0.14, duration: 180 }))
  }

  return (
    <div className={`map-graph-layout${selectedLesson ? ' has-detail' : ''}`}>
      <div className="map-graph-view" onKeyDownCapture={handleKeyDownCapture}>
        <div className="map-graph-toolbar">
          <p className="map-selection" aria-live="polite">選択中: {selectedTitle || 'なし'}</p>
          <div className="map-graph-actions">
            <button ref={fitViewButtonRef} type="button" onClick={() => void fitView({ padding: 0.14, duration: 180 })}>全体表示</button>
            <button type="button" onClick={resetLayout}>Re-layout</button>
          </div>
        </div>
        <section className="map-canvas" aria-label="教材単元の依存関係">
          <ReactFlow<MapPocNode>
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onMove={handleMove}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onSelectionChange={handleSelectionChange}
            onInit={handleInit}
            nodesConnectable={false}
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
        lesson={selectedLesson}
        headingRef={detailHeadingRef}
        onClose={() => clearSelection(true)}
      />}
    </div>
  )
}

export function LessonMapView(props: LessonMapViewProps) {
  return <ReactFlowProvider><LessonGraph {...props} /></ReactFlowProvider>
}
