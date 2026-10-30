/**
 * @typedef {import('./manual-progress.mjs').ManualProgressState} ManualProgressState
 * @typedef {import('./manual-progress.mjs').ManualLessonProgress} ManualLessonProgress
 * @typedef {import('./manual-progress.mjs').ManualProgressAction} ManualProgressAction
 */

/** @param {import('./lesson-contract.mjs').LessonRegistry} registry @returns {ManualProgressState} */
export function createInitialManualProgress(registry) {
  /** @type {ManualProgressState} */
  const progress = {}
  for (const lesson of registry.lessons) {
    progress[lesson.lessonId] = {
      status: 'not-started',
      checks: lesson.learningObjectives.map(() => false),
      completedAt: null,
    }
  }
  return progress
}

/** @param {ManualProgressState} current @param {string} lessonId @param {ManualProgressAction} action @returns {ManualProgressState} */
export function updateManualProgress(current, lessonId, action) {
  const lesson = current[lessonId]
  if (!lesson) return current

  /** @type {ManualLessonProgress} */
  let next
  switch (action.type) {
    case 'start':
      if (lesson.status !== 'not-started') return current
      next = { ...lesson, status: 'started' }
      break
    case 'check':
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= lesson.checks.length
        || typeof action.checked !== 'boolean' || lesson.checks[action.index] === action.checked) return current
      next = {
        ...lesson,
        status: lesson.status === 'not-started' && action.checked ? 'started' : lesson.status,
        checks: lesson.checks.map((checked, index) => index === action.index ? action.checked : checked),
      }
      break
    case 'complete':
      if (lesson.status === 'completed') return current
      next = { ...lesson, status: 'completed', completedAt: action.completedAt }
      break
    case 'reopen':
      if (lesson.status !== 'completed') return current
      next = { ...lesson, status: 'started', completedAt: null }
      break
    default:
      return current
  }

  return { ...current, [lessonId]: next }
}

/** @param {ManualProgressState} progress @param {import('./lesson-contract.mjs').LessonRegistry} registry */
export function countCompletedManualProgress(progress, registry) {
  return registry.lessons.reduce((count, lesson) =>
    count + (progress[lesson.lessonId]?.status === 'completed' ? 1 : 0), 0)
}
