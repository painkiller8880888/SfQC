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
  assert.equal(lesson(lessonRegistry, 'descriptive-statistics').revision, 4)
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
    assert.equal(item.revision, item.lessonId === 'descriptive-statistics' ? 4 : 2)
    assert.deepEqual(item.declaredSectionIds, sectionIds)
    assert.equal(item.sections.length, sectionIds.length)
    const paragraphs = item.sections.flatMap((section) => section.blocks
      .filter((block) => block.kind === 'paragraph')
      .map((block) => block.parts.filter((part) => part.kind === 'text').map((part) => part.text).join('')))
    assert.ok(paragraphs.some((paragraph) => paragraph.includes('例：')))
    assert.ok(paragraphs.some((paragraph) => paragraph.startsWith('出典')))
  }
  assert.equal(lessonRegistry.officialSourceItemIds.length, 64)
  assert.deepEqual(lesson(lessonRegistry, 'data-types').sourceRefs, ['jsa-l3', 'jsa-l4'])
  assert.ok(lessonRegistry.sources.every((source) => source.url.endsWith('.pdf')))
  assert.ok(lessonRegistry.sources.find((source) => source.sourceId === 'jsa-l2').citations
    .some((citation) => citation.sourceItemId === 'SRC-0062' && citation.location === 'p.1「品質保証：プロセス保証」'))
})

