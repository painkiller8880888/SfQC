const questionIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
const choiceIdPattern = /^[A-Za-z0-9_-]+$/u
const decimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u
const difficultyValues = new Set(['基礎', '標準', '応用'])

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

function isQuestionId(value) {
  return typeof value === 'string' && questionIdPattern.test(value)
}

function isLessonRef(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*#[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0 && !Object.is(value, -0)
}

function isNonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0)
}

function isDecimal(value) {
  return typeof value === 'string' && decimalPattern.test(value)
}

function isNonNegativeDecimal(value) {
  return isDecimal(value) && !value.startsWith('-')
}

function isDecimalZero(value) {
  return /^-?0(?:\.0+)?$/u.test(value)
}

function isParameterRecord(value) {
  return isRecord(value) && Reflect.ownKeys(value).every((key) => {
    if (!questionIdPattern.test(key)) return false
    const parameter = value[key]
    return (Number.isSafeInteger(parameter) && !Object.is(parameter, -0)) || isDecimal(parameter)
  })
}

function isLessonRefs(value) {
  return isArray(value) && value.length > 0 && value.every(isLessonRef)
}

function isSources(value) {
  return isArray(value) && value.every((source) => {
    if (!hasOnlyKeys(source, ['title', 'url', 'version', 'checkedAt', 'location', 'purpose'])) return false
    if (!hasKeys(source, ['title', 'url', 'version', 'checkedAt', 'location', 'purpose'])) return false
    if (![source.title, source.version, source.checkedAt, source.location, source.purpose].every(isText)) return false
    if (typeof source.url !== 'string') return false
    try {
      const url = new URL(source.url)
      return url.protocol === 'https:' || url.protocol === 'http:'
    } catch {
      return false
    }
  })
}

function isDifficulty(value) {
  return difficultyValues.has(value)
}

function isUniqueChoiceSet(choices, labelField) {
  if (!isArray(choices) || choices.length < 2) return false
  const ids = new Set()
  const labels = new Set()
  for (const choice of choices) {
    if (!hasOnlyKeys(choice, ['id', labelField]) || !hasKeys(choice, ['id', labelField])) return false
    if (typeof choice.id !== 'string' || !choiceIdPattern.test(choice.id) || ids.has(choice.id)) return false
    if (!isText(choice[labelField])) return false
    const label = choice[labelField].trim().replace(/\s+/gu, ' ')
    if (!label || labels.has(label)) return false
    ids.add(choice.id)
    labels.add(label)
  }
  return true
}

function isSingleChoiceFeedbackRules(value, choiceIds, textField) {
  return isArray(value) && value.length > 0 && value.every((rule) => {
    if (!hasOnlyKeys(rule, ['choiceId', textField, 'lessonRef'])) return false
    return hasKeys(rule, ['choiceId', textField, 'lessonRef'])
      && choiceIds.has(rule.choiceId)
      && isText(rule[textField])
      && isLessonRef(rule.lessonRef)
  })
}

function isNumericFeedbackRules(value, textField, answerField = 'answer', answerCheck = isDecimal) {
  return isArray(value) && value.length > 0 && value.every((rule) => {
    if (!hasOnlyKeys(rule, [answerField, textField, 'lessonRef'])) return false
    return hasKeys(rule, [answerField, textField, 'lessonRef'])
      && answerCheck(rule[answerField])
      && isText(rule[textField])
      && isLessonRef(rule.lessonRef)
  })
}

function isNumericGrading(value) {
  const keys = ['type', 'unit', 'roundingDigits', 'absoluteTolerance', 'relativeTolerance']
  if (!hasOnlyKeys(value, keys) || !hasKeys(value, ['type', 'unit', 'roundingDigits'])) return false
  if (value.type !== 'numeric' || !isText(value.unit) || !isNonNegativeSafeInteger(value.roundingDigits)) return false
  const hasAbsolute = Object.hasOwn(value, 'absoluteTolerance')
  const hasRelative = Object.hasOwn(value, 'relativeTolerance')
  return (hasAbsolute || hasRelative)
    && (!hasAbsolute || isNonNegativeDecimal(value.absoluteTolerance))
    && (!hasRelative || isNonNegativeDecimal(value.relativeTolerance))
}

