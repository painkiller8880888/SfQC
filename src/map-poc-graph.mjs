import dagre from '@dagrejs/dagre'
import { MarkerType, Position } from '@xyflow/react'
import { deriveLessonGraph } from './lesson-graph.mjs'
import { lessonRegistry } from './lesson-registry.mjs'

export const MAP_NODE_WIDTH = 272
export const MAP_NODE_HEIGHT = 88

/** @param {import('./lesson-contract.mjs').LessonRegistry} [registry] */
export function createMapPocGraph(registry = lessonRegistry) {
  const { nodes: lessons, commonPrerequisiteEdges } = deriveLessonGraph(registry)
  const layout = new dagre.graphlib.Graph()
  layout.setDefaultEdgeLabel(() => ({}))
  layout.setGraph({ rankdir: 'LR', nodesep: 32, ranksep: 80, marginx: 24, marginy: 24 })

  for (const lesson of lessons) layout.setNode(lesson.id, { width: MAP_NODE_WIDTH, height: MAP_NODE_HEIGHT })
  for (const edge of commonPrerequisiteEdges) layout.setEdge(edge.source, edge.target)
  dagre.layout(layout)

  return {
    nodes: lessons.map((lesson) => {
      const { x, y } = layout.node(lesson.id)
      return {
        id: lesson.id,
        type: 'default',
        ariaLabel: lesson.title,
        position: { x: x - MAP_NODE_WIDTH / 2, y: y - MAP_NODE_HEIGHT / 2 },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: { width: MAP_NODE_WIDTH, height: MAP_NODE_HEIGHT },
        data: { label: lesson.title },
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
