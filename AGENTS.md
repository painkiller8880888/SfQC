# AGENTS.md

## Project

## Read first

- `.codex/config.toml` - 作業におけるモデル選択についての設定
- [`README.md`](README.md#現行の作業と文書の優先順位) — 現行の作業入口（親Issue #73と子Issue）
- `docs/` — プロジェクトの実装計画
- [`docs/P2_1_IMPLEMENTATION_PLAN.md`](docs/P2_1_IMPLEMENTATION_PLAN.md) — 完了したP2.1の実行順・確定契約の記録
- [`docs/legacy/README.md`](docs/legacy/README.md) — P2の履歴資料と文書の優先順位

## Commands

## Repository rules

QC検定2級を目標とした、統計学の初学者向けの解説主体のWeb教材＋問題集です。
解説 → 演習 → 誤答フィードバック → 関連する解説・前提知識の復習 → 再演習、という学習サイクルを中心に開発します。図やグラフはコードによる描画を基本とし、生成画像・生成アセットは使用しません。
GitHub Pagesで公開し、学習・採点・進捗保存をブラウザ内で完結させる方針です。

## agents

作業は`orchestrator`ルートエージェントと作業を移譲された`worker`サブエージェント、`plan_reviewer`サブエージェントが行う。
`plan_reviewer`サブエージェントはユーザーがレビューの明示的な許可を出していない場合は起動しない。
`Orchestrator`は、計画、委譲、進行管理、結果の評価のみを担当し、実装、リポジトリ走査、grep や検索、Git 操作、テスト、Computer Use などの実作業を直接行わない。
GitHub 操作については、必要に応じてホスト権限を使用してよい。
作業内容が異なる場合は、それ単体で作業できる内容に分けて、必要に応じて別のサブエージェントへ委譲する。
`Orchestrator`とサブエージェントの間では、会話コンテキストが自動的に引き継がれることを前提にせず、情報共有は handoff を通して行う。
サブエージェントへ作業を委譲した後は、その結果が返るまで`Orchestrator`は停止し、サブエージェントの状態をモニターしない。
指示どおりに作業を継続できない矛盾、前提条件の不足、またはその他の重大な問題が発生した場合は、その問題と原因をまとめた handoff を作成し、その時点で作業を停止する。

## Handoff

handoff には、受け取った側が追加のコンテキストなしで作業できるだけの情報を含める。
依頼時の handoff には、少なくとも以下を含める。

- タスクの目的
- 実施する作業内容
- 制約事項と禁止事項
- 停止条件
- 必要に応じて、それ以前の作業で得られた関連情報

subagent が作業結果を返す際は、少なくとも以下をまとめる。

- 実施した作業
- 判明した事項
- 行った変更
- 実施した検証
- 未解決の問題やブロッカー

## planning

計画タスクを実行した後に、ユーザーからレビューの明示的な許可があった際は`plan_reviewer`サブエージェントを1度だけ呼び出し、計画レビューを依頼する。同一の計画セッション内では、`plan_reviewer`による計画レビューを再度実行しない。
レビューでは、少なくとも以下を確認する。

- 計画上の欠陥
- 考慮漏れ
- 要件や方針の矛盾
- 不要な作業
- 実装時のリスク

## Structure

## 文書の優先順位

| 分類 | 正本・例 | 扱い |
|---|---|---|
| 現行作業 | [親Issue #73](https://github.com/painkiller8880888/SfQC/issues/73) と子Issue | 各Issueの目的・許可範囲・受入条件に従います。下位Issueの条件も許可範囲内だけで適用します。 |
| 現行移行計画 | [`docs/ISSUE_81_MIGRATION_PLAN.md`](docs/ISSUE_81_MIGRATION_PLAN.md) | #81の仮採用後に合意した移行順と契約を記録します。本書の2026-11-12後続決定と衝突する#81の旧受入条件は、その範囲で本書を優先します。それ以外の受入条件と本書で変更していない既存契約は維持します。 |
| 確定済み契約 | 明示的な設計判断を記録したIssue（例: [完了した#43](https://github.com/painkiller8880888/SfQC/issues/43)） | 既存境界として保ちます。変更が必要な場合は明示的な設計判断を経ます。 |
| 実装形式・現在の挙動 | `src/`、契約validator、`scripts/*test.mjs` | 現在の形式・挙動・回帰範囲の確認に使います。コードやテストだけで設計判断の妥当性を決めません。 |
| 教育方針 | [`docs/PROJECT_CHARTER_DRAFT.md`](docs/PROJECT_CHARTER_DRAFT.md) | 解説→演習→誤答feedback→関連解説・前提復習→再演習の方針を参照します。§3/§6/§9の初期画面・進捗・フェーズ案は確定仕様ではありません。 |
| 現役の教育照合資料 | [`docs/curriculum/PREREQUISITE_MAP_DRAFT.md`](docs/curriculum/PREREQUISITE_MAP_DRAFT.md)、[`docs/curriculum/SYLLABUS_MAPPING_DRAFT.md`](docs/curriculum/SYLLABUS_MAPPING_DRAFT.md) | Draft表記でもcurriculum契約テストの入力です。パス、見出し、表構造、教育根拠を変更する場合はregistry・テストとの整合を確認します。 |
| P2.1完了記録 | [Issue #43](https://github.com/painkiller8880888/SfQC/issues/43)、[`docs/P2_1_IMPLEMENTATION_PLAN.md`](docs/P2_1_IMPLEMENTATION_PLAN.md) | 確定契約と過去の実行順を記録します。過去の実行順を現行の作業計画とは扱いません。 |
| 日付付き契約確認記録 | [`docs/MVP_DESIGN_DRAFT.md`の#73比較モック確認記録](docs/MVP_DESIGN_DRAFT.md#mock-contract-snapshot) | 2026-11-05時点の本番契約、モックで隔離して試せる範囲、未決事項を記録します。後続Issue #75〜#81が参照しますが、設計判断の正本ではありません。 |
| 初期設計・履歴 | `docs/MVP_DESIGN_DRAFT.md`のP1本文、[`docs/legacy/`](docs/legacy/README.md) | 参考記録として保ち、日付付き契約確認記録や後続Issueの条件と区別します。保存原文は書き換えません。 |
| 保留事項 | [Issue #73](https://github.com/painkiller8880888/SfQC/issues/73)で未決とされた事項 | 後続Issueで判断するまで確定扱いしません。 |

教材データの実装正本は[`src/lesson-registry.mjs`](src/lesson-registry.mjs)です。curriculum資料との整合検査は[`scripts/lesson-curriculum.test.mjs`](scripts/lesson-curriculum.test.mjs)です。既存契約と新しいIssueの受入条件が衝突し、現行移行計画などで明示済みの後続決定がない場合は、衝突する変更を止め、衝突点・影響・必要な判断を共有して明示的な設計判断を求めます。これは将来の契約変更を禁止するものではありません。

### 正式リリース前の後方互換性

2026-11-12の明示的な設計判断として、正式リリースまでは、ユーザーから個別の指示がない限り、過去データ・旧バックアップ・旧形式・旧インターフェースの後方互換性維持や移行対応を要件に含めません。これは#43など既存契約の後方互換方針に対する期間限定の変更であり、保存形式の変更を許容します。採用する保存形式の整合性・入力検証と、破損・不正データや保存失敗へのエラー処理は維持します。既存Issueや履歴記録は書き換えません。
