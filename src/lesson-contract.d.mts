export type LessonRef = string

export type InlineLessonRef = {
  label: string
  targetRef: LessonRef
}

export type ParagraphPart =
  | { kind: 'text'; text: string }
  | ({ kind: 'lessonRef' } & InlineLessonRef)

export type FormulaPart =
  | { kind: 'mathText'; text: string }
  | { kind: 'mathSymbol'; symbol: string; lessonRef?: InlineLessonRef }

export type LessonBodyBlock =
  | { kind: 'paragraph'; parts: ParagraphPart[] }
  | { kind: 'formula'; parts: FormulaPart[] }
  | ({ kind: 'lessonRef' } & InlineLessonRef)
  | { kind: 'figureRef'; figureId: string }

export type SectionDefinition = {
  sectionId: string
  title: string
  blocks: LessonBodyBlock[]
}

export type FigureVariable = { name: string; unit: string }
export type FigureAxis = { axis: 'x' | 'y'; label: string; scale: 'linear' | 'log' | 'categorical' }
export type FigureLegendItem = { label: string; meaning: string }

export type FigureDefinition = {
  figureId: string
  rendererRef: string
  educationalPurpose: string
  variables: FigureVariable[]
  axes: FigureAxis[]
  legend: FigureLegendItem[]
  altText: string
}

export type ConditionalPrerequisite = {
  conditionId: string
  methodSectionRef: LessonRef
  condition: string
  prerequisiteRef: LessonRef
}

export type OptionalReview = {
  fromRef: LessonRef
  targetRef: LessonRef
  context: string
}

type LessonBase = {
  lessonId: string
  title: string
  learningObjectives: string[]
  declaredSectionIds: string[]
  commonPrerequisites: LessonRef[]
  conditionalPrerequisites: ConditionalPrerequisite[]
  optionalReviews: OptionalReview[]
  questionIds: []
  sourceItemIds: string[]
  sourceRefs: string[]
  revision: number
}

export type PlannedLessonDefinition = LessonBase & {
  availability: 'planned'
}

export type IncludedLessonDefinition = LessonBase & {
  availability: 'included'
  sections: SectionDefinition[]
  figures: FigureDefinition[]
}

export type LessonDefinition = PlannedLessonDefinition | IncludedLessonDefinition

export type SourceDefinition = {
  sourceId: string
  title: string
  url: string
  version: string
  checkedAt: string
  location: string
  purpose: string
  coversSourceItemIds: string[]
}

export type LessonRegistry = {
  curriculumRevision: number
  officialSourceItemIds: string[]
  sources: SourceDefinition[]
  lessons: LessonDefinition[]
}

export declare function validateLessonRegistry(value: unknown): value is LessonRegistry
