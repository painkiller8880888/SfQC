# Issue #109 調査報告

## 調査基準と範囲

- 調査日：2026-11-18
- 作業開始時の main：0885b125c790c22ecf1dcd9689de896237758d3e
- 対象：Issue #108・#109、#109の実施計画コメント、後続Issue #110〜#113、README・AGENTS.md・P2.1完了記録・Issue #81移行計画、教材registry・表示・採点・保存コードと関連テスト。
- この報告は現行挙動の記録と後続判断案を分ける。教材本文、演習問題、UI、保存形式、IDは変更していない。

Issue #108はPhase 1を #109（調査）→#110（データ契約）→#111（共通表示・採点）→#112（ガイドラインv0）の順にし、Phase 2の最初を「データの種類」#113と定めている。#110〜#113はいずれも未着手のopen Issue。#109の目的は、基本統計量を全単元の画一的な型にすることではなく、再利用する契約、教材ごとに選ぶ構成、保護する既存境界を根拠付きで次のIssueに渡すことである。

README・AGENTS.mdの現行マップ範囲はIssue #101〜#104を参照する。P2.1とIssue #81移行計画に残るマップの前提表示・配置保存・マップ／詳細の正答率表示については、後発のIssue #101契約が優先する。今回はマップ機能を変更しないため、その他の既存ID、route、進捗、履歴、バックアップ契約を保護条件として扱う。スクリーンリーダー固有の追加開発・検証は現行方針の対象外であり、既存ARIA属性を保つ。後続のUI作業ではキーボード操作、可視フォーカス、操作対象の画面内可視性、マウス・タッチ操作を引き続き確認する。

## 6単元の教育設計・実装比較

「必要な確認・演習」は現在の収録状況とは分けて、学習目標から導く候補を記す。問題を増やすこと自体は目的にしない。

| 単元・節 | 現在の学習目標と本文・図 | 現在の演習 | 学習目標から見た確認候補 | 前提・重複 |
|---|---|---|---|---|
| 基本統計量（descriptive-statistics）— mean / deviation / variance / standard-deviation | 目標は量的データの平均・偏差・分散・標準偏差を計算し、中心と散らばりを単位・目的に沿って説明すること。A・Bのシャフトを各3本測り、平均は同じでも散らばりが異なるという問いから始め、4節を連続させる。各節に平均の位置、符号付き偏差、偏差平方和・分母の使い分け、標準偏差の単位を扱うコード描画図がある。分散節にはnとn−1の標本間平均を比較する復元抽出シミュレーションもある。 | 各節にexerciseSlot（mean / deviation / variance / standard-deviation）が1つずつあり、数値入力は順に1・3・2・1欄。独立演習は5カテゴリ×3出題型で、選択・数値・誤り箇所の特定を含む。 | 手順の計算だけでなく、単位・分母の意味、中心と散らばりの比較、変換後の変化、式の誤り発見を確認できる。既存構成がこの範囲を一つの文脈で扱う。 | 共通必須前提はデータの種類、分数・比・割合、指数と平方根。分散節から文字式と総和記号へのリンクは任意復習で、共通必須前提ではない。 |
| 四則計算と単位（math-arithmetic）— operations | 目標は整数・小数・負数の四則、単位、演算順序を使うこと。単位換算、同単位の加減、負の差、測定個数で割る平均、単位付き率を文章と式で示す。 | exerciseSlotなし。 | 演算順序・符号・小数の計算、足し引き前の単位統一、積・商での単位の扱いを問題の目的に応じて確認する。 | 前提なし。分数・比・割合の本文にも単位付き率 mm/s の例があり、単位の商を説明する内容が重なる。重複する定義をどちらに置くかは後続改稿時に整理する。 |
| 分数・比・割合（math-ratios-percentages）— ratio | 目標は分数・比・割合・百分率・比率の相互変換と丸めの説明。検査数に対する不適合品数の比・割合、丸めを最後に行う理由、分母0の未定義性を扱う。 | exerciseSlotなし。 | 比と割合の区別、分母が示す全体、分数と百分率の変換、途中を丸めない計算、分母0の判断を確認する。 | 共通必須前提は四則計算と単位。四則計算の単位付き率と例が重なる。基本統計量の平均・不偏分散の計算にも割り算は使うが、分母・割合の解釈はこの単元の役割。 |
| 指数と平方根（math-powers-roots）— powers-roots | 目標は指数・平方根を計算し、式中の意味を説明すること。長さの二乗と平方単位、平方根の非負の主値、√(x²)=|x|を短い式と例で扱う。 | exerciseSlotなし。 | 二乗と単位の対応、負数を二乗した後の主平方根、平方根の値と符号を確認する。 | 共通必須前提は四則計算と単位。基本統計量の分散・標準偏差でも二乗／平方根と単位が必要であり、ここではその演算意味を準備する。 |
| 文字式と総和記号（math-algebra-sigma）— sigma | 目標は文字式・一次式・式変形・総和記号を使って統計式を読むこと。Σの上下限・添字・項の展開、単位付き一次式の変形を示し、分散の形を読む例は定義や分散計算と区別する。 | exerciseSlotなし。 | Σを有限の和へ展開する、添字と範囲を特定する、代入して評価する、一次式を同値変形する練習が候補。 | 共通必須前提は分数・比・割合と指数・平方根。基本統計量の分散からΣへの参照は任意復習であり、基本統計量の先行条件ではない。基本統計量と同じ記号や二乗差が例に出るため、どこまで扱うかを保つ。 |
| データの種類（data-types）— types | 目標は計量値・計数値、カテゴリ・数値、単位と観測単位を区別すること。製品単位と傷単位を分け、連続量・離散数・カテゴリ、カテゴリに付けた0/1、1製品中の傷数と不適合品数を説明する。 | exerciseSlotなし。 | 観測単位を決めた上で分類する問題、測定精度と量の性質の区別、0/1表記の解釈、不適合品数と不適合数の違いを検証する問題が学習目標と対応する。計算中心にする必要はない。 | 前提なし。基本統計量の共通必須前提であり、「平均をカテゴリ番号に使わない」説明と接続する。#113が最初の非計算型検証単元。 |

