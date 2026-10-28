import type { LessonDomain, LessonRef, LessonRegistry } from './lesson-contract.mjs'

export type LessonGraphNode = {
  readonly id: string
  readonly title: string
  readonly availability: 'included' | 'planned'
  readonly domain: LessonDomain
  readonly goals: readonly string[]
  readonly sections: readonly string[]
}

type LessonGraphEdgeBase = {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly sourceRef: LessonRef
  readonly targetRef: LessonRef
}

export type CommonPrerequisiteEdge = LessonGraphEdgeBase & {
  readonly kind: 'common-prerequisite'
}

export type ConditionalPrerequisiteEdge = LessonGraphEdgeBase & {
  readonly kind: 'conditional-prerequisite'
  readonly conditionId: string
  readonly condition: string
}

export type OptionalReviewEdge = LessonGraphEdgeBase & {
  readonly kind: 'optional-review'
  readonly context: string
}

export type LessonGraphEdge = CommonPrerequisiteEdge | ConditionalPrerequisiteEdge | OptionalReviewEdge

export type LessonGraph = {
  readonly nodes: readonly LessonGraphNode[]
  readonly commonPrerequisiteEdges: readonly CommonPrerequisiteEdge[]
  readonly conditionalPrerequisiteEdges: readonly ConditionalPrerequisiteEdge[]
  readonly optionalReviewEdges: readonly OptionalReviewEdge[]
}

export function deriveLessonGraph(registry: LessonRegistry): LessonGraph
