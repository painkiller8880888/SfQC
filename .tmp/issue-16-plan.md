## 計画レビューと追加指摘の反映

以前の計画レビューは1回実施済みです。今回の追加指摘を計画本文へ反映しましたが、この追加指摘への対応についてレビューは実施していません。以下ではIssue #16の作業と、発行済みP2 Issue #16〜#28の機能別受入ゲートを区別します。

## 目的と境界

MVP設計の教材項目と前提マップを、型付きの教材registryと実行時validatorへ落とし込み、収録教材の節・図・出典参照と前提グラフをCIで検査できるようにします。同時に、平均・分散・標準偏差の縦断MVPに必要な後続作業、依存関係、受入ゲートを docs/P2_IMPLEMENTATION_PLAN.md に記録します。Issue #16ではこの計画文書を新設し、発行済みIssue #16〜#28、とくにIssue #28のP2全体計画・13PR分割・実行順序を取り込みます。以後の依存関係管理の正本はこの文書とし、Issue #28との一致を保ちます。

Issue #16では教材本文、問題データ、画面表示、教材route、採点・生成、学習履歴や保存形式の変更は行いません。plannedな単元には既存文書から転記したメタデータと宣言済みsectionIdだけを置き、架空の本文、figure、学習者が移動できる教材リンクを作りません。新しい依存、外部通信、生成画像も追加しません。

## 現状

- 教材registry・lesson validatorはなく、現在の実行時契約は src/question-contract.mjs と src/question-contract.d.mts の問題契約です。
- question契約の isLessonRef は lessonId#sectionId の形式を検査しますが、現行registryへの解決は行いません。QuestionInstanceのsnapshotは保存時点の独立コピーで、restore時に現行QuestionDefinitionを要求しません。
- scripts/question-contract.fixture.mjs は descriptive-statistics#variance と descriptive-statistics#mean を使っています。前提マップの固定anchor一覧にあるのは descriptive-statistics#variance と math-algebra-sigma#sigma で、#meanは記載漏れ、標準偏差のanchorも未定義です。meanを正式化し、standard-deviationを新規追加します。deviationはIssue #16で先取りせず、Issue #18実装時に前提マップへ正式宣言してregistryへ反映してからincluded化する手順を将来のP2計画文書に記録します。
- 前提マップは34 lessonを定義し、Issue #1のPR記録はsourceItemId 64件、共通必須64辺、条件付きlesson間辺28件、任意復習を除くグラフ85辺で循環なしと報告しています。
- package.json の check はTypeScriptとNode標準test runnerを実行し、buildはcheckの後にVite buildと生成物検査を行います。.github/workflows/pages.yml もnpm run buildを実行します。新テストをcheckへ登録すれば既存CIで実行でき、workflow変更は不要です。
- docs/P2_IMPLEMENTATION_PLAN.md は未作成です。Issue #1・#3・#8・#9は完了済みです。

## Issue #16で行う実装

### 1. 契約とregistry

planned/includedを判別できるLessonDefinitionを定義します。両方がlessonId、学習目標、宣言sectionId、共通必須前提、条件付き前提、任意復習、questionIds、sourceItemIds、sourceRefs、revisionを持ちます。plannedはsection本文やfigure、本文リンクを持たず、includedは実際のSectionDefinitionとFigureDefinitionを持ちます。includedのsection一覧は宣言section一覧と一致させます。

plannedのdeclaredSectionIdsは前提マップに明記されたIDだけを転記します。IDが既知であることと、教材が収録済みであることを別に扱います。plannedのsection参照は計画メタデータ内で解決できますが、本文リンク先としては使えません。included本文のlessonRefだけが、included lessonの実在sectionへ解決できます。

最低限の型は次のとおりです。

