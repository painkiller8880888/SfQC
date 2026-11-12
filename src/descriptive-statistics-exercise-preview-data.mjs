const contexts = [
  { noun: 'シャフトの長さ', unit: 'mm', base: 100 },
  { noun: 'ボルトの長さ', unit: 'mm', base: 50 },
  { noun: '部品の重さ', unit: 'g', base: 250 },
  { noun: '充填した飲料の量', unit: 'mL', base: 500 },
]

export const descriptiveStatisticsExerciseCategories = Object.freeze([
  Object.freeze({ title: '平均と偏差' }),
  Object.freeze({ title: 'データの変換' }),
  Object.freeze({ title: '不偏分散' }),
  Object.freeze({ title: '総合' }),
  Object.freeze({ title: '分散と標準偏差' }),
])

const kana = ['ア', 'イ', 'ウ', 'エ']

function validateCategoryAndType(categoryIndex, typeIndex) {
  if (!Number.isInteger(categoryIndex) || categoryIndex < 0 || categoryIndex >= descriptiveStatisticsExerciseCategories.length) {
    throw new RangeError('Unknown exercise category')
  }
  if (!Number.isInteger(typeIndex) || typeIndex < 0 || typeIndex >= 3) {
    throw new RangeError('Exercise type must be an integer from 0 to 2')
  }
}

function randomValue(random) {
  if (typeof random !== 'function') throw new TypeError('random must be a function')
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('random must return a number from 0 inclusive to 1 exclusive')
  }
  return value
}

