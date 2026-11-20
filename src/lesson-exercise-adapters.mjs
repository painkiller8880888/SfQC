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

const defectAggregationCases = [
  {
    sections: ['types'],
    prompt: '表示された製品記録から、不適合品数と不適合数の正しい組み合わせを、単位と数え方を含めて選んでください。',
    table: {
      caption: '製品ごとの検査記録',
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
      '不適合品2個、不適合4件。基準を超えた傷が1件以上ある製品番号はP-01とP-03、傷の件数は基準を超えた傷の列を合計する。',
      '不適合品4個、不適合4件。見つかった傷が1件以上ある製品を数え、基準を超えた傷の列を合計する。',
      '不適合品4件、不適合2個。傷の数と製品の数を逆の単位で答える。',
      '不適合品2個、不適合8件。見つかった傷の総数を不適合数として合計する。',
    ],
    answer: 0,
    steps: [
      '基準を超えた傷は3 + 0 + 1 + 0 + 0 + 0 = 4件です。',
      '基準を超えた傷が1件以上ある製品はP-01とP-03の2個です。',
    ],
    solution: '製品ごとの記録では、基準を超えた傷を1件以上持つ製品を重複なく数えると不適合品数になり、基準を超えた傷そのものを合計すると不適合数になります。',
    choiceFeedback: [
      { choiceIndex: 1, misconception: '見つかった傷の有無ではなく、基準を超えた傷があるかで不適合品を判定します。P-02とP-05の傷は基準内です。' },
      { choiceIndex: 2, misconception: '不適合品は「個」、不適合な傷は「件」で数えます。選択肢はこの2つの単位を逆にしています。' },
      { choiceIndex: 3, misconception: '不適合数に数えるのは、見つかった傷すべてではなく基準を超えた傷です。' },
    ],
  },
  {
    sections: ['types'],
    prompt: '製品ごとの事例と同じ6製品から、基準を超えた傷だけを抜き出した明細です。不適合品数と不適合数の正しい組み合わせを、単位と数え方を含めて選んでください。',
    table: {
      caption: '同じ6製品から基準を超えた傷だけを抜き出した明細',
      rowHeaderLabel: '傷番号',
      columnLabels: ['製品番号'],
      rows: [
        { label: '傷1', values: [1] }, { label: '傷2', values: [1] },
        { label: '傷3', values: [1] }, { label: '傷4', values: [3] },
      ],
    },
    type: 'choice',
    choices: [
      '不適合品2個、不適合4件。製品番号P-01とP-03を重複なく数え、明細の4行を傷1件ずつ数える。',
      '不適合品4個、不適合4件。明細の4行を4製品として数え、傷の行も4件とする。',
      '不適合品4件、不適合2個。傷の数と製品の数を逆の単位で答える。',
      '不適合品2個、不適合3件。P-01の3行だけを数え、P-03の1行は不適合数に含めない。',
    ],
    answer: 0,
    steps: [
      '明細の1行は基準を超えた傷1件なので、4行で不適合は4件です。',
      '製品番号P-01とP-03を重複なく数えると、不適合品は2個です。検査対象は6個で、明細はそのうち基準を超えた傷だけを示しています。',
    ],
    solution: '製品単位の検査記録と同じ6製品・同じ基準超過傷4件を、傷単位の明細で表しています。製品番号を重複なく数えると不適合品2個、明細の行を数えると不適合4件です。',
    choiceFeedback: [
      { choiceIndex: 1, misconception: '明細の1行は傷1件です。P-01は3行、P-03は1行ですが、製品番号は2種類なので不適合品は2個です。' },
      { choiceIndex: 2, misconception: '不適合品は製品単位で「個」、基準を超えた傷は傷単位で「件」と数えます。' },
      { choiceIndex: 3, misconception: '不適合数に数えるのはP-01だけではなく、P-03の行も含む明細4行です。異なる製品番号を数えると不適合品2個です。' },
    ],
  },
  {
    sections: ['types'],
    prompt: '表示された傷明細から、不適合品数と不適合数の正しい組み合わせを、単位と数え方を含めて選んでください。',
    table: {
      caption: '基準を超えた傷の明細（検査対象は製品1〜5の5個）',
      rowHeaderLabel: '傷番号',
      columnLabels: ['製品番号'],
      rows: [{ label: '傷1', values: [1] }, { label: '傷2', values: [3] }],
    },
    type: 'choice',
    choices: [
      '不適合品2個、不適合2件。異なる製品番号1と3を重複なく数え、明細の行を傷1件ずつ数える。',
      '不適合品2個、不適合2件。明細の1行は常に1製品なので、2行を2製品として数える。',
      '不適合品5個、不適合2件。検査対象の製品をすべて不適合品として数え、明細の行を傷として数える。',
      '不適合品2個、不適合5件。異なる製品番号を数えて不適合品とし、検査対象数を不適合数とする。',
    ],
    answer: 0,
    steps: [
      '明細の傷番号は2つなので、基準を超えた傷は2件です。',
      '製品番号は1と3の2種類なので、不適合品は2個です。検査対象は5個ですが、全てが不適合品という意味ではありません。',
    ],
    solution: 'この事例では結果の数がどちらも2ですが、製品番号の種類を数えた2個と、明細の傷を数えた2件では対象も単位も異なります。明細にない製品を含む検査対象数は5個です。',
    choiceFeedback: [
      { choiceIndex: 1, misconception: '今回は結果が2個で一致しますが、傷明細の1行は傷1件です。1製品に複数の傷があれば製品番号は繰り返されます。' },
      { choiceIndex: 2, misconception: '検査対象は5個ですが、不適合品は基準を超えた傷がある製品1と3の2個です。' },
      { choiceIndex: 3, misconception: '異なる製品番号は不適合品を数えますが、検査対象数を不適合数には使いません。傷明細の2行が不適合2件です。' },
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
  'data-types-cases': (_definition, index) => adaptQuestion(
    { lessonId: 'data-types' },
    defectAggregationCases[index],
  ),
})

if (!validateLessonRegistry(lessonRegistry)) throw new TypeError('Invalid lesson registry')

export function generateLessonExercise(lessonId, exerciseId, input, registry = lessonRegistry, generators = lessonExerciseGenerators) {
  return generateExerciseInstance(registry, lessonId, exerciseId, input, generators)
}
