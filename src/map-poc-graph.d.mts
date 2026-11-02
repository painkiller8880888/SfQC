import type { Edge, Node } from '@xyflow/react'
import type { ReactNode } from 'react'
import type { LessonDomain, LessonRegistry } from './lesson-contract.mjs'
import type { CommonPrerequisiteEdge } from './lesson-graph.mjs'

export type MapPocNodeData = { label: ReactNode; domain: LessonDomain }
export type MapPocNode = Node<MapPocNodeData, 'default'>

export const MAP_NODE_WIDTH: number
export const MAP_NODE_HEIGHT: number
export function createMapPocGraph(registry?: LessonRegistry, positions?: Record<string, { x: number; y: number }>): {
  commonPrerequisiteEdges: readonly CommonPrerequisiteEdge[]
  nodes: MapPocNode[]
  edges: Edge[]
}
