# Issue #28 実装計画（レビュー1回・指摘反映済み）

更新日: 2026-10-27  
対象: [P2-13: 縦断MVPのE2E受入・GitHub Pages公開確認を完了する](https://github.com/painkiller8880888/SfQC/issues/28)

計画レビュー担当は1回のみ起動済みで、追加起動はしていない。既存の計画レビュー指摘と後続のIssueコメントからの指摘を反映した実装前の計画である。コード変更、テスト実行、公開サイトの受入確認はまだ行っていない。

## 目的と完了条件

P2の各部品が個別に動くことだけでなく、初回導線から誤答後の復習、同じ出題への再回答、進捗、JSONバックアップまでをひと続きで検証する。統合試験は現在の画面・データ契約に限定し、試験できていない範囲や実行環境をPASSと扱わない。

完了条件は次の全てとする。

- 実ブラウザーで `https://painkiller8880888.github.io/SfQC/` から学習ループを通り、表示・採点・復習先・復帰・進捗の情報が保存記録と一致する。
- 同一`instanceId`の再開・再回答で既存snapshotとattemptを保ち、新しい生成問題は別`instanceId`と異なるseedを持つことが自動検査と画面確認で識別できる。
- CIの `npm ci` と `npm run build` が成功する。既存の計算・契約・リンク・保存互換・破損データ検査と、追加する統合経路検査も成功する。
- `main`へのmerge後、対象commitのPages deployと公開URLのasset対応を証拠付きで確認し、直接表示、hash付きURL再読込、主要操作を実ブラウザーで実測する。
- `docs/P2_IMPLEMENTATION_PLAN.md`にはPR merge時点の検証状態を時点付きで記し、Issue #28の受入チェックリストと最終結果を更新する。PRにはrun/asset等の根拠を記録し、文書・Issue・PRの参照から一続きに辿れる。
- 検査環境、検証できなかった範囲、既存の仕様限界、未収録の試験範囲、P3へ渡す習熟度・復習スケジューラを明記する。

## 調査時点の前提

- Issue #28はopen。本計画更新時点でコメントは3件あり、#6435612804が計画コメント、#6435798835が計画レビュー、#6436077865がartifact内のパスに関する追加指摘である。今回も計画コメント#6435612804だけを編集し、新規コメントは作らない。
- 依存Issue #16〜#27は全てclosed。対応PR #30〜#41は全てmainへmerged。PR #41はhead `ee7eb631f9f41bbd09f185866efa63681550fa08`、merge commit `9e15c10a15e9e5614ddceab7fad3093433cb031b`。
- 初稿調査時のcheckoutは`codex/issue-27-progress-dashboard`、HEAD `ee7eb631f9f41bbd09f185866efa63681550fa08`で、取得済みローカル`main`/`origin/main`はPR #40時点の`dc63eaa`だった。この作業時点の記録を現在のGitHub `main`とみなさず、実装開始時にremoteの最新SHAを再取得する。
- `docs/P2_IMPLEMENTATION_PLAN.md`はP2の目的、範囲、PR依存順、仕様上の残課題、P3境界を管理する正本である。一方、#28の最終受入状態はIssue #28のチェック項目・最終結果に記録し、対応PRには実測の証拠を記録する。P2文書のG5記載には「PR merge時点」の時点を付け、Issue/PRへリンクする。
- Issue #28は「1 Issue = 1 PR」で、#16〜#27を統合する。PR #41では#27についてbuild、320px、Tab、reload、JSON書出し/読込みなどを確認済み。レビュー時のdeploy run #40460802818は#27のmerge commitに対する確認であり、#28対応PRのデプロイ・公開QAの根拠には使わない。

| Issue | merged PR |
|---|---|
| [#16](https://github.com/painkiller8880888/SfQC/issues/16) | [#30](https://github.com/painkiller8880888/SfQC/pull/30) |
| [#17](https://github.com/painkiller8880888/SfQC/issues/17) | [#31](https://github.com/painkiller8880888/SfQC/pull/31) |
| [#18](https://github.com/painkiller8880888/SfQC/issues/18) | [#32](https://github.com/painkiller8880888/SfQC/pull/32) |
| [#19](https://github.com/painkiller8880888/SfQC/issues/19) | [#33](https://github.com/painkiller8880888/SfQC/pull/33) |
| [#20](https://github.com/painkiller8880888/SfQC/issues/20) | [#34](https://github.com/painkiller8880888/SfQC/pull/34) |
| [#21](https://github.com/painkiller8880888/SfQC/issues/21) | [#35](https://github.com/painkiller8880888/SfQC/pull/35) |
| [#22](https://github.com/painkiller8880888/SfQC/issues/22) | [#36](https://github.com/painkiller8880888/SfQC/pull/36) |
| [#23](https://github.com/painkiller8880888/SfQC/issues/23) | [#37](https://github.com/painkiller8880888/SfQC/pull/37) |
| [#24](https://github.com/painkiller8880888/SfQC/issues/24) | [#38](https://github.com/painkiller8880888/SfQC/pull/38) |
| [#25](https://github.com/painkiller8880888/SfQC/issues/25) | [#39](https://github.com/painkiller8880888/SfQC/pull/39) |
| [#26](https://github.com/painkiller8880888/SfQC/issues/26) | [#40](https://github.com/painkiller8880888/SfQC/pull/40) |
| [#27](https://github.com/painkiller8880888/SfQC/issues/27) | [#41](https://github.com/painkiller8880888/SfQC/pull/41) |

## 対象範囲・対象外

### 対象

- 回帰する主要ループ: map → `descriptive-statistics`の解説・SVG → 固定問題 → 誤答feedback → `variance`節 → `math-algebra-sigma#sigma` → その前提の復習 → 元のfeedback・同一instanceへ復帰 → 再回答 → progress → JSON export/import → reload。
- 既存の別seed類題生成、snapshot固定、v1→v2移行、保存失敗時の破損raw保持、復元拒否、教材参照整合の自動回帰。
- CIとproduction buildの検査、公開後のGitHub Pages手動確認、結果・未確認事項の記録。
- `docs/P2_IMPLEMENTATION_PLAN.md`へ、G5の検証対象・merge時点の状態・Issue/対応PRへの参照・仕様上の残課題・P3引継ぎを追記。merge後の最終チェック結果はIssue #28と対応PRに記録する。

### 対象外

- 新しい教材・問題、全QC検定2級範囲、問題バンクの拡大、学習履歴schemaの変更、progress集計ルールの変更。
- PWA/Service Worker、offline reload保証、サーバー保存、アカウントや学習者追跡、生成画像、依存の追加。
- 根拠のない習熟度・合格確率の推定や、新しい復習間隔アルゴリズム。
- 各Issueが既に通した単体テストの重複実装。失敗が見つかったときだけ、原因を所有する機能の最小修正を行う。

## 検証基盤の選択

CIでの画面操作連携には、既存`jsdom`とVite middlewareを使う`createHarness()`（`scripts/practice-app.test.mjs`）を使う。すでにReact Appを実際にmountし、hash route、`localStorage`、Back/Forward、再mountを検査できる。Playwright/Cypress/Puppeteerは未導入で、単一の静的MVPのためにブラウザー配布物や別のpreview serverをCIへ追加する必要性はIssue範囲からは確認できないため、新規依存・新規サーバーは設けない。

jsdomはCSS layout、実際の画面倍率、スクリーンリーダー、ブラウザーのファイルダウンロード/選択を再現しない。これらはIssue本文どおり、production buildを用いた実ブラウザー確認に分け、操作結果をPRへ記録する。データ形式のexport/import・互換性・保存は既存のNodeテストで自動検査する。

## 実装手順

### 1. 依存のmerge状態と自動検査基準を固定する

**対象資料:** `docs/P2_IMPLEMENTATION_PLAN.md`、PR #30〜#41、`.github/workflows/pages.yml`。

1. PR #41のmain merge commit以降の`main`をcheckoutし、statusを確認する。古いIssue #27作業ブランチで新しいPRを開始しない。
2. CIの現在の契約を確認する。`.github/workflows/pages.yml`はPRでNode.js 22、`npm ci`、`npm run build`を実行し、mainへのpushでartifact作成とPages deployを行う。新しいworkflow jobは追加しない。
3. 既存テストが網羅する条件を確認し、同じ条件の重複テストを足さない。既存の`package.json` `check`はNode test群を実行し、`build`はcheck、Vite production build、`scripts/check-build.mjs`を実行する。

**完了条件:** #16〜#27がmainに統合済みであることをPR/commitで確認し、実装対象がIssue #28に限定される。

### 2. 画面・保存を横断する一つの自動journeyを補う

**対象:** `scripts/practice-app.test.mjs`。既存`createHarness()`・DOM操作helperを再利用し、別のブラウザーframeworkや独自テストアプリを作らない。

新しいApp-level testでは以下の結合点を検査する。

1. 学習マップから収録済みの`descriptive-statistics`を開き、`variance`節、`FIG-DESC-VAR-001`のSVGと通常HTMLの説明を表示する。教材や図の数値そのものは既存の`lesson-contract.test.mjs`・`variance-deviation-bars.test.mjs`による独立検算を再利用する。
2. 固定数値問題`q-desc-var-num-001`を開始し、`1.030`を回答して保存済みsnapshotを根拠に誤答feedbackを表示する。feedbackから`variance`、Σのリンク、`math-powers-roots`、さらにその前提`math-arithmetic`へ進み、review eventのtarget/sourceが保存されることを確認する。リンクの戻りとブラウザーBack/Forwardを通し、stackをたどって元のfeedbackへ帰る。
3. feedbackから同じpractice instanceを開き直し、フォームに元の入力文字列`1.030`が復元することを確認してから`1.013`に変更して再回答する（この問題の正答は`src/question-registry.mjs`で`1.013`）。`instanceId`とsnapshotは不変、以前の誤答attemptは残り、新しい正答だけ別attemptとして追加される。progressで回答2回、正答1回・誤答1回、正答割合1/2を照合する。過去誤答由来の復習候補は履歴に基づき残り得るが、正答後に候補が消えることも残ることも合格条件にせず、習熟済みとは自動判定しない。
4. 最後に`exportLocalData`でv2 JSONをexportした後、元のApp harnessをunmount/closeし、空の新しいjsdom harnessを用意する。test専用の新しいlocalStorageが`missing`であることを確認してから`importLocalData`へJSONを読み込ませ、戻り値が`imported`であること、`questionInstances`・`answerAttempts`・`reviewEvents`の配列内容とIDがexport前と一致することを検査する。新しいAppを`#/progress`でremountし、件数・復習候補・progress表示もexport前と一致することを確認する。ユーザーデータや別の保存領域は消去しない。

生成問題のseed差は、既存の別テスト`generated practice creates a separate seed and records the numeric input exactly`をCIに含めて受け入れる。統合journeyへseed用branchを混ぜず、同一instanceの復帰確認と独立させる。統合journeyの再読込・JSON roundtripで失敗が起きた場合に限り、原因箇所の既存fixture/testを最小追加する。

**完了条件:** 各画面操作の前後でroute、instanceId、attemptId、snapshot、review event、localStorage、progressを照合し、ユーザーが見た記録と導出値のずれを検知できる。再開時の`1.030`復元と`1.013`正答が同じinstanceの別attemptとして保存され、正答/誤答両方のprogress集計に反映される。新しいテストを`practice-app.test.mjs`内に追加するため、既存`package.json`の`check`登録は変更不要。

### 3. 既存ロジックとデータ境界の全回帰をCIで確認する

**対象:** 既存テスト群と`package.json`、`.github/workflows/pages.yml`。現在の契約に変更は加えない。

- 独立計算、question/lesson契約、図座標、教材前提・参照: `scripts/question-registry.test.mjs`、`question-grading.test.mjs`、`lesson-contract.test.mjs`、`lesson-curriculum.test.mjs`、`variance-deviation-bars.test.mjs`。
- route、直接ID解決、review stack、未知参照: `resolve-screen.test.mjs`、`route-data.test.mjs`、`route-history.test.mjs`、`route-view.test.mjs`、`practice-app.test.mjs`。
- schema v1非空データのv2移行、snapshot/attempt/reviewEventのJSON roundtrip、破損/未対応version拒否、置換確認キャンセル、書込み失敗時の元raw保護: `scripts/local-data.test.mjs`。
- 履歴からのprogress導出、訪問と誤答先の参照分離、同時刻順、保存/reload/export/importで集計一致: `scripts/progress-data.test.mjs`。
- clean environment相当の`npm ci`後に`npm run build`を実行し、CI上で型検査、`node --test`群、Vite build、base path・出力検査が成功することを記録する。

Issue #28に入っている独立計算・リンク・保存互換・破損復元拒否の範囲は上記既存suiteを使う。統合journey以外に網羅性のためだけの追加fixtureやブラウザー依存を作らない。

**完了条件:** PR CIが全greenで、該当する公開されたchecksが対象head commitに結び付いている。

### 4. P2正本にmerge時点と最終記録先を記す

**対象:** `docs/P2_IMPLEMENTATION_PLAN.md`、Issue #28、対応PR。

1. PR merge前に既存のG5表・13 PR依存順を保ち、G5の受入対象、自動検査、仕様上の残課題、P3引継ぎを追記する。未収録/保留範囲として信頼性工学SRC-0056〜0059、計測SRC-0060〜0061、測定誤差SRC-0064等を記し、根拠のない習熟度評価・合格確率を導入しない。PWA、クラウド保存、全試験範囲の完成はP2に含めない。
2. G5の記載を「PR merge時点では公開QA未実施」と明示して時点を固定する。この文書はmerge時点のスナップショットとして残し、最終的なPASS/FAIL/未検証と根拠はIssue #28の受入チェックリスト・最終結果、および対応PRの最終報告に記録する、と説明する。Issue #28と対応PRへのリンクを記載し、P2範囲/依存順を管理する文書と最終QA記録の役割を混同しない。
3. PR作成後・merge前に計画文書へ当該PRをリンクし、PR本文では`Refs #28`を使う。`Closes #28`等の自動close表現は使わない。merge前に実測できない公開QAをPASSにせず、未完了項目として残す。

**完了条件:** merge前にP2正本へG5の検査対象、merge時点で公開QA未実施であること、Issue/対応PRへの参照、残課題、P3境界が記録される。Issue #28はmergeだけでは閉じず、最終結果をIssueと対応PRから追える構成になっている。

### 5. production previewと公開Pagesを実ブラウザーで確認し、最終結果を記録する

**対象:** production build、公開URL `https://painkiller8880888.github.io/SfQC/`、GitHub Actions Pages artifact、Issue #28、対応PR。

1. PR merge前に`npm run build`後のproduction previewを開き、主要シナリオを予備確認する。これは公開Pagesの受入結果には数えない。
2. merge後、PRのmerge commit SHAを取得する。QA開始時点の`main`先端SHA `M`を読み、merge commitが`M`の祖先であることをGitHub compareまたは`git merge-base --is-ancestor <merge-sha> <M>`で確認する。`.github/workflows/pages.yml`の`CI and GitHub Pages` workflowについて、eventがmainへのpush、`head_sha == M`、buildとdeployの両jobが成功した最新runを選ぶ。該当runがなければ待機し、別SHAの古い成功runでPASSにしない。
3. 選んだrunに紐づく`github-pages` artifactを特定し、run ID/URL、`head_sha`、artifact ID・digest・取得期限を記録して、期限内に成果物を取得する。ダウンロードしたZIPから`artifact.tar`を取り出し、tarを展開する。`actions/upload-pages-artifact@v5`は`.github/workflows/pages.yml`の`path: dist`に指定されたディレクトリの中身をtarのルートへ格納するため、展開後の通常ファイルは`./index.html`、`./assets/...`等であり、`dist/`階層はない。tarのディレクトリエントリを除く全通常ファイルを列挙し、先頭の`./`を除いた相対pathを公開URL `https://painkiller8880888.github.io/SfQC/<相対path>`に対応付ける（例: `index.html`は`/SfQC/index.html`、`assets/foo.js`は`/SfQC/assets/foo.js`）。`/SfQC/`も開いてindexと同じ内容が公開されることを確認する。各tarファイルのSHA-256と、対応する公開HTTP応答body（HTTPクライアントが圧縮を展開した内容）のSHA-256を比較し、status 200、Content-Type、`/SfQC/`配下のpathを記録する。HTML/JS/CSSの参照構文解析は行わず、artifact digestはアーカイブの識別情報として記録するが各ファイルのSHA-256比較に代用しない。workflowが同一runで`dist`をartifact化してdeployするため、新しいversion endpointや依存追加は設けない。artifactが期限切れ等で照合できない場合は版の対応をPASSとせず、同じSHAの成功runから比較可能なartifactが得られるまで保留する。
4. 成功runと公開アセットの対応を確認後、公開URL入口と`#/lesson/descriptive-statistics/variance`等を直接開き、refresh後もlesson/sectionが表示されることを確認する。公開サイト上で固定問題の誤答→feedback→分散節→Σ→数学前提の入れ子復習を実操作する。復習前のsectionと非0の読書位置を記録し、各「1段戻る」で復帰先section・表示位置が順に戻ること、元のfeedbackへ戻ることを確認する。同一practice instanceを開き直した際、入力文字列`1.030`が復元することを確認した後、`1.013`に変更して送信し、正答feedbackとprogress上の正誤両履歴を確認する。ID不変/新規attempt IDは自動journeyの責務とする。別seed類題も開始し、seed/instanceの差とprogress・reload後の表示を照合する。過去誤答に基づく復習候補が残ることもあるが、その消失/残存を合否条件や習熟判定にしない。
5. 320 CSS px幅で横overflow、切れ、重なり、操作不能がないことを確認する。本文・図の意味/単位がSVGだけに依存せず読めること、入力ラベル、見出し、リンク、figure説明、Tab/Shift+Tab、Enter、戻る・進む、フォーカス可視性、progress詳細のキーボード操作を確認する。必要なら200% browser zoomも確認し、未実施なら未確認と記録する。
6. ネット切断試験ではロード後の画面で可能なクライアント処理とoffline reload/初回訪問を分ける。`docs/TECH_STACK_DECISION.md`どおりService Worker/PWA保証はなく、offline reload失敗を不合格にも保証済みにもしない。
7. 公開UIの「JSONを書き出す」で得た実ファイルを、localStorageが空の別の一時ブラウザープロファイルへimportする。import直後とreload後に3配列の件数、progressと復習候補を照合する。自動journeyではexport後に元harnessをunmountし、別の空のjsdom保存先で`missing`を確認してからimportし、戻り値`imported`、3配列の内容/ID、progressをexport前と比較する。既存ユーザーデータを消去・置換しない。
8. QA終了時に`main`先端SHAと最新成功main runを再確認する。QA中に`main`が進みrunが切り替わった場合、旧版で得た結果はそのSHAに対する履歴として区別し、現在公開版のPASSには流用しない。新SHAの成功deploy artifactと公開assetを再照合し、主要ブラウザーjourneyを再確認する。結果記録にPR head SHA、merge SHA、QA開始/終了時のmain SHA、workflow run ID/URL/`head_sha`とbuild/deploy結果、artifact ID/digest、公開HTML/asset URL・status・hash、ブラウザー/OS/version、viewport/zoom、確認時刻、主要結果、console/network error、未確認事項を含める。
9. 実測後にIssue #28の受入チェックリストと最終結果（PASS/FAIL/未検証、根拠リンク）を更新し、同じ対応PRの本文または最終コメントにも上記の版・QA証拠を記録する。追加PRは作らず、Issue本文の受入条件を緩めない。公開QAで未確認/失敗が残る場合はIssueをopenのままにし、PASS条件を満たした後にだけ手動で完了する。

**完了条件:** QA対象merge commitがQA開始/終了時点のmainに含まれ、最新成功main runのhead SHAとそのartifactの公開HTML/asset hashesが一致する。公開Pagesの主要シナリオを実ブラウザーで確認し、結果・未確認事項・根拠をIssue #28と対応PRから追跡できる。merge時点のP2正本は当時の公開QA未実施状態を明記したスナップショットとして残り、最終状態との食い違いを生まない。自動CI/previewだけでは公開QA完了と扱わず、Issue #28は閉じない。

## 受入条件との対応

| Issue #28の条件 | 実施する確認 |
|---|---|
| 学習ループを実ブラウザーで完走し、画面間の情報が一貫 | 統合`practice-app` testと公開Pages実操作。復習前後のsection/読書位置、feedback、attempt/snapshot/reviewEvent/progressを照合 |
| 同一instance再回答と別seed類題を識別 | App testで入力`1.030`の復元後に`1.013`を正答送信し、同じinstance/snapshot・新attempt ID・正誤各1回を確認。既存生成問題testで別seedを確認 |
| CIのinstall/build/ロジック・リンク・統合回帰 | `npm ci`、`npm run build`、既存suiteと横断journeyをPR CIで実行 |
| main deploy・公開Pagesの直接表示/reload/asset/主要操作 | main先端SHAを含む最新成功runのartifactと公開HTML/asset SHA-256を照合後、実ブラウザーで確認。PR head/merge SHA、main/run/artifact、URL/hashesをIssueとPRに記録 |
| 未検証/環境依存/未収録/P3とPASSの区別 | merge前の`docs/P2_IMPLEMENTATION_PLAN.md`に「merge時点で公開QA未実施」・Issue/PR参照・残課題・P3引継ぎを記録。QA後はIssue checklist/最終結果と同PR最終報告を更新 |

## リスクと判断

- jsdomは描画寸法・読み上げ・browser downloadを検証できないため、それらを自動テストでPASSにせず、公開後の実ブラウザーQAに残す。
- merge後でないとmain deploy結果は得られない。Issueを自動closeするPRキーワードを避け、公開QA後にIssueのチェック項目・最終結果と同PRの証拠を更新する。mainがQA中に進んだりartifactが期限切れになった場合は旧runを現在版の証拠にせず、対象run/artifactで照合をやり直す。
- 公開ブラウザーで学習操作をするとlocalStorageに履歴が作られる。必ず一時プロファイルを使い、実利用者データは使わない。
- 公開Pagesのデプロイ、ブラウザー、ネットワーク、ローカル時刻に依存する観測は実行条件を記録する。ネット切断の再読込や初回表示を保証しない。
- 自動試験が既存の独立テストを重複させると維持コストが増えるため、新規追加は画面横断の統合journeyに限定する。

## 参照した資料

- [Issue #28](https://github.com/painkiller8880888/SfQC/issues/28)、上表の依存Issue #16〜#27とmerged PR #30〜#41
- `AGENTS.md`、`.codex/config.toml`、`docs/P2_IMPLEMENTATION_PLAN.md`、`docs/MVP_DESIGN_DRAFT.md` §5・§7〜9、`docs/TECH_STACK_DECISION.md`のschema v2・Pages base path・offline方針、`docs/curriculum/PREREQUISITE_MAP_DRAFT.md`
- `package.json`、`.github/workflows/pages.yml`、[`actions/upload-pages-artifact@v5/action.yml`](https://github.com/actions/upload-pages-artifact/blob/v5/action.yml)、`src/App.tsx`、`src/local-data.mjs`、`src/lesson-view.tsx`、`src/lesson-registry.mjs`、`src/progress-data.mjs`
- `scripts/practice-app.test.mjs`、`scripts/local-data.test.mjs`、`scripts/progress-data.test.mjs`、`scripts/lesson-contract.test.mjs`、`scripts/lesson-curriculum.test.mjs`、`scripts/variance-deviation-bars.test.mjs`、route/question contract各テスト
