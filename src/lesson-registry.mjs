/** @typedef {import('./lesson-contract.mjs').ConditionalPrerequisite} ConditionalPrerequisite */
/** @typedef {import('./lesson-contract.mjs').OptionalReview} OptionalReview */
/** @typedef {import('./lesson-contract.mjs').PlannedLessonDefinition} PlannedLessonDefinition */
/** @typedef {import('./lesson-contract.mjs').SourceDefinition} SourceDefinition */
/** @typedef {import('./lesson-contract.mjs').LessonRegistry} LessonRegistry */

/** @type {SourceDefinition[]} */
const sourceDocuments = [
  {
    sourceId: "jsa-l3",
    title: "3級のレベル表",
    url: "https://webdesk.jsa.or.jp/pdf/qc/md_4609.pdf",
    version: "Ver.20150130.2",
    checkedAt: '2026-10-21',
    purpose: '教材単元と公式出題範囲の対応根拠を確認する。公式本文・設問は転載しない。',
    citations: [
      { sourceItemId: "SRC-0001", location: "p.1「データの取り方とまとめ方」" },
      { sourceItemId: "SRC-0002", location: "p.1「データの取り方とまとめ方」" },
      { sourceItemId: "SRC-0003", location: "p.1" },
      { sourceItemId: "SRC-0004", location: "p.1" },
      { sourceItemId: "SRC-0005", location: "p.1" },
      { sourceItemId: "SRC-0007", location: "p.1「QC七つ道具」" },
      { sourceItemId: "SRC-0008", location: "p.1「QC七つ道具」" },
      { sourceItemId: "SRC-0009", location: "p.1「QC七つ道具」" },
      { sourceItemId: "SRC-0010", location: "p.1「QC七つ道具」" },
      { sourceItemId: "SRC-0011", location: "p.1「QC七つ道具」" },
      { sourceItemId: "SRC-0012", location: "p.1「QC七つ道具」" },
      { sourceItemId: "SRC-0013", location: "p.1「QC七つ道具」" },
      { sourceItemId: "SRC-0014", location: "p.1" },
      { sourceItemId: "SRC-0015", location: "p.1" },
      { sourceItemId: "SRC-0016", location: "p.1" },
      { sourceItemId: "SRC-0017", location: "p.1" },
      { sourceItemId: "SRC-0018", location: "p.1「新QC七つ道具」" },
      { sourceItemId: "SRC-0019", location: "p.1「新QC七つ道具」" },
      { sourceItemId: "SRC-0020", location: "p.1「新QC七つ道具」" },
      { sourceItemId: "SRC-0021", location: "p.1" },
      { sourceItemId: "SRC-0022", location: "p.1" },
      { sourceItemId: "SRC-0038", location: "p.1「管理図」" },
      { sourceItemId: "SRC-0039", location: "p.1「X-R管理図」" },
      { sourceItemId: "SRC-0042", location: "p.1「p管理図、np管理図」" },
      { sourceItemId: "SRC-0044", location: "p.1「工程能力指数」" },
      { sourceItemId: "SRC-0048", location: "p.1には明記なし" },
      { sourceItemId: "SRC-0051", location: "p.1「相関分析」" },
    ],
  },
  {
    sourceId: "jsa-l4",
    title: "4級のレベル表",
    url: "https://webdesk.jsa.or.jp/pdf/qc/md_4610.pdf",
    version: "Ver.20150130.2",
    checkedAt: '2026-10-21',
    purpose: '教材単元と公式出題範囲の対応根拠を確認する。公式本文・設問は転載しない。',
    citations: [
      { sourceItemId: "SRC-0001", location: "p.1「事実に基づく判断」" },
      { sourceItemId: "SRC-0003", location: "p.1「事実に基づく判断」" },
      { sourceItemId: "SRC-0004", location: "p.1「データの基礎」" },
      { sourceItemId: "SRC-0005", location: "p.1「平均とばらつき」「平均と範囲」" },
      { sourceItemId: "SRC-0010", location: "p.1「平均とばらつき」" },
      { sourceItemId: "SRC-0038", location: "p.1のばらつき・工程基礎" },
    ],
  },
  {
    sourceId: "jsa-l2",
    title: "2級のレベル表",
    url: "https://webdesk.jsa.or.jp/pdf/qc/md_4927.pdf",
    version: "Ver.20150130.2",
    checkedAt: '2026-10-21',
    purpose: '教材単元と公式出題範囲の対応根拠を確認する。公式本文・設問は転載しない。',
    citations: [
      { sourceItemId: "SRC-0006", location: "p.1「データの取り方とまとめ方」" },
      { sourceItemId: "SRC-0014", location: "p.1「新QC七つ道具」" },
      { sourceItemId: "SRC-0015", location: "p.1「新QC七つ道具」" },
      { sourceItemId: "SRC-0016", location: "p.1「新QC七つ道具」" },
      { sourceItemId: "SRC-0017", location: "p.1「新QC七つ道具」" },
      { sourceItemId: "SRC-0018", location: "p.1では項目名の明記なし" },
      { sourceItemId: "SRC-0019", location: "p.1では項目名の明記なし" },
      { sourceItemId: "SRC-0020", location: "p.1では項目名の明記なし" },
      { sourceItemId: "SRC-0021", location: "p.1「統計的方法の基礎」" },
      { sourceItemId: "SRC-0022", location: "p.1「統計的方法の基礎」" },
      { sourceItemId: "SRC-0023", location: "p.1「統計的方法の基礎」" },
      { sourceItemId: "SRC-0024", location: "p.1「統計的方法の基礎」" },
      { sourceItemId: "SRC-0025", location: "p.1「統計的方法の基礎」" },
      { sourceItemId: "SRC-0026", location: "p.1「統計的方法の基礎」" },
      { sourceItemId: "SRC-0027", location: "p.1「計量値データに基づく検定と推定」" },
      { sourceItemId: "SRC-0028", location: "p.1「計量値データに基づく検定と推定」" },
      { sourceItemId: "SRC-0029", location: "p.1「計量値データに基づく検定と推定」" },
      { sourceItemId: "SRC-0030", location: "p.1「計量値データに基づく検定と推定」" },
      { sourceItemId: "SRC-0031", location: "p.1「計量値データに基づく検定と推定」" },
      { sourceItemId: "SRC-0032", location: "p.1「計量値データに基づく検定と推定」" },
      { sourceItemId: "SRC-0033", location: "p.1「計数値データに基づく検定と推定」" },
      { sourceItemId: "SRC-0034", location: "p.1「計数値データに基づく検定と推定」" },
      { sourceItemId: "SRC-0035", location: "p.1「計数値データに基づく検定と推定」" },
      { sourceItemId: "SRC-0036", location: "p.1「計数値データに基づく検定と推定」" },
      { sourceItemId: "SRC-0037", location: "p.1「計数値データに基づく検定と推定」" },
      { sourceItemId: "SRC-0040", location: "p.1のテキスト抽出は「X − s管理図」" },
      { sourceItemId: "SRC-0041", location: "p.1「管理図」" },
      { sourceItemId: "SRC-0042", location: "p.1「管理図」" },
      { sourceItemId: "SRC-0043", location: "p.1「管理図」" },
      { sourceItemId: "SRC-0044", location: "p.1「工程能力調査、工程解析」との重なり" },
      { sourceItemId: "SRC-0046", location: "p.1「検査の種類と方法」と関連" },
      { sourceItemId: "SRC-0047", location: "p.1「検査の種類と方法」と関連" },
      { sourceItemId: "SRC-0048", location: "p.1「実験計画法」" },
      { sourceItemId: "SRC-0049", location: "p.1「実験計画法」" },
      { sourceItemId: "SRC-0050", location: "p.1「実験計画法」" },
      { sourceItemId: "SRC-0052", location: "p.1「相関分析」" },
      { sourceItemId: "SRC-0053", location: "p.1「単回帰分析」" },
      { sourceItemId: "SRC-0054", location: "p.1「単回帰分析」" },
      { sourceItemId: "SRC-0055", location: "p.1「単回帰分析」" },
      { sourceItemId: "SRC-0044", location: "p.1「品質保証：プロセス保証」" },
      { sourceItemId: "SRC-0062", location: "p.1「品質保証：プロセス保証」" },
      { sourceItemId: "SRC-0063", location: "p.1「品質保証：プロセス保証」" },
    ],
  },
  {
    sourceId: "jsa-m",
    title: "品質管理検定マトリックス（手法編）",
    url: "https://webdesk.jsa.or.jp/pdf/qc/md_4806.pdf",
    version: "Ver.20150130.2",
    checkedAt: '2026-10-21',
    purpose: '教材単元と公式出題範囲の対応根拠を確認する。公式本文・設問は転載しない。',
    citations: [
      { sourceItemId: "SRC-0040", location: "p.1は「Xbar-s管理図」" },
      { sourceItemId: "SRC-0045", location: "p.1に明示" },
      { sourceItemId: "SRC-0046", location: "p.1に明示" },
      { sourceItemId: "SRC-0047", location: "p.1に明示" },
    ],
  },
  {
    sourceId: "jsa-p",
    title: "品質管理検定マトリックス（実践編）",
    url: "https://webdesk.jsa.or.jp/pdf/qc/md_4606.pdf",
    version: "Ver.20150130.2",
    checkedAt: '2026-10-21',
    purpose: '教材単元と公式出題範囲の対応根拠を確認する。公式本文・設問は転載しない。',
    citations: [
      { sourceItemId: "SRC-0044", location: "p.1「工程能力調査、工程解析」" },
      { sourceItemId: "SRC-0044", location: "p.1「工程能力指数」（2級○、3級△）" },
      { sourceItemId: "SRC-0062", location: "p.1（2級○、3級○）" },
      { sourceItemId: "SRC-0063", location: "p.1（2級○、3級○）" },
    ],
  },
]

