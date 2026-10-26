import { lessonRegistry } from './lesson-registry.mjs'

function storageError(readResult) {
  if (readResult.status === 'invalid' || readResult.status === 'unreadable'
    || readResult.status === 'migration-failed') return readResult.error
  return null
}

export function resolveRouteData(route, readResult) {
  if (route.kind === 'lesson-id') {
    const lesson = lessonRegistry.lessons.find((item) => item.lessonId === route.lessonId)
    if (!lesson) return { status: 'unknown-id', target: 'lesson' }
    if (lesson.availability !== 'included') return { status: 'unavailable-lesson', lesson }
    if (route.sectionId !== null) {
      const section = lesson.sections.find((item) => item.sectionId === route.sectionId)
      if (!section) return { status: 'unknown-id', target: 'section' }
      return { status: 'lesson', lesson, section }
    }
    return { status: 'lesson', lesson, section: null }
  }

  if (route.kind === 'practice-id' || route.kind === 'feedback-id') {
    const error = storageError(readResult)
    if (error) return { status: 'data-error', error }
    const data = readResult.data
    if (route.kind === 'practice-id') {
      const instance = data.questionInstances.find((item) => item.instanceId === route.instanceId)
      return instance ? { status: 'practice', data, instance } : { status: 'unknown-id', target: 'instance' }
    }
    const attempt = data.answerAttempts.find((item) => item.attemptId === route.attemptId)
    if (!attempt) return { status: 'unknown-id', target: 'attempt' }
    const instance = data.questionInstances.find((item) => item.instanceId === attempt.instanceId)
    return instance ? { status: 'feedback', data, attempt, instance }
      : { status: 'data-error', error: new Error('保存済み解答の出題snapshotを読み込めません。') }
  }

  return { status: 'screen' }
}

export function validateRouteHistoryReferences(state, readResult) {
  return [state, ...state.returnStack].every((frame) => {
    if (frame.resumeAttemptId === null) return true
    if (frame.route.kind !== 'practice-id'
      || readResult.status === 'invalid' || readResult.status === 'unreadable') return false
    const attempt = readResult.data.answerAttempts.find((item) => item.attemptId === frame.resumeAttemptId)
    return attempt?.instanceId === frame.route.instanceId
  })
}
