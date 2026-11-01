# SfQC

**QC検定2級を目標とした、統計学の初学者向けの解説主体のWeb教材＋問題集**です。

解説 → 演習 → 誤答フィードバック → 関連する解説・前提知識の復習 → 再演習、という学習サイクルを中心に開発します。図やグラフはコードによる描画を基本とし、生成画像・生成アセットは使用しません。

GitHub Pagesで公開し、学習・採点・進捗保存をブラウザ内で完結させる方針です。P2では平均・分散・標準偏差の解説と演習、誤答からの前提復習、進捗保存までを公開しました。P2.1では既存の学習導線を保ちながら、学習マップを手動進捗管理画面として拡張します。

## プロジェクト方針

[プロジェクト基本方針（Draft v0.1）](docs/PROJECT_CHARTER_DRAFT.md)

## 現行の実装計画

P2.1の方針と進捗は[親Issue #43](https://github.com/painkiller8880888/SfQC/issues/43)、リポジトリ内の実装順序は[P2.1実装計画](docs/P2_1_IMPLEMENTATION_PLAN.md)、P2の完了記録と過去の計画資料は[legacy index](docs/legacy/README.md)を参照してください。個別作業の受入条件は各Issueに従います。legacy資料と旧パスの案内は履歴であり、現行の実装指示ではありません。

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

## 破損データの保守復旧

`sfqc-recovery-raw`形式の救出ファイルは保全専用で、アプリの通常の読み込み操作では復元できません。保守者が復旧する場合は、同じブラウザープロファイルで対象アプリのoriginを開き、開発者ツールのApplication（またはStorage）> Local Storageから次のキーを個別に扱います。

- `raw["sfqc:local-data"]`を`sfqc:local-data`の値へ、その文字列のまま設定します。
- `raw["sfqc:map-state:v1"]`を`sfqc:map-state:v1`の値へ、その文字列のまま設定します。
- 対応する値が`null`なら、そのキーを削除します。空文字やJSON文字列の`"null"`は代わりに使いません。

救出ファイルの外側JSONをキーの値として貼り付けず、元ファイルは編集せず保管してください。片方ずつ設定または削除した後にアプリを再読み込みし、データ管理画面で保存状態を確認します。

## CI と GitHub Pages

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) は `main` 向けPRで `npm ci` と `npm run build` を実行し、`main` へのpushで同じ検査の後に `dist/` をGitHub Pagesへdeployします。PRからはdeployしません。Actionsタブで各workflowの結果を確認できます。公開先は [https://painkiller8880888.github.io/SfQC/](https://painkiller8880888.github.io/SfQC/) です。

初回公開時の管理者向け設定手順: Repository Settings > PagesのSourceをGitHub Actionsにし、`github-pages` environmentを作成してdeploy対象を`main`に制限してください。Settings > Actions > GeneralでActionsが無効化されておらず、workflowが使用するActionsが許可されていることも確認してください。設定変更はrepository admin/maintainerが行い、PagesのURLとdeploy成功をActionsタブで確認します。
