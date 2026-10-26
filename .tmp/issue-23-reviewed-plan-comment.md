# Issue #23 実装計画（レビュー反映済み）

更新日: 2026-10-26

## 1. 目的と前提

単元・節・出題インスタンス・解答試行をID付きURLで直接開けるようにし、複数段の復習後も元の出題、回答、採点結果、読書位置へ戻れるようにする。

現在は6画面の固定hash routeのみで、ID付きrouteは未対応。schema v2には出題snapshot・解答試行があるため、採点済みの回答・結果は既存記録から解決し、未送信の入力draftと復帰経路を履歴側で保持する。

- 前提: #7・#16・#22は完了済み。保存データは#22のschema v2を使用する。
- 後続: 教材本文表示は#24、回答フォームは#25、フィードバック画面・復習イベント記録は#26で実装する。
- GitHub Pagesの既存hash navigationを継続する。新規ルーター依存、local dataのschema変更は行わない。

## 2. URLと解決規則

| 対象 | URL | 解決先 |
| --- | --- | --- |
| 既存画面 | `#/map`、`#/lesson`、`#/practice`、`#/feedback`、`#/progress`、`#/data` | 現在の既定画面を維持 |
| 単元 | `#/lesson/{lessonId}` | 収録済み単元 |
| 節 | `#/lesson/{lessonId}/{sectionId}` | その単元内の節 |
| 出題 | `#/practice/{instanceId}` | 保存済み出題snapshot |
| 採点結果 | `#/feedback/{attemptId}` | 保存済み解答試行と参照先snapshot |

- 空hashと`#/`は学習マップとして扱う。
- IDは各URLの1 segmentとして`encodeURIComponent`／`decodeURIComponent`で扱い、pathの分割後に一度だけdecodeする。`instanceId`・`attemptId`は`lessonId`のslug制約を流用しないため、`/`、`#`、`%`、日本語、文字列`%2F`を含む有効なIDも生成→解析で原文に戻す。`%2F`を二重decodeせず、未知の有効IDは構文エラーとせず存在しないIDとして扱う。不正なエンコード、空のID、余分なsegmentは不正routeとする。教材内の`lessonId#sectionId`表記は既存`parseLessonRef`で分解してからURLを生成する。
- 構文解析と存在確認を分ける。構文parserは純粋にURLだけを解析する。route coordinatorは初回表示、アプリ内遷移、hash変更、Back／Forward、reloadの各route entryで`readLocalData()`を一度呼び、その同じ結果でinstance／attemptの存在を確認し、画面表示にも渡す。lesson/sectionは教材レジストリから解決する。`readLocalData()`の結果が`missing`なら有効な空データ、`invalid`／`unreadable`ならデータ異常として扱い、両者を同一視しない。
- 正常な保存データ内にIDが存在しない場合は「IDが見つからない」として、理由と学習マップ／データ管理への回復導線を示す。保存済みattemptが参照するsnapshotの欠落など、schema違反でlocal data全体が`invalid`になる場合は、個別ID欠落ではなく既存のデータ異常表示へ分ける。別問題への自動置換、自動採点、保存記録の書き換えはしない。
- 破損・未対応バージョンのlocal dataは既存の読み込み結果に従って扱い、空データと同一視しない。

## 3. 復帰状態と履歴の契約

バージョン付き`history.state`に、現在のroute、entry固有ID、入力中の回答、表示節・スクロール位置、復帰stackを保持する。新しいhistory entryには新しいentry IDを割り当て、同じentryへの`replaceState`では保つ。Back／Forwardはそのentryに保存されたIDを使う。snapshotや保存済み採点結果は複製せず、`instanceId`／`attemptId`で参照する。

