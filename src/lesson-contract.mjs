const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
const figureIdPattern = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/u
const sourceItemIdPattern = /^SRC-\d{4}$/u
const rendererRefPattern = /^code:[a-z0-9]+(?:-[a-z0-9]+)*$/u
const lessonRefPattern = /^([a-z0-9]+(?:-[a-z0-9]+)*)(?:#([a-z0-9]+(?:-[a-z0-9]+)*))?$/u

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false
  return Reflect.ownKeys(value).every((key) => {
    if (typeof key !== 'string') return false
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return descriptor?.enumerable === true && 'value' in descriptor && descriptor.value !== undefined
  })
}

function isArray(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false
  const keys = Reflect.ownKeys(value)
  return keys.length === value.length + 1
    && keys.includes('length')
    && Array.from({ length: value.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      return descriptor?.enumerable === true && 'value' in descriptor && descriptor.value !== undefined
    }).every(Boolean)
}

function hasOnlyKeys(value, allowed) {
  return isRecord(value) && Reflect.ownKeys(value).every((key) => allowed.includes(key))
}

function hasKeys(value, required) {
  return required.every((key) => Object.hasOwn(value, key))
}

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isUniqueTextArray(value, pattern, { allowEmpty = true } = {}) {
  if (!isArray(value) || (!allowEmpty && value.length === 0)) return false
  const seen = new Set()
  for (const item of value) {
    if (typeof item !== 'string' || !pattern.test(item) || seen.has(item)) return false
    seen.add(item)
  }
  return true
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0 && !Object.is(value, -0)
}

function parseLessonRef(value) {
  if (typeof value !== 'string') return null
  const match = lessonRefPattern.exec(value)
  return match ? { lessonId: match[1], sectionId: match[2] ?? null } : null
}

function isInlineLessonRef(value) {
  return hasOnlyKeys(value, ['label', 'targetRef'])
    && hasKeys(value, ['label', 'targetRef'])
    && isText(value.label)
    && parseLessonRef(value.targetRef) !== null
}

function isParagraphPart(value) {
  if (!isRecord(value)) return false
  if (value.kind === 'text') {
    return hasOnlyKeys(value, ['kind', 'text']) && hasKeys(value, ['kind', 'text']) && isText(value.text)
  }
  if (value.kind === 'lessonRef') {
    return hasOnlyKeys(value, ['kind', 'label', 'targetRef'])
      && hasKeys(value, ['kind', 'label', 'targetRef'])
      && isInlineLessonRef({ label: value.label, targetRef: value.targetRef })
  }
  return false
}

function isFormulaPart(value) {
  if (!isRecord(value)) return false
  if (value.kind === 'mathText') {
    return hasOnlyKeys(value, ['kind', 'text']) && hasKeys(value, ['kind', 'text']) && isText(value.text)
  }
  if (value.kind === 'mathSymbol') {
    return hasOnlyKeys(value, ['kind', 'symbol', 'lessonRef'])
      && hasKeys(value, ['kind', 'symbol'])
      && isText(value.symbol)
      && (!Object.hasOwn(value, 'lessonRef') || isInlineLessonRef(value.lessonRef))
  }
  return false
}

function isBodyBlock(value) {
  if (!isRecord(value)) return false
  if (value.kind === 'paragraph') {
    return hasOnlyKeys(value, ['kind', 'parts'])
      && hasKeys(value, ['kind', 'parts'])
      && isArray(value.parts)
      && value.parts.length > 0
      && value.parts.every(isParagraphPart)
  }
  if (value.kind === 'formula') {
    return hasOnlyKeys(value, ['kind', 'parts'])
      && hasKeys(value, ['kind', 'parts'])
      && isArray(value.parts)
      && value.parts.length > 0
      && value.parts.every(isFormulaPart)
  }
  if (value.kind === 'lessonRef') {
    return hasOnlyKeys(value, ['kind', 'label', 'targetRef'])
      && hasKeys(value, ['kind', 'label', 'targetRef'])
      && isInlineLessonRef({ label: value.label, targetRef: value.targetRef })
  }
  return value.kind === 'figureRef'
    && hasOnlyKeys(value, ['kind', 'figureId'])
    && hasKeys(value, ['kind', 'figureId'])
    && typeof value.figureId === 'string'
    && figureIdPattern.test(value.figureId)
}

