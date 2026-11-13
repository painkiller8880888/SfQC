import assert from 'node:assert/strict'
import test from 'node:test'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import { parseLessonRef, validateLessonRegistry } from '../src/lesson-contract.mjs'
import { lessonRegistryFixture } from './lesson-contract.fixture.mjs'

const copy = (value) => structuredClone(value)
const lesson = (registry, lessonId) => registry.lessons.find((item) => item.lessonId === lessonId)

test('LessonRef parser validates stable syntax without requiring a current registry entry', () => {
  assert.deepEqual(parseLessonRef('future-lesson#section'), { lessonId: 'future-lesson', sectionId: 'section' })
  assert.deepEqual(parseLessonRef('future-lesson'), { lessonId: 'future-lesson', sectionId: null })
  for (const value of ['future_lesson', 'future-lesson#bad_section', 'future-lesson#', '', null]) {
    assert.equal(parseLessonRef(value), null)
  }
})

test('fixture and the six included lessons satisfy the contract and keep other lessons planned', () => {
  assert.equal(validateLessonRegistry(lessonRegistryFixture), true)
  assert.equal(validateLessonRegistry(lessonRegistry), true)
  assert.equal(lessonRegistry.lessons.length, 34)
  assert.equal(lessonRegistry.curriculumRevision, 3)
  assert.ok(lesson(lessonRegistry, 'descriptive-statistics').declaredSectionIds.includes('variance'))
  assert.ok(lesson(lessonRegistry, 'math-algebra-sigma').declaredSectionIds.includes('sigma'))
  assert.deepEqual(lesson(lessonRegistry, 'descriptive-statistics').declaredSectionIds, ['mean', 'deviation', 'variance', 'standard-deviation'])
  assert.equal(lesson(lessonRegistry, 'descriptive-statistics').availability, 'included')
  assert.equal(lesson(lessonRegistry, 'descriptive-statistics').revision, 5)
  assert.deepEqual(lesson(lessonRegistry, 'descriptive-statistics').questionIds, ['q-desc-var-sc-001', 'q-desc-var-num-001', 'q-desc-mean-sc-001', 'q-desc-sd-sc-001', 'q-desc-var-gen-num-001'])
  const expectedSections = new Map([
    ['data-types', ['types']],
    ['math-arithmetic', ['operations']],
    ['math-ratios-percentages', ['ratio']],
    ['math-powers-roots', ['powers-roots']],
    ['math-algebra-sigma', ['sigma']],
    ['descriptive-statistics', ['mean', 'deviation', 'variance', 'standard-deviation']],
  ])
  const includedLessons = lessonRegistry.lessons.filter((item) => item.availability === 'included')
  assert.deepEqual(includedLessons.map((item) => item.lessonId).sort(), [...expectedSections.keys()].sort())
  for (const item of lessonRegistry.lessons) {
    const sectionIds = expectedSections.get(item.lessonId)
    if (!sectionIds) {
      assert.equal(item.availability, 'planned')
      assert.equal(item.revision, 1)
      continue
    }
    assert.equal(item.revision, item.lessonId === 'descriptive-statistics' ? 5 : 2)
    assert.deepEqual(item.declaredSectionIds, sectionIds)
    assert.equal(item.sections.length, sectionIds.length)
    const paragraphs = item.sections.flatMap((section) => section.blocks
      .filter((block) => block.kind === 'paragraph')
      .map((block) => block.parts.filter((part) => part.kind === 'text').map((part) => part.text).join('')))
    if (item.lessonId !== 'descriptive-statistics') {
      assert.ok(paragraphs.some((paragraph) => paragraph.includes('例：')))
      assert.ok(paragraphs.some((paragraph) => paragraph.startsWith('出典')))
    } else {
      assert.equal(item.references.length, 4)
      assert.ok(item.overview.some((block) => block.kind === 'table'))
    }
  }
  assert.equal(lessonRegistry.officialSourceItemIds.length, 64)
  assert.deepEqual(lesson(lessonRegistry, 'data-types').sourceRefs, ['jsa-l3', 'jsa-l4'])
  assert.ok(lessonRegistry.sources.every((source) => source.url.endsWith('.pdf')))
  assert.ok(lessonRegistry.sources.find((source) => source.sourceId === 'jsa-l2').citations
    .some((citation) => citation.sourceItemId === 'SRC-0062' && citation.location === 'p.1「品質保証：プロセス保証」'))
})

