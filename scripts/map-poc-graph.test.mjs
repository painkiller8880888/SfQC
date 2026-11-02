import assert from 'node:assert/strict'
import test from 'node:test'
import { MarkerType, Position } from '@xyflow/react'
import { deriveLessonGraph } from '../src/lesson-graph.mjs'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import { createMapPocGraph, MAP_NODE_HEIGHT, MAP_NODE_WIDTH } from '../src/map-poc-graph.mjs'

test('PoC maps all lessons and only common prerequisites into a non-overlapping left-to-right graph', () => {
  const source = deriveLessonGraph(lessonRegistry)
  const { commonPrerequisiteEdges, nodes, edges } = createMapPocGraph()
  const nodeIds = new Set(nodes.map(({ id }) => id))

  assert.equal(nodes.length, 34)
  assert.equal(edges.length, 64)
  assert.equal(nodeIds.size, 34)
  assert.deepEqual(commonPrerequisiteEdges, source.commonPrerequisiteEdges)
  assert.deepEqual(new Set(edges.map(({ id }) => id)), new Set(source.commonPrerequisiteEdges.map(({ id }) => id)))

  for (const node of nodes) {
    assert.equal(node.sourcePosition, Position.Right)
    assert.equal(node.targetPosition, Position.Left)
    assert.equal(node.style?.width, MAP_NODE_WIDTH)
    assert.equal(node.style?.height, MAP_NODE_HEIGHT)
    assert.ok(Number.isFinite(node.position.x) && Number.isFinite(node.position.y))
    assert.equal(node.data.domain, source.nodes.find((lesson) => lesson.id === node.id).domain)
    assert.equal(typeof node.data.label, 'string')
    assert.doesNotMatch(node.className ?? '', /map-domain-/u)
    assert.equal(Object.hasOwn(node.style ?? {}, 'backgroundColor'), false)
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

test('saved positions overlay current lessons while missing and retired IDs stay out of the graph', () => {
  const source = createMapPocGraph()
  const saved = Object.fromEntries(source.nodes.map(({ id, position }) => [id, position]))
  saved['descriptive-statistics'] = { x: -140, y: 510 }
  saved['retired-lesson'] = { x: 9, y: 12 }
  delete saved['mean-inference']

  const restored = createMapPocGraph(lessonRegistry, saved)
  const sourceNode = (id) => source.nodes.find((node) => node.id === id)
  const restoredNode = (id) => restored.nodes.find((node) => node.id === id)

  assert.deepEqual(restoredNode('descriptive-statistics').position, { x: -140, y: 510 })
  assert.deepEqual(restoredNode('mean-inference').position, sourceNode('mean-inference').position)
  assert.equal(restored.nodes.length, 34)
  assert.equal(restored.edges.length, 64)
  assert.equal(restoredNode('retired-lesson'), undefined)
})