比較根拠：6単元の目標・節ID・前提・教材本文はsrc/lesson-registry.mjs、一般単元本文の契約はscripts/lesson-contract.test.mjs、教育前提・公式項目との照合はscripts/lesson-curriculum.test.mjsとdocs/curriculum/PREREQUISITE_MAP_DRAFT.md／SYLLABUS_MAPPING_DRAFT.md。数学4単元には出典を示す本文段落がある一方、sourceItemIds/sourceRefsは空で、data-typesとdescriptive-statisticsはSRC項目とsourceRefsを持つ。出典表現のこの差は #110・#112で明示的に扱う。教材をこのIssueで移行しない。

## 基本統計量の教育要素と実装責務

| 要素 | 教育上の役割 | 本文・データ／表示 | 採点・履歴・参照 |
|---|---|---|---|
| 導入・事例 | 同じ平均の2ラインを比べ、平均だけでは散らばりを区別できない問いを作る。 | overviewの文章とA/B各3点の表。値変更の操作は同一ページ内だけで、保存しない。 | 採点・履歴なし。4節を順に読む入口。 |
| 観察する図 | 数値と概念の対応を、節の目的に合わせて比較する。 | FIG-DS-MEAN等4つの登録IDを、mean/deviation/variance/sdの4表示モードで同じSVG系コンポーネントに割り当てる。点はドラッグまたは矢印キーで動き、平均・偏差・偏差平方和／分散・標準偏差を表でも読む。FIG-DS-SIMULATIONは復元抽出した標本でn割りとn−1割りの平均を比べる別のコード描画。 | 図の変更はページ内状態。registryのfigureメタデータに教育目的・変数／軸・凡例・説明を持つ。生成画像は使わない。 |
| 数式・補足 | 公式の意味、単位、母集団と標本の使い分け、適用条件・限界を明確にする。 | 数式・文章・表・折りたたみdetails。平均と分散の式中からΣ教材へのリンクがある。各節には例の後に必要な記号・条件や注意を置く。 | 参照はlessonId/sectionId。分散からΣへの経路は任意復習。 |
| 節内確認 | 直前の説明の手順をその場で練習する。 | registryのexerciseSlotはexerciseIdのみを持つ。DescriptiveStatisticsCourse側が専用InlineExerciseへ接続し、生成定義はdescriptive-statistics-preview-exercises.mjsに置く。初期問題と最大バリエーション数は平均275、偏差275、分散275、標準偏差66。 | 数値文字列をNFKC正規化しUnicodeマイナスを置換後、gradeDecimalAnswerで各欄を判定。節内確認は独立演習履歴・正答率へ保存しない。 |
| 独立演習 | 節をまたぐ計算・概念・変換・誤り発見を練習し、解説へ戻る。 | 別のcourse-practice routeに、平均と偏差／データの変換／不偏分散／総合／分散と標準偏差の5カテゴリを置く。各カテゴリは3型、categoryIndex・typeIndex・32-bit seedから問題、選択肢または数値、正答、節参照、説明を再現する。 | 有効な最初の判定のみ記録。未選択・形式不正は履歴に入れない。節参照から復習し、course-practiceへ戻れる。 |
| 誤答・解説の開示 | 誤答理由を表示し、根拠ある復習へつなぐ。数値入力の誤答原因は検出できない範囲で推測しない。 | 問題・正答・解説データはブラウザーに届く。設問表示での開示制御であり、payload秘匿ではない。節内と独立演習のdetailsは初期閉鎖だが採点前にも手動で開ける。正答で自動的に開き、誤答・形式不正では自動では開かない。誤り発見問題の誤った計算過程は設問として初期表示する。 | 数値不正時はinvalidと正誤を分離。選択肢問題には誤答理由を明記できる。節参照のrouteと復習stackで戻り先を保つ。 |
| 出典・クレジット | 数学・教育上の根拠と制作クレジットを追跡する。 | 基本統計量はSRC-0005から公式出題範囲のsourceRefsを導出し、参考資料・クレジットを別表示。data-typesはSRC-0001を持つ。数学4単元は本文中に参考書・節・URL・確認日を記載するが構造化sourceRefsはない。 | sourceItemIdとsourceRefsの整合はlesson-contractとlesson-curriculumで検査。引用表現を揃える変更は同テストと資料を含む判断が必要。 |