復帰frameはroute・入力・位置・必要な参照IDだけの平坦な構造とし、frameの中に別のstackは入れない。入力値は後続フォームが更新・取得できる最小の契約として定義し、教材表示や採点ロジックと結合させない。practiceの未送信draftは`instanceId`に結び付ける。feedback画面ではURLの`attemptId`が指す保存済み`AnswerAttempt.answer`を表示する。明示的なfeedback→practice再開では、新しいpractice entryの初期回答に指定attemptの`answer`を使い、旧practice draftと混ぜず、旧practice entryや他entryのdraftも書き換えない。再開entryのhistory stateにはこの`attemptId`を参照として持たせ、参照attemptとrouteの`instanceId`が一致することを確認する。一方、ブラウザーBack／Forwardと「1段戻る」による復帰では、遷移先entry／frame自身のdraftをそのまま復元し、attempt.answerで上書きしない。attemptが紐づかない直接practice URLでは有効なそのentryのdraftがあればそれを使い、なければ空欄にする。履歴遷移では採点関数を呼ばず、attemptを追加しない（保存データ読込時の既存整合性検証は維持する）。

instance／attemptを保存してID URLへ移る順序は、`saveLocalData`の成功結果を得る→その戻り値の`data`と`raw`でAppの保存データ表示を更新する→ID付きURLのhistory entryを作る→route coordinatorが一度だけ`readLocalData()`を呼び、その結果を存在確認と画面表示の両方に使う、で固定する。初回表示、アプリ遷移、hash変更、Back／Forward、reloadも同じ意味解決経路を使う。構文parserは保存データを読まない。URL解決はReact stateの古い`storedData`を参照せず、setStateのcommit完了も待たないため、保存直後のIDを解決できる。保存失敗時はURLを遷移させず、現在entryと入力draftを保ってエラーを表示する。import／migration後も同じ最新保存データ解決契約を使う。

| 操作 | 履歴・復帰stackの扱い |
| --- | --- |
| 入力更新、スクロール、表示節の変更 | 閲覧中の現在entryを`replaceState`で更新。アプリ内遷移の直前には未反映の更新を確定する |
| 復習リンクを開く | 復習リンクとして識別し、現在のframeをstack末尾に追加して、復習先を新entryへ`pushState`する |
| 「1段戻る」 | 末尾frameを取り出し、残りstackを付けた復帰先を新entryへ`pushState`する |
| 復帰直後のBack／Forward | Backは直前の復習画面、Forwardは復帰先へ戻る。ブラウザーの履歴順序に従い、stackを追加でpopしない |
| 同一単元内の節移動 | 節移動として識別し、stackを維持して新entryを作る。節移動自体では復帰frameを追加しない |
| メインナビゲーション等の通常遷移 | 通常遷移として識別し、復習経路を終了して移動先のstackを空にした新entryを作る |
| feedbackから元のpracticeを再開 | 再開操作として新しいpractice entryを作り、復習stackを空にする。feedbackのattemptが参照する同じ`instanceId`とsnapshotを使い、history stateにその`attemptId`を結び付ける。新entryの初期回答にはそのattemptの`answer`を使い、旧entryや他entryのdraftは変えない。新しい出題を作らず既存attemptの採点も繰り返さない |
| Back／Forward・reload | 移動先／現在entryに付随する有効な状態を復元する |
| 履歴状態がない直接URL | URLと保存済みデータだけで通常解決し、空stackと新entry IDを付けて`replaceState`で初期化する。復帰元を推測しない |

`history.state`のversion、route一致、entry ID、frame構造を検証する。不正な一時状態は破棄し、有効なURLは最新の保存データから通常どおり解決したうえで、復帰情報を利用できない旨を案内する。履歴更新に失敗した場合も、保存済み学習データは変更せず、保持できなかった状態を利用者に知らせる。quota回避用の別ストレージは追加しない。

## 4. 実装手順と変更箇所

### 4-1. routeの構文・型・生成を揃える

対象: `src/resolve-screen.mjs`、`src/resolve-screen.d.mts`、`scripts/resolve-screen.test.mjs`

