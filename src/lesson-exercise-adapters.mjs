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
    return {
      display,
      evaluation,
      solution: {
        ...(source.steps ? { steps: source.steps } : {}),
        explanation: source.solution ?? source.explanation,
        ...(source.choiceFeedback ? { choiceFeedback: source.choiceFeedback.map(({ choiceIndex, misconception }) => ({
          choiceId: `choice-${choiceIndex}`,
          misconception,
          ...(source.sections ? { reviewSectionRefs: source.sections.map((sectionId) => `${definition.lessonId}#${sectionId}`) } : {}),
        })) } : {}),
      },
    }
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

const defectAggregationPrompt = '不適合品数と不適合数の組と、その数え方として正しいものを選んでください。'

const defectAggregationCases = [
  {
    sections: ['counting'],
    prompt: defectAggregationPrompt,
    table: {
      caption: '製品ごとの検査記録（1行＝製品1個）',
      rowHeaderLabel: '製品番号',
      columnLabels: ['見つかった傷（件）', '基準を超えた傷（件）'],
      rows: [
        { label: 'P-01', values: [4, 3] }, { label: 'P-02', values: [1, 0] },
        { label: 'P-03', values: [2, 1] }, { label: 'P-04', values: [0, 0] },
        { label: 'P-05', values: [1, 0] }, { label: 'P-06', values: [0, 0] },
      ],
    },
    type: 'choice',
    choices: [
      '不適合品2個、不適合4件。基準を超えた傷が1件以上ある製品を数え、基準を超えた傷の列を合計する。',
      '不適合品4個、不適合4件。見つかった傷が1件以上ある製品を数え、基準を超えた傷の列を合計する。',
      '不適合品2個、不適合8件。基準を超えた傷が1件以上ある製品を数え、見つかった傷の列を合計する。',
      '不適合品4個、不適合2件。基準を超えた傷の列を合計し、基準を超えた傷が1件以上ある製品を数える。',
    ],
    answer: 0,
    steps: [
      '基準を超えた傷は 3 + 0 + 1 + 0 + 0 + 0 = 4 件です。',
      '基準を超えた傷が1件以上ある製品は P-01 と P-03 の2個です。',
    ],
    solution: '製品記録では、基準を超えた傷がある行を数えると不適合品数（個）、基準を超えた傷の列を合計すると不適合数（件）になります。',
    choiceFeedback: [
      { choiceIndex: 1, misconception: 'この選択肢は、見つかった傷がある製品をすべて不適合品として数えています。P-02とP-05の傷は基準内です。' },
      { choiceIndex: 2, misconception: 'この選択肢は、不適合数に基準内の傷まで含めています。不適合数は基準を超えた傷の列から数えます。' },
      { choiceIndex: 3, misconception: 'この選択肢は、傷の件数（4）を不適合品数、製品の個数（2）を不適合数に当てています。' },
    ],
  },
  {
    sections: ['observation-unit'],
    prompt: `検査対象は P-01〜P-05 の5個です。基準を超えた傷だけを抜き出した明細を示します。${defectAggregationPrompt}`,
    table: {
      caption: '基準を超えた傷の明細（1行＝傷1件）',
      rowHeaderLabel: '傷番号',
      columnLabels: ['製品番号'],
      rows: [{ label: '傷1', values: ['P-01'] }, { label: '傷2', values: ['P-03'] }],
    },
    type: 'choice',
    choices: [
      '不適合品2個、不適合2件。明細の1行は製品1個を表すので、2行を不適合品2個として数える。',
      '不適合品5個、不適合2件。検査対象の製品数を不適合品数とし、明細の行を数える。',
      '不適合品2個、不適合2件。製品番号を重複なく数えると2個、明細の行を数えると2件になる。',
      '不適合品2個、不適合5件。製品番号を重複なく数え、検査対象の製品数を不適合数とする。',
    ],
    answer: 2,
    steps: [
      '明細の1行は基準を超えた傷1件なので、不適合は2件です。',
      '製品番号は P-01 と P-03 の2種類なので、不適合品は2個です。',
    ],
    solution: 'この事例ではどちらも2ですが、製品番号の種類を数えた「2個」と、明細の行を数えた「2件」は対象も単位も違います。1製品に該当する傷が2件あれば、行は2つでも不適合品は1個です。',
    choiceFeedback: [
      { choiceIndex: 0, misconception: '数は合っていますが、理由が誤りです。明細の1行は傷1件です。今回は製品番号が重複していないので、行数と製品数が一致しただけです。' },
      { choiceIndex: 1, misconception: 'この選択肢は、検査した製品をすべて不適合品として数えています。明細に現れる製品は P-01 と P-03 だけです。' },
      { choiceIndex: 3, misconception: 'この選択肢は、検査対象の製品数を不適合数としています。不適合数は明細の行（傷）から数えます。' },
    ],
  },
]

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
  'data-types-cases': (definition, index) => adaptQuestion(
    definition,
    defectAggregationCases[index],
  ),
})

if (!validateLessonRegistry(lessonRegistry)) throw new TypeError('Invalid lesson registry')

export function generateLessonExercise(lessonId, exerciseId, input, registry = lessonRegistry, generators = lessonExerciseGenerators) {
  return generateExerciseInstance(registry, lessonId, exerciseId, input, generators)
}
