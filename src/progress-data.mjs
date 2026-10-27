import { parseLessonRef } from './lesson-contract.mjs'

const dayMs = 24 * 60 * 60 * 1000

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function newLessonProgress(lessonId) {
  return {
    lessonId,
    questionInstanceIds: new Set(),
    answeredInstanceIds: new Set(),
    attemptCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    lastAttemptAt: null,
    candidates: new Map(),
    visits: new Map(),
  }
}

function updateLatest(summary, field, value) {
  if (summary[field] === null || Date.parse(value) > Date.parse(summary[field])) summary[field] = value
}

function classifyReference(reference, registry) {
  const parsed = parseLessonRef(reference)
  if (!parsed) return 'invalid-reference'
  const lesson = registry.lessons.find((item) => item.lessonId === parsed.lessonId)
  if (!lesson) return 'unregistered'
  if (lesson.availability === 'planned') return 'planned'
  if (parsed.sectionId && !lesson.sections.some((section) => section.sectionId === parsed.sectionId)) return 'missing-section'
  return null
}

/** @param {import('./local-data.mjs').LocalData} data @param {import('./lesson-contract.mjs').LessonRegistry} registry @param {number} now */
export function deriveProgress(data, registry, now) {
  const lessons = new Map(registry.lessons.map((lesson) => [lesson.lessonId, newLessonProgress(lesson.lessonId)]))
  const instancesById = new Map()
  const instanceLessonIds = new Map()
  const references = new Set()
  const ensureLesson = (lessonId) => {
    if (!lessons.has(lessonId)) lessons.set(lessonId, newLessonProgress(lessonId))
    return lessons.get(lessonId)
  }
  const rememberReference = (reference) => {
    references.add(reference)
    const parsed = parseLessonRef(reference)
    return parsed ? ensureLesson(parsed.lessonId) : null
  }

  for (const instance of data.questionInstances) {
    instancesById.set(instance.instanceId, instance)
    const lessonIds = new Set()
    for (const reference of instance.questionDefinitionSnapshot.lessonRefs) {
      const lesson = rememberReference(reference)
      const parsed = parseLessonRef(reference)
      if (!lesson || !parsed) continue
      lesson.questionInstanceIds.add(instance.instanceId)
      lessonIds.add(parsed.lessonId)
    }
    instanceLessonIds.set(instance.instanceId, [...lessonIds])
  }

  for (const attempt of data.answerAttempts) {
    const instance = instancesById.get(attempt.instanceId)
    const lessonIds = instanceLessonIds.get(attempt.instanceId) ?? []
    for (const lessonId of lessonIds) {
      const lesson = ensureLesson(lessonId)
      lesson.answeredInstanceIds.add(instance.instanceId)
      lesson.attemptCount += 1
      if (attempt.gradingResult.isCorrect) lesson.correctCount += 1
      else lesson.incorrectCount += 1
      updateLatest(lesson, 'lastAttemptAt', attempt.attemptedAt)
    }

    const feedback = attempt.gradingResult.feedback
    if (attempt.gradingResult.isCorrect || !feedback) continue
    const lesson = rememberReference(feedback.lessonRef)
    if (!lesson) continue
    let candidate = lesson.candidates.get(feedback.lessonRef)
    if (!candidate) {
      candidate = { reference: feedback.lessonRef, attempts: [], sourceLessonIds: new Set(), crossUnitAttemptCount: 0 }
      lesson.candidates.set(feedback.lessonRef, candidate)
    }
    candidate.attempts.push(attempt)
    for (const lessonId of lessonIds) candidate.sourceLessonIds.add(lessonId)
    if (!lessonIds.includes(parseLessonRef(feedback.lessonRef).lessonId)) candidate.crossUnitAttemptCount += 1
  }

  for (const event of data.reviewEvents) {
    const lesson = rememberReference(event.targetRef)
    if (!lesson) continue
    let visit = lesson.visits.get(event.targetRef)
    if (!visit) {
      visit = { reference: event.targetRef, visitCount: 0, lastVisitedAt: null, sources: new Map() }
      lesson.visits.set(event.targetRef, visit)
    }
    visit.visitCount += 1
    updateLatest(visit, 'lastVisitedAt', event.reviewedAt)
    let source = visit.sources.get(event.sourceAttemptId)
    if (!source) {
      source = { attemptId: event.sourceAttemptId, visitCount: 0, lastVisitedAt: null }
      visit.sources.set(event.sourceAttemptId, source)
    }
    source.visitCount += 1
    updateLatest(source, 'lastVisitedAt', event.reviewedAt)
  }

  const registryOrder = new Map(registry.lessons.map((lesson, index) => [lesson.lessonId, index]))
  const progressLessons = [...lessons.values()].map((lesson) => {
    const candidates = [...lesson.candidates.values()].map((candidate) => {
      const attempts = [...candidate.attempts].sort((left, right) =>
        Date.parse(right.attemptedAt) - Date.parse(left.attemptedAt)
        || compareText(left.attemptId, right.attemptId))
      const representative = attempts[0]
      const visit = lesson.visits.get(candidate.reference)
      const representativeVisit = visit?.sources.get(representative.attemptId)
      return {
        reference: candidate.reference,
        attemptIds: attempts.map((attempt) => attempt.attemptId),
        attemptCount: attempts.length,
        latestAttemptAt: representative.attemptedAt,
        attemptId: representative.attemptId,
        instanceId: representative.instanceId,
        sourceLessonIds: [...candidate.sourceLessonIds].sort(compareText),
        crossUnitAttemptCount: candidate.crossUnitAttemptCount,
        visitCount: visit?.visitCount ?? 0,
        lastVisitedAt: visit?.lastVisitedAt ?? null,
        representativeVisitCount: representativeVisit?.visitCount ?? 0,
        representativeLastVisitedAt: representativeVisit?.lastVisitedAt ?? null,
      }
    }).sort((left, right) => compareText(left.reference, right.reference))

    const visits = [...lesson.visits.values()].map((visit) => ({
      reference: visit.reference,
      visitCount: visit.visitCount,
      lastVisitedAt: visit.lastVisitedAt,
      sourceVisits: [...visit.sources.values()].sort((left, right) => compareText(left.attemptId, right.attemptId)),
    })).sort((left, right) => compareText(left.reference, right.reference))
    const questionInstanceCount = lesson.questionInstanceIds.size
    const answeredInstanceCount = lesson.answeredInstanceIds.size
    const unansweredInstanceCount = questionInstanceCount - answeredInstanceCount
    const attemptTime = lesson.lastAttemptAt === null ? null : Date.parse(lesson.lastAttemptAt)

    return {
      lessonId: lesson.lessonId,
      questionInstanceCount,
      answeredInstanceCount,
      unansweredInstanceCount,
      attemptCount: lesson.attemptCount,
      correctCount: lesson.correctCount,
      incorrectCount: lesson.incorrectCount,
      correctRate: lesson.attemptCount === 0 ? null : lesson.correctCount / lesson.attemptCount,
      lastAttemptAt: lesson.lastAttemptAt,
      daysSinceLastAttempt: attemptTime === null ? null : Math.max(0, Math.floor((now - attemptTime) / dayMs)),
      hasFutureAttempt: attemptTime !== null && attemptTime > now,
      state: questionInstanceCount === 0 && lesson.attemptCount === 0
        ? '演習記録なし'
        : unansweredInstanceCount > 0 ? '未回答の出題あり' : '回答記録あり',
      reviewCandidates: candidates,
      reviewVisits: visits,
    }
  }).sort((left, right) => {
    const leftOrder = registryOrder.get(left.lessonId)
    const rightOrder = registryOrder.get(right.lessonId)
    if (leftOrder !== undefined || rightOrder !== undefined) {
      if (leftOrder === undefined) return 1
      if (rightOrder === undefined) return -1
      return leftOrder - rightOrder
    }
    return compareText(left.lessonId, right.lessonId)
  })

  const unavailableReferences = [...references].map((reference) => ({
    reference,
    status: classifyReference(reference, registry),
  })).filter((item) => item.status !== null).sort((left, right) => compareText(left.reference, right.reference))

  return { lessons: progressLessons, unavailableReferences }
}
