# MVP教材・問題データと学習導線（Draft）

> Status: **Draft v0.1**
> 作成日: 2026-10-21
> 対応Issue: [#3 — 教材・問題スキーマと主要画面の学習導線](https://github.com/painkiller8880888/SfQC/issues/3)

## 1. 目的と境界

この文書は、P1の基盤実装へ渡すために、教材・問題が持つ情報と、誤答から前提を復習して元の学習へ戻る動きを定義する。プロジェクト全体の教育方針は[基本方針](PROJECT_CHARTER_DRAFT.md)、教材単元・公式項目の対応と前提条件は[対応表](curriculum/SYLLABUS_MAPPING_DRAFT.md)および[前提マップ](curriculum/PREREQUISITE_MAP_DRAFT.md)を参照する。

ここでいう「スキーマ」は、項目の意味と制約をレビューするための概念設計である。実装用JSON Schema、シリアライズ、データベース、画面の見た目やルーティング、技術・ライブラリ選定は決めない。全カリキュラムの教材本文・問題も執筆しない。

## 2. IDと参照の約束

| ID | 意味・制約 | 参照先 |
|---|---|---|
| `lessonId` | 単元の安定ID。名称変更で振り直さず、既存の小文字ハイフン形式を使う。 | `PREREQUISITE_MAP_DRAFT.md` のlesson一覧 |
| `sectionId` | 単元内の安定した節アンカー。単独では一意でなく、`lessonId#sectionId`で指定する。記述統計の`mean`・`variance`・`standard-deviation`など、前提マップに宣言したIDを使う。 | 同マップの固定アンカー一覧 |
| `LessonRef` | 単元全体なら`lessonId`、特定節なら`lessonId#sectionId`。 | 現行registryのlessonまたは宣言済み節に解決する。教材本文のリンク先は収録済みlessonに限る。 |
| `sourceItemId` | JSA公式項目に限る出典追跡ID。数学の橋渡し単元には付けない。 | `SYLLABUS_MAPPING_DRAFT.md` のsource一覧 |
| `questionId` | 問題定義の安定ID。表示文や正答を変えても同じ定義を改訂する場合は改訂番号を上げる。 | 問題定義一覧。参照するIDは必ず同文書内で定義する。 |
| 改訂番号 | 教材または問題定義の内容版。整数を増やし、同じ番号を別内容に再利用しない。 | lessonまたはquestionの定義 |

教材と公式項目の対応は、lessonからsourceへもsourceからlessonへも複数の関係を登録できる多対多の関係として扱う。sourceの定義と対応関係を分離し、ある公式項目を複数のlessonで扱う場合は同じ`sourceItemId`を各lessonとの関係に再利用する。既存カリキュラムの例では`sampling-inspection`が`SRC-0045`、`SRC-0046`、`SRC-0047`、`SRC-0062`、`SRC-0063`を扱い、`SRC-0028`は`mean-inference#z`、`#t`、`#large-sample`の各方法節に対応する。現行マップにないlessonへの割当は例として捏造しない。

| 既存参照例 | 対応 |
|---|---|
| `descriptive-statistics` | `SRC-0005`。分散節は`descriptive-statistics#variance`。 |
| `mean-inference` | `SRC-0028`。方法別節は`#z`、`#t`、`#large-sample`。 |
| `math-algebra-sigma` | 数学の橋渡し単元。`sourceItemId`なし。節は`math-algebra-sigma#sigma`。 |
| `sampling-inspection` | `SRC-0045`、`SRC-0046`、`SRC-0047`、`SRC-0062`、`SRC-0063`。 |

本書の例で使うすべての`lessonId`、`sectionId`、`sourceItemId`は上記の既存資料に定義されている。新しく定義する`questionId`は後述の問題例2件だけで、lesson例からの参照も同じIDに解決する。

## 3. 教材データ

教材本文と画面表示を分け、lessonは「何を学ぶか」とその参照関係を持つ。必須前提・条件付き前提・任意復習は別欄で扱い、条件付き前提を共通必須へ読み替えない。

| 項目 | 必須性・型または制約 | 参照先・意味 |
|---|---|---|
| `lessonId` | 必須。既存の安定ID文字列。 | 前提マップで定義する単元。 |
| `title` | 必須。短い表示名。 | なし。 |
| `learningObjectives` | 必須。学習者ができるようになることを表す1件以上の文章。 | なし。公式の到達目標とは混同しない。 |
| `commonPrerequisites` | 必須。0件以上の`lessonId`または節アンカーの集合。 | 欠けると共通目標が理解できない前提。既存前提マップの共通必須辺と一致させる。 |
| `conditionalPrerequisites` | 必須。0件以上の「条件・前提先・到達方法節」の組。条件文は利用者にも理解でき、方法選択を判定できる具体性を持つ。 | 該当方法を選ぶ場合だけ必要。方法別前提表と一致させ、一律の必修にしない。 |
| `optionalReviews` | 必須。0件以上の「起点・復習先・表示する場面」の組。 | 理解を助ける復習。必須前提グラフには加えない。 |
| `availability` / `sections` | lessonの状態は`planned`または`included`。収録前は宣言済みsection IDだけを登録し、収録済みは1件以上の節に見出しと本文を持つ。各節には空白以外のparagraphまたはformulaを含める。 | plannedの節IDは前提関係を記録するために使い、学習者向け本文リンク先にはしない。includedの節一覧は宣言IDと一致させる。 |
| 本文blocks | 節本文は`paragraph`、`formula`、`lessonRef`、`figureRef`の判別可能なblock。段落と式は順序付き`parts`を持つ。 | lesson参照tokenは段落・式内の位置をpartsの添字で定める。任意HTML・Markdown parser・任意コードは使わない。 |
| `figures` | 任意。`cartesian`は変数・単位とx/y軸・尺度を持ち、`diagram`は座標軸・変数を持たない。どちらも`code:名前`形式の描画参照、教育目的、凡例、代替説明を持つ。操作可能ならキーボードでも扱えること。 | `figureRef`は同じincluded lesson内の定義へ解決する。描画コードの実在性と操作性は図を収録するIssueで確認する。画像生成物は使わない。 |
| `questionIds` | 必須。問題定義IDの集合。教材契約導入時点では空配列のみ。 | 問題registryの追加後に参照先を検証する。 |
| `sourceItemIds` | 必須。0件以上の公式`sourceItemId`集合。 | 対応表で定義されたJSA項目のみ。数学橋渡し単元は空集合。lessonとsourceは多対多。 |
| `sourceRefs` / `SourceDefinition` | lessonは出典記録IDを持つ。出典記録は資料名、直接URL、版、確認日、利用目的を持ち、対応する各`sourceItemId`のページ・項目を引用一覧に記録する。 | 公式`sourceItemId`とは別IDで管理し、担当項目と引用記録のカバレッジを検査する。前提マップと公式対応表への一致もCIで検査する。本文や設問の転載はしない。 |
| `revision` | 必須。1以上の整数。教材内容を改訂したとき増やす。 | 学習記録の対象教材を識別するための概念上の版。保存方式は未決定。 |
| `curriculumRevision` / `officialSourceItemIds` | registry全体の改訂番号と、対応表で定義した公式sourceItemId一覧。 | `curriculumRevision`は教材個別の`revision`と別に増やす。 |

### 3.1 教材の短い例

| 項目 | 値 |
|---|---|
| `lessonId` / `title` | `descriptive-statistics` / 基本統計量 |
| `learningObjectives` | 平均・範囲・分散・標準偏差を計算し、中心と散らばりを説明する。 |
| `commonPrerequisites` | `data-types`、`math-ratios-percentages`、`math-powers-roots`（前提マップどおり）。 |
| `conditionalPrerequisites` | なし。 |
| `optionalReviews` | `descriptive-statistics#variance`から`math-algebra-sigma#sigma`。分散式のΣが初出する位置で案内する。 |
| `sections` | `variance`（分散と散らばり）。固定アンカーは既存の前提マップに合わせる。 |
| `inlineLinks` | 分散式中の`Σ`から`math-algebra-sigma#sigma`へ。リンクラベルは「総和記号の読み方」。 |
| `figures` | `FIG-DESC-VAR-001`を分散節から参照。下の図解例を参照。 |
| `questionIds` | `q-desc-var-sc-001`、`q-desc-var-num-001`。どちらも後述の定義に存在する。 |
| `sourceItemIds` | `SRC-0005`。 |
| `sources` | 3級レベル表（`https://webdesk.jsa.or.jp/pdf/qc/md_4609.pdf`、Ver.20150130.2、2026-10-21確認、p.1「基本統計量とグラフ」）と4級レベル表（`https://webdesk.jsa.or.jp/pdf/qc/md_4610.pdf`、Ver.20150130.2、2026-10-21確認、p.1「平均とばらつき」「平均と範囲」）。対応表にも同じ資料位置を記録する。 |
| `revision` | `1`。 |

この表は教材契約の記法を説明する設計例であり、単一節・revision 1は現在の本番registryの構成を示さない。

`math-algebra-sigma`には公式項目を装うsource IDを付けない。1つの教材で複数の公式項目を扱う例は`sampling-inspection`の5件の対応を参照する。複数lessonへ同じ公式項目を割り当てる場合も、source ID自体を複製・変更せず、対応表の関係を追加する。現行資料にない対応はこの例では作らない。

教材本文の`LessonRef`は`lessonId`または`lessonId#sectionId`で表す。段落は`{kind:"text", text}`と`{kind:"lessonRef", label, targetRef}`を順序付きpartsとして持ち、数式は`{kind:"mathText", text}`と`{kind:"mathSymbol", symbol, lessonRef?}`を順序付きpartsとして持つ。たとえば分散式中の`Σ`に復習先を付ける場合、記号tokenに表示ラベルと`math-algebra-sigma#sigma`を保持するため、式の表示文字列を検索して位置を推測しない。本文リンクはincluded lessonへ解決し、planned lessonや宣言だけのsectionへは遷移しない。`curriculumRevision`とlessonごとの`revision`は正の安全整数とし、別々に管理する。

### 3.2 図解の例

`FIG-DESC-VAR-001`（`rendererRef=code:variance-deviation-bars`）は測定値`1.000, 2.200, 3.000 mm`とその平均、平均からの偏差を示すコード描画図の参照IDである。目的は、分散が平均からの偏差の二乗をまとめた量だと見せること。横軸は観測番号（単位なし）、縦軸は測定値（mm）で、平均の線と偏差を凡例で区別する。テキスト代替は「3値は約2.067 mmを中心に並び、分散の計算では平均からの差を二乗する」とする。実装時はSVG等のコードから描画し、色だけに意味を持たせない。

## 4. 問題データ

### 4.1 問題定義の項目

問題定義は、再利用できる設問と生成・採点規則を表す。初期MVPの選択式は、採点と誤答別案内を最小に保つ**単一選択**とする。1問の正答は1選択肢で、選択肢の重複や複数正解を作らない。複数選択と自由記述は初期対象に含めない。

| 項目 | 必須性・型または制約 | 参照先・意味 |
|---|---|---|
| `questionId` | 必須。小文字・数字・ハイフンの安定文字列。文書内で一意。 | 問題定義を指す。 |
| `lessonRefs` | 必須。1件以上の`lessonId#sectionId`。 | 対象lessonと、採点後に戻れる解説節。既存lessonとanchorに解決する。 |
| `difficulty` | 必須。`基礎`・`標準`・`応用`のいずれか。 | 設問で必要となる理解・計算の段階を示し、出題選択に使う。 |
| `format` | 必須。初期値は`single-choice`または`numeric`。 | 出題形式。 |
| `prompt` | 必須。独自作成の設問文。 | 公式問題の転載はしない。 |
| `conditions` | 必須。データ、前提条件、求める量、単位など、解答に必要な条件。 | 省略された仮定を学習者に推測させない。 |
| `choices` | `single-choice`で必須。異なるキーを持つ2件以上の選択肢。正答キーは1つだけ。`numeric`では使わない。 | 選択肢キーは同じ問題内で一意。 |
| `generator` | 必須。固定問題なら`fixed`。生成問題なら入力範囲、シードの扱い、生成規則の版とパラメータ制約を記す。 | 乱数生成は同一の版とシードで同じ確定パラメータを得る。生成結果の値も出題インスタンスへ残す。 |
| `grading` | 必須。選択肢の正答キー、または数値の比較規則。数値では丸め・誤差・単位の規則を明記する。 | 下記4.2に共通規則を示す。 |
| `correctAnswer` | 必須。形式に合う正答値。 | 数値では単位と期待値の丸め桁を持つ。 |
| `solution` | 必須。途中計算、根拠、適用条件を示す。 | 正答と途中計算を別に検算する。 |
| `feedbackRules` | 必須。1件以上。既知の誤解に当たる条件または選択肢、理由、復習先を記す。 | 復習先は定義済みの`lessonId#sectionId`。 |
| `defaultFeedback` | 必須。特定の誤解と判定できない誤答への共通説明。 | 数値誤答を根拠なく誤解タグへ分類しない。 |
| `sources` | 必須の欄。0件以上。外部出典を使う場合は資料名、URL、版、確認日、位置、利用目的を記録する。 | 公式資料は範囲確認に使い、本文・設問は独自に作る。 |
| `revision` | 必須。1以上の安全整数。問題定義を変更したら増やす。 | インスタンス再現時にも参照する。 |

Issue #8の機械可読契約では、`QuestionDefinition.kind`を`fixed`または`generated`とする。固定定義は確定済みの`content: QuestionContent`を持ち、生成定義は`generator`と未展開の`contentTemplate`を持つ。生成前のテンプレートに確定済み正答・選択肢・途中計算を空値やダミー値として置かない。P2の生成処理が確定した`QuestionContent`を作り、今回追加する契約処理はその検証と出題snapshotへのコピーを担う。テンプレートの展開、乱数生成、採点は行わない。

型への割当は次のとおりとする。`QuestionDefinition`の共通項目は`questionId`、`revision`、`lessonRefs`、`difficulty`、`sources`。`QuestionContent`は`format`、`prompt`、`conditions`、`parameters`、形式に応じた`choices`、`correctAnswer`、`grading`、`solution`、`feedbackRules`、`defaultFeedback`を持つ。`QuestionContentTemplate`は`format`と、`promptTemplate`、`conditionsTemplate`、形式に応じた選択肢・採点条件、`correctAnswerTemplate`、`solutionTemplate`、`feedbackRulesTemplate`、`defaultFeedbackTemplate`を持つ。生成定義の`generator`は正の安全整数`generationRuleVersion`と、名前付き整数パラメータの包含`min`・`max`範囲を持つ。

`QuestionContent`は形式別の判別可能な型とし、確定した設問、条件、パラメータ、正答、採点規則、解法、feedbackを保持する。単一選択にはID付きの選択肢を必須とし、数値入力には選択肢を認めない。パラメータmapの名前は小文字・数字・ハイフンのIDとし、値は安全整数または十進文字列に限る。生成パラメータは安全整数の`min`・`max`を含む整数範囲だけを扱い、範囲境界は含む。任意の式、制約言語、十進演算器は扱わない。

数値・許容差・確定した十進パラメータは十進文字列で保存し、`Number`に変換して比較しない。文字列は任意の負号を付けた整数または小数とし、指数表記、先頭の不要な0、非有限値は許可しない。小数部の末尾の0は表示桁を保つため許可する。数値採点の`roundingDigits`は0以上の安全整数とする。seedは空白だけではない文字列を受け取り、その文字列を正規化せず出題インスタンスに保存する。生成規則版は正の安全整数とする。

契約オブジェクトは列挙したキーだけを受け入れ、未知キー、`undefined`、非有限数、区分に合わない項目、不正な整数・十進文字列を拒否する。選択肢表示は`label.trim().replace(/\s+/gu, " ")`で比較し、正規化後の空欄・重複を拒否する。保存するラベル原文は変更しない。lesson/section参照はIDの構造を検査するが、機械可読カタログとの存在照合は後続課題とする。

数値採点の共通仕様は、期待値と回答を指定桁数に丸めた後で比較し、中間値は絶対値が大きくなる方向へ丸める。絶対・相対許容誤差は非負の十進文字列で表し、いずれかの境界を含む条件を満たせば正答とする。丸め後の期待値が0なら絶対許容誤差が必須で、相対許容誤差を併記しても判定には使わない。今回の型・validatorはこの採点規則を検証するが、丸め・誤差計算・回答採点は実行しない。

### 4.2 数値入力の採点規則

- 入力欄に単位を表示し、数値だけを受け取る。周囲の空白は除き、小数点は`.`、符号は任意とする。桁区切り、単位文字列、数式、指数表記は入力値として受け付けない。表示単位への換算は行わず、別単位を含む回答は教材の解説で注意する。
- 回答文字列の形式は `^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?$` とする。`+1.0`と`-0`は受け付け、`01.0`、`.5`、`1.`、空文字は受け付けない。
- 期待値は計算途中で丸めず、最後に指定桁数`p`へ丸める。入力値も数値として読み取った後、同じ`p`桁へ丸める。丸めは四捨五入（ちょうど中間なら絶対値が大きくなる方向）とする。
- 丸めた値を`e`（期待値）、`x`（入力値）とし、`d = |x - e|`で比較する。正答条件は **`d <= 絶対許容誤差` または `d / |e| <= 相対許容誤差`**。これはOR条件で、どちらかを満たせば正答。`e = 0`のとき相対誤差は使わず、絶対許容誤差だけを適用する。
- 絶対許容誤差は表示単位と同じ単位、相対許容誤差は無次元の比率で定義する。境界は`<=`を含み、境界の外は誤答とする。
- 丸め・許容誤差・境界の比較は、定義した十進値の意味を保って行う。二進浮動小数点の近似誤差や任意のepsilonで結果が変わらないよう、相対誤差は`d / |e|`と同値な十進または有理数の比較（例: `d <= 相対許容誤差 × |e|`）を使えるものとする。具体的な実装方法や保存形式は定めない。

### 4.3 選択式の例

| 項目 | 値 |
|---|---|
| `questionId` | `q-desc-var-sc-001` |
| `lessonRefs` | `descriptive-statistics#variance` |
| `difficulty` | `基礎` |
| `format` | `single-choice` |
| `prompt` | 「分散 `s²` の単位として正しいものを選んでください。元の測定値の単位はmmです。」 |
| `conditions` | 分散の式では平均との差（偏差）を二乗して集計する。 |
| `choices` | A: mm、B: mm²、C: mm⁻¹。Bだけが正答。 |
| `correctAnswer` | B。偏差を二乗するため単位も二乗になる。 |
| `grading` | 選択したキーがBの場合だけ正答。部分点は付けない。 |
| `sources` | なし。公式設問を使わず独自作成。範囲確認はlessonのsource資料で行う。 |
| `generator` | `fixed`。 |
| `solution` | 各偏差はmm、偏差の二乗はmm²、分散もmm²。 |
| `feedbackRules` | Aは偏差と偏差平方の単位を混同。Cは逆数化と混同。どちらも`descriptive-statistics#variance`へ案内する。 |
| `defaultFeedback` | 選んだ単位を式の各段階で追い、観測値と平均との差を二乗した後の単位を確認する。 |
| `revision` | `1`。 |

### 4.4 数値入力の例と独立検算

| 項目 | 値 |
|---|---|
| `questionId` | `q-desc-var-num-001` |
| `lessonRefs` | `descriptive-statistics#variance` |
| `difficulty` | `標準` |
| `format` | `numeric`。入力欄の単位ラベルはmm²。 |
| `prompt` | 「標本とみなす測定値1.000 mm、2.200 mm、3.000 mmから、母分散の不偏推定量である不偏分散を求めてください。結果は小数第3位までです。入力値は採点時に小数第3位へ丸め、丸め後の正答と一致した場合に正解とします。」 |
| `conditions` | 母分散の不偏推定量である不偏分散 `s² = Σ(xᵢ − x̄)² / (n−1)`。単位はmm²。 |
| `generator` | `fixed`。測定値は計算・採点の説明用に固定した仮例であり、seedから生成した値ではない。生成問題で使う入力範囲・seedの扱い・規則版・パラメータ制約はP1で定義する。 |
| `grading` | `p=3`、期待値と入力値を比較前に丸める。絶対許容誤差 `0 mm²`、相対許容誤差 `0%`、併用はOR。丸め後の値が一致した場合だけ正答。 |
| `correctAnswer` | `1.013 mm²`（丸め前は`76/75 = 1.013333… mm²`）。 |
| `feedbackRules` | `0.676 mm²`は`n`で割った値`152/225 = 0.675555… mm²`に一致する。不偏分散の除数を`n−1`にする理由を示し、`descriptive-statistics#variance`へ案内する。 |
| `defaultFeedback` | §4.5の共通フィードバック。既知の計算過程に一致しない誤答を推測で分類しない。 |
| `sources` | なし。計算例は独自作成。範囲確認はlessonのsource資料で行う。 |
| `revision` | `2`。 |

**途中計算の検算:**

\[
\bar{x}=(1+2.2+3)/3=31/15=2.0666\ldots\ \mathrm{mm}
\]

\[
\sum(x_i-\bar{x})^2=\frac{152}{75}=2.0266\ldots\ \mathrm{mm^2},\qquad
s^2=\frac{152/75}{3-1}=\frac{76}{75}=1.0133\ldots\ \mathrm{mm^2}
\]

別の式 `s² = (Σxᵢ² − (Σxᵢ)²/n)/(n−1)` でも、
\((1+4.84+9-(6.2)^2/3)/2=76/75\) となり一致する。したがって期待値を小数第3位へ丸めた`e=1.013 mm²`が正答基準。

| 入力（欄の単位はmm²） | 入力側を3桁に丸めた値 | `d` | 判定と理由 |
|---:|---:|---:|---|
| `1.0125` | `1.013` | `0` | 正答。入力側を丸めると期待値と一致する。 |
| `1.0135` | `1.014` | `0.001` | 誤答。中間値を絶対値が大きくなる方向へ丸めるため、一致しない。 |
| `1.018` | `1.018` | `0.005` | 誤答。丸め後も期待値`1.013`と異なる。 |

固定問題の許容差は絶対・相対ともに0なので、丸め後に期待値と入力値が一致した場合だけ正答になる。`1.018`は差`0.005 mm²`であり、誤答となる。

**OR規則の個別境界検算（採点ロジックの検証専用であり、新しい教材問題ではない）:** 期待値を`e=100.000`、丸めを小数第3位、単位を統一し、表示した入力を丸め後の`x`として判定する。各側で境界の内側・一致・外側を確認し、他方の条件は偽になるようにする。

| 検証する側 | 絶対許容誤差 | 相対許容誤差 | `x` | `d` | 絶対条件 | 相対条件 | 最終OR判定 |
|---|---:|---:|---:|---:|---|---|---|
| 絶対 | `0.200` | `0.1%` | `100.199` | `0.199` | 真 | 偽（`0.199%`） | 正答 |
| 絶対 | `0.200` | `0.1%` | `100.200` | `0.200` | 真（境界） | 偽（`0.200%`） | 正答 |
| 絶対 | `0.200` | `0.1%` | `100.201` | `0.201` | 偽 | 偽（`0.201%`） | 誤答 |
| 相対 | `0.200` | `0.5%` | `100.499` | `0.499` | 偽 | 真（`0.499%`） | 正答 |
| 相対 | `0.200` | `0.5%` | `100.500` | `0.500` | 偽 | 真（境界） | 正答 |
| 相対 | `0.200` | `0.5%` | `100.501` | `0.501` | 偽 | 偽（`0.501%`） | 誤答 |

**不偏分散を計算する中間値と答えは、偏差平方和の式と平方和の式で別々に検算した。** 実装時にはこの計算と境界例を自動テストするが、今回の設計文書ではアプリ実行テストは行わない。

### 4.5 誤答フィードバック

単一選択では誤答に個別の説明と復習節を指定できる。各`choiceId`は正答IDと異なり、feedback規則間で一意にする。数値入力では、除数を`n`にしたなど典型的な誤答値に丸め後の回答が一致した場合だけ個別説明を示す。一致は学習者が実際にその誤りをしたと確定するものではない。一致ruleがない場合や複数のruleが一致する場合は原因を推測せず、次の共通フィードバックを使う。

> この値だけでは誤りの原因を特定できません。不偏分散の式、偏差平方和、除数`n−1`、丸める位置、入力欄の単位を順に確認し、途中計算と見比べてください。解説の「分散」節を開いてから、同じ出題に戻って再入力できます。

共通説明は誤りを断定せず、該当する`lessonId#sectionId`へのリンクを付ける。

## 5. 問題定義・出題インスタンス・解答試行

3つは概念上の責務を分ける。保存データの版は`schemaVersion`で管理する。Issue #8の型は`src/question-contract.mjs`と対応する型宣言で提供する。

### 5.1 採点API

`gradeQuestionAnswer(instance, answer)`は出題時の`questionDefinitionSnapshot.content`だけを根拠に判定し、回答やsnapshotを変更しない。選択肢IDまたは十進数の文字列を受け取り、形式違反と不正instanceは採点済みの誤答と分けて返す。正答は`{ status: 'graded', isCorrect: true, feedback: null }`、誤答は`status: 'graded'`と`isCorrect: false`に説明・復習先を持つfeedbackを返す。不正値は`{ status: 'invalid', reason: 'invalid-instance' | 'invalid-answer-format' }`とし、前者はsnapshot不正・未対応形式、後者は選択肢IDまたは十進文字列の不正を表す。rule feedbackは`matchedRule`に選択肢IDまたはsnapshotの数値rule原文を含み、default feedbackは個別ruleを含まない。結果はJSON互換の値であり、内部演算の`BigInt`は含めない。

| 概念 | 必須の情報 | 目的 |
|---|---|---|
| 問題定義 (`QuestionDefinition`) | 固定定義は`kind="fixed"`と確定済み`QuestionContent`、生成定義は`kind="generated"`と生成規則・未展開テンプレートを持つ。共通項目は`questionId`、`revision`、`lessonRefs`、`difficulty`、`sources`。 | 何をどう生成・採点する問題かを定義する。 |
| 出題インスタンス (`QuestionInstance`) | `instanceId`、`questionId`、`questionDefinitionRevision`、`kind`、深く不変なコピーの`questionDefinitionSnapshot`。生成問題のみseedと`generationRuleVersion`を持つ。 | 学習者に実際に出した内容と条件を固定し、後で同じ問題を表示・採点できるようにする。seedだけでの再現に依存しない。 |
| 解答試行 (`AnswerAttempt`) | 対応する出題インスタンス、入力値、採点結果、該当するフィードバック規則または共通フィードバック。 | その出題に対する一回の回答と判定を対応づける。再回答は同じインスタンスに別の試行として追加できる。 |

生成された確定パラメータの再現性キーは`(questionId, generationRuleVersion, seed)`とする。`generationRuleVersion`は同じ`questionId`内で管理し、異なる問題ID間で同じ版とseedが同じ値を示す必要はない。入力範囲・パラメータ制約・乱数アルゴリズム・確定手順を規則版に紐づけ、確定値に影響する変更では版を上げる。設問文や解説だけの変更は、確定値が変わらない限り規則版を変えない。再現性キーは確定パラメータを識別し、当時の表示・採点内容は保存済みsnapshotが保持する。

`questionDefinitionSnapshot`は`questionId`、当時の定義`revision`、`kind`、必要な教材参照・難易度・出典と、確定済み`content`を含む独立コピーとする。`content`には設問・選択肢・確定パラメータ・条件・単位・正答・採点規則・解法・feedbackを含める。確定パラメータ・単位・条件は`questionDefinitionSnapshot.content`を唯一の正本とし、インスタンス外側やsnapshot内の別フィールドに重複させない。生成snapshotは`generationRuleVersion`を含み、インスタンス側の値との一致を検証する。`questionDefinitionRevision`は当時の定義の識別に使い、スナップショットの代わりにはならない。アプリ更新後も保存snapshotを復元に使い、現行定義への自動置換や再生成はしない。

snapshot validatorは保存済み構造だけを検査し、現行`QuestionDefinition`の存在を要求しない。出題作成時は定義・生成規則と確定内容を照合し、宣言済みパラメータ名・整数範囲・形式・テンプレートで固定した採点条件・feedbackルールの件数と復習先を確認してから独立コピーを作る。単一選択feedbackは分岐IDも照合する。feedbackの説明文などの補間とseedから内容を再生成して一致を証明する処理は生成器の責務とする。

`createQuestionInstance`は独立したJSONコピー全体を再帰的にfreezeして返す。JSON.parse後の値は`restoreQuestionInstance`へ渡し、保存済み構造を検査してから独立コピーを再帰freezeする。`validateQuestionInstance`は構造を確認するだけで、入力をfreezeしない。

新規出題時に呼出側が一意な`instanceId`を発行し、作成処理へ渡す。同じ問題・版・seed・確定値でも別出題には別IDを使い、再開・再回答では保存済みIDを維持する。IDを再現性キーから導出しない。保存データ全体のJSON構造版は、後続の保存機能が管理する`schemaVersion`に置く。`revision`は問題内容、`generationRuleVersion`は生成挙動の改訂を表し、いずれも保存構造の版には使わない。

Issue #9では`QuestionInstance`のみを保存し、`AnswerAttempt`は保存しない。localStorageの固定キー`sfqc:local-data`に`{ "schemaVersion": 1, "questionInstances": [...] }`を保存し、JSONバックアップにも同じ形式を使う。空集合は有効で、集合内の`instanceId`は一意とする。1回の保存・復元は最大500件、JSONはUTF-8で最大1 MiBとする。保存集合のschemaとIDを検査した後、各instanceを`restoreQuestionInstance`へ渡し、全件が成功したときだけ保存内容へ反映する。version 1以外は拒否し、migrationは行わない。`AnswerAttempt`の保存、出題IDとの関連付け、回答履歴の参照整合性検査は学習履歴機能で扱う。

Issue #22で保存形式を`{ "schemaVersion": 2, "questionInstances": [...], "answerAttempts": [...], "reviewEvents": [...] }`へ拡張する。v1は読み取り・JSON export・確認付きimportで扱え、アプリ初期化時のread/exportは書き込みをしない。画面描画後にv1からv2へ昇格し、失敗時は元のrawと検証済みデータを保ち、v2形式のbackupを書き出せる。通常saveは既存3配列の順序と要素内容を維持した末尾追記だけを許す。整理を含む置換は利用者が確認したJSON importに限る。snapshotは最大500件、JSONはUTF-8で最大2 MiBとする。2 MiBはアプリ側の上限であり、ブラウザquotaを保証しない。

`AnswerAttempt`は`attemptId`、`instanceId`、入力文字列`answer`、`status: 'graded'`の採点結果、UTCの実在日時`attemptedAt`を持つ。入力の前後空白を含む原文を保持し、選択式はsnapshot内choice ID、数値式は採点APIと同じ十進数形式を検証する。採点結果は過去の判定を再計算せず、正答/誤答のunionと、snapshot内の一致するrule/default feedbackを検証する。`ReviewEvent`は`reviewEventId`、`targetRef`、誤答`sourceAttemptId`、UTCの実在日時`reviewedAt`を持つ。これは復習先への明示的な訪問記録で、理解・復習完了・習熟の証拠ではない。保存時にはtargetRefのLessonRef構文と誤答attempt参照を検証するが、教材registryに現存するかは問わない。実際のevent記録triggerは後続Issue #26が担う。

数値例の`QuestionInstance`は`instanceId`、`questionId=q-desc-var-num-001`、`questionDefinitionRevision=2`、snapshot、固定値`1.000, 2.200, 3.000 mm`とする。revision 1の保存済みsnapshotは旧許容差を保持し、`1.018`を正答とする。これらの確定値と「母分散の不偏推定量である不偏分散・分母`n−1`・小数第3位・mm²」の計算条件は、snapshot内の`content`だけに置く。たとえば回答`1.030`は、入力欄の単位mm²で丸め後も`1.030`、判定は誤答となり、既知の誤り規則に一致しなければ§4.5の共通フィードバックを使う。これは一つの`AnswerAttempt`として同じ出題インスタンスに紐づく。

| 学習者の操作 | 扱うもの |
|---|---|
| **この問題へ戻る／再開** | 元の`QuestionInstance`を開き、出題時の定義スナップショット、確定値、入力中の回答、表示位置、復習前の学習状態を復元する。 |
| **類題を始める** | 生成問題に限り、同じ`questionId`の規則から別seedまたは別パラメータの新しい`QuestionInstance`を作る。固定問題ではこの操作を案内しない。元の問題・試行は書き換えない。 |

## 6. 前提と節レベルの復習

前提マップの区分をそのまま教材表示に使う。

| 区分 | 表示・移動の条件 | 例 |
|---|---|---|
| 共通必須 | 学習目標を理解する全員に必要な前提として示す。 | `descriptive-statistics`の`data-types`、`math-ratios-percentages`、`math-powers-roots`。 |
| 方法条件付き必須 | 学習者が該当方法を選んだ場合だけ、その方法節を開く前提として示す。未選択の方法は要求しない。 | `mean-inference#t`を選んだ場合は`sampling-distributions#t`へ案内する。小標本では母集団の正規性を仮定する条件も確認し、復習先として`normal-distribution`（単元全体）を条件付きで示す。 |
| 任意復習 | 前提を満たした扱いにせず、本文理解を助ける場合だけ補助リンクとして示す。 | 分散節の`Σ`から`math-algebra-sigma#sigma`へ。 |

本文内のリンクは、表示テキストに加えて「用語・式・図のどの箇所から移動するか」と復習先の`lessonId#sectionId`を持つ。復習リンクを選ぶとき、遷移元のlesson/sectionまたは問題インスタンスを戻り先に積む。段落冒頭など該当節を持たない箇所には、存在しないアンカーを作らず単元全体へ案内する。

## 7. 主要画面の役割

| 画面 | 主な役割 | 主な移動先 |
|---|---|---|
| 学習マップ | lessonの目標、共通必須前提、方法条件付き前提、任意復習、進捗を見渡して次の学習を選ぶ。条件付き前提は方法を選ぶまでは必修表示にしない。 | 単元解説、前提の該当節。 |
| 単元解説 | 目標・説明・式・コード描画図・例題を示す。本文中の用語・式・図から節レベル復習へ移す。 | 演習、`lessonId#sectionId`の前提復習、学習マップ。 |
| 演習 | 出題インスタンスの条件・単位を保って回答を受け付ける。 | 採点・フィードバック、同じ問題の再開。 |
| 解答・フィードバック | 正誤、根拠、誤答別の説明と該当節への復習先を示す。未知の数値誤答には共通説明を使う。 | 復習先、同じ出題への復帰、生成問題の別パラメータ類題。 |
| 進捗ダッシュボード | 単元状態（未着手・学習中・演習中・復習待ち・定着確認済み）、試行数、正答率、最終実施日、復習履歴を示す。少数回の正答率で理解度を断定しない。 | 単元解説、演習、復習対象。 |
| データ管理 | ブラウザ内の出題snapshot・解答試行・復習イベント件数を確認し、利用者がJSONバックアップ・復元を行う。 | 進捗ダッシュボード、JSONの書き出し・読み込み。 |

画面は「学習マップ→単元解説→演習→採点・フィードバック→関連節の復習→元の出題へ復帰→再演習→進捗確認」を支える。ページ遷移・モーダル等の見た目やルーティング方式は未決定。

## 8. 復習後に元の出題へ戻るシナリオ

1. 学習者は学習マップから`descriptive-statistics`を開き、固定した仮例`q-desc-var-num-001`を確定値`1.000, 2.200, 3.000 mm`で解く。
2. `1.030 mm²`を入力して誤答する。既知の誤解に一致しなければ共通フィードバックを表示し、問題定義へ遡って誤った誤解ラベルを付けない。
3. フィードバックの復習リンクで`descriptive-statistics#variance`へ移動する。式中の`Σ`を選ぶと`math-algebra-sigma#sigma`へ進む。
4. `math-algebra-sigma`の共通前提は`math-ratios-percentages`と`math-powers-roots`。必要ならどちらかの復習を開き、たとえば`math-powers-roots`からその共通前提`math-arithmetic`へ進む。復習元の問題状態はリセットしない。
5. `math-arithmetic`から戻る場合は`math-powers-roots`、`math-algebra-sigma#sigma`、`descriptive-statistics#variance`の読んでいた位置へ順に戻る。そこから元の解答・フィードバックを経て、同じ出題インスタンスへ戻る。
6. 復帰時は`questionId`と出題時の定義スナップショット、確定値・計算条件、入力中の`1.030`、当時の採点結果とフィードバック、戻り経路、表示中の節と本文位置、復習前の学習状態を保持する。再演習は同じ出題インスタンスに新しい`AnswerAttempt`として追加し、以前の試行を残す。

この経路で必要な既存IDは`descriptive-statistics#variance`、`math-algebra-sigma#sigma`、`math-ratios-percentages`、`math-powers-roots`、`math-arithmetic`で、すべて前提マップに定義済みである。

## 9. 参照整合・検証方針

文書レビューで次を確認する。

- lesson例の`descriptive-statistics`とsource `SRC-0005`、`mean-inference`と`SRC-0028`、数学橋渡しの`math-algebra-sigma`（sourceなし）が既存の対応表・前提マップと一致する。公式項目とlessonの関係は多対多で保持し、例に存在しない割当を作らない。
- 本書で参照するsection anchorは、`descriptive-statistics#variance`、`math-algebra-sigma#sigma`、`mean-inference#z`、`mean-inference#t`、`mean-inference#large-sample`、`sampling-distributions#t`である。いずれも前提マップで固定済み。小標本のt法の正規性の前提は、anchorを定めていない既存lesson全体の`normal-distribution`へ案内し、未定義のsectionを参照しない。
- `q-desc-var-sc-001`と`q-desc-var-num-001`は本書内に一度ずつ定義され、教材例の`questionIds`、シナリオ、解説リンクのすべてがこの2件のどちらかを指す。`FIG-DESC-VAR-001`も教材例・図解例に対応する。
- 共通必須、方法条件付き必須、任意復習を混同していない。`mean-inference#t` → `sampling-distributions#t`、小標本の場合のみ追加する`normal-distribution`、および分散からΣへの任意復習が前提マップと一致する。
- 数値例は平均、平方偏差和、不偏分散を独立した式で照合し、丸め桁、丸め方式、入力単位、許容誤差の併用（OR）、絶対・相対条件それぞれの独立した境界内外6ケース、十進値による`<=`判定を再計算する。
- 図のコード描画参照、教育目的、変数・単位、テキスト代替が記載され、生成画像を使っていない。
- PR前に`git diff --check`を実行する。文書のみのためアプリ実行テストは対象外。検証用の一時スクリプトを使う場合、リポジトリへ追加しない。

## 10. Issue #3 受入条件の対応

| 受入条件 | 本書の箇所 |
|---|---|
| 教材・問題項目の意味、必須性、型/制約、参照先 | §3、§4.1 |
| 公式項目とlessonの多対多、数学橋渡しlessonのsourceなし、参照ID整合、誤答から該当節へ | §2、§3.1、§4.1、§9 |
| 選択式の決定と、数値例の丸め・絶対/相対誤差・境界・単位・独立検算 | §4.1、§4.2、§4.4 |
| 問題定義/出題インスタンス/解答試行、同じ出題の再現と類題の区別 | §5、§8 |
| 学習ループ、多段の前提復習、復帰時に保持する状態、未知の数値誤答 | §4.5、§7、§8 |
| 6画面の役割・移動先、データ管理入口 | §7 |
| 3種類の前提、条件と節アンカー、節レベルリンク、コード描画と代替説明 | §3、§6、§9 |
| 必須/任意と固定ID/source IDを混同しない | §1、§2、§3、§6 |
| 全lesson/section/source/question IDの定義・照合と`git diff --check` | §2、§9 |

## 11. 未決定事項

- 数値計算のライブラリと精度管理。
- 初期例以外の問題形式、全カリキュラムの教材・問題、学習習熟度や復習間隔の判定。
- 公式資料にない教材内容の引用範囲や、公開ライセンスの詳細は既存の基本方針・今後のIssueで決める。
