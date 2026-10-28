import assert from 'node:assert/strict'
import test from 'node:test'
import { lessonDomains, validateLessonRegistry } from '../src/lesson-contract.mjs'
import { deriveLessonGraph } from '../src/lesson-graph.mjs'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import { lessonRegistryFixture } from './lesson-contract.fixture.mjs'

const copy = (value) => structuredClone(value)
const lesson = (registry, lessonId) => registry.lessons.find((item) => item.lessonId === lessonId)

test('lesson graph keeps all registry relationships and the independent five-domain assignment', () => {
  const graph = deriveLessonGraph(lessonRegistry)

  assert.equal(graph.nodes.length, 34)
  assert.equal(graph.commonPrerequisiteEdges.length, 64)
  assert.equal(graph.conditionalPrerequisiteEdges.length, 37)
  assert.equal(graph.optionalReviewEdges.length, 8)
  assert.deepEqual(lessonDomains, {
    'math-foundations': '数学の基礎',
    'data-description': 'データ・記述統計',
    'probability-distributions': '確率・確率分布',
    'statistical-analysis': '統計分析・推測',
    'quality-methods': '品質管理手法',
  })

  const expectedDomains = {
    'math-arithmetic': 'math-foundations',
    'math-ratios-percentages': 'math-foundations',
    'math-powers-roots': 'math-foundations',
    'math-algebra-sigma': 'math-foundations',
    'math-counting': 'math-foundations',
    'data-types': 'data-description',
    'population-sample': 'data-description',
    'descriptive-statistics': 'data-description',
    'sampling': 'data-description',
    'data-transform': 'data-description',
    'probability-foundations': 'probability-distributions',
    'random-variables': 'probability-distributions',
    'normal-distribution': 'probability-distributions',
    'binomial-distribution': 'probability-distributions',
    'poisson-distribution': 'probability-distributions',
    'sampling-distributions': 'probability-distributions',
    'law-large-numbers-clt': 'probability-distributions',
    'inference-basics': 'statistical-analysis',
    'mean-inference': 'statistical-analysis',
    'variance-inference': 'statistical-analysis',
    'variance-ratio-inference': 'statistical-analysis',
    'mean-difference-inference': 'statistical-analysis',
    'paired-inference': 'statistical-analysis',
    'proportion-count-inference': 'statistical-analysis',
    'contingency-tests': 'statistical-analysis',
    'correlation': 'statistical-analysis',
    'serial-correlation': 'statistical-analysis',
    'simple-regression': 'statistical-analysis',
    'qc-seven-tools': 'quality-methods',
    'new-qc-tools': 'quality-methods',
    'control-charts': 'quality-methods',
    'process-capability': 'quality-methods',
    'sampling-inspection': 'quality-methods',
    'experimental-design': 'quality-methods',
  }
  assert.deepEqual(graph.nodes.map(({ id, domain }) => `${id}:${domain}`).sort(),
    Object.entries(expectedDomains).map(([id, domain]) => `${id}:${domain}`).sort())
  assert.deepEqual(Object.fromEntries(Object.keys(lessonDomains).map((domain) => [
    domain, graph.nodes.filter((node) => node.domain === domain).length,
  ])), {
    'math-foundations': 5,
    'data-description': 5,
    'probability-distributions': 7,
    'statistical-analysis': 11,
    'quality-methods': 6,
  })

  const nodeIds = new Set(graph.nodes.map((node) => node.id))
  for (const edge of [...graph.commonPrerequisiteEdges, ...graph.conditionalPrerequisiteEdges, ...graph.optionalReviewEdges]) {
    assert.ok(nodeIds.has(edge.source))
    assert.ok(nodeIds.has(edge.target))
  }
  assert.ok(graph.nodes.some((node) => node.availability === 'planned'))
  assert.ok(graph.nodes.every((node) => !('url' in node) && !('href' in node) && !('route' in node)))

  const anchoredCommon = graph.commonPrerequisiteEdges.find((edge) => edge.sourceRef.includes('#'))
  assert.ok(anchoredCommon)
  assert.equal(anchoredCommon.source, anchoredCommon.sourceRef.split('#')[0])
  assert.equal(anchoredCommon.targetRef, anchoredCommon.target)
  assert.equal(anchoredCommon.id, JSON.stringify([
    'common-prerequisite', anchoredCommon.sourceRef, anchoredCommon.target,
  ]))

  const conditional = graph.conditionalPrerequisiteEdges.find((edge) => edge.targetRef.includes('#'))
  assert.ok(conditional)
  assert.equal(conditional.target, conditional.targetRef.split('#')[0])
  assert.equal(conditional.kind, 'conditional-prerequisite')
  assert.ok(conditional.conditionId)
  assert.ok(conditional.condition)
  assert.equal(conditional.id, JSON.stringify([
    'conditional-prerequisite', conditional.target, conditional.conditionId,
    conditional.sourceRef, conditional.targetRef,
  ]))

  const optional = graph.optionalReviewEdges.find((edge) => edge.sourceRef.includes('#') && edge.targetRef.includes('#'))
  assert.ok(optional)
  assert.equal(optional.source, optional.sourceRef.split('#')[0])
  assert.equal(optional.target, optional.targetRef.split('#')[0])
  assert.equal(optional.kind, 'optional-review')
  assert.ok(optional.context)
})

