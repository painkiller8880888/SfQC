# Issue #5 再開メモ（ローカル専用）

> このファイルは停止時点から再開するためのローカルメモです。将来のPRには含めないでください。冒頭のGit状態・残作業は最初の停止時点の履歴で、最新のQA結果は末尾の「残QAの完了」を参照してください。PR作成前にこのファイルをコミット対象から外して削除してください。

## 目的と指示

GitHub issue #5「技術スタックの選定と最小の起動可能な足場」を実装し、最終的にPRを作成する依頼です。停止指示を優先し、現時点では実装・検証を完遂していません。初学者向けQC検定2級教材で、解説→演習→誤答フィードバック→復習→再演習の学習サイクルを中心にします。図はコード描画、生成画像・生成アセットは使わず、GitHub Pages上でブラウザ内完結を目指します。

適用済みの指示は `.codex/config.toml`、リポジトリの `AGENTS.md`、`docs/`、Ponytail full skill です。モデル指定は root が gpt-6.1-sol/xhigh、worker が gpt-6-luna/max、plan reviewer が gpt-6-astra/high/read-only。計画タスクに対する plan reviewer のレビューはこの計画セッション内で1回完了済みで、再依頼しません。Orchestrator は計画・委譲・評価を担い、実作業はworkerが行います。

## Git の状態

- ブランチ: `codex/issue-5-tech-stack`（`main` の `2c15150` から作成）
- 停止時点の tracked 変更: `README.md`
- 停止時点の untracked 追加: `.gitignore`, `docs/TECH_STACK_DECISION.md`, `index.html`, `package-lock.json`, `package.json`, `public/`, `scripts/`, `src/`, `tsconfig.app.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`
- commit / push / PR: いずれも未実施、PR未作成。
- 当初作成した一時的な公式テンプレートディレクトリは、workspace内にあることを確認後削除済みです。

再開直後に `git status --short --branch` を実行し、他者の変更がないか確認してください。このメモ自体はuntrackedで、将来のPRに入れないでください。

## 保存済みの実装

React + TypeScript + Vite の最小起動足場を追加しました。GitHub Pages の `/SfQC/` サブパスを設定し、日本語ページ、基本の semantic HTML、スタイル、READMEの起動・型検査・build手順を含みます。`npm run check` はTypeScript型検査、`npm run build` はVite buildの後に依存追加なしの小さなassert型 build self-checkを実行します。self-checkは生成HTMLの `lang="ja"` と `/SfQC/assets/` 参照、参照先ファイルの存在、第三者ライセンスファイルの存在を確認します。後続issueの機能やテストフレームワークは追加していません。

変更済みファイルは `.gitignore`, `package.json`, `package-lock.json`, `index.html`, `src/App.tsx`, `src/main.tsx`, `src/index.css`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `scripts/check-build.mjs`, `public/third-party-licenses.txt`, `README.md`, `docs/TECH_STACK_DECISION.md` です。すべて保存済みです。

## 完了した検証と判明事項

- 環境: Node `v24.18.0`, npm `12.0.2`; `vite@8.3.5` の実依存要件は `^20.19.0 || >=22.12.0`。
- `npm install` と `npm ci` は成功。npm audit は脆弱性0件。
- `npm run check` は成功。
- `npm run build` は成功（2回）。Vite 8.3.5、16 modules transformed。
- build出力の測定: JS 220,155 bytes（gzip 68,316 bytes）、CSS 1,002 bytes（gzip 562 bytes）、合計 raw 221,157 bytes、個別gzip合計 68,878 bytes。
- production依存のライセンス: `react@19.3.1`, `react-dom@19.3.1`, `scheduler@0.28.0` はMIT。build-onlyの直接依存はVite/plugin-react等にMIT、TypeScriptにApache-2.0等。build-only推移依存にはApache-2.0、MPL-2.0、ISC、BSD-3-Clause等があります。`public/third-party-licenses.txt` はproduction依存のライセンス通知を含み、ReactのMIT本文を実ファイルと照合済みです。
- 一時production previewへのHTTP確認は成功: `/SfQC/` が200 `text/html`、JSが200 `text/javascript`、CSSが200 `text/css`（Content-Length 1002）、ライセンス通知が200 `text/plain`。HTML内の外部 `src` / `href` は0件。`/SfQC/` の直接reloadも200 `text/html`。
- 実ブラウザでの表示・console/network確認、狭いviewport確認、ブラウザofflineとoffline reloadは未検証です。ローカルhostのブラウザ遷移はCDP `Page.navigate` timeout、NodeRepl fetch は `EACCES` で失敗しました。これらを成功と扱わないでください。
- `docs/TECH_STACK_DECISION.md` にpreview/offlineの結果欄とbundle表の未記入placeholderが残っています。上記の実測値を反映し、未確認項目は未確認と記してください。