- LessonDefinitionはplanned/includedの両方で、lessonId、空でないtitle、学習目標、declaredSectionIds、共通必須前提、条件付き前提、任意復習、questionIds、sourceItemIds、sourceRefs、revisionを持ちます。includedには1件以上のSectionDefinitionを必須とし、各節には1件以上の実本文blockを必須とします。sectionsはdeclaredSectionIdsと完全一致させます。
- SectionDefinition: sectionId、見出し、本文blocks。
- 本文blockはparagraph、formula、lessonRef（表示ラベルと参照先）、figureRef（figureId）の判別可能な4種です。LessonRefは既存の `lessonId#sectionId` に節なしの `lessonId` を加えた文字列です。InlineLessonRefは `{ label, targetRef: LessonRef }`、ParagraphPartは `{ kind: "text", text } | { kind: "lessonRef", label, targetRef }`、FormulaPartは `{ kind: "mathText", text } | { kind: "mathSymbol", symbol, lessonRef?: InlineLessonRef }` とします。paragraph/formulaは順序付きpartsで表し、各partの0始まり配列位置が参照元位置なので、式文字列の部分一致検索はしません。mathSymbolの表示記号は維持し、参照labelはリンクの表示・アクセシビリティ用ラベルとして保持します。任意HTML・Markdown parser・任意コードは許可しません。
- 具体例: 分散式を `s² = 1/(n−1) `、参照付きmathSymbol `Σ`、`ᵢ₌₁ⁿ (xᵢ−x̄)²` の3つのformula partに分け、中央partのlessonRefを `{ label: "総和記号の読み方", targetRef: "math-algebra-sigma#sigma" }` とします。参照元はparts[1]、表示式は連結したままで、対象節は既存LessonRef形式へ解決できます。
- 実本文は、空白以外の通常テキストpartを含むparagraph、または空白でないmathText/mathSymbolを含むformulaです。空・空白だけのparagraph/formula、standalone lessonRef、figureRef、inline lessonRef tokenやラベルだけの節は実本文に数えません。これにより節をリンクや図参照だけで満たせません。
- FigureDefinition: figureId、`code:名前` 形式のrendererRef、教育目的、変数と単位、軸・尺度・凡例、文章による代替説明。Issue #16はrendererRefの形式とfigureRefから定義への解決までを検査し、その名前に対応する描画コードの存在は検査しません。描画コンポーネントの解決とキーボード対応は図を作る後続Issueで検証します。
- SourceDefinition: 一つの出典文書全体ではなく、特定のlocationとpurposeを持つ引用記録です。sourceId、title、url、version、checkedAt、location、purpose、coversSourceItemIdsを同じ記録に持たせます。場所や利用目的が異なる引用は別sourceIdです。公式sourceItemIdとは別のID空間にします。
- Registry: curriculumRevision、34件のplanned/included lesson、既知の公式sourceItemId一覧、SourceDefinition一覧。

共通前提はlessonIdまたはlessonId#sectionIdで表します。条件付き前提は、安定したconditionId、適用対象のmethodSectionRef、利用者にも分かるcondition、prerequisiteRefを持つ独立した要素として保持します。conditionIdはlessonIdと同じ小文字英数字・ハイフン形式で、registry全体で一意とし、同じ学習条件の説明文を直すときは維持し、意味を変えるときは別IDにします。任意復習は、起点fromRef、復習先targetRef、提示場面contextを持ちます。これら3区分を統合したり、条件を落としたりしません。

条件付き前提のデータ例:
- `conditionId: "mean-inference-z-normal-model"`、適用節 `mean-inference#z`、前提先 `normal-distribution`、条件「母標準偏差既知かつ正規母集団を仮定するz法を選ぶ場合」。
- `conditionId: "mean-inference-t-sampling-distribution"`、適用節 `mean-inference#t`、前提先 `sampling-distributions#t`、条件「母標準偏差未知のt法を選ぶ場合」。
- `conditionId: "mean-inference-t-small-sample-normality"`、適用節 `mean-inference#t`、前提先 `normal-distribution`、条件「t法を小標本で使い、母集団の正規性を仮定する場合」。同じt法でも上のt分布条件とは別ID・別要素です。

### 2. 出典とIDの整合性