test('descriptive statistics distinguish variance purposes and independently check the worked example', () => {
  const descriptive = lesson(lessonRegistry, 'descriptive-statistics')
  const sectionText = new Map(descriptive.sections.map((section) => [section.sectionId,
    section.blocks.map((block) => block.kind === 'paragraph'
      ? block.parts.filter((part) => part.kind === 'text').map((part) => part.text).join('')
      : block.kind === 'formula' ? block.parts.map((part) => part.kind === 'mathSymbol' ? part.symbol : part.text).join('') : '').join(' ')]))
  const sectionFormulas = new Map(descriptive.sections.map((section) => [section.sectionId,
    section.blocks.filter((block) => block.kind === 'formula').map((block) => block.parts)]))

  assert.ok(sectionText.get('mean').includes('Σ_{i=1}^{N} xᵢ は、添字 i を1から N まで')
    && sectionText.get('mean').includes('その範囲の xᵢ をすべて足す記号'))
  assert.ok(sectionText.get('mean').includes('31/15 = 2.0666… mm'))
  assert.ok(sectionText.get('mean').includes('測定値 1.000 mm、2.200 mm、3.000 mm'))
  assert.ok(sectionText.get('mean').includes('量的データ') && sectionText.get('mean').includes('μ') && sectionText.get('mean').includes('x̄'))
  assert.ok(sectionText.get('deviation').includes('−16/15 mm'))
  assert.ok(sectionText.get('deviation').includes('2/15 mm') && sectionText.get('deviation').includes('14/15 mm'))
  assert.ok(sectionText.get('variance').includes('母集団全体を記述する母分散は偏差平方和を N で割り')
    && sectionText.get('variance').includes('標本そのものを記述する分散は偏差平方和を n で割った平均')
    && sectionText.get('variance').includes('母分散を推定する不偏分散は、標本の偏差平方和を n−1 で割った推定量'))
  assert.ok(sectionText.get('variance').includes('母分散の不偏推定量（不偏分散）'))
  assert.ok(sectionText.get('variance').includes('標本分散として n=3'))
  assert.ok(sectionText.get('variance').includes('152/225 ≈ 0.676 mm²'))
  assert.ok(sectionText.get('variance').includes('76/75 ≈ 1.013 mm²'))
  assert.ok(sectionText.get('variance').includes('n≥2') && sectionText.get('variance').includes('母分散が有限'))
  assert.ok(sectionText.get('variance').includes('3.000 − 1.000 = 2.000 mm'))
  assert.ok(sectionText.get('standard-deviation').includes('0.822 mm') && sectionText.get('standard-deviation').includes('1.007 mm'))
  assert.ok(sectionText.get('standard-deviation').includes('大半の値が入るとは結論できません'))
  assert.ok(sectionText.get('standard-deviation').includes('2026-10-21')
    && sectionText.get('standard-deviation').includes('2026-10-23')
    && sectionText.get('standard-deviation').includes('2-7-measures-of-the-spread-of-the-data'))
  assert.deepEqual(sectionFormulas.get('mean'), [[{
    kind: 'mathText',
    text: '母平均：μ = (Σ_{i=1}^{N} xᵢ)/N; 標本平均：x̄ = (Σ_{i=1}^{n} xᵢ)/n',
  }]])
  assert.deepEqual(sectionFormulas.get('deviation'), [[{
    kind: 'mathText',
    text: '母集団の偏差：xᵢ − μ; 標本の偏差：xᵢ − x̄',
  }]])
  assert.deepEqual(sectionFormulas.get('variance'), [
    [{
      kind: 'mathText',
      text: '母分散：σ² = (Σ_{i=1}^{N}(xᵢ − μ)²)/N; 標本分散（標本内の記述）：(Σ_{i=1}^{n}(xᵢ − x̄)²)/n; 母分散の不偏推定量（不偏分散）：s² = (Σ_{i=1}^{n}(xᵢ − x̄)²)/(n−1); 範囲 = 最大値 − 最小値',
    }],
    [
      { kind: 'mathText', text: '標本平方偏差和：' },
      { kind: 'mathSymbol', symbol: 'Σ', lessonRef: { label: '総和記号の読み方', targetRef: 'math-algebra-sigma#sigma' } },
      { kind: 'mathText', text: '_{i=1}^{n}(xᵢ − x̄)²' },
    ],
  ])
  assert.deepEqual(sectionFormulas.get('standard-deviation'), [[{
    kind: 'mathText',
    text: '母標準偏差：σ = √σ²; 不偏分散から計算する標本標準偏差：s = √s²',
  }]])
  const varianceBlocks = descriptive.sections.find((section) => section.sectionId === 'variance').blocks
  const firstVarianceFormulaIndex = varianceBlocks.findIndex((block) => block.kind === 'formula')
  const linkedSigmaFormulaIndex = varianceBlocks.findIndex((block) => block.kind === 'formula'
    && block.parts.some((part) => part.kind === 'mathSymbol' && part.symbol === 'Σ'))
  assert.equal(linkedSigmaFormulaIndex, firstVarianceFormulaIndex + 2)
  assert.ok(descriptive.optionalReviews.some((review) => review.fromRef === 'descriptive-statistics#variance'
    && review.targetRef === 'math-algebra-sigma#sigma' && review.context.includes('平均節で意味を説明')))

  const data = [1, 2.2, 3]
  const sum = data.reduce((total, value) => total + value, 0)
  const mean = sum / data.length
  const deviations = data.map((value) => value - mean)
  const directSum = deviations.reduce((total, value) => total + value ** 2, 0)
  const shortcutSum = data.reduce((total, value) => total + value ** 2, 0) - sum ** 2 / data.length
  assert.ok(Math.abs(mean - 31 / 15) < 1e-12)
  assert.ok(Math.abs(deviations[0] + 16 / 15) < 1e-12)
  assert.ok(Math.abs(deviations[1] - 2 / 15) < 1e-12)
  assert.ok(Math.abs(deviations[2] - 14 / 15) < 1e-12)
  assert.ok(Math.abs(directSum - 152 / 75) < 1e-12)
  assert.ok(Math.abs(shortcutSum - 152 / 75) < 1e-12)
  assert.ok(Math.abs(directSum / data.length - 152 / 225) < 1e-12)
  assert.ok(Math.abs(directSum / (data.length - 1) - 76 / 75) < 1e-12)
  assert.equal(Number(Math.sqrt(directSum / data.length).toFixed(3)), 0.822)
  assert.equal(Number(Math.sqrt(directSum / (data.length - 1)).toFixed(3)), 1.007)
  assert.equal(Math.max(...data) - Math.min(...data), 2)
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
  const registeredFigure = registeredLesson.figures.find((figure) => figure.figureId === 'FIG-DESC-VAR-001')
  assert.equal(registeredVariance.blocks.find((block) => block.kind === 'figureRef').figureId, registeredFigure.figureId)
  assert.equal(registeredFigure.rendererRef, 'code:variance-deviation-bars')
  assert.deepEqual(registeredFigure.axes.map(({ axis, label, scale }) => ({ axis, label, scale })), [
    { axis: 'x', label: '観測番号', scale: 'categorical' },
    { axis: 'y', label: '測定値（mm）', scale: 'linear' },
  ])
  assert.match(registeredFigure.altText, /3つの測定点.*平均.*偏差線/)
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
})
