import type { ExerciseGenerator, ExerciseInstance } from './lesson-contract.mjs'

export const lessonExerciseGenerators: Readonly<Record<string, ExerciseGenerator>>
export function generateLessonExercise(lessonId: string, exerciseId: string, input?: number): ExerciseInstance
