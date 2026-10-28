// @ts-check
import { deriveLessonGraph } from '../src/lesson-graph.mjs'
import { lessonRegistry } from '../src/lesson-registry.mjs'

const graph = deriveLessonGraph(lessonRegistry)

// @ts-expect-error: graph arrays are readonly in the API.
graph.nodes.push(graph.nodes[0])
// @ts-expect-error: node properties are readonly in the API.
graph.nodes[0].id = 'changed'
// @ts-expect-error: nested node arrays are readonly in the API.
graph.nodes[0].sections.push('changed')
// @ts-expect-error: edge properties are readonly in the API.
graph.commonPrerequisiteEdges[0].source = 'changed'

/** @returns {string[]} */
export function checkLessonGraphNarrowing() {
  const edges = [
    ...graph.commonPrerequisiteEdges,
    ...graph.conditionalPrerequisiteEdges,
    ...graph.optionalReviewEdges,
  ]
  return edges.map((edge) => {
    if (edge.kind === 'conditional-prerequisite') return `${edge.conditionId}: ${edge.condition}`
    if (edge.kind === 'optional-review') return edge.context
    return `${edge.sourceRef} -> ${edge.targetRef}`
  })
}