function seededRandom(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('seed must be an unsigned 32-bit integer')
  let state = seed
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function int(random, min, max) {
  return min + Math.floor(randomValue(random) * (max - min + 1))
}

function pick(random, values) {
  return values[int(random, 0, values.length - 1)]
}

function shuffle(random, values) {
  const result = values.slice()
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = int(random, 0, index)
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}

function signed(value) {
  return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0'
}

function numberText(value) {
  const rounded = Math.round(value * 100) / 100
  return `${rounded < 0 ? '−' : ''}${Math.abs(rounded)}`
}

function context(random) {
  return pick(random, contexts)
}

function choiceQuestion(prompt, correct, wrong, sections, random) {
  const choices = shuffle(random, [correct, ...wrong])
  const answer = choices.indexOf(correct)
  const otherReasons = choices.flatMap((choice, index) => index === answer ? [] : [`${kana[index]}：${choice.why}`])
  return {
    type: 'choice', prompt, choices: choices.map((choice) => choice.text), answer, sections,
    explanation: `正しいのは「${kana[answer]}」です。${correct.why} ほかの選択肢が誤りの理由は、次のとおりです。${otherReasons.join('　')}`,
  }
}

function multipleChoice(prompt, correct, wrong, explanation, sections, random) {
  const choices = shuffle(random, [correct, ...wrong])
  return {
    type: 'choice', prompt, choices, answer: choices.indexOf(correct), explanation, sections,
  }
}

const deviationCorrect = [
  { text: '偏差を全部足すと、必ず 0 になる。', why: '偏差は平均を基準にした差なので、正と負が打ち消し合って、合計は常に 0 になります。' },
  { text: '平均より小さい測定値の偏差は、負の値になる。', why: '偏差は「測定値 − 平均」なので、平均より小さい測定値では負になります。' },
  { text: '偏差の単位は、測定値の単位と同じである。', why: '偏差は測定値から平均を引いた差なので、測定値と同じ単位（mm など）です。' },
]
const deviationWrong = [
  { text: '偏差の合計が大きいほど、ばらつきが大きい。', why: '偏差の合計は常に 0 なので、ばらつきの大きさを表せません。' },
  { text: '偏差は、すべて正の値になる。', why: '平均より小さい測定値の偏差は、負になります。' },
  { text: '偏差の単位は、測定値の単位の2乗である。', why: '2乗の単位になるのは偏差平方和や分散です。偏差そのものは、測定値と同じ単位です。' },
  { text: '平均と等しい測定値の偏差は、1になる。', why: '平均と等しい測定値の偏差は 0 です。' },
]
const varianceCorrect = [
  { text: '標本から母分散を見積もる値で、偏差平方和を n − 1 で割って求める。', why: '不偏分散は、標本から母分散を見積もるために、偏差平方和 S を n − 1 で割って求めます。' },
  { text: '母分散の見積もりであり、母分散と一致するとは限らない。', why: '不偏分散は標本から出した見積もりです。標本が変われば値も変わり、母分散とぴったり一致するとは限りません。' },
  { text: '取り出す標本が変わると、値も変わる。', why: '不偏分散は測った標本から計算するので、標本が変われば値も変わります。' },
]
const varianceWrong = [
  { text: '母分散と必ず一致する値である。', why: '不偏分散は見積もりなので、母分散と必ず一致するわけではありません。' },
  { text: '測った標本そのものの散らばりを表す値で、偏差平方和を n で割って求める。', why: 'これは標本内の分散の説明です。不偏分散は母分散の見積もりで、n − 1 で割ります。' },
  { text: '標本の本数が増えるほど、必ず大きくなる値である。', why: '本数が増えても、必ず大きくなるわけではありません。' },
  { text: '偏差の合計を n − 1 で割って求める。', why: '偏差の合計は常に 0 です。2乗してから足した偏差平方和を割ります。' },
  { text: '単位は、測定値の単位と同じである。', why: '偏差を2乗しているので、単位は測定値の単位の2乗（mm² など）です。' },
]

function firstMeanQuestion(random) {
  const c = context(random)
  const mean = c.base + int(random, -4, 4)
  let deviations = [1, 2, -2, -3]
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const candidate = Array.from({ length: 4 }, () => pick(random, [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]))
    const remaining = -candidate.reduce((sum, value) => sum + value, 0)
    if (remaining !== 0 && Math.abs(remaining) <= 6) {
      deviations = candidate
      break
    }
  }
  const remaining = -deviations.reduce((sum, value) => sum + value, 0)
  return {
    type: 'numeric', unit: c.unit, answer: mean + remaining, sections: ['deviation'],
    prompt: `ある工程から5個の${c.noun}を測ったところ、平均は ${mean} ${c.unit} でした。そのうち4個の偏差は ${deviations.map(signed).join('、')}（${c.unit}）です。残りの1個の測定値は何 ${c.unit} ですか。`,
    explanation: `偏差の合計は、平均を基準にしているので、必ず 0 になります。4個の偏差の合計は ${deviations.map((value) => value < 0 ? `(${signed(value)})` : String(value)).join(' + ')} = ${signed(deviations.reduce((sum, value) => sum + value, 0))} なので、残りの偏差は ${signed(remaining)} ${c.unit} です。測定値は ${mean} + (${signed(remaining)}) = ${mean + remaining} ${c.unit} です。`,
  }
}

function secondMeanQuestion(random) {
  const c = context(random)
  const count = int(random, 4, 6)
  const mean = c.base + int(random, -3, 3)
  const change = pick(random, [1, 2, -1, -2])
  const added = mean + (count + 1) * change
  return {
    type: 'numeric', unit: c.unit, answer: added, sections: ['mean'],
    prompt: `${c.noun}を ${count} 個測ったところ、平均は ${mean} ${c.unit} でした。ここへ1個を追加して ${count + 1} 個にしたところ、平均は ${mean + change} ${c.unit} になりました。追加した1個の測定値は何 ${c.unit} ですか。`,
    explanation: `平均 × 個数 ＝ 合計 です。追加前の合計は ${mean} × ${count} = ${mean * count}、追加後の合計は ${mean + change} × ${count + 1} = ${(mean + change) * (count + 1)} です。その差 ${(mean + change) * (count + 1)} − ${mean * count} = ${added} ${c.unit} が、追加した測定値です。`,
  }
}