- 固定routeとID付きrouteを判別できるroute型を定義する。
- ID routeのparseとhash生成を揃え、生成→解析で同じIDへ戻ることを確認する。特に`instanceId`／`attemptId`に`/`、`#`、`%`、日本語、文字列`%2F`を含め、各segmentをencodeしpath分割後に一度だけdecodeする順序も検証する。未知の有効IDは構文として受け入れ、存在確認段階で未登録と判定する。
- `resolveScreen`の呼び出し元、画面辞書、ナビゲーションの選択状態、effect依存、型・テストを洗い出して更新する。画面種別だけを使う処理は`route.kind`等を参照し、同じ画面種別でもIDが変われば内容を更新する。
- registry／local dataによる存在確認を純粋な構文parserから分離する。route coordinatorは各entryで一度だけ最新の`readLocalData()`を呼び、その同じ結果をID存在確認と画面表示の両方に渡す。App起動時などに捕捉した古いReact `storedData`を使わない。lesson/section・snapshot・attemptはそれぞれの現行契約で解決する。
- 正常schemaの保存データに指定IDがない場合はrouteの未知IDとして扱う。attemptからsnapshotへの参照欠落で保存データ全体が`invalid`の場合はroute parserの未知IDとはせず、既存のデータ異常・回復フローへ渡す。

### 4-2. 一時状態の更新・復元処理を実装する

対象: `src/App.tsx`と、状態遷移を単体検証するために切り出す最小の状態処理・型・テスト。

- 現在entryの初期化、入力・位置の更新、復習先への移動、1段復帰を上記契約に沿って実装する。
- 入力は変更時、スクロール・表示節は閲覧中の変更時に現在entryへ反映する。「アプリ内リンクを押す直前だけ保存する」実装にはしない。
- `pushState`／`replaceState`は`hashchange`を発火しないため、アプリ自身の遷移後はroute更新を明示する。`popstate`と`hashchange`の購読を一か所にまとめ、同一移動を二重に処理しない。
- 既存の内部`a href`は維持し、navigation intentを明示して単一の遷移処理へ通す。通常の同一タブ操作だけを処理し、修飾キー付きclick、中／右クリック、新規タブ・window指定などはブラウザー標準の動作を保つ。復習リンク、同一単元内の節移動、通常navをhref文字列や画面種別だけで推測しない。初回表示・アプリ内遷移・hash変更・Back／Forward・reloadは同じroute coordinatorを通し、一回の`readLocalData()`結果を存在確認と表示で共用する。
- 各アプリ内遷移の前に現在entryのdraft・節・位置更新を確定し、旧entry由来の保留中callbackを取り消す。`popstate`と`hashchange`は同じ移動を二重処理しない。
- `QuestionInstance`作成後と`AnswerAttempt`採点後は、`saveLocalData`が成功して返した`data`／`raw`をAppへ反映してからID URLへ進む。resolverは保存されたlocalStorageを改めて読み直す。保存が失敗した場合はID URLへ遷移しない。
- 保存済みattemptの回答・採点結果は既存記録を参照し、復帰操作で再採点・記録の追加・snapshot変更を行わない。

### 4-3. #23で必要な実画面の接続を行う

対象: `src/App.tsx`、必要最小限の表示部品・スタイル。

- ID付きlessonで単元名・節名と節の見出しを表示する。`commonPrerequisites`だけを「必須前提」として表示する。`optionalReviews.fromRef`はその任意復習が表示されるリンク元・適用条件、`targetRef`はリンク先として扱い、現在節が`fromRef`に一致する項目だけを「任意復習」として表示する。節blocks内の`lessonRef`（分散節の数式にある`mathSymbol.lessonRef.targetRef`を含む）も文脈中の「任意復習」リンクにする。必須前提と任意復習を表示上も区別し、Σを必須前提として扱わない。
- 現行registryでは分散節の`commonPrerequisites`は`data-types`、`math-ratios-percentages`、`math-powers-roots`であり、Σは分散節の`optionalReviews`と数式内`mathSymbol.lessonRef`の任意復習参照である。両方のΣリンクを復習導線として実装・確認する。共通必須関係へΣを移すデータ変更はしない。
- practice／feedbackでは最新保存データから解決したinstance／attemptが分かる最小表示と、対応する教材への復習導線を設ける。#25が使うdraft更新・取得契約を接続する。
- 復帰stackがある場合に「1段戻る」を表示する。feedbackから元の`practice/{instanceId}`へ戻る導線は、feedbackの`attemptId`が指す同じ`instanceId`と保存済み`AnswerAttempt.answer`を使う。古いpractice draftと値が違う場合もattempt.answerを優先し、別instance生成や再採点をしない。
- 正常local dataにroute IDがない場合はそのIDの未登録案内を出す。attemptがsnapshotを参照できず`readLocalData()`が`invalid`になる場合は、単一のID欠落ではなく既存のデータ異常・回復フローへつなぐ。
- アプリ内リンクには「復習」「同一単元内の節移動」「通常nav」の意図を付け、履歴規則を適用する。feedbackからの同一practice再開は元のIDを使う専用の再開操作として扱う。
- 全教材本文、仮の採点フォーム、検証専用の本番UIは追加しない。未実装フォームの入力保持は状態契約のfixtureテストで確認し、#25の統合動作を確認済みとは扱わない。

