# 技術選定と静的アプリの初期足場

> 対応Issue: [#5](https://github.com/painkiller8880888/SfQC/issues/5)
> 確認日: 2026-10-22

## 採用した構成

React、TypeScript、Vite、npmを採用する。Reactは後続Issueで定義する複数画面の構成に使え、TypeScriptは教材・問題データの型を扱える。プロジェクト憲章の第一候補に沿い、画面間で共通する表示を使いやすいことを選定理由とした。

vanilla TypeScriptは初期表示が小さく、実行時依存もない。一方で、このプロジェクトでは複数画面と共通UIを後から整備するため、Reactの構成を採用する。Issue #5では画面導線や教材機能は作らない。

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

## production bundleサイズ

`dist/assets`のproduction JavaScript・CSSについて、各ファイルのraw byte数とNode.js標準`zlib.gzipSync()`（既定圧縮設定）によるgzip byte数を測定した。合計のgzip値は各ファイルを個別に圧縮した値の和であり、一つのgzip streamに結合した場合のサイズではない。Vite buildログの圧縮サイズ表示とは別に、この方法で記録する。

| asset | raw bytes | gzip bytes |
| --- | ---: | ---: |
| `index-CEI_e6By.js` | 220,155 | 68,316 |
| `index-CksttCMJ.css` | 1,002 | 562 |
| 合計 | 221,157 | 68,878 |

## コマンド

READMEの`npm ci`、`npm run check`、`npm run build`、`npm run preview -- --host 127.0.0.1`で導入・型検査・build・previewを再現できる。`build`は型検査とproduction build後に生成HTMLのasset参照を確認する。`vite preview`はproduction buildのローカル確認用で、production serverとして使うものではない。実際のGitHub Pages公開はIssue #6の範囲である。別のテストフレームワークは追加していない。

## 参照資料

- [Vite Getting Started](https://vite.dev/guide/)
- [Vite: Deploying a Static Site](https://vite.dev/guide/static-deploy) — GitHub Pages repository siteでは `base: '/<REPO>/'` を設定し、`vite preview`はローカル確認に使う。
- [Vite公式React TypeScript template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts)
- [React license](https://github.com/react/react/blob/main/LICENSE)
- [Vite license](https://github.com/vitejs/vite/blob/main/packages/vite/LICENSE.md)
- [TypeScript license](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt)