## 停止時のプロセス

Vite preview session 78333 に Ctrl-C を送り、終了応答（exit code 1）を確認しました。一時preview用PowerShell起動処理は `finally` で終了。NodeRepl起動プロセスPID 15808にはSIGTERMを送りました。停止後の最小確認で `Get-Process -Id 15808` が「process not found」を返したため、PID 15808 は終了済みです。停止指示後のサーバー起動は行っていません。

## 再開時の手順

1. リポジトリへ移動し、ブランチと他者変更を確認します。

   ```powershell
   Set-Location 'C:\Users\P1569\Desktop\SfQC'
   git status --short --branch
   git diff --check
   ```

2. このメモと変更内容を照合し、`docs/TECH_STACK_DECISION.md` のplaceholderを実測値と確認できた範囲に沿って完成させます。ライセンスと技術選定の記録を見直し、ローカルメモ `ISSUE_5_HANDOFF.md` はPRに含めないでください。

3. 依存導入とbuildを再現します。

   ```powershell
   npm ci
   npm run check
   npm run build
   ```

4. production previewを起動し、実ブラウザで `/SfQC/` の描画、console/network、狭いviewport、JS/CSS取得とContent-Type、直接reloadを確認します。offline挙動はロード後に通信を切った状態での操作・reloadを実測し、service workerがないため初回offline起動を保証しない点を区別して記録します。検証後previewを停止します。

   ```powershell
   npm run preview -- --host 127.0.0.1 --port 4175
   ```

5. 最終差分、生成物、文書と測定の整合性を確認し、rootに結果を返します。commit / push / PR作成はrootのレビュー後のfollowupで行います。PR作成後は必ず Codex app の `attach_artifact` を呼びます。

## 停止時の残作業・ブロッカー

主な残作業は技術選定記録のplaceholderを埋めること、ブラウザ/オフラインで未検証の範囲を可能な方法で検証または明記すること、`git diff --check` を含む最終確認、rootの評価後にcommit/push/PRを行うことです。停止時点で継続を妨げる重大なブロッカーは確認されていませんが、ブラウザからlocalhostへアクセスする手段が未解決です。秘密値は記録していません。

## 2026-10-22 再開後の結果

- Issue #5とコメントの受入条件を再取得。READMEの現在の段階説明を更新し、`docs/TECH_STACK_DECISION.md`のbundle/preview placeholderを実測結果で埋め、Vite・テンプレート・ライセンスの公式参照リンクを追加。
- 通常権限の`npm ci`はnpm registryの名前解決で`ENOTFOUND`。許可済みhost権限で再実行し、25 package追加、監査0 vulnerabilitiesで成功。続く`npm run check`と`npm run build`も成功。build self-checkを含む。
- build出力はJS 220,155 bytes / `gzipSync` 68,316 bytes、CSS 1,002 / 562 bytes、合計raw 221,157 / gzip合計 68,878 bytes。
- Chromeで`http://127.0.0.1:4175/SfQC/`を表示し、日本語見出し・本文・ライセンスリンクと直接reloadを確認。HTML 200 `text/html`、JS 200 `text/javascript`、CSS 200 `text/css`（1,002 bytes）。HTMLのscript/style参照は`/SfQC/assets/`内に2件、外部URL参照0件。アプリソースにfetch/XHR/WebSocket/外部URLは見つからない。
- 接続中のbrowser APIではviewport override、offline emulation、console/networkログを利用できず、狭幅表示・実際のbrowser offline・console error/failed requestの確認は未完了。代替として表示後にpreview serverを止め、タブの描画が残ること、reloadで`ERR_CONNECTION_REFUSED`になることを確認した。文書ではbrowser offlineの実測と誤認しないよう区別。
- preview serverはCtrl-Cで停止済み。最終`git diff --check`成功。branchは`codex/issue-5-tech-stack`、HEADは`2c15150`、未commit/未push/PRなし。`ISSUE_5_HANDOFF.md`はローカル専用のuntrackedメモで、PRに入れない。
- root評価後に残る作業は、可能なら狭幅・実offline・console/networkを確認すること、最終差分をreviewすること、local memoをPR対象から外してcommit/push/PRを作成すること（PR本文に`Closes #5`、作成後に`attach_artifact`）。

