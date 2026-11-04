import dagre from '@dagrejs/dagre'
import { MarkerType, Position } from '@xyflow/react'
import { deriveLessonGraph } from './lesson-graph.mjs'
import { lessonRegistry } from './lesson-registry.mjs'

export const MAP_NODE_WIDTH = 272
export const MAP_NODE_HEIGHT = 104

/** @param {import('./lesson-contract.mjs').LessonRegistry} [registry] @param {Record<string, { x: number; y: number }>} [positions] */
export function createMapPocGraph(registry = lessonRegistry, positions = {}) {
  const { nodes: lessons, commonPrerequisiteEdges } = deriveLessonGraph(registry)
  const layout = new dagre.graphlib.Graph()
  layout.setDefaultEdgeLabel(() => ({}))
  layout.setGraph({ rankdir: 'LR', nodesep: 32, ranksep: 80, marginx: 24, marginy: 24 })

  for (const lesson of lessons) layout.setNode(lesson.id, { width: MAP_NODE_WIDTH, height: MAP_NODE_HEIGHT })
  for (const edge of commonPrerequisiteEdges) layout.setEdge(edge.source, edge.target)
  dagre.layout(layout)

  return {
    commonPrerequisiteEdges,
    nodes: lessons.map((lesson) => {
      const savedPosition = positions[lesson.id]
      const { x, y } = savedPosition ?? layout.node(lesson.id)
      return {
        id: lesson.id,
        type: 'default',
        ariaLabel: lesson.title,
        position: savedPosition ? { x, y } : { x: x - MAP_NODE_WIDTH / 2, y: y - MAP_NODE_HEIGHT / 2 },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: { width: MAP_NODE_WIDTH, height: MAP_NODE_HEIGHT },
        data: { label: lesson.title, domain: lesson.domain },
      }
    }),
    edges: commonPrerequisiteEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
    })),
  }
}
