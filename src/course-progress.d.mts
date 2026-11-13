import type { LearningState } from './learning-state.mjs'
import type { LessonRegistry } from './lesson-contract.mjs'
import type { PracticeResults } from './practice-results.mjs'

export type CourseLessonProgress = {
  lessonId: string
  completedAt: string | null
  attemptCount: number
  correctCount: number
  incorrectCount: number
  correctRate: number | null
  hasPractice: boolean
}
export type CourseCategoryProgress = {
  categoryId: import('./practice-results.mjs').PracticeRecord['categoryId']
  title: string
  attemptCount: number
  correctCount: number
  incorrectCount: number
  correctRate: number | null
}
export type CourseProgress = { lessons: CourseLessonProgress[]; categories: CourseCategoryProgress[] }
export function deriveCourseProgress(
  learningState: LearningState | null,
  practiceResults: PracticeResults | null,
  registry?: LessonRegistry,
): CourseProgress
