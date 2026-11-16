/** @typedef {import('./lesson-contract.mjs').ConditionalPrerequisite} ConditionalPrerequisite */
/** @typedef {import('./lesson-contract.mjs').LessonDomain} LessonDomain */
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
      { sourceItemId: "SRC-0044", location: "p.1「工程能力指数の計算と評価方法」" },
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
      { sourceItemId: "SRC-0044", location: "p.1「工程能力調査，工程解析」" },
      { sourceItemId: "SRC-0044", location: "p.1「工程能力調査，工程解析」（2級○、3級△）" },
      { sourceItemId: "SRC-0062", location: "p.1「検査の目的・意義・考え方(適合，不適合)」（2級○、3級○）" },
      { sourceItemId: "SRC-0063", location: "p.1「検査の種類と方法」（2級○、3級○）" },
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
 * @param {LessonDomain} domain
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
  domain,
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
    domain,
    learningObjectives: [objective],
    declaredSectionIds,
    commonPrerequisites,
    conditionalPrerequisites,
    optionalReviews,
    sourceItemIds,
    sourceRefs: sourceRefsFor(sourceItemIds),
    revision: 1,
  }
}

/** @type {LessonRegistry['lessons']} */
const lessons = [
  {
    availability: 'included',
    lessonId: 'math-arithmetic',
    title: '四則計算と単位',
    domain: 'math-foundations',
    learningObjectives: ['整数・小数・負数の四則計算、単位、計算順序を使う。'],
    declaredSectionIds: ['operations'],
    commonPrerequisites: [],
    conditionalPrerequisites: [],
    optionalReviews: [],
    sourceItemIds: [],
    sourceRefs: [],
    revision: 2,
    sections: [{
      sectionId: 'operations',
      title: '四則計算と単位',
      blocks: [
        { kind: 'paragraph', parts: [{ kind: 'text', text: '括弧の内側、累乗、掛け算・割り算、足し算・引き算の順に計算し、同じ優先順位の演算は左から進めます。同じ単位の量を足し引きし、異なる単位なら先に換算します。積と商では数値と一緒に単位も計算します。単位のない数を掛けても単位は変わりません。' }] },
        { kind: 'paragraph', parts: [{ kind: 'text', text: '例：0.12 cm を mm に直すと 1.2 mm です。そこで 1.2 mm + 0.8 mm = 2.0 mm、0.8 mm − 1.2 mm = −0.4 mm となります。長さに 2 を掛ける例では 0.5 mm × 2 = 1.0 mm です。' }] },
        { kind: 'formula', parts: [{ kind: 'mathText', text: '(1.2 mm + 0.8 mm) / 2 = 1.0 mm; 5 mm / (2 s) = 2.5 mm/s' }] },
        { kind: 'paragraph', parts: [{ kind: 'text', text: '前の式では 2 は測定個数で単位を持たないため、平均の単位は mm のままです。後の式では秒が分母に残り、速度のように mm/s という単位付きの率になります。' }] },
        { kind: 'paragraph', parts: [{ kind: 'text', text: '出典（確認日：2026-10-23）：OpenStax, Prealgebra 2e, §2.1 “Use the Language of Algebra”、§5.2 “Decimal Operations”、§7.5 “Systems of Measurement”。各節の直接URLは https://openstax.org/books/prealgebra-2e/pages/2-1-use-the-language-of-algebra 、https://openstax.org/books/prealgebra-2e/pages/5-2-decimal-operations 、https://openstax.org/books/prealgebra-2e/pages/7-5-systems-of-measurement 。演算順序、小数の四則、単位換算の確認に使用。' }] },
      ],
    }],
    figures: [],
  },
  {
    availability: 'included',
    lessonId: 'math-ratios-percentages',
    title: '分数・比・割合',
    domain: 'math-foundations',
    learningObjectives: ['分数・比・割合・百分率・比率を相互変換し、丸めを説明する。'],
    declaredSectionIds: ['ratio'],
    commonPrerequisites: ['math-arithmetic'],
    conditionalPrerequisites: [],
    optionalReviews: [],
    sourceItemIds: [],
    sourceRefs: [],
    revision: 2,
    sections: [{
      sectionId: 'ratio',
      title: '比・割合・百分率',
      blocks: [
        { kind: 'paragraph', parts: [{ kind: 'text', text: '比は二つの数量の大きさを順序付きで比べる表し方です。同じ単位なら単位をそろえた後に約分できます。全体に占める部分の割合は「部分 / 全体」で、百分率は割合を 100 倍した値です。分母は、何を全体として数えたかを表します。' }] },
        { kind: 'paragraph', parts: [{ kind: 'text', text: '例：300 個を検査して不適合品が 12 個なら、不適合品数と検査総数の比は 12:300 = 1:25 です。全体を検査した 300 個とする割合は 12 / 300 = 0.04 = 4% です。比の 1:25 は二つの数量の比較、4% は検査総数を全体とした割合です。' }] },
        { kind: 'paragraph', parts: [{ kind: 'text', text: '例：不適合品 7 個 / 検査 300 個では、割合は 7 / 300 = 0.023333…（3 が続く）です。百分率に直すと 2.3333…% となり、百分率の小数第 1 位で最後に丸めると約 2.3% です。途中で丸めないことで、変換と丸めを区別できます。逆に 4% = 4 / 100 = 0.04 = 1 / 25 です。' }] },
        { kind: 'formula', parts: [{ kind: 'mathText', text: '部分 / 全体 = 割合; 百分率（%） = 割合 × 100; a / 0 は定義できない' }] },
        { kind: 'paragraph', parts: [{ kind: 'text', text: '分母が 0 の割り算は定義できないため、その割合や率も定義できません。異なる単位の数量の商は単位を消さず、たとえば 5 mm / (2 s) = 2.5 mm/s のような単位付きの率になります。' }] },
        { kind: 'paragraph', parts: [{ kind: 'text', text: '出典（確認日：2026-10-23）：OpenStax, Prealgebra 2e, §5.6 “Ratios and Rate”、§6.1 “Understand Percent”、§6.5 “Solve Proportions and Their Applications”。各節の直接URLは https://openstax.org/books/prealgebra-2e/pages/5-6-ratios-and-rate 、https://openstax.org/books/prealgebra-2e/pages/6-1-understand-percent 、https://openstax.org/books/prealgebra-2e/pages/6-5-solve-proportions-and-their-applications 。比・率・百分率の定義と変換の確認に使用。' }] },
      ],
    }],
    figures: [],
  },
  {
    availability: 'included',
    lessonId: 'math-powers-roots',
    title: '指数と平方根',
    domain: 'math-foundations',
    learningObjectives: ['指数・平方根を計算し、式中の意味を説明する。'],
    declaredSectionIds: ['powers-roots'],
    commonPrerequisites: ['math-arithmetic'],
    conditionalPrerequisites: [],
    optionalReviews: [],
    sourceItemIds: [],
    sourceRefs: [],
    revision: 2,
    sections: [{
      sectionId: 'powers-roots',
      title: '累乗と平方根',
      blocks: [
        { kind: 'paragraph', parts: [{ kind: 'text', text: '二乗は同じ量を 2 回掛けることです。単位も掛け合わせるので、長さを二乗した量の単位は平方ミリメートル（mm²）になります。平方根の記号 √ は、二乗すると元の数になる非負の主平方根を表します。' }] },
        { kind: 'formula', parts: [{ kind: 'mathText', text: '(0.5 mm)² = 0.25 mm²; √(0.25 mm²) = 0.5 mm' }] },
        { kind: 'paragraph', parts: [{ kind: 'text', text: '例：−0.5 mm も二乗すると 0.25 mm² ですが、その平方根は −0.5 mm ではなく 0.5 mm です。実数 x について √(x²) = |x| なので、平方根を取った結果を常に x と同じ符号だとは考えません。' }] },
        { kind: 'paragraph', parts: [{ kind: 'text', text: '出典（確認日：2026-10-23）：OpenStax, Prealgebra 2e, §10.2 “Use Multiplication Properties of Exponents”、§5.7 “Simplify and Use Square Roots”。各節の直接URLは https://openstax.org/books/prealgebra-2e/pages/10-2-use-multiplication-properties-of-exponents 、https://openstax.org/books/prealgebra-2e/pages/5-7-simplify-and-use-square-roots 。累乗の意味、平方根の主値、負数を含む平方の確認に使用。' }] },
      ],
    }],
    figures: [],
  },
  {
    availability: 'included',
    lessonId: 'math-algebra-sigma',
    title: '文字式と総和記号',
    domain: 'math-foundations',
    learningObjectives: ['文字式・一次式・式変形・総和記号を使って統計式を読む。'],
    declaredSectionIds: ['sigma'],
    commonPrerequisites: ['math-ratios-percentages', 'math-powers-roots'],
    conditionalPrerequisites: [],
    optionalReviews: [],
    sourceItemIds: [],
    sourceRefs: [],
    revision: 2,
    sections: [{
      sectionId: 'sigma',
      title: '文字式と総和記号',
      blocks: [
        { kind: 'paragraph', parts: [{ kind: 'text', text: 'Σ は「足し合わせる」を表します。Σ_{i=1}^{3} の下の i = 1 は添字の開始位置、上の 3 は終了位置、右側の x_i は各位置で足す項です。i に 1、2、3 を順に代入して展開します。' }] },
        { kind: 'formula', parts: [{ kind: 'mathText', text: 'Σ_{i=1}^{3} x_i = x_1 + x_2 + x_3' }] },
        { kind: 'paragraph', parts: [{ kind: 'text', text: '例：x_1 = 1 mm、x_2 = 2 mm、x_3 = 3 mm なら、Σ_{i=1}^{3} x_i = 1 mm + 2 mm + 3 mm = 6 mm です。これは記号を展開して値を足す練習です。' }] },
        { kind: 'paragraph', parts: [{ kind: 'text', text: 'xᵢ − 2 mm は、xᵢ についての一次式で、係数は単位のない 1、定数項は −2 mm です。yᵢ = xᵢ − 2 mm の両辺に同じ 2 mm を足すと yᵢ + 2 mm = xᵢ、つまり xᵢ = yᵢ + 2 mm になります。yᵢ は基準値 2 mm からの差を表し、単位は mm のままです。' }] },
        { kind: 'formula', parts: [{ kind: 'mathText', text: 'Σ_{i=1}^{3} (x_i − 2 mm)² = (1 mm − 2 mm)² + (2 mm − 2 mm)² + (3 mm − 2 mm)² = 2 mm²' }] },
        { kind: 'paragraph', parts: [{ kind: 'text', text: 'この式では、まず括弧内の差を計算し、その各項を二乗してから足します。差の単位は mm、二乗後と合計の単位は mm² です。ここでは総和を展開して文字式を読むだけで、分散の定義や計算手順は扱いません。' }] },
        { kind: 'paragraph', parts: [{ kind: 'text', text: 'この節の共通必須前提は、比・割合と累乗・平方根の計算です。共通必須前提はこの節を学ぶ前に必要な内容です。一方、分散節から Σ へ進む経路は必要に応じて使う任意復習であり、分散を学ぶ全員にこの節の先行学習を求めるものではありません。各前提単元の内容は同じ1節内にあります。' }] },
        { kind: 'paragraph', parts: [{ kind: 'text', text: '出典（確認日：2026-10-23）：OpenStax, Introductory Statistics 2e, Appendix F, Table F2 “Symbols and their Meanings”；OpenStax, Intermediate Algebra 2e, §12.1 “Sequences”, “Summation Notation”およびExample 12.9；OpenStax, Prealgebra 2e, §§2.1 “Use the Language of Algebra”・2.2 “Evaluate, Simplify, and Translate Expressions”。直接URLは https://openstax.org/books/introductory-statistics-2e/pages/f-mathematical-phrases-symbols-and-formulas 、https://openstax.org/books/intermediate-algebra-2e/pages/12-1-sequences 、https://openstax.org/books/prealgebra-2e/pages/2-1-use-the-language-of-algebra 、https://openstax.org/books/prealgebra-2e/pages/2-2-evaluate-simplify-and-translate-expressions 。Σ の意味、添字と範囲の展開、変数・係数・式変形の確認に使用。' }] },
      ],
    }],
    figures: [],
  },
  plannedLesson('math-counting', 'math-foundations', '数え方の基本', '積の法則・順列・組合せの基本を数える。', [], ['math-ratios-percentages'], []),
  {
    availability: 'included',
    lessonId: 'data-types',
    title: 'データの種類',
    domain: 'data-description',
    learningObjectives: ['計量値・計数値、カテゴリ・数値、単位と観測単位を区別する。'],
    declaredSectionIds: ['types'],
    commonPrerequisites: [],
    conditionalPrerequisites: [],
    optionalReviews: [],
    sourceItemIds: ['SRC-0001'],
    sourceRefs: sourceRefsFor(['SRC-0001']),
    revision: 2,
    sections: [{
      sectionId: 'types',
      title: '観測単位とデータ型',
      blocks: [
        { kind: 'paragraph', parts: [{ kind: 'text', text: '最初に「何を1件として記録するか」という観測単位を決めます。この例では寸法・傷の件数・不適合品かどうかを製品ごとに記録するため、製品1個が観測単位です。' }] },
        { kind: 'paragraph', parts: [{ kind: 'text', text: '例：検査基準で定めた深さを超える傷だけを不適合とします。3製品を調べ、製品Aに該当する傷が2件、Bには0件、Cには1件あったとします。長さをmmで測った値（Aは12.4 mm、Bは12.0 mm、Cは12.1 mm）は量的連続データです。測定値を小数第1位で記録していても、測っている長さ自体は連続的な量です。' }] },
        { kind: 'paragraph', parts: [{ kind: 'text', text: '製品ごとの該当する傷の件数（Aは2、Bは0、Cは1）は量的離散データです。傷の種類を記録する場合は傷1件ずつが観測単位で、各傷の種類（擦り傷、欠けなど）はカテゴリデータになります。製品Aの2件の傷は同じ種類とは限りません。製品が不適合品かどうか（該当する傷がある／ない）も製品単位のカテゴリデータで、表に 1／0 と記録しても数値データには変わりません。何を1件として数えるかで、記録する値の意味が変わります。' }] },
        { kind: 'paragraph', parts: [{ kind: 'text', text: 'この例の不適合品数は、該当する傷が1件以上ある製品AとCの2個です。不適合数は該当する傷の合計で、2 + 0 + 1 = 3件です。1製品に複数の不適合があれば、品物を数える不適合品数と不適合そのものを数える不適合数は異なります。' }] },
        { kind: 'paragraph', parts: [{ kind: 'text', text: '出典（確認日：2026-10-23）：OpenStax, Introductory Statistics 2e, §§1.2 “Data, Sampling, and Variation in Data and Sampling”・1.3 “Frequency, Frequency Tables, and Levels of Measurement”；ISO 2859-4:2020, 3rd edition (2020-06), Abstract, “The conforming-nonconforming model” and “The nonconformities model”。直接URLは https://openstax.org/books/introductory-statistics-2e/pages/1-2-data-sampling-and-variation-in-data-and-sampling 、https://openstax.org/books/introductory-statistics-2e/pages/1-3-frequency-frequency-tables-and-levels-of-measurement 、https://www.iso.org/standard/64506.html 。データ型の区別、および不適合品単位と不適合件数の数え方の違いを確認。例は独自に作成。' }] },
      ],
    }],
    figures: [],
  },
  plannedLesson('population-sample', 'data-description', '母集団と標本', '母集団・標本・抽出単位・推定対象を例で区別する。', [], ['data-types'], ['SRC-0003']),
  {
    availability: 'included',
    lessonId: 'descriptive-statistics',
    title: '基本統計量',
    domain: 'data-description',
    learningObjectives: ['量的データの平均、偏差、分散、標準偏差を計算し、中心と散らばりを単位と目的に沿って説明する。'],
    declaredSectionIds: ['mean', 'deviation', 'variance', 'standard-deviation'],
    commonPrerequisites: ['data-types', 'math-ratios-percentages', 'math-powers-roots'],
    conditionalPrerequisites: [],
    optionalReviews: [
      { fromRef: 'descriptive-statistics#variance', targetRef: 'math-algebra-sigma#sigma', context: '平均節で意味を説明したΣを分散の最初の公式でも使う。必要ならその近くのリンクから総和記号を復習できる。' },
    ],
    sourceItemIds: ['SRC-0005'],
    sourceRefs: sourceRefsFor(['SRC-0005']),
    revision: 5,
    overview: [
      { kind: 'paragraph', parts: [{ kind: 'text', text: '同じ目標長さ 100 mm のシャフトを作るライン A と B から、3本ずつ測りました。平均は同じでも、散らばり方は同じでしょうか。4つの節を続けて読み、中心と散らばりを順に確かめます。' }] },
      { kind: 'table', caption: '測定した長さ（mm）', columns: ['ライン', '1本目', '2本目', '3本目'], rows: [['A', '98', '100', '102'], ['B', '99', '100', '101']] },
      { kind: 'paragraph', parts: [{ kind: 'text', text: '平均だけでは区別できない2つのラインを、偏差・分散・標準偏差で比べます。図の点は動かせます。操作結果はこのページだけに表示され、保存されません。' }] },
    ],
    sections: [
      {
        sectionId: 'mean',
        title: '平均',
        blocks: [
          { kind: 'paragraph', parts: [{ kind: 'text', text: '3本の長さの「中心」は数直線のどこにあるでしょう。平均は、測定値を全部足して本数で割ると求まります。' }] },
          { kind: 'figureRef', figureId: 'FIG-DS-MEAN' },
          { kind: 'formula', parts: [{ kind: 'mathText', text: 'A：(98 + 100 + 102) ÷ 3 = 100 mm; B：(99 + 100 + 101) ÷ 3 = 100 mm' }] },
          { kind: 'paragraph', parts: [{ kind: 'text', text: 'A も B も平均は 100 mm です。平均は元の値と同じ単位になりますが、実際の測定値のどれかと一致するとは限りません。' }] },
          { kind: 'details', summary: 'もっと正確に（記号と使える条件）', blocks: [
            { kind: 'paragraph', parts: [{ kind: 'text', text: '調べたい対象全体の平均を母平均 μ、実際に測った一部（標本）の平均を標本平均 x̄ と書きます。標本平均は x̄ = (Σxᵢ) ÷ n とも表します。平均が使えるのは同じ種類の量を同じ単位で測った場合です。カテゴリに便宜上つけた番号には使いません。' }] },
            { kind: 'lessonRef', label: '総和記号 Σ の読み方', targetRef: 'math-algebra-sigma#sigma' },
          ] },
          { kind: 'exerciseSlot', exerciseId: 'mean' },
        ],
      },
      {
        sectionId: 'deviation',
        title: '偏差',
        blocks: [
          { kind: 'paragraph', parts: [{ kind: 'text', text: 'A の 98 mm は、平均 100 mm からどちらへ、どれだけ外れているでしょう。値から平均を引いた符号付きの差が偏差です。' }] },
          { kind: 'figureRef', figureId: 'FIG-DS-DEVIATION' },
          { kind: 'formula', parts: [{ kind: 'mathText', text: 'A：98 − 100 = −2; 100 − 100 = 0; 102 − 100 = +2 (mm); B：99 − 100 = −1; 100 − 100 = 0; 101 − 100 = +1 (mm)' }] },
          { kind: 'paragraph', parts: [{ kind: 'text', text: 'A の偏差は ±2 mm、B は ±1 mm です。偏差の単位は元の測定値と同じです。ところが偏差を全部足すと、正と負が打ち消し合って両方とも 0 mm になります。偏差の和だけでは散らばりを比べられません。' }] },
          { kind: 'details', summary: '記号と条件', blocks: [
            { kind: 'paragraph', parts: [{ kind: 'text', text: '母集団の偏差は xᵢ − μ、標本の偏差は xᵢ − x̄ と書きます。偏差の合計が 0 になるのは、平均が偏差の合計を 0 にする位置として決まるためです。' }] },
          ] },
          { kind: 'exerciseSlot', exerciseId: 'deviation' },
        ],
      },
      {
        sectionId: 'variance',
        title: '範囲と分散',
        blocks: [
          { kind: 'paragraph', parts: [{ kind: 'text', text: '正と負を打ち消さずに、3本分のずれを1つの数にするにはどうすればよいでしょう。偏差を二乗すると負の値も正になり、その合計は偏差平方和 S と呼ばれます。単位は mm² です。' }] },
          { kind: 'figureRef', figureId: 'FIG-DS-VARIANCE' },
          { kind: 'formula', parts: [{ kind: 'mathText', text: 'A：(-2)² + 0² + (+2)² = 8 mm²; B：(-1)² + 0² + (+1)² = 2 mm²' }] },
          { kind: 'heading', level: 3, text: '全部を測るか、標本から見積もるか' },
          { kind: 'paragraph', parts: [{ kind: 'text', text: '母集団全体を測ったときの母分散は、偏差平方和を個数 N で割ります。測った標本そのものを記述する分散は n で割ります。標本から母分散を見積もる不偏分散 V は n − 1 で割ります。' }] },
          { kind: 'formula', parts: [{ kind: 'mathText', text: '母分散：σ² = Σ(xᵢ − μ)²/N; 標本内の分散：Σ(xᵢ − x̄)²/n; 不偏分散：V = Σ(xᵢ − x̄)²/(n − 1)' }] },
          { kind: 'paragraph', parts: [{ kind: 'text', text: 'A と B はどちらも3本の標本なので、不偏分散は A が 8 ÷ 2 = 4 mm²、B が 2 ÷ 2 = 1 mm² です。V は見積もりであり、標本が変われば値も変わります。n − 1 で割ると標本から出した値の平均が母分散と一致するのは、同じ母集団から独立に取り出した標本で母分散が有限のときです。' }] },
          { kind: 'details', summary: 'n − 1 で割ると母分散に合うのか確かめる', blocks: [
            { kind: 'figureRef', figureId: 'FIG-DS-SIMULATION' },
            { kind: 'paragraph', parts: [{ kind: 'text', text: 'この小さなロットでは母分散が分かっています。復元抽出の試行結果を集計し、n で割る場合と n − 1 で割る場合の平均を比べます。' }] },
          ] },
          { kind: 'details', summary: '分散の使い分けと注意', blocks: [
            { kind: 'paragraph', parts: [{ kind: 'text', text: '標本から不偏分散を計算するときは n ≥ 2 が必要です。1回の見積もりが母分散に近いことは保証しません。最大値 − 最小値は範囲といい、両端の2点だけを使います。分散は全ての偏差を使うため、極端な値の影響を受けやすい尺度です。' }] },
            { kind: 'lessonRef', label: '総和記号 Σ の読み方', targetRef: 'math-algebra-sigma#sigma' },
          ] },
          { kind: 'exerciseSlot', exerciseId: 'variance' },
        ],
      },
      {
        sectionId: 'standard-deviation',
        title: '標準偏差',
        blocks: [
          { kind: 'paragraph', parts: [{ kind: 'text', text: '分散は mm² なので、長さとして感覚をつかみにくい値です。分散の平方根を取ると、測定値と同じ単位の標準偏差 s に戻ります。' }] },
          { kind: 'figureRef', figureId: 'FIG-DS-STANDARD-DEVIATION' },
          { kind: 'formula', parts: [{ kind: 'mathText', text: 'A：s = √4 = 2 mm; B：s = √1 = 1 mm' }] },
          { kind: 'paragraph', parts: [{ kind: 'text', text: 'A は平均 100 mm の周りに約 2 mm、B は約 1 mm の散らばりがあります。標準偏差は測定値と同じ単位なので、規格や公差と比べやすくなります。標準偏差は偏差の絶対値を単純に平均した値ではありません。分布の形などが分からなければ「大半の値が平均から s 以内に入る」とは言えません。' }] },
          { kind: 'table', caption: '同じ平均でも散らばりは異なる', columns: ['指標', 'A', 'B', '意味'], rows: [
            ['平均', '100 mm', '100 mm', 'データの中心'],
            ['範囲', '4 mm', '2 mm', '最大値と最小値の幅'],
            ['偏差平方和 S', '8 mm²', '2 mm²', '偏差の二乗の合計'],
            ['不偏分散 V', '4 mm²', '1 mm²', 'S ÷ (n − 1)'],
            ['標準偏差 s', '2 mm', '1 mm', '√V。測定値と同じ単位'],
          ] },
          { kind: 'details', summary: '読み方の注意', blocks: [
            { kind: 'paragraph', parts: [{ kind: 'text', text: '母集団全体の標準偏差を σ、標本から計算する標準偏差を s と書きます。不偏分散 V の平方根が、母標準偏差の不偏な推定値になるとは限りません。' }] },
          ] },
          { kind: 'exerciseSlot', exerciseId: 'standard-deviation' },
        ],
      },
    ],
    figures: /** @type {import('./lesson-contract.mjs').FigureDefinition[]} */ ([
      ...['MEAN', 'DEVIATION', 'VARIANCE', 'STANDARD-DEVIATION'].map((name) => ({
        kind: 'cartesian',
        figureId: 'FIG-DS-' + name,
        rendererRef: 'code:interactive-variance-comparison',
        educationalPurpose: '平均と各値の関係を動かしながら確認する。',
        variables: [{ name: '測定値', unit: 'mm' }],
        axes: [
          { axis: 'x', label: '測定値（mm）', scale: 'linear' },
          { axis: 'y', label: 'ラインと観測番号', scale: 'categorical' },
        ],
        legend: [
          { label: '観測値', meaning: 'ラインごとの3つの測定値。点を動かして変更する。' },
          { label: '平均・偏差・散らばり', meaning: '選んだ節に応じて同じデータから計算する。' },
        ],
        altText: 'ライン A と B の測定値を動かし、平均・偏差・散らばりの変化を読み上げ用の表でも確認できる図。',
      })),
      {
        kind: 'diagram',
        figureId: 'FIG-DS-SIMULATION',
        rendererRef: 'code:variance-simulation',
        educationalPurpose: 'n と n−1 で割った分散の標本間平均を比較する。',
        legend: [{ label: '試行平均', meaning: '復元抽出した標本の分散の平均。' }],
        altText: 'ロットから復元抽出し、n と n−1 で割る方法の平均を数値と進捗バーで比較する。',
      },
    ]),
    references: [
      { title: 'JSA「3級のレベル表」Ver.20150130.2', url: 'https://webdesk.jsa.or.jp/', details: 'p.1「基本統計量とグラフ」。本文・表・図・設問は転載・翻案していません。本文確認日・到達確認日：2026-11-11。' },
      { title: 'JSA「4級のレベル表」Ver.20150130.2', url: 'https://webdesk.jsa.or.jp/', details: 'p.1「平均とばらつき」「平均と範囲」。本文・表・図・設問は転載・翻案していません。本文確認日・到達確認日：2026-11-11。' },
      { title: 'OpenStax, Introductory Statistics 2e, §2.7 (2023)', url: 'https://openstax.org/books/introductory-statistics-2e/pages/2-7-measures-of-the-spread-of-the-data', details: '用語と式の照合に使用。参照のみで本文・図・問題は転載・翻案していません。CC BY-NC-SA 4.0。本文確認日・到達確認日：2026-11-11。' },
      { title: 'Wikipedia「自由度」', url: 'https://ja.wikipedia.org/wiki/%E8%87%AA%E7%94%B1%E5%BA%A6', details: 'n − 1 の導出の参考資料。QC検定の対象外となるため本文では導出を扱いません。' },
    ],
    credit: '配色：Solarized by Ethan Schoonover (Copyright (c) 2011; MIT License).',
  },
  plannedLesson('sampling', 'data-description', '標本抽出と誤差', '標本抽出・誤差・抽出方式を区別し、標本からの一般化の限界を説明する。', ['error', 'design'], ['population-sample', 'descriptive-statistics'], ['SRC-0004', 'SRC-0006']),
  plannedLesson('data-transform', 'data-description', 'データ変換', '変換の目的、尺度、変換前後の解釈を説明する。', [], ['data-types', 'math-algebra-sigma'], ['SRC-0002']),
  plannedLesson('qc-seven-tools', 'quality-methods', 'QC七つ道具', '七つ道具を目的に応じて選び、作成・読取り・結論の限界を説明する。', ['pareto', 'cause-effect', 'check-sheet', 'histogram', 'scatter', 'graphs', 'stratification'], ['data-types'], ['SRC-0007', 'SRC-0008', 'SRC-0009', 'SRC-0010', 'SRC-0011', 'SRC-0012', 'SRC-0013'], [], [
    { fromRef: 'qc-seven-tools', targetRef: 'descriptive-statistics', context: 'ヒストグラムや散布図を読む際に、中心・散らばりの見方を振り返る場合。' },
  ]),
  plannedLesson('new-qc-tools', 'quality-methods', '新QC七つ道具', '新QC七つ道具の用途、基本手順、読み方を説明する。', ['affinity', 'relations', 'tree', 'matrix', 'arrow', 'pdpc', 'matrix-data'], [], ['SRC-0014', 'SRC-0015', 'SRC-0016', 'SRC-0017', 'SRC-0018', 'SRC-0019', 'SRC-0020'], [], [
    { fromRef: 'new-qc-tools', targetRef: 'qc-seven-tools', context: '図表による整理の経験があると手順を理解しやすい場合。必修の順序にはしない。' },
  ]),
  plannedLesson('probability-foundations', 'probability-distributions', '確率の基礎', '事象・確率・独立・条件付き確率の基本を計算・解釈する。', [], ['math-ratios-percentages'], []),
  plannedLesson('random-variables', 'probability-distributions', '確率変数', '離散・連続確率変数、確率分布、期待値・分散を結び付ける。', [], ['probability-foundations', 'math-algebra-sigma'], ['SRC-0025']),
  plannedLesson('normal-distribution', 'probability-distributions', '正規分布', '正規分布を標準化し、条件を確認して確率を計算する。', [], ['random-variables', 'math-powers-roots'], ['SRC-0021']),
  plannedLesson('binomial-distribution', 'probability-distributions', '二項分布', '独立・一定確率の試行回数として二項分布を扱い、確率を計算する。', [], ['random-variables', 'probability-foundations', 'math-counting'], ['SRC-0022']),
  plannedLesson('poisson-distribution', 'probability-distributions', 'ポアソン分布', '一定の機会・曝露に対する計数モデルとしてポアソン分布を扱う。', [], ['random-variables', 'probability-foundations'], ['SRC-0023']),
  plannedLesson('sampling-distributions', 'probability-distributions', '標本分布', '標本統計量の共通的な標本分布と標準誤差を説明し、t・カイ二乗・Fの節を条件に応じて使う。', ['common', 't', 'chi-square', 'f'], ['population-sample', 'descriptive-statistics', 'random-variables'], ['SRC-0024']),
  plannedLesson('law-large-numbers-clt', 'probability-distributions', '大数の法則と中心極限定理', '大数の法則と中心極限定理の主張・条件・用途を区別する。', [], ['random-variables', 'descriptive-statistics'], ['SRC-0026']),
  plannedLesson('inference-basics', 'statistical-analysis', '推定と検定の基礎', '推定と検定、帰無仮説、信頼区間、p値、誤りの意味を説明する。', [], ['population-sample', 'probability-foundations'], ['SRC-0027']),
  plannedLesson('mean-inference', 'statistical-analysis', '母平均の推定・検定', '母平均の区間推定・検定を条件別に選び、計算と結論を解釈する。', ['z', 't', 'large-sample'], ['inference-basics', 'descriptive-statistics', 'sampling-distributions#common'], ['SRC-0028'], [
    { conditionId: 'mean-inference-z-normal-model', methodSectionRef: 'mean-inference#z', condition: '母標準偏差が既知で、正規母集団を仮定するz法を選ぶ場合。', prerequisiteRef: 'normal-distribution' },
    { conditionId: 'mean-inference-t-sampling-distribution', methodSectionRef: 'mean-inference#t', condition: '母標準偏差が未知で、t法を選ぶ場合。', prerequisiteRef: 'sampling-distributions#t' },
    { conditionId: 'mean-inference-t-small-sample-normality', methodSectionRef: 'mean-inference#t', condition: 't法を小標本で使い、母集団の正規性を仮定する場合。', prerequisiteRef: 'normal-distribution' },
    { conditionId: 'mean-inference-large-sample-clt', methodSectionRef: 'mean-inference#large-sample', condition: '大標本近似を使い、標本サイズと近似条件を判断する場合。', prerequisiteRef: 'law-large-numbers-clt' },
  ]),
  plannedLesson('variance-inference', 'statistical-analysis', '1母分散の推定・検定', '1母分散の推定・検定を分布仮定と自由度を明示して解釈する。', ['chi-square'], ['inference-basics', 'descriptive-statistics', 'sampling-distributions#common'], ['SRC-0029'], [
    { conditionId: 'variance-inference-chi-square-distribution', methodSectionRef: 'variance-inference#chi-square', condition: '正規母集団を前提とするカイ二乗法を選ぶ場合。', prerequisiteRef: 'sampling-distributions#chi-square' },
    { conditionId: 'variance-inference-normal-population', methodSectionRef: 'variance-inference#chi-square', condition: '分散推論に正規母集団の仮定を置く場合。', prerequisiteRef: 'normal-distribution' },
  ]),
  plannedLesson('variance-ratio-inference', 'statistical-analysis', '2母分散の比の推定・検定', '2母分散の比の推定・検定を独立性・分布条件とともに扱う。', ['f'], ['variance-inference', 'sampling-distributions#common'], ['SRC-0030'], [
    { conditionId: 'variance-ratio-inference-f-distribution', methodSectionRef: 'variance-ratio-inference#f', condition: '独立な正規母集団の分散比をF法で比較する場合。', prerequisiteRef: 'sampling-distributions#f' },
    { conditionId: 'variance-ratio-inference-normal-populations', methodSectionRef: 'variance-ratio-inference#f', condition: '独立な正規母集団を仮定するF法を選ぶ場合。', prerequisiteRef: 'normal-distribution' },
  ]),
  plannedLesson('mean-difference-inference', 'statistical-analysis', '2母平均差の推定・検定', '独立2標本の母平均差を、等分散・Welch等の方法条件を区別して扱う。', ['pooled-t', 'welch', 'large-sample'], ['mean-inference', 'sampling-distributions#common'], ['SRC-0031'], [
    { conditionId: 'mean-difference-large-sample-clt', methodSectionRef: 'mean-difference-inference#large-sample', condition: '独立2標本の平均差に大標本近似を使う場合。', prerequisiteRef: 'law-large-numbers-clt' },
    { conditionId: 'mean-difference-pooled-t-distribution', methodSectionRef: 'mean-difference-inference#pooled-t', condition: '等分散を仮定するpooled t法を選ぶ場合。', prerequisiteRef: 'sampling-distributions#t' },
    { conditionId: 'mean-difference-pooled-t-normality', methodSectionRef: 'mean-difference-inference#pooled-t', condition: 'pooled t法を小標本で使い、各母集団の正規性を仮定する場合。', prerequisiteRef: 'normal-distribution' },
    { conditionId: 'mean-difference-welch-t-distribution', methodSectionRef: 'mean-difference-inference#welch', condition: '等分散を置かないWelch法を選ぶ場合。', prerequisiteRef: 'sampling-distributions#t' },
    { conditionId: 'mean-difference-welch-normality', methodSectionRef: 'mean-difference-inference#welch', condition: 'Welch法を小標本で使い、各母集団の正規性を仮定する場合。', prerequisiteRef: 'normal-distribution' },
  ]),
  plannedLesson('paired-inference', 'statistical-analysis', '対応データの推定・検定', '対応データを差に変換し、差の平均を推定・検定する。', ['t', 'large-sample'], ['mean-inference', 'descriptive-statistics', 'sampling-distributions#common'], ['SRC-0032'], [
    { conditionId: 'paired-inference-large-sample-clt', methodSectionRef: 'paired-inference#large-sample', condition: '対応差の平均に大標本近似を使う場合。', prerequisiteRef: 'law-large-numbers-clt' },
    { conditionId: 'paired-inference-t-distribution', methodSectionRef: 'paired-inference#t', condition: '対応差にt法を使う場合。', prerequisiteRef: 'sampling-distributions#t' },
    { conditionId: 'paired-inference-t-small-sample-normality', methodSectionRef: 'paired-inference#t', condition: '対応差のt法を小標本で使い、差の正規性を仮定する場合。', prerequisiteRef: 'normal-distribution' },
  ]),
  plannedLesson('proportion-count-inference', 'statistical-analysis', '不適合品率・不適合数の推定・検定', '母不適合品率・不適合数とその2標本比較を、データ型・条件別に扱う。', ['rate', 'count'], ['inference-basics', 'probability-foundations'], ['SRC-0033', 'SRC-0034', 'SRC-0035', 'SRC-0036'], [
    { conditionId: 'proportion-count-rate-binomial-model', methodSectionRef: 'proportion-count-inference#rate', condition: '不適合品率を二項法で推論する場合。', prerequisiteRef: 'binomial-distribution' },
    { conditionId: 'proportion-count-rate-normal-approximation', methodSectionRef: 'proportion-count-inference#rate', condition: '不適合品率に正規近似を使い、期待成功数・失敗数の条件を満たす場合。', prerequisiteRef: 'normal-distribution' },
    { conditionId: 'proportion-count-count-poisson-model', methodSectionRef: 'proportion-count-inference#count', condition: '一定曝露量あたりの不適合数をPoisson法で推論する場合。', prerequisiteRef: 'poisson-distribution' },
  ]),
  plannedLesson('contingency-tests', 'statistical-analysis', '分割表による検定', '分割表で独立性等を検定し、期待度数条件と結論を解釈する。', ['pearson'], ['inference-basics', 'probability-foundations', 'sampling-distributions#common'], ['SRC-0037'], [
    { conditionId: 'contingency-tests-pearson-chi-square', methodSectionRef: 'contingency-tests#pearson', condition: '観測の独立性と期待度数の条件を確認してPearsonのカイ二乗検定を選ぶ場合。', prerequisiteRef: 'sampling-distributions#chi-square' },
  ]),
  plannedLesson('control-charts', 'quality-methods', '管理図', '管理図の目的と限界を説明し、計量・計数の図を条件に応じて選ぶ。', ['basics', 'xbar-r', 'xbar-s', 'x-rs', 'p-np', 'u-c'], ['data-types', 'descriptive-statistics', 'sampling'], ['SRC-0038', 'SRC-0039', 'SRC-0040', 'SRC-0041', 'SRC-0042', 'SRC-0043'], [
    { conditionId: 'control-charts-xbar-r-normal-model', methodSectionRef: 'control-charts#xbar-r', condition: '標準的な限界係数と確率解釈を伴うXbar-R図を使う場合。', prerequisiteRef: 'normal-distribution' },
    { conditionId: 'control-charts-xbar-s-normal-model', methodSectionRef: 'control-charts#xbar-s', condition: '標準的な限界係数と確率解釈を伴うXbar-s図を使う場合。', prerequisiteRef: 'normal-distribution' },
    { conditionId: 'control-charts-x-rs-normal-model', methodSectionRef: 'control-charts#x-rs', condition: '標準的な限界係数と確率解釈を伴うX-Rs図を使う場合。', prerequisiteRef: 'normal-distribution' },
    { conditionId: 'control-charts-p-np-binomial-model', methodSectionRef: 'control-charts#p-np', condition: '不適合品率を二項計数で扱うp図またはnp図を使う場合。', prerequisiteRef: 'binomial-distribution' },
    { conditionId: 'control-charts-u-c-poisson-model', methodSectionRef: 'control-charts#u-c', condition: '単位あたり不適合数をPoisson計数で扱うu図またはc図を使う場合。', prerequisiteRef: 'poisson-distribution' },
  ], [
    { fromRef: 'control-charts', targetRef: 'qc-seven-tools#graphs', context: '管理図の線・軸・記録値の見方を一般的なグラフから復習する場合。' },
  ]),
  plannedLesson('process-capability', 'quality-methods', '工程能力指数', '工程の安定性や分布条件を確認し、選んだ方法の工程能力指数を計算・解釈する。', ['capability'], ['descriptive-statistics', 'sampling'], ['SRC-0044'], [
    { conditionId: 'process-capability-normal-process', methodSectionRef: 'process-capability#capability', condition: '安定した正規工程にCp/Cpkを適用する場合。', prerequisiteRef: 'normal-distribution' },
    { conditionId: 'process-capability-sampling', methodSectionRef: 'process-capability#capability', condition: '安定性の確認に標本データを用いる場合。', prerequisiteRef: 'sampling' },
  ], [
    { fromRef: 'process-capability', targetRef: 'control-charts#basics', context: '工程の安定性を管理図で確認する学習へ戻る場合。管理図を使わない確認方法を排除しない。' },
  ]),
  plannedLesson('sampling-inspection', 'quality-methods', '抜取検査', 'ロット・抽出・判定の関係と計数・計量方式を説明する。', ['purpose', 'types', 'attribute', 'variable'], ['population-sample', 'data-types', 'probability-foundations'], ['SRC-0045', 'SRC-0046', 'SRC-0047', 'SRC-0062', 'SRC-0063'], [
    { conditionId: 'sampling-inspection-attribute-binomial-model', methodSectionRef: 'sampling-inspection#attribute', condition: '計数結果でロットを判定し、採用する計画が二項モデルに基づく場合。', prerequisiteRef: 'binomial-distribution' },
    { conditionId: 'sampling-inspection-variable-normal-model', methodSectionRef: 'sampling-inspection#variable', condition: '計量値でロットを判定し、採用する計画が正規モデルに基づく場合。', prerequisiteRef: 'normal-distribution' },
  ]),
  plannedLesson('experimental-design', 'quality-methods', '実験計画法', '因子・水準・応答・実験単位を定め、1元・2元配置を条件付きで分析する。', ['one-factor', 'two-factor'], ['data-types', 'descriptive-statistics'], ['SRC-0048', 'SRC-0049', 'SRC-0050'], [
    { conditionId: 'experimental-design-one-factor-inference', methodSectionRef: 'experimental-design#one-factor', condition: '一元配置実験で群平均を分散分析により比較する場合。', prerequisiteRef: 'inference-basics' },
    { conditionId: 'experimental-design-one-factor-f-distribution', methodSectionRef: 'experimental-design#one-factor', condition: '一元配置実験の群平均比較でF分布を用いる場合。残差の独立性・分散・分布条件も確認する。', prerequisiteRef: 'sampling-distributions#f' },
    { conditionId: 'experimental-design-two-factor-inference', methodSectionRef: 'experimental-design#two-factor', condition: '二元配置実験で主効果または交互作用を推論する場合。', prerequisiteRef: 'inference-basics' },
    { conditionId: 'experimental-design-two-factor-f-distribution', methodSectionRef: 'experimental-design#two-factor', condition: '二元配置実験でF分布を用いる場合。実験配置と誤差の条件も確認する。', prerequisiteRef: 'sampling-distributions#f' },
  ], [
    { fromRef: 'experimental-design', targetRef: 'qc-seven-tools#graphs', context: '因子・応答を図で比べる例を復習する場合。' },
  ]),
  plannedLesson('correlation', 'statistical-analysis', '相関係数', '相関係数の意味・計算・限界を説明する。', [], ['data-types', 'descriptive-statistics'], ['SRC-0051'], [], [
    { fromRef: 'correlation', targetRef: 'qc-seven-tools#scatter', context: '相関係数の前に散布図で二変数の関係を確認する場合。' },
  ]),
  plannedLesson('serial-correlation', 'statistical-analysis', '系列相関', '時系列順の相関が独立観測の前提に与える影響を説明する。', [], ['correlation'], ['SRC-0052']),
  plannedLesson('simple-regression', 'statistical-analysis', '単回帰分析', '単回帰式と残差の基本を説明し、推論を行う場合は方法条件を確認する。', ['anova', 'residuals'], ['correlation', 'math-algebra-sigma'], ['SRC-0053', 'SRC-0054', 'SRC-0055'], [
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
  curriculumRevision: 3,
  officialSourceItemIds: Array.from({ length: 64 }, (_, index) => `SRC-${String(index + 1).padStart(4, '0')}`),
  sources: sourceDocuments,
  lessons,
}