function isSubstantiveBlock(block) {
  if (block.kind === 'paragraph') return block.parts.some((part) => part.kind === 'text' && isText(part.text))
  if (block.kind === 'formula') return block.parts.some((part) => part.kind === 'mathText' || (part.kind === 'mathSymbol' && isText(part.symbol)))
  return false
}

function isSection(value) {
  return hasOnlyKeys(value, ['sectionId', 'title', 'blocks'])
    && hasKeys(value, ['sectionId', 'title', 'blocks'])
    && typeof value.sectionId === 'string'
    && idPattern.test(value.sectionId)
    && isText(value.title)
    && isArray(value.blocks)
    && value.blocks.every(isBodyBlock)
    && value.blocks.some(isSubstantiveBlock)
}

function isFigure(value) {
  if (!hasOnlyKeys(value, ['figureId', 'rendererRef', 'educationalPurpose', 'variables', 'axes', 'legend', 'altText'])
    || !hasKeys(value, ['figureId', 'rendererRef', 'educationalPurpose', 'variables', 'axes', 'legend', 'altText'])) return false
  if (typeof value.figureId !== 'string' || !figureIdPattern.test(value.figureId)
    || typeof value.rendererRef !== 'string' || !rendererRefPattern.test(value.rendererRef)
    || !isText(value.educationalPurpose) || !isText(value.altText)) return false
  if (!isArray(value.variables) || value.variables.length === 0 || !value.variables.every((variable) => {
    return hasOnlyKeys(variable, ['name', 'unit']) && hasKeys(variable, ['name', 'unit'])
      && isText(variable.name) && isText(variable.unit)
  })) return false
  if (!isArray(value.axes) || value.axes.length !== 2 || !value.axes.every((axis) => {
    return hasOnlyKeys(axis, ['axis', 'label', 'scale']) && hasKeys(axis, ['axis', 'label', 'scale'])
      && (axis.axis === 'x' || axis.axis === 'y')
      && isText(axis.label)
      && ['linear', 'log', 'categorical'].includes(axis.scale)
  }) || new Set(value.axes.map((axis) => axis.axis)).size !== 2) return false
  return isArray(value.legend) && value.legend.every((item) => {
    return hasOnlyKeys(item, ['label', 'meaning']) && hasKeys(item, ['label', 'meaning'])
      && isText(item.label) && isText(item.meaning)
  })
}

function isSource(value, officialSourceItemIds) {
  if (!hasOnlyKeys(value, ['sourceId', 'title', 'url', 'version', 'checkedAt', 'location', 'purpose', 'coversSourceItemIds'])
    || !hasKeys(value, ['sourceId', 'title', 'url', 'version', 'checkedAt', 'location', 'purpose', 'coversSourceItemIds'])) return false
  if (typeof value.sourceId !== 'string' || !idPattern.test(value.sourceId)
    || ![value.title, value.version, value.location, value.purpose].every(isText)) return false
  if (typeof value.url !== 'string') return false
  try {
    const url = new URL(value.url)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  } catch {
    return false
  }
  if (typeof value.checkedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value.checkedAt)) return false
  const checkedAt = Date.parse(`${value.checkedAt}T00:00:00Z`)
  if (!Number.isFinite(checkedAt) || new Date(checkedAt).toISOString().slice(0, 10) !== value.checkedAt) return false
  return isUniqueTextArray(value.coversSourceItemIds, sourceItemIdPattern)
    && value.coversSourceItemIds.every((sourceItemId) => officialSourceItemIds.has(sourceItemId))
}

function isLessonBase(value) {
  const keys = [
    'lessonId', 'title', 'learningObjectives', 'declaredSectionIds', 'commonPrerequisites',
    'conditionalPrerequisites', 'optionalReviews', 'questionIds', 'sourceItemIds', 'sourceRefs', 'revision',
  ]
  return typeof value.lessonId === 'string' && idPattern.test(value.lessonId)
    && isText(value.title)
    && isArray(value.learningObjectives) && value.learningObjectives.length > 0 && value.learningObjectives.every(isText)
    && isUniqueTextArray(value.declaredSectionIds, idPattern)
    && isUniqueTextArray(value.commonPrerequisites, lessonRefPattern)
    && isArray(value.conditionalPrerequisites)
    && isArray(value.optionalReviews)
    && isArray(value.questionIds) && value.questionIds.length === 0
    && isUniqueTextArray(value.sourceItemIds, sourceItemIdPattern)
    && isUniqueTextArray(value.sourceRefs, idPattern)
    && isPositiveSafeInteger(value.revision)
    && keys.every((key) => Object.hasOwn(value, key))
}

