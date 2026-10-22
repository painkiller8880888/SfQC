const screensByHash = new Map([
  ['#/map', 'map'],
  ['#/lesson', 'lesson'],
  ['#/practice', 'practice'],
  ['#/feedback', 'feedback'],
  ['#/progress', 'progress'],
  ['#/data', 'data'],
])

export function resolveScreen(hash) {
  if (hash === '' || hash === '#/') return 'map'
  return screensByHash.get(hash) ?? 'not-found'
}
