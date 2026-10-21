# 学習単元と前提関係（Draft）

> - Status: Draft v0.1
> - 確認日: 2026-10-21
> - 対象: painkiller8880888/SfQC Issue #1
> 目的: 統計学の初学者が数学・データの基礎からQC検定2級の統計・品質管理手法へ進み、必要な復習を経て元の学習へ戻れる単元IDと前提関係をレビューする。

公式項目の内容、版、級、SfQCでの対象・前提・保留・当面対象外の区分は[公式レベル表との対応表](SYLLABUS_MAPPING_DRAFT.md)に記録する。ここでは教材単元側のIDと関係を定める。lessonIdは公式項目番号から独立し、公式項目と教材単元の対応は多対多を許す。

## 1. IDと依存関係のルール

- lessonIdは英小文字とハイフンの固定ID。名称や公式表の版が変わっても既存IDを振り直さず、項目の改訂・分割・統合は対応表の注記で追跡する。
- sourceItemIdはJSAの公式項目だけに付ける。数学の橋渡し単元はSfQC独自の内容なのでsourceItemIdを持たず、公式項目との対応を偽装しない。
- sourceItemId欄の「lessonId#sectionId」は同一lesson内の固定節アンカーを表す。これは新たなlessonIdではない。見出しの節IDは変更時に旧IDからの移動先を残す。
- 依存関係の表記は「学ぶ単元が必須前提を持つ」である。表の辺は学ぶ単元から前提単元へ向けて定義する。学習順の例はその逆、基礎から応用へ読む。
- 必須前提欄の `lessonId#sectionId` は、そのlesson内の該当節だけを必須範囲とする。グラフの頂点は引き続きlessonIdであり、節アンカーは前提単元を細分化しない。節指定がないlessonIdは単元目標全体を指す。
- 必須前提は、欠けるとその単元の目標や手順が理解できないものに限定する。方法や条件によってだけ必須となる知識は後述の条件付き経路に記し、任意の復習先と混ぜない。
- 公式掲載級は必須前提の根拠ではない。前提にする理由は各辺に記載した理解上の必要性による。

## 2. lessonId一覧と必須前提

「対応sourceItemId」は公式項目との照合用。「必須前提」の矢印は、単元 → 必須前提の向きである。目標深度は初期カリキュラムでの教育目標で、公式マトリックスの記号とは別に定める。

