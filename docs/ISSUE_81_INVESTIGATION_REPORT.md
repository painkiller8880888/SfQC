# 基本統計量モックから本実装への移行案

2026-11-12の調査報告です。対象は、#81の比較モックを仮採用した場合に基本統計量1単元を本実装へ移す順序と影響の整理です。これは実装計画の確定や正式教材への切替承認ではありません。前回の比較所見、採用理由、追加の受入検証は、ここでは再掲・追加していません。

## 現状

- 比較モックは既存Reactアプリのナビゲーション、テーマ、画面枠を利用し、`App.tsx` の `sfqc-preview` 分岐で通常コースと隔離されています。
- 解説モック（[`descriptive-statistics-preview.tsx`](../src/descriptive-statistics-preview.tsx)）は4節を一続きにし、本文、インライン問題、コード描画図、開閉式の補足を置いています。
- 演習モック（[`descriptive-statistics-exercise-preview.tsx`](../src/descriptive-statistics-exercise-preview.tsx)、[`descriptive-statistics-exercise-preview-data.mjs`](../src/descriptive-statistics-exercise-preview-data.mjs)）は5カテゴリ各3テンプレートです。選択式/数値式、個別または全問の再生成、答え合わせ、解説、明示的な手動チェックを提供し、状態はReact内だけで保持します。
- 教材データの正本は[`lesson-registry.mjs`](../src/lesson-registry.mjs)です。正式な問題出題・採点には[`practice-actions.mjs`](../src/practice-actions.mjs)の`createPracticeInstance`と`submitPracticeAnswer`があり、回答は出題時のquestion instance snapshotに基づきます。回答履歴・正答率と、[`manual-progress.mjs`](../src/manual-progress.mjs)の手動単元進捗は別の仕組みです。

## 推奨する移行順

1. 学習マップから正式な解説・演習へ入る導線を定めます。既存のlesson IDやrouteは流用できる範囲で使いますが、旧形式との互換性は今回の期間限定方針に含めません。
2. 解説本文と図を正式化し、教材registryと画面に同じ内容を二重管理しない形にします。
3. 演習問題を正式なquestion definitionへ移し、既存の出題・snapshot採点経路につなぎます。設問のID、条件、丸め、単位、解説、誤答時の復習先も正式な契約に合わせます。
4. 回答履歴・正答率・復習導線へ接続します。問題の手動チェックを保存するかは未決として残し、単元の手動進捗や自動採点と混同させません。
5. 正式コースへの導線を確認してから、preview query・リンク・抑止条件を整理します。保存・移行失敗時の既存エラー処理は保ちます。

## 主な差分と未決事項

現行の基本統計量の正式問題5件と、今回のモックの5カテゴリ/各3テンプレートは同じ構成ではありません。不偏分散、単位変換、計算誤りのような問題を正式な定義と採点規則に合わせる作業が必要です。特にモック独自の数値入力・許容誤差を正式化せず、既存の入力検証、問題instance snapshot、採点契約に接続することが中心です。

問題単位の手動チェックを将来保存するか、単元の手動進捗からどう区別するかは未決です。まずは基本統計量1単元の正式化として扱い、全単元向けの共通化や旧データ形式の変換は含めません。作業規模は中程度で、採点・保存・復習への接続が主な範囲です。根拠のない日数見積もりは置いていません。

## 検証範囲

前回の調査段階では、コードと文書の読み取り、および後方互換性方針の記録だけを行い、テスト・ブラウザー確認は行っていません。このPRの回帰チェック結果はPR本文に記録します。比較受入の追加検証やユーザー比較の代替結果を、この報告でPASS扱いにはしません。

## 参照

- [Issue #81](https://github.com/painkiller8880888/SfQC/issues/81) — 採用判断と段階的移行案
- [Issue #73](https://github.com/painkiller8880888/SfQC/issues/73) — 親Issueとモックの境界
- [Issue #43](https://github.com/painkiller8880888/SfQC/issues/43) — 学習マップと既存契約
- [2026-11-12の後方互換性方針](../AGENTS.md#正式リリース前の後方互換性)