function isQuestionContent(value) {
  if (!isRecord(value) || !isText(value.prompt) || !isText(value.conditions)
    || !isParameterRecord(value.parameters) || !isText(value.solution)
    || !isText(value.defaultFeedback)) return false

  if (value.format === 'single-choice') {
    if (!hasOnlyKeys(value, ['format', 'prompt', 'conditions', 'parameters', 'choices', 'correctAnswer', 'grading', 'solution', 'feedbackRules', 'defaultFeedback'])) return false
    if (!hasKeys(value, ['format', 'prompt', 'conditions', 'parameters', 'choices', 'correctAnswer', 'grading', 'solution', 'feedbackRules', 'defaultFeedback'])) return false
    if (!isUniqueChoiceSet(value.choices, 'label')) return false
    const choiceIds = new Set(value.choices.map((choice) => choice.id))
    return typeof value.correctAnswer === 'string'
      && choiceIds.has(value.correctAnswer)
      && hasOnlyKeys(value.grading, ['type'])
      && hasKeys(value.grading, ['type'])
      && value.grading.type === 'single-choice'
      && isSingleChoiceFeedbackRules(value.feedbackRules, choiceIds, 'explanation')
  }

  if (value.format === 'numeric') {
    if (!hasOnlyKeys(value, ['format', 'prompt', 'conditions', 'parameters', 'correctAnswer', 'grading', 'solution', 'feedbackRules', 'defaultFeedback'])) return false
    if (!hasKeys(value, ['format', 'prompt', 'conditions', 'parameters', 'correctAnswer', 'grading', 'solution', 'feedbackRules', 'defaultFeedback'])) return false
    return isDecimal(value.correctAnswer)
      && isNumericGrading(value.grading)
      && (!isDecimalZero(value.correctAnswer)
        || (Object.hasOwn(value.grading, 'absoluteTolerance') && !Object.hasOwn(value.grading, 'relativeTolerance')))
      && isNumericFeedbackRules(value.feedbackRules, 'explanation')
  }

  return false
}

function isParameterSchema(value) {
  // shortcut: generated parameters are safe integers only; add decimal ranges when a generator requires them.
  if (!isRecord(value)) return false
  const keys = Reflect.ownKeys(value)
  return keys.length > 0 && keys.every((key) => {
    if (!questionIdPattern.test(key)) return false
    const range = value[key]
    return hasOnlyKeys(range, ['type', 'min', 'max'])
      && hasKeys(range, ['type', 'min', 'max'])
      && range.type === 'integer'
      && Number.isSafeInteger(range.min)
      && Number.isSafeInteger(range.max)
      && range.min <= range.max
      && !Object.is(range.min, -0)
      && !Object.is(range.max, -0)
  })
}

function parametersMatch(parameters, parameterSchema) {
  if (!isParameterRecord(parameters)) return false
  const keys = Reflect.ownKeys(parameterSchema)
  if (Reflect.ownKeys(parameters).length !== keys.length || keys.some((key) => !Object.hasOwn(parameters, key))) return false
  return keys.every((key) => {
    const value = parameters[key]
    const { min, max } = parameterSchema[key]
    return Number.isSafeInteger(value) && value >= min && value <= max && !Object.is(value, -0)
  })
}

function contentMatchesTemplate(content, template) {
  if (content.format !== template.format) return false
  if (content.format === 'single-choice') {
    const templateIds = template.choicesTemplate.map((choice) => choice.id)
    return content.choices.length === templateIds.length
      && templateIds.every((id) => content.choices.some((choice) => choice.id === id))
      && content.correctAnswer === template.correctAnswerTemplate
      && content.feedbackRules.length === template.feedbackRulesTemplate.length
      && template.feedbackRulesTemplate.every((rule, index) => {
        const feedbackRule = content.feedbackRules[index]
        return feedbackRule.choiceId === rule.choiceId && feedbackRule.lessonRef === rule.lessonRef
      })
  }

  return content.grading.unit === template.unit
    && content.grading.roundingDigits === template.roundingDigits
    && content.grading.absoluteTolerance === template.absoluteTolerance
    && content.grading.relativeTolerance === template.relativeTolerance
    && content.feedbackRules.length === template.feedbackRulesTemplate.length
    && template.feedbackRulesTemplate.every((rule, index) => content.feedbackRules[index].lessonRef === rule.lessonRef)
}

