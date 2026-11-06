# Issue #75: 基本統計量の現行版ベースライン

確認日: 2026-11-06（JST）<br>
作業ブランチ: `codex/issue75-baseline`<br>
基準SHA: [`e4c2e50301c226caaecc4b9708dbd15f8809df9e`](https://github.com/painkiller8880888/SfQC/commit/e4c2e50301c226caaecc4b9708dbd15f8809df9e)（当時の `main`、作業開始時clean）
目的: 後続Issueで同じ学習課題を比較できるよう、教材・演習・図・出典・実際の画面遷移を保存する。ここにある仮説は評価結果ではない。

## 1. 対象と基準

Issue #75 が指定する `descriptive-statistics` の4節、現行5問、図 `FIG-DESC-VAR-001`、参照先、学習マップと演習の画面に限定する。教材本文、問題定義、図、ルート、保存形式や保存済みデータの変更は対象外。教材・問題の正本はそれぞれ [`src/lesson-registry.mjs`](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/lesson-registry.mjs#L338-L426) と [`src/question-registry.mjs`](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/question-registry.mjs#L1-L134) であり、本書は表示と操作の履歴スナップショットである。

基準 `main` SHA と同じ `e4c2e50301c226caaecc4b9708dbd15f8809df9e` が、ローカルproduction previewと確認できたGitHub Pagesの成功deploy run（[run 42129306620](https://github.com/painkiller8880888/SfQC/actions/runs/42129306620)）の対象SHAだった。従って今回のキャプチャには基準SHAのローカルbuildを使った。キャプチャ用ブラウザーには一時profileを使い、既存の利用者profileとその `sfqc:local-data` / `sfqc:map-state:v1` / テーマ設定は開いていない。ブラウザー内で作られた出題・誤答・復習記録は一時profileのみに保存し、撮影後にprofileを破棄する。

ソース位置は基準SHAへのGitHub permalinkで示す。画面操作・ルートの既存実装は [`src/lesson-view.tsx`](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/lesson-view.tsx)、[`src/practice-view.tsx`](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/practice-view.tsx)、[`src/App.tsx`](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/App.tsx)、[`src/route-history.mjs`](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/route-history.mjs) にある。#43の手動進捗と演習記録の分離、および #74 のモック隔離契約を維持する（[`docs/MVP_DESIGN_DRAFT.md#mock-contract-snapshot`](MVP_DESIGN_DRAFT.md#mock-contract-snapshot)）。

### キャプチャ環境

| 項目 | 記録 |
|---|---|
| 実行対象 | `http://127.0.0.1:4173/SfQC/`。基準SHAで `npm run build` 後に起動したローカルpreview |
| ブラウザー | Headless Chrome 157.0.8103.39（Windows 10/11 x64 user-agent） |
| 拡大率・device scale factor | 100%、1 |
| CSS viewport | desktop 1280×900 px、mobile/narrow 320×800 px |
| 適用テーマ | dark（キャプチャ中の `document.documentElement.dataset.theme`） |
| 撮影日 | 2026-11-06 |
| 画像範囲 | 記載するPNGの実寸。教材・一覧・問題・feedbackは全ページ、mapはviewport全体に加えて内部スクロールカードの連続区間も撮影 |

desktopの全ページPNGは、縦スクロールバーがあるページで文書幅1265px、map/viewport画面では1280pxになった。viewport設定は全て1280×900pxである。mobileの全ページ画像は横幅320pxのまま縦方向に伸びる。mapカードの内部スクロール画像はviewport寸法の画像であり、全ページ画像と重ねて読む。

## 2. 4節の現行内容

lesson revisionは4。節IDの宣言順は `mean` → `deviation` → `variance` → `standard-deviation`。同じ測定値1.000、2.200、3.000 mmを平均・偏差・分散・標準偏差へ引き継ぐ構成がある。

以下の「理解上の障害」は現行文章と数式の配置から立てた仮説であり、利用者が実際につまずいたという観察結果ではない。改善仮説は[#77](https://github.com/painkiller8880888/SfQC/issues/77)の「事例→観察→説明→用語・数式」の比較で確かめる候補として記録する。

| 節 | 対象となる現行表現・式 | 想定される理解上の障害（未検証） | 改善仮説（#77比較用） | 後続での確認方法 |
|---|---|---|---|---|
| `mean`（平均） | **原文**：「平均は量的データの中心を1つの数で要約します。母集団は調べたい対象全体、標本は実際に観測した一部です。」（[registry L363](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/lesson-registry.mjs#L363)）<br>**式**：母平均 `μ = (Σ_{i=1}^{N} xᵢ)/N`、標本平均 `x̄ = (Σ_{i=1}^{n} xᵢ)/n`（[L365](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/lesson-registry.mjs#L365)）。<br>**例**：1.000、2.200、3.000 mmから約2.067 mmを計算（[L367](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/lesson-registry.mjs#L367)）。 | 最初の段落で「中心」の説明と母集団/標本、`μ`/`x̄`、`N`/`n`が同時に現れる。算術平均の適用条件やΣの読みを経てから数値例に着くため、具体的な問いより先に区別する語・記号が重なる可能性がある。目的や測定値を示す前に説明語が続くことで、導入が硬く感じられる可能性もある（いずれも未検証）。 | 測定値から知りたいことを問い、値を使って中心を計算した後に「平均」と母集団/標本の名前・記号を結び付ける順序を比較する。適用条件とΣの説明は必要な箇所で扱い、削除する前提にはしない。 | #77で採用した同じ事例について、計算前に何を知りたいかを言葉にし、計算後に平均・単位・`μ/N`または`x̄/n`の対応を追える箇所を記録する。用語・記号が事例より先に必要となる箇所、硬く感じると指摘された表現、質問を記録し、結果は利用者評価を行った場合に限り報告する。 |
| `deviation`（偏差） | **原文**：「偏差は、各値が対応する平均からどれだけ離れているかを符号付きで表した差です。」（[registry L374](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/lesson-registry.mjs#L374)）<br>**式**：`xᵢ−μ`、`xᵢ−x̄`（[L375](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/lesson-registry.mjs#L375)）。<br>**例**：同じ3値の偏差 `−16/15, 2/15, 14/15 mm` と、和が0となる説明（[L376](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/lesson-registry.mjs#L376)）。 | 定義の段落で符号・単位に続き、同じ量/単位/観測対象という条件も説明した後に式と数値例が出る。条件が具体例より前にまとまるため、平均との差を実際の値に当てはめる前に読む事項が多い可能性がある。 | 平均と3値を先に見て、値が平均より上か下かを観察してから、正負の差に「偏差」という名前と式を与える順序を比べる。偏差の和が0になる例と説明は保つ。 | #77の共通事例で3つの値の上/下と差をたどり、符号を決める根拠と偏差の和が0でも散らばりを測れない理由を確認する。どの段落・記号の前後で符号や単位の質問が出たかを、現行と比較版それぞれに記録する。 |
| `variance`（範囲と分散） | **原文**：「範囲は最大値と最小値の差です。分散は偏差を二乗して散らばりを表します。母集団全体を記述する母分散は偏差平方和を N で割り、観測した標本そのものを記述する分散は偏差平方和を n で割った平均です。母分散を推定する不偏分散は、標本の偏差平方和を n−1 で割った推定量です。」（[registry L383](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/lesson-registry.mjs#L383)）。<br>**式**：母分散、標本内を記述する分散、不偏分散、範囲を1ブロックに列挙（[L384](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/lesson-registry.mjs#L384)）。<br>**例**：後段で同じ3値を全件/標本内記述/母分散推定の各目的に対応させ、`0.676`と`1.013 mm²`を示す（[L393](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/lesson-registry.mjs#L393)）。 | 範囲、偏差の二乗、母集団全体の記述、観測標本の記述、母分散の推定が同じ導入段落に続き、次の式も4つの量/式をまとめる。目的別の例は後段にあるため、初学者が`N`/`n`/`n−1`を計算目的より先に並べて覚えるものと捉えたり、どの分母を選ぶか混同したりする可能性がある。定義と分母の説明が続くことで文章が硬く感じられる可能性も含め、いずれも未検証の仮説として扱う。 | 分散が必要になる問いと同じ観測値を先に示し、「全数を記述」「観測標本内を記述」「母分散を推定」の目的を分けてから、必要な分母・名称・式を順に結ぶ構成を比較する。3つの定義・条件は残し、目的に応じて段階的に導入する。 | #77で用いる統一事例に、3つの目的を明示した問いを対応させる。各問いで選ばれる`N`/`n`/`n−1`、単位、誤答理由が説明のどこで示されるかを現行と比較版で記録し、式や図を見た時点で用途を区別できるかを確かめる。定義・分母の文章で硬く感じる表現や質問が実際に示された場合は、その位置を記録する。理解の改善は利用者評価なしに結論づけない。 |
| `standard-deviation`（標準偏差） | **原文**：「標準偏差は分散の平方根で、平均との差による散らばりを元の測定単位で表します。」（[registry L402](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/lesson-registry.mjs#L402)）。<br>**式**：母標準偏差 `σ = √σ²`、不偏分散から計算する標本標準偏差 `s = √s²`（[L403](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/lesson-registry.mjs#L403)）。<br>**例**：定義・式の後に`√(152/225)≈0.822 mm`、`√(76/75)≈1.007 mm`を示す（[L404](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/lesson-registry.mjs#L404)）。 | 平方根による定義と`σ`/`s`の式が例より先に続く。初学者が分散の単位`mm²`から標準偏差の`mm`へ戻る操作や、2つの値が異なる理由を具体例より先に処理する可能性がある。 | 先に前節の分散値と単位を見て、平方根を取ると数値と単位がどう変わるかを示してから、「標準偏差」と記号・式を結ぶ順序を比較する。「大半が1標準偏差以内」とは分布条件なしで結論できない注意は保つ。 | #77の共通事例で、各分散値から標準偏差と単位を追い、`0.822`と`1.007 mm`がどの記述/推定目的に対応するかを記録する。値の違い、単位、分布条件について質問や誤読がどの段階で生じたかを版ごとに照合する。利用者の理解が改善したとは、実際に評価しない限り記載しない。 |

この表は原文に紐づけて比較課題を追跡するための記録である。現行表現の良否、どの仮説が正しいか、利用者が実際に理解したかは、比較/利用者評価を行っていない段階では未検証のままにする。

## 3. 既存の問題、図、出典

### 既存5問

| 問題ID / revision | 節・形式・難易度 | 保存済み定義で扱う値と答え | 現行の誤答feedback / 機能上の注意 |
|---|---|---|---|
| `q-desc-var-sc-001` / 1 | 分散 / 選択 / 基礎 | 分散の単位。正答 `mm²`。 | `mm`は偏差の単位、`mm⁻¹`にする操作はないと個別説明する。 |
| `q-desc-var-num-001` / 2 | 分散 / 数値 / 標準 | 1.000、2.200、3.000 mmの不偏分散は `1.013 mm²`。 | `0.676`は偏差平方和をn=3で割る標本内の分散で、設問の不偏推定量はn−1=2で割ると説明する。 |
| `q-desc-mean-sc-001` / 1 | 平均 / 選択 / 基礎 | 2、4、6 mmの算術平均は `4 mm`。 | 合計の`12 mm`と、n−1=2で割った値を平均と取り違える選択肢に個別説明がある。 |
| `q-desc-sd-sc-001` / 1 | 標準偏差 / 選択 / 基礎 | 分散4 mm²の標準偏差は `2 mm`。 | 分散値のままの回答と、平方根後もmm²とする回答に単位を説明する。 |
| `q-desc-var-gen-num-001` / 1 | 分散 / seed生成数値 / 標準 | `generationRuleVersion: 1`、整数`d ∈ [1,9]`。母集団全体 `(10−d), 10, (10+d) mm` の分散`2d²/3`を小数3桁へ丸める。 | `d²`は偏差平方和をn−1=2で割った値であり、母分散はN=3で割ると説明する。問題開始ごとに異なるseedを保存する。 |

5問のlesson参照とrevisionは基準SHAの[問題定義](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/question-registry.mjs#L1-L134)で確認できる。偏差節を直接参照する問題はこの一覧にない。問題選択一覧は単元横断である。ここでのID・正答・feedbackは履歴の追跡用であり、採点方式は変更しない。

### 図 `FIG-DESC-VAR-001`

`src/lesson-registry.mjs` のcartesian figure参照は `code:variance-deviation-bars` を使う（[figure metadata](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/lesson-registry.mjs#L412-L425)）。静的SVGに3つの観測値、平均31/15 mmの破線、観測点から平均への符号付き偏差を表示する。凡例とalt textは「平均」「偏差」「観測値」を説明する。関連実装は [`src/figures/variance-deviation-bars.tsx`](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/figures/variance-deviation-bars.tsx) と [`src/figures/variance-deviation-bars-data.mjs`](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/figures/variance-deviation-bars-data.mjs)。本ベースラインでは生成画像を使わない。

### 出典と参照先

| 出典 | 教材registryの登録内容 | 今回の確認 |
|---|---|---|
| `SRC-0005` | JSA「3級のレベル表」Ver.20150130.2 p.1、「4級のレベル表」同版p.1「平均とばらつき」「平均と範囲」（登録確認日2026-10-21）。詳細は[`src/lesson-registry.mjs`](https://github.com/painkiller8880888/SfQC/blob/e4c2e50301c226caaecc4b9708dbd15f8809df9e/src/lesson-registry.mjs#L1-L60)と4節終端の出典記述。 | 2026-11-06に登録済みの[JSA 3級PDF](https://webdesk.jsa.or.jp/pdf/qc/md_4609.pdf)と[JSA 4級PDF](https://webdesk.jsa.or.jp/pdf/qc/md_4610.pdf)を開こうとしたが、JSA Webdeskのメンテナンス案内が表示され本文を再確認できなかった。教材registryに保存された以前の確認記録を保ち、今回直接確認できたとは扱わない。 |
| OpenStax | *Introductory Statistics 2e*, §2.7 “Measures of the Spread of the Data”（登録確認日2026-10-23）。 | [公式§2.7ページ](https://openstax.org/books/introductory-statistics-2e/pages/2-7-measures-of-the-spread-of-the-data)を2026-11-06に開けた。ページ上の用語と教材側の「標本内を記述する分散」「母分散の不偏推定量」の使い分けは、本文内にも記録されている。 |

JSA資料の2026-11-06時点の利用不能は今回の出典照合に限る制約であり、登録済み記録を更新する判断ではない。ライセンス適合性の包括評価はIssue #80の範囲であり、本Issueでは行わない。

## 4. 現行画面と実操作の記録

### 画面構成

1. `#/map`で「基本統計量」を選ぶと詳細カードが開き、学習目標、#43の手動進捗、共通必須前提、任意復習、「解説を読む」、共通の演習問題一覧への導線が表示される。
2. `#/lesson/descriptive-statistics`は単元概要、4節は `#/lesson/descriptive-statistics/<sectionId>` ごとの画面。節画面に節切替、前提/任意復習、共通の演習問題一覧への導線がある。
3. `#/practice`は単元横断の一覧。開始した問題は `#/practice/<instanceId>`、回答送信後は `#/feedback/<attemptId>`。feedbackには正誤、解法、誤答理由、関連解説、同じ出題を再開するリンクがある。
4. Sigma復習先は `#/lesson/math-algebra-sigma/sigma`。

この分割やクリック数は現行表示の記録であり、学習上の欠点を示すものではない。後続モックと揃えるのは「分散を学び、問題に回答し、誤答理由を確認し、必要に応じて復習後に再演習する」という目的であって、同じ画面順ではない。

### 記録した演習経路

操作数は、1クリック/キー操作を1、回答入力一まとまりを1、送信を別の1として数えた。route/hashが変わった回数を画面遷移数とし、ページ内スクロールは操作数に含めない。

| 経路 | 画面遷移 | 操作数 | 確認した状態 |
|---|---:|---:|---|
| 主経路: variance節 → `#/practice` → `q-desc-var-num-001` → feedback → variance節 → browser Backでfeedback → 同じ出題を再開 | 6 | 7 | practice一覧リンク、問題開始、回答入力`0.676`、送信、feedbackの復習リンク、browser Back、同じ出題の再開。feedbackは誤答として`n=3`と`n−1=2`の違いを表示。 |
| 選択式画面の撮影: practice一覧 → `q-desc-var-sc-001` → browser Backで一覧 | 2 | 2 | 選択式の問題画面を表示。回答は送信せず、attemptは作成していない。主経路の6遷移/7操作には含めない。 |
| generated問題の撮影 | 比較対象外 | 比較対象外 | 一時profileのpractice一覧へ移動して`q-desc-var-gen-num-001`を1回開始。これはキャプチャ操作であり、主経路の操作数には含めない。 |

主経路で使った状態ID:

- `q-desc-var-num-001`, revision 2: `instanceId=773a8471-df51-4fd9-b3a9-361262a5b737`。
- `attemptId=8a82b8a8-a5bd-488f-850d-9f047f7ed889`: 回答`0.676`、`isCorrect=false`。feedbackは「これは偏差平方和をn=3で割った標本内の分散です。母分散の不偏推定量ではn−1=2で割ります。」
- 復習記録 `reviewEventId=4a7931e1-2132-4998-b70e-47e5ec0b5411` は `descriptive-statistics#variance`、source attemptは上記attempt。
- browser Backでは同一feedback/attemptへ戻った。その後の「同じ出題を再開する」は同じinstanceIdへ戻った。回答試行と復習記録は一時profileに残り、出題画面の入力欄は空に戻った。再回答・再送信はしていない。

これは作者が隔離profileで操作した画面・保存状態の確認であり、利用者テストや理解度評価ではない。mapカードのキャプチャではdesktopはノードをクリック、狭幅はノードにプログラムでfocusを置いてEnterで開いた。後者はカードを開いた画面状態の撮影であり、狭幅でのTab移動や操作しやすさを検証したものではない。

## 5. 後続比較の記録様式

### 各版の経路・状態欄

同じ課題を各版で行い、実際に通った経路を版ごとに記録する。同一の操作順や画面数を要求しない。後続Issueでは空欄を埋める。

| 記録欄 | 現行版（#75基準） | モック版（後続Issueで記入） |
|---|---|---|
| 共通の学習目的 | 分散を学ぶ → 問題に回答 → 誤答理由を確認 → 必要に応じて復習 → 同じ問題で再演習 |  |
| 実際のroute/画面列 | `#/lesson/descriptive-statistics/variance` → `#/practice` → `#/practice/<instanceId>` → `#/feedback/<attemptId>` → variance節 → browser Backでfeedback → 同じ問題 |  |
| 画面/route遷移数 | 主経路6。選択式撮影の一覧往復2は別記。 |  |
| 操作数 | 主経路7（click/key、回答入力、送信を別カウント）。手順と定義を添える。 |  |
| 復習後の戻り先 | browser Backで同じfeedback/attempt。feedbackから同じinstanceの問題へ再開できる。 |  |
| 状態保持 | attemptと誤答feedback・reviewEventを保持。同じ出題再開後の数値入力欄は空。再送信は未確認。 |  |
| 根拠（route / ID / screenshot / SHA） | §4と§6、基準SHA |  |
| 観察結果 / 理由 / 残った疑問 | 表示・遷移・保存状態の事実と評価仮説を分ける。 |  |
| 検証方法 | 同じ学習課題を実操作し、実際の画面・route、状態の前後を保存。理解度は利用者評価で別途確認。 |  |

### 比較する6観点

| 観点 | 共通課題 | 現行版の根拠 / 比較で確かめること | モック観察欄 | 判断できる範囲と限界 |
|---|---|---|---|---|
| 直感 → 用語 → 式 | 各指標で何を知りたいかを説明し、式を読む。 | 4節の冒頭文・段落順・数式（§2）。問いへの答えがどこに明記されるかを記録し、定義先行と具体的な状況先行の違いを確かめる。 |  | 構成と明示内容。学習者が理解したかは利用者評価なしでは未検証。 |
| 具体例の一貫性 | 1.000、2.200、3.000 mmを平均から標準偏差まで追う。 | 4節に現れる値・単位・丸めを揃えて確認する。数値を変更する場合はその理由と変わる箇所を記録する。 |  | 例の連続性、計算・単位の整合。例が教育上より良いとは断定しない。 |
| 誤解防止 | 分散でN/n/n−1、mm/mm²、丸めを区別し、標準偏差の解釈条件を確認する。 | `q-desc-var-num-001`に`0.676`を入力し、`1.013 mm²`との違い・誤答feedbackの場所を確認。単位問題、平方根問題、分布条件の説明も照合する。 |  | 説明の位置と計算の正確性。誤解が減るかは利用者評価なしでは未検証。 |
| 演習への移りやすさ | 同じ分散学習課題を各版の自然な経路で行う。 | §4の実route列・6遷移/7操作、戻り先、answer/instance状態を記録。各版で実数を別々に記録する。 |  | 導線と状態保持。操作数の少なさだけから使いやすさや学習効果を結論づけない。 |
| 図の有用性 | 平均線・観測値・符号付き偏差から読み取れることを確認し、説明と照合する。 | `FIG-DESC-VAR-001`、凡例・alt text、図上の値と本文の平方和を対応付ける。 |  | 図/説明の対応。図が理解を促すかは利用者評価なしでは未検証。 |
| 出典の邪魔になりにくさ | JSAとOpenStaxの照合先を探し、必要な根拠情報を確認する。 | 標準偏差節末の出典位置、探すscroll/操作、資料名・URL・版・確認日・該当箇所を記録する。JSA資料は今回直接開けなかった制約を含める。 |  | 初期配置、参照操作、記載情報の保持。ライセンスの包括判定は行わない。 |

### #73で評価する反復操作

各版で対象の設問、操作前の値/状態、各操作後の値/状態、繰り返した回数、他設問・進捗への影響を別々に記録する。該当機能がない現行版では「未実装・比較対象なし」とする。

| 操作 | 現行版（#75で確認） | モック版（後続Issueで記入） | 各反復で記録すること |
|---|---|---|---|
| 同一設問の数値再生成 | **未実装・比較対象なし**。generated問題の「別の類題を解く」は新seedの別QuestionInstance作成であり、同一設問の値の再生成とは異なる。 |  | 問題ID、前後のseed/値、回数、他問題への影響、再生成後の解説状態。 |
| 設問解説の開閉 | **未実装・比較対象なし**。解法とfeedbackは回答後の別feedback routeに表示される。 |  | 開閉の前後状態、回数、閉じている間の答えの見え方。 |
| 設問単位の自己チェック | **未実装・比較対象なし**。mapの学習目標チェック/#43手動進捗は演習設問の自己チェックではない。 |  | 問題ID、チェック前後の状態、回数、移動後の保持。正答率・単元進捗と混同しない。 |

採点式の総合スコアは作らない。平均から標準偏差まで同じ例を引き継ぐ現状は比較の基準として残し、変更が必要だと先に決めない。

### #76の足場確認（2026-11-06）

開発時の `?sfqc-preview=descriptive-statistics#/lesson/descriptive-statistics` で既存UIシェル内の比較モックを開き、平均・偏差・範囲と分散・標準偏差の切替、同じquery付きの学習マップから単元概要へ戻った際のpreview再表示、「現行版を表示」からのquery除去を確認した。ブラウザーのBack/Forwardでもpreviewと現行版のrouteが復元された。節選択はEnterで操作でき、再読み込み後は平均へ戻った。

実ブラウザーのCSS viewportはPC 1302×877 px、狭幅320×800 px。preview表示中の `document.documentElement.scrollWidth` はPCで1302 px、狭幅で305 pxとなり、横はみ出しはなかった。ここで確認したのは共通UI・route・一時状態の足場だけで、分散学習の経路・操作数・教材理解は比較していない。表のモック観察欄は後続 #77〜#80 の学習課題比較後に記入する。

## 6. スクリーンショット一覧

全24の基本画像に、map詳細カード内部スクロールを示す連続した5区間を加え、合計29枚。教材・問題・feedbackの画像は各routeの全ページをscroll開始位置0で撮影した。mapは全ページ画像を開始位置0で撮り、内部スクロールカードの残りを重なり付きのviewport画像で補った。記載したPNG実寸はファイルヘッダーから確認した。

| File | route / 内容 | CSS viewport | PNG実寸 | scroll / 状態 |
|---|---|---:|---:|---|
| [01-map-detail-desktop.png](baselines/issue-75/01-map-detail-desktop.png) | `#/map`、基本統計量カード開 | 1280×900 | 1280×900 | map/card top 0、全画面。カード本文は内部scrollTop 0。 |
| [01-map-detail-desktop-scroll-287.png](baselines/issue-75/01-map-detail-desktop-scroll-287.png) | `#/map`、同カード | 1280×900 | 1280×900 | card `scrollTop=287`; desktop内部scrollHeight 864/clientHeight 577の末尾区間。 |
| [02-map-detail-mobile.png](baselines/issue-75/02-map-detail-mobile.png) | `#/map`、基本統計量カード開 | 320×800 | 320×965 | map/card top 0、全ページ。card内部scrollTop 0。 |
| [02-map-detail-mobile-scroll-169.png](baselines/issue-75/02-map-detail-mobile-scroll-169.png) | `#/map`、同カード | 320×800 | 320×800 | card `scrollTop=169`、以降の区間と50px重複。 |
| [02-map-detail-mobile-scroll-338.png](baselines/issue-75/02-map-detail-mobile-scroll-338.png) | `#/map`、同カード | 320×800 | 320×800 | card `scrollTop=338`、前後と50px重複。 |
| [02-map-detail-mobile-scroll-507.png](baselines/issue-75/02-map-detail-mobile-scroll-507.png) | `#/map`、同カード | 320×800 | 320×800 | card `scrollTop=507`、次区間と81px重複。 |
| [02-map-detail-mobile-scroll-645.png](baselines/issue-75/02-map-detail-mobile-scroll-645.png) | `#/map`、同カード | 320×800 | 320×800 | card `scrollTop=645`、末尾まで。 |
| [03-lesson-overview-desktop.png](baselines/issue-75/03-lesson-overview-desktop.png) | `#/lesson/descriptive-statistics`、概要 | 1280×900 | 1265×1384 | 全ページ、scroll 0。 |
| [03-lesson-overview-mobile.png](baselines/issue-75/03-lesson-overview-mobile.png) | 同概要 | 320×800 | 320×1596 | 全ページ、scroll 0。 |
| [05-lesson-mean-desktop.png](baselines/issue-75/05-lesson-mean-desktop.png) | `#/lesson/descriptive-statistics/mean` | 1280×900 | 1265×1748 | 全ページ、scroll 0。 |
| [05-lesson-mean-mobile.png](baselines/issue-75/05-lesson-mean-mobile.png) | 同mean節 | 320×800 | 320×2339 | 全ページ、scroll 0。 |
| [07-lesson-deviation-desktop.png](baselines/issue-75/07-lesson-deviation-desktop.png) | `#/lesson/descriptive-statistics/deviation` | 1280×900 | 1265×1557 | 全ページ、scroll 0。 |
| [07-lesson-deviation-mobile.png](baselines/issue-75/07-lesson-deviation-mobile.png) | 同deviation節 | 320×800 | 320×1913 | 全ページ、scroll 0。 |
| [09-lesson-variance-desktop.png](baselines/issue-75/09-lesson-variance-desktop.png) | `#/lesson/descriptive-statistics/variance` | 1280×900 | 1265×3260 | 本文、図、出典/復習/演習リンクを含む全ページ、scroll 0。 |
| [09-lesson-variance-mobile.png](baselines/issue-75/09-lesson-variance-mobile.png) | 同variance節 | 320×800 | 320×5079 | 全ページ、scroll 0。 |
| [11-lesson-standard-deviation-desktop.png](baselines/issue-75/11-lesson-standard-deviation-desktop.png) | `#/lesson/descriptive-statistics/standard-deviation` | 1280×900 | 1265×1909 | 本文と出典を含む全ページ、scroll 0。 |
| [11-lesson-standard-deviation-mobile.png](baselines/issue-75/11-lesson-standard-deviation-mobile.png) | 同standard-deviation節 | 320×800 | 320×2927 | 全ページ、scroll 0。 |
| [13-sigma-review-desktop.png](baselines/issue-75/13-sigma-review-desktop.png) | `#/lesson/math-algebra-sigma/sigma` | 1280×900 | 1265×2166 | 全ページ、scroll 0。 |
| [13-sigma-review-mobile.png](baselines/issue-75/13-sigma-review-mobile.png) | 同Σ復習先 | 320×800 | 320×3676 | 全ページ、scroll 0。 |
| [15-practice-list-desktop.png](baselines/issue-75/15-practice-list-desktop.png) | `#/practice`、問題選択一覧 | 1280×900 | 1265×1766 | 全ページ、scroll 0。 |
| [16-practice-list-mobile.png](baselines/issue-75/16-practice-list-mobile.png) | 同問題一覧 | 320×800 | 320×2237 | 全ページ、scroll 0。 |
| [17-choice-question-desktop.png](baselines/issue-75/17-choice-question-desktop.png) | `#/practice/b2ba570b-adda-40a5-86cd-fb9a89f4c8a7` | 1280×900 | 1265×1068 | 全ページ、未回答、scroll 0。 |
| [17-choice-question-mobile.png](baselines/issue-75/17-choice-question-mobile.png) | 同choice question | 320×800 | 320×1230 | 全ページ、未回答、scroll 0。 |
| [19-fixed-question-desktop.png](baselines/issue-75/19-fixed-question-desktop.png) | `#/practice/773a8471-df51-4fd9-b3a9-361262a5b737` | 1280×900 | 1265×1084 | `q-desc-var-num-001` rev2、固定値、回答欄空、scroll 0。 |
| [19-fixed-question-mobile.png](baselines/issue-75/19-fixed-question-mobile.png) | 同fixed numeric | 320×800 | 320×1363 | 同じinstance/値、回答欄空、scroll 0。 |
| [21-generated-question-desktop.png](baselines/issue-75/21-generated-question-desktop.png) | `#/practice/64b7c0c3-1572-4553-a6d5-49ce6372e842` | 1280×900 | 1265×1140 | `q-desc-var-gen-num-001` rev1、seed/version/値は§7、回答欄空、scroll 0。 |
| [22-generated-question-mobile.png](baselines/issue-75/22-generated-question-mobile.png) | 同generated question | 320×800 | 320×1239 | desktopと同じinstance・seed・値、scroll 0。 |
| [23-feedback-wrong-answer-desktop.png](baselines/issue-75/23-feedback-wrong-answer-desktop.png) | `#/feedback/8a82b8a8-a5bd-488f-850d-9f047f7ed889` | 1280×900 | 1265×1124 | `0.676`の不正解feedback、正答/解法/誤答説明を含む全ページ、scroll 0。 |
| [23-feedback-wrong-answer-mobile.png](baselines/issue-75/23-feedback-wrong-answer-mobile.png) | 同feedback | 320×800 | 320×1383 | 同じattempt、全ページ、scroll 0。 |

## 7. generated問題の再現情報

撮影に使ったLocal Storage `sfqc:local-data.questionInstances` の保存snapshotから直接転記した。問題開始時点で `questionId=q-desc-var-gen-num-001`、revision 1、`generationRuleVersion=1`、`seed=f13f3026-799d-4dac-929f-fc3df4a45be9`。一時profileの`instanceId=64b7c0c3-1572-4553-a6d5-49ce6372e842`。保存されたsnapshot.contentは次のとおり。

```json
{
  "format": "numeric",
  "prompt": "母集団全体の測定値から母分散を求めてください。答えは小数第3位までです。",
  "conditions": "母集団の全測定値は1 mm、10 mm、19 mmです。分母はN=3で、単位はmm²です。",
  "parameters": { "d": 9 },
  "correctAnswer": "54.000",
  "grading": { "type": "numeric", "unit": "mm²", "roundingDigits": 3, "absoluteTolerance": "0" },
  "solution": "平均は(1 + 10 + 19)/3 = 10 mmです。偏差は−9, 0, +9 mmで、偏差平方和は9² + 0² + 9² = 162 mm²です。母分散は162/3 mm²なので、小数第3位まででは54.000 mm²です。",
  "feedbackRules": [
    {
      "answer": "81.000",
      "explanation": "この値は偏差平方和をn−1=2で割った値です。母集団全体の分散ではN=3で割ります。",
      "lessonRef": "descriptive-statistics#variance"
    }
  ],
  "defaultFeedback": "母分散では偏差平方和を母集団の個数Nで割ります。"
}
```

対応する測定値は `(10−d), 10, (10+d) = 1, 10, 19 mm`。同じseed/versionで生成器を呼び、保存snapshot.content全体との一致をprofile破棄後に確認した。expectedはLocal Storageから保存したJSONで、生成器の返り値から作っていない。

```powershell
$generationRuleVersion = 1
$seed = 'f13f3026-799d-4dac-929f-fc3df4a45be9'
$snapshotJson = @'
{
  "format": "numeric",
  "prompt": "母集団全体の測定値から母分散を求めてください。答えは小数第3位までです。",
  "conditions": "母集団の全測定値は1 mm、10 mm、19 mmです。分母はN=3で、単位はmm²です。",
  "parameters": { "d": 9 },
  "correctAnswer": "54.000",
  "grading": { "type": "numeric", "unit": "mm²", "roundingDigits": 3, "absoluteTolerance": "0" },
  "solution": "平均は(1 + 10 + 19)/3 = 10 mmです。偏差は−9, 0, +9 mmで、偏差平方和は9² + 0² + 9² = 162 mm²です。母分散は162/3 mm²なので、小数第3位まででは54.000 mm²です。",
  "feedbackRules": [
    {
      "answer": "81.000",
      "explanation": "この値は偏差平方和をn−1=2で割った値です。母集団全体の分散ではN=3で割ります。",
      "lessonRef": "descriptive-statistics#variance"
    }
  ],
  "defaultFeedback": "母分散では偏差平方和を母集団の個数Nで割ります。"
}
'@
$snapshotBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($snapshotJson))
node --input-type=module -e "import assert from 'node:assert/strict'; import { generateQuestionContent } from './src/question-generator.mjs'; const expected = JSON.parse(Buffer.from(process.argv[3], 'base64').toString('utf8')); const actual = generateQuestionContent('q-desc-var-gen-num-001', { generationRuleVersion: Number(process.argv[1]), seed: process.argv[2] }); assert.deepStrictEqual(actual, expected); console.log('questionDefinitionSnapshot.content matches generated content');" $generationRuleVersion $seed $snapshotBase64
```

保存済み`instanceId`/`attemptId`のURLはprofile破棄後に解決できない。IDは撮影画面との照合用、関数再実行は同じseed/versionによる生成照合用として区別する。追加のscriptやfixtureは作らない。

## 8. 表示範囲と未検証

- viewportをdesktop 1280×900、narrow 320×800、scale factor 1で全対象routeに適用し、documentのscroll widthがviewportを超えないことを確認した。horizontal overflowは見つからなかった。教材・一覧・問題・feedbackには画面内scrolling containerがなく、全ページ画像を保存した。mapは詳細カードに内部scrollerがあり、§6の重なり付き画像で末尾まで補った。
- 保存したPNGは全て画面を含み、varianceの図、出典、演習/復習へのリンクも全ページcapture内にある。これは表示欠落を見つけた場合にこのIssueで修正する、という意味ではない。既存の表示不具合があれば記録して別Issueで判断する。
- author操作での導線・保存状態確認のみ。利用者テスト、理解度、学習効果、特定の見せ方が改善したかは**未検証**。
- JSAの一次資料PDFは今回開けず、その本文との再照合は**未検証**。OpenStax §2.7のページは開けた。
- 設問内の数値再生成、解説開閉、設問単位の自己チェックは、現行版では**未実装・比較対象なし**。map上の学習目標チェック、手動進捗、採点、正答率と混同しない。
- 本書の範囲で実施した検証結果はPR本文にも記録する。差分の許可範囲はこのMarkdownと `docs/baselines/issue-75/` の画像だけ。