### 表示・採点の現在の振る舞い

- 節内確認のnumber欄は1問につき1、3、2、1欄。偏差は各入力が有効で、全欄正解の場合だけ全体正解。空欄・不正形式が一つでもあれば形式エラー。部分点・欄別フィードバックはない。再生成で入力・フィードバック・detailsを閉じる。
- 独立演習の5カテゴリはそれぞれ数値／選択形式を含む3型を持ち、選択肢をseedに基づいて並べ替える。seedが同じなら設問・正答・説明・節参照が同じ。設問単位の再生成はtypeIndexとseedを変え、入力・フィードバック・detailsをリセットする。
- 節内確認の文言は、正答「正解です。解説を開いて計算を確認できます。」、誤答「違います。値−平均、または二乗和の式を確認してください。」、形式不正「入力形式を確認してください（例：12、−2、0.5）。」。独立演習は未選択「選択肢を選んでください。」、数値形式不正「入力形式を確認してください（例：12、−2、+3、0.5）。」、正答「正解です。」、誤答「違います。考え直すか、『解説を見る』で考え方を確認してください。」。
- gradeDecimalAnswerは文字列の符号付き整数・小数を受け、trimする。呼出側はNFKCとUnicodeマイナス置換を行う。指数表記、先頭ゼロ付き整数、.5/1.、単位付き文字列、数値型は拒否。roundingDigitsは負のゼロを除く非負の安全な整数で、解答と正答を十進BigIntで丸めて比較し、ちょうど半分は絶対値の大きい側へ丸める。現在の数値問題はすべて0桁指定。根拠はsrc/question-grading.mjsとscripts/question-grading.test.mjs。
- 独立演習の各カードは問題キー（categoryId・seed・typeIndex）で同一設問を識別し、そのキーで有効判定を一度だけ通知する。以後の再回答はカード内の表示フィードバックを変えても履歴追記しない。ページの「正解 x/5」集計も最初の有効判定で固定される。再生成すると新しいキーとなり、次の有効判定を記録できる。集計表示と記録が最初の判定に対応する点は #111の表示判断で明記する。
- 一般表示src/lesson-view.tsxはexerciseSlotを受け取ると「確認問題は、学習マップから基本統計量のコースを開いてください。」と表示し、問題を実行しない。専用コース表示src/descriptive-statistics-course.tsxはBodyBlockからInlineExerciseを呼ぶ。独立演習routeはsrc/App.tsxでdescriptive-statisticsだけを表示し、それ以外の単元には「準備中」とする。現在の契約には一般単元用の実行可能な演習スキーマ・UIはまだない。