function isTemplate(value) {
  if (!isRecord(value) || !isText(value.promptTemplate) || !isText(value.conditionsTemplate)
    || !isText(value.solutionTemplate) || !isText(value.correctAnswerTemplate)
    || !isText(value.defaultFeedbackTemplate)) return false

  if (value.format === 'single-choice') {
    if (!hasOnlyKeys(value, ['format', 'promptTemplate', 'conditionsTemplate', 'choicesTemplate', 'correctAnswerTemplate', 'solutionTemplate', 'feedbackRulesTemplate', 'defaultFeedbackTemplate'])) return false
    if (!hasKeys(value, ['format', 'promptTemplate', 'conditionsTemplate', 'choicesTemplate', 'correctAnswerTemplate', 'solutionTemplate', 'feedbackRulesTemplate', 'defaultFeedbackTemplate'])) return false
    if (!isUniqueChoiceSet(value.choicesTemplate, 'labelTemplate')) return false
    const choiceIds = new Set(value.choicesTemplate.map((choice) => choice.id))
    return isText(value.correctAnswerTemplate)
      && choiceIds.has(value.correctAnswerTemplate)
      && isSingleChoiceFeedbackRules(value.feedbackRulesTemplate, choiceIds, 'explanationTemplate')
  }

  if (value.format === 'numeric') {
    if (!hasOnlyKeys(value, ['format', 'promptTemplate', 'conditionsTemplate', 'correctAnswerTemplate', 'unit', 'roundingDigits', 'absoluteTolerance', 'relativeTolerance', 'solutionTemplate', 'feedbackRulesTemplate', 'defaultFeedbackTemplate'])) return false
    if (!hasKeys(value, ['format', 'promptTemplate', 'conditionsTemplate', 'correctAnswerTemplate', 'unit', 'roundingDigits', 'solutionTemplate', 'feedbackRulesTemplate', 'defaultFeedbackTemplate'])) return false
    return isText(value.unit)
      && isNonNegativeSafeInteger(value.roundingDigits)
      && (Object.hasOwn(value, 'absoluteTolerance') || Object.hasOwn(value, 'relativeTolerance'))
      && (!Object.hasOwn(value, 'absoluteTolerance') || isNonNegativeDecimal(value.absoluteTolerance))
      && (!Object.hasOwn(value, 'relativeTolerance') || isNonNegativeDecimal(value.relativeTolerance))
      && isNumericFeedbackRules(value.feedbackRulesTemplate, 'explanationTemplate', 'answerTemplate', isText)
  }

  return false
}

function isDefinitionMetadata(value) {
  return isQuestionId(value.questionId)
    && isPositiveSafeInteger(value.revision)
    && isLessonRefs(value.lessonRefs)
    && isDifficulty(value.difficulty)
    && isSources(value.sources)
}

function isQuestionDefinition(value) {
  if (!isRecord(value) || !isDefinitionMetadata(value)) return false
  if (value.kind === 'fixed') {
    return hasOnlyKeys(value, ['kind', 'questionId', 'revision', 'lessonRefs', 'difficulty', 'sources', 'content'])
      && hasKeys(value, ['kind', 'questionId', 'revision', 'lessonRefs', 'difficulty', 'sources', 'content'])
      && isQuestionContent(value.content)
  }

  if (value.kind === 'generated') {
    if (!hasOnlyKeys(value, ['kind', 'questionId', 'revision', 'lessonRefs', 'difficulty', 'sources', 'generator', 'contentTemplate'])
      || !hasKeys(value, ['kind', 'questionId', 'revision', 'lessonRefs', 'difficulty', 'sources', 'generator', 'contentTemplate'])) return false
    return hasOnlyKeys(value.generator, ['generationRuleVersion', 'parameters'])
      && hasKeys(value.generator, ['generationRuleVersion', 'parameters'])
      && isPositiveSafeInteger(value.generator.generationRuleVersion)
      && isParameterSchema(value.generator.parameters)
      && isTemplate(value.contentTemplate)
  }

  return false
}

