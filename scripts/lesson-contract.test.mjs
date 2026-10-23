import assert from 'node:assert/strict'
import test from 'node:test'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import { validateLessonRegistry } from '../src/lesson-contract.mjs'
import { lessonRegistryFixture } from './lesson-contract.fixture.mjs'

const copy = (value) => structuredClone(value)
const lesson = (registry, lessonId) => registry.lessons.find((item) => item.lessonId === lessonId)

test('fixture and all planned registry entries satisfy the contract', () => {
  assert.equal(validateLessonRegistry(lessonRegistryFixture), true)
  assert.equal(validateLessonRegistry(lessonRegistry), true)
  assert.equal(lessonRegistry.lessons.length, 34)
  assert.ok(lesson(lessonRegistry, 'descriptive-statistics').declaredSectionIds.includes('variance'))
  assert.ok(lesson(lessonRegistry, 'math-algebra-sigma').declaredSectionIds.includes('sigma'))
  assert.deepEqual(lesson(lessonRegistry, 'descriptive-statistics').declaredSectionIds, ['mean', 'variance', 'standard-deviation'])
  assert.equal(lesson(lessonRegistry, 'descriptive-statistics').availability, 'planned')
  assert.equal(lesson(lessonRegistry, 'descriptive-statistics').questionIds.length, 0)
  assert.equal(lessonRegistry.officialSourceItemIds.length, 64)
})

test('paragraph, equation token order, and code figure references stay explicit', () => {
  const variance = lesson(lessonRegistryFixture, 'descriptive-statistics').sections.find((section) => section.sectionId === 'variance')
  const formula = variance.blocks.find((block) => block.kind === 'formula')
  assert.deepEqual(formula.parts.map((part) => part.kind), ['mathText', 'mathSymbol', 'mathText'])
  assert.equal(formula.parts[1].symbol, 'Σ')
  assert.equal(formula.parts[1].lessonRef.targetRef, 'math-algebra-sigma#sigma')
  assert.equal(formula.parts.map((part) => part.kind === 'mathSymbol' ? part.symbol : part.text).join(''), 's² = 1/(n−1) Σ (xᵢ−x̄)²')
  assert.equal(variance.blocks.find((block) => block.kind === 'figureRef').figureId, 'FIG-DESC-VAR-001')
  assert.equal(lesson(lessonRegistryFixture, 'descriptive-statistics').figures[0].rendererRef, 'code:variance-deviation-bars')
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

  const unrelatedSource = copy(lessonRegistryFixture)
  lesson(unrelatedSource, 'descriptive-statistics').sourceRefs = ['scope-src-0001']
  assert.equal(validateLessonRegistry(unrelatedSource), false)

  const badUrl = copy(lessonRegistryFixture)
  badUrl.sources[0].url = 'javascript:alert(1)'
  assert.equal(validateLessonRegistry(badUrl), false)

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

test('conditions keep method scope and stable IDs, and question IDs remain unresolved', () => {
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
  assert.equal(validateLessonRegistry(unresolvedQuestion), false)
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
})
