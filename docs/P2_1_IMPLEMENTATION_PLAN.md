# P2.1 実装計画

P2.1は、既存の学習導線を保ちながら、Skilltreeの操作性を参考にした学習マップを既存の`#/map`からトップページ兼手動進捗管理画面として独立実装するフェーズです。方針と進捗の正本は[親Issue #43](https://github.com/painkiller8880888/SfQC/issues/43)、各Issueの受入条件はその本文を参照してください。

## 実行順と依存関係

| 順 | Issue | 作業 | 依存 |
|---:|---:|---|---|
| 01 | [#44](https://github.com/painkiller8880888/SfQC/issues/44) | 旧P2計画をlegacyへ整理し、現行計画の入口を設定 | なし |
| 02 | [#45](https://github.com/painkiller8880888/SfQC/issues/45) | グラフ契約と5分野分類の正本・データ表現を決定 | #44 |
| 03 | [#46](https://github.com/painkiller8880888/SfQC/issues/46) | React Flow + Dagreの描画PoC | #45 |
| 04 | [#47](https://github.com/painkiller8880888/SfQC/issues/47) | 学習マップをトップページに統合 | #46 |
| 05 | [#48](https://github.com/painkiller8880888/SfQC/issues/48) | 単元詳細カード | #47 |
| 06 | [#49](https://github.com/painkiller8880888/SfQC/issues/49) | 手動進捗と自己点検 | #48 |
| 07 | [#50](https://github.com/painkiller8880888/SfQC/issues/50) | 独立保存領域とバックアップ | #49 |
| 08 | [#51](https://github.com/painkiller8880888/SfQC/issues/51) | ノード配置編集 | #47, #50 |
| 09 | [#52](https://github.com/painkiller8880888/SfQC/issues/52) | 共通必須前提のハイライト | #45, #47 |
| 10 | [#53](https://github.com/painkiller8880888/SfQC/issues/53) | 5分野の色と作者用編集UI | #45, #47 |
| 11 | [#54](https://github.com/painkiller8880888/SfQC/issues/54) | Solarizedと操作テーマ | #47, #53 |
| 12 | [#55](https://github.com/painkiller8880888/SfQC/issues/55) | 演習・詳細進捗の統合 | #48, #49 |
| 13 | [#56](https://github.com/painkiller8880888/SfQC/issues/56) | モバイル・アクセシビリティ | #48, #51, #54 |
| 14 | [#57](https://github.com/painkiller8880888/SfQC/issues/57) | 統合E2E・公開QA・正式切替 | #44〜#56 |

表はIssue #43のチェック順と依存関係を示します。#47後は、依存を満たした#48・#52・#53を並行して進められます。#51は#47と#50、#54は#53、#55は#48と#49、#56は#48・#51・#54の完了を待ちます。公開QAはmainのdeployと実測証拠を確認してから完了とし、#57まで親Issue #43をopenに保ちます。

## 実装境界

- `src/lesson-registry.mjs`をlesson dataの正本とし、34単元と64本の共通必須前提を導出します。条件付き前提と任意復習は共通必須edgeに混ぜません。
- 5分野の分類データの正本と表現は#45で決定します。全34単元に重複・欠落なく割り当て、curriculumの推奨段階を分類データと同一視しません。
- 学習者が編集できるのは配置だけです。教材の構造や学習目標を変更する機能は公開しません。
- 手動進捗は未開始→学習中→完了、Reopenで学習中へ遷移します。閲覧や正答率による自動完了、前提による教材・演習のロックは行いません。手動進捗と全解答試行の正答率は別に扱います。
- 既存の詳細な演習集計、`sfqc:local-data` schema version 2、hash route、履歴・復習stack、Pages `/SfQC/`を保ちます。手動マップ状態は独立したversion付き領域へ保存し、旧形式も維持した上でバックアップに双方を含めます。
- Solarized Light/DarkはOS設定を初期値にし、利用者が明示した変更を優先します。ノードのホイール操作はズームです。
- Skilltreeのコード・CSS・素材は転載しません。コード描画と、ライセンスを確認したライブラリを使います。生成画像・生成アセット・クラウド保存・アカウント機構は導入しません。

## 開発・受入

各Issueは原則1 PRとし、PR本文に`Refs #<Issue番号>`、`npm run check`・`npm run build`の結果、受入証拠、未検証項目を記録します。UI変更はproduction previewで320px幅とキーボード操作を確認します。公開QAを要する条件はmain上で確認するまで完了扱いにしません。

## 関連資料

- [P2と旧計画資料の履歴](legacy/README.md)
- [P2.1の親Issue #43](https://github.com/painkiller8880888/SfQC/issues/43)
- [5分野分類・グラフ契約のIssue #45](https://github.com/painkiller8880888/SfQC/issues/45)
