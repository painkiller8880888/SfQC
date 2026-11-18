import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDescriptiveStatisticsExercisePreviewState,
  descriptiveStatisticsExerciseCategories,
  generateDescriptiveStatisticsExercisePreviewQuestion,
  generateDescriptiveStatisticsExercisePreviewQuestionById,
  nextDescriptiveStatisticsExercisePreviewState,
} from '../src/descriptive-statistics-exercise-preview-data.mjs'
import { generateExerciseInstance, getExerciseGradingData, getExerciseQuestionDisplay } from '../src/lesson-contract.mjs'
import { lessonExerciseGenerators } from '../src/lesson-exercise-adapters.mjs'
import { lessonRegistry } from '../src/lesson-registry.mjs'
import { descriptiveStatisticsExerciseBaseline } from './descriptive-statistics-exercise-baseline.fixture.mjs'

function legacyQuestionFromInstance(instance) {
  const display = getExerciseQuestionDisplay(instance)
  const { evaluation, solution } = getExerciseGradingData(instance)
  const question = {
    prompt: display.prompt,
    sections: display.reviewSectionRefs.map((reference) => reference.split('#')[1]),
    explanation: solution.explanation,
    ...(display.table ? { table: display.table } : {}),
    ...(display.calculations ? { calculation: display.calculations } : {}),
  }
  if (display.response.type === 'choice' && evaluation.type === 'choice') {
    return {
      ...question,
      type: 'choice',
      choices: display.response.choices.map(({ text }) => text),
      answer: display.response.choices.findIndex(({ id }) => id === evaluation.correctChoiceId),
    }
  }
  if (display.response.type === 'numeric' && evaluation.type === 'numeric') {
    return {
      ...question,
      type: 'numeric',
      unit: display.response.fields[0].unit,
      answer: evaluation.answers[0].expected,
    }
  }
  throw new TypeError('Exercise display and grading data do not match')
}

test('exercise preview covers the five lesson areas with deterministic question variants', () => {
  const expectedSections = [
    [['deviation'], ['mean'], ['deviation']],
    [['deviation'], ['variance', 'standard-deviation'], ['standard-deviation']],
    [['variance'], ['variance'], ['variance']],
    [['variance', 'standard-deviation'], ['variance', 'standard-deviation'], ['mean', 'deviation', 'variance']],
    [['standard-deviation'], ['standard-deviation'], ['standard-deviation']],
  ]

  assert.deepEqual(descriptiveStatisticsExerciseCategories.map(({ title }) => title), [
    '平均と偏差', 'データの変換', '不偏分散', '総合', '分散と標準偏差',
  ])
  for (let categoryIndex = 0; categoryIndex < expectedSections.length; categoryIndex += 1) {
    for (let typeIndex = 0; typeIndex < 3; typeIndex += 1) {
      const first = generateDescriptiveStatisticsExercisePreviewQuestion(categoryIndex, typeIndex, 48291)
      assert.deepEqual(first, generateDescriptiveStatisticsExercisePreviewQuestion(categoryIndex, typeIndex, 48291))
      assert.deepEqual(first.sections, expectedSections[categoryIndex][typeIndex])
      assert.ok(first.prompt.length > 0)
      assert.ok(first.explanation.length > 0)
      if (first.type === 'choice') {
        assert.equal(first.choices.length, 4)
        assert.ok(Number.isInteger(first.answer) && first.answer >= 0 && first.answer < first.choices.length)
        assert.equal(new Set(first.choices).size, first.choices.length)
      } else {
        assert.match(first.answer, /^[+-]?\d+(\.\d+)?$/u)
        assert.ok(first.unit.length > 0)
        assert.ok(first.explanation.includes(String(first.answer)))
      }
    }
  }
})

test('generated line comparison table agrees with the asked standard-deviation difference', () => {
  for (let seed = 0; seed < 100; seed += 1) {
    const question = generateDescriptiveStatisticsExercisePreviewQuestion(3, 0, seed)
    const standardDeviation = ({ values }) => {
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length
      const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
      return Math.sqrt(variance)
    }
    const [left, right] = question.table.rows
    assert.equal(Math.abs(standardDeviation(left) - standardDeviation(right)), Number(question.answer))
  }
})