| lessonId | 学習目標・到達深度 | 対応sourceItemId | 必須前提lessonId | 各辺が必須である理由 | 推奨段階 |
|---|---|---|---|---|---|
| math-arithmetic | 整数・小数・負数の四則計算、単位、計算順序を使う。 | なし（数学の橋渡し） | — | — | 0 数学 |
| math-ratios-percentages | 分数・比・割合・百分率・比率を相互変換し、丸めを説明する。 | なし（数学の橋渡し） | math-arithmetic | 比や割合を計算するため。 | 0 数学 |
| math-powers-roots | 指数・平方根を計算し、式中の意味を説明する。 | なし（数学の橋渡し） | math-arithmetic | 指数・根の計算を四則計算とつなぐため。 | 0 数学 |
| math-algebra-sigma | 文字式・一次式・式変形・総和記号を使って統計式を読む。 | なし（数学の橋渡し） | math-ratios-percentages; math-powers-roots | 分母・比率を含む式と二乗・平方根を正しく変形するため。 | 0 数学 |
| math-counting | 積の法則・順列・組合せの基本を数える。 | なし（数学の橋渡し） | math-ratios-percentages | 二項確率の係数と割合の意味を理解するため。 | 0 数学 |
| data-types | 計量値・計数値、カテゴリ・数値、単位と観測単位を区別する。 | SRC-0001 | — | — | 1 データ |
| population-sample | 母集団・標本・抽出単位・推定対象を例で区別する。 | SRC-0003 | data-types | 何を数え・測った標本かを定義しないと母集団との対応が定まらないため。 | 1 データ |
| descriptive-statistics | 平均・範囲・分散・標準偏差を計算し、分布の中心と散らばりを説明する。 | SRC-0005 | data-types; math-ratios-percentages; math-powers-roots | 集計前にデータ型を選び、比率・平方・平方根を正しく計算するため。 | 1 データ |
| sampling | 標本抽出・誤差・抽出方式を区別し、標本からの一般化の限界を説明する。 | SRC-0004; SRC-0006 | population-sample; descriptive-statistics | 抽出対象と、標本内のばらつき・要約値を理解するため。 | 1 データ |
| data-transform | 変換の目的、尺度、変換前後の解釈を説明する。 | SRC-0002 | data-types; math-algebra-sigma | 適用できる変換はデータ型と式の意味に依存するため。 | 1 データ |
| qc-seven-tools | 七つ道具を目的に応じて選び、作成・読取り・結論の限界を説明する。 | SRC-0007; SRC-0008; SRC-0009; SRC-0010; SRC-0011; SRC-0012; SRC-0013 | data-types | 何の値・分類を可視化するかを定めるため。詳細な統計量は各図の理解を助けるが、全ツールの必須条件にはしない。 | 1 データ |
| new-qc-tools | 新QC七つ道具の用途、基本手順、読み方を説明する。 | SRC-0014; SRC-0015; SRC-0016; SRC-0017; SRC-0018; SRC-0019; SRC-0020 | — | 公式資料上は各道具の定義・基本の理解が独立目標で、統計計算を前提にしない。 | 4 QC手法 |
| probability-foundations | 事象・確率・独立・条件付き確率の基本を計算・解釈する。 | なし（数学・統計の橋渡し単元） | math-ratios-percentages; math-counting | 確率を比として計算し、場合の数から事象確率を作るため。 | 2 確率 |
| random-variables | 離散・連続確率変数、確率分布、期待値・分散を結び付ける。 | SRC-0025 | probability-foundations; math-algebra-sigma | 確率変数の値と確率を定め、期待値・分散の和を式で表すため。 | 2 確率 |
| normal-distribution | 正規分布を標準化し、条件を確認して確率を計算する。 | SRC-0021 | random-variables; math-powers-roots | 分布と確率変数の意味を持ち、標準偏差で尺度を変換するため。 | 2 確率 |
| binomial-distribution | 独立・一定確率の試行回数として二項分布を扱い、確率を計算する。 | SRC-0022 | random-variables; probability-foundations; math-counting | 試行モデル、各試行の確率、組合せ数のすべてが式に現れるため。 | 2 確率 |
| poisson-distribution | 一定の機会・曝露に対する計数モデルとしてポアソン分布を扱う。 | SRC-0023 | random-variables; probability-foundations | 計数値の確率モデルと確率変数の意味を理解するため。 | 2 確率 |
| sampling-distributions | 標本統計量の共通的な標本分布と標準誤差を説明する。t・カイ二乗・Fの節は方法別の条件付き内容とする。 | SRC-0024 | population-sample; descriptive-statistics; random-variables | 標本統計量の対象・計算・共通する確率的な振る舞いを区別するため。t・カイ二乗・F各節は共通目標に含めず、条件に合う方法を選ぶ場合だけ読む。 | 3 推定・検定 |
| law-large-numbers-clt | 大数の法則と中心極限定理の主張・条件・用途を区別する。 | SRC-0026 | random-variables; descriptive-statistics | 確率変数の和・平均とデータの要約を理解した上で、標本数増大時の性質を説明するため。標本分布の定義自体は必須にしない。 | 3 推定・検定 |
| inference-basics | 推定と検定、帰無仮説、信頼区間、p値、誤りの意味を説明する。 | SRC-0027 | population-sample; probability-foundations | 推定対象を定め、標本結果と確率的判断を分けるため。 | 3 推定・検定 |
| mean-inference | 母平均の区間推定・検定を条件別に選び、計算と結論を解釈する。 | SRC-0028 | inference-basics; descriptive-statistics; sampling-distributions#common | 推定・検定の目的、標本の散らばり、標本平均に共通する標準誤差・標本分布の考え方が必要。分布別の節は該当方法だけで学ぶ。 | 3 推定・検定 |
| variance-inference | 1母分散の推定・検定を分布仮定と自由度を明示して解釈する。 | SRC-0029 | inference-basics; descriptive-statistics; sampling-distributions#common | 標本分散と共通する標本分布の考え方が必要。カイ二乗分布節・正規性は該当する方法の条件として学ぶ。 | 3 推定・検定 |
| variance-ratio-inference | 2母分散の比の推定・検定を独立性・分布条件とともに扱う。 | SRC-0030 | variance-inference; sampling-distributions#common | 個々の分散と共通する標本分布の考え方を理解してから比を比較する。F分布節・正規性はF法を選ぶ場合だけ必要。 | 3 推定・検定 |
| mean-difference-inference | 独立2標本の母平均差を、等分散・Welch等の方法条件を区別して扱う。 | SRC-0031 | mean-inference; sampling-distributions#common | 1標本の平均推論と標本平均差に共通する標準誤差・標本分布の考え方が必要。t分布節は採用するt法でのみ読む。 | 3 推定・検定 |
| paired-inference | 対応データを差に変換し、差の平均を推定・検定する。 | SRC-0032 | mean-inference; descriptive-statistics; sampling-distributions#common | 分析単位が対応差になること、差の要約と共通する標本分布の考え方が必要。t分布節は対応差のt法を選ぶ場合だけ読む。 | 3 推定・検定 |
| proportion-count-inference | 母不適合品率・不適合数とその2標本比較を、データ型・条件別に扱う。 | SRC-0033; SRC-0034; SRC-0035; SRC-0036 | inference-basics; probability-foundations | 検定の目的と計数モデルの確率を対応させるため。二項・ポアソンは該当節に限り条件付き前提とする。 | 3 推定・検定 |
| contingency-tests | 分割表で独立性等を検定し、期待度数条件と結論を解釈する。 | SRC-0037 | inference-basics; probability-foundations; sampling-distributions#common | 帰無仮説と標本統計量の共通的な分布概念を理解するため。カイ二乗分布節はPearson法を選ぶ場合に限り条件付きで学ぶ。 | 3 推定・検定 |
| control-charts | 管理図の目的と限界を説明し、計量・計数の図を条件に応じて選ぶ。 | SRC-0038; SRC-0039; SRC-0040; SRC-0041; SRC-0042; SRC-0043 | data-types; descriptive-statistics; sampling | 観測型と工程データの中心・ばらつき、合理的な群分けを理解するため。各チャートの分布前提は方法別経路を参照。 | 4 QC手法 |
| process-capability | 工程の安定性や分布条件を確認し、選んだ方法の工程能力指数を計算・解釈する。 | SRC-0044 | descriptive-statistics; sampling | 工程の散らばりと抽出の意味が必要。正規工程を仮定するCp/Cpkの分布条件は条件表の方法を選ぶ場合だけ必要。 | 4 QC手法 |
| sampling-inspection | ロット・抽出・判定の関係と計数・計量方式を説明する。 | SRC-0045; SRC-0046; SRC-0047; SRC-0062; SRC-0063 | population-sample; data-types; probability-foundations | 母集団・標本・計測/計数値・判定確率を区別するため。 | 4 QC手法 |
| experimental-design | 因子・水準・応答・実験単位を定め、1元・2元配置を条件付きで分析する。 | SRC-0048; SRC-0049; SRC-0050 | data-types; descriptive-statistics | 実験因子と測定結果の型・要約を理解するため。分散分析を行う場合の推論前提は条件付き経路に置く。 | 4 QC手法 |
| correlation | 相関係数の意味・計算・限界を説明する。 | SRC-0051 | data-types; descriptive-statistics | 二変数の数値とその周辺分布を正しく解釈するため。 | 4 QC手法 |
| serial-correlation | 時系列順の相関が独立観測の前提に与える影響を説明する。 | SRC-0052 | correlation | 系列順を含む関連性を、通常の相関係数との違いで説明するため。 | 4 QC手法 |
| simple-regression | 単回帰式・分散分析・残差検討を条件と限界を含めて扱う。 | SRC-0053; SRC-0054; SRC-0055 | correlation; math-algebra-sigma; inference-basics; sampling-distributions#common | 係数式・関連性と、標準誤差・標本分布の共通概念が必要。t/F分布節は推測統計を使う方法でのみ読む。 | 4 QC手法 |