test('invalid identities, unresolved refs, self-edges, cycles, and duplicate edge IDs are rejected', () => {
  const malformedId = copy(lessonRegistryFixture)
  lesson(malformedId, 'descriptive-statistics').lessonId = 'Invalid_ID'
  assert.throws(() => deriveLessonGraph(malformedId), /Invalid lesson registry/u)

  const missingId = copy(lessonRegistryFixture)
  delete lesson(missingId, 'descriptive-statistics').lessonId
  assert.throws(() => deriveLessonGraph(missingId), /Invalid lesson registry/u)

  const duplicateId = copy(lessonRegistryFixture)
  duplicateId.lessons.push(copy(duplicateId.lessons[0]))
  assert.throws(() => deriveLessonGraph(duplicateId), /Invalid lesson registry/u)

  const unresolvedRef = copy(lessonRegistryFixture)
  lesson(unresolvedRef, 'descriptive-statistics').commonPrerequisites.push('not-in-registry')
  assert.throws(() => deriveLessonGraph(unresolvedRef), /Invalid lesson registry/u)

  const commonSelfEdge = copy(lessonRegistryFixture)
  lesson(commonSelfEdge, 'descriptive-statistics').commonPrerequisites = ['descriptive-statistics']
  assert.throws(() => deriveLessonGraph(commonSelfEdge), /Invalid lesson registry/u)

  const conditionalSelfEdge = copy(lessonRegistryFixture)
  lesson(conditionalSelfEdge, 'descriptive-statistics').conditionalPrerequisites = [{
    conditionId: 'descriptive-self-edge',
    methodSectionRef: 'descriptive-statistics#mean',
    condition: 'この方法を使う場合。',
    prerequisiteRef: 'descriptive-statistics#variance',
  }]
  assert.throws(() => deriveLessonGraph(conditionalSelfEdge), /Invalid lesson registry/u)

  const optionalSelfEdge = copy(lessonRegistryFixture)
  lesson(optionalSelfEdge, 'descriptive-statistics').optionalReviews = [{
    fromRef: 'descriptive-statistics#variance',
    targetRef: 'descriptive-statistics#mean',
    context: '同じ単元の節を復習する。',
  }]
  assert.equal(validateLessonRegistry(optionalSelfEdge), true)
  assert.throws(() => deriveLessonGraph(optionalSelfEdge), /Self-referencing/u)

  const commonCycle = copy(lessonRegistryFixture)
  lesson(commonCycle, 'data-types').commonPrerequisites = ['descriptive-statistics']
  assert.throws(() => deriveLessonGraph(commonCycle), /Invalid lesson registry/u)

  const conditionalCycle = copy(lessonRegistryFixture)
  lesson(conditionalCycle, 'descriptive-statistics').commonPrerequisites = []
  lesson(conditionalCycle, 'descriptive-statistics').conditionalPrerequisites = [{
    conditionId: 'descriptive-to-data-types',
    methodSectionRef: 'descriptive-statistics#mean',
    condition: 'この方法を使う場合。',
    prerequisiteRef: 'data-types',
  }]
  lesson(conditionalCycle, 'data-types').conditionalPrerequisites = [{
    conditionId: 'data-types-to-descriptive',
    methodSectionRef: 'data-types#types',
    condition: 'この方法を使う場合。',
    prerequisiteRef: 'descriptive-statistics',
  }]
  assert.throws(() => deriveLessonGraph(conditionalCycle), /Invalid lesson registry/u)

  const mixedCycle = copy(lessonRegistryFixture)
  lesson(mixedCycle, 'data-types').conditionalPrerequisites = [{
    conditionId: 'data-types-to-descriptive',
    methodSectionRef: 'data-types#types',
    condition: 'この方法を使う場合。',
    prerequisiteRef: 'descriptive-statistics',
  }]
  assert.throws(() => deriveLessonGraph(mixedCycle), /Invalid lesson registry/u)

  const duplicateEdgeId = copy(lessonRegistryFixture)
  const duplicateReview = lesson(duplicateEdgeId, 'descriptive-statistics').optionalReviews[0]
  lesson(duplicateEdgeId, 'descriptive-statistics').optionalReviews.push({ ...duplicateReview })
  assert.equal(validateLessonRegistry(duplicateEdgeId), true)
  assert.throws(() => deriveLessonGraph(duplicateEdgeId), /Duplicate lesson graph edge/u)
})