test('integrated calculation question presents one consistent mistake at each step', () => {
  const foundErrors = new Set()
  const parseSigned = (value) => Number(value.replace('−', '-').replace(/^\+/u, ''))
  const signed = (value) => `${value < 0 ? '−' : value > 0 ? '+' : ''}${Math.abs(value)}`
  for (let seed = 0; seed < 100; seed += 1) {
    const question = generateDescriptiveStatisticsExercisePreviewQuestion(3, 2, seed)
    const [, rawValues, rawCount, rawTotal, rawMean] = question.calculation[0]
      .match(/① 平均 = \(([^)]+)\) ÷ (\d+) = (\d+) ÷ \d+ = ([−+\d.]+)/u)
    const values = rawValues.split(' + ').map(Number)
    const count = Number(rawCount)
    const total = values.reduce((sum, value) => sum + value, 0)
    const mean = total / count
    const deviations = values.map((value) => value - mean)
    const shownMean = parseSigned(rawMean)
    const shownDeviations = question.calculation[1].slice('② 偏差 = '.length).split('、').map(parseSigned)
    const [, squareTermsText, shownSumOfSquaresText] = question.calculation[2]
      .match(/③ 偏差平方和 S = (.+) = (\d+)$/u)
    const squareTerms = squareTermsText.split(' + ').map(Number)
    const shownSumOfSquares = Number(shownSumOfSquaresText)
    const trueSumOfSquares = deviations.reduce((sum, value) => sum + value ** 2, 0)
    const divisorMatch = question.calculation[3].match(/④ 分散 = S ÷ (\d+) = (\d+) ÷ \d+ = ([−+\d.]+)/u)
    assert.ok(divisorMatch)
    const [, divisorText, usedSumText, resultText] = divisorMatch
    const divisor = Number(divisorText)
    const usedSum = Number(usedSumText)
    const displayedVariance = parseSigned(resultText)
    foundErrors.add(question.answer)
    assert.equal(count, 5)
    assert.ok(count - 1 > 0)
    assert.equal(total / count, mean)
    assert.equal(question.choices[question.answer], `${['①', '②', '③', '④'][question.answer]} ${['平均', '偏差', '偏差平方和', '分散'][question.answer]}の計算`)
    assert.ok(question.explanation.startsWith(['①', '②', '③', '④'][question.answer]))
    if (question.answer === 0) {
      assert.notEqual(Number(rawTotal), total)
      assert.equal(shownMean, Number(rawTotal) / count)
      assert.deepEqual(shownDeviations, values.map((value) => value - shownMean))
      assert.ok(question.explanation.includes(`正しい合計は ${total}、平均は ${total} ÷ ${count} = ${mean} です。`))
    } else {
      assert.equal(Number(rawTotal), total)
      assert.equal(shownMean, mean)
    }

    if (question.answer === 1) {
      const incorrectPositions = shownDeviations.flatMap((value, index) => value === deviations[index] ? [] : [index])
      assert.equal(incorrectPositions.length, 1)
      const index = incorrectPositions[0]
      assert.ok(question.explanation.includes(`② の偏差のうち ${index + 1} 個目が違います。${values[index]} − ${mean} = ${signed(deviations[index])} が正しい値です。`))
    } else if (question.answer > 1) assert.deepEqual(shownDeviations, deviations)

    const squaredDeviations = shownDeviations.map((value) => value ** 2)
    assert.deepEqual(squareTerms, squaredDeviations)
    if (question.answer === 2) {
      assert.notEqual(shownSumOfSquares, trueSumOfSquares)
      assert.ok([trueSumOfSquares - 2, trueSumOfSquares + 2].includes(shownSumOfSquares))
      assert.ok(question.explanation.includes(`${squaredDeviations.join(' + ')} = ${trueSumOfSquares} が正しい合計です。`))
    } else assert.equal(shownSumOfSquares, squaredDeviations.reduce((sum, value) => sum + value, 0))

    const expectedDivisor = question.answer === 3 ? count : count - 1
    assert.equal(divisor, expectedDivisor)
    assert.ok(divisor > 0)
    assert.equal(usedSum, shownSumOfSquares)
    assert.equal(displayedVariance, shownSumOfSquares / divisor)
    if (question.answer === 3) {
      assert.ok(question.explanation.includes(`n − 1 = ${count - 1} で割ります。正しくは ${trueSumOfSquares} ÷ ${count - 1} = ${trueSumOfSquares / (count - 1)} です。`))
    }
  }
  assert.deepEqual([...foundErrors].sort(), [0, 1, 2, 3])
})