## 問題・配置・インスタンス・履歴の識別

| 対象 | 現在の識別 | 寿命・永続化 | #110での扱い |
|---|---|---|---|
| 節内の配置 | lessonId + sectionId + exerciseSlot.exerciseId（mean等） | registryの本文位置。保存データにslot IDはない。 | exerciseSlotは節内の配置と問題定義への参照を担う候補。本文に設問ペイロードを複製しない。 |
| 独立演習の配置 | course-practice route上で5カテゴリの設問カード | routeと表示構成。カードに独立した配置IDはない。 | 一般単元のroute・カテゴリ配置をどう表すかは後続共通契約で判断。 |
| 定義 | 節内はexerciseId。独立演習はcategoryIdと生成器選択typeIndex。 | 教材データ／生成器コードの一部。typeIndexは0〜2の実装選択値で、永続IDとしては使われない。 | stable definition IDとvariant/generator識別を区別。既存exerciseId/categoryIdは保護する。 |
| 表示中の設問インスタンス | 節内はexerciseIdに対するReactのindex。独立演習はcategoryId:typeIndex:seedのquestionKey。 | メモリ内。再生成で変わり、routeのunmount/remountで初期化。節リンク間は専用コースが維持されるためstateが残る。 | 固定問題にseedを必須にしない。生成問題は必要なときのみ再現用generatorとseedを持つ。インスタンスIDを履歴に保存する必要性は未確認。 |
| 履歴 | { categoryId, isCorrect, attemptedAt } | sfqc:practice-results:v1 / schemaVersion 1。5カテゴリ横断で最新25件。設問ID・インスタンス・回答・snapshotは保存しない。節内確認は保存しない。 | 表示中instance識別と分析／保存レコードの識別を分ける。結果の意味やIDを変える場合は #110・#111で影響を示す。 |

## 5例で確認するデータ契約

前4例は現行挙動、最後は#113の契約確認用の仮想例。最後の例は本番問題を追加する提案ではない。

| 例 | 配置・データから表示／採点／復習への流れ | 差分・判断先 |
|---|---|---|
| 平均（節内確認） | descriptive-statistics#meanのexerciseSlot(mean)を専用コースの問題定義が解決し、1つの数値欄と別表示の単位へ渡す。NFKC等の正規化後、gradeDecimalAnswer(..., 0)が採点する。 | 定義IDとslot参照は#110。数値欄・単位の表示は#111。数値文字列に単位を含めない現行条件を記録。 |
| 偏差（節内確認） | descriptive-statistics#deviationのslotから3欄へ値を渡し、3欄すべて有効で全問正解なら全体正解。各欄に値−平均の式を示す。 | #110で可変数の入力欄と採点条件をどう表すかを決める。部分点・欄別feedbackは現行仕様ではなく、#110/#111で必要性を判断する。全問題に4欄を強制しない。 |
| 独立生成演習 | course-practice routeのカテゴリカードからcategoryIndex・typeIndex・seedを生成器へ渡し、設問・数値／選択肢・正答・説明・section参照を作る。 | 定義と出題instanceの識別、seed再現性は#110。回答・feedback・details reset、記録guardは#111。 |
| 誤り箇所を選ぶ問題 | 「総合」カテゴリの誤り発見型。誤った計算過程は設問として見せ、誤りの段階を選択させる。正しい修正手順を含むexplanationは閉じたdetailsに入り、採点前にも利用者が開ける。 | 問題モデルで誤計算表示と正答解説を区別するのは#110。開示時点・誤答feedbackは#111。 |
| 仮想の分類問題 | 将来のdata-types#typesについて、「製品の長さをmmで測った値は計量値か計数値か」の二択と短い判定基準を契約に当てはめる。 | #110で数値入力、単位変換、丸め、seedが不要な選択問題を表せることを確認。#111の表示、実教材適用は#113。実問題やregistryは追加しない。 |

## #110へ渡す最小契約案

このIssueでデータ型を確定・実装しない。次の責務を型の違いとして表現し、問題形式に不要な必須フィールドを課さないのが候補となる。