function firstTransformationQuestion(random) {
  const c = context(random)
  const add = randomValue(random) < 0.5
  const amount = add ? pick(random, [2, 3, 5]) : c.base
  const story = add
    ? `測定器のゼロ点が ${amount} ${c.unit} ずれていたことが分かり、すべての測定値に ${amount} ${c.unit} を足して補正しました。`
    : `規格の中心値 ${amount} ${c.unit} を、すべての測定値から引いて記録しました（扱いやすい小さな数にするためです）。`
  const movement = add ? '増える' : '減る'
  const correct = `平均は ${amount} ${c.unit} ${movement}が、分散と標準偏差は変わらない。`
  return multipleChoice(
    `${story}この前後で、平均・分散・標準偏差の変化について正しい説明はどれですか。`,
    correct,
    [
      `平均も標準偏差も、${amount} ${c.unit} ${movement}。`,
      '平均は変わらないが、分散と標準偏差が変わる。',
      '平均、分散、標準偏差のすべてが変わらない。',
    ],
    'すべての値に同じ数を足したり引いたりすると、平均は同じだけ動きます。ただし、各値と平均の差（偏差）は変わりません。分散と標準偏差は偏差から作るので、どちらも変わりません。データ全体が平行に動くだけで、散らばり方は同じです。',
    ['deviation'], random,
  )
}

function secondTransformationQuestion(random) {
  const c = context(random)
  const factor = int(random, 2, 5)
  const variance = int(random, 2, 9)
  const answer = factor * factor * variance
  return {
    type: 'numeric', unit: `${c.unit}²`, answer, sections: ['variance', 'standard-deviation'],
    prompt: `拡大して測定する装置で、すべての測定値が実際の ${factor} 倍で記録されます。実際の測定値の不偏分散が ${variance} ${c.unit}² のとき、この装置で記録された測定値の不偏分散は何 ${c.unit}² ですか。`,
    explanation: `測定値が ${factor} 倍になると、平均も偏差も ${factor} 倍になります。分散は偏差を2乗して作るので ${factor}² = ${factor * factor} 倍になり、${variance} × ${factor * factor} = ${answer} ${c.unit}² です。標準偏差は ${factor} 倍です。`,
  }
}

function thirdTransformationQuestion(random) {
  const mmMean = 10 * int(random, 8, 12)
  const mmSd = int(random, 2, 6)
  const correct = `平均 ${numberText(mmMean / 10)} cm、標準偏差 ${numberText(mmSd / 10)} cm`
  return multipleChoice(
    `長さ（mm）の測定値の平均が ${mmMean} mm、標準偏差が ${mmSd} mm でした。すべての測定値を cm に換算すると、平均と標準偏差はいくつになりますか。（1 cm = 10 mm）`,
    correct,
    [
      `平均 ${numberText(mmMean / 10)} cm、標準偏差 ${mmSd} cm`,
      `平均 ${numberText(mmMean / 10)} cm、標準偏差 ${numberText(mmSd * mmSd / 100)} cm`,
      `平均 ${mmMean} cm、標準偏差 ${numberText(mmSd / 10)} cm`,
    ],
    `単位を mm から cm に換算すると、値は 1/10 になります。平均も標準偏差も長さの単位をもつので、どちらも 1/10 です（${mmMean} ÷ 10 = ${numberText(mmMean / 10)} cm、${mmSd} ÷ 10 = ${numberText(mmSd / 10)} cm）。分散なら 1/100 になりますが、ここで聞かれているのは標準偏差です。`,
    ['standard-deviation'], random,
  )
}

function firstVarianceQuestion(random) {
  const correct = pick(random, varianceCorrect)
  return choiceQuestion('標本から計算する不偏分散 V について、正しい説明はどれですか。', correct, shuffle(random, varianceWrong).slice(0, 3), ['variance'], random)
}

function secondVarianceQuestion(random) {
  const whole = randomValue(random) < 0.5
  const c = context(random)
  const count = pick(random, [4, 5, 6, 8])
  const variance = int(random, 2, 9)
  const divisor = whole ? count : count - 1
  const sumSquares = divisor * variance
  return {
    type: 'numeric', unit: `${c.unit}²`, answer: variance, sections: ['variance'],
    prompt: whole
      ? `1ロットの ${count} 個すべての${c.noun}を測ったところ、偏差平方和 S は ${sumSquares} ${c.unit}² でした。このロットの分散は何 ${c.unit}² ですか。`
      : `あるロットから ${count} 個を抜き取って${c.noun}を測ったところ、偏差平方和 S は ${sumSquares} ${c.unit}² でした。このロット全体の分散を見積もると、何 ${c.unit}² ですか。`,
    explanation: whole
      ? `ロットの全部を測ったので、求めたいのは母分散そのものです。S を全個数 ${count} で割ります。${sumSquares} ÷ ${count} = ${variance} ${c.unit}² です。`
      : `一部を抜き取っただけなので、ロット全体の分散（母分散）を見積もります。S を n − 1 = ${count - 1} で割ります。${sumSquares} ÷ ${count - 1} = ${variance} ${c.unit}² です。`,
  }
}