test('individual regeneration changes the question type and validates its random source', () => {
  const first = createDescriptiveStatisticsExercisePreviewState(0, () => 0)
  assert.deepEqual(first, { typeIndex: 0, seed: 0 })
  const next = nextDescriptiveStatisticsExercisePreviewState(0, first, () => 0)
  assert.equal(next.typeIndex, 1)
  assert.notEqual(next.seed, first.seed)

  assert.throws(() => createDescriptiveStatisticsExercisePreviewState(5), RangeError)
  assert.throws(() => generateDescriptiveStatisticsExercisePreviewQuestion(0, 3, 1), RangeError)
  assert.throws(() => generateDescriptiveStatisticsExercisePreviewQuestion(0, 0, -1), RangeError)
  assert.throws(() => createDescriptiveStatisticsExercisePreviewState(0, () => 1), RangeError)
  assert.throws(() => nextDescriptiveStatisticsExercisePreviewState(0, first, () => Number.NaN), RangeError)
})

test('type IDs and the shared contract preserve frozen questions and resolve independently of order', () => {
  for (const { categoryId, questions } of descriptiveStatisticsExerciseBaseline.questions) {
    const category = descriptiveStatisticsExerciseCategories.find((item) => item.id === categoryId)
    for (const { typeIndex, question: expected } of questions) {
      const typeId = category.typeIds[typeIndex]
      assert.deepEqual(generateDescriptiveStatisticsExercisePreviewQuestionById(categoryId, typeId,
        descriptiveStatisticsExerciseBaseline.seed), expected)
      const instance = generateExerciseInstance(lessonRegistry, 'descriptive-statistics', typeId,
        descriptiveStatisticsExerciseBaseline.seed, lessonExerciseGenerators)
      assert.deepEqual(legacyQuestionFromInstance(instance), expected)
    }
  }
  for (const { seed, question: expected } of descriptiveStatisticsExerciseBaseline.integratedErrorSeeds) {
    const typeId = descriptiveStatisticsExerciseCategories.find(({ id }) => id === 'comprehensive').typeIds[2]
    const instance = generateExerciseInstance(lessonRegistry, 'descriptive-statistics', typeId, seed, lessonExerciseGenerators)
    assert.deepEqual(legacyQuestionFromInstance(instance), expected)
    assert.equal(expected.answer, [2, 8, 1, 0].indexOf(seed))
  }

  const category = descriptiveStatisticsExerciseCategories[0]
  const typeId = category.typeIds[0]
  const original = generateExerciseInstance(lessonRegistry, 'descriptive-statistics', typeId, 48291, lessonExerciseGenerators)
  const repeated = generateExerciseInstance(lessonRegistry, 'descriptive-statistics', typeId, 48291, lessonExerciseGenerators)
  const differentInput = generateExerciseInstance(lessonRegistry, 'descriptive-statistics', typeId, 48292, lessonExerciseGenerators)
  assert.equal(original.instanceId, repeated.instanceId)
  assert.notEqual(original.instanceId, differentInput.instanceId)

  const reordered = structuredClone(lessonRegistry)
  reordered.exerciseCatalog.categories.reverse()
  reordered.exerciseCatalog.generators[1].types.reverse()
  reordered.exerciseCatalog.definitions.reverse()
  for (const { categoryId, questions } of descriptiveStatisticsExerciseBaseline.questions) {
    const categoryDefinition = descriptiveStatisticsExerciseCategories.find((item) => item.id === categoryId)
    for (const { typeIndex, question: expected } of questions) {
      const reorderedInstance = generateExerciseInstance(reordered, 'descriptive-statistics', categoryDefinition.typeIds[typeIndex],
        descriptiveStatisticsExerciseBaseline.seed, lessonExerciseGenerators)
      assert.deepEqual(legacyQuestionFromInstance(reorderedInstance), expected)
    }
    for (const typeId of categoryDefinition.typeIds) {
      for (const seed of [0, 0xffffffff]) {
        const boundary = generateExerciseInstance(reordered, 'descriptive-statistics', typeId, seed, lessonExerciseGenerators)
        assert.deepEqual(legacyQuestionFromInstance(boundary),
          generateDescriptiveStatisticsExercisePreviewQuestionById(categoryId, typeId, seed))
      }
    }
  }
})