### 4-4. フォーカスとスクロールを整理する

対象: `src/App.tsx`の既存見出しフォーカス・先頭スクロール処理。

- スクロール復元はアプリが担い、`history.scrollRestoration = 'manual'`とする。購読解除等で元の設定に戻せるようにする。
- 通常遷移は画面見出し、節遷移は該当節の見出しへフォーカスする。
- 復帰／Back／Forward／有効な状態のreloadは、対象の描画後に保存位置を復元する。フォーカス移動によるスクロールや既存の先頭移動で上書きしない。
- 遷移が続いた場合は古い復元処理を取り消す。すべての遅延したscroll保存／復元callbackは登録元のentry IDとrouteを捕捉し、実行時にも現在の`history.state`と一致する場合だけ位置を適用・保存する。不一致なら破棄し、Back／Forward後も旧entryの位置を現在entryへ保存しない。初回の状態なし表示は既存のアクセシビリティ方針を維持する。

### 4-5. テストを追加し、後続Issueへの契約を残す

- 構文テスト: 固定6route、root alias、各ID route、生成／解析、`instanceId`／`attemptId`に`/`・`#`・`%`・日本語・文字列`%2F`を含むroundtripと二重decode防止、空・余分segment、不正encode、未知の有効IDの構文受理、教材参照表記との区別。
- データ解決テストを分ける: 正常な保存データに対する未知instance／attempt IDはrouteの欠落として扱う。一方、存在しないsnapshotを参照する`AnswerAttempt`などschema不正データは`readLocalData()`の`invalid`として扱い、空データや未知IDに置き換えない。未知lesson、別単元のsection、未収録教材、未対応versionも確認する。
- 状態遷移テスト: 復習push、1段復帰、通常navによるstack終了、同一単元節移動によるstack維持、Back／Forward、reload、直接URL、不正version・route不一致・entry ID・不正frame、保留callbackの取消と旧entry scroll callbackの破棄。ブラウザー操作では通常の同一タブclickだけをアプリ遷移にし、修飾キー／新規タブ操作を妨げない。
- 保存順序のテスト: QuestionInstance／AnswerAttemptの保存成功直後にID URLを解決し、Back→Forward→reloadでも同じ保存IDと内容が表示されることを確認する。保存失敗時はID URLへ遷移せずdraftを維持する。resolverが古いReact `storedData`ではなく最新の`readLocalData()`を参照することも確認する。
- 保存済みsnapshot／attemptと複数entryのdraft・位置を持つfixtureを使う。明示feedback→practice再開では新entryの初期回答を指定attempt.answerとし、旧practice entry／他entryのdraftを書き換えない。Back／Forward／復帰frameでは各entry/frame自身のdraftを復元する。元snapshotを再利用し、遷移時にattempt追加・採点を行わず、既存のreadLocalData整合性検証は維持する。
- 新規テストを追加した場合は`package.json`の`check`へ登録する。テスト用fixtureは本番データへ混ぜない。

### 4-6. 設計文書を更新する