公式scope IDはSYLLABUS_MAPPING_DRAFT.mdにあるsourceItemId一覧から解決し、各lessonのsourceItemIdsは前提マップの割当と一致させます。sourceItemIdを持つlessonはsourceRefsを空にできません。各sourceItemIdは当該lessonのsourceRefsの少なくとも一つでカバーされ、各sourceRefも当該lessonのsourceItemIdsと少なくとも一つ一致することを検証します。これにより、根拠のない公式項目と無関係な資料参照の両方を拒否します。複数lessonから同じsourceItemIdや同一引用記録を参照することは許可します。

sourceItemIdsが空の数学橋渡しlessonは公式出典を装いません。該当lessonが補助資料を持つ場合に限り、coversSourceItemIdsが空の引用記録を参照できます。公式項目の対応・引用情報はSYLLABUS_MAPPING_DRAFT.mdを根拠にregistryへ記録し、どちらかが変わる場合は同じPRで両方を照合します。資料URLへアクセスする処理やMarkdown parserは追加しません。

revisionとcurriculumRevisionは正の安全整数とし、教材改訂とregistry構造の版を分けます。自動migration、保存データの書換え、QuestionInstance snapshotの改訂は行いません。

### 3. 前提・section・question参照の検証範囲

LessonRefは、既存表現と同じ文字列形式で単元全体ならlessonId、特定節ならlessonId#sectionIdとします。参照先lessonはplanned/includedを問わずregistry内に解決し、節指定がある参照はtarget lessonのdeclaredSectionIdsに照合します。included lessonはtitleが空でなく、1件以上のsectionsを持ち、各節に空白でない実本文block（通常テキストを含むparagraphまたは数式tokenを含むformula）が必要です。sectionsとdeclaredSectionIdsは完全一致させます。条件付き前提のmethodSectionRefが定義済みであること、conditionIdがregistry全体で一意であること、conditionが空でないこと、任意復習のfromRefが記載元lesson内にありtargetRefが定義済みであることも検証します。

- planned/includedのどちらも空または空白だけのtitleは拒否します。includedのsectionsが空、個別sectionの本文が空/空白、本文がstandalone lessonRefやfigureRefのみ、またはinline参照labelだけの節も拒否します。declaredSectionIdsとsectionsが両方空のincludedも拒否します。
- 欠けたmethodSectionRef、異なるlessonの適用節、planned lessonの未宣言section、任意復習の起点違い・未宣言section、形式不正または重複conditionIdは拒否します。conditionIdの意味を後から変えず、意味変更は新IDとして扱います。
- paragraph/formula内のlessonRefはparts配列内のtokenに置き、配列の0始まり位置を参照元とします。labelとtargetRef（lessonIdまたはlessonId#sectionId）が必須です。validatorはparts構造を検証し、文字列内の部分一致で位置を推測しません。将来UIはparts順と数式tokenを保って元の段落・式の位置から移動し、formulaでは記号自体を表示しつつlabelをリンクの表示/アクセシビリティラベルとして扱います。
- 本文lessonRefはplanned targetへ解決しません。節指定ならincluded targetの実在SectionDefinition、節なしならincluded targetのLessonDefinition全体に解決します。前提/計画メタデータ参照はplanned lesson全体または宣言済み節にも解決できます。
- figureRefは同じincluded lesson内のfigure定義に解決します。Issue #16の検証範囲はfigureRef→FigureDefinitionとrendererRefが`code:名前`形式であることまでで、名前の実在する描画コードへの解決はしません。figureId、sourceId、lessonId、lesson内sectionIdの重複は拒否します。別lessonで同じsectionIdを使うこと、複数lessonから同じsourceを参照することは許可します。
- 共通・条件付き前提の合併グラフだけ循環を拒否します。任意復習は循環検査から除外します。
- Issue #16ではMVPのquestionIdsフィールドを残し、型・validatorとも空配列だけを許可します。問題の本番registryがまだなく、問題ID参照を解決できないためです。非空questionIdsはコンパイル時型と実行時validatorの両方で拒否します。
- 現在のQuestionDefinitionはテストfixtureのみです。後続の問題registry導入Issueで、lessonのquestionIds、question.lessonRefs、固定問題feedbackRules、生成定義feedbackRulesTemplateをすべてincluded sectionへ照合します。既存QuestionInstanceのsnapshot構造検証とrestoreは現状のまま保ち、現行教材一覧に依存させません。