function isLesson(value) {
  if (!isRecord(value) || !isLessonBase(value)) return false
  if (value.availability === 'planned') {
    return hasOnlyKeys(value, [
      'availability', 'lessonId', 'title', 'learningObjectives', 'declaredSectionIds',
      'commonPrerequisites', 'conditionalPrerequisites', 'optionalReviews', 'questionIds',
      'sourceItemIds', 'sourceRefs', 'revision',
    ])
  }
  if (value.availability === 'included') {
    return hasOnlyKeys(value, [
      'availability', 'lessonId', 'title', 'learningObjectives', 'declaredSectionIds',
      'commonPrerequisites', 'conditionalPrerequisites', 'optionalReviews', 'questionIds',
      'sourceItemIds', 'sourceRefs', 'revision', 'sections', 'figures',
    ])
      && hasKeys(value, ['sections', 'figures'])
      && value.declaredSectionIds.length > 0
      && isArray(value.sections)
      && value.sections.length > 0
      && value.sections.every(isSection)
      && value.sections.length === value.declaredSectionIds.length
      && value.sections.every((section, index) => section.sectionId === value.declaredSectionIds[index])
      && isArray(value.figures)
      && value.figures.every(isFigure)
      && new Set(value.figures.map((figure) => figure.figureId)).size === value.figures.length
  }
  return false
}

function resolveMetadataRef(reference, lessonsById) {
  const parsed = parseLessonRef(reference)
  if (!parsed) return null
  const lesson = lessonsById.get(parsed.lessonId)
  if (!lesson || (parsed.sectionId && !lesson.declaredSectionIds.includes(parsed.sectionId))) return null
  return { lesson, ...parsed }
}

function resolveBodyRef(reference, lessonsById) {
  const resolved = resolveMetadataRef(reference, lessonsById)
  if (!resolved || resolved.lesson.availability !== 'included') return null
  if (resolved.sectionId && !resolved.lesson.sections.some((section) => section.sectionId === resolved.sectionId)) return null
  return resolved
}

function isNoCycle(lessons, lessonsById) {
  const indegree = new Map(lessons.map((lesson) => [lesson.lessonId, 0]))
  const dependents = new Map(lessons.map((lesson) => [lesson.lessonId, new Set()]))
  for (const lesson of lessons) {
    const prerequisites = [
      ...lesson.commonPrerequisites,
      ...lesson.conditionalPrerequisites.map((item) => item.prerequisiteRef),
    ]
    for (const reference of prerequisites) {
      const dependencyId = parseLessonRef(reference).lessonId
      const adjacent = dependents.get(dependencyId)
      if (!adjacent.has(lesson.lessonId)) {
        adjacent.add(lesson.lessonId)
        indegree.set(lesson.lessonId, indegree.get(lesson.lessonId) + 1)
      }
    }
  }
  const ready = [...indegree].filter(([, count]) => count === 0).map(([lessonId]) => lessonId)
  let visited = 0
  while (ready.length) {
    const lessonId = ready.pop()
    visited += 1
    for (const dependentId of dependents.get(lessonId)) {
      const count = indegree.get(dependentId) - 1
      indegree.set(dependentId, count)
      if (count === 0) ready.push(dependentId)
    }
  }
  return visited === lessonsById.size
}