- `docs/MVP_DESIGN_DRAFT.md` §7のルーティング未決定記述を、採用するhash route・一時状態・操作別履歴規則へ更新する。
- #24〜26が利用するroute ID、入力状態の更新／復元契約、復習リンク・復帰操作の接続箇所と、今回未確認のフォーム統合範囲を記録する。

## 5. 受け入れシナリオと検証

### 多段復習の基準シナリオ

`#/feedback/{attemptId}` → `descriptive-statistics#variance` → `math-algebra-sigma#sigma` → `math-powers-roots#powers-roots` → `math-arithmetic#operations` → 「1段戻る」で逆順にfeedbackへ → 同じ`#/practice/{instanceId}`。

feedbackを起点に**4回の復習遷移**を行う。各地点のroute・表示節・位置、元の入力、instance／attempt参照、snapshot・採点済み記録の不変を確認する。

分散節からΣ節へは、必須前提ではなく`optionalReviews.fromRef`に対応する`targetRef`と、分散節formula内の`mathSymbol.lessonRef.targetRef`の任意復習リンクで移動する。2つのリンクをそれぞれ独立に選び、どちらからも`math-algebra-sigma#sigma`へ到達することを確認する。Σ節から平方根節、平方根節から四則演算節は、それぞれregistryに定義された共通前提リンクを使う。表示上もこの必須前提と任意復習の区分が保たれる。

### 保存直後のID route

新規instanceまたはattemptを保存し、成功結果でAppの保存データ表示を更新してから対応するID付きURLへ移動する。route coordinatorはそのentryごとに`readLocalData()`を一度だけ呼び、その同じ読込結果でIDを確認して画面表示にも渡す。古いReact `storedData`には依存しない。保存成功→ID URL→Back→Forward→reloadの各段階で同一のinstance／attempt、answer、採点結果を表示する。書込失敗時はID URLへ移動しない。この順序を#25の受入引継ぎ項目とし、feedbackへの遷移を含む#26でも同じ保存契約を使う。

### 自動検証

- 上記シナリオを状態遷移テストで実行し、4つのframeを順に復帰できる。`optionalReviews`リンクとformula内`mathSymbol.lessonRef`リンクを別々に操作してもΣ節へ到達でき、分散→Σは任意復習、以降の平方根・四則演算は共通前提として表示・遷移される。
- #25の受入引継ぎとして、保存成功→ID URL→Back→Forward→reloadの順序で新しい保存データを同一の一回読込結果から解決・表示する。feedback保存を伴う#26も同じ契約を使う。書込失敗ではURLを進めず、draftと現在画面を保つ。
- `instanceId`／`attemptId`の`/`、`#`、`%`、日本語、文字列`%2F`を含む生成URLと解析結果が一致し、`%2F`がID内の文字列として保たれる。
- 入力・位置の変更直後にBack／Forward／reloadする境界ケースでも、反映済みの状態が別entryへ誤保存されない。履歴移動後に旧entryの位置を現在entryへ保存せず、古いentry IDを持つ遅延callbackは新entryを更新しない。
- 戻る操作と通常nav・節移動を交ぜても、定義したstack規則が維持される。
- 正常な保存データで未知IDを指定したケースと、参照snapshot欠落などでlocal data全体が破損扱いとなるケースを別々に試す。前者はID欠落の回復導線、後者はデータ異常案内を表示する。
- 直接URLや履歴状態破損でも、有効なURLを解決できる。ID／保存データを解決できない場合はそれぞれの理由に合った回復導線が出る。
- `npm run check`、`npm run build`、`git diff --check`を通す。

### 実ブラウザー確認

production previewで、ID URLの直接表示・reload、保存直後のID遷移とBack／Forward、多段復習と復帰、素早い連続遷移、同一画面種別のID切替、フォーカス・スクロール、未知IDと破損データそれぞれの案内を確認する。320 CSS px幅とキーボード操作を含める。

回答・採点内容の保持はfixtureによる状態契約テスト、実ブラウザーでは実装済みのナビゲーション・表示位置・フォーカスを確認する。#25の回答フォーム、#26のフィードバック表示との統合は後続Issueの検証項目として残す。

