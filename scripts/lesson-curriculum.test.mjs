import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import { validateLessonRegistry } from '../src/lesson-contract.mjs'

const prerequisiteMap = readFileSync(new URL('../docs/curriculum/PREREQUISITE_MAP_DRAFT.md', import.meta.url), 'utf8')
const syllabusMap = readFileSync(new URL('../docs/curriculum/SYLLABUS_MAPPING_DRAFT.md', import.meta.url), 'utf8')
const sourceIdPattern = /^SRC-\d{4}$/u

// shortcut: this reads the repository's simple tables only; update it if their Markdown layout changes.
function tableAfter(markdown, heading) {
  const lines = markdown.split(/\r?\n/u)
  let line = lines.findIndex((item) => item.startsWith(heading))
  if (line < 0) throw new Error(`Missing canonical table section: ${heading}`)
  while (line < lines.length && !lines[line].trim().startsWith('|')) line += 1
  const rows = []
  while (line < lines.length && lines[line].trim().startsWith('|')) {
    const cells = lines[line].trim().slice(1, -1).split('|').map((cell) => cell.trim())
    if (!cells.every((cell) => /^:?-{3,}:?$/u.test(cell))) rows.push(cells)
    line += 1
  }
  if (rows.length < 2) throw new Error(`Missing canonical table: ${heading}`)
  return rows.slice(1)
}

function asSet(values) {
  return [...new Set(values)].sort()
}

function splitList(value) {
  return value === '—' || value === 'なし（数学の橋渡し）' ? [] : value.split(';').map((item) => item.trim())
}

function sourceItemsIn(value) {
  return value.match(/SRC-\d{4}/gu) ?? []
}

function documentTable() {
  return new Map(tableAfter(syllabusMap, '## 1. 基準資料と読み方').flatMap((row) => {
    const link = row[1].match(/\[([^\]]+)\]\((https:[^)]+)\)/u)
    return link ? [[row[0], { title: link[1], url: link[2], version: row[2] }]] : []
  }))
}

function expectedEvidence(coveredSourceItemIds) {
  const documents = documentTable()
  const itemRows = tableAfter(syllabusMap, '## 2. 手法編の対応項目')
    .filter((row) => sourceIdPattern.test(row[0]))
    .map((row) => ({ sourceItemId: row[0], text: row[2] }))
  for (const row of tableAfter(syllabusMap, '## 3. 実践編との境界')) {
    for (const sourceItemId of sourceItemsIn(row[2] ?? '')) {
      if (coveredSourceItemIds.has(sourceItemId)) itemRows.push({ sourceItemId, text: row[1] })
    }
  }

  return asSet(itemRows.filter(({ sourceItemId }) => coveredSourceItemIds.has(sourceItemId)).flatMap(({ sourceItemId, text }) => {
    const citationParts = text.split(/;\s*(?=(?:L[234]?|M|P|J)\s)/u)
    return citationParts.map((part) => {
      const match = part.match(/^(L[234]?|M|P|J)\s+(.+)$/u)
      const document = match && documents.get(match[1])
      if (!document) throw new Error(`Unrecognized canonical citation: ${part}`)
      return JSON.stringify([sourceItemId, document.title, document.url, document.version, match[2]])
    })
  }))
}

function expectedOfficialIds() {
  const ids = tableAfter(syllabusMap, '## 2. 手法編の対応項目').flatMap((row) =>
    sourceIdPattern.test(row[0]) ? [row[0]] : [])
  return asSet([...ids, ...tableAfter(syllabusMap, '## 3. 実践編との境界').flatMap((row) => sourceItemsIn(row[2] ?? ''))])
}

