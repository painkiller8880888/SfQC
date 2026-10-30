import { useCallback, useEffect, useMemo } from 'react'
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useViewport,
  type OnMove,
  type OnSelectionChangeFunc,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './lesson-map-view.css'
import { createMapPocGraph, type MapPocNode } from './map-poc-graph.mjs'

type LessonMapViewProps = {
  viewport: Viewport | null
  selectedLessonId: string | null
  onViewportChange: (viewport: Viewport) => void
  onSelectionChange: (lessonId: string | null) => void
}

function LessonGraph({ viewport, selectedLessonId, onViewportChange, onSelectionChange }: LessonMapViewProps) {
  const graph = useMemo(() => createMapPocGraph(), [])
  const [nodes, setNodes, onNodesChange] = useNodesState<MapPocNode>(graph.nodes.map((node) => ({
    ...node,
    selected: node.id === selectedLessonId,
  })))
  const [edges, , onEdgesChange] = useEdgesState(graph.edges)
  const { fitView } = useReactFlow()
  const currentViewport = useViewport()
  const selectedTitle = nodes.find((node) => node.selected)?.data.label ?? ''
  const handleMove: OnMove = useCallback((_, nextViewport) => onViewportChange(nextViewport), [onViewportChange])
  useEffect(() => onViewportChange(currentViewport), [currentViewport, onViewportChange])
  const handleSelectionChange: OnSelectionChangeFunc<MapPocNode> = useCallback(({ nodes: selectedNodes }) => {
    onSelectionChange(selectedNodes[0]?.id ?? null)
  }, [onSelectionChange])
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
    <div className="map-graph-view">
      <div className="map-graph-toolbar">
        <p className="map-selection" aria-live="polite">選択中: {selectedTitle || 'なし'}</p>
        <div className="map-graph-actions">
          <button type="button" onClick={() => void fitView({ padding: 0.14, duration: 180 })}>全体表示</button>
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
  )
}

export function LessonMapView(props: LessonMapViewProps) {
  return <ReactFlowProvider><LessonGraph {...props} /></ReactFlowProvider>
}
