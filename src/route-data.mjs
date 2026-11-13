import { lessonRegistry } from './lesson-registry.mjs'

export function resolveRouteData(route) {
  if (route.kind === 'course-lesson' || route.kind === 'course-practice') {
    const lesson = lessonRegistry.lessons.find((item) => item.lessonId === route.courseId)
    if (!lesson) return { status: 'unknown-id', target: 'lesson' }
    if (lesson.availability !== 'included') return { status: 'unavailable-lesson', lesson }
    if (route.kind === 'course-practice') return { status: 'course-practice', lesson }
    const section = lesson.sections.find((item) => item.sectionId === route.sectionId)
    return section ? { status: 'lesson', lesson, section } : { status: 'unknown-id', target: 'section' }
  }
  if (route.kind === 'lesson-id') {
    if (route.lessonId === 'descriptive-statistics') return { status: 'unknown-id', target: 'lesson' }
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
  return { status: 'screen' }
}
