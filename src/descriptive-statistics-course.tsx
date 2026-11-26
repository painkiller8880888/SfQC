import { useState, type ReactNode, type RefObject } from 'react'
import type { ExerciseInstance, IncludedLessonDefinition, LessonRegistry } from './lesson-contract.mjs'
import { lessonRegistry } from './lesson-registry.mjs'
import { routeToHash } from './resolve-screen.mjs'
import { nextPreviewExerciseIndex, previewExerciseDefinitions } from './descriptive-statistics-preview-exercises.mjs'
import { generateLessonExercise } from './lesson-exercise-adapters.mjs'
import { ExerciseQuestionCard, LessonCourse } from './lesson-view'

function InlineExercise({ exerciseId, registry }: {
  exerciseId: string
  registry: LessonRegistry
}) {
  type QuestionState = { index: number; instance: ExerciseInstance | null; error: string | null }
  const definition = registry.exerciseCatalog?.definitions.find((item) => item.lessonId === 'descriptive-statistics' && item.exerciseId === exerciseId)
  const generation = definition?.generation
  const initialIndex = previewExerciseDefinitions[exerciseId as keyof typeof previewExerciseDefinitions]?.initialIndex
    ?? (generation?.kind === 'fixed' ? 0 : generation?.minimum ?? 0)
  const [question, setQuestion] = useState<QuestionState>(() => {
    try {
      return { index: initialIndex, instance: generateLessonExercise('descriptive-statistics', exerciseId, initialIndex, registry), error: null }
    } catch {
      return { index: initialIndex, instance: null, error: 'この問題を表示できません。' }
    }
  })
  const canRegenerate = generation?.kind === 'index' && generation.maximum > generation.minimum
  const regenerate = () => {
    try {
      const index = nextPreviewExerciseIndex(exerciseId as keyof typeof previewExerciseDefinitions, question.index)
      const instance = generateLessonExercise('descriptive-statistics', exerciseId, index, registry)
      setQuestion({ index, instance, error: null })
    } catch {
      setQuestion((current) => ({ ...current, error: current.instance
        ? '別の問題を表示できませんでした。表示中の問題を保っています。' : 'この問題を表示できません。' }))
    }
  }

  return <ExerciseQuestionCard instance={question.instance} exerciseId={exerciseId} title="確認問題" headingLevel={4}
    registry={registry} error={question.error} className="course-inline-exercise"
    onRegenerate={canRegenerate ? regenerate : undefined} regenerateLabel="別の問題" />
}

export function DescriptiveStatisticsCourse({ lesson, activeSectionId, sectionHeadingRef, sectionReturn, exerciseResetKeys, registry = lessonRegistry }: {
  lesson: IncludedLessonDefinition
  activeSectionId: string
  sectionHeadingRef: RefObject<HTMLHeadingElement | null>
  sectionReturn?: ReactNode
  exerciseResetKeys?: Readonly<Record<string, number>>
  registry?: LessonRegistry
}) {
  return <LessonCourse lesson={lesson} activeSectionId={activeSectionId} sectionHeadingRef={sectionHeadingRef} registry={registry}
    sectionReturn={sectionReturn}
    exerciseResetKeys={exerciseResetKeys}
    renderExercise={(exerciseId, key) => <InlineExercise key={key} exerciseId={exerciseId} registry={registry} />}>
    <p className="lesson-actions"><a href={routeToHash({ kind: 'course-practice', courseId: lesson.lessonId })}>5分野の演習へ</a></p>
  </LessonCourse>
}
