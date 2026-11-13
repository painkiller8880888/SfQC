// @ts-check
import { lessonRegistry } from '../src/lesson-registry.mjs'
import { gradeDecimalAnswer } from '../src/question-grading.mjs'
import {
  exportLearningBackup, importLearningBackup, parseLearningBackup, recheckLearningBackupImport,
  serializeLearningBackup,
} from '../src/backup.mjs'
import { readLearningState, saveLearningState } from '../src/learning-state.mjs'
import { appendPracticeResult, readPracticeResults, recheckPracticeResult } from '../src/practice-results.mjs'

/** @param {import('../src/backup.mjs').LearningBackupStorage} storage @param {{size:number;text():Promise<string>}} file */
export async function checkLearningStorageTypes(storage, file) {
  const learning = readLearningState(lessonRegistry, () => storage)
  const practice = readPracticeResults(() => storage)
  const state = learning.status === 'missing' || learning.status === 'ok'
    ? learning.state : { schemaVersion: 1, lessons: {}, positions: {} }
  const expectedLearningRaw = learning.status === 'missing' || learning.status === 'ok' ? learning.raw : null
  const expectedPracticeRaw = practice.status === 'missing' || practice.status === 'ok' ? practice.raw : null
  const saved = saveLearningState(state, expectedLearningRaw, lessonRegistry, () => storage)
  const appended = appendPracticeResult({ categoryId: 'mean-deviation', isCorrect: true }, expectedPracticeRaw, () => storage)
  const checked = recheckPracticeResult(appended, () => storage)
  const json = serializeLearningBackup(state, { schemaVersion: 1, records: [] }, lessonRegistry)
  const backup = parseLearningBackup(json, lessonRegistry)
  const exported = exportLearningBackup(() => storage, lessonRegistry)
  const restored = await importLearningBackup(file, () => true, { getStorage: () => storage, registry: lessonRegistry })
  const backupRecheck = restored.pending
    ? recheckLearningBackupImport(restored.pending, lessonRegistry, () => storage).status : restored.status
  const grade = gradeDecimalAnswer('1.234', '1.23', 2)
  return [saved.status, checked.status, backup.learningState.schemaVersion, exported.length,
    backupRecheck, grade.status].join(':')
}
