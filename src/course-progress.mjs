import { lessonRegistry } from './lesson-registry.mjs'
import { PRACTICE_CATEGORY_IDS } from './practice-results.mjs'
import { descriptiveStatisticsExerciseCategories } from './descriptive-statistics-exercise-preview-data.mjs'

export function compareCourseProgressAccuracy(left, right) {
  if (left.correctRate === null && right.correctRate !== null) return 1
  if (left.correctRate !== null && right.correctRate === null) return -1
  if (left.correctRate === null || right.correctRate === null) return 0
  return left.correctCount * right.attemptCount - right.correctCount * left.attemptCount
}

export function sortCourseProgressByAccuracy(items) {
  return items.map((item, index) => ({ item, index }))
    .sort((left, right) => compareCourseProgressAccuracy(left.item, right.item) || left.index - right.index)
    .map(({ item }) => item)
}

export function hasCoursePractice(lessonId) {
  return lessonId === 'descriptive-statistics'
}

export function deriveCourseProgress(learningState, practiceResults, registry = lessonRegistry) {
  const records = practiceResults?.records ?? []
  const progress = registry.lessons.map((lesson) => {
    const lessonRecords = lesson.lessonId === 'descriptive-statistics' ? records : []
    const correctCount = lessonRecords.filter((record) => record.isCorrect).length
    const attemptCount = lessonRecords.length
    return {
      lessonId: lesson.lessonId,
      completedAt: learningState?.lessons[lesson.lessonId]?.completedAt ?? null,
      attemptCount,
      correctCount,
      incorrectCount: attemptCount - correctCount,
      correctRate: attemptCount === 0 ? null : correctCount / attemptCount,
      hasPractice: hasCoursePractice(lesson.lessonId),
    }
  })
  const categories = PRACTICE_CATEGORY_IDS.map((categoryId) => {
    const categoryRecords = records.filter((record) => record.categoryId === categoryId)
    const correctCount = categoryRecords.filter((record) => record.isCorrect).length
    const attemptCount = categoryRecords.length
    const definition = registry.exerciseCatalog?.categories.find((category) =>
      category.lessonId === 'descriptive-statistics' && category.categoryId === categoryId)
    const fallback = descriptiveStatisticsExerciseCategories.find((category) => category.id === categoryId)
    return {
      categoryId,
      title: definition?.title ?? fallback?.title ?? categoryId,
      attemptCount,
      correctCount,
      incorrectCount: attemptCount - correctCount,
      correctRate: attemptCount === 0 ? null : correctCount / attemptCount,
    }
  })
  return { lessons: progress, categories }
}
