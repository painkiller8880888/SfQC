export type DecimalString = string
export type Difficulty = '基礎' | '標準' | '応用'
export type ParameterValue = number | DecimalString
export type QuestionParameters = Record<string, ParameterValue>

export type QuestionSource = {
  title: string
  url: string
  version: string
  checkedAt: string
  location: string
  purpose: string
}

export type QuestionMetadata = {
  questionId: string
  revision: number
  lessonRefs: string[]
  difficulty: Difficulty
  sources: QuestionSource[]
}

export type SingleChoiceFeedbackRule = {
  choiceId: string
  explanation: string
  lessonRef: string
}

export type NumericFeedbackRule = {
  answer: DecimalString
  explanation: string
  lessonRef: string
}

export type SingleChoiceQuestionContent = {
  format: 'single-choice'
  prompt: string
  conditions: string
  parameters: QuestionParameters
  choices: { id: string; label: string }[]
  correctAnswer: string
  grading: { type: 'single-choice' }
  solution: string
  feedbackRules: SingleChoiceFeedbackRule[]
  defaultFeedback: string
}

export type NumericQuestionContent = {
  format: 'numeric'
  prompt: string
  conditions: string
  parameters: QuestionParameters
  correctAnswer: DecimalString
  grading: {
    type: 'numeric'
    unit: string
    roundingDigits: number
    absoluteTolerance?: DecimalString
    relativeTolerance?: DecimalString
  }
  solution: string
  feedbackRules: NumericFeedbackRule[]
  defaultFeedback: string
}

export type QuestionContent = SingleChoiceQuestionContent | NumericQuestionContent

export type SingleChoiceContentTemplate = {
  format: 'single-choice'
  promptTemplate: string
  conditionsTemplate: string
  choicesTemplate: { id: string; labelTemplate: string }[]
  correctAnswerTemplate: string
  solutionTemplate: string
  feedbackRulesTemplate: { choiceId: string; explanationTemplate: string; lessonRef: string }[]
  defaultFeedbackTemplate: string
}

export type NumericContentTemplate = {
  format: 'numeric'
  promptTemplate: string
  conditionsTemplate: string
  correctAnswerTemplate: string
  unit: string
  roundingDigits: number
  absoluteTolerance?: DecimalString
  relativeTolerance?: DecimalString
  solutionTemplate: string
  feedbackRulesTemplate: { answerTemplate: string; explanationTemplate: string; lessonRef: string }[]
  defaultFeedbackTemplate: string
}

export type QuestionContentTemplate = SingleChoiceContentTemplate | NumericContentTemplate

export type GeneratedParameterRange = { type: 'integer'; min: number; max: number }

export type FixedQuestionDefinition = QuestionMetadata & {
  kind: 'fixed'
  content: QuestionContent
}

export type GeneratedQuestionDefinition = QuestionMetadata & {
  kind: 'generated'
  generator: {
    generationRuleVersion: number
    parameters: Record<string, GeneratedParameterRange>
  }
  contentTemplate: QuestionContentTemplate
}

export type QuestionDefinition = FixedQuestionDefinition | GeneratedQuestionDefinition

export type FixedQuestionDefinitionSnapshot = QuestionMetadata & {
  kind: 'fixed'
  content: QuestionContent
}

export type GeneratedQuestionDefinitionSnapshot = QuestionMetadata & {
  kind: 'generated'
  generationRuleVersion: number
  content: QuestionContent
}

export type QuestionDefinitionSnapshot = FixedQuestionDefinitionSnapshot | GeneratedQuestionDefinitionSnapshot

export type FixedQuestionInstance = {
  kind: 'fixed'
  instanceId: string
  questionId: string
  questionDefinitionRevision: number
  questionDefinitionSnapshot: FixedQuestionDefinitionSnapshot
}

export type GeneratedQuestionInstance = {
  kind: 'generated'
  instanceId: string
  questionId: string
  questionDefinitionRevision: number
  generationRuleVersion: number
  seed: string
  questionDefinitionSnapshot: GeneratedQuestionDefinitionSnapshot
}

export type QuestionInstance = FixedQuestionInstance | GeneratedQuestionInstance

type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T

export type ReadonlyQuestionInstance = DeepReadonly<QuestionInstance>

export declare function validateQuestionContent(value: unknown): value is QuestionContent
export declare function validateQuestionDefinition(value: unknown): value is QuestionDefinition
export declare function validateQuestionInstance(value: unknown): value is QuestionInstance
export declare function restoreQuestionInstance(value: unknown): ReadonlyQuestionInstance

export declare function createQuestionInstance(
  definition: FixedQuestionDefinition,
  options: { instanceId: string },
): DeepReadonly<FixedQuestionInstance>
export declare function createQuestionInstance(
  definition: GeneratedQuestionDefinition,
  options: { instanceId: string; content: QuestionContent; seed: string },
): DeepReadonly<GeneratedQuestionInstance>
