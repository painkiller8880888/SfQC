import { useState } from 'react'

type PreviewSection = { sectionId: string; title: string }

export function DescriptiveStatisticsPreview({ sections, currentLessonHref }: {
  sections: readonly PreviewSection[]
  currentLessonHref: string
}) {
  const [selectedSectionId, setSelectedSectionId] = useState(sections[0]?.sectionId ?? '')
  const selectedSection = sections.find((section) => section.sectionId === selectedSectionId)

  return <section className="lesson-panel descriptive-statistics-preview" aria-label="基本統計量の比較用モック">
    <p>これは一時的な比較用モックです。ここでの操作状態は保存されません。</p>
    <div className="map-mode-toggle descriptive-statistics-preview-controls" role="group" aria-label="節を選ぶ">
      {sections.map((section) => <button
        key={section.sectionId}
        className="map-mode-button"
        type="button"
        aria-pressed={section.sectionId === selectedSectionId}
        onClick={() => setSelectedSectionId(section.sectionId)}
      >{section.title}</button>)}
    </div>
    {selectedSection && <div className="lesson-observation" aria-live="polite">
      <h2>{selectedSection.title}</h2>
      <p>この節の比較用コンテンツは後続Issueで作成します。</p>
    </div>}
    <p><a href={currentLessonHref}>現行版を表示</a></p>
  </section>
}