test('optional-review cycles stay allowed and distinct section refs keep distinct IDs', () => {
  const graph = deriveLessonGraph(lessonRegistryFixture)
  assert.equal(graph.optionalReviewEdges.length, 2)

  const distinctRefs = copy(lessonRegistryFixture)
  const descriptive = lesson(distinctRefs, 'descriptive-statistics')
  descriptive.optionalReviews.push({
    ...descriptive.optionalReviews[0],
    fromRef: 'descriptive-statistics#mean',
  })
  const distinctGraph = deriveLessonGraph(distinctRefs)
  const sameNodes = distinctGraph.optionalReviewEdges.filter((edge) =>
    edge.source === 'descriptive-statistics' && edge.target === 'math-algebra-sigma')
  assert.equal(sameNodes.length, 2)
  assert.notEqual(sameNodes[0].id, sameNodes[1].id)
  assert.notEqual(sameNodes[0].sourceRef, sameNodes[1].sourceRef)
})

test('edge IDs survive reordering and wording edits, and returned data does not alias the registry', () => {
  const original = deriveLessonGraph(lessonRegistry)
  const reorderedRegistry = copy(lessonRegistry)
  reorderedRegistry.lessons.reverse()
  for (const item of reorderedRegistry.lessons) {
    item.commonPrerequisites.reverse()
    item.conditionalPrerequisites.reverse()
    item.optionalReviews.reverse()
  }
  const reordered = deriveLessonGraph(reorderedRegistry)
  const edgeIds = (graph) => [
    ...graph.commonPrerequisiteEdges,
    ...graph.conditionalPrerequisiteEdges,
    ...graph.optionalReviewEdges,
  ].map((edge) => edge.id).sort()
  assert.deepEqual(edgeIds(reordered), edgeIds(original))

  const editedTextRegistry = copy(lessonRegistry)
  editedTextRegistry.lessons.find((item) => item.conditionalPrerequisites.length > 0)
    .conditionalPrerequisites[0].condition = '条件の説明だけを変更する。'
  editedTextRegistry.lessons.find((item) => item.optionalReviews.length > 0)
    .optionalReviews[0].context = '復習の説明だけを変更する。'
  const editedText = deriveLessonGraph(editedTextRegistry)
  assert.deepEqual(editedText.conditionalPrerequisiteEdges.map((edge) => edge.id),
    original.conditionalPrerequisiteEdges.map((edge) => edge.id))
  assert.deepEqual(editedText.optionalReviewEdges.map((edge) => edge.id),
    original.optionalReviewEdges.map((edge) => edge.id))

  const before = copy(lessonRegistry)
  const mutableOutput = deriveLessonGraph(lessonRegistry)
  mutableOutput.nodes[0].id = 'changed'
  mutableOutput.nodes[0].goals[0] = 'changed'
  mutableOutput.nodes[0].sections.push('changed')
  mutableOutput.commonPrerequisiteEdges[0].source = 'changed'
  mutableOutput.conditionalPrerequisiteEdges[0].condition = 'changed'
  mutableOutput.optionalReviewEdges[0].context = 'changed'
  mutableOutput.nodes.pop()
  assert.deepEqual(lessonRegistry, before)
})
