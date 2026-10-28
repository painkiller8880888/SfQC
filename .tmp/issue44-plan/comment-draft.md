# Issue #44 実装計画

作成日: 2026-10-28  
対象: [P2.1-01: 旧P2実装計画・個別計画をlegacyへ整理し、P2.1正本を設定する](https://github.com/painkiller8880888/SfQC/issues/44)  
親・P2.1追跡元: [Issue #43](https://github.com/painkiller8880888/SfQC/issues/43)

## 目的と完了条件

P2（Issue #16〜#28）の完了後、当時の計画文書を歴史資料として保存し、P2.1の現行計画へ進む入口と優先順位を作る。旧計画の記録を書き換えず、実装済みの教材・保存契約にも触れない。

- 旧P2計画3件の本文を変更せず docs/legacy/p2/ に保存する。
- 旧パスへの到達性と保存した旧本文への案内を維持するスタブを残し、スタブとarchive indexから保存先が分かる。
- docs/legacy/README.md にP2の範囲、履歴資料の位置付け、2026-10-28の最終受入根拠、Issue/PRへの導線を記録する。
- docs/P2_1_IMPLEMENTATION_PLAN.md をP2.1の現行計画・リポジトリ内の入口とし、親Issue #43を進捗追跡元として明記する。子Issueごとの受入条件は各Issueを参照する。
- READMEとAGENTSから、現行計画とlegacyの優先順位が分かり、P2完了結果とP2.1予定が混同されない。
- 確認対象として列挙した内部リンクとIssue/PRの固定参照は、旧パス到達性・archiveへの案内・fragment/raw内容の互換性を分けて記録する。stubは旧パスの404回避とarchive案内を担うが、旧行/見出しアンカーやraw本文の互換性は保証しない。未知の外部リンクまで保証しない。
- 移設前後のバイト同一性、リンク監査、変更ファイル/契約差分、npm run check・npm run build の結果と環境を再現可能な形でPRに記録する。機能コード、教材データ、保存形式に差分がない。

## 調査で確認した現状

- Issue #28はclosed（completed）。2026-10-28の最終コメントは公開Pages受入をPASSとし、deploy run、artifactと公開assetのSHA-256一致、ブラウザー操作、320px/キーボード、reload、JSON import/exportの結果を記録している: [最終受入コメント](https://github.com/painkiller8880888/SfQC/issues/28#issuecomment-6459149373)。対応記録は[PR #42](https://github.com/painkiller8880888/SfQC/pull/42)。
- docs/P2_IMPLEMENTATION_PLAN.md のG5記録（81〜105行付近）はPR #42更新時点・2026-10-27のスナップショットで、公開QAを未確認としている。最終受入結果と食い違って見えるため、本文は変えず、legacy READMEから時点と現在の完了根拠を説明する。
- 移動対象は docs/P2_IMPLEMENTATION_PLAN.md、docs/ISSUE_19_IMPLEMENTATION_PLAN.md、docs/ISSUE_28_IMPLEMENTATION_PLAN.md。Issue #44は内容を現在形に書き換えず歴史スナップショットとして扱うよう指定している。
- README.md 7行目は「教材・演習機能はまだ実装・公開していません」と記載しており現状と合わない。
- scripts/lesson-curriculum.test.mjs 7〜8行目は docs/curriculum/PREREQUISITE_MAP_DRAFT.md と SYLLABUS_MAPPING_DRAFT.md を読み、テスト内で内容を照合する。これらは移動・内容変更しない。
- src/lesson-registry.mjs は実際に使う教材・lessonId・sectionId・前提関係を持つが、専用5分野分類フィールドはない。PREREQUISITE_MAP_DRAFT.md のlesson一覧（24〜59行）は教育上の「推奨段階」として0数学、1データ、2確率、3推定・検定、4 QC手法を記す。Issue #45は5分類を全34単元に付与し、重複/欠落を検査する方針だが、分類データの正本と表現（registry fieldかlessonId keyed mapか）は同Issueで決める。#44でregistryやcurriculumの分類データは変更しない。
- scripts/lesson-curriculum.test.mjs 74〜153行目はcurriculum文書から期待値を作り、registryのlesson ID・前提・section・条件付き経路・任意復習・公式項目対応等と比較する契約テストである。curriculumは単なる参考ではなく教育上の照合基準、registryはアプリが使う教材データの正本、テストは両者の整合保証という役割である。
- docs/MVP_DESIGN_DRAFT.md 9〜20行目は概念設計とID参照の背景を記す。docs/TECH_STACK_DECISION.md は保存形式・Pages base path・offline方針等の決定記録で、READMEや計画資料から参照される。docs/PROJECT_CHARTER_DRAFT.md は教育・製品方針を扱う。これらは無条件にlegacyへ移さない。
- PROJECT_CHARTER_DRAFT.md §6には初期進捗状態案、§9には暫定フェーズ案がある。教育方針は継続参照するが、P2.1の進捗と実行順はIssue #43と現行P2.1計画に従う。
- package.json のcheckは型検査とNodeテスト群、buildはcheck・production build・出力検査を行う。現時点で専用のMarkdownリンク検査コマンドはない。
- 関連するGitHub本文の固定パス参照を確認した。Issue #16/#19/#22/#23/#28/#43等やPR #42はP2計画・基準資料への参照を含む。本文自体は書き換えず、既知URLの形式・移設後の到達先・anchor/raw互換性は限定して監査し、旧パスstubからarchiveへ案内する。

## スコープと文書の優先順位

### 保存する旧P2資料

| 現在のパス | 保存先 |
|---|---|
| docs/P2_IMPLEMENTATION_PLAN.md | docs/legacy/p2/P2_IMPLEMENTATION_PLAN.md |
| docs/ISSUE_19_IMPLEMENTATION_PLAN.md | docs/legacy/p2/ISSUE_19_IMPLEMENTATION_PLAN.md |
| docs/ISSUE_28_IMPLEMENTATION_PLAN.md | docs/legacy/p2/ISSUE_28_IMPLEMENTATION_PLAN.md |

各ファイルは移動時に本文を変えない。元の各パスには案内スタブを置く。互換性は次の3点を分けて扱う。

1. **旧パス到達性:** 旧blob/main URLが案内スタブを表示して404にならないこと。
2. **旧本文への案内:** スタブから移設先文書とdocs/legacy/README.mdへ到達できること。
3. **内容互換性:** スタブは旧本文の行番号・見出しfragmentやraw.githubusercontent.comの原文内容を再現しない。これらは保証しない。既知の該当参照は移設先URLまたは移設前commitのpermalinkを補助導線として記録する。

既知の外部固定リンクの到達先と上記互換範囲を監査し、未知の外部リンクの不存在までは保証しない。スタブは旧計画そのものではないことを明記する。

### 維持する文書と契約

| 資料/仕組み | 今回の位置付け |
|---|---|
| `src/lesson-registry.mjs` | アプリが実際に使う教材・ID・前提関係の正本。P2.1の描画・教材ID・前提関係はregistryから導出する。#44では内容を変えない。 |
| `docs/curriculum/PREREQUISITE_MAP_DRAFT.md` | 教育上の必須・条件付き・任意の前提関係とその理由を照合する基準。 |
| `docs/curriculum/SYLLABUS_MAPPING_DRAFT.md` | QC検定公式項目と教材の対応を照合する基準。 |
| `scripts/lesson-curriculum.test.mjs` | curriculum資料から期待値を作りregistryとの一致を保証する契約テスト。テストだけを通すため教育根拠を無批判に変更しない。#44では資料のパス/内容とテストロジックを変更しない。 |
| 5分野分類（後続Issue #45） | 正本とデータ表現は未決定。#45でregistryへの分類field追加かlessonIdをキーとする単一分類定義かを決め、全34単元を重複/欠落なく割り当てて検査する。curriculumの「推奨段階」は教育上の根拠であり、分類の実装データと同一視しない。#44では決定・変更しない。 |
| Issue #43 | P2.1の確定方針と進捗追跡元。 |
| `docs/P2_1_IMPLEMENTATION_PLAN.md` | リポジトリ内のP2.1計画入口として実装順序・依存関係を示す。 |
| P2.1子Issue | 各作業の個別受入条件を定める。 |

教材や前提関係を将来変更する場合、アプリの正本であるregistryを更新し、変更内容に応じてcurriculum資料との教育上の整合も維持する。契約テストはその一致を検査する。#44では照合基準や検査ロジックを変更しない。

- docs/TECH_STACK_DECISION.md: 保存・Pages等の技術決定履歴として現パスに保持する。
- docs/PROJECT_CHARTER_DRAFT.md: 教育方針・製品境界を示す文書として現パスに保持する。§6の初期進捗状態案と§9の暫定フェーズ案はP2.1の実装契約・進捗順序ではなく、Issue #43と現行計画を優先する。
- docs/MVP_DESIGN_DRAFT.md: P1時点の概念設計として現パスに保持し、冒頭に短い位置付けを加える。教材データ・validatorの実装正本はソースコード、P2.1の描画・教材ID・前提関係はlesson registry、5分野分類の正本とデータ表現は#45で決めることを明示する。curriculum資料は教育上の照合基準として整合を維持し、項目仕様やIDの意味は書き換えない。

優先順位・入口はREADMEとAGENTSで共通に示す。

1. AGENTS.mdの運用ルールと、アプリ教材データのlesson registry正本を守る。教育上の前提・公式対応はcurriculum資料を照合基準とし、その整合を契約テストで維持する。
2. P2.1の確定方針・進捗はIssue #43、実装順序・依存関係とリポジトリ内入口はdocs/P2_1_IMPLEMENTATION_PLAN.md、個別受入条件は各子Issueを参照する。5分野分類のデータ正本・表現は#45の決定まで未確定とする。
3. PROJECT_CHARTER_DRAFT.mdの教育方針は引き続き参照する。§6/§9の初期状態・暫定フェーズ案がP2.1の進捗や順序と衝突する場合はIssue #43と現行P2.1計画を優先する。
4. docs/legacy/ および旧パスの案内スタブは過去の意思決定・検証記録であり、現在の実装指示として使わない。

## 実装手順

### 1. P2の3計画を履歴として移す

- 移設前に `git status --short -- docs/P2_IMPLEMENTATION_PLAN.md docs/ISSUE_19_IMPLEMENTATION_PLAN.md docs/ISSUE_28_IMPLEMENTATION_PLAN.md`、同じ3パスを引数にした `git diff --` と `git diff --cached --` を確認し、対象文書に未commit変更がないことを記録する。移設前HEADの `git rev-parse HEAD` をbaseline SHAとして固定する。
- git mv で上表の3ファイルを docs/legacy/p2/ に移す。PR検証対象のcandidate SHA（PR HEAD）を固定し、各移設元/保存先をそれぞれ `git rev-parse <baselineSHA>:<oldPath>` と `git rev-parse <candidateSHA>:<newPath>` でGit blob IDに解決する。一時Node.jsスクリプトは `child_process.execFileSync('git', ['cat-file', 'blob', blobId], { encoding: null })` で両blobをBufferとして読み、`Buffer.equals` でバイト単位に比較する。各ペアのbaseline/candidate SHA、旧/新path、blob ID、byte数、比較結果（必要ならSHA-256）を記録する。PowerShellのテキスト出力や作業ツリーの改行変換を比較経路に通さず、commit objectを使って第三者が再現できるようにする。PR前にindexを使って仮検査してよいが、受入記録はcommit SHAに固定する。
- 3つの元パスにはそれぞれ案内スタブを新設する。古いIssue/PR本文の移設元URLのパス到達性を保ち、スタブから対応するarchive文書とindexへ案内する。対象3文書に移設で壊れる相対Markdownリンクはない。移設先からのリンクは別に確認する。
- 他の旧資料は、用途・実参照・テスト参照を調べた上で扱う。今回は上記の分類に沿い、無関係なP0/P1資料の一括移動は行わない。

### 2. Archive indexに履歴と最終結果を記す

docs/legacy/README.md に以下をまとめる。

- P2の対象範囲: Issue #16〜#28、対応PR #30〜#42。P2完了はP2.1開始の前提である。
- 3つの移動資料は当時の計画/検証スナップショットであり、現行計画ではないこと。特にP2計画の2026-10-27時点のG5未確認記述は、その時点の記録として残す。
- 最終状態はIssue #28の完了と2026-10-28最終受入コメント、PR #42の公開QA記録を参照すること。受入コメントとPRへの直接リンクを置く。
- 各旧計画と、現行の docs/P2_1_IMPLEMENTATION_PLAN.md・親Issue #43へのリンク。
- 既知のIssue/PR固定リンクについて、旧URLと参照形式、移設後の到達先、path/fragment/rawの判定、互換性の限界を記録する。anchor/rawの具体的な代替リンクが必要な項目は、archive pathか移設前commitのpermalinkを示す。未知の外部リンクの不存在までは保証しない。
- P2で未収録の範囲・P3へ送った事項は受入記録に従い、P2の完成度をQC検定2級全範囲の保証と表現しない。

### 3. P2.1の現行計画を作る

docs/P2_1_IMPLEMENTATION_PLAN.md を新設し、P2.1を「学習マップをトップページ兼手動進捗管理画面として独立実装するフェーズ」と要約する。親Issue #43を進捗追跡元としてリンクし、以下の順序・依存をまとめる。

| 順序 | Issue | 作業 | 依存 |
|---:|---:|---|---|
| 01 | #44 | P2資料のlegacy整理・計画入口 | なし |
| 02 | #45 | グラフ契約と5分野分類の正本/データ表現を決定 | #44 |
| 03 | #46 | React Flow + Dagreの描画PoC | #45 |
| 04 | #47 | マップをトップページに統合 | #46 |
| 05 | #48 | 単元詳細カード | #47 |
| 06 | #49 | 手動進捗と自己点検 | #48 |
| 07 | #50 | 独立保存領域とバックアップ | #49 |
| 08 | #51 | ノード配置編集 | #47, #50 |
| 09 | #52 | 共通必須前提のハイライト | #45, #47 |
| 10 | #53 | 5分野の色と作者用編集UI | #45, #47 |
| 11 | #54 | Solarizedと操作テーマ | #47, #53 |
| 12 | #55 | 演習・詳細進捗の統合 | #48, #49 |
| 13 | #56 | モバイル・アクセシビリティ | #48, #51, #54 |
| 14 | #57 | 統合E2E・公開QA・正式切替 | #44〜#56 |

表はIssue #43の実行チェック順と依存関係を示す。#47の後は、依存が満たされた #48・#52・#53 を並行して進められる。#51は#47と#50の両方を待ち、#54は#53、#55は#48と#49、#56は#48・#51・#54の完了を待つ。#57は#44〜#56のマージと受入証拠を前提とする。

また、親Issueの確定境界を短く転記・リンクする: registryをlesson dataと34単元/64共通必須edgeの正本とし、共通必須・条件付き・任意復習を区別する。5分野分類の正本とデータ表現は#45で決定する。registry fieldかlessonId keyed mapかを先取りせず、34単元すべてに重複/欠落なく割り当て、検査する。curriculumの推奨段階は教育根拠であり分類の実装データと同一視しない。手動進捗は未開始→学習中→完了、Reopenで学習中へ遷移し、解説閲覧や正答率から自動完了しない。未完了・Reopenでも教材や演習にアクセスでき、前提によるロックは設けない。既存sfqc:local-data schema v2を保ち、手動マップ状態は別のversioned領域に保存する。利用者は配置のみ編集し教材構造は編集しない。既存hash routeと学習/復習導線を保ち、コード描画・ライブラリの適切なライセンス確認・クラウド保存なしとする。詳細仕様は#43および各子Issueを参照し、古いP2計画からP2.1要件を推測しない。

### 4. 現行の入口と状態説明を整える

- README.md 7行目の古い未実装表記と、35行目の公開先が「予定」である記述を現況に合わせ、P2で平均・分散・標準偏差の解説/演習/誤答復習/進捗保存まで公開済みであることと、P2.1で学習マップを拡張予定であることを分けて示す。37行目の初回Pages設定手順は初回公開時の管理者向け手順と分かる位置付けにし、公開済みの現況と矛盾させない。legacy indexとP2.1計画へのリンクも加える。
- READMEまたはAGENTSに、PROJECT_CHARTER_DRAFT.mdの教育方針は引き続き参照する一方、§6の初期進捗状態案と§9の暫定フェーズ案はP2.1では現行方針ではなく、Issue #43とdocs/P2_1_IMPLEMENTATION_PLAN.mdが優先する旨を短く明記する。憲章原文は大幅改変しない。
- AGENTS.mdの「Read first」に現行計画、legacy index、文書の優先順位を追加する。旧P2資料を現在のタスク指示と解釈しないことを明記する。
- 現行Markdown内の移設元を指す参照は必要に応じて移設先へ更新し、既知の外部参照にある移設元pathは案内スタブへ到達するようにする。保存した旧文書の本文は変えず、移設先からのリンクは独立に確認する。
- GitHub Issue/PR本文中の固定リンクは編集しない。3旧pathへのリンクは各案内スタブまで到達するようにし、行/見出しanchorやraw URLの互換まで保証する表現は避ける。

### 5. リンク・バイト同一性・契約差分を再現可能に検査する

- 移設前のbase SHAは `git rev-parse HEAD`、比較対象はPR HEADのcandidate SHAに固定する。本文不変は手順1のGit blob IDペアとBuffer比較で検証する。使用した一時スクリプトのソース全文、実行コマンドとbase/candidate SHAの引数、各blob ID・byte数・比較結果（必要ならSHA-256）、実行環境をPR本文のdetails等へ記録する。一時スクリプトをリポジトリへ恒久追加せず、ローカル `.tmp` の結果だけに依存しない。
- ローカル参照の母集団を `README.md`、`AGENTS.md`、`docs/`、`src/`、`scripts/`、`.github/` に限定し、生成物や一時ファイルを除外してrgで抽出する。例: `rg -n --hidden -g '*.md' -g '*.mjs' -g '*.ts' -g '*.tsx' -g '!.git/**' -g '!.tmp/**' -g '!node_modules/**' -g '!dist/**' '(P2_IMPLEMENTATION_PLAN|ISSUE_19_IMPLEMENTATION_PLAN|ISSUE_28_IMPLEMENTATION_PLAN|P2_1_IMPLEMENTATION_PLAN|docs/legacy)' README.md AGENTS.md docs src scripts .github`。出力した参照一覧と、Markdown相対リンク・文書パス・テスト/コード参照について参照元path:line、参照文字列、解決先、結果を列挙する一時処理のソース全文、実行コマンド、結果をPR本文のdetails等に残す。相対Markdownリンクは参照元ディレクトリ基準で解決し、anchorはpath到達性と分けて記録する。README/AGENTSからlegacy index・P2.1計画、旧パス3件・新パス3件、コード/テスト参照の解決結果を示す。
- GitHub connectorでIssue #16/#19/#22/#23/#28/#43/#44/#45、関連コメントとPR #42の既知参照を確認する。旧URL、参照形式（blob path / #L81-L105等の行fragment / 見出しfragment / raw.githubusercontent.com）、移設後の到達先、パス到達性、archive誘導、fragment/rawの判定・制限を表で記録する。PR段階ではcandidate commitのtree上にある新旧path、スタブからarchiveへの導線、リンク解決先を検証する。マージ前にmain上の旧URLが原文を返す状態をstubのPASSとしない。mainの旧URL到達とスタブ→archive導線はマージ後に確認し、受入記録を完成させる。line/heading fragmentやraw URLは旧本文と同じ動作を保証せず、確認できていないリンクをPASS扱いしない。見つかった具体的参照はarchive URLまたは移設前commit permalinkを案内し、外部Issue/PR本文を一括編集しない。未知の外部リンクの不存在までは保証しない。
- Issue/PR参照表の列は「発生元URL | 旧URL/参照形式 | 移設後の到達先 | path/anchor/raw判定 | 補助案内・制限」とする。監査する発生元はIssue #16/#19/#22/#23/#28/#43/#44/#45とPR #42の本文・関連コメントで、blob path、`#L81-L105`等の行fragment、見出しfragment、`raw.githubusercontent.com`形式を識別する。参照一覧、監査表、判定結果は実行環境とともにPR本文のdetails等に残す。GitHub本文とコメントは変更しない。
- curriculum mapは既存テストが期待値として読み、registryとの一致を検査するため、パス・内容・scripts/lesson-curriculum.test.mjsのロジックが変わっていないことを確認する。将来教材/前提を変える場合は教育根拠を判断し、registryとcurriculum間の必要な整合を保つ。#44ではどちらも変更しない。
- package.jsonのcheck/buildだけではMarkdownリンクを検証しない。新規の恒久script・依存は追加せず、上記の一時処理と既知参照表でリンク監査を行う。
- npm run check、npm run build、git diff --checkを実行し、Node/npm/OSと実行結果をPRに記録する。PR証拠には基準commit SHA、旧/新3パスのSHA-256またはGit blob ID、Buffer比較結果、旧/新パス3件とREADME/AGENTS導線のリンク結果、コード/テスト参照の解決結果、既知Issue/PRリンク監査表、変更ファイル一覧、機能コード/教材データ/保存契約に差分なしの確認を含める。README、AGENTS、docs、src/scripts/.githubの参照解決はファイルごとに結果を残し、npmコマンドはPASS/FAIL・終了コード・実行環境を記す。
- 1 Issue = 1 PRで進め、PR本文には Refs #44 を記す。検証・PRレビュー・マージ後にIssue #44を手動closeする。後続Issueの実装は#44のマージ後に開始する。

## リスクと扱い

- docs/P2_IMPLEMENTATION_PLAN.md の未完了表示を最新状態に合わせて書き換えると、当時の記録を改変する。ファイルをそのまま保存し、legacy READMEからIssue #28の最終PASS記録へ誘導する。
- 元のファイルを削除すると、既知のblob path URLが404になる。全3 pathに案内スタブを残して移設先へ導く。行/見出しanchorやraw URLは同じ原文を保証しない。
- stubで保証するのは旧path到達とarchiveへの案内であり、旧行番号/見出しanchorやraw本文の互換ではない。既知の固定リンクを形式ごとに記録し、具体的な行fragment等はarchive URLまたは移設前commit permalinkを案内する。未知の外部リンクの不存在は保証しない。
- Markdownリンク検査はnpm run check/buildに含まれない。リンク検査結果は一時スクリプト・参照一覧・既知Issue/PR監査表を使って別に記録し、check/buildの成功をリンク監査の代用にしない。
- curriculum文書は教育上の照合基準であり、lesson-curriculum.test.mjsはそこから得た期待値とregistryを比較する。パス・ID・前提関係・教育上の根拠を保ち、検査を通すためだけの一方的な変更を避ける。
- P2の受入記録はPR merge時と最終公開QAで記録場所が異なる。P2計画の時点付きスナップショットとIssue #28/PR #42の最終QAを混同しない。
- Issue #43の詳細は今後更新され得る。P2.1計画の概要・Issue順を親Issueと同期し、子Issueの受入詳細を重複して別管理しない。

## 今回の対象外

React Flow導入やUI変更、P2の再試験、教材/問題/前提/保存契約の改訂、PWA・クラウド機能、別フェーズ文書の一括移動、リンク検査依存の追加。

## 参照

- [Issue #44](https://github.com/painkiller8880888/SfQC/issues/44)
- [P2.1 Master / Issue #43](https://github.com/painkiller8880888/SfQC/issues/43)
- [P2完了Issue #28](https://github.com/painkiller8880888/SfQC/issues/28)
- [Issue #28 最終公開受入コメント](https://github.com/painkiller8880888/SfQC/issues/28#issuecomment-6459149373)
- [P2統合受入PR #42](https://github.com/painkiller8880888/SfQC/pull/42)

## レビュー記録

2026-10-28: plan_reviewerによる計画レビューを1回実施し、その後ユーザー提示の独立レビュー指摘4件と検証提案を反映した改訂。追加のplan_reviewerレビューは行っていない。これは計画コメントであり、文書移設・実装・npm run check・npm run buildは未実施。