test('registered definitions repeat presentation, grading, and explanation for the same revision and input', () => {
  const snapshot = (instance) => ({
    definitionId: instance.definitionId,
    instanceId: instance.instanceId,
    revision: instance.revision,
    mode: instance.mode,
    input: instance.input,
    display: getExerciseQuestionDisplay(instance),
    grading: getExerciseGradingData(instance),
  })

  for (const definition of lessonRegistry.exerciseCatalog.definitions) {
    const { generation } = definition
    const inputs = generation.kind === 'fixed'
      ? [undefined]
      : generation.kind === 'index'
        ? Array.from({ length: generation.maximum - generation.minimum + 1 }, (_, offset) => generation.minimum + offset)
        : [generation.minimum, descriptiveStatisticsExerciseBaseline.seed, generation.maximum]
    for (const input of inputs) {
      const first = generateExerciseInstance(lessonRegistry, definition.lessonId, definition.exerciseId, input, lessonExerciseGenerators)
      const repeated = generateExerciseInstance(lessonRegistry, definition.lessonId, definition.exerciseId, input, lessonExerciseGenerators)
      assert.deepEqual(snapshot(repeated), snapshot(first), `${definition.exerciseId} must repeat for ${generation.kind}:${input}`)
    }
  }
})

// These checks recompute generator mathematics from the displayed data; the registry validator only checks structure and references.
test('numeric generators agree with displayed values, explanations, units, and nonzero divisors', () => {
  const parseSigned = (value) => Number(value.replace('−', '-').replace(/^\+/u, ''))
  const signed = (value) => `${value < 0 ? '−' : value > 0 ? '+' : ''}${Math.abs(value)}`
  const denominatorBranches = new Set()
  const seeds = [...Array.from({ length: 100 }, (_, index) => index), 0x40000000, 0x80000000, 0xc0000000, 0xffffffff]

  for (const seed of seeds) {
    for (const [categoryIndex, category] of descriptiveStatisticsExerciseCategories.entries()) {
      for (const [typeIndex, typeId] of category.typeIds.entries()) {
        const instance = generateExerciseInstance(lessonRegistry, 'descriptive-statistics', typeId, seed, lessonExerciseGenerators)
        const question = legacyQuestionFromInstance(instance)

        if (typeId === 'mean-deviation-average') {
          const match = question.prompt.match(/平均は (\d+) (mm|g|mL) でした。そのうち4個の偏差は (.+?)（/u)
          assert.ok(match)
          const mean = Number(match[1])
          const deviations = match[3].split('、').map(parseSigned)
          const remaining = -deviations.reduce((sum, value) => sum + value, 0)
          const expected = mean + remaining
          assert.equal(question.answer, String(expected))
          assert.equal(question.unit, match[2])
          assert.equal(deviations.reduce((sum, value) => sum + value, 0) + remaining, 0)
          assert.ok(question.explanation.includes(`残りの偏差は ${signed(remaining)} ${match[2]} です。測定値は ${mean} + (${signed(remaining)}) = ${expected} ${match[2]} です。`))
        } else if (typeId === 'mean-deviation-deviation') {
          const match = question.prompt.match(/を (\d+) 個測ったところ、平均は (\d+) (mm|g|mL) でした。ここへ1個を追加して (\d+) 個にしたところ、平均は (\d+) \3 になりました。/u)
          assert.ok(match)
          const [, countText, oldMeanText, unit, newCountText, newMeanText] = match
          const count = Number(countText)
          const oldMean = Number(oldMeanText)
          const newCount = Number(newCountText)
          const newMean = Number(newMeanText)
          const oldTotal = oldMean * count
          const newTotal = newMean * newCount
          const expected = newTotal - oldTotal
          assert.equal(newCount, count + 1)
          assert.equal(question.answer, String(expected))
          assert.equal(question.unit, unit)
          assert.ok(question.explanation.includes(`追加前の合計は ${oldMean} × ${count} = ${oldTotal}、追加後の合計は ${newMean} × ${newCount} = ${newTotal} です。その差 ${newTotal} − ${oldTotal} = ${expected} ${unit} が、追加した測定値です。`))
        } else if (typeId === 'data-transformation-multiply') {
          const match = question.prompt.match(/実際の (\d+) 倍で記録されます。実際の測定値の不偏分散が (\d+) (mm|g|mL)² のとき/u)
          assert.ok(match)
          const [, factorText, varianceText, unit] = match
          const factor = Number(factorText)
          const variance = Number(varianceText)
          const expected = factor ** 2 * variance
          assert.equal(question.answer, String(expected))
          assert.equal(question.unit, `${unit}²`)
          assert.ok(question.explanation.includes(`${factor}² = ${factor ** 2} 倍になり、${variance} × ${factor ** 2} = ${expected} ${unit}² です。`))
        } else if (typeId === 'unbiased-variance-denominator') {
          const match = question.prompt.match(/(?:1ロットの|あるロットから) (\d+) 個/u)
          const amountMatch = question.prompt.match(/偏差平方和 S は (\d+) (mm|g|mL)²/u)
          assert.ok(match && amountMatch)
          const count = Number(match[1])
          const sumOfSquares = Number(amountMatch[1])
          const unit = amountMatch[2]
          const wholeLot = question.prompt.startsWith('1ロットの')
          const divisor = wholeLot ? count : count - 1
          assert.ok(divisor > 0)
          const expected = sumOfSquares / divisor
          assert.ok(Number.isInteger(expected))
          assert.equal(question.answer, String(expected))
          assert.equal(question.unit, `${unit}²`)
          assert.ok(question.explanation.includes(`${sumOfSquares} ÷ ${divisor} = ${expected} ${unit}²`))
          denominatorBranches.add(wholeLot ? 'population-n' : 'sample-n-minus-one')
        } else if (typeId === 'comprehensive-variance-comparison') {
          assert.equal(question.table.rows.length, 2)
          const standardDeviations = question.table.rows.map((row) => {
            assert.equal(row.values.length, 5)
            const mean = row.values.reduce((sum, value) => sum + value, 0) / row.values.length
            const deviations = row.values.map((value) => value - mean)
            const squares = deviations.map((value) => value ** 2)
            const sumOfSquares = squares.reduce((sum, value) => sum + value, 0)
            const divisor = row.values.length - 1
            assert.ok(divisor > 0)
            const variance = sumOfSquares / divisor
            const standardDeviation = Math.sqrt(variance)
            const line = `${row.label.replace(/^ライン/u, '')}：平均 = ${mean}、偏差 = ${deviations.map(signed).join('、')}、S = ${squares.join(' + ')} = ${sumOfSquares}、V = ${sumOfSquares} ÷ ${divisor} = ${variance}、s = ${standardDeviation}。`
            assert.ok(question.explanation.includes(line), `seed ${seed}: expected ${line} in ${question.explanation}`)
            return standardDeviation
          })
          const expected = Math.abs(standardDeviations[0] - standardDeviations[1])
          const unit = question.prompt.match(/単位は (mm|g|mL)）/u)[1]
          assert.ok(Number.isInteger(expected))
          assert.equal(question.answer, String(expected))
          assert.equal(question.unit, unit)
          assert.ok(question.explanation.includes(`差は ${Math.max(...standardDeviations)} − ${Math.min(...standardDeviations)} = ${expected} ${unit} です。`))
        } else if (typeId === 'comprehensive-standard-deviation-comparison') {
          const match = question.prompt.match(/を (\d+) 個測った標本の偏差平方和 S が (\d+) (mm|g|mL)² でした。/u)
          assert.ok(match)
          const [, countText, sumText, unit] = match
          const count = Number(countText)
          const sumOfSquares = Number(sumText)
          const divisor = count - 1
          assert.ok(divisor > 0)
          const variance = sumOfSquares / divisor
          const expected = Math.sqrt(variance)
          assert.ok(Number.isInteger(variance) && Number.isInteger(expected))
          assert.equal(question.answer, String(expected))
          assert.equal(question.unit, unit)
          assert.ok(question.explanation.includes(`V = ${sumOfSquares} ÷ ${divisor} = ${variance} ${unit}²。標準偏差は分散の平方根なので、s = √${variance} = ${expected} ${unit} です。`))
        } else if (typeId === 'variance-standard-deviation-calculation') {
          const match = question.prompt.match(/中心値 \d+ (mm|g|mL) に対して ±(\d+) \1 です。工程の不偏分散は (\d+) \1² でした。規格の幅の半分（\d+ \1）は/u)
          assert.ok(match)
          const [, unit, halfWidthText, varianceText] = match
          const halfWidth = Number(halfWidthText)
          const variance = Number(varianceText)
          const standardDeviation = Math.sqrt(variance)
          assert.ok(standardDeviation > 0)
          const expected = halfWidth / standardDeviation
          assert.ok(Number.isInteger(expected))
          assert.equal(question.answer, String(expected))
          assert.equal(question.unit, '倍')
          assert.ok(question.explanation.includes(`標準偏差 s = √${variance} = ${standardDeviation} ${unit}`))
          assert.ok(question.explanation.includes(`${halfWidth} ÷ ${standardDeviation} = ${expected} 倍`))
        }
      }
    }
  }

  assert.deepEqual([...denominatorBranches].sort(), ['population-n', 'sample-n-minus-one'])
})