### 任意復習候補（必須前提ではない）

必要な場合だけ開く補助リンクの案。各リンクは必須前提グラフの辺に含めず、設問や誤答の文脈に応じて表示する。

| 起点lessonId | 任意復習先 | 表示する場面 |
|---|---|---|
| qc-seven-tools | descriptive-statistics | ヒストグラムや散布図を読む際に、中心・散らばりの見方を振り返る場合。 |
| new-qc-tools | qc-seven-tools | 図表による整理の経験があると手順を理解しやすい場合。必修の順序にはしない。 |
| control-charts | qc-seven-tools#graphs | 管理図の線・軸・記録値の見方を一般的なグラフから復習する場合。 |
| process-capability | control-charts#basics | 工程の安定性を管理図で確認する学習へ戻る場合。管理図を使わない確認方法を排除しない。 |
| correlation | qc-seven-tools#scatter | 相関係数の前に散布図で二変数の関係を確認する場合。 |
| experimental-design | qc-seven-tools#graphs | 因子・応答を図で比べる例を復習する場合。 |
| simple-regression | qc-seven-tools#scatter | 回帰式を読む前に散布図で関係・外れ値候補を確認する場合。 |

### 前提がない項目と保留項目

- new-qc-toolsは統計単元を必須にしない。各道具を理解する上で便利な図表・データ分析は任意復習とする。
- SRC-0056〜SRC-0059（信頼性工学）とSRC-0064（測定誤差評価）は範囲保留であり、lessonIdをまだ発行しない。
- SRC-0060（計測の基本）とSRC-0061（計測の管理）は本Issueの教材単元にしない。演習で測定値を使う際は単位・観測条件を設問に書く。
- 数学の橋渡し単元にsourceItemIdがないのは、JSA項目を装っていないためである。