| 責務 | 契約に必要な情報 | 現行根拠と判断事項 |
|---|---|---|
| 配置と定義参照 | lessonId/sectionId、節内配置ならexerciseId。独立演習はカテゴリやroute上の配置。 | registryのexerciseSlotはIDのみ。参照先が必ず存在することのvalidationは現状別の問題定義テーブルを持たない。slotと定義の解決・検証を#110で決める。 |
| 問題形式 | 選択式または数値入力。設問文・表示する表や計算過程・フィールド・単位。 | 1欄と3欄、選択、誤り計算提示の全てを表現する。フィールド数・unit・choicesを全問題に必須にしない。 |
| 正答・採点 | 選択肢の正答識別、または数値解答と入力・丸め条件。数値は現在文字列の期待値を使う。 | 浮動小数点許容誤差や単位入力は現行契約にない。0桁・十進比較の規則、invalidとwrongの区別を維持する。部分点・欄別結果は未決。 |
| 説明・feedback | 正しい解法・途中式、必要なら選択肢ごとの誤解説明、数値問題の一般的feedback。 | 選択肢理由は明示可能。数値誤答の原因を結果から推測しない。問題オブジェクトはブラウザーへ届くため、契約は解答前の表示制御を表す。 |
| 復習参照 | lessonIdとsectionId（必要に応じて複数）。 | 現行演習は関連節を表示し、review intentのroute-historyで元の演習へ戻る。IDの存在をvalidationする。 |
| 生成 | 固定問題では省略可能。生成問題だけgenerator/variantと再現用seedを持つ。 | 現行の独立問題は32-bit seed、typeIndex、categoryIdから再現。選択式を含む非数値問題へ数値やseedを一律要求しない。seedとvariantの安定性は判断事項。 |
| 結果記録 | 保存先カテゴリ、判定結果、日時。 | 現行レコードに問題・回答・instance IDはない。categoryIdの拡張、正答率への割当、旧カテゴリID維持は別途接続範囲を明記する。 |

候補検証は、問題定義と参照の入力検証、固定／生成の識別、同seedで設問・正答・説明が一貫して再現すること、選択肢の一意性と正答参照、数値境界・丸め、節リンクが有効なことを対象にする。解答・正しい途中式を初期設問に混ぜないことは、手動でdetailsを開ける現行挙動と区別してテストする。

## 保護する既存契約

| 契約 | 現行根拠 | 変更時の影響・検証先 |
|---|---|---|
| lessonId/sectionId、本文・出典・前提グラフ | src/lesson-registry.mjs、src/lesson-contract.mjs、scripts/lesson-contract.test.mjs、scripts/lesson-curriculum.test.mjs | registryは教材の正本。共通必須・条件付き・任意復習を混ぜず、参照先のIDを保つ。資料構造やofficial source対応変更もcurriculumテストに届く。 |
| hash routeと復習往復 | src/resolve-screen.mjs、src/route-data.mjs、src/route-history.mjs、scripts/resolve-screen.test.mjs、scripts/route-data.test.mjs、scripts/route-history.test.mjs、scripts/route-view.test.mjs | course lesson/practiceと一般lesson route、節移動・review stack・復帰スクロールを保つ。 |
| 節内確認と独立演習の境界 | src/descriptive-statistics-course.tsx、src/descriptive-statistics-preview-exercises.mjs、src/descriptive-statistics-exercise-preview-data.mjs、scripts/descriptive-statistics-preview-exercises.test.mjs、scripts/descriptive-statistics-exercise-preview.test.mjs、scripts/practice-app.test.mjs | 節内確認は保存・正答率集計しない。独立演習だけ5カテゴリの有効な初回判定を記録する。 |
| practice-resultsと正答率 | src/practice-results.mjs、src/course-progress.mjs、scripts/practice-results.test.mjs、scripts/course-progress.test.mjs | sfqc:practice-results:v1、schemaVersion 1、固定カテゴリ許可集合、最新25件、結果がmanual completionを完了にしない契約を保つ。新unit結果の割当はカテゴリ許可・集計・表示を一緒に調整する。 |
| 手動進捗と保存失敗処理 | src/learning-state.mjs、src/manual-progress.mjs、scripts/learning-state.test.mjs、scripts/practice-app.test.mjs | sfqc:learning-state:v2/schemaVersion 2の手動完了と演習成績の独立性、入力検証、storage failure・競合後の再確認を保つ。 |
| 統合backup | src/backup.mjs、scripts/backup.test.mjs | sfqc-learning-backup version 2で手動進捗・演習記録を一体で検証し、確認前の置換、破損データ保全、復旧処理を保つ。正式リリース前の後方互換性方針に従うが、採用形式の検証と保存失敗処理は維持する。 |
| 図・操作 | src/lesson-contract.mjs、src/figures/figure-ref.tsx、src/figures/interactive-variance-comparison.tsx、scripts/lesson-contract.test.mjs、scripts/practice-app.test.mjs | コード描画、registry上の教育目的・説明、ページ内だけで動く点変更を維持。次のUI変更はkeyboard/focus/可視性/mouse/touchの範囲を確認し、ARIA属性は不要に削除しない。 |