不明key、undefined、空テキスト、非有限数、不正ID、重複IDを拒否します。validatorは副作用なく既存question-contractと同じ真偽値パターンに合わせます。

### 4. 変更対象と順序

1. docs/P2_IMPLEMENTATION_PLAN.md を追加し、Issue #16のDoDとIssue #17〜#28の受入範囲・依存関係を分けて記録します。発行済みIssue #16〜#28、とくにIssue #28のP2全体計画・13PR分割・推奨実行順序を取り込み、以後の依存関係管理の正本としてIssue #28との一致を保ちます。
2. docs/curriculum/PREREQUISITE_MAP_DRAFT.md に descriptive-statistics#mean と descriptive-statistics#standard-deviation を追加し、既存の descriptive-statistics#variance と math-algebra-sigma#sigma は維持します。deviationはIssue #16で追加しません。将来のP2計画文書に、Issue #18の独立した記述統計教材を実装する際、前提マップへ descriptive-statistics#deviation を正式宣言し、registryへ反映してからincluded化する手順を記録します。plannedレジストリの宣言IDと照合します。
3. src/lesson-contract.d.mts と src/lesson-contract.mjs に型とvalidatorを追加します。
4. src/lesson-registry.mjs に34 lessonのplannedメタデータ、宣言済みsection IDs、前提、公式ID、引用レコードを登録します。既存文書から転記し、架空教材は含めません。
5. scripts/lesson-contract.fixture.mjs と scripts/lesson-contract.test.mjs を追加します。テストはfixtureに加えて実際のsrc/lesson-registry.mjsをimportし、validateLessonRegistry(registry) が通ることを必須にします。
6. tsconfig.node.json のincludeにsrc/lesson-registry.mjsとscripts/lesson-contract.fixture.mjsを追加し、両方のJSDoc型注釈をTypeScriptで検査します。テスト側のassertReadonly等、必要な型検査も既存のnode設定で確認できる形にします。
7. package.json のcheckにlesson-contract.test.mjsを登録します。pages workflowは変更せず、既存のnpm run buildからcheckと新テストを実行します。
8. 実装PRでnpm run check、npm run build、git diff --checkを実行し、前提マップとregistryのlessonId、declaredSectionIds、条件付き/任意の区分、sourceItemId・引用カバレッジを静的に照合します。UI変更はないためブラウザ確認はしません。

必須変更: docs/P2_IMPLEMENTATION_PLAN.md（新規）、docs/MVP_DESIGN_DRAFT.md（inline参照の表・説明を最小更新）、docs/curriculum/PREREQUISITE_MAP_DRAFT.md、src/lesson-contract.mjs（新規）、src/lesson-contract.d.mts（新規）、src/lesson-registry.mjs（新規）、scripts/lesson-contract.fixture.mjs（新規）、scripts/lesson-contract.test.mjs（新規）、tsconfig.node.json、package.json。

docs/MVP_DESIGN_DRAFT.mdは今回定めるinline参照のtoken位置、節なしLessonRef、数式記号と参照labelの扱いに合わせ、関連する§3/§6の表・説明だけ実装PRで最小更新します。src/question-contract.*は既存APIとsnapshot/restorationの挙動を変えません。新しい依存、画面、route、採点・生成機能、保存形式変更は対象外です。

### 5. Issue #16のテストとDoD

Node標準node:testを使い、npm run checkとnpm run build経由でCI実行します。