function thirdVarianceQuestion(random) {
  const c = context(random)
  const count = pick(random, [4, 5, 6])
  const variance = int(random, 2, 9)
  const value = `${variance} ${c.unit}²`
  const correct = '一般に値は変わる。V は標本から出した見積もりだからである。'
  return multipleChoice(
    `あるロットから ${count} 個を取り出して不偏分散 V を求めたところ、${value} でした。同じロットから別の ${count} 個を取り出して V を求めると、どうなりますか。`,
    correct,
    [`必ず ${value} と同じになる。`, `必ず ${value} より大きくなる。`, `必ず ${value} より小さくなる。`],
    '不偏分散は標本から計算する見積もりなので、取り出す標本が変われば値も変わります。大きくなるか小さくなるかも決まっていません。同じ取り方を何度もくり返して平均すると母分散に一致する、という性質です。',
    ['variance'], random,
  )
}

function deviationSet(k) {
  return [-k, -k, 0, k, k]
}

function fourthVarianceQuestion(random) {
  const c = context(random)
  let k1 = int(random, 1, 4)
  let k2 = int(random, 1, 4)
  if (k1 === k2) k2 = k2 === 4 ? 1 : k2 + 1
  const mean1 = c.base + int(random, -3, 3)
  const mean2 = mean1 + pick(random, [-4, -3, 3, 4])
  const deviations1 = deviationSet(k1)
  const deviations2 = deviationSet(k2)
  const values1 = deviations1.map((value) => mean1 + value)
  const values2 = deviations2.map((value) => mean2 + value)
  const answer = Math.abs(k1 - k2)
  return {
    type: 'numeric', unit: c.unit, answer, sections: ['variance', 'standard-deviation'],
    prompt: `ラインP と ラインQ から、${c.noun}を5個ずつ測りました（下の表、単位は ${c.unit}）。それぞれの標準偏差 s を求めたとき、大きいほうと小さいほうの差は何 ${c.unit} ですか。`,
    table: { rows: [{ label: 'ラインP', values: values1 }, { label: 'ラインQ', values: values2 }] },
    explanation: `${lineExplanation('P', mean1, deviations1, k1)}　${lineExplanation('Q', mean2, deviations2, k2)}　標準偏差は偏差から作るので、平均の位置が違っても比べられます。差は ${Math.max(k1, k2)} − ${Math.min(k1, k2)} = ${answer} ${c.unit} です。`,
  }
}

function lineExplanation(name, mean, deviations, sd) {
  const squares = deviations.map((value) => value * value)
  return `${name}：平均 = ${mean}、偏差 = ${deviations.map(signed).join('、')}、S = ${squares.join(' + ')} = ${squares.reduce((sum, value) => sum + value, 0)}、V = ${squares.reduce((sum, value) => sum + value, 0)} ÷ 4 = ${sd * sd}、s = ${sd}。`
}

function fifthVarianceQuestion(random) {
  const c = context(random)
  const count = pick(random, [4, 5, 6, 9])
  const sd = int(random, 2, 6)
  const sumSquares = (count - 1) * sd * sd
  return {
    type: 'numeric', unit: c.unit, answer: sd, sections: ['variance', 'standard-deviation'],
    prompt: `${c.noun}を ${count} 個測った標本の偏差平方和 S が ${sumSquares} ${c.unit}² でした。この標本の標準偏差 s は何 ${c.unit} ですか。`,
    explanation: `標本から求める分散は、S を n − 1 = ${count - 1} で割ります。V = ${sumSquares} ÷ ${count - 1} = ${sd * sd} ${c.unit}²。標準偏差は分散の平方根なので、s = √${sd * sd} = ${sd} ${c.unit} です。`,
  }
}

