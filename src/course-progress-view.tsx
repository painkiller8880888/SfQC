import { useState } from 'react'
import type { CourseProgress } from './course-progress.mjs'
import { sortCourseProgressByAccuracy } from './course-progress.mjs'
import { lessonRegistry } from './lesson-registry.mjs'
import { routeToHash } from './resolve-screen.mjs'

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('ja-JP') : '記録なし'
}

export function CourseProgressView({ progress }: { progress: CourseProgress }) {
  const [sortOrder, setSortOrder] = useState<'map' | 'low'>('map')
  const lessonById = new Map(lessonRegistry.lessons.map((lesson) => [lesson.lessonId, lesson]))
  const lessons = sortOrder === 'map' ? progress.lessons : sortCourseProgressByAccuracy(progress.lessons)
  const categories = sortOrder === 'map' ? progress.categories : sortCourseProgressByAccuracy(progress.categories)
  const orderLabel = sortOrder === 'map' ? '学習マップ順' : '正答率の低い順'
  return <section className="progress-view" aria-labelledby="course-progress-title">
    <div className="progress-guidance">
      <h2 id="course-progress-title">進捗の見方</h2>
      <p>手動完了と演習結果は別々に記録します。正答率は保存された判定の正解数 ÷ 試行数で、未回答の問題や未保存の判定は含みません。</p>
    </div>
    <section aria-labelledby="course-progress-lessons-title">
      <h2 id="course-progress-lessons-title">単元ごとの進捗</h2>
      <div className="progress-sort-controls" role="group" aria-label="進捗の並び順">
        <button type="button" aria-pressed={sortOrder === 'map'} onClick={() => setSortOrder('map')}>学習マップ順</button>
        <button type="button" aria-pressed={sortOrder === 'low'} onClick={() => setSortOrder('low')}>正答率の低い順</button>
      </div>
      <div className="progress-card-list">{lessons.map((item) => {
        const lesson = lessonById.get(item.lessonId)
        if (!lesson) return null
        const courseLesson = lesson.availability === 'included' && lesson.lessonId === 'descriptive-statistics'
        const firstSectionId = lesson.availability === 'included' ? lesson.sections[0]?.sectionId : undefined
        return <article className="progress-card" key={lesson.lessonId}>
          <h3>{courseLesson
            ? <a href={routeToHash({ kind: 'course-lesson', courseId: lesson.lessonId, sectionId: firstSectionId ?? 'mean' })}>{lesson.title}</a>
            : lesson.title}</h3>
          <dl>
            <div><dt>手動進捗</dt><dd>{item.completedAt ? `完了（${formatDate(item.completedAt)}）` : '未完了'}</dd></div>
            <div><dt>演習</dt><dd>{item.hasPractice
              ? item.correctRate === null ? '記録なし（0回）' : `${item.correctCount}/${item.attemptCount}回 · 正答率 ${Math.round(item.correctRate * 100)}%`
              : '現在の演習なし'}</dd></div>
          </dl>
          {courseLesson && <section className="progress-subsection" aria-label="基本統計量の5分野別演習結果">
            <h4>5分野別の演習結果（{orderLabel}）</h4>
            <ul>{categories.map((category) => <li key={category.categoryId}>
              {category.title}：{category.correctRate === null
                ? '記録なし（0回）'
                : category.correctCount + '/' + category.attemptCount + '回 · 正答率 ' + Math.round(category.correctRate * 100) + '%'}
            </li>)}</ul>
          </section>}
          {courseLesson && <p><a href={routeToHash({ kind: 'course-practice', courseId: lesson.lessonId })}>演習へ</a></p>}
        </article>
      })}</div>
    </section>
  </section>
}