## 2026-10-22 残QAの完了（最新状態）

- Issue本文の受入条件は、技術判断・ライセンス・production bundle・`/SfQC/` asset参照・ネット切断結果の記録、clean install/build/静的検査の成功、base path previewでのasset取得。Issueコメントの詳細計画は追加で、runtime error・失敗要求・外部CDN/APIなし、狭い画面幅での可読性、読込後のブラウザoffline確認を指定している。
- Browser Use API（`computer-use` skillの `api.md`）はWindowsアプリの画面・accessibility操作を提供し、viewport override、browser network emulation、console/networkログのAPIはない。独立した一時Chromeで代替した。computer-use skillの`SKILL.md`、`guidance.md`、`api.md`、`confirmations.md`を確認し、既存ブラウザを操作せず、公式Chromeのheadless・隔離プロファイルとNode標準WebSocketによるCDPを使った。Playwright/Selenium等の既存パッケージはなく、新規依存は追加していない。
- 最初の測定でChrome既定の`/favicon.ico` requestが404になるのを検出した。`index.html`にinline SVG data URIのiconを指定し、実際のfavicon requestをなくした。画像ファイルや外部通信は追加していない。
- 修正後の320×800 CSS px viewportで日本語画面を描画。`documentElement.clientWidth`, `documentElement.scrollWidth`, `body.scrollWidth`はすべて320px、水平overflowなし。DOM・スクリーンショットとも、見出し、本文、ライセンスリンクが折り返され読めることを確認。
- `/SfQC/`の直接表示とonline reloadを実施。document×2、JS×2、CSS×2の6要求は全て200で、Content-Typeは順に`text/html`、`text/javascript`、`text/css`（CSS 1,002 bytes）。console error、未捕捉例外、browser log error、online HTTP error、online failed request、外部HTTP requestはいずれも0件。
- fresh Chrome profile・HTTP cache無効の状態でオンライン読込後、CDP `Network.emulateNetworkConditions(offline=true)`を適用。reload前はdocumentと見出しが表示されたままだが、offline reloadは`ERR_INTERNET_DISCONNECTED`でbrowser error pageになった。offline初回起動・再読み込みは保証せず、Service Workerもなし。検証後にChromeとVite previewを終了し、port 4175/9223にlistenerがないことを確認。Chrome PID 4200、preview PID 10608も終了を確認。
- favicon修正後に`npm run check`、`npm run build`（check/build self-check込み）、`git diff --check`が成功。Node `v24.18.0`、npm `12.0.2`。依存lockfileは変更なし。実ブラウザの観測結果を`docs/TECH_STACK_DECISION.md`へ記録。
- 前回QAの一時プロファイル・ログ・スクリーンショット・CDP scriptは、Chromeとpreviewの終了を確認してからtask固有のTempディレクトリごと削除済み。
- QA完了直後はbranch `codex/issue-5-tech-stack`で未commit・未push・PR未作成だった。plan reviewerによるレビューは既に1回完了で再依頼しない。

## 2026-10-22 PR発行後の最新状態

- 最終確認した`origin/main...HEAD`は15ファイル、1,279追加・1削除。明示した15ファイルだけをstageし、ローカル専用メモ`ISSUE_5_HANDOFF.md`、`node_modules/`、`dist/`、`.tmp/`およびQA一時ファイルはcommitに含めていない。
- commit: `c762af417e4a717b25536be0ce23b4289e335d2c` (`feat: add minimal Vite app foundation for #5`)。通常の非強制pushで`origin/codex/issue-5-tech-stack`へ送信し、upstreamを設定した。
- PR #10: [Add minimal React and Vite app foundation](https://github.com/painkiller8880888/SfQC/pull/10)、base `main`、head `codex/issue-5-tech-stack`、head SHAは上記commit、GitHub上でopenかつmergeable。本文に`Closes #5`と検証結果を記載し、Codexの`attach_artifact`成功。
- PR作成後のローカル状態は`codex/issue-5-tech-stack...origin/codex/issue-5-tech-stack`で一致し、未追跡はこのローカル専用handoffメモだけ。`git diff --check origin/main...HEAD`成功。preview/CDP port 4175/9223にlistenerはない。
- PRはopenのまま。merge、Issue手動close、Pages deployは行っていない。実公開/CIは#6の範囲。
