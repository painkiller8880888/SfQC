import type { LocalData } from './local-data.mjs'
import type { LessonRef } from './lesson-contract.mjs'

export type ProgressState = '演習記録なし' | '未回答の出題あり' | '回答記録あり'

export type ProgressSourceVisit = {
  attemptId: string
  visitCount: number
  lastVisitedAt: string
}

export type ProgressReviewVisit = {
  reference: LessonRef
  visitCount: number
  lastVisitedAt: string
  sourceVisits: ProgressSourceVisit[]
}

export type ProgressReviewCandidate = {
  reference: LessonRef
  attemptIds: string[]
  attemptCount: number
  latestAttemptAt: string
  attemptId: string
  instanceId: string
  sourceLessonIds: string[]
  crossUnitAttemptCount: number
  visitCount: number
  lastVisitedAt: string | null
  representativeVisitCount: number
  representativeLastVisitedAt: string | null
}

export type LessonProgress = {
  lessonId: string
  questionInstanceCount: number
  answeredInstanceCount: number
  unansweredInstanceCount: number
  attemptCount: number
  correctCount: number
  incorrectCount: number
  correctRate: number | null
  lastAttemptAt: string | null
  daysSinceLastAttempt: number | null
  hasFutureAttempt: boolean
  state: ProgressState
  reviewCandidates: ProgressReviewCandidate[]
  reviewVisits: ProgressReviewVisit[]
}

export type UnavailableProgressReference = {
  reference: LessonRef
  status: 'unregistered' | 'planned' | 'missing-section' | 'invalid-reference'
}

export type ProgressData = {
  lessons: LessonProgress[]
  unavailableReferences: UnavailableProgressReference[]
}

export function deriveProgress(
  data: LocalData,
  registry: import('./lesson-contract.mjs').LessonRegistry,
  now: number,
): ProgressData