test('basic statistics course covers the worked comparison, drills, code figures, and sources', () => {
  const descriptive = lesson(lessonRegistry, 'descriptive-statistics')
  const allBlocks = (blocks) => blocks.flatMap((block) => [
    block,
    ...(block.kind === 'details' ? allBlocks(block.blocks) : []),
  ])
  const allCourseBlocks = [
    ...allBlocks(descriptive.overview),
    ...descriptive.sections.flatMap((section) => allBlocks(section.blocks)),
  ]
  const courseText = JSON.stringify({ overview: descriptive.overview, sections: descriptive.sections })

  assert.equal(validateLessonRegistry(lessonRegistry), true)
  assert.deepEqual(descriptive.declaredSectionIds, ['mean', 'deviation', 'variance', 'standard-deviation'])
  assert.equal(descriptive.revision, 5)
  assert.ok(courseText.includes('100 mm'))
  assert.ok(courseText.includes('偏差'))
  assert.ok(courseText.includes('偏差平方和'))
  assert.ok(courseText.includes('不偏分散'))
  assert.ok(courseText.includes('n − 1'))
  assert.ok(courseText.includes('標準偏差'))
  assert.deepEqual(allCourseBlocks.filter((block) => block.kind === 'exerciseSlot').map((block) => block.exerciseId),
    ['mean', 'deviation', 'variance', 'standard-deviation'])
  assert.equal(descriptive.figures.length, 5)
  assert.ok(descriptive.figures.every((figure) => figure.rendererRef.startsWith('code:')))
  assert.ok(descriptive.references.some((reference) => reference.url.includes('openstax.org')))
  assert.match(descriptive.credit, /Solarized/u)

  const sampleVariance = (values) => {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
  }
  const lineA = [98, 100, 102]
  const lineB = [99, 100, 101]
  assert.equal(lineA.reduce((sum, value) => sum + value, 0) / lineA.length, 100)
  assert.equal(lineB.reduce((sum, value) => sum + value, 0) / lineB.length, 100)
  assert.equal(sampleVariance(lineA), 4)
  assert.equal(sampleVariance(lineB), 1)
  assert.equal(Math.sqrt(sampleVariance(lineA)), 2)
  assert.equal(Math.sqrt(sampleVariance(lineB)), 1)
})
test('paragraphs, equation token order, and the registered variance figure stay explicit', () => {
  const variance = lesson(lessonRegistryFixture, 'descriptive-statistics').sections.find((section) => section.sectionId === 'variance')
  const formula = variance.blocks.find((block) => block.kind === 'formula')
  assert.deepEqual(formula.parts.map((part) => part.kind), ['mathText', 'mathSymbol', 'mathText'])
  assert.equal(formula.parts[1].symbol, 'Σ')
  assert.equal(formula.parts[1].lessonRef.targetRef, 'math-algebra-sigma#sigma')
  assert.equal(formula.parts.map((part) => part.kind === 'mathSymbol' ? part.symbol : part.text).join(''), 's² = 1/(n−1) Σ (xᵢ−x̄)²')
  assert.equal(variance.blocks.find((block) => block.kind === 'figureRef').figureId, 'FIG-DESC-VAR-001')
  assert.equal(lesson(lessonRegistryFixture, 'descriptive-statistics').figures[0].rendererRef, 'code:variance-deviation-bars')

  const registeredLesson = lesson(lessonRegistry, 'descriptive-statistics')
  const registeredVariance = registeredLesson.sections.find((section) => section.sectionId === 'variance')
  const registeredFigure = registeredLesson.figures.find((figure) => figure.figureId === 'FIG-DS-VARIANCE')
  assert.ok(registeredVariance.blocks.some((block) => block.kind === 'figureRef' && block.figureId === registeredFigure.figureId))
  assert.equal(registeredFigure.rendererRef, 'code:interactive-variance-comparison')
  assert.deepEqual(registeredFigure.axes.map(({ axis, label, scale }) => ({ axis, label, scale })), [
    { axis: 'x', label: '測定値（mm）', scale: 'linear' },
    { axis: 'y', label: 'ラインと観測番号', scale: 'categorical' },
  ])
  assert.match(registeredFigure.altText, /ライン A と B.*平均/u)
})

