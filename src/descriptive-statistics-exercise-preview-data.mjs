const contexts = [
  { noun: 'シャフトの長さ', unit: 'mm', base: 100 },
  { noun: 'ボルトの長さ', unit: 'mm', base: 50 },
  { noun: '部品の重さ', unit: 'g', base: 250 },
  { noun: '充填した飲料の量', unit: 'mL', base: 500 },
]

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

function decimalAnswer(value) {
  if (!Number.isSafeInteger(value)) throw new RangeError('numeric exercise answer must be a safe integer')
  return String(value)
}

function context(random) {
  return pick(random, contexts)
}

function answerChoice(text, why, sections) {
  return { text, why, sections }
}

function choiceQuestion(prompt, correct, wrong, sections, random, steps) {
  const choices = shuffle(random, [correct, ...wrong])
  const answer = choices.indexOf(correct)
  return {
    type: 'choice', prompt, choices: choices.map((choice) => choice.text), answer, sections,
    explanation: correct.why,
    ...(steps ? { steps } : {}),
    choiceFeedback: choices.flatMap((choice, choiceIndex) => choiceIndex === answer ? [] : [{
      choiceIndex,
      misconception: choice.why,
      sections: choice.sections ?? sections,
    }]),
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
const independentLotSampling = 'ロットから1個ずつ、毎回、他の抽出とは独立に等確率で選び、測るたびに元に戻します。'

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
    type: 'numeric', unit: c.unit, answer: decimalAnswer(mean + remaining), sections: ['deviation'],
    prompt: `ある工程から5個の${c.noun}を測ったところ、平均は ${mean} ${c.unit} でした。そのうち4個の偏差は ${deviations.map(signed).join('、')}（${c.unit}）です。残りの1個の測定値は何 ${c.unit} ですか。`,
    steps: [
      `4個の偏差の合計は (${deviations.map((value) => value < 0 ? `(${signed(value)})` : String(value)).join(' + ')}) ${c.unit} = ${signed(-remaining)} ${c.unit} です。`,
      `残りの偏差は 0 ${c.unit} − (${signed(-remaining)} ${c.unit}) = ${signed(remaining)} ${c.unit} です。`,
      `残りの測定値は ${mean} ${c.unit} + (${signed(remaining)} ${c.unit}) = ${mean + remaining} ${c.unit} です。`,
    ],
    explanation: '同じ標本の偏差をすべて足すと 0 になります。残りの偏差を求めてから、平均に足すと測定値に戻せます。',
  }
}