sourceItemId欄・前提欄・条件付き経路に記したsection anchorは次の固定IDとする。設問・誤答から該当節を直接開けるようにする。

- sampling: error, design
- qc-seven-tools: pareto, cause-effect, check-sheet, histogram, scatter, graphs, stratification
- new-qc-tools: affinity, relations, tree, matrix, arrow, pdpc, matrix-data
- sampling-distributions: common, t, chi-square, f
- control-charts: basics, xbar-r, xbar-s, x-rs, p-np, u-c
- sampling-inspection: purpose, types, attribute, variable
- experimental-design: one-factor, two-factor
- simple-regression: anova, residuals

## 3. 条件付きの方法別前提

以下は該当する方法を選んだときだけ必要な知識であり、単元全体の共通必須前提に一括追加しない。各条件付き辺も、その方法の中では必須となる。

前提一覧の `sampling-distributions#common` は標本分布・標準誤差の共通基礎だけを指す。`#t`・`#chi-square`・`#f` は各行の方法を選ぶ場合に限る条件付き前提であり、3分布の全節を一律に学ぶ必要はない。DAGの頂点はlessonId単位で検査するが、節指定により必要範囲を限定する。

| 対象項目・section | 方法・条件 | 追加で必要な前提 | 教材で明示する判断点 |
|---|---|---|---|
| SRC-0028: 母平均 | 母標準偏差既知かつ正規母集団を仮定するz法 | normal-distribution | 母標準偏差が既知かを確認する。既知を実例で当然視しない。 |
| SRC-0028: 母平均 | 母標準偏差未知のt法 | sampling-distributions#t; 小標本ではnormal-distribution（母集団の正規性） | 自由度と仮定を表示する。正規性なしに小標本t法を一般化しない。 |
| SRC-0028・SRC-0031・SRC-0032: 平均 | 大標本近似を使う場合 | law-large-numbers-clt | 近似条件・標本サイズの判断を示し、万能な閾値を作らない。 |
| SRC-0029: 母分散 | 正規母集団を前提とするカイ二乗法 | sampling-distributions#chi-square; normal-distribution | 分散推論で正規性が重要なことを明示する。 |
| SRC-0030: 分散比 | 独立な正規母集団のF法 | sampling-distributions#f; normal-distribution | 独立性・正規性の条件を示す。 |
| SRC-0031: 2母平均差 | 等分散を仮定するpooled t法 | sampling-distributions#t; 小標本ではnormal-distribution（各母集団の正規性） | 等分散仮定を確認してから選ぶ。 |
| SRC-0031: 2母平均差 | 等分散を置かないWelch法 | sampling-distributions#t; 小標本ではnormal-distribution（各母集団の正規性） | pooled法と自由度・標準誤差が異なることを説明する。 |
| SRC-0032: 対応データ | 対応差に対するt法 | sampling-distributions#t; 小標本ではnormal-distribution（差の正規性） | 元データではなく対応差を分析し、その分布条件を調べる。 |
| SRC-0033・SRC-0034: 不適合品率 | 二項法または正規近似 | 二項法ではbinomial-distribution; 正規近似ではnormal-distributionと期待成功・失敗数の条件 | 近似条件を記載し、条件不足時に正規近似を自動選択しない。 |
| SRC-0035・SRC-0036: 不適合数 | 一定曝露量あたりのPoisson法 | poisson-distribution; 曝露量・独立性等の計数モデル条件 | 欠陥数と不適合品率を混同しない。2群比較では曝露量を揃える/調整する。 |
| SRC-0037: 分割表 | Pearsonのカイ二乗検定 | sampling-distributions#chi-square | 観測の独立性と期待度数の条件を確認する。 |
| SRC-0039・SRC-0040・SRC-0041: 計量値管理図 | Xbar-R、Xbar-s、X-Rsを用いる場合 | normal-distribution（標準的な限界係数と確率解釈を扱う場合） | subgroupの作り方、安定工程、係数表の前提を示す。 |
| SRC-0042: p/np管理図 | 不適合品率を二項計数で扱う場合 | binomial-distribution | npは標本サイズ一定、pは標本サイズ変動を扱えることを確認する。 |
| SRC-0043: u/c管理図 | 単位あたり不適合数をPoisson計数で扱う場合 | poisson-distribution | 検査単位・機会数と均一な発生率を確認する。 |
| SRC-0044: 工程能力指数 | 安定した正規工程にCp/Cpkを適用する場合 | normal-distribution; sampling | 規格幅と工程の自然なばらつきを区別し、安定性を前提に置く。 |
| SRC-0046: 計数規準型抜取検査 | 計数結果でロットを判定する方法 | binomial-distribution（採用する計画のモデルに応じて） | 抽出条件・判定基準・生産者/消費者リスクを明示する。 |
| SRC-0047: 計量規準型抜取検査 | 計量値からロットを判定する方法 | normal-distribution（採用する計画のモデルに応じて） | 分布・標本抽出・判定条件を明示する。 |
| SRC-0049: 一元配置 | 群平均を分散分析で比較する場合 | inference-basics; sampling-distributions#f; 残差の独立性・分散・分布条件 | 有意差は全ての群の差を特定しない。 |
| SRC-0050: 二元配置 | 主効果と交互作用を調べる場合 | inference-basics; sampling-distributions#f; 実験配置と誤差の条件 | 交互作用の有無と反復の有無に応じた分析範囲を区別する。 |
| SRC-0054・SRC-0055: 単回帰 | 回帰係数・モデルを推測統計で扱う場合 | sampling-distributions#t; sampling-distributions#f; 残差仮定 | 回帰式の推定だけで因果や範囲外予測を主張しない。 |

