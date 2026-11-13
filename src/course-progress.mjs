import { lessonRegistry } from './lesson-registry.mjs'
import { PRACTICE_CATEGORY_IDS } from './practice-results.mjs'
import { descriptiveStatisticsExerciseCategories } from './descriptive-statistics-exercise-preview-data.mjs'

export function deriveCourseProgress(learningState, practiceResults, registry = lessonRegistry) {
  const records = practiceResults?.records ?? []
  const order = new Map(registry.lessons.map((lesson, index) => [lesson.lessonId, index]))
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
      hasPractice: lesson.lessonId === 'descriptive-statistics',
    }
  })
  progress.sort((left, right) => {
    if (left.correctRate === null && right.correctRate !== null) return 1
    if (left.correctRate !== null && right.correctRate === null) return -1
    if (left.correctRate !== null && right.correctRate !== null) {
      const rateOrder = left.correctCount * right.attemptCount - right.correctCount * left.attemptCount
      if (rateOrder !== 0) return rateOrder
    }
    return order.get(left.lessonId) - order.get(right.lessonId)
  })
  const categories = PRACTICE_CATEGORY_IDS.map((categoryId, index) => {
    const categoryRecords = records.filter((record) => record.categoryId === categoryId)
    const correctCount = categoryRecords.filter((record) => record.isCorrect).length
    const attemptCount = categoryRecords.length
    return {
      categoryId,
      title: descriptiveStatisticsExerciseCategories[index].title,
      attemptCount,
      correctCount,
      incorrectCount: attemptCount - correctCount,
      correctRate: attemptCount === 0 ? null : correctCount / attemptCount,
    }
  }).sort((left, right) => {
    if (left.correctRate === null && right.correctRate !== null) return 1
    if (left.correctRate !== null && right.correctRate === null) return -1
    if (left.correctRate !== null && right.correctRate !== null) {
      const rateOrder = left.correctCount * right.attemptCount - right.correctCount * left.attemptCount
      if (rateOrder !== 0) return rateOrder
    }
    return PRACTICE_CATEGORY_IDS.indexOf(left.categoryId) - PRACTICE_CATEGORY_IDS.indexOf(right.categoryId)
  })
  return { lessons: progress, categories }
}
