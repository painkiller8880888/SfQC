export type LessonRef = string
export type ParsedLessonRef = { lessonId: string; sectionId: string | null }
export declare const lessonDomains: {
  readonly 'math-foundations': '数学の基礎'
  readonly 'data-description': 'データ・記述統計'
  readonly 'probability-distributions': '確率・確率分布'
  readonly 'statistical-analysis': '統計分析・推測'
  readonly 'quality-methods': '品質管理手法'
}
export type LessonDomain = keyof typeof lessonDomains

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

type FigureBase = {
  figureId: string
  rendererRef: string
  educationalPurpose: string
  legend: FigureLegendItem[]
  altText: string
}

type FigureXAxis = FigureAxis & { axis: 'x' }
type FigureYAxis = FigureAxis & { axis: 'y' }

export type FigureDefinition =
  | (FigureBase & {
    kind: 'cartesian'
    variables: FigureVariable[]
    axes: [FigureXAxis, FigureYAxis] | [FigureYAxis, FigureXAxis]
  })
  | (FigureBase & { kind: 'diagram' })

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
  domain: LessonDomain
  learningObjectives: string[]
  declaredSectionIds: string[]
  commonPrerequisites: LessonRef[]
  conditionalPrerequisites: ConditionalPrerequisite[]
  optionalReviews: OptionalReview[]
  questionIds: string[]
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
  purpose: string
  citations: { sourceItemId: string; location: string }[]
}

export type LessonRegistry = {
  curriculumRevision: number
  officialSourceItemIds: string[]
  sources: SourceDefinition[]
  lessons: LessonDefinition[]
}

export function parseLessonRef(value: unknown): ParsedLessonRef | null
export declare function validateLessonRegistry(value: unknown): value is LessonRegistry