## 4. 学習順の例

矢印は学習順（前提から後続）を示す。複数の枝がある場合はすべての必須前提を満たす。任意復習だけの単元は経路に入れていない。

### 平均・分散・標準偏差

```text
math-arithmetic → math-ratios-percentages ───────────┐
math-arithmetic → math-powers-roots ─────────────────┼→ descriptive-statistics（SRC-0005）
data-types ──────────────────────────────────────────┘
```

母集団と標本の意味が必要な場合は、population-sample → samplingを任意に先行する。記述統計の前提ではないため、全員に必修化しない。

### 母平均の推定

```text
math-ratios-percentages + math-powers-roots → math-algebra-sigma
math-ratios-percentages → math-counting
math-ratios-percentages + math-counting → probability-foundations
population-sample + probability-foundations → inference-basics（SRC-0027）
probability-foundations + math-algebra-sigma → random-variables
population-sample + descriptive-statistics + random-variables → sampling-distributions#common
inference-basics + descriptive-statistics + sampling-distributions#common → mean-inference（SRC-0028）
```

選ぶ方法に応じ、既知母標準偏差の正規法、未知母標準偏差のt法、または大標本近似へ分岐する。分岐条件と条件付き前提は第3節の表に従い、全てを一律必須にはしない。

### 母平均の検定