function expectedCurriculum() {
  const rows = tableAfter(prerequisiteMap, '## 2. lessonId一覧と必須前提')
  const lessons = rows.map((row) => ({
    lessonId: row[0],
    sourceItemIds: asSet(sourceItemsIn(row[2])),
    commonPrerequisites: asSet(splitList(row[3])),
  }))

  const anchorBlock = prerequisiteMap.split('sourceItemId欄・前提欄・条件付き経路・任意復習に記したsection anchor')[1]?.split('## 3. 条件付きの方法別前提')[0]
  if (!anchorBlock) throw new Error('Missing canonical section anchor list')
  const declaredSections = new Map([...anchorBlock.matchAll(/^- ([a-z][a-z0-9-]*): (.+)$/gmu)]
    .map((match) => [match[1], asSet(match[2].split(',').map((item) => item.trim()))]))

  const lessonIds = new Set(lessons.map((lesson) => lesson.lessonId))
  const referencesIn = (value) => (value.match(/[a-z][a-z0-9-]*(?:#[a-z0-9-]+)?/gu) ?? [])
    .filter((reference) => lessonIds.has(reference.split('#')[0]))
  const conditionalEdges = []
  for (const row of tableAfter(prerequisiteMap, '## 3. 条件付きの方法別前提')) {
    for (const methodRef of referencesIn(row[0])) {
      for (const prerequisiteRef of referencesIn(row[2])) conditionalEdges.push(`${methodRef} -> ${prerequisiteRef}`)
    }
  }
  const optionalReviews = tableAfter(prerequisiteMap, '### 任意復習候補')
    .map((row) => JSON.stringify([row[0], row[1], row[2]]))

  const sourceAssignments = tableAfter(syllabusMap, '## 2. 手法編の対応項目')
    .filter((row) => sourceIdPattern.test(row[0]))
    .flatMap((row) => referencesIn(row[4]).map((reference) => `${row[0]} -> ${reference.split('#')[0]}`))
  for (const row of tableAfter(syllabusMap, '### 実践編と接するsourceItemId')) {
    if (sourceIdPattern.test(row[0])) {
      sourceAssignments.push(...referencesIn(row[3]).map((reference) => `${row[0]} -> ${reference.split('#')[0]}`))
    }
  }

  return {
    lessons,
    declaredSections,
    conditionalEdges: asSet(conditionalEdges),
    optionalReviews: asSet(optionalReviews),
    sourceAssignments: asSet(sourceAssignments),
  }
}

function curriculumMismatches(registry) {
  const errors = []
  const expected = expectedCurriculum()
  const actualLessons = new Map(registry.lessons.map((lesson) => [lesson.lessonId, lesson]))
  const compareSet = (label, actual, wanted) => {
    if (JSON.stringify(asSet(actual)) !== JSON.stringify(asSet(wanted))) errors.push(label)
  }
  compareSet('lessonIds', actualLessons.keys(), expected.lessons.map((lesson) => lesson.lessonId))
  compareSet('officialSourceItemIds', registry.officialSourceItemIds, expectedOfficialIds())
  compareSet('sourceLessonAssignments', expected.lessons.flatMap((lesson) =>
    lesson.sourceItemIds.map((sourceItemId) => `${sourceItemId} -> ${lesson.lessonId}`)), expected.sourceAssignments)

  for (const lesson of expected.lessons) {
    const actual = actualLessons.get(lesson.lessonId)
    if (!actual) continue
    compareSet(`sourceItemIds:${lesson.lessonId}`, actual.sourceItemIds, lesson.sourceItemIds)
    compareSet(`commonPrerequisites:${lesson.lessonId}`, actual.commonPrerequisites, lesson.commonPrerequisites)
    compareSet(`declaredSectionIds:${lesson.lessonId}`, actual.declaredSectionIds,
      expected.declaredSections.get(lesson.lessonId) ?? [])
  }

  const actualConditionalEdges = registry.lessons.flatMap((lesson) => lesson.conditionalPrerequisites
    .map((item) => `${item.methodSectionRef} -> ${item.prerequisiteRef}`))
  compareSet('conditionalPrerequisites', actualConditionalEdges, expected.conditionalEdges)
  const actualReviews = registry.lessons.flatMap((lesson) => lesson.optionalReviews
    .map((item) => JSON.stringify([item.fromRef, item.targetRef, item.context])))
  compareSet('optionalReviews', actualReviews, expected.optionalReviews)

  const actualEvidence = registry.sources.flatMap((source) => source.citations.map((citation) =>
    JSON.stringify([citation.sourceItemId, source.title, source.url, source.version, citation.location])))
  compareSet('sourceEvidence', actualEvidence, expectedEvidence(new Set(registry.lessons.flatMap((lesson) => lesson.sourceItemIds))))
  return errors
}

test('lesson registry matches the canonical curriculum and official citation map', () => {
  assert.deepEqual(curriculumMismatches(lessonRegistry), [])
})

test('a valid reference to the wrong existing prerequisite fails curriculum alignment', () => {
  const changedRegistry = structuredClone(lessonRegistry)
  const descriptiveStatistics = changedRegistry.lessons.find((lesson) => lesson.lessonId === 'descriptive-statistics')
  descriptiveStatistics.commonPrerequisites = descriptiveStatistics.commonPrerequisites
    .map((reference) => reference === 'math-powers-roots' ? 'math-counting' : reference)

  assert.equal(validateLessonRegistry(changedRegistry), true)
  assert.ok(curriculumMismatches(changedRegistry).includes('commonPrerequisites:descriptive-statistics'))
})
