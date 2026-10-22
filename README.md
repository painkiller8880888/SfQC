# SfQC

**QC検定2級を目標とした、統計学の初学者向けの解説主体のWeb教材＋問題集**です。

解説 → 演習 → 誤答フィードバック → 関連する解説・前提知識の復習 → 再演習、という学習サイクルを中心に開発します。図やグラフはコードによる描画を基本とし、生成画像・生成アセットは使用しません。

GitHub Pagesで公開し、学習・採点・進捗保存をブラウザ内で完結させる方針です。現在は学習アプリの基盤を整備しており、教材・演習機能はまだ実装・公開していません。

## プロジェクト方針

[プロジェクト基本方針（Draft v0.1）](docs/PROJECT_CHARTER_DRAFT.md)

## 開発の進め方

Issueで目的・受入条件を定義し、実装ブランチとPRで変更を提案し、レビュー・検証後にマージします。各PRの完了後に次のIssueを具体化する方針です。

初回のドキュメントは空リポジトリを初期化するため`main`へ直接登録しました。以降の変更は原則としてIssue → PRで進めます。

## ローカル開発

Node.js 20.19以上または22.12以上とnpmが必要です。

```sh
npm ci
npm run dev
npm run check
npm run build
npm run preview -- --host 127.0.0.1
```

previewは `http://127.0.0.1:4173/SfQC/` で確認できます。`check`はTypeScriptの型検査、画面URL解決・問題契約・ブラウザ内データ保存とJSON復元のテストを実行し、`build`は`check`・production build・生成HTML/404ページの検査を実行します。技術選定と検証結果は[技術選定記録](docs/TECH_STACK_DECISION.md)を参照してください。

## CI と GitHub Pages

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) は `main` 向けPRで `npm ci` と `npm run build` を実行し、`main` へのpushで同じ検査の後に `dist/` をGitHub Pagesへdeployします。PRからはdeployしません。Actionsタブで各workflowの結果を確認できます。初回deploy後の公開先は [https://painkiller8880888.github.io/SfQC/](https://painkiller8880888.github.io/SfQC/) を予定しています。

初回公開前に、Repository Settings > PagesのSourceをGitHub Actionsにし、`github-pages` environmentを作成してdeploy対象を`main`に制限してください。Settings > Actions > GeneralでActionsが無効化されておらず、workflowが使用するActionsが許可されていることも確認してください。設定変更はrepository admin/maintainerが行い、PagesのURLとdeploy成功をActionsタブで確認します。