test('figure contracts distinguish coordinate charts from axisless diagrams', () => {
  const withDiagram = copy(lessonRegistryFixture)
  const descriptive = lesson(withDiagram, 'descriptive-statistics')
  descriptive.sections[0].blocks.push({ kind: 'figureRef', figureId: 'FIG-DIAGRAM-001' })
  descriptive.figures.push({
    kind: 'diagram',
    figureId: 'FIG-DIAGRAM-001',
    rendererRef: 'code:cause-effect-diagram',
    educationalPurpose: '要因候補を階層的に整理する。',
    legend: [],
    altText: '結果に向かう複数の原因候補を枝分かれで示す。',
  })
  assert.equal(validateLessonRegistry(withDiagram), true)

  const diagramWithAxes = copy(withDiagram)
  diagramWithAxes.lessons.find((item) => item.lessonId === 'descriptive-statistics').figures[1].axes = []
  assert.equal(validateLessonRegistry(diagramWithAxes), false)

  const chartWithoutVariable = copy(lessonRegistryFixture)
  lesson(chartWithoutVariable, 'descriptive-statistics').figures[0].variables = []
  assert.equal(validateLessonRegistry(chartWithoutVariable), false)

  const chartWithDuplicateAxis = copy(lessonRegistryFixture)
  lesson(chartWithDuplicateAxis, 'descriptive-statistics').figures[0].axes[1].axis = 'x'
  assert.equal(validateLessonRegistry(chartWithDuplicateAxis), false)
})

test('metadata references resolve planned declarations while body links require included targets', () => {
  assert.equal(validateLessonRegistry(lessonRegistryFixture), true)

  const missingLesson = copy(lessonRegistryFixture)
  lesson(missingLesson, 'descriptive-statistics').commonPrerequisites.push('not-in-registry')
  assert.equal(validateLessonRegistry(missingLesson), false)

  const missingAnchor = copy(lessonRegistryFixture)
  lesson(missingAnchor, 'descriptive-statistics').commonPrerequisites.push('math-algebra-sigma#not-declared')
  assert.equal(validateLessonRegistry(missingAnchor), false)

  const linkToPlanned = copy(lessonRegistryFixture)
  lesson(linkToPlanned, 'descriptive-statistics').sections[0].blocks[1].targetRef = 'math-ratios-percentages'
  assert.equal(validateLessonRegistry(linkToPlanned), false)

  const undefinedBodyAnchor = copy(lessonRegistryFixture)
  lesson(undefinedBodyAnchor, 'descriptive-statistics').sections[1].blocks[1].parts[1].lessonRef.targetRef = 'math-algebra-sigma#missing'
  assert.equal(validateLessonRegistry(undefinedBodyAnchor), false)
})

test('planned and included content rules reject empty or reference-only sections', () => {
  const plannedWithSections = copy(lessonRegistryFixture)
  lesson(plannedWithSections, 'math-ratios-percentages').sections = []
  assert.equal(validateLessonRegistry(plannedWithSections), false)

  const noSections = copy(lessonRegistryFixture)
  lesson(noSections, 'descriptive-statistics').sections = []
  assert.equal(validateLessonRegistry(noSections), false)

  const referenceOnly = copy(lessonRegistryFixture)
  lesson(referenceOnly, 'descriptive-statistics').sections[0].blocks = [
    { kind: 'lessonRef', label: '参照だけ', targetRef: 'data-types#types' },
  ]
  assert.equal(validateLessonRegistry(referenceOnly), false)

  const emptyParagraph = copy(lessonRegistryFixture)
  lesson(emptyParagraph, 'descriptive-statistics').sections[0].blocks = [
    { kind: 'paragraph', parts: [{ kind: 'text', text: '  ' }] },
  ]
  assert.equal(validateLessonRegistry(emptyParagraph), false)
})