function fourthIntegratedQuestion(random) {
  const c = context(random)
  const count = 5
  const mean = c.base + int(random, -3, 3)
  const deviations = [-2, -2, 0, 2, 2]
  const values = deviations.map((value) => mean + value)
  const error = int(random, 1, 4)
  let shownMean = mean
  let shownSum = values.reduce((sum, value) => sum + value, 0)
  let shownDeviations = deviations.slice()
  let changedIndex = 0
  if (error === 1) {
    shownMean = mean + pick(random, [-1, 1])
    shownSum = shownMean * count
    shownDeviations = values.map((value) => value - shownMean)
  }
  if (error === 2) {
    changedIndex = int(random, 0, count - 1)
    shownDeviations[changedIndex] += pick(random, [-1, 1])
  }
  const squares = shownDeviations.map((value) => value * value)
  const trueSumSquares = deviations.reduce((sum, value) => sum + value * value, 0)
  const shownSumSquares = error === 3 ? trueSumSquares + pick(random, [-2, 2]) : squares.reduce((sum, value) => sum + value, 0)
  const divisor = error === 4 ? count : count - 1
  const calculation = [
    `① 平均 = (${values.join(' + ')}) ÷ ${count} = ${shownSum} ÷ ${count} = ${numberText(shownMean)}`,
    `② 偏差 = ${shownDeviations.map(signed).join('、')}`,
    `③ 偏差平方和 S = ${squares.join(' + ')} = ${shownSumSquares}`,
    `④ 分散 = S ÷ ${divisor} = ${shownSumSquares} ÷ ${divisor} = ${numberText(shownSumSquares / divisor)}`,
  ]
  const explanations = [
    `① の合計が違います。正しい合計は ${values.reduce((sum, value) => sum + value, 0)}、平均は ${values.reduce((sum, value) => sum + value, 0)} ÷ ${count} = ${mean} です。偏差の合計が 0 にならないことからも気づけます。`,
    `② の偏差のうち ${changedIndex + 1} 個目が違います。${values[changedIndex]} − ${mean} = ${signed(deviations[changedIndex])} が正しい値です。`,
    `③ の足し算が違います。${squares.join(' + ')} = ${trueSumSquares} が正しい合計です。`,
    `④ の割り算が違います。標本から分散を見積もるときは、n ではなく n − 1 = ${count - 1} で割ります。正しくは ${trueSumSquares} ÷ ${count - 1} = ${numberText(trueSumSquares / (count - 1))} です。`,
  ]
  return {
    type: 'choice',
    prompt: `${c.noun}を ${count} 個測り、標本から工程の分散を見積もる計算をしました。計算の途中に、誤りが1か所だけあります。どの段階ですか。`,
    choices: ['① 平均の計算', '② 偏差の計算', '③ 偏差平方和の計算', '④ 分散の計算'],
    answer: error - 1, sections: ['mean', 'deviation', 'variance'],
    calculation, explanation: explanations[error - 1],
  }
}

function firstStandardDeviationQuestion(random) {
  const c = context(random)
  const factors = [
    { labels: ['1/2', '1/4', '1/√2'], before: [6, 8, 12], transform: (value) => value / 2 },
    { labels: ['1/3', '1/9', '1/√3'], before: [6, 9, 12], transform: (value) => value / 3 },
    { labels: ['2', '4', '√2'], before: [2, 3, 4], transform: (value) => value * 2 },
    { labels: ['3', '9', '√3'], before: [1, 2, 3], transform: (value) => value * 3 },
  ]
  const factor = pick(random, factors)
  const before = pick(random, factor.before)
  const after = factor.transform(before)
  return multipleChoice(
    `工程を変更したところ、標準偏差 s が ${before} ${c.unit} から ${after} ${c.unit} になりました。不偏分散 V は何倍になりましたか。`,
    `${factor.labels[1]} 倍`,
    [`${factor.labels[0]} 倍`, `${factor.labels[2]} 倍`, '変わらない'],
    `標準偏差は分散の平方根なので、分散は標準偏差の2乗です。変更前は ${before}² = ${before * before} ${c.unit}²、変更後は ${after}² = ${after * after} ${c.unit}² で、${after * after} ÷ ${before * before} = ${factor.labels[1]} 倍です。標準偏差が ${factor.labels[0]} 倍になると、分散はその2乗の ${factor.labels[1]} 倍になります。`,
    ['standard-deviation'], random,
  )
}

