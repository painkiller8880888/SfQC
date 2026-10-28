import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './map-poc.css'
import { createMapPocGraph, type MapPocNode } from './map-poc-graph.mjs'

const initialGraph = createMapPocGraph()

function MapPoc() {
  const { fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<MapPocNode>(initialGraph.nodes)
  const [edges, , onEdgesChange] = useEdgesState(initialGraph.edges)
  const [selectedTitle, setSelectedTitle] = useState('')

  function resetLayout() {
    setNodes(createMapPocGraph().nodes)
    setSelectedTitle('')
    window.requestAnimationFrame(() => void fitView({ padding: 0.14, duration: 180 }))
  }

  return (
    <main className="map-page">
      <header className="map-header">
        <div className="map-heading">
          <h1>教材グラフ PoC</h1>
          <p>34単元・64共通必須前提</p>
        </div>
        <div className="map-actions">
          <button type="button" onClick={() => void fitView({ padding: 0.14, duration: 180 })}>全体表示</button>
          <button type="button" onClick={resetLayout}>Re-layout</button>
        </div>
        <p className="map-selection" aria-live="polite">選択中: {selectedTitle || 'なし'}</p>
      </header>
      <section className="map-canvas" aria-label="教材単元の依存関係">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => setSelectedTitle(node.data.label)}
          nodesConnectable={false}
          edgesReconnectable={false}
          deleteKeyCode={null}
          fitView
          fitViewOptions={{ padding: 0.14 }}
          minZoom={0.12}
          maxZoom={2}
        >
          <Background gap={24} />
          <Controls showInteractive={false} aria-label="グラフ操作" />
        </ReactFlow>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <ReactFlowProvider>
    <MapPoc />
  </ReactFlowProvider>,
)
