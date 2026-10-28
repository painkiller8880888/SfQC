import assert from 'node:assert/strict'
import test from 'node:test'
import { MarkerType, Position } from '@xyflow/react'
import { deriveLessonGraph } from '../src/lesson-graph.mjs'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import { createMapPocGraph, MAP_NODE_HEIGHT, MAP_NODE_WIDTH } from '../src/map-poc-graph.mjs'

test('PoC maps all lessons and only common prerequisites into a non-overlapping left-to-right graph', () => {
  const source = deriveLessonGraph(lessonRegistry)
  const { nodes, edges } = createMapPocGraph()
  const nodeIds = new Set(nodes.map(({ id }) => id))

  assert.equal(nodes.length, 34)
  assert.equal(edges.length, 64)
  assert.equal(nodeIds.size, 34)
  assert.deepEqual(new Set(edges.map(({ id }) => id)), new Set(source.commonPrerequisiteEdges.map(({ id }) => id)))

  for (const node of nodes) {
    assert.equal(node.sourcePosition, Position.Right)
    assert.equal(node.targetPosition, Position.Left)
    assert.equal(node.style?.width, MAP_NODE_WIDTH)
    assert.equal(node.style?.height, MAP_NODE_HEIGHT)
    assert.ok(Number.isFinite(node.position.x) && Number.isFinite(node.position.y))
  }

  for (const [index, edge] of edges.entries()) {
    const sourceEdge = source.commonPrerequisiteEdges[index]
    assert.equal(edge.id, sourceEdge.id)
    assert.equal(edge.source, sourceEdge.source)
    assert.equal(edge.target, sourceEdge.target)
    assert.ok(nodeIds.has(edge.source) && nodeIds.has(edge.target))
    assert.deepEqual(edge.markerEnd, { type: MarkerType.ArrowClosed })
  }

  for (let left = 0; left < nodes.length; left += 1) {
    const a = nodes[left]
    for (let right = left + 1; right < nodes.length; right += 1) {
      const b = nodes[right]
      const overlapX = a.position.x < b.position.x + MAP_NODE_WIDTH && b.position.x < a.position.x + MAP_NODE_WIDTH
      const overlapY = a.position.y < b.position.y + MAP_NODE_HEIGHT && b.position.y < a.position.y + MAP_NODE_HEIGHT
      assert.ok(!(overlapX && overlapY), `Dagre rectangles overlap: ${a.id}, ${b.id}`)
    }
  }
})