```text
inference-basics（SRC-0027） + descriptive-statistics + sampling-distributions#common → mean-inference（SRC-0028）
```

共通の推論の考え方を学んでから、帰無仮説と対立仮説、検定統計量、方法別の分布・仮定、p値と結論へ進む。t法・正規法・大標本近似は母平均推論の方法別経路として分ける。母平均の推定と検定は同じ標本分布を使う場合があるが、問いと結論は異なる。

## 5. 復習リンクと元の学習への復帰

将来の教材データでは次の要件を満たす。

1. lessonIdは単元の固定ID、sectionIdはその単元内の安定した見出しIDとする。sourceItemIdは公式出典の追跡だけに使う。
2. 解説の用語・式・図、設問、誤答フィードバックには、関係するlessonIdと必要ならsectionIdを持たせる。復習リンク先は「単元の先頭」ではなく該当する節を指定する。
3. 学習元の設問には安定したquestionId、解説には元のlessonIdとsectionIdを持たせる。復習先へ移動してもこれらを保ち、元の問題または節に戻れるようにする。
4. 元へ戻った際は、回答入力や表示中の節など、復習前の学習状態を復元する。履歴保存方式・URL形式・モーダル方式はこのIssueでは決めない。
5. 任意の関連復習リンクは前提グラフの辺に含めない。主要な必須前提は本文中で明示し、補助的な復習は本文を読みにくくしない位置に置く。

## 6. 保留・スコープ境界

- 信頼性工学SRC-0056〜SRC-0059は公式手法編の2級項目だが、対象範囲と基礎分布の要否を決めていない。信頼性の独立したP0/P3/P4課題で範囲を定義するまでlessonIdは発行しない。
- 測定誤差評価SRC-0064は手法編ではなく実践編との境界にある。計測システム評価を含めるか決めてから単元化する。
- 計測の基本・計測の管理SRC-0060〜SRC-0061および実践分野の網羅は本Issueの対象外。設問で単位・条件を明記することは、計測管理教材の収録とは異なる。
- これはカリキュラム草案であり、統計教材の全範囲やQC検定2級全体の合格可能性を保証しない。

## 7. 検証記録

対応表と本表から一時スクリプトで次を検査し、スクリプトはリポジトリに含めない。

- 定義されたsourceItemIdが一意である。参照欄に同じIDが複数回出ることは許容する。
- 定義されたlessonIdが一意である。section anchorを参照する場合は、#より前のlessonIdを検査する。
- 対象・前提として対応させたsourceItemIdが対応表に定義されている。SRC-0056〜SRC-0059、SRC-0060〜SRC-0061、SRC-0064は保留・対象外として未割当の理由を本書と対応表に明示する。
- sourceItemIdからlessonIdへの対応が両文書で一致する。前提マップに載らない対象項目・前提項目はゼロである。
- 全必須前提lessonIdが定義済みで、必須辺・方法別の条件付き必須辺に循環がない。任意復習リンクは循環検査に含めない。

一時スクリプトの検査件数と結果はPRに記載する。Markdownの手動確認では表の全行、出典・公式記号・ID相互対応、節アンカー、指定学習経路、実践編との境界を確認する。アプリの実行テストは文書変更のみのため対象外とする。