Issue #101で更新されたマップ表示・配置・正答率表示は今回の変更対象ではない。今後のスキーマ拡張がマップから演習を開く既存routeや進捗の独立性を変えないようにする。

## 後続Issueの判断事項

| Issue | 渡す判断材料 |
|---|---|
| #110 共通データスキーマ | 配置ID・定義ID・instance識別を区別する。固定／生成、選択／数値、可変欄数、単位と答えの分離、採点条件、説明・選択肢別理由、section参照、seedと入力検証を表現する。分類問題には不要な数値・丸め・seedを要求しない。math単元の出典段落と構造化sourceRefsの差をどう扱うかも判断する。 |
| #111 共通表示・採点 | 専用コースと一般表示の差を解消しつつ、節内確認と独立演習の保存・集計差を保つ。解説の初期閉鎖と採点前の手動開示、正答時の自動開示、誤答・不正入力、誤計算の初期提示、再生成reset、同一設問の初回判定guard、3欄偏差の全体判定・summaryの意味を判断する。UI QAはAGENTS.mdの現行範囲を使う。 |
| #112 ガイドラインv0 | 4節や同数演習・図を全教材に強制しない。本文中心・分類中心では構成を短くできる。観察事実と教育評価を分ける。出典、コード描画を選ぶ目的、誤答からの参照、ID/route/履歴、keyboard・visible focus・pointer操作の確認境界を記録する。 |
| #113 データの種類 | 仮想契約例を実教材へ適用する最初の単元。観測単位、不適合品と不適合数、カテゴリの0/1表記を分類問題・事例問題で検証し、計算型に限定しない。 |

## 未決事項と必要な判断

1. #110：節内slotと独立practice categoryの関係、stable definition IDと実行時variant/seedの区別、固定問題に持たせないフィールド。
2. #110/#111：偏差の複数欄について、全体正誤を維持するか部分点・欄別feedbackを導入するか。現在の入力数は3で、全問共通の4欄契約はない。
3. #111：カード内の最新feedbackと初回判定で固定される履歴・ページ集計をどう説明するか。誤答後に正答しても保存記録とページ集計は初回結果のまま。
4. #110/#111：今後の他単元演習にcategoryを追加した際の履歴ID、lesson accuracyへの割当、最大25件の集計・backup接続。手動完了は引き続き別系統。
5. #110/#112：本文に書かれた出典とsourceItemId/sourceRefsの構造化記録をどこまで統一するか。変更する場合はcurriculum資料と契約テストへの影響を判断する。
6. #111：表示の初期状態で回答を漏らさない条件と、現行の採点前details手動開示を両立するか。誤答理由は証拠のある選択肢理由に限定する。

Issue・コード・既存テスト間に、今回の文書作成を止める設計衝突は見つからなかった。上記は契約を実装する前に判断が必要な事項として保留し、現行仕様と新規案を混同しない。

## 受入条件の照合

- 6単元の学習目標・本文構造・図・現行演習・必要な確認候補・前提・重複を比較表に記録。
- 基本統計量の導入から採点・履歴・参照までを教育上の役割と実装責務に分け、4つの節内確認と5カテゴリの独立演習、5つの図、主要feedbackを照合。
- 数値入力・選択問題・誤り発見問題・非計算型の仮想分類問題の5例と、配置／定義／instance／履歴レコードの関係を記録。
- ID、route、前提、手動進捗、演習記録、backup、図の保護条件にコードとテストを対応付けた。
- 差分はこの調査文書のみ。production previewの画面・操作確認は文書のみの変更のため対象外。

### 実施した検証

- git diff --check：成功。
- npm run check：成功（111 tests、失敗0）。
- npm run build：成功（checkを含む111 tests、本番Vite build、check-build 1 test）。
- 6単元の代表行、5つの契約例、ID・route・保存条件をコードと関連テストに照合した。独立した教育品質レビューはPhase 2の各教材Issueで行う。