test('source, section, and figure IDs must resolve without duplicates', () => {
  const duplicateLesson = copy(lessonRegistryFixture)
  duplicateLesson.lessons.push(copy(duplicateLesson.lessons[0]))
  assert.equal(validateLessonRegistry(duplicateLesson), false)

  const duplicateSource = copy(lessonRegistryFixture)
  duplicateSource.sources.push(copy(duplicateSource.sources[0]))
  assert.equal(validateLessonRegistry(duplicateSource), false)

  const duplicateSection = copy(lessonRegistryFixture)
  lesson(duplicateSection, 'descriptive-statistics').declaredSectionIds.push('variance')
  assert.equal(validateLessonRegistry(duplicateSection), false)

  const missingSourceCoverage = copy(lessonRegistryFixture)
  lesson(missingSourceCoverage, 'descriptive-statistics').sourceRefs = []
  assert.equal(validateLessonRegistry(missingSourceCoverage), false)

  const missingSecondaryCitation = copy(lessonRegistry)
  lesson(missingSecondaryCitation, 'data-types').sourceRefs = ['jsa-l3']
  assert.equal(validateLessonRegistry(missingSecondaryCitation), false)

  const unrelatedSource = copy(lessonRegistryFixture)
  lesson(unrelatedSource, 'descriptive-statistics').sourceRefs = ['scope-src-0001']
  assert.equal(validateLessonRegistry(unrelatedSource), false)

  const badUrl = copy(lessonRegistryFixture)
  badUrl.sources[0].url = 'javascript:alert(1)'
  assert.equal(validateLessonRegistry(badUrl), false)

  const badCitation = copy(lessonRegistryFixture)
  badCitation.sources[0].citations = []
  assert.equal(validateLessonRegistry(badCitation), false)

  const unresolvedFigure = copy(lessonRegistryFixture)
  lesson(unresolvedFigure, 'descriptive-statistics').sections[1].blocks[2].figureId = 'FIG-MISSING'
  assert.equal(validateLessonRegistry(unresolvedFigure), false)

  const duplicateFigure = copy(lessonRegistryFixture)
  lesson(duplicateFigure, 'math-algebra-sigma').figures.push(copy(lesson(duplicateFigure, 'descriptive-statistics').figures[0]))
  assert.equal(validateLessonRegistry(duplicateFigure), false)

  const badRenderer = copy(lessonRegistryFixture)
  lesson(badRenderer, 'descriptive-statistics').figures[0].rendererRef = 'image:generated-figure'
  assert.equal(validateLessonRegistry(badRenderer), false)
})

test('shared and conditional prerequisites form one acyclic graph; optional reviews are excluded', () => {
  const sharedCycle = copy(lessonRegistryFixture)
  lesson(sharedCycle, 'data-types').commonPrerequisites = ['descriptive-statistics']
  assert.equal(validateLessonRegistry(sharedCycle), false)

  const combinedCycle = copy(lessonRegistryFixture)
  lesson(combinedCycle, 'data-types').conditionalPrerequisites = [{
    conditionId: 'descriptive-statistics-conditional-back-edge',
    methodSectionRef: 'data-types#types',
    condition: '特定の方法を使う場合。',
    prerequisiteRef: 'descriptive-statistics',
  }]
  assert.equal(validateLessonRegistry(combinedCycle), false)

  const conditionalCycle = copy(lessonRegistryFixture)
  lesson(conditionalCycle, 'descriptive-statistics').commonPrerequisites = []
  lesson(conditionalCycle, 'math-algebra-sigma').commonPrerequisites = []
  lesson(conditionalCycle, 'descriptive-statistics').conditionalPrerequisites = [{
    conditionId: 'descriptive-statistics-conditional-forward-edge',
    methodSectionRef: 'descriptive-statistics#mean',
    condition: '特定の方法を使う場合。',
    prerequisiteRef: 'data-types',
  }]
  lesson(conditionalCycle, 'data-types').conditionalPrerequisites = [{
    conditionId: 'data-types-conditional-back-edge',
    methodSectionRef: 'data-types#types',
    condition: '特定の方法を使う場合。',
    prerequisiteRef: 'descriptive-statistics',
  }]
  assert.equal(validateLessonRegistry(conditionalCycle), false)

  const selfCycle = copy(lessonRegistryFixture)
  lesson(selfCycle, 'descriptive-statistics').commonPrerequisites.push('descriptive-statistics')
  assert.equal(validateLessonRegistry(selfCycle), false)

  const optionalCycle = copy(lessonRegistryFixture)
  assert.equal(validateLessonRegistry(optionalCycle), true)
})

