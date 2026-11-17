/** @param {{ availability: string }} lesson @param {{ completedAt: string | null } | undefined} progress @param {boolean} confirmed */
export function getManualProgressLabel(lesson, progress, confirmed) {
  if (lesson.availability !== 'included') return null
  if (!confirmed) return '未確認'
  return progress?.completedAt ? '完了' : '未完了'
}