- 正常系: 空でないtitleとparagraph/formula本文を持つ最小included fixture、planned fixture、実registryが通る。既存のvarianceとsigma参照、追加するmeanとstandard-deviationの宣言IDを確認する。
- planned/included: plannedが本文・figure・本文リンクを持たない。宣言済みplanned sectionはメタデータ参照先としてのみ受理し、未宣言anchorとplanned targetへの本文リンクは拒否する。両状態の空/空白title、includedの空sections、sectionの空/空白本文、参照blockだけのsectionを拒否する。
- 本文内参照: 段落tokenとformula partの順序・位置、label、targetRefを確認する。分散式のΣをformula parts[1]のmathSymbolとして保持し、表示式を連結したまま `math-algebra-sigma#sigma` へ解決するfixtureを通す。不存在lesson、未宣言section、planned target、空label、不正partsを拒否する。単元全体参照 `data-types` と既存の `math-algebra-sigma#sigma` の両方を正常系で確認する。
- 条件付き前提: t法を選ぶ条件と、小標本t法で正規性を仮定する条件が異なるconditionId、condition、前提先として保持されることを確認する。z法、t分布、小標本正規性の具体例を通す。conditionIdの欠落・形式不正・registry全体での重複、条件文欠落、適用節欠落・誤記を拒否する。
- 図renderer: Issue #16ではrendererRefの `code:名前` 形式とfigureRef→FigureDefinitionの解決を検証し、描画コードの実在性は検査しないことを明記する。実在コンポーネントへの名前解決と未定義rendererの拒否テストはG1（#17〜#19）の受入で検査する。
- 任意復習: fromRef、targetRef、contextを保持し、間違った起点lesson、未宣言の起点/復習先section、欠落contextを拒否する。任意復習だけの循環は許す。
- 前提DAG: 共通必須だけの循環、条件付きだけの循環、各区分単独では循環しないが合併時に循環するケース、自己参照を拒否する。section指定の前提もlesson単位の辺へ正規化して検査する。任意復習を加えた場合だけ循環するケースは許可する。
- 他の参照と重複: 欠落lesson/section/figure/source/sourceItemId、同一スコープでの重複IDを個別に拒否する。同名sectionを別lessonで使うケースとsourceの多対多参照は許可する。
- source coverage: sourceItemIdsを持つlessonのsourceRefs空を拒否する。未カバーofficial sourceItemId、lessonと無関係なsourceRef、ID重複を拒否する。sourceItemIdsが空の橋渡しlessonがofficial IDを装うケースも拒否する。
- questionIds: 空配列は通し、非空配列を型・validator双方で拒否する。
- revisionと形: revision/curriculumRevisionの0、負数、小数、安全整数外、未知key、undefined、不正block kind、空の代替説明等を拒否する。
- 互換性: 既存question contractのcreate/validate/restoreとQuestionInstance JSON fixtureを既存テストで確認し、現行registryがsnapshot復元を妨げない。
- PR完了基準: npm run check、npm run build、git diff --checkが成功し、全34 lesson・宣言section・前提区分・source coverageを2つのcurriculum文書と照合して結果をPRに記録する。公式資料の本文や問題を転載しない。

## P2受入ゲート（Issue #16のDoDには含めない）

Issue #16のDoDに含めるのは、教材registry契約・validator・CIとP2計画文書の追加です。Issue #17〜#28は発行済みであり、それぞれの作業範囲と依存関係は各Issue本文およびIssue #28のP2全体計画に記録済みです。以下のG0〜G5は機能別の受入範囲を示すラベルで、G0からG5への完了順序や実行段階を表しません。実行順序と依存関係は、Issue #28に記録された13PR分割に従います。

| ゲート | 発行済みIssue | 機能別の受入範囲 |
|---|---|---|
| G0 教材契約 | #16 | LessonDefinition等の契約、registry、参照・DAG・出典整合性検証、CI、後続P2計画文書。 |
| G1 基礎・記述統計教材 | #17・#18・#19 | #17のdata-types、math-arithmetic、math-ratios-percentages、math-powers-roots、math-algebra-sigma#sigmaの5単元、#18の平均・偏差・分散・標準偏差の記述統計教材とΣからの任意復習リンク、#19のコード描画図。教材節と図の本文・出典・リンク・renderer解決を受け入れる。 |
| G2 問題・採点 | #20・#21 | 固定／再現可能な生成問題、snapshot、単一選択・数値採点、誤答feedback判定。 |
| G3 学習導線・復習復帰 | #23・#24・#25・#26 | ID付きURLと状態保持、多段復習からの復帰、教材表示、出題・回答、feedbackと同一出題への復帰。 |
| G4 学習記録・進捗 | #22・#27 | 解答試行・復習イベントのschema v2保存と既存v1互換、履歴に基づく進捗表示。#22は#23の保存済みinstance参照の前提です。 |
| G5 統合受入 | #28 | #16〜#27の成果を13PR全体計画に沿って統合し、公開Pagesで縦断学習シナリオを受け入れる。 |