test('conditions keep method scope and question IDs are shape-checked without registry resolution', () => {
  const conditional = copy(lessonRegistryFixture)
  lesson(conditional, 'descriptive-statistics').conditionalPrerequisites = [{
    conditionId: 'descriptive-mean-method',
    methodSectionRef: 'descriptive-statistics#mean',
    condition: '特定の方法を選んだ場合。',
    prerequisiteRef: 'math-ratios-percentages',
  }]
  lesson(conditional, 'math-algebra-sigma').conditionalPrerequisites = [{
    conditionId: 'descriptive-mean-method',
    methodSectionRef: 'math-algebra-sigma#sigma',
    condition: '別の方法を選んだ場合。',
    prerequisiteRef: 'math-ratios-percentages',
  }]
  assert.equal(validateLessonRegistry(conditional), false)

  const wrongMethod = copy(lessonRegistryFixture)
  lesson(wrongMethod, 'descriptive-statistics').conditionalPrerequisites = [{
    conditionId: 'descriptive-mean-method',
    methodSectionRef: 'math-algebra-sigma#sigma',
    condition: '特定の方法を選んだ場合。',
    prerequisiteRef: 'math-ratios-percentages',
  }]
  assert.equal(validateLessonRegistry(wrongMethod), false)

  const unresolvedQuestion = copy(lessonRegistryFixture)
  lesson(unresolvedQuestion, 'descriptive-statistics').questionIds = ['q-not-yet-registered']
  assert.equal(validateLessonRegistry(unresolvedQuestion), true)

  const malformedQuestionId = copy(lessonRegistryFixture)
  lesson(malformedQuestionId, 'descriptive-statistics').questionIds = ['Invalid_ID']
  assert.equal(validateLessonRegistry(malformedQuestionId), false)

  const duplicateQuestionIds = copy(lessonRegistryFixture)
  lesson(duplicateQuestionIds, 'descriptive-statistics').questionIds = ['q-question-1', 'q-question-1']
  assert.equal(validateLessonRegistry(duplicateQuestionIds), false)
})

test('unknown keys, undefined values, malformed IDs, and invalid revisions are rejected', () => {
  assert.equal(validateLessonRegistry({ ...copy(lessonRegistryFixture), extra: true }), false)
  assert.equal(validateLessonRegistry({ ...copy(lessonRegistryFixture), curriculumRevision: 0 }), false)
  assert.equal(validateLessonRegistry({ ...copy(lessonRegistryFixture), curriculumRevision: Number.NaN }), false)

  const undefinedValue = copy(lessonRegistryFixture)
  lesson(undefinedValue, 'descriptive-statistics').extra = undefined
  assert.equal(validateLessonRegistry(undefinedValue), false)

  const malformedId = copy(lessonRegistryFixture)
  lesson(malformedId, 'descriptive-statistics').revision = 1.5
  assert.equal(validateLessonRegistry(malformedId), false)

  const missingDomain = copy(lessonRegistryFixture)
  delete lesson(missingDomain, 'descriptive-statistics').domain
  assert.equal(validateLessonRegistry(missingDomain), false)

  const unknownDomain = copy(lessonRegistryFixture)
  lesson(unknownDomain, 'descriptive-statistics').domain = 'other'
  assert.equal(validateLessonRegistry(unknownDomain), false)
})
