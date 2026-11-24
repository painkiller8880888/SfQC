import { isValidDecimalAnswer } from './question-grading.mjs'

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
const figureIdPattern = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/u
const sourceItemIdPattern = /^SRC-\d{4}$/u
const rendererRefPattern = /^code:[a-z0-9]+(?:-[a-z0-9]+)*$/u
const lessonRefPattern = /^([a-z0-9]+(?:-[a-z0-9]+)*)(?:#([a-z0-9]+(?:-[a-z0-9]+)*))?$/u

export const lessonDomains = Object.freeze({
  'math-foundations': '数学の基礎',
  'data-description': 'データ・記述統計',
  'probability-distributions': '確率・確率分布',
  'statistical-analysis': '統計分析・推測',
  'quality-methods': '品質管理手法',
})

export const lessonDomainColors = Object.freeze({
  'math-foundations': '#2563eb',
  'data-description': '#0f766e',
  'probability-distributions': '#7c3aed',
  'statistical-analysis': '#b45309',
  'quality-methods': '#be123c',
})

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

export function parseLessonRef(value) {
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
  if (value.kind === 'heading') return hasOnlyKeys(value, ['kind', 'level', 'text'])
    && hasKeys(value, ['kind', 'level', 'text']) && value.level === 3 && isText(value.text)
  if (value.kind === 'table') return hasOnlyKeys(value, ['kind', 'caption', 'columns', 'rows'])
    && hasKeys(value, ['kind', 'caption', 'columns', 'rows']) && isText(value.caption)
    && isArray(value.columns) && value.columns.length >= 2 && value.columns.every(isText)
    && isArray(value.rows) && value.rows.length > 0 && value.rows.every((row) =>
      isArray(row) && row.length === value.columns.length && row.every(isText))
  if (value.kind === 'details') return hasOnlyKeys(value, ['kind', 'summary', 'blocks'])
    && hasKeys(value, ['kind', 'summary', 'blocks']) && isText(value.summary)
    && isArray(value.blocks) && value.blocks.length > 0 && value.blocks.every(isBodyBlock)
  if (value.kind === 'exerciseSlot') return hasOnlyKeys(value, ['kind', 'exerciseId'])
    && hasKeys(value, ['kind', 'exerciseId']) && typeof value.exerciseId === 'string' && idPattern.test(value.exerciseId)
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
  const baseKeys = ['kind', 'figureId', 'rendererRef', 'educationalPurpose', 'legend', 'altText']
  if (!isRecord(value) || !hasKeys(value, baseKeys)) return false
  if (typeof value.figureId !== 'string' || !figureIdPattern.test(value.figureId)
    || typeof value.rendererRef !== 'string' || !rendererRefPattern.test(value.rendererRef)
    || !isText(value.educationalPurpose) || !isText(value.altText)) return false
  if (!isArray(value.legend) || !value.legend.every((item) => {
    return hasOnlyKeys(item, ['label', 'meaning']) && hasKeys(item, ['label', 'meaning'])
      && isText(item.label) && isText(item.meaning)
  })) return false
  if (value.kind === 'diagram') return hasOnlyKeys(value, baseKeys)
  if (value.kind !== 'cartesian'
    || !hasOnlyKeys(value, [...baseKeys, 'variables', 'axes'])) return false
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
  return true
}

function isCourseReference(value) {
  if (!hasOnlyKeys(value, ['title', 'url', 'details']) || !hasKeys(value, ['title', 'url', 'details'])
    || !isText(value.title) || !isText(value.details) || typeof value.url !== 'string') return false
  try { return new URL(value.url).protocol === 'https:' } catch { return false }
}

function isSource(value, officialSourceItemIds) {
  if (!hasOnlyKeys(value, ['sourceId', 'title', 'url', 'version', 'checkedAt', 'purpose', 'citations'])
    || !hasKeys(value, ['sourceId', 'title', 'url', 'version', 'checkedAt', 'purpose', 'citations'])) return false
  if (typeof value.sourceId !== 'string' || !idPattern.test(value.sourceId)
    || ![value.title, value.version, value.purpose].every(isText)) return false
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
  if (!isArray(value.citations) || value.citations.length === 0) return false
  const citationKeys = new Set()
  return value.citations.every((citation) => {
    if (!hasOnlyKeys(citation, ['sourceItemId', 'location']) || !hasKeys(citation, ['sourceItemId', 'location'])
      || typeof citation.sourceItemId !== 'string' || !sourceItemIdPattern.test(citation.sourceItemId)
      || !officialSourceItemIds.has(citation.sourceItemId) || !isText(citation.location)) return false
    const key = `${citation.sourceItemId}\u0000${citation.location}`
    if (citationKeys.has(key)) return false
    citationKeys.add(key)
    return true
  })
}

function isLessonBase(value) {
  const keys = [
    'lessonId', 'title', 'domain', 'learningObjectives', 'declaredSectionIds', 'commonPrerequisites',
    'conditionalPrerequisites', 'optionalReviews', 'sourceItemIds', 'sourceRefs', 'revision',
  ]
  return typeof value.lessonId === 'string' && idPattern.test(value.lessonId)
    && isText(value.title)
    && typeof value.domain === 'string' && Object.hasOwn(lessonDomains, value.domain)
    && isArray(value.learningObjectives) && value.learningObjectives.length > 0 && value.learningObjectives.every(isText)
    && isUniqueTextArray(value.declaredSectionIds, idPattern)
    && isUniqueTextArray(value.commonPrerequisites, lessonRefPattern)
    && isArray(value.conditionalPrerequisites)
    && isArray(value.optionalReviews)
    && isUniqueTextArray(value.sourceItemIds, sourceItemIdPattern)
    && isUniqueTextArray(value.sourceRefs, idPattern)
    && isPositiveSafeInteger(value.revision)
    && keys.every((key) => Object.hasOwn(value, key))
}

function isLesson(value) {
  if (!isRecord(value) || !isLessonBase(value)) return false
  if (value.availability === 'planned') {
    return hasOnlyKeys(value, [
      'availability', 'lessonId', 'title', 'domain', 'learningObjectives', 'declaredSectionIds',
      'commonPrerequisites', 'conditionalPrerequisites', 'optionalReviews',
      'sourceItemIds', 'sourceRefs', 'revision',
    ])
  }
  if (value.availability === 'included') {
    const optionalKeys = ['overview', 'references', 'credit']
    return hasOnlyKeys(value, [
      'availability', 'lessonId', 'title', 'domain', 'learningObjectives', 'declaredSectionIds',
      'commonPrerequisites', 'conditionalPrerequisites', 'optionalReviews',
      'sourceItemIds', 'sourceRefs', 'revision', 'sections', 'figures', ...optionalKeys,
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
      && (!Object.hasOwn(value, 'overview') || isArray(value.overview) && value.overview.every(isBodyBlock))
      && (!Object.hasOwn(value, 'references') || isArray(value.references) && value.references.every(isCourseReference))
      && (!Object.hasOwn(value, 'credit') || isText(value.credit))
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

function visitBodyBlocks(blocks, visit) {
  for (const block of blocks) {
    visit(block)
    if (block.kind === 'details') visitBodyBlocks(block.blocks, visit)
  }
}

function isNonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0)
}

function isExerciseQuestion(value, path, lessonsById, errors) {
  if (!hasOnlyKeys(value, ['display', 'evaluation', 'solution'])
    || !hasKeys(value, ['display', 'evaluation', 'solution'])) {
    errors.push(`${path} must contain display, evaluation, and solution data`)
    return false
  }

  const { display, evaluation, solution } = value
  let valid = true
  if (!isRecord(display) || !hasOnlyKeys(display, [
    'prompt', 'response', 'table', 'calculations', 'reviewSectionRefs',
  ]) || !hasKeys(display, ['prompt', 'response', 'reviewSectionRefs']) || !isText(display.prompt)) {
    errors.push(`${path}.display is invalid`)
    return false
  }
  if (!isUniqueTextArray(display.reviewSectionRefs, lessonRefPattern)
    || display.reviewSectionRefs.some((reference) => {
      const resolved = resolveBodyRef(reference, lessonsById)
      return !resolved?.sectionId
    })) {
    errors.push(`${path}.display.reviewSectionRefs must resolve to included lesson sections`)
    valid = false
  }
  if (Object.hasOwn(display, 'calculations')
    && (!isArray(display.calculations) || display.calculations.length === 0 || !display.calculations.every(isText))) {
    errors.push(`${path}.display.calculations must contain non-empty text`)
    valid = false
  }
  if (Object.hasOwn(display, 'table')) {
    const table = display.table
    if (!hasOnlyKeys(table, ['caption', 'rowHeaderLabel', 'columnLabels', 'rows']) || !hasKeys(table, ['rows'])
      || (Object.hasOwn(table, 'caption') && !isText(table.caption))
      || (Object.hasOwn(table, 'rowHeaderLabel') && !isText(table.rowHeaderLabel))
      || (Object.hasOwn(table, 'columnLabels') && (!isArray(table.columnLabels) || !table.columnLabels.every(isText)
        || !isArray(table.rows) || table.rows.some((row) => !isRecord(row) || !isArray(row.values)
          || row.values.length !== table.columnLabels.length)))
      || !isArray(table.rows) || table.rows.length === 0
      || !table.rows.every((row) => hasOnlyKeys(row, ['label', 'values']) && hasKeys(row, ['label', 'values'])
        && isText(row.label) && isArray(row.values) && row.values.length > 0
        && row.values.every((cell) => isText(cell) || Number.isFinite(cell)))
      || table.rows.some((row) => row.values.length !== table.rows[0]?.values.length)) {
      errors.push(`${path}.display.table is invalid`)
      valid = false
    }
  }

  const response = display.response
  if (!isRecord(response) || !isRecord(evaluation) || !isRecord(solution)) {
    errors.push(`${path}.display.response is invalid`)
    return false
  }

  if (response.type === 'numeric') {
    if (!hasOnlyKeys(response, ['type', 'fields']) || !hasKeys(response, ['type', 'fields'])
      || !isArray(response.fields) || response.fields.length === 0) {
      errors.push(`${path}.display.response.fields must contain numeric fields`)
      return false
    }
    const fieldIds = new Set()
    for (const [index, field] of response.fields.entries()) {
      if (!isRecord(field) || !hasOnlyKeys(field, ['id', 'label', 'unit', 'roundingDigits', 'roundingInstruction'])
        || !hasKeys(field, ['id', 'label', 'unit', 'roundingDigits'])
        || typeof field.id !== 'string' || !idPattern.test(field.id) || fieldIds.has(field.id)
        || !isText(field.label) || typeof field.unit !== 'string'
        || !isNonNegativeSafeInteger(field.roundingDigits)
        || (Object.hasOwn(field, 'roundingInstruction') && !isText(field.roundingInstruction))) {
        errors.push(`${path}.display.response.fields[${index}] is invalid or duplicated`)
        valid = false
        continue
      }
      fieldIds.add(field.id)
    }
    if (!hasOnlyKeys(evaluation, ['type', 'answers']) || !hasKeys(evaluation, ['type', 'answers'])
      || evaluation.type !== 'numeric' || !isArray(evaluation.answers)
      || evaluation.answers.length !== response.fields.length) {
      errors.push(`${path}.evaluation.answers must match the numeric fields`)
      valid = false
    } else {
      for (const [index, answer] of evaluation.answers.entries()) {
        const field = response.fields[index]
        if (!isRecord(field)) {
          errors.push(`${path}.evaluation.answers[${index}] has no matching numeric field`)
          valid = false
          continue
        }
        if (!hasOnlyKeys(answer, ['fieldId', 'expected', 'roundingDigits'])
          || !hasKeys(answer, ['fieldId', 'expected', 'roundingDigits'])
          || answer.fieldId !== field.id || !isValidDecimalAnswer(answer.expected)
          || !isNonNegativeSafeInteger(answer.roundingDigits)
          || answer.roundingDigits !== field.roundingDigits) {
          errors.push(`${path}.evaluation.answers[${index}] does not match its numeric field or decimal grading rule`)
          valid = false
        }
      }
    }
  } else if (response.type === 'choice') {
    if (!hasOnlyKeys(response, ['type', 'choices']) || !hasKeys(response, ['type', 'choices'])
      || !isArray(response.choices) || response.choices.length < 2) {
      errors.push(`${path}.display.response.choices must contain at least two options`)
      return false
    }
    const choiceIds = new Set()
    const choiceTexts = new Set()
    for (const [index, choice] of response.choices.entries()) {
      if (!isRecord(choice) || !hasOnlyKeys(choice, ['id', 'text']) || !hasKeys(choice, ['id', 'text'])
        || typeof choice.id !== 'string' || !idPattern.test(choice.id) || choiceIds.has(choice.id)
        || !isText(choice.text) || choiceTexts.has(choice.text)) {
        errors.push(`${path}.display.response.choices[${index}] is invalid or duplicated`)
        valid = false
        continue
      }
      choiceIds.add(choice.id)
      choiceTexts.add(choice.text)
    }
    if (!hasOnlyKeys(evaluation, ['type', 'correctChoiceId']) || !hasKeys(evaluation, ['type', 'correctChoiceId'])
      || evaluation.type !== 'choice' || !choiceIds.has(evaluation.correctChoiceId)) {
      errors.push(`${path}.evaluation.correctChoiceId must resolve to a displayed choice`)
      valid = false
    }
    if (!hasOnlyKeys(solution, ['explanation', 'steps', 'choiceFeedback']) || !hasKeys(solution, ['explanation'])) {
      errors.push(`${path}.solution is invalid`)
      return false
    }
    if (Object.hasOwn(solution, 'choiceFeedback')) {
      if (!isArray(solution.choiceFeedback)) {
        errors.push(`${path}.solution.choiceFeedback must be an array`)
        valid = false
      } else {
        const feedbackIds = new Set()
        for (const [index, feedback] of solution.choiceFeedback.entries()) {
          if (!hasOnlyKeys(feedback, ['choiceId', 'misconception', 'reviewSectionRefs'])
            || !hasKeys(feedback, ['choiceId', 'misconception'])
            || !choiceIds.has(feedback.choiceId) || feedback.choiceId === evaluation.correctChoiceId
            || feedbackIds.has(feedback.choiceId) || !isText(feedback.misconception)
            || (Object.hasOwn(feedback, 'reviewSectionRefs')
              && (!isUniqueTextArray(feedback.reviewSectionRefs, lessonRefPattern)
                || feedback.reviewSectionRefs.some((reference) => {
                  const resolved = resolveBodyRef(reference, lessonsById)
                  return !resolved?.sectionId
                })))) {
            errors.push(`${path}.solution.choiceFeedback[${index}] is invalid`)
            valid = false
            continue
          }
          feedbackIds.add(feedback.choiceId)
        }
      }
    }
  } else {
    errors.push(`${path}.display.response.type must be numeric or choice`)
    return false
  }

  if (response.type === 'numeric'
    && (!hasOnlyKeys(solution, ['explanation', 'steps']) || !hasKeys(solution, ['explanation']))) {
    errors.push(`${path}.solution is invalid`)
    valid = false
  }
  if (!isText(solution.explanation)
    || (Object.hasOwn(solution, 'steps') && (!isArray(solution.steps) || !solution.steps.every(isText)))) {
    errors.push(`${path}.solution explanation or steps are invalid`)
    valid = false
  }
  return valid
}

function collectExerciseCatalogErrors(value, lessons) {
  const errors = []
  if (!hasOnlyKeys(value, ['categories', 'generators', 'definitions'])
    || !hasKeys(value, ['categories', 'generators', 'definitions'])
    || !isArray(value.categories) || !isArray(value.generators) || !isArray(value.definitions)) {
    return ['exerciseCatalog must contain categories, generators, and definitions arrays']
  }

  const validLessons = lessons.filter(isLesson)
  if (validLessons.length !== lessons.length) errors.push('lessons contains an invalid lesson definition')
  const lessonsById = new Map(validLessons.map((lesson) => [lesson.lessonId, lesson]))
  const categoriesById = new Map()
  for (const [index, category] of value.categories.entries()) {
    const path = `exerciseCatalog.categories[${index}]`
    if (!hasOnlyKeys(category, ['lessonId', 'categoryId', 'title', 'exerciseIds'])
      || !hasKeys(category, ['lessonId', 'categoryId', 'title', 'exerciseIds'])
      || typeof category.lessonId !== 'string' || !idPattern.test(category.lessonId)
      || typeof category.categoryId !== 'string' || !idPattern.test(category.categoryId)
      || !isText(category.title) || !isUniqueTextArray(category.exerciseIds, idPattern, { allowEmpty: false })) {
      errors.push(`${path} is invalid`)
      continue
    }
    const key = `${category.lessonId}:${category.categoryId}`
    if (categoriesById.has(key)) errors.push(`${path} duplicates category ${key}`)
    categoriesById.set(key, category)
    if (!lessonsById.has(category.lessonId)) errors.push(`${path}.lessonId does not resolve`)
  }

  const generatorTypes = new Map()
  for (const [index, generator] of value.generators.entries()) {
    const path = `exerciseCatalog.generators[${index}]`
    if (!hasOnlyKeys(generator, ['generatorId', 'types']) || !hasKeys(generator, ['generatorId', 'types'])
      || typeof generator.generatorId !== 'string' || !idPattern.test(generator.generatorId)
      || !isArray(generator.types) || generator.types.length === 0) {
      errors.push(`${path} is invalid`)
      continue
    }
    const types = new Map()
    for (const [typeIndex, type] of generator.types.entries()) {
      if (!hasOnlyKeys(type, ['typeId', 'mode', 'minimum', 'maximum'])
        || !hasKeys(type, ['typeId', 'mode', 'minimum', 'maximum'])
        || typeof type.typeId !== 'string' || !idPattern.test(type.typeId)
        || !['index', 'seed'].includes(type.mode)
        || !isNonNegativeSafeInteger(type.minimum) || !isNonNegativeSafeInteger(type.maximum)
        || type.minimum > type.maximum || types.has(type.typeId)
        || (type.mode === 'seed' && type.maximum > 0xffffffff)) {
        errors.push(`${path}.types[${typeIndex}] is invalid or duplicated`)
        continue
      }
      types.set(type.typeId, type)
    }
    if (generatorTypes.has(generator.generatorId)) errors.push(`${path} duplicates generator ${generator.generatorId}`)
    generatorTypes.set(generator.generatorId, types)
  }

  const definitionsById = new Map()
  for (const [index, definition] of value.definitions.entries()) {
    const path = `exerciseCatalog.definitions[${index}]`
    if (!hasOnlyKeys(definition, ['lessonId', 'exerciseId', 'revision', 'placement', 'generation'])
      || !hasKeys(definition, ['lessonId', 'exerciseId', 'revision', 'placement', 'generation'])
      || typeof definition.lessonId !== 'string' || !idPattern.test(definition.lessonId)
      || typeof definition.exerciseId !== 'string' || !idPattern.test(definition.exerciseId)
      || !isPositiveSafeInteger(definition.revision) || !isRecord(definition.placement)
      || !isRecord(definition.generation)) {
      errors.push(`${path} is invalid`)
      continue
    }
    const exercisePath = `${path} (${definition.lessonId}:${definition.exerciseId})`
    const definitionId = `${definition.lessonId}:${definition.exerciseId}`
    if (!lessonsById.has(definition.lessonId)) errors.push(`${path}.lessonId does not resolve`)
    if (definitionsById.has(definitionId)) errors.push(`${path} duplicates definition ${definitionId}`)
    definitionsById.set(definitionId, definition)

    const placement = definition.placement
    if (placement.kind === 'section') {
      if (!hasOnlyKeys(placement, ['kind', 'sectionId']) || !hasKeys(placement, ['kind', 'sectionId'])
        || typeof placement.sectionId !== 'string' || !idPattern.test(placement.sectionId)
        || lessonsById.get(definition.lessonId)?.availability !== 'included'
        || !lessonsById.get(definition.lessonId)?.sections.some((section) => section.sectionId === placement.sectionId)) {
        errors.push(`${exercisePath}.placement does not resolve to an included lesson section`)
      }
    } else if (placement.kind === 'category') {
      if (!hasOnlyKeys(placement, ['kind', 'categoryId']) || !hasKeys(placement, ['kind', 'categoryId'])
        || typeof placement.categoryId !== 'string' || !idPattern.test(placement.categoryId)
        || !categoriesById.has(`${definition.lessonId}:${placement.categoryId}`)) {
        errors.push(`${exercisePath}.placement does not resolve to an exercise category`)
      }
    } else errors.push(`${exercisePath}.placement.kind must be section or category`)

    const generation = definition.generation
    if (generation.kind === 'fixed') {
      if (!hasOnlyKeys(generation, ['kind', 'question']) || !hasKeys(generation, ['kind', 'question'])) {
        errors.push(`${exercisePath}.generation is invalid`)
      } else isExerciseQuestion(generation.question, `${exercisePath}.question`, lessonsById, errors)
    } else if (generation.kind === 'index' || generation.kind === 'seed') {
      if (!hasOnlyKeys(generation, ['kind', 'generatorId', 'typeId', 'minimum', 'maximum'])
        || !hasKeys(generation, ['kind', 'generatorId', 'typeId', 'minimum', 'maximum'])
        || typeof generation.generatorId !== 'string' || !idPattern.test(generation.generatorId)
        || typeof generation.typeId !== 'string' || !idPattern.test(generation.typeId)
        || !isNonNegativeSafeInteger(generation.minimum) || !isNonNegativeSafeInteger(generation.maximum)
        || generation.minimum > generation.maximum
        || (generation.kind === 'seed' && generation.maximum > 0xffffffff)) {
        errors.push(`${exercisePath}.generation input range is invalid`)
      } else {
        const generatorType = generatorTypes.get(generation.generatorId)?.get(generation.typeId)
        if (!generatorType || generatorType.mode !== generation.kind
          || generation.minimum < generatorType.minimum || generation.maximum > generatorType.maximum) {
          errors.push(`${exercisePath}.generation does not match a registered generator type and range`)
        }
      }
    } else errors.push(`${exercisePath}.generation.kind must be fixed, index, or seed`)
  }

  const categoryExerciseIds = new Set()
  for (const [index, category] of value.categories.entries()) {
    const path = `exerciseCatalog.categories[${index}]`
    if (!isRecord(category) || !isArray(category.exerciseIds)) continue
    for (const exerciseId of category.exerciseIds) {
      const definition = definitionsById.get(`${category.lessonId}:${exerciseId}`)
      const key = `${category.lessonId}:${category.categoryId}:${exerciseId}`
      if (!definition || definition.placement?.kind !== 'category' || definition.placement.categoryId !== category.categoryId) {
        errors.push(`${path}.exerciseIds references a definition outside the category: ${exerciseId}`)
      }
      if (categoryExerciseIds.has(key)) errors.push(`${path}.exerciseIds duplicates ${exerciseId}`)
      categoryExerciseIds.add(key)
    }
  }
  for (const definition of value.definitions) {
    if (definition?.placement?.kind === 'category'
      && !categoryExerciseIds.has(`${definition.lessonId}:${definition.placement.categoryId}:${definition.exerciseId}`)) {
      errors.push(`exerciseCatalog.definitions ${definition.lessonId}:${definition.exerciseId} is not listed in its category`)
    }
  }
  return errors
}

export function getExerciseCatalogErrors(catalog, lessons) {
  if (!isArray(lessons)) return ['lessons must be an array']
  return collectExerciseCatalogErrors(catalog, lessons)
}

function exerciseSlotsMatchCatalog(lessons, catalog) {
  const definitions = new Map((catalog?.definitions ?? []).map((definition) => [
    `${definition.lessonId}:${definition.exerciseId}`, definition,
  ]))
  const slotCounts = new Map()
  for (const lesson of lessons) {
    if (lesson.availability !== 'included') continue
    let overviewHasSlot = false
    visitBodyBlocks(lesson.overview ?? [], (block) => {
      if (block.kind === 'exerciseSlot') overviewHasSlot = true
    })
    if (overviewHasSlot) return false
    for (const section of lesson.sections) {
      let valid = true
      visitBodyBlocks(section.blocks, (block) => {
        if (block.kind !== 'exerciseSlot') return
        const key = `${lesson.lessonId}:${block.exerciseId}`
        const definition = definitions.get(key)
        if (!definition || definition.placement.kind !== 'section' || definition.placement.sectionId !== section.sectionId) {
          valid = false
          return
        }
        slotCounts.set(key, (slotCounts.get(key) ?? 0) + 1)
      })
      if (!valid) return false
    }
  }
  for (const [key, definition] of definitions) {
    if (definition.placement.kind === 'section' && slotCounts.get(key) !== 1) return false
  }
  return true
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

const exerciseInstances = new WeakMap()

export function exerciseDefinitionId(lessonId, exerciseId) {
  if (typeof lessonId !== 'string' || !idPattern.test(lessonId)
    || typeof exerciseId !== 'string' || !idPattern.test(exerciseId)) {
    throw new TypeError('Invalid lesson or exercise ID')
  }
  return `${lessonId}:${exerciseId}`
}

export function generateExerciseInstance(registry, lessonId, exerciseId, input, generators = {}) {
  const definitionId = exerciseDefinitionId(lessonId, exerciseId)
  if (!isRecord(registry) || !isArray(registry.lessons) || !isRecord(registry.exerciseCatalog)
    || !isArray(registry.exerciseCatalog.definitions) || !isArray(registry.exerciseCatalog.generators)) {
    throw new TypeError('Invalid lesson registry')
  }
  const definition = registry.exerciseCatalog.definitions.find((item) => isRecord(item)
    && item.lessonId === lessonId && item.exerciseId === exerciseId)
  if (!definition || !isRecord(definition.generation) || !isPositiveSafeInteger(definition.revision)
    || !registry.lessons.some((lesson) => isRecord(lesson) && lesson.lessonId === lessonId)) {
    throw new TypeError(`Unknown or invalid exercise definition: ${definitionId}`)
  }

  let question
  let mode
  if (definition.generation.kind === 'fixed') {
    if (input !== undefined) throw new RangeError(`${definitionId} is fixed and accepts no input`)
    mode = 'fixed'
    question = definition.generation.question
  } else {
    const generation = definition.generation
    const registeredGenerator = registry.exerciseCatalog.generators.find((item) => isRecord(item)
      && item.generatorId === generation.generatorId)
    const generatorType = isRecord(registeredGenerator) && isArray(registeredGenerator.types)
      ? registeredGenerator.types.find((item) => isRecord(item) && item.typeId === generation.typeId) : null
    if (!['index', 'seed'].includes(generation.kind)
      || typeof generation.generatorId !== 'string' || !idPattern.test(generation.generatorId)
      || typeof generation.typeId !== 'string' || !idPattern.test(generation.typeId)
      || !isNonNegativeSafeInteger(generation.minimum) || !isNonNegativeSafeInteger(generation.maximum)
      || generation.minimum > generation.maximum
      || (generation.kind === 'seed' && generation.maximum > 0xffffffff)
      || !generatorType || !['index', 'seed'].includes(generatorType.mode)
      || !isNonNegativeSafeInteger(generatorType.minimum) || !isNonNegativeSafeInteger(generatorType.maximum)
      || generatorType.minimum > generatorType.maximum || generatorType.mode !== generation.kind
      || generation.minimum < generatorType.minimum || generation.maximum > generatorType.maximum) {
      throw new TypeError(`Invalid exercise generator definition: ${definitionId}`)
    }
    if (!isNonNegativeSafeInteger(input) || input < generation.minimum || input > generation.maximum) {
      throw new RangeError(`${definitionId} input must be an integer from ${generation.minimum} to ${generation.maximum}`)
    }
    const generator = generators?.[generation.generatorId]
    if (typeof generator !== 'function') throw new TypeError(`Unknown exercise generator: ${generation.generatorId}`)
    mode = generation.kind
    question = generator(definition, input)
  }

  const lessonIds = new Map(registry.lessons.filter(isLesson).map((lesson) => [lesson.lessonId, lesson]))
  const errors = []
  if (!isExerciseQuestion(question, definitionId, lessonIds, errors)) {
    throw new TypeError(`Invalid generated exercise ${definitionId}: ${errors.join(', ')}`)
  }
  const instance = Object.freeze({
    definitionId,
    instanceId: `${definitionId}@${definition.revision}:${mode}${input === undefined ? '' : `:${input}`}`,
    lessonId,
    exerciseId,
    revision: definition.revision,
    mode,
    input: input ?? null,
  })
  exerciseInstances.set(instance, question)
  return instance
}

function getExerciseInstanceQuestion(instance) {
  const question = exerciseInstances.get(instance)
  if (!question) throw new TypeError('Unknown exercise instance')
  return question
}

export function getExerciseQuestionDisplay(instance) {
  const display = getExerciseInstanceQuestion(instance).display
  return {
    prompt: display.prompt,
    response: structuredClone(display.response),
    ...(display.table ? { table: structuredClone(display.table) } : {}),
    ...(display.calculations ? { calculations: [...display.calculations] } : {}),
    reviewSectionRefs: [...display.reviewSectionRefs],
  }
}

export function getExerciseGradingData(instance) {
  const question = getExerciseInstanceQuestion(instance)
  return {
    evaluation: structuredClone(question.evaluation),
    solution: structuredClone(question.solution),
  }
}

/** @param {unknown} value */
export function validateLessonRegistry(value) {
  if (!hasOnlyKeys(value, ['curriculumRevision', 'officialSourceItemIds', 'sources', 'lessons', 'exerciseCatalog'])
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
    const relevantSources = [...sourcesById.values()]
      .filter((source) => source.citations.some((citation) => sourceItemIds.has(citation.sourceItemId)))
    const relevantSourceIds = relevantSources.map((source) => source.sourceId)
    if (lesson.sourceRefs.length !== relevantSourceIds.length
      || relevantSourceIds.some((sourceId) => !lesson.sourceRefs.includes(sourceId))
      || lesson.sourceItemIds.some((sourceItemId) => !relevantSources.some((source) =>
      source.citations.some((citation) => citation.sourceItemId === sourceItemId)))) return false

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
      const blocks = [
        ...(lesson.overview ?? []),
        ...lesson.sections.flatMap((section) => section.blocks),
      ]
      let valid = true
      visitBodyBlocks(blocks, (block) => {
        const references = block.kind === 'lessonRef' ? [block.targetRef]
          : block.kind === 'paragraph' ? block.parts.filter((part) => part.kind === 'lessonRef').map((part) => part.targetRef)
            : block.kind === 'formula' ? block.parts.filter((part) => part.kind === 'mathSymbol' && part.lessonRef).map((part) => part.lessonRef.targetRef)
              : []
        if (references.some((reference) => !resolveBodyRef(reference, lessonsById))) valid = false
        if (block.kind === 'figureRef' && !localFigureIds.has(block.figureId)) valid = false
      })
      if (!valid) return false
    }
  }

  if (Object.hasOwn(value, 'exerciseCatalog')
    && getExerciseCatalogErrors(value.exerciseCatalog, value.lessons).length > 0) return false
  if (!exerciseSlotsMatchCatalog(value.lessons, value.exerciseCatalog)) return false
  return isNoCycle(value.lessons, lessonsById)
}
