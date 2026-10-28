import { parseLessonRef, validateLessonRegistry } from './lesson-contract.mjs'

/**
 * @param {string} reference
 * @returns {string}
 */
function lessonIdFromRef(reference) {
  const parsed = parseLessonRef(reference)
  if (!parsed) throw new TypeError(`Invalid lesson reference: ${reference}`)
  return parsed.lessonId
}

/**
 * @param {import('./lesson-contract.mjs').LessonRegistry} registry
 * @returns {import('./lesson-graph.mjs').LessonGraph}
 */
export function deriveLessonGraph(registry) {
  if (!validateLessonRegistry(registry)) throw new TypeError('Invalid lesson registry')

  /** @type {import('./lesson-graph.mjs').LessonGraphNode[]} */
  const nodes = registry.lessons.map((lesson) => ({
    id: lesson.lessonId,
    title: lesson.title,
    availability: lesson.availability,
    domain: lesson.domain,
    goals: [...lesson.learningObjectives],
    sections: [...lesson.declaredSectionIds],
  }))

  /** @type {import('./lesson-graph.mjs').CommonPrerequisiteEdge[]} */
  const commonPrerequisiteEdges = registry.lessons.flatMap((lesson) => lesson.commonPrerequisites.map((prerequisiteRef) => {
    const source = lessonIdFromRef(prerequisiteRef)
    return {
      id: JSON.stringify(['common-prerequisite', prerequisiteRef, lesson.lessonId]),
      kind: 'common-prerequisite',
      source,
      target: lesson.lessonId,
      sourceRef: prerequisiteRef,
      targetRef: lesson.lessonId,
    }
  }))

  /** @type {import('./lesson-graph.mjs').ConditionalPrerequisiteEdge[]} */
  const conditionalPrerequisiteEdges = registry.lessons.flatMap((lesson) => lesson.conditionalPrerequisites.map((condition) => {
    return {
      id: JSON.stringify(['conditional-prerequisite', lesson.lessonId, condition.conditionId,
        condition.prerequisiteRef, condition.methodSectionRef]),
      kind: 'conditional-prerequisite',
      source: lessonIdFromRef(condition.prerequisiteRef),
      target: lessonIdFromRef(condition.methodSectionRef),
      sourceRef: condition.prerequisiteRef,
      targetRef: condition.methodSectionRef,
      conditionId: condition.conditionId,
      condition: condition.condition,
    }
  }))

  /** @type {import('./lesson-graph.mjs').OptionalReviewEdge[]} */
  const optionalReviewEdges = registry.lessons.flatMap((lesson) => lesson.optionalReviews.map((review) => {
    return {
      id: JSON.stringify(['optional-review', review.fromRef, review.targetRef]),
      kind: 'optional-review',
      source: lessonIdFromRef(review.fromRef),
      target: lessonIdFromRef(review.targetRef),
      sourceRef: review.fromRef,
      targetRef: review.targetRef,
      context: review.context,
    }
  }))

  const edgeIds = new Set()
  for (const edge of [...commonPrerequisiteEdges, ...conditionalPrerequisiteEdges, ...optionalReviewEdges]) {
    if (edge.source === edge.target) throw new TypeError('Self-referencing lesson graph edges are not supported')
    if (edgeIds.has(edge.id)) throw new TypeError(`Duplicate lesson graph edge: ${edge.id}`)
    edgeIds.add(edge.id)
  }

  return { nodes, commonPrerequisiteEdges, conditionalPrerequisiteEdges, optionalReviewEdges }
}
