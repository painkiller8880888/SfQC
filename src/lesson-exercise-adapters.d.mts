import type { ExerciseGenerator, ExerciseInstance, LessonRegistry } from './lesson-contract.mjs'

export const lessonExerciseGenerators: Readonly<Record<string, ExerciseGenerator>>
export function generateLessonExercise(
  lessonId: string,
  exerciseId: string,
  input?: number,
  registry?: LessonRegistry,
  generators?: Readonly<Record<string, ExerciseGenerator>>,
): ExerciseInstance