/** @param {unknown} value */
export function validateLessonRegistry(value) {
  if (!hasOnlyKeys(value, ['curriculumRevision', 'officialSourceItemIds', 'sources', 'lessons'])
    || !hasKeys(value, ['curriculumRevision', 'officialSourceItemIds', 'sources', 'lessons'])
    || !isPositiveSafeInteger(value.curriculumRevision)
    || !isUniqueTextArray(value.officialSourceItemIds, sourceItemIdPattern, { allowEmpty: false })
    || !isArray(value.sources)
    || !isArray(value.lessons)
    || value.lessons.length === 0) return false

  const officialSourceItemIds = new Set(value.officialSourceItemIds)
  const sourcesById = new Map()
  for (const source of value.sources) {
    if (!isSource(source, officialSourceItemIds) || sourcesById.has(source.sourceId)) return false
    sourcesById.set(source.sourceId, source)
  }

  const lessonsById = new Map()
  const conditionIds = new Set()
  const figureIds = new Set()
  for (const lesson of value.lessons) {
    if (!isLesson(lesson) || lessonsById.has(lesson.lessonId)) return false
    lessonsById.set(lesson.lessonId, lesson)
    for (const condition of lesson.conditionalPrerequisites) {
      if (!hasOnlyKeys(condition, ['conditionId', 'methodSectionRef', 'condition', 'prerequisiteRef'])
        || !hasKeys(condition, ['conditionId', 'methodSectionRef', 'condition', 'prerequisiteRef'])
        || typeof condition.conditionId !== 'string' || !idPattern.test(condition.conditionId)
        || conditionIds.has(condition.conditionId)
        || !isText(condition.condition)
        || !parseLessonRef(condition.methodSectionRef)?.sectionId
        || !parseLessonRef(condition.prerequisiteRef)) return false
      conditionIds.add(condition.conditionId)
    }
    for (const optionalReview of lesson.optionalReviews) {
      if (!hasOnlyKeys(optionalReview, ['fromRef', 'targetRef', 'context'])
        || !hasKeys(optionalReview, ['fromRef', 'targetRef', 'context'])
        || !parseLessonRef(optionalReview.fromRef)
        || !parseLessonRef(optionalReview.targetRef)
        || !isText(optionalReview.context)) return false
    }
    if (lesson.availability === 'included') {
      for (const figure of lesson.figures) {
        if (figureIds.has(figure.figureId)) return false
        figureIds.add(figure.figureId)
      }
    }
  }

  for (const lesson of value.lessons) {
    const sourceItemIds = new Set(lesson.sourceItemIds)
    if (lesson.sourceItemIds.some((sourceItemId) => !officialSourceItemIds.has(sourceItemId))) return false
    if (lesson.sourceItemIds.length > 0 && lesson.sourceRefs.length === 0) return false
    const lessonSources = []
    for (const sourceId of lesson.sourceRefs) {
      const source = sourcesById.get(sourceId)
      if (!source) return false
      if (sourceItemIds.size === 0 ? source.coversSourceItemIds.length !== 0
        : !source.coversSourceItemIds.some((sourceItemId) => sourceItemIds.has(sourceItemId))) return false
      lessonSources.push(source)
    }
    if (lesson.sourceItemIds.some((sourceItemId) => !lessonSources.some((source) => source.coversSourceItemIds.includes(sourceItemId)))) return false

    for (const reference of lesson.commonPrerequisites) {
      if (!resolveMetadataRef(reference, lessonsById)) return false
    }
    for (const condition of lesson.conditionalPrerequisites) {
      const methodSection = resolveMetadataRef(condition.methodSectionRef, lessonsById)
      if (!methodSection || methodSection.lesson.lessonId !== lesson.lessonId
        || !resolveMetadataRef(condition.prerequisiteRef, lessonsById)) return false
    }
    for (const optionalReview of lesson.optionalReviews) {
      const from = resolveMetadataRef(optionalReview.fromRef, lessonsById)
      if (!from || from.lesson.lessonId !== lesson.lessonId
        || !resolveMetadataRef(optionalReview.targetRef, lessonsById)) return false
    }

    if (lesson.availability === 'included') {
      const localFigureIds = new Set(lesson.figures.map((figure) => figure.figureId))
      for (const section of lesson.sections) {
        for (const block of section.blocks) {
          const references = block.kind === 'lessonRef' ? [block.targetRef]
            : block.kind === 'paragraph' ? block.parts.filter((part) => part.kind === 'lessonRef').map((part) => part.targetRef)
              : block.kind === 'formula' ? block.parts.filter((part) => part.kind === 'mathSymbol' && part.lessonRef).map((part) => part.lessonRef.targetRef)
                : []
          if (references.some((reference) => !resolveBodyRef(reference, lessonsById))) return false
          if (block.kind === 'figureRef' && !localFigureIds.has(block.figureId)) return false
        }
      }
    }
  }

  return isNoCycle(value.lessons, lessonsById)
}
