import type { Edge, Node } from '@xyflow/react'
import type { LessonRegistry } from './lesson-contract.mjs'

export type MapPocNodeData = { label: string }
export type MapPocNode = Node<MapPocNodeData, 'default'>

export const MAP_NODE_WIDTH: number
export const MAP_NODE_HEIGHT: number
export function createMapPocGraph(registry?: LessonRegistry): { nodes: MapPocNode[]; edges: Edge[] }
