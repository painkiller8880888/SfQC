## Issue #17 実行計画 — P2-02 数学・データ型の復習教材

本計画は、[Issue #17「P2-02: 復習用の数学・データ型教材を最小構成で整備する」](https://github.com/painkiller8880888/SfQC/issues/17)を、教材データ契約に沿った5単元の収録として実施するものです。Issue #16で導入した教材契約を使い、次の記述統計教材（#18）が参照する数学の前提を用意します。初回の計画レビューで指摘された教材revisionと出典確認手順に加え、既存学習目標を満たす内容、QC用語、自動検査と人による内容確認の役割を明記します。

今回の「収録」はregistry上でavailabilityをincludedにすることを指します。学習者向けの教材画面は#24、復習後に開始位置へ戻る動作は#23/#26の対象なので、#17では実装しません。これは既存の分割 [P2実装計画](https://github.com/painkiller8880888/SfQC/blob/74d71f44a394325c7e02db98cdee0c89e9704f1e/docs/P2_IMPLEMENTATION_PLAN.md)、[教材registry](https://github.com/painkiller8880888/SfQC/blob/74d71f44a394325c7e02db98cdee0c89e9704f1e/src/lesson-registry.mjs)、[Appの現状](https://github.com/painkiller8880888/SfQC/blob/74d71f44a394325c7e02db98cdee0c89e9704f1e/src/App.tsx#L25)に沿っています。

### 完了条件

- 対象5教材をそれぞれ1節だけでincludedにする。教材IDは既存のものを維持し、data-types:types、math-arithmetic:operations、math-ratios-percentages:ratio、math-powers-roots:powers-rootsの4節IDは今回初めて前提マップの固定section一覧と教材registryのdeclaredSectionIdsに登録し、math-algebra-sigma:sigmaは既存IDを維持する。複数の説明段落・例・出典記述が必要な場合も各教材の同じ1節に置き、その節の内容で既存learningObjectivesを満たす。その他の教材ID・節IDや2節目は追加しない。目標の意味的な充足はCIではなく人が確認する。
- 既存の必須前提と任意復習の区別を維持する。偏差・分散からΣへの任意復習、Σの必須前提である比・割合と平方・平方根、それらに共通する四則計算を既存関係どおりにたどれる。
- 全5教材のrevisionを1から2に更新し、curriculumRevisionも1から2に更新する。教材本文の改訂時に教材revision、教材registryの変更時にcurriculumRevisionを個別に更新する方針（[MVP設計](https://github.com/painkiller8880888/SfQC/blob/74d71f44a394325c7e02db98cdee0c89e9704f1e/docs/MVP_DESIGN_DRAFT.md#L53-L54)）に沿います。残る29教材のrevisionと収録状態は変えません。
- CIでは収録状態、revision、各教材の1節のIDとdeclaredSectionIds、registryと参照関係の整合、および本文・例・出典に当たる記述の構造上の存在を確認する。CIは学習目標の充足、計算や単位の正しさ、出典が主張を裏付けるか、説明の分かりやすさを判定しない。
- 人が全5教材を個別にレビューし、既存学習目標の充足、数式・数値・単位、出典の該当箇所と主張の対応、初学者が誤解しない説明を確認する。URLや数式が存在するだけでは合格としない。教材ごとの確認結果をPRに残す。
- 変更に応じて **npm run build** と **git diff --check** が通る。buildはcheckを含むため、別途同じcheckを重複実行する必要はない。

### 収録する節と説明

| 教材 | 節ID | 最小の説明と具体例 | 前提関係 |
|---|---|---|---|
| data-types | types | 観測単位を製品1個とする。製品の寸法（mm）は量的連続データ（計量値）、製品が不適合品か否かはカテゴリ（1/0で符号化しても量的データにはならない）、その製品にある傷の件数は量的離散データ（計数値）、傷の種類はカテゴリと分類する。この例では検査基準に該当する傷だけを不適合として数え、傷一般が常に不適合とはしない。「不適合品数」は1つ以上の不適合がある製品の個数、「不適合数」は不適合そのものの件数と定義し、1製品に複数の不適合があれば両者が異なることを示す。 | 必須前提なし。既存の公式対応sourceItemIds（SRC-0001等）とsourceRefs（jsa-l3、jsa-l4等）を維持する。 |
| math-arithmetic | operations | 整数・小数・負数を使い、0.12 cm = 1.2 mm、1.2 mm + 0.8 mm = 2.0 mm、0.8 mm − 1.2 mm = −0.4 mm、0.5 mm × 2 = 1.0 mm、(1.2 mm + 0.8 mm) / 2 = 1.0 mmを例にする。四則、括弧と演算順を説明し、加減算の前に単位をそろえる。積・商では数値だけでなく単位も計算する。 | 必須前提なし。 |
| math-ratios-percentages | ratio | 「300個の製品を検査し、そのうち12個が不適合品だった。不適合品率は12/300 = 0.04 = 4%」を使い、分母が検査した製品の総数、分子が不適合品数であること、割合から百分率へは100倍することを説明する。この2つの数量を比較する比は「不適合品数:検査総数」なので、12個と300個の比は12:300=1:25です。これは検査総数を全体とした割合12/300=0.04=4%と区別します。丸め例は同じく製品数を基準に「不適合品7個/検査300個」とし、7/300 = 0.023333…（3が循環）= 2.333…%（100倍）≈ 2.3%（百分率の小数第1位で丸め）とする。途中で丸めず、割合の小数表示・百分率への変換・最後の丸めを区別する。4% = 0.04 = 4/100 = 1/25の逆変換も示す。分母が0の場合に率を定義できないこと、異なる単位の商は単位付きの率になることを説明する。 | 必須前提はmath-arithmetic。現行の辺を維持する。 |
| math-powers-roots | powers-roots | (0.5 mm)^2 = 0.25 mm²、√(0.25 mm²) = 0.5 mmを使い、二乗は同じ量を掛け合わせて単位も二乗すること、平方根は二乗して元の量になる非負の主平方根を表すことを説明する。一般に√(x²) = \|x\|であり、負のxをxと同一視しない。 | 必須前提はmath-arithmetic。現行の辺を維持する。 |
| math-algebra-sigma | sigma | Σ（i=1から3）xᵢをx₁ + x₂ + x₃へ展開し、xᵢに1 mm、2 mm、3 mmを代入してΣxᵢ = 1 mm + 2 mm + 3 mm = 6 mmと検算する。xᵢ−2 mmは係数1、定数項−2 mmのxᵢについての一次式と説明する。また、yᵢ = xᵢ−2 mmの両辺に同じ2 mmを足してxᵢ = yᵢ+2 mmへ変形し、yᵢが基準値からの差で単位はmmであることを示す。添字i・上下限・括弧・差・二乗の順序も説明する。基準値を2 mmとした例では、Σ(xᵢ−2 mm)² = (1 mm−2 mm)² + (2 mm−2 mm)² + (3 mm−2 mm)² = 2 mm²となる。二乗前に括弧内の差を計算して各項を足すこと、総和を展開する式変形を示す。この例は分散の定義や計算手順ではなく、統計式で使う文字式を読むための橋渡しに限る。 | 必須前提はmath-ratios-percentagesとmath-powers-roots。分散節からの任意復習は既存どおり。 |

### 出典と確認方法

一般数学の参考資料は、現在のsourceRefs契約（公式シラバスのsourceItemIdに対応する出典用）を拡張せず、各教材本文の出典段落に記載します。出典段落の記録項目は[プロジェクト方針](https://github.com/painkiller8880888/SfQC/blob/74d71f44a394325c7e02db98cdee0c89e9704f1e/docs/PROJECT_CHARTER_DRAFT.md#L120)に合わせます。[MVP教材契約](https://github.com/painkiller8880888/SfQC/blob/74d71f44a394325c7e02db98cdee0c89e9704f1e/docs/MVP_DESIGN_DRAFT.md#L51-L54)と[SourceDefinition](https://github.com/painkiller8880888/SfQC/blob/74d71f44a394325c7e02db98cdee0c89e9704f1e/src/lesson-contract.mjs#L165)の範囲を保ち、一般資料のためにvalidator、型、fixtureを変更しません。出典段落には資料名、版、該当節・ページ、直接URL、実際に本文を確認した日、利用目的を記録します。

以下は計画時点の参考資料候補です。候補URLや節の所在を確認したことと、教材中の個別主張が資料本文で裏付けられたことは区別します。実装時に利用する該当箇所を実際に読み、教材の主張と対応していることを確かめてから、その教材に実確認日を記録してください。計画作成日を機械的に転記しません。

| 目的 | 参考資料候補 |
|---|---|
| カテゴリ・量的データ、離散・連続、カテゴリ変数と二値回答 | [OpenStax Introductory Statistics 2e §1.1](https://openstax.org/books/introductory-statistics-2e/pages/1-1-definitions-of-statistics-probability-and-key-terms)、[§1.2](https://openstax.org/books/introductory-statistics-2e/pages/1-2-data-sampling-and-variation-in-data-and-sampling)、[§1.3](https://openstax.org/books/introductory-statistics-2e/pages/1-3-frequency-frequency-tables-and-levels-of-measurement) |
| 括弧と演算順、小数計算、測定単位 | [OpenStax Prealgebra 2e §2.1](https://openstax.org/books/prealgebra-2e/pages/2-1-use-the-language-of-algebra)、[§5.2](https://openstax.org/books/prealgebra-2e/pages/5-2-decimal-operations)、[§7.5](https://openstax.org/books/prealgebra-2e/pages/7-5-systems-of-measurement) |
| 比・率・百分率・比例 | [OpenStax Prealgebra 2e §5.6](https://openstax.org/books/prealgebra-2e/pages/5-6-ratios-and-rate)、[§6.1](https://openstax.org/books/prealgebra-2e/pages/6-1-understand-percent)、[§6.5](https://openstax.org/books/prealgebra-2e/pages/6-5-solve-proportions-and-their-applications) |
| 指数・平方根 | [OpenStax Prealgebra 2e §10.2](https://openstax.org/books/prealgebra-2e/pages/10-2-use-multiplication-properties-of-exponents)、[§5.7](https://openstax.org/books/prealgebra-2e/pages/5-7-simplify-and-use-square-roots) |
| 変数への代入、一次式の係数、式の簡単化 | [OpenStax Prealgebra 2e §2.1](https://openstax.org/books/prealgebra-2e/pages/2-1-use-the-language-of-algebra)、[§2.2](https://openstax.org/books/prealgebra-2e/pages/2-2-evaluate-simplify-and-translate-expressions)。§2.2には、与えられた数を変数に代入して演算順に式を評価する説明と、項・係数の説明がある。統計上の意味や分散の定義を根拠づける資料としては使わない。 |
| Σ記号が和を表すこと | [OpenStax Introductory Statistics 2e Appendix F](https://openstax.org/books/introductory-statistics-2e/pages/f-mathematical-phrases-symbols-and-formulas)。この付録で記号の意味を支え、添字と上下限の展開手順の根拠にはしない。 |
| 添字、下限・上限、有限和の展開 | [OpenStax Intermediate Algebra 2e §12.1](https://openstax.org/books/intermediate-algebra-2e/pages/12-1-sequences)。計画作成日（2026-10-23）に本文の該当説明と例を実際に確認し、添字・開始値・終了値およびΣの展開例が記載されていることを確認した。この計画時の確認日を教材へ転記せず、実装時にも利用箇所を再確認して実際の日付を記録する。 |
| 不適合品の割合と、製品ごとに数える不適合件数の区別 | [ISO 2859-4:2020 §1 Scope](https://www.iso.org/obp/ui?_escaped_fragment_=iso%3Astd%3Aiso%3A2859%3A-4%3Aed-3%3Av1%3Aen)。不適合品の比率を扱うモデルと、各製品にある不適合数を数えるモデルを分けている。用語・主張に使う範囲は本文との照合後に決める。 |

例や説明は独自に記述し、参考書の練習問題・例文を転載しません。出典の該当箇所が予定する説明を支えない場合は、その主張を弱めるか、適切な資料を追加で確認してから採用します。

### 変更箇所と作業順

1. **固定section一覧とregistryの節宣言を同期する。** [前提マップの固定section一覧](https://github.com/painkiller8880888/SfQC/blob/74d71f44a394325c7e02db98cdee0c89e9704f1e/docs/curriculum/PREREQUISITE_MAP_DRAFT.md#L81-L83)に、data-types:types、math-arithmetic:operations、math-ratios-percentages:ratio、math-powers-roots:powers-rootsの4節IDを今回初めて追加し、教材registryの対象5件のdeclaredSectionIdsにも同じ4節IDを今回初めて登録します。既存のmath-algebra-sigma:sigmaは両方で維持します。対象5教材は各1節とし、ほかの教材ID・節IDや2節目は追加しません。本文・registry・テストで同じ5節IDを使います。

2. **教材本文を用意してregistryへ収録する。** [lesson-registry.mjs](https://github.com/painkiller8880888/SfQC/blob/74d71f44a394325c7e02db98cdee0c89e9704f1e/src/lesson-registry.mjs)の対象5件だけをplannedからincludedへ変更し、登録した各節IDで1節ずつに見出し・独自説明・数式・具体例・出典段落を置きます。必要な段落や例は同じ節内に収めます。learningObjectives、公式sourceItemIds/sourceRefs、必須前提、optionalReviewsは維持します。対象5件のrevisionを各1→2、curriculumRevisionを1→2にします。共通helperのrevision既定値を変えて他の29件を巻き込まないようにします。

3. **契約テストを対象範囲に合わせる。** [lesson-contract.test.mjs](https://github.com/painkiller8880888/SfQC/blob/74d71f44a394325c7e02db98cdee0c89e9704f1e/scripts/lesson-contract.test.mjs)の全件planned前提を、5対象のincluded状態・revision 2・節ID・本文／例／出典に当たる記述の存在、および他29件が未収録でrevisionを維持する検査に更新します。総教材数、公式source coverage、既存の契約検査は保ちます。[lesson-curriculum.test.mjs](https://github.com/painkiller8880888/SfQC/blob/74d71f44a394325c7e02db98cdee0c89e9704f1e/scripts/lesson-curriculum.test.mjs)で前提マップの固定section一覧・registryのdeclaredSectionIds・LessonRefの整合を確認し、必要なassertが不足する場合だけ最小限補います。ここで確認するのは記述や参照の構造的な存在までであり、数式・用語・出典内容の正しさは判定しません。validatorの一般出典スキーマを増やさないので、独立fixtureは変更しません。

4. **人が全教材の学習目標・数学・出典・説明を確認する。** 教材ごとに既存learningObjectiveと本文を照合し、数値を独立に計算して単位を確認します。特に不適合品数と不適合数、12/300 = 4%、7/300の割合・百分率変換・丸め段階、平方根の非負性、Σの代入・一次式・yᵢ = xᵢ−2 mmからxᵢ = yᵢ+2 mmへの同値な式変形（両辺に同じ2 mmを加える）、括弧内の差・二乗の順序・各項と合計の単位を確認します。出典候補の該当本文を読み、各主張を個別に照合してから教材本文に資料名、版、該当箇所、直接URL、実確認日、利用目的を記録します。URLや数式が存在しても、内容と出典が対応しなければ修正します。初学者向けに説明を読み直し、例が主張を誤解なく伝えるかも確認します。

5. **自動検証を実施する。** 最終状態で **npm run build** と **git diff --check** を実行します。buildにcheckが含まれます。UIを変更しないため、ブラウザ表示・画面幅・キーボード操作の検証は#17の完了条件に含めません。

6. **PRで結果を記録する。** #17、対象5教材と各教材の節ID、各1節であること、revision更新、前提関係を変えていないこと、構造的なCI検査とbuild・diff検査の結果をPRに記載します。加えて、data-types、math-arithmetic、math-ratios-percentages、math-powers-roots、math-algebra-sigmaそれぞれについて、学習目標・数式と単位・出典との対応・初学者向け説明を人が確認した結果（確認済み／修正内容／未解決事項）を記録します。math-algebra-sigmaではyᵢ = xᵢ−2 mmからxᵢ = yᵢ+2 mmへの同値な式変形も確認結果に含めます。構造検査のPASSを内容レビューのPASSとして扱いません。Issueの完了扱いは変更がmergeされた後に行います。

### 影響範囲と対象外

予定変更は、前提マップの固定section一覧、lesson registryのdeclaredSectionIds、教材本文、lesson-contractテストが中心です。lesson-curriculumテストは前提マップ・registry・LessonRefの既存比較だけで足りない場合に限り更新します。現行契約で実現できるため、SourceDefinition、型定義、contract fixture、共通依存、UI、ビルド設定、GitHub Pages workflowは変更しません。

画面・問題・採点・誤答feedback・学習履歴/localStorage、全数学分野の解説、教材依存の階層変更、新しい依存、外部service、画像や生成assetは対象外です。.codex/config.toml等の作業環境設定も変更しません。