function isQuestionDefinitionSnapshot(value) {
  if (!isRecord(value) || !isDefinitionMetadata(value) || !isQuestionContent(value.content)) return false
  const commonKeys = ['kind', 'questionId', 'revision', 'lessonRefs', 'difficulty', 'sources', 'content']
  if (value.kind === 'fixed') return hasOnlyKeys(value, commonKeys) && hasKeys(value, commonKeys)
  if (value.kind === 'generated') {
    const keys = [...commonKeys, 'generationRuleVersion']
    return hasOnlyKeys(value, keys)
      && hasKeys(value, keys)
      && isPositiveSafeInteger(value.generationRuleVersion)
  }
  return false
}

function isQuestionInstance(value) {
  if (!isRecord(value) || !isText(value.instanceId) || !isQuestionId(value.questionId)
    || !isPositiveSafeInteger(value.questionDefinitionRevision)
    || !isQuestionDefinitionSnapshot(value.questionDefinitionSnapshot)) return false

  const snapshot = value.questionDefinitionSnapshot
  if (value.questionId !== snapshot.questionId || value.questionDefinitionRevision !== snapshot.revision
    || value.kind !== snapshot.kind) return false

  if (value.kind === 'fixed') {
    const keys = ['kind', 'instanceId', 'questionId', 'questionDefinitionRevision', 'questionDefinitionSnapshot']
    return hasOnlyKeys(value, keys) && hasKeys(value, keys)
  }

  if (value.kind === 'generated') {
    const keys = ['kind', 'instanceId', 'questionId', 'questionDefinitionRevision', 'questionDefinitionSnapshot', 'seed', 'generationRuleVersion']
    return hasOnlyKeys(value, keys)
      && hasKeys(value, keys)
      && isText(value.seed)
      && isPositiveSafeInteger(value.generationRuleVersion)
      && value.generationRuleVersion === snapshot.generationRuleVersion
  }

  return false
}

export function validateQuestionContent(value) {
  try {
    return isQuestionContent(value)
  } catch {
    return false
  }
}

export function validateQuestionDefinition(value) {
  try {
    return isQuestionDefinition(value)
  } catch {
    return false
  }
}

export function validateQuestionInstance(value) {
  try {
    return isQuestionInstance(value)
  } catch {
    return false
  }
}

export function createQuestionInstance(definition, options) {
  try {
    if (!isQuestionDefinition(definition) || !isRecord(options) || !isText(options.instanceId)) {
      throw new TypeError('Invalid question definition or instance options')
    }

    let content
    let instance
    const metadata = {
      kind: definition.kind,
      questionId: definition.questionId,
      revision: definition.revision,
      lessonRefs: definition.lessonRefs,
      difficulty: definition.difficulty,
      sources: definition.sources,
    }

    if (definition.kind === 'fixed') {
      if (!hasOnlyKeys(options, ['instanceId'])) throw new TypeError('Fixed questions do not accept generated fields')
      content = definition.content
      instance = {
        kind: 'fixed',
        instanceId: options.instanceId,
        questionId: definition.questionId,
        questionDefinitionRevision: definition.revision,
        questionDefinitionSnapshot: { ...metadata, content },
      }
    } else {
      if (!hasOnlyKeys(options, ['instanceId', 'content', 'seed'])
        || !hasKeys(options, ['instanceId', 'content', 'seed'])
        || !isQuestionContent(options.content)
        || !contentMatchesTemplate(options.content, definition.contentTemplate)
        || !parametersMatch(options.content.parameters, definition.generator.parameters)
        || !isText(options.seed)) {
        throw new TypeError('Generated question content does not match its definition')
      }
      content = options.content
      instance = {
        kind: 'generated',
        instanceId: options.instanceId,
        questionId: definition.questionId,
        questionDefinitionRevision: definition.revision,
        generationRuleVersion: definition.generator.generationRuleVersion,
        seed: options.seed,
        questionDefinitionSnapshot: {
          ...metadata,
          generationRuleVersion: definition.generator.generationRuleVersion,
          content,
        },
      }
    }

    return JSON.parse(JSON.stringify(instance))
  } catch (error) {
    if (error instanceof TypeError) throw error
    throw new TypeError('Invalid question definition or instance options')
  }
}