test('choice generators keep mathematical transformations, units, and explanations aligned', () => {
  const questionFor = (categoryIndex, typeIndex, seed) => {
    const category = descriptiveStatisticsExerciseCategories[categoryIndex]
    const exerciseId = category.typeIds[typeIndex]
    return legacyQuestionFromInstance(generateExerciseInstance(
      lessonRegistry, 'descriptive-statistics', exerciseId, seed, lessonExerciseGenerators,
    ))
  }
  const numberText = (value) => String(Math.round(value * 100) / 100)
  const translationKinds = new Set()
  const varianceRatios = new Set()
  const unitKinds = new Set()

  for (let seed = 0; seed < 100; seed += 1) {
    const translation = questionFor(1, 0, seed)
    assert.equal(translation.type, 'choice')
    const added = translation.prompt.match(/すべての測定値に (\d+) (mm|g|mL) を足して補正しました/u)
    const subtracted = translation.prompt.match(/規格の中心値 (\d+) (mm|g|mL) を、すべての測定値から引いて記録しました/u)
    assert.ok(added || subtracted)
    const [, amount, unit] = added ?? subtracted
    const movement = added ? '増える' : '減る'
    assert.equal(translation.choices[translation.answer], `平均は ${amount} ${unit} ${movement}が、分散と標準偏差は変わらない。`)
    assert.ok(translation.explanation.includes('平均は同じだけ動きます'))
    assert.ok(translation.explanation.includes('各値と平均の差（偏差）は変わりません'))
    assert.ok(translation.explanation.includes('分散と標準偏差は偏差から作るので、どちらも変わりません'))
    translationKinds.add(added ? 'addition' : 'subtraction')

    const conversion = questionFor(1, 2, seed)
    const conversionMatch = conversion.prompt.match(/平均が (\d+) mm、標準偏差が (\d+) mm でした/u)
    assert.ok(conversionMatch)
    const [, meanText, sdText] = conversionMatch
    const meanCm = numberText(Number(meanText) / 10)
    const sdCm = numberText(Number(sdText) / 10)
    assert.equal(conversion.choices[conversion.answer], `平均 ${meanCm} cm、標準偏差 ${sdCm} cm`)
    assert.ok(conversion.explanation.includes(`${meanText} ÷ 10 = ${meanCm} cm、${sdText} ÷ 10 = ${sdCm} cm`))

    const varianceRatio = questionFor(4, 0, seed)
    const ratioMatch = varianceRatio.prompt.match(/標準偏差 s が (\d+) (mm|g|mL) から (\d+) \2 になりました/u)
    assert.ok(ratioMatch)
    const [, beforeText, unitName, afterText] = ratioMatch
    const before = Number(beforeText)
    const after = Number(afterText)
    const beforeVariance = before ** 2
    const afterVariance = after ** 2
    const ratio = afterVariance / beforeVariance
    const ratioText = ratio < 1 ? `1/${Math.round(1 / ratio)}` : String(ratio)
    assert.equal(varianceRatio.choices[varianceRatio.answer], `${ratioText} 倍`)
    assert.ok(varianceRatio.explanation.includes(`変更前は ${before}² = ${beforeVariance} ${unitName}²、変更後は ${after}² = ${afterVariance} ${unitName}² で、${afterVariance} ÷ ${beforeVariance} = ${ratioText} 倍です。`))
    varianceRatios.add(ratioText)

    const unitQuestion = questionFor(4, 2, seed)
    const unitMatch = unitQuestion.prompt.match(/測定値の単位が (mm|g|mL) のとき、(不偏分散|標準偏差)の単位として正しいものはどれですか/u)
    assert.ok(unitMatch)
    const [, measurementUnit, statistic] = unitMatch
    const expectedUnit = statistic === '不偏分散' ? `${measurementUnit}²` : measurementUnit
    assert.equal(unitQuestion.choices[unitQuestion.answer], expectedUnit)
    if (statistic === '不偏分散') assert.ok(unitQuestion.explanation.includes('単位も2乗になり、測定値の単位の2乗'))
    else assert.ok(unitQuestion.explanation.includes('測定値と同じ単位です'))
    unitKinds.add(statistic)
  }

  assert.deepEqual([...translationKinds].sort(), ['addition', 'subtraction'])
  assert.deepEqual([...varianceRatios].sort(), ['1/4', '1/9', '4', '9'])
  assert.deepEqual([...unitKinds].sort(), ['不偏分散', '標準偏差'])
})
