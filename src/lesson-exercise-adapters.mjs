import { generateExerciseInstance, validateLessonRegistry } from './lesson-contract.mjs'
import { lessonRegistry } from './lesson-registry.mjs'
import {
  generateDescriptiveStatisticsPreviewExercise,
} from './descriptive-statistics-preview-exercises.mjs'
import {
  generateDescriptiveStatisticsExercisePreviewQuestionById,
} from './descriptive-statistics-exercise-preview-data.mjs'

function adaptQuestion(definition, source) {
  const display = {
    prompt: source.prompt,
    reviewSectionRefs: source.sections?.map((sectionId) => `${definition.lessonId}#${sectionId}`) ?? [],
    ...(source.table ? { table: source.table } : {}),
    ...(source.calculation ? { calculations: source.calculation } : {}),
  }
  let evaluation
  if (source.type === 'choice') {
    display.response = {
      type: 'choice',
      choices: source.choices.map((text, index) => ({ id: `choice-${index}`, text })),
    }
    evaluation = { type: 'choice', correctChoiceId: `choice-${source.answer}` }
  } else {
    display.response = {
      type: 'numeric',
      fields: source.fields?.map((field, index) => ({
        id: `answer-${index + 1}`,
        label: field.label,
        unit: field.unit,
        roundingDigits: 0,
      })) ?? [{ id: 'answer', label: '答え', unit: source.unit, roundingDigits: 0 }],
    }
    const expected = source.answers ?? [String(source.answer)]
    evaluation = {
      type: 'numeric',
      answers: expected.map((value, index) => ({
        fieldId: display.response.fields[index].id,
        expected: String(value),
        roundingDigits: 0,
      })),
    }
  }
  return { display, evaluation, solution: { explanation: source.solution ?? source.explanation } }
}

export const lessonExerciseGenerators = Object.freeze({
  'descriptive-statistics-inline': (definition, index) => adaptQuestion(
    definition,
    generateDescriptiveStatisticsPreviewExercise(definition.generation.typeId, index),
  ),
  'descriptive-statistics-independent': (definition, seed) => adaptQuestion(
    definition,
    generateDescriptiveStatisticsExercisePreviewQuestionById(
      definition.placement.categoryId,
      definition.generation.typeId,
      seed,
    ),
  ),
})

if (!validateLessonRegistry(lessonRegistry)) throw new TypeError('Invalid lesson registry')

export function generateLessonExercise(lessonId, exerciseId, input) {
  return generateExerciseInstance(lessonRegistry, lessonId, exerciseId, input, lessonExerciseGenerators)
}