function secondStandardDeviationQuestion(random) {
  const c = context(random)
  const sd = int(random, 1, 4)
  const multiple = int(random, 2, 5)
  const halfWidth = sd * multiple
  const variance = sd * sd
  return {
    type: 'numeric', unit: '倍', answer: multiple, sections: ['standard-deviation'],
    prompt: `${c.noun}の規格は、中心値 ${c.base} ${c.unit} に対して ±${halfWidth} ${c.unit} です。工程の不偏分散は ${variance} ${c.unit}² でした。規格の幅の半分（${halfWidth} ${c.unit}）は、標準偏差の何倍ですか。`,
    explanation: `分散（${c.unit}²）のままでは、${c.unit} で表した規格の幅と比べられません。標準偏差 s = √${variance} = ${sd} ${c.unit} にすると同じ単位になり、${halfWidth} ÷ ${sd} = ${multiple} 倍と分かります。`,
  }
}

function thirdStandardDeviationQuestion(random) {
  const c = context(random)
  const variance = randomValue(random) < 0.5
  const correct = variance ? `${c.unit}²` : c.unit
  const wrong = variance ? [c.unit, '単位はない（無名数）', `${c.unit}³`] : [`${c.unit}²`, '単位はない（無名数）', `1/${c.unit}`]
  return multipleChoice(
    `測定値の単位が ${c.unit} のとき、${variance ? '不偏分散' : '標準偏差'}の単位として正しいものはどれですか。`,
    correct, wrong,
    variance
      ? '分散は偏差を2乗して作るので、単位も2乗になり、測定値の単位の2乗です。'
      : '標準偏差は分散の平方根なので、2乗になった単位が元に戻り、測定値と同じ単位です。だから規格や公差と直接比べられます。',
    ['standard-deviation'], random,
  )
}

const generators = [
  [firstMeanQuestion, secondMeanQuestion, (random) => choiceQuestion('偏差（測定値 − 平均）について、正しい説明はどれですか。', pick(random, deviationCorrect), shuffle(random, deviationWrong).slice(0, 3), ['deviation'], random)],
  [firstTransformationQuestion, secondTransformationQuestion, thirdTransformationQuestion],
  [firstVarianceQuestion, secondVarianceQuestion, thirdVarianceQuestion],
  [fourthVarianceQuestion, fifthVarianceQuestion, fourthIntegratedQuestion],
  [firstStandardDeviationQuestion, secondStandardDeviationQuestion, thirdStandardDeviationQuestion],
]

export function createDescriptiveStatisticsExercisePreviewState(categoryIndex, random = Math.random) {
  validateCategoryAndType(categoryIndex, 0)
  return {
    typeIndex: int(random, 0, 2),
    seed: Math.floor(randomValue(random) * 0x100000000),
  }
}

export function nextDescriptiveStatisticsExercisePreviewState(categoryIndex, current, random = Math.random) {
  validateCategoryAndType(categoryIndex, current?.typeIndex)
  if (!Number.isInteger(current.seed) || current.seed < 0 || current.seed > 0xffffffff) throw new RangeError('seed must be an unsigned 32-bit integer')
  const typeIndex = (current.typeIndex + int(random, 1, 2)) % 3
  let seed = Math.floor(randomValue(random) * 0x100000000)
  if (seed === current.seed) seed = (seed + 1) >>> 0
  return { typeIndex, seed }
}

export function generateDescriptiveStatisticsExercisePreviewQuestion(categoryIndex, typeIndex, seed) {
  validateCategoryAndType(categoryIndex, typeIndex)
  const random = seededRandom(seed)
  return generators[categoryIndex][typeIndex](random)
}