## 6. 対象外

ルーターライブラリへの移行、全教材本文、回答フォーム・採点UI、完全なフィードバック画面、復習イベント記録、local dataのschema変更、クラウド同期、汎用の履歴フレームワーク、別ストレージへの一時状態保存は含めない。

## 7. 計画レビューと追加修正

計画レビューを1回実施し、以下を反映した。

1. **保存タイミング:** 遷移前だけの保存をやめ、入力・閲覧位置の変更時に現在entryへ反映する。スクロール復元の担当と古い処理の取消も固定した。
2. **履歴との対応:** 明示復帰は復帰先を新entryへpushする方式とし、Back／Forward・通常nav・節移動ごとの規則を定めた。
3. **検証範囲:** feedback起点の4回の復習遷移を明記し、状態契約のfixtureテストと未実装UIの統合検証を区別した。
4. **責務の整理:** 構文とID存在確認のテストを分離し、route型変更の呼び出し元・effect依存も変更対象に含めた。不正な一時状態だけを破棄し、有効URLは通常解決する。

今回のユーザー指摘を受け、同一計画セッション内で次を具体化した（追加のplan reviewerレビューは行っていない）。

5. **前提と復習参照:** Σは必須前提ではない。`optionalReviews.fromRef`が適用条件、`targetRef`が行先であり、両方の参照元（任意復習定義・formula内`lessonRef`）からリンクを確認する。
6. **保存からURL解決:** 保存成功後に戻り値で表示stateを更新してURLへ進む。route coordinatorは最新`readLocalData()`を一度読み、その結果を存在確認と表示で共用する。React state commitを待たず、保存失敗時は遷移しない。
7. **ID roundtrip:** `/`、`#`、`%`、日本語、文字列`%2F`を含め、segment単位のencodeとpath分割後一度だけのdecodeを確認する。
8. **navigationとscroll:** 既存hrefを維持し、通常同一タブ操作のintentを中央遷移へ渡す。各entry IDとrouteで遅延位置callbackを守り、履歴移動後の旧位置混入を防ぐ。
9. **回答の正本と異常データ:** 明示feedback→practiceは指定attempt.answerを新entryの初期回答に使い、旧entryのdraftを変えない。Back／Forward／frame復帰は各entryのdraftを保つ。未知IDとlocal data全体invalidを分け、既存整合性検証を維持する。

## 8. 根拠

- `docs/P2_IMPLEMENTATION_PLAN.md`: #23の依存関係、#24・#25への先行関係。
- `docs/MVP_DESIGN_DRAFT.md` §5〜8: snapshot／attempt／review event、前提リンク、多段復習と復帰シナリオ。
- `docs/curriculum/PREREQUISITE_MAP_DRAFT.md`: 安定ID・節アンカー、回答・表示位置の保持要件。
- `docs/TECH_STACK_DECISION.md`: 既存のスクロール・フォーカスに関する検証事項。
- `src/resolve-screen.mjs`／`.d.mts`、`scripts/resolve-screen.test.mjs`: 現行は6固定routeの画面種別を返すresolverと基本テストで、ID付きrouteは未対応。
- `src/App.tsx`: `storedData`は起動時に`readLocalData`で初期化し、現状はimport／migration時にReact stateを更新する。hash購読、画面選択、見出しフォーカス、先頭スクロール、各画面のプレースホルダーがある。
- `src/local-data.mjs`／`.d.mts`: `AnswerAttempt`は`attemptId`、`instanceId`、`answer`、採点結果、日時を持つ。読込時にattemptの参照先instanceとanswer・採点結果の整合性を検査し、参照snapshot欠落ならlocal data全体をinvalidにする。`saveLocalData`は成功時に保存済み`data`／`raw`を返す。
- `src/lesson-registry.mjs`: 分散節の共通前提・任意復習・数式中Σリンクの各実データ。

計画作成・レビュー・今回の追記段階では実装、テスト実行、実ブラウザー確認は行っていない。履歴・スクロールの実動作と後続UIとの統合は、上記手順に沿って実装時に検証する。

---