function secondMeanQuestion(random) {
  const c = context(random)
  const count = int(random, 4, 6)
  const mean = c.base + int(random, -3, 3)
  const change = pick(random, [1, 2, -1, -2])
  const added = mean + (count + 1) * change
  return {
    type: 'numeric', unit: c.unit, answer: decimalAnswer(added), sections: ['mean'],
    prompt: `${c.noun}を ${count} 個測ったところ、平均は ${mean} ${c.unit} でした。ここへ1個を追加して ${count + 1} 個にしたところ、平均は ${mean + change} ${c.unit} になりました。追加した1個の測定値は何 ${c.unit} ですか。`,
    steps: [
      `追加前の合計は ${mean} ${c.unit} × ${count} = ${mean * count} ${c.unit} です。`,
      `追加後の合計は ${mean + change} ${c.unit} × ${count + 1} = ${(mean + change) * (count + 1)} ${c.unit} です。`,
      `追加した値は ${(mean + change) * (count + 1)} ${c.unit} − ${mean * count} ${c.unit} = ${added} ${c.unit} です。`,
    ],
    explanation: '平均に個数を掛けると測定値の合計が分かります。追加によって増えた合計の分が、新しい1個の測定値です。',
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
  return choiceQuestion(
    `${story}この前後で、平均・分散・標準偏差の変化について正しい説明はどれですか。`,
    answerChoice(`平均は ${amount} ${c.unit} ${movement}が、分散と標準偏差は変わらない。`,
      '測定値を一律に動かすと、中心の位置だけが動き、散らばり方は保たれます。'),
    [
      answerChoice(`平均は ${amount} ${c.unit} ${movement}ので、分散と標準偏差も変わる。`,
        '平均の位置は動きますが、各値も平均と同じ量だけ動くので、分散と標準偏差は変わりません。', ['deviation', 'variance']),
      answerChoice('平均は変わらず、分散と標準偏差だけが変わる。',
        '全測定値に同じ数を足したり引いたりすると、平均が同じ量だけ動きます。偏差は保たれます。', ['mean', 'deviation']),
      answerChoice('平均は変わらず、分散と標準偏差も変わらない。',
        '分散と標準偏差は変わりません。平均は、すべての測定値に加えた量と同じだけ動きます。', ['mean']),
    ],
    ['deviation'], random,
    [
      `すべての測定値に同じ量を${add ? '足した' : '引いた'}ので、平均は ${amount} ${c.unit} ${movement}。`,
      '測定値と平均が同じ量だけ動くので、差である偏差は変わりません。偏差から求める分散と標準偏差も変わりません。',
    ],
  )
}

function secondTransformationQuestion(random) {
  const c = context(random)
  const factor = int(random, 2, 5)
  const variance = int(random, 2, 9)
  const answer = factor * factor * variance
  return {
    type: 'numeric', unit: `${c.unit}²`, answer: decimalAnswer(answer), sections: ['variance', 'standard-deviation'],
    prompt: `拡大して測定する装置で、すべての測定値が実際の ${factor} 倍で記録されます。実際の測定値の不偏分散が ${variance} ${c.unit}² のとき、この装置で記録された測定値の不偏分散は何 ${c.unit}² ですか。`,
    steps: [
      `不偏分散の倍率は ${factor}² = ${factor * factor} 倍です。`,
      `記録された測定値の不偏分散は ${variance} ${c.unit}² × ${factor * factor} = ${answer} ${c.unit}² です。`,
    ],
    explanation: '測定値を何倍かすると、平均と偏差も同じ倍率で変わります。分散では偏差を二乗するため、倍率も二乗します。',
  }
}

function thirdTransformationQuestion(random) {
  const mmMean = 10 * int(random, 8, 12)
  const mmSd = int(random, 2, 6)
  const mean = numberText(mmMean / 10)
  const sd = numberText(mmSd / 10)
  return choiceQuestion(
    `長さ（mm）の測定値の平均が ${mmMean} mm、標準偏差が ${mmSd} mm でした。すべての測定値を cm に換算すると、平均と標準偏差はいくつになりますか。（1 cm = 10 mm）`,
    answerChoice(`平均 ${mean} cm、標準偏差 ${sd} cm`,
      '平均と標準偏差はどちらも長さの単位をもつため、mm から cm への換算では両方の数値を 10 で割ります。'),
    [
      answerChoice(`平均 ${mean} cm、標準偏差 ${mmSd} cm`,
        '標準偏差も測定値と同じ長さの単位です。平均と同じように数値を 10 で割ります。', ['standard-deviation']),
      answerChoice(`平均 ${mean} cm、標準偏差 ${numberText(mmSd * mmSd / 100)} cm`,
        '二乗の単位を換算すると 1/100 になりますが、ここで求める標準偏差は長さなので 1/10 です。', ['variance', 'standard-deviation']),
      answerChoice(`平均 ${mmMean} cm、標準偏差 ${sd} cm`,
        '平均も長さを表すので、mm から cm に換算すると数値は 1/10 になります。', ['mean']),
    ],
    ['standard-deviation'], random,
    [`平均は ${mmMean} mm × (1 cm / 10 mm) = ${mean} cm、標準偏差は ${mmSd} mm × (1 cm / 10 mm) = ${sd} cm に換算します。`],
  )
}

function firstVarianceQuestion(random) {
  return choiceQuestion(
    `${independentLotSampling} n 個（n ≥ 2）の測定値からロット全体の分散を見積もります。不偏分散 V を求める式の分子と分母の組はどれですか。`,
    answerChoice('分子は偏差平方和、分母は n − 1。',
      '不偏分散 V は偏差平方和を n − 1 で割った値です。標本サイズと偏差平方和がともに等しい場合は、異なる標本でも V は等しくなります。'),
    [
      answerChoice('分子は偏差平方和、分母は n。', '偏差平方和を n で割ると標本内の分散です。独立な復元抽出で母分散を見積もる不偏分散 V では n − 1 で割ります。'),
      answerChoice('分子は偏差の合計、分母は n − 1。', '二乗する前の偏差は足すと 0 です。分子は偏差を一つずつ二乗してから足します。'),
      answerChoice('分子は偏差の合計、分母は n。', '分子には偏差を二乗して足した偏差平方和を使います。独立な復元抽出での不偏分散 V の分母は n − 1 です。'),
    ],
    ['variance'], random,
    [
      '偏差を一つずつ二乗して足し、偏差平方和を求めます。',
      'このロットからの独立な復元抽出で母分散を見積もるので、偏差平方和を標本サイズ n から1を引いた数で割ります。',
    ],
  )
}

function secondVarianceQuestion(random) {
  const whole = randomValue(random) < 0.5
  const c = context(random)
  const count = pick(random, [4, 5, 6, 8])
  const variance = int(random, 2, 9)
  const divisor = whole ? count : count - 1
  const sumSquares = divisor * variance
  return {
    type: 'numeric', unit: `${c.unit}²`, answer: decimalAnswer(variance), sections: ['variance'],
    prompt: whole
      ? `1ロットの ${count} 個すべての${c.noun}を測ったところ、偏差平方和 S は ${sumSquares} ${c.unit}² でした。このロットの分散は何 ${c.unit}² ですか。`
      : `${independentLotSampling}${count} 個の${c.noun}の測定値の偏差平方和 S は ${sumSquares} ${c.unit}² でした。不偏分散で見積もった母分散は何 ${c.unit}² ですか。`,
    steps: [
      whole ? `分母はロットの全個数 N = ${count} です。` : `分母は n − 1 = ${count} − 1 = ${divisor} です。`,
      `${sumSquares} ${c.unit}² ÷ ${divisor} = ${variance} ${c.unit}²`,
    ],
    explanation: whole
      ? 'ロットの全部を測っているので、偏差平方和を全個数で割って母分散を求めます。'
      : '毎回、他の抽出とは独立に等確率で選んでいるため、偏差平方和を n − 1 で割った V の期待値はロット全体の母分散と一致します。ここで求めた V は1回の標本からの見積もりです。',
  }
}

function thirdVarianceQuestion(random) {
  const c = context(random)
  const count = pick(random, [4, 5, 6])
  const variance = int(random, 2, 9)
  const value = `${variance} ${c.unit}²`
  return choiceQuestion(
    `${independentLotSampling}${count} 個の測定値から不偏分散 V を求めたところ、${value} でした。同じ方法で同じ個数の測定値を持つ別の標本を取ります。V の値と、その理由の組として正しいのはどれですか。`,
    answerChoice(`V は ${value} と同じになることも、異なることもある。偏差平方和は標本によって変わりうるため。`,
      '同じ標本サイズでは分母が等しいので、V の違いは偏差平方和の違いで決まります。異なる標本でも偏差平方和が等しい場合は、V は同じです。'),
    [
      answerChoice(`V は必ず ${value} と同じになる。偏差平方和は同じロットなら変わらないため。`,
        '母分散は同じでも、標本の偏差平方和は変わりえます。期待値が母分散に一致することと、1回の値が一致することは別です。'),
      answerChoice(`V は必ず ${value} より大きくなる。偏差平方和は次の標本で大きくなるため。`,
        '毎回戻して独立に取り出すため、次の標本の測定値がより散らばるとは限りません。'),
      answerChoice(`V は必ず ${value} より小さくなる。偏差平方和は次の標本で小さくなるため。`,
        '毎回戻して独立に取り出すため、次の標本の測定値がよりまとまるとは限りません。'),
    ],
    ['variance'], random,
  )
}

export function makeRepeatedEndpointMeasurements(mean, radius) {
  // Both raw-data questions use five readings with repeated endpoints, unlike the lesson examples.
  return [mean - radius, mean - radius, mean, mean + radius, mean + radius]
}

function fourthVarianceQuestion(random) {
  const c = context(random)
  let k1 = int(random, 1, 4)
  let k2 = int(random, 1, 4)
  if (k1 === k2) k2 = k2 === 4 ? 1 : k2 + 1
  const mean1 = c.base + int(random, -3, 3)
  const mean2 = mean1 + pick(random, [-4, -3, 3, 4])
  const values1 = makeRepeatedEndpointMeasurements(mean1, k1)
  const values2 = makeRepeatedEndpointMeasurements(mean2, k2)
  const deviations1 = values1.map((value) => value - mean1)
  const deviations2 = values2.map((value) => value - mean2)
  const answer = Math.abs(k1 - k2)
  return {
    type: 'numeric', unit: c.unit, answer: decimalAnswer(answer), sections: ['variance', 'standard-deviation'],
    prompt: `ラインP と ラインQ から、${c.noun}を5個ずつ測りました（下の表、単位は ${c.unit}）。n − 1 で割った不偏分散から求める標準偏差 s について、大きいほうと小さいほうの差は何 ${c.unit} ですか。`,
    table: {
      caption: 'ラインごとに測った値',
      rowHeaderLabel: 'ライン',
      columnLabels: values1.map((_, index) => `${index + 1}個目`),
      rows: [{ label: 'ラインP', values: values1 }, { label: 'ラインQ', values: values2 }],
    },
    steps: [
      lineStep('P', mean1, deviations1, k1, c.unit),
      lineStep('Q', mean2, deviations2, k2, c.unit),
      `標準偏差の差は ${Math.max(k1, k2)} ${c.unit} − ${Math.min(k1, k2)} ${c.unit} = ${answer} ${c.unit} です。`,
    ],
    explanation: '標準偏差は各ラインの平均からのずれを表すので、平均の位置が異なるライン同士でも比較できます。',
  }
}

function lineStep(name, mean, deviations, sd, unit) {
  const squares = deviations.map((value) => value ** 2)
  const sum = squares.reduce((total, square) => total + square, 0)
  return `ライン${name}：平均 = ${mean} ${unit}、偏差 = ${deviations.map(signed).join('、')}（${unit}）。S = (${squares.join(' + ')}) ${unit}² = ${sum} ${unit}²、V = ${sum} ${unit}² ÷ (5 − 1) = ${sd ** 2} ${unit}²、s = √(${sd ** 2} ${unit}²) = ${sd} ${unit}。`
}

function fifthVarianceQuestion(random) {
  const c = context(random)
  const count = pick(random, [4, 5, 6, 9])
  const sd = int(random, 2, 6)
  const sumSquares = (count - 1) * sd * sd
  return {
    type: 'numeric', unit: c.unit, answer: decimalAnswer(sd), sections: ['variance', 'standard-deviation'],
    prompt: `${c.noun}を ${count} 個測った標本の偏差平方和 S が ${sumSquares} ${c.unit}² でした。n − 1 で割った不偏分散から求める標準偏差 s は何 ${c.unit} ですか。`,
    steps: [
      `V = ${sumSquares} ${c.unit}² ÷ (${count} − 1) = ${sd ** 2} ${c.unit}²`,
      `s = √(${sd ** 2} ${c.unit}²) = ${sd} ${c.unit}`,
    ],
    explanation: '偏差平方和を n − 1 で割ると不偏分散になります。その平方根を取ると、元の測定値と同じ単位の標準偏差になります。',
  }
}

function fourthIntegratedQuestion(random) {
  const c = context(random)
  const count = 5
  const mean = c.base + int(random, -3, 3)
  const values = makeRepeatedEndpointMeasurements(mean, 2)
  const deviations = values.map((value) => value - mean)
  const error = int(random, 1, 4)
  const unit = c.unit
  const squareUnit = `${unit}²`
  const total = values.reduce((sum, value) => sum + value, 0)
  let shownMean = mean
  let shownSum = total
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
  const squares = shownDeviations.map((value) => value ** 2)
  const trueSumSquares = deviations.reduce((sum, value) => sum + value ** 2, 0)
  const shownSumSquares = error === 3 ? trueSumSquares + pick(random, [-2, 2]) : squares.reduce((sum, value) => sum + value, 0)
  const divisor = error === 4 ? count : count - 1
  const calculation = [
    `① 平均 = (${values.join(' + ')}) ${unit} ÷ ${count} = ${shownSum} ${unit} ÷ ${count} = ${numberText(shownMean)} ${unit}`,
    `② 偏差 = ${shownDeviations.map(signed).join('、')}（${unit}）`,
    `③ 偏差平方和 S = (${squares.join(' + ')}) ${squareUnit} = ${shownSumSquares} ${squareUnit}`,
    `④ 不偏分散 V = S ÷ ${divisor} = ${shownSumSquares} ${squareUnit} ÷ ${divisor} = ${numberText(shownSumSquares / divisor)} ${squareUnit}`,
  ]
  const explanations = [
    '① では測定値の合計を誤っています。合計を測定した個数で割ると、正しい平均になります。',
    '② では、測定値から平均を引く計算を誤っています。測定値と同じ順序で一つずつ偏差を確認します。',
    '③ では偏差を二乗した値の合計を誤っています。二乗した各値を足し直します。',
    '④ では分母が違います。不偏分散は偏差平方和を n − 1 で割ります。',
  ]
  const corrections = [
    `平均 = (${values.join(' + ')}) ${unit} ÷ ${count} = ${total} ${unit} ÷ ${count} = ${mean} ${unit}`,
    `${changedIndex + 1} 個目の偏差 = ${values[changedIndex]} ${unit} − ${mean} ${unit} = ${signed(deviations[changedIndex])} ${unit}`,
    `S = (${squares.join(' + ')}) ${squareUnit} = ${trueSumSquares} ${squareUnit}`,
    `V = ${trueSumSquares} ${squareUnit} ÷ (${count} − 1) = ${trueSumSquares / (count - 1)} ${squareUnit}`,
  ]
  const reviews = [
    ['mean', '① は元の測定値を足して個数で割る段階です。合計と割り算をそれぞれ確かめます。'],
    ['deviation', '② は①で示した平均を使います。その平均からのずれを正しく計算しているか確かめます。'],
    ['variance', '③ は②で示した偏差を二乗して足す段階です。元の測定値に戻る前に、各項と合計を照合します。'],
    ['variance', '④ は③で示した偏差平方和を使います。不偏分散を求めるときに使う分母を確かめます。'],
  ]
  return {
    type: 'choice',
    prompt: `${c.noun}を独立に ${count} 個測り、不偏分散を計算しました。前の段階に示した値を次の段階でも使っています。最初に誤った段階はどれですか。`,
    choices: ['① 平均の計算', '② 偏差の計算', '③ 偏差平方和の計算', '④ 分散の計算'],
    answer: error - 1, sections: ['mean', 'deviation', 'variance'],
    calculation,
    steps: [corrections[error - 1]],
    explanation: explanations[error - 1],
    choiceFeedback: reviews.flatMap(([section, misconception], choiceIndex) => choiceIndex === error - 1
      ? []
      : [{ choiceIndex, misconception, sections: [section] }]),
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
  return choiceQuestion(
    `工程を変更したところ、標準偏差 s が ${before} ${c.unit} から ${after} ${c.unit} になりました。不偏分散 V は何倍になりましたか。`,
    answerChoice(`${factor.labels[1]} 倍`, '分散は標準偏差の二乗なので、標準偏差が変わった倍率を二乗すると、分散の倍率が分かります。'),
    [
      answerChoice(`${factor.labels[0]} 倍`, 'それは標準偏差の倍率です。分散の倍率を求めるには、その倍率を二乗します。'),
      answerChoice(`${factor.labels[2]} 倍`, '平方根を取るのは分散から標準偏差に戻すときです。今回は標準偏差から分散を求めるので二乗します。'),
      answerChoice('1 倍', '変更前後の標準偏差に差があるので、それぞれを二乗した分散も変わります。', ['variance', 'standard-deviation']),
    ],
    ['standard-deviation'], random,
    [
      `変更前は (${before} ${c.unit})² = ${before ** 2} ${c.unit}²、変更後は (${after} ${c.unit})² = ${after ** 2} ${c.unit}² です。`,
      `${after ** 2} ${c.unit}² ÷ ${before ** 2} ${c.unit}² = ${factor.labels[1]} 倍`,
    ],
  )
}

function secondStandardDeviationQuestion(random) {
  const c = context(random)
  const sd = int(random, 1, 4)
  const multiple = int(random, 2, 5)
  const halfWidth = sd * multiple
  const variance = sd * sd
  return {
    type: 'numeric', unit: '倍', answer: decimalAnswer(multiple), sections: ['standard-deviation'],
    prompt: `${c.noun}の規格は、中心値 ${c.base} ${c.unit} に対して ±${halfWidth} ${c.unit} です。工程の不偏分散は ${variance} ${c.unit}² でした。規格の幅の半分（${halfWidth} ${c.unit}）は、標準偏差の何倍ですか。`,
    steps: [
      `s = √(${variance} ${c.unit}²) = ${sd} ${c.unit}`,
      `規格の半幅 ÷ s = ${halfWidth} ${c.unit} ÷ ${sd} ${c.unit} = ${multiple} 倍`,
    ],
    explanation: '分散の平方根を取ると、標準偏差と規格の幅の単位がそろうので、比を求められます。',
  }
}

function thirdStandardDeviationQuestion(random) {
  const c = context(random)
  const variance = randomValue(random) < 0.5
  const correct = variance
    ? answerChoice(`${c.unit}²`, '分散は偏差を二乗して作るので、単位も2乗になり、測定値の単位の2乗です。')
    : answerChoice(c.unit, '標準偏差は分散の平方根なので、測定値と同じ単位です。規格や公差と直接比べられます。')
  const wrong = variance ? [
    answerChoice(c.unit, '測定値と同じ単位を持つのは標準偏差です。分散は偏差の二乗で作ります。', ['variance']),
    answerChoice('単位はない', '偏差は測定値と同じ単位です。偏差の二乗も単位を持ちます。', ['deviation', 'variance']),
    answerChoice(`${c.unit}³`, '分散では、元の測定値と同じ単位をもつ偏差を二乗します。', ['variance']),
  ] : [
    answerChoice(`${c.unit}²`, '二乗の単位は分散の単位です。標準偏差は分散の平方根を取るため、元の単位に戻ります。'),
    answerChoice('単位はない', '標準偏差は、測定値の単位で平均の周りの散らばりを表します。'),
    answerChoice(`1/${c.unit}`, '平方根を取るときに単位を逆数にはしません。測定値と同じ単位に戻ります。'),
  ]
  return choiceQuestion(
    `測定値の単位が ${c.unit} のとき、${variance ? '不偏分散' : '標準偏差'}の単位として正しいものはどれですか。`,
    correct, wrong, ['standard-deviation'], random,
  )
}

const exerciseGroups = [
  { id: 'mean-deviation', title: '平均と偏差', types: [
    { id: 'mean-deviation-average', generate: firstMeanQuestion },
    { id: 'mean-deviation-deviation', generate: secondMeanQuestion },
    { id: 'mean-deviation-meaning', generate: (random) => choiceQuestion('偏差（測定値 − 平均）について、正しい説明はどれですか。', pick(random, deviationCorrect), shuffle(random, deviationWrong).slice(0, 3), ['deviation'], random) },
  ] },
  { id: 'data-transformation', title: 'データの変換', types: [
    { id: 'data-transformation-add-constant', generate: firstTransformationQuestion },
    { id: 'data-transformation-multiply', generate: secondTransformationQuestion },
    { id: 'data-transformation-unit', generate: thirdTransformationQuestion },
  ] },
  { id: 'unbiased-variance', title: '不偏分散', types: [
    { id: 'unbiased-variance-mean-and-sum', generate: firstVarianceQuestion },
    { id: 'unbiased-variance-denominator', generate: secondVarianceQuestion },
    { id: 'unbiased-variance-conditions', generate: thirdVarianceQuestion },
  ] },
  { id: 'comprehensive', title: '総合', types: [
    { id: 'comprehensive-variance-comparison', generate: fourthVarianceQuestion },
    { id: 'comprehensive-standard-deviation-comparison', generate: fifthVarianceQuestion },
    { id: 'comprehensive-calculation-error', generate: fourthIntegratedQuestion },
  ] },
  { id: 'variance-standard-deviation', title: '分散と標準偏差', types: [
    { id: 'variance-standard-deviation-variance', generate: firstStandardDeviationQuestion },
    { id: 'variance-standard-deviation-calculation', generate: secondStandardDeviationQuestion },
    { id: 'variance-standard-deviation-unit', generate: thirdStandardDeviationQuestion },
  ] },
]

export const descriptiveStatisticsExerciseCategories = Object.freeze(exerciseGroups.map(({ id, title, types }) =>
  Object.freeze({ id, title, typeIds: Object.freeze(types.map(({ id: typeId }) => typeId)) })))

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
  return exerciseGroups[categoryIndex].types[typeIndex].generate(seededRandom(seed))
}

export function generateDescriptiveStatisticsExercisePreviewQuestionById(categoryId, typeId, seed) {
  const type = exerciseGroups.find((category) => category.id === categoryId)?.types.find((item) => item.id === typeId)
  if (!type) throw new RangeError('Unknown exercise category or type')
  return type.generate(seededRandom(seed))
}