/** @param {string[]} sourceItemIds */
function sourceRefsFor(sourceItemIds) {
  const used = new Set(sourceItemIds)
  return sourceDocuments
    .filter((source) => source.citations.some((citation) => used.has(citation.sourceItemId)))
    .map((source) => source.sourceId)
}

/**
 * @param {string} lessonId
 * @param {string} title
 * @param {string} objective
 * @param {string[]} declaredSectionIds
 * @param {string[]} commonPrerequisites
 * @param {string[]} sourceItemIds
 * @param {ConditionalPrerequisite[]} [conditionalPrerequisites]
 * @param {OptionalReview[]} [optionalReviews]
 * @returns {PlannedLessonDefinition}
 */
function plannedLesson(
  lessonId,
  title,
  objective,
  declaredSectionIds,
  commonPrerequisites,
  sourceItemIds,
  conditionalPrerequisites = [],
  optionalReviews = [],
) {
  return {
    availability: 'planned',
    lessonId,
    title,
    learningObjectives: [objective],
    declaredSectionIds,
    commonPrerequisites,
    conditionalPrerequisites,
    optionalReviews,
    questionIds: [],
    sourceItemIds,
    sourceRefs: sourceRefsFor(sourceItemIds),
    revision: 1,
  }
}

/** @type {LessonRegistry['lessons']} */
const lessons = [
  plannedLesson('math-arithmetic', '四則計算と単位', '整数・小数・負数の四則計算、単位、計算順序を使う。', [], [], []),
  plannedLesson('math-ratios-percentages', '分数・比・割合', '分数・比・割合・百分率・比率を相互変換し、丸めを説明する。', [], ['math-arithmetic'], []),
  plannedLesson('math-powers-roots', '指数と平方根', '指数・平方根を計算し、式中の意味を説明する。', [], ['math-arithmetic'], []),
  plannedLesson('math-algebra-sigma', '文字式と総和記号', '文字式・一次式・式変形・総和記号を使って統計式を読む。', ['sigma'], ['math-ratios-percentages', 'math-powers-roots'], []),
  plannedLesson('math-counting', '数え方の基本', '積の法則・順列・組合せの基本を数える。', [], ['math-ratios-percentages'], []),
  plannedLesson('data-types', 'データの種類', '計量値・計数値、カテゴリ・数値、単位と観測単位を区別する。', [], [], ['SRC-0001']),
  plannedLesson('population-sample', '母集団と標本', '母集団・標本・抽出単位・推定対象を例で区別する。', [], ['data-types'], ['SRC-0003']),
  plannedLesson('descriptive-statistics', '基本統計量', '平均・範囲・分散・標準偏差を計算し、分布の中心と散らばりを説明する。', ['mean', 'variance', 'standard-deviation'], ['data-types', 'math-ratios-percentages', 'math-powers-roots'], ['SRC-0005'], [], [
    { fromRef: 'descriptive-statistics#variance', targetRef: 'math-algebra-sigma#sigma', context: '分散式でΣを初めて使うとき。分散節でも記号の意味を説明し、必要なら総和記号の復習を開けるようにする。' },
  ]),
  plannedLesson('sampling', '標本抽出と誤差', '標本抽出・誤差・抽出方式を区別し、標本からの一般化の限界を説明する。', ['error', 'design'], ['population-sample', 'descriptive-statistics'], ['SRC-0004', 'SRC-0006']),
  plannedLesson('data-transform', 'データ変換', '変換の目的、尺度、変換前後の解釈を説明する。', [], ['data-types', 'math-algebra-sigma'], ['SRC-0002']),
  plannedLesson('qc-seven-tools', 'QC七つ道具', '七つ道具を目的に応じて選び、作成・読取り・結論の限界を説明する。', ['pareto', 'cause-effect', 'check-sheet', 'histogram', 'scatter', 'graphs', 'stratification'], ['data-types'], ['SRC-0007', 'SRC-0008', 'SRC-0009', 'SRC-0010', 'SRC-0011', 'SRC-0012', 'SRC-0013'], [], [
    { fromRef: 'qc-seven-tools', targetRef: 'descriptive-statistics', context: 'ヒストグラムや散布図を読む際に、中心・散らばりの見方を振り返る場合。' },
  ]),
  plannedLesson('new-qc-tools', '新QC七つ道具', '新QC七つ道具の用途、基本手順、読み方を説明する。', ['affinity', 'relations', 'tree', 'matrix', 'arrow', 'pdpc', 'matrix-data'], [], ['SRC-0014', 'SRC-0015', 'SRC-0016', 'SRC-0017', 'SRC-0018', 'SRC-0019', 'SRC-0020'], [], [
    { fromRef: 'new-qc-tools', targetRef: 'qc-seven-tools', context: '図表による整理の経験があると手順を理解しやすい場合。必修の順序にはしない。' },
  ]),
  plannedLesson('probability-foundations', '確率の基礎', '事象・確率・独立・条件付き確率の基本を計算・解釈する。', [], ['math-ratios-percentages'], []),
  plannedLesson('random-variables', '確率変数', '離散・連続確率変数、確率分布、期待値・分散を結び付ける。', [], ['probability-foundations', 'math-algebra-sigma'], ['SRC-0025']),
  plannedLesson('normal-distribution', '正規分布', '正規分布を標準化し、条件を確認して確率を計算する。', [], ['random-variables', 'math-powers-roots'], ['SRC-0021']),
  plannedLesson('binomial-distribution', '二項分布', '独立・一定確率の試行回数として二項分布を扱い、確率を計算する。', [], ['random-variables', 'probability-foundations', 'math-counting'], ['SRC-0022']),
  plannedLesson('poisson-distribution', 'ポアソン分布', '一定の機会・曝露に対する計数モデルとしてポアソン分布を扱う。', [], ['random-variables', 'probability-foundations'], ['SRC-0023']),
  plannedLesson('sampling-distributions', '標本分布', '標本統計量の共通的な標本分布と標準誤差を説明し、t・カイ二乗・Fの節を条件に応じて使う。', ['common', 't', 'chi-square', 'f'], ['population-sample', 'descriptive-statistics', 'random-variables'], ['SRC-0024']),
  plannedLesson('law-large-numbers-clt', '大数の法則と中心極限定理', '大数の法則と中心極限定理の主張・条件・用途を区別する。', [], ['random-variables', 'descriptive-statistics'], ['SRC-0026']),
  plannedLesson('inference-basics', '推定と検定の基礎', '推定と検定、帰無仮説、信頼区間、p値、誤りの意味を説明する。', [], ['population-sample', 'probability-foundations'], ['SRC-0027']),
  plannedLesson('mean-inference', '母平均の推定・検定', '母平均の区間推定・検定を条件別に選び、計算と結論を解釈する。', ['z', 't', 'large-sample'], ['inference-basics', 'descriptive-statistics', 'sampling-distributions#common'], ['SRC-0028'], [
    { conditionId: 'mean-inference-z-normal-model', methodSectionRef: 'mean-inference#z', condition: '母標準偏差が既知で、正規母集団を仮定するz法を選ぶ場合。', prerequisiteRef: 'normal-distribution' },
    { conditionId: 'mean-inference-t-sampling-distribution', methodSectionRef: 'mean-inference#t', condition: '母標準偏差が未知で、t法を選ぶ場合。', prerequisiteRef: 'sampling-distributions#t' },
    { conditionId: 'mean-inference-t-small-sample-normality', methodSectionRef: 'mean-inference#t', condition: 't法を小標本で使い、母集団の正規性を仮定する場合。', prerequisiteRef: 'normal-distribution' },
    { conditionId: 'mean-inference-large-sample-clt', methodSectionRef: 'mean-inference#large-sample', condition: '大標本近似を使い、標本サイズと近似条件を判断する場合。', prerequisiteRef: 'law-large-numbers-clt' },
  ]),
  plannedLesson('variance-inference', '1母分散の推定・検定', '1母分散の推定・検定を分布仮定と自由度を明示して解釈する。', ['chi-square'], ['inference-basics', 'descriptive-statistics', 'sampling-distributions#common'], ['SRC-0029'], [
    { conditionId: 'variance-inference-chi-square-distribution', methodSectionRef: 'variance-inference#chi-square', condition: '正規母集団を前提とするカイ二乗法を選ぶ場合。', prerequisiteRef: 'sampling-distributions#chi-square' },
    { conditionId: 'variance-inference-normal-population', methodSectionRef: 'variance-inference#chi-square', condition: '分散推論に正規母集団の仮定を置く場合。', prerequisiteRef: 'normal-distribution' },
  ]),
  plannedLesson('variance-ratio-inference', '2母分散の比の推定・検定', '2母分散の比の推定・検定を独立性・分布条件とともに扱う。', ['f'], ['variance-inference', 'sampling-distributions#common'], ['SRC-0030'], [
    { conditionId: 'variance-ratio-inference-f-distribution', methodSectionRef: 'variance-ratio-inference#f', condition: '独立な正規母集団の分散比をF法で比較する場合。', prerequisiteRef: 'sampling-distributions#f' },
    { conditionId: 'variance-ratio-inference-normal-populations', methodSectionRef: 'variance-ratio-inference#f', condition: '独立な正規母集団を仮定するF法を選ぶ場合。', prerequisiteRef: 'normal-distribution' },
  ]),
  plannedLesson('mean-difference-inference', '2母平均差の推定・検定', '独立2標本の母平均差を、等分散・Welch等の方法条件を区別して扱う。', ['pooled-t', 'welch', 'large-sample'], ['mean-inference', 'sampling-distributions#common'], ['SRC-0031'], [
    { conditionId: 'mean-difference-large-sample-clt', methodSectionRef: 'mean-difference-inference#large-sample', condition: '独立2標本の平均差に大標本近似を使う場合。', prerequisiteRef: 'law-large-numbers-clt' },
    { conditionId: 'mean-difference-pooled-t-distribution', methodSectionRef: 'mean-difference-inference#pooled-t', condition: '等分散を仮定するpooled t法を選ぶ場合。', prerequisiteRef: 'sampling-distributions#t' },
    { conditionId: 'mean-difference-pooled-t-normality', methodSectionRef: 'mean-difference-inference#pooled-t', condition: 'pooled t法を小標本で使い、各母集団の正規性を仮定する場合。', prerequisiteRef: 'normal-distribution' },
    { conditionId: 'mean-difference-welch-t-distribution', methodSectionRef: 'mean-difference-inference#welch', condition: '等分散を置かないWelch法を選ぶ場合。', prerequisiteRef: 'sampling-distributions#t' },
    { conditionId: 'mean-difference-welch-normality', methodSectionRef: 'mean-difference-inference#welch', condition: 'Welch法を小標本で使い、各母集団の正規性を仮定する場合。', prerequisiteRef: 'normal-distribution' },
  ]),
  plannedLesson('paired-inference', '対応データの推定・検定', '対応データを差に変換し、差の平均を推定・検定する。', ['t', 'large-sample'], ['mean-inference', 'descriptive-statistics', 'sampling-distributions#common'], ['SRC-0032'], [
    { conditionId: 'paired-inference-large-sample-clt', methodSectionRef: 'paired-inference#large-sample', condition: '対応差の平均に大標本近似を使う場合。', prerequisiteRef: 'law-large-numbers-clt' },
    { conditionId: 'paired-inference-t-distribution', methodSectionRef: 'paired-inference#t', condition: '対応差にt法を使う場合。', prerequisiteRef: 'sampling-distributions#t' },
    { conditionId: 'paired-inference-t-small-sample-normality', methodSectionRef: 'paired-inference#t', condition: '対応差のt法を小標本で使い、差の正規性を仮定する場合。', prerequisiteRef: 'normal-distribution' },
  ]),
  plannedLesson('proportion-count-inference', '不適合品率・不適合数の推定・検定', '母不適合品率・不適合数とその2標本比較を、データ型・条件別に扱う。', ['rate', 'count'], ['inference-basics', 'probability-foundations'], ['SRC-0033', 'SRC-0034', 'SRC-0035', 'SRC-0036'], [
    { conditionId: 'proportion-count-rate-binomial-model', methodSectionRef: 'proportion-count-inference#rate', condition: '不適合品率を二項法で推論する場合。', prerequisiteRef: 'binomial-distribution' },
    { conditionId: 'proportion-count-rate-normal-approximation', methodSectionRef: 'proportion-count-inference#rate', condition: '不適合品率に正規近似を使い、期待成功数・失敗数の条件を満たす場合。', prerequisiteRef: 'normal-distribution' },
    { conditionId: 'proportion-count-count-poisson-model', methodSectionRef: 'proportion-count-inference#count', condition: '一定曝露量あたりの不適合数をPoisson法で推論する場合。', prerequisiteRef: 'poisson-distribution' },
  ]),
  plannedLesson('contingency-tests', '分割表による検定', '分割表で独立性等を検定し、期待度数条件と結論を解釈する。', ['pearson'], ['inference-basics', 'probability-foundations', 'sampling-distributions#common'], ['SRC-0037'], [
    { conditionId: 'contingency-tests-pearson-chi-square', methodSectionRef: 'contingency-tests#pearson', condition: '観測の独立性と期待度数の条件を確認してPearsonのカイ二乗検定を選ぶ場合。', prerequisiteRef: 'sampling-distributions#chi-square' },
  ]),
  plannedLesson('control-charts', '管理図', '管理図の目的と限界を説明し、計量・計数の図を条件に応じて選ぶ。', ['basics', 'xbar-r', 'xbar-s', 'x-rs', 'p-np', 'u-c'], ['data-types', 'descriptive-statistics', 'sampling'], ['SRC-0038', 'SRC-0039', 'SRC-0040', 'SRC-0041', 'SRC-0042', 'SRC-0043'], [
    { conditionId: 'control-charts-xbar-r-normal-model', methodSectionRef: 'control-charts#xbar-r', condition: '標準的な限界係数と確率解釈を伴うXbar-R図を使う場合。', prerequisiteRef: 'normal-distribution' },
    { conditionId: 'control-charts-xbar-s-normal-model', methodSectionRef: 'control-charts#xbar-s', condition: '標準的な限界係数と確率解釈を伴うXbar-s図を使う場合。', prerequisiteRef: 'normal-distribution' },
    { conditionId: 'control-charts-x-rs-normal-model', methodSectionRef: 'control-charts#x-rs', condition: '標準的な限界係数と確率解釈を伴うX-Rs図を使う場合。', prerequisiteRef: 'normal-distribution' },
    { conditionId: 'control-charts-p-np-binomial-model', methodSectionRef: 'control-charts#p-np', condition: '不適合品率を二項計数で扱うp図またはnp図を使う場合。', prerequisiteRef: 'binomial-distribution' },
    { conditionId: 'control-charts-u-c-poisson-model', methodSectionRef: 'control-charts#u-c', condition: '単位あたり不適合数をPoisson計数で扱うu図またはc図を使う場合。', prerequisiteRef: 'poisson-distribution' },
  ], [
    { fromRef: 'control-charts', targetRef: 'qc-seven-tools#graphs', context: '管理図の線・軸・記録値の見方を一般的なグラフから復習する場合。' },
  ]),
  plannedLesson('process-capability', '工程能力指数', '工程の安定性や分布条件を確認し、選んだ方法の工程能力指数を計算・解釈する。', ['capability'], ['descriptive-statistics', 'sampling'], ['SRC-0044'], [
    { conditionId: 'process-capability-normal-process', methodSectionRef: 'process-capability#capability', condition: '安定した正規工程にCp/Cpkを適用する場合。', prerequisiteRef: 'normal-distribution' },
    { conditionId: 'process-capability-sampling', methodSectionRef: 'process-capability#capability', condition: '安定性の確認に標本データを用いる場合。', prerequisiteRef: 'sampling' },
  ], [
    { fromRef: 'process-capability', targetRef: 'control-charts#basics', context: '工程の安定性を管理図で確認する学習へ戻る場合。管理図を使わない確認方法を排除しない。' },
  ]),
  plannedLesson('sampling-inspection', '抜取検査', 'ロット・抽出・判定の関係と計数・計量方式を説明する。', ['purpose', 'types', 'attribute', 'variable'], ['population-sample', 'data-types', 'probability-foundations'], ['SRC-0045', 'SRC-0046', 'SRC-0047', 'SRC-0062', 'SRC-0063'], [
    { conditionId: 'sampling-inspection-attribute-binomial-model', methodSectionRef: 'sampling-inspection#attribute', condition: '計数結果でロットを判定し、採用する計画が二項モデルに基づく場合。', prerequisiteRef: 'binomial-distribution' },
    { conditionId: 'sampling-inspection-variable-normal-model', methodSectionRef: 'sampling-inspection#variable', condition: '計量値でロットを判定し、採用する計画が正規モデルに基づく場合。', prerequisiteRef: 'normal-distribution' },
  ]),
  plannedLesson('experimental-design', '実験計画法', '因子・水準・応答・実験単位を定め、1元・2元配置を条件付きで分析する。', ['one-factor', 'two-factor'], ['data-types', 'descriptive-statistics'], ['SRC-0048', 'SRC-0049', 'SRC-0050'], [
    { conditionId: 'experimental-design-one-factor-inference', methodSectionRef: 'experimental-design#one-factor', condition: '一元配置実験で群平均を分散分析により比較する場合。', prerequisiteRef: 'inference-basics' },
    { conditionId: 'experimental-design-one-factor-f-distribution', methodSectionRef: 'experimental-design#one-factor', condition: '一元配置実験の群平均比較でF分布を用いる場合。残差の独立性・分散・分布条件も確認する。', prerequisiteRef: 'sampling-distributions#f' },
    { conditionId: 'experimental-design-two-factor-inference', methodSectionRef: 'experimental-design#two-factor', condition: '二元配置実験で主効果または交互作用を推論する場合。', prerequisiteRef: 'inference-basics' },
    { conditionId: 'experimental-design-two-factor-f-distribution', methodSectionRef: 'experimental-design#two-factor', condition: '二元配置実験でF分布を用いる場合。実験配置と誤差の条件も確認する。', prerequisiteRef: 'sampling-distributions#f' },
  ], [
    { fromRef: 'experimental-design', targetRef: 'qc-seven-tools#graphs', context: '因子・応答を図で比べる例を復習する場合。' },
  ]),
  plannedLesson('correlation', '相関係数', '相関係数の意味・計算・限界を説明する。', [], ['data-types', 'descriptive-statistics'], ['SRC-0051'], [], [
    { fromRef: 'correlation', targetRef: 'qc-seven-tools#scatter', context: '相関係数の前に散布図で二変数の関係を確認する場合。' },
  ]),
  plannedLesson('serial-correlation', '系列相関', '時系列順の相関が独立観測の前提に与える影響を説明する。', [], ['correlation'], ['SRC-0052']),
  plannedLesson('simple-regression', '単回帰分析', '単回帰式と残差の基本を説明し、推論を行う場合は方法条件を確認する。', ['anova', 'residuals'], ['correlation', 'math-algebra-sigma'], ['SRC-0053', 'SRC-0054', 'SRC-0055'], [
    { conditionId: 'simple-regression-anova-inference', methodSectionRef: 'simple-regression#anova', condition: '回帰の推論を行う場合。', prerequisiteRef: 'inference-basics' },
    { conditionId: 'simple-regression-anova-common-distribution', methodSectionRef: 'simple-regression#anova', condition: '回帰推論の標本分布に共通する考え方を用いる場合。', prerequisiteRef: 'sampling-distributions#common' },
    { conditionId: 'simple-regression-anova-t-distribution', methodSectionRef: 'simple-regression#anova', condition: '回帰係数の区間推定・t検定を行い、残差条件を確認する場合。', prerequisiteRef: 'sampling-distributions#t' },
    { conditionId: 'simple-regression-anova-f-distribution', methodSectionRef: 'simple-regression#anova', condition: 'モデル全体のF検定を行い、残差条件を確認する場合。', prerequisiteRef: 'sampling-distributions#f' },
  ], [
    { fromRef: 'simple-regression', targetRef: 'qc-seven-tools#scatter', context: '回帰式を読む前に散布図で関係・外れ値候補を確認する場合。' },
  ]),
]

/** @type {LessonRegistry} */
export const lessonRegistry = {
  curriculumRevision: 1,
  officialSourceItemIds: Array.from({ length: 64 }, (_, index) => `SRC-${String(index + 1).padStart(4, '0')}`),
  sources: sourceDocuments,
  lessons,
}
