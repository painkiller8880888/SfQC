# 技術選定と静的アプリの初期足場

> 対応Issue: [#5](https://github.com/painkiller8880888/SfQC/issues/5)
> 確認日: 2026-10-22

## 採用した構成

React、TypeScript、Vite、npmを採用する。Reactは後続Issueで定義する複数画面の構成に使え、TypeScriptは教材・問題データの型を扱える。プロジェクト憲章の第一候補に沿い、画面間で共通する表示を使いやすいことを選定理由とした。

vanilla TypeScriptは初期表示が小さく、実行時依存もない。一方で、このプロジェクトでは複数画面と共通UIを後から整備するため、Reactの構成を採用する。Issue #5では画面導線や教材機能は作らない。

## 学習データの保存とJSONバックアップ（Issue #9）

P1の`QuestionInstance`集合は、アプリ専用のlocalStorage固定キー`sfqc:local-data`に保存する。保存値とJSONバックアップは`{ "schemaVersion": 1, "questionInstances": [...] }`の同じ形式とし、1回の保存・復元は最大500件、JSONはUTF-8で最大1 MiBとする。`instanceId`は集合内で重複させず、snapshotの検証と復元には`restoreQuestionInstance`を使う。`AnswerAttempt`は含めない。version 1以外は拒否し、自動migrationはしない。

Issue #9の対象は少量の出題snapshotだけなので、ブラウザ標準APIで同期的に扱え、依存追加や非同期DB管理を必要としないlocalStorageを選んだ。1 MiB/500件の上限で1回に扱うデータ量を制限する。localStorageは利用者のブラウザ操作や設定で消去される場合があるため、長期保持には利用者がJSONバックアップを保管する。保存領域はoriginごとに分かれ、複数タブ間の厳密な排他制御は行わない。回答履歴などP2でデータ量が増えるときはIndexedDBを再評価する。

Issue #9のproduction previewを2026-10-22にWindows版Vivaldiのプライベートウィンドウで確認した。fixtureのJSONを読み込み、再読み込み後も2件が残ること、書き出した1,917 bytesのJSONがfixtureと一致すること、書き出しJSONの再読込で置換確認が出ることを確認した。保存状態異常の検証にはproduction previewの`dist/`にコミットしない一時fixtureページを置き、同一originのプライベートプロファイルだけに試験値を作成した。不正JSONと`schemaVersion: 2`の各ケースで、起動時の警告・件数エラー・通常のexport無効化、fixtureから有効JSONを選んだ際の専用置換確認、Escapeによるキャンセル通知を確認した。両ケースともキャンセル後に起動時警告と件数エラーが残り、fixtureページで読み出した生の保存文字列も投入時と完全一致した。さらにversion 2の状態から有効fixtureを確認後に復元し、成功通知・2件表示・再読み込み後の2件維持まで確認した。一時fixtureページとJSONは検証後に削除した。ライブ領域は画面上に常設され、空状態で余白が出ず、キャンセル・復元後の通知が表示されることを確認したが、実スクリーンリーダーでの音声読み上げは確認していない。ズーム300%（約310–320 CSS px相当）でもデータ操作パネルの横はみ出しがなく、アプリ起因の外部通信もなかった。

## 学習履歴の保存とJSONバックアップ（Issue #22）

固定キー`sfqc:local-data`を維持し、schema v2に`questionInstances`、`answerAttempts`、`reviewEvents`を保存する。既存v1はpure read/export後に描画後effectから昇格し、通常saveは保存開始rawと書込直前rawを比較したうえで、既存配列要素の順序・内容を保つ追記だけを許す。利用者が確認したJSON importは単一置換として扱い、破損・未対応データや書込失敗時には通常saveから上書きしない。v1/v2・import/exportを含むJSON上限をUTF-8 2 MiB、snapshot上限を500件とする。quota失敗時に履歴を自動削除せず、手動整理は未編集backupの保管後に複製JSONを参照整合性を保って編集し、確認付きimportする。browser quotaと最終read後から`setItem`までの複数tab競合は保証しない。`ReviewEvent`は誤答起点の明示訪問記録であり、実triggerはIssue #26、訪問数としての集計はIssue #27が担う。学習記録を外部送信しない。

Viteの公式`react-ts`テンプレート（create-vite 9.3.1）から、起動に必要な構成を使った。デモ画面、生成ロゴ・画像、テンプレートのfaviconファイル、Oxlint設定と依存は削除した。依存の確定バージョンは`package-lock.json`に固定する。

## 実行環境と主要依存

確認環境はNode.js 24.18.0、npm 12.0.2。使用したVite 8.3.5および`@vitejs/plugin-react` 6.1.2のNode要件は `^20.19.0 || >=22.12.0` で、確認環境は要件を満たす。新しい環境ではREADMEの条件を満たすNode.jsを用意し、`npm ci`を使う。

| 区分 | package | lockfileの版 | ライセンス |
| --- | --- | --- | --- |
| production | react | 19.3.1 | MIT |
| production | react-dom | 19.3.1 | MIT |
| production推移依存 | scheduler | 0.28.0 | MIT |
| build-only | vite | 8.3.5 | MIT |
| build-only | @vitejs/plugin-react | 6.1.2 | MIT |
| build-only | typescript | 6.0.3 | Apache-2.0 |
| build-only | @types/react | 19.3.0 | MIT |
| build-only | @types/react-dom | 19.3.0 | MIT |
| build-only | @types/node | 24.19.2 | MIT |

依存パッケージのライセンスは、lockfileで解決した各パッケージの`package.json`と同梱`LICENSE`を確認した。productionの3パッケージは同一のMITライセンスで、配信物に含めるため[third-party-licenses.txt](../public/third-party-licenses.txt)を配信する。build-only依存は`dist/`に含めない。lockfileのbuild-only推移依存にはApache-2.0、MPL-2.0、ISC、BSD-3-Clauseのパッケージもあるが、これらはproduction bundleに含まれない。

## GitHub Pagesのサブパスとネット切断

Viteの`base`を`/SfQC/`に設定した。公式の静的配信手順は、リポジトリサイトでは`/<REPO>/`を`base`に設定するよう案内している。`npm run build`後に、自己検査が日本語HTML、`/SfQC/assets/`配下のJavaScript・CSS参照、および参照先ファイルの存在を確認する。

実際のpreview確認結果:

- URL、画面表示、直接アクセスと再読み込み: `http://127.0.0.1:4175/SfQC/` を、隔離した一時プロファイルのChrome headlessで開いた。日本語の見出し・説明文・ライセンスリンクを確認し、オンライン状態での直接アクセスと再読み込み後も同じ画面が表示された。
- HTML・JavaScript・CSSのHTTP応答とContent-Type: 直接アクセスと再読み込みを通じて、HTMLは200 `text/html`、`/SfQC/assets/` 配下のJavaScriptは200 `text/javascript`、CSSは200 `text/css`（1,002 bytes）。両回ともHTMLはローカルのJS/CSSを各1件参照した。ブラウザが既定で要求するfaviconの404を避けるため、HTMLに外部通信を伴わない小さなinline SVG data URIを指定した。
- console/network: Chrome DevTools Protocolで独立したブラウザのconsole、例外、HTTP応答、通信失敗を記録した。オンラインの2回の表示でページ/document、JS、CSSの6要求は全て200で、失敗要求・HTTP error・console error・未捕捉例外・browser log errorはいずれも0件、ページ起因の外部HTTP要求も0件だった。favicon data URI自体もネットワーク要求を行わない。
- 狭い画面幅: viewport 320×800 CSS pxで、`lang="ja"`、`main`、ページ見出しを確認した。document/bodyの横幅はそれぞれ320pxで、水平overflowなし。カード内の日本語見出し・説明・ライセンスリンクも画面内に折り返されて表示されることをスクリーンショットで確認した。
- 読込後にブラウザをofflineへ切り替えた挙動: 独立Chromeで最初にページをオンライン読込し、キャッシュを無効にした状態でCDPのnetwork offlineを有効にした。再読み込み前は現在の文書と見出しが残ったが、再読み込みは `ERR_INTERNET_DISCONNECTED` になりブラウザのエラーページが表示された。offlineの再読み込みや初回表示は保証せず、Service Workerも導入していない。

Issue本文の受入条件は、技術判断・ライセンス・bundle・`/SfQC/` asset参照・ネット切断の記録、clean install/build/静的検査、およびbase path previewでのasset取得である。Issueコメントの詳細実装計画は、この確認に加え、失敗要求・実行時error/外部通信がないこと、狭いviewportの可読性、ロード後のブラウザoffline挙動も要求している。上記の独立Chrome試験で両方を確認した。

Service WorkerやPWAは導入していないため、ブラウザに読み込み済みの画面が表示されるかと、offlineでの初回表示・再読み込みは分けて記録する。GitHub Pagesへの実デプロイはIssue #6の範囲である。

## 画面遷移と未知URL（Issue #7）

画面の切り替えにはURLのhash（`#/...`）を使う。GitHub Pagesでは6画面とも同じ`/SfQC/`のHTMLを読み込み、画面種別はブラウザ内で決めるため、サーバー側のroute rewriteや追加router依存がいらない。通常の`<a>`リンクでhashを変えるので、戻る・進むもブラウザ履歴に沿って動く。

| 画面 | ローカル／公開URL |
| --- | --- |
| 学習マップ | `/SfQC/#/map` |
| 単元解説 | `/SfQC/#/lesson` |
| 演習 | `/SfQC/#/practice` |
| 解答・フィードバック | `/SfQC/#/feedback` |
| 進捗 | `/SfQC/#/progress` |
| データ管理 | `/SfQC/#/data` |

空hashと`#/`は学習マップを表示する。既知の6 route以外のhashは「画面が見つかりません」として学習マップへのリンクを出す。未知HTTPパス（例：`/SfQC/unknown`）には静的な`404.html`を使い、同じ学習マップURLへ戻るリンクを置く。HTMLを再利用する場合に教材ID・問題ID・queryを解釈する仕組みはまだ設けない。`ScreenKind`は画面種別を表し、`lessonId`・`sectionId`は教材内の参照を表す。既存の`lessonId#sectionId`はURL routeではなく教材内参照表記として維持する。将来のroute例は`/SfQC/#/lesson/descriptive-statistics/variance`で、resolverが画面種別に加えて教材ID・節IDを返す形を検討できるが、今回は実装しない。

画面遷移は通常のhashリンクと`hashchange`で扱う。`history.pushState()`を導入する場合は`hashchange`が発火しないため、履歴イベントの購読も含めて遷移処理を再設計する。

通常のhashリンクで画面種別が変わる現在のP1骨格では、見出しにフォーカスしてからページ先頭へ移動する。これは画面単位の仮の動作であり、将来の教材内移動や復習からの復帰に一律で適用しない。履歴スクロール回帰は2026-10-22にproduction previewのChatGPT IAB、Windows NT 10.0.26300.0 x64、320×480 CSS viewportで確認した。IABの正確なブラウザーbuild versionは取得できなかった。地図と解説は自然にスクロールでき、各操作前にwheel入力で地図scrollY=264（scrollHeight=744）、解説scrollY=325（scrollHeight=805）にした。修正前の2 cycles・8遷移ではlate測定で5件が失敗し、最後のBack失敗はlate測定から43.4秒後もh1が画面外だった。画面切替時のh1 focusは保ち、次のtimer turnで`scrollTo(0, 0)`する局所修正を加えた。最終10 cycles（地図の実リンク→Back→Forward→Back）40遷移では、各遷移後のactiveElementはh1だった。遷移先hashとh1文言が一致した最初の読み取り専用poll（5ms間隔、操作開始から8–82ms）では、通常リンク遷移10件に保存位置が残り、scrollY=264、h1 top=-41.44pxだった。約500ms後（実測500–516ms）のlate sampleは40/40でscrollY=0、h1 top=222.56px、bottom=261.44pxとなり、viewport内に収まった。IABの読み取り専用評価環境ではrequestAnimationFrameを利用できないため、early sampleは最初に一致を観測したpollであり、最初のpaintそのものや厳密な「2rAF+500ms」ではない。教材内の`lessonId#sectionId`、本文の読書位置、設問入力と復習前の学習状態を復元する制御は、後続課題で別途設計する。

ローカルでは`npm run dev`または`npm run preview -- --host 127.0.0.1`を起動し、上記6 URLを直接開く。`npm run check`はURL解決のNode標準テストも実行し、`npm run build`は`dist/404.html`と復帰リンクの存在も検査する。Vite previewでunknown HTTP pathがどのHTMLを返すかはGitHub Pagesの404挙動を保証しないため、公開後に`/SfQC/unknown`を直接開いて確認する。Issue #7はPR本文に`Refs #7`を記し、自動closeキーワードは使わず、公開確認と結果記録後に手動で閉じる。

実装時のローカル確認（2026-10-22）では、devとproduction previewの両方で6画面を直接開き、再読み込み後も見出しとタイトルがURLに一致することを確認した。devのReact StrictMode初回表示では、ロード直後と750ms後のactiveElementがBODYで、focusを奪わなかった。画面遷移時は見出しへフォーカスし、ページ先頭へ戻る。リンク操作での遷移、戻る・進む、Enterキーでのリンク操作と可視フォーカス、未知hashからの学習マップ復帰も確認した。静的`404.html`自体はpreviewで直接表示し、復帰リンクの遷移を確認した。6画面と404ページは320 CSS px幅で横方向にoverflowしない。公開サイトの未知HTTPパスはまだ確認していないため、deploy後に別途確認する。確認環境はNode.js 24.18.0、npm 12.0.2で、`npm run build`は型検査・URL resolverテスト・404出力検査を含め成功した。

フォーカス受入確認では、初回表示時にfocusを奪わないこと、画面遷移後に`h1:focus`の輪郭線が見えること、スクロール位置がフォーカスと独立して先頭になることを確認する。production previewのIAB、320×480 viewportで、初回表示のactiveElementが`BODY`の状態から最初のTabで`本文へ移動`ボタンが可視focusになった。EnterとSpaceはいずれもhashを変えずにh1へフォーカスし、3pxの輪郭を表示して見出しへスクロールした。続くTabはヘッダーに戻らず本文の`単元解説へ`リンクへ進んだ。ボタンにはhrefがなく、未知hashを新しいタブで開くリンクにはならない。React StrictMode初回focusの確認はproduction previewと分け、devで行った。演習では問題文と回答入力の枠が別の見出し・領域として識別できることも確認する。

## production bundleサイズ

`dist/assets`のproduction JavaScript・CSSについて、各ファイルのraw byte数とNode.js標準`zlib.gzipSync()`（既定圧縮設定）によるgzip byte数を測定した。合計のgzip値は各ファイルを個別に圧縮した値の和であり、一つのgzip streamに結合した場合のサイズではない。Vite buildログの圧縮サイズ表示とは別に、この方法で記録する。

| asset | raw bytes | gzip bytes |
| --- | ---: | ---: |
| `index-CEI_e6By.js` | 220,155 | 68,316 |
| `index-CksttCMJ.css` | 1,002 | 562 |
| 合計 | 221,157 | 68,878 |

## コマンド

READMEの`npm ci`、`npm run check`、`npm run build`、`npm run preview -- --host 127.0.0.1`で導入・型検査・build・previewを再現できる。`build`は型検査とproduction build後に生成HTMLのasset参照を確認する。`vite preview`はproduction buildのローカル確認用で、production serverとして使うものではない。実際のGitHub Pages公開はIssue #6の範囲である。別のテストフレームワークは追加していない。

## Issue #46/#47 React Flow + Dagre

Issue #46では、registryから導出した共通必須前提グラフをReact Flowで表示し、Dagreで配置する独立PoCを検証した。Issue #47でこの描画を既存`#/map`へ統合し、productionでは全画面グラフと既存`LessonMap`を使う教材一覧を切り替えられる。`@xyflow/react` 12.12.0と`@dagrejs/dagre` 3.1.3は2026-10-28にnpmの安定版とMITライセンスを確認し、production `dependencies`として固定した。React FlowはReact/React DOM 17以上をpeer dependencyとし、現行React 19を満たす。上流情報は[React Flow on npm](https://www.npmjs.com/package/@xyflow/react)、[React Flow repository and license](https://github.com/xyflow/xyflow/tree/main/packages/react)、[Dagre on npm](https://www.npmjs.com/package/@dagrejs/dagre)、[Dagre repository and license](https://github.com/dagrejs/dagre)を参照。ランタイムと推移依存のライセンスは[`public/third-party-licenses.txt`](../public/third-party-licenses.txt)に記録した。

GitHub Pagesは引き続き既存`index.html`だけをentryにし、別のPoC HTMLは含めない。グラフのviewportと選択はAppのメモリ内でroute・表示切替をまたいで保持する。再表示時のノード座標はDagre初期配置へ戻る。配置の永続化は後続Issue #51の範囲とする。

## 参照資料

- [Vite Getting Started](https://vite.dev/guide/)
- [Vite: Deploying a Static Site](https://vite.dev/guide/static-deploy) — GitHub Pages repository siteでは `base: '/<REPO>/'` を設定し、`vite preview`はローカル確認に使う。
- [Vite公式React TypeScript template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts)
- [React license](https://github.com/react/react/blob/main/LICENSE)
- [Vite license](https://github.com/vitejs/vite/blob/main/packages/vite/LICENSE.md)
- [TypeScript license](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt)
