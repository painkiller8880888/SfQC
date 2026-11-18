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
export declare const lessonDomainColors: Readonly<Record<LessonDomain, string>>

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
  | { kind: 'heading'; level: 3; text: string }
  | { kind: 'table'; caption: string; columns: string[]; rows: string[][] }
  | { kind: 'details'; summary: string; blocks: LessonBodyBlock[] }
  | { kind: 'exerciseSlot'; exerciseId: string }

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
  overview?: LessonBodyBlock[]
  references?: { title: string; url: string; details: string }[]
  credit?: string
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

export type ExerciseQuestionDisplay = {
  prompt: string
  response:
    | { type: 'numeric'; fields: Array<{ id: string; label: string; unit: string; roundingDigits: number; roundingInstruction?: string }> }
    | { type: 'choice'; choices: Array<{ id: string; text: string }> }
  table?: { rows: Array<{ label: string; values: number[] }> }
  calculations?: string[]
  reviewSectionRefs: LessonRef[]
}

export type ExerciseQuestion = {
  display: ExerciseQuestionDisplay
  evaluation:
    | { type: 'numeric'; answers: Array<{ fieldId: string; expected: string; roundingDigits: number }> }
    | { type: 'choice'; correctChoiceId: string }
  solution: {
    explanation: string
    steps?: string[]
    choiceFeedback?: Array<{ choiceId: string; misconception: string; reviewSectionRefs?: LessonRef[] }>
  }
}

export type ExerciseCategoryDefinition = {
  lessonId: string
  categoryId: string
  title: string
  exerciseIds: string[]
}

export type ExerciseGeneratorType = {
  typeId: string
  mode: 'index' | 'seed'
  minimum: number
  maximum: number
}

export type ExerciseGeneratorDefinition = {
  generatorId: string
  types: ExerciseGeneratorType[]
}

export type ExerciseDefinition = {
  lessonId: string
  exerciseId: string
  revision: number
  placement:
    | { kind: 'section'; sectionId: string }
    | { kind: 'category'; categoryId: string }
  generation:
    | { kind: 'fixed'; question: ExerciseQuestion }
    | { kind: 'index' | 'seed'; generatorId: string; typeId: string; minimum: number; maximum: number }
}

export type ExerciseCatalog = {
  categories: ExerciseCategoryDefinition[]
  generators: ExerciseGeneratorDefinition[]
  definitions: ExerciseDefinition[]
}

export type ExerciseInstance = {
  definitionId: string
  instanceId: string
  lessonId: string
  exerciseId: string
  revision: number
  mode: 'fixed' | 'index' | 'seed'
  input: number | null
}

export type ExerciseGradingData = {
  evaluation: ExerciseQuestion['evaluation']
  solution: ExerciseQuestion['solution']
}

/**
 * For unchanged generator/type resources, a given definition ID and revision plus the same mode/input
 * must return identical display, evaluation, and solution data. Fixed definitions follow the same
 * revision rule; runtime validation checks each result's structure without rerunning the generator.
 */
export type ExerciseGenerator = (definition: ExerciseDefinition, input: number) => ExerciseQuestion

export type LessonRegistry = {
  curriculumRevision: number
  officialSourceItemIds: string[]
  sources: SourceDefinition[]
  lessons: LessonDefinition[]
  exerciseCatalog?: ExerciseCatalog
}

export function parseLessonRef(value: unknown): ParsedLessonRef | null
export declare function validateLessonRegistry(value: unknown): value is LessonRegistry
export function getExerciseCatalogErrors(catalog: unknown, lessons: unknown): string[]
export function exerciseDefinitionId(lessonId: string, exerciseId: string): string
export function generateExerciseInstance(
  registry: LessonRegistry,
  lessonId: string,
  exerciseId: string,
  input?: number,
  generators?: Readonly<Record<string, ExerciseGenerator>>,
): ExerciseInstance
export function getExerciseQuestionDisplay(instance: ExerciseInstance): ExerciseQuestionDisplay
export function getExerciseGradingData(instance: ExerciseInstance): ExerciseGradingData