### Issue #28記載の13PR分割

| PR単位 | Issue | 依存・狙い |
|---|---|---|
| 01 教材データ契約 | #16 | 他の教材／参照機能の前提。P2計画文書を追加 |
| 02 数学・データ型の復習教材 | #17 | #16 → 共通前提の読める教材と多段復習先 |
| 03 中心となる統計教材 | #18 | #16, #17 → 平均・分散・標準偏差の独立検算済み説明 |
| 04 コード描画図 | #19 | #18 → 偏差と分散のSVG、単位・アクセシビリティ |
| 05 固定・生成問題 | #20 | #18 → seed再現性、別問題、出題snapshot |
| 06 採点・feedback判定 | #21 | #8の既存契約から並行開始可 |
| 07 解答／復習履歴の保存 | #22 | #9のv1から拡張。#21の判定型との整合を確認 |
| 08 ID付きURL・多段復習stack | #23 | #16, #22 → 元の出題・入力・位置の保持 |
| 09 学習マップ・解説UI | #24 | #17, #18, #19, #23 |
| 10 出題・解答フォームUI | #25 | #20, #21, #22, #23 |
| 11 feedbackと復習往復 | #26 | #24, #25で学習ループを接続 |
| 12 進捗画面 | #27 | #22, #26で観測記録を可視化 |
| 13 E2E受入・公開QA | #28（本Issue） | #16〜#27を統合検査しP2完了可否を判断 |

P1の作業用handoff整理は#15に分離され、P2のブロッカーではありません。

### Issue #28記載の推奨実行順・並行可能な作業

1. 契約を固定する: #16。
2. #17（数学・データ型教材）と#21（採点）を並行する。#21の型が固まれば#22（履歴保存）を開始する。
3. #17→#18の順で教材を進める。#16および#22を前提に#23（URL・多段復帰）を進める。
4. #18後に#19（図）と#20（問題）を並行する。#19と#23後に#24、#20・#21・#22・#23後に#25を進める。
5. #24と#25の後に#26、続いて#27を進める。
6. #16〜#27完了後に#28で統合受入する。

この順序では#22の保存が#23の依存になり、#17の教材が#18の依存になります。ゲートの分類はこれらの依存関係を置き換えません。P2の範囲はこの平均・分散・標準偏差の縦断スライスであり、全34 lessonの完成を要求しません。

## 実装時の注意・リスク

- meanは既存テストfixtureにあるがanchor文書にはないため、strict validation前に正式化が必要です。standard-deviationは提案IDで、前提マップに新規宣言します。既存varianceは維持し、deviationは#16で追加せず、#18実装時に前提マップへ正式宣言してregistryへ反映後にincluded化する手順をdocs/P2_IMPLEMENTATION_PLAN.mdへ記録します。
- registryとcurriculum文書は同じID/前提を持ちます。どちらかが変更される際は同じPRで両方を照合し、独自Markdown parserは追加しません。
- 条件付き前提の適用節・条件・到達節、任意復習の起点・先・場面を別々に保持し、前提マップの意味を平坦化しません。
- sourceIdを文書全体IDではなくlocation/purpose付き引用記録IDにすることで、公式sourceItemIdごとに根拠を検査できます。
- plannedとincludedは「IDが既知」と「教材が利用可能」を区別します。plannedは本文リンクになりません。
- 過去QuestionInstanceは当時のsnapshotで復元し、現行lesson registryへの依存を追加しません。

Issue #16に含むのは上記のregistry契約・テスト・CI・P2計画文書までです。後続の教材本文、問題、複数段復習、学習履歴は別Issueに残します。
