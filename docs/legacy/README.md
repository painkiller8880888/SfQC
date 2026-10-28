# P2計画資料アーカイブ

## 現在の計画と履歴資料

このフォルダーは、完了したP2の計画・検証記録を当時の内容のまま保存します。ここにある文書と各旧パスの案内スタブは歴史資料であり、現在の実装指示ではありません。

P2.1の方針と進捗は[親Issue #43](https://github.com/painkiller8880888/SfQC/issues/43)、リポジトリ内の実装順序は[現行P2.1計画](../P2_1_IMPLEMENTATION_PLAN.md)、各作業の受入条件は個別Issueが正本です。教材データの正本は[lesson registry](../../src/lesson-registry.mjs)、教育上の前提・公式項目との照合基準は[前提マップ](../curriculum/PREREQUISITE_MAP_DRAFT.md)と[シラバス対応表](../curriculum/SYLLABUS_MAPPING_DRAFT.md)、両者の整合検査は[curriculum契約テスト](../../scripts/lesson-curriculum.test.mjs)です。

## P2の範囲と最終受入

P2はIssue #16〜#28、PR #30〜#42で平均・分散・標準偏差の解説と演習、誤答からの前提復習、進捗保存を実装した縦断MVPです。QC検定2級の全範囲を収録したことを意味しません。未収録範囲や習熟度・復習スケジューラ等は後続フェーズの課題です。

保存した[P2実装計画](p2/P2_IMPLEMENTATION_PLAN.md)のG5欄は、PR #42更新時点の2026-10-27に公開QAをまだ確認していない記録です。これはその時点のスナップショットです。最終受入は2026-10-28の[Issue #28最終公開受入コメント](https://github.com/painkiller8880888/SfQC/issues/28#issuecomment-6459149373)でPASSとされ、Pages deploy、配信asset、実ブラウザー操作、320px表示、キーボード操作、reload、JSON import/exportが確認されています。対応する[PR #42](https://github.com/painkiller8880888/SfQC/pull/42)にも受入記録があります。

## 保存資料と旧パス

移設元に案内スタブを残し、既知のblob/mainリンクが404にならないようにしています。保存本文は変更していません。

| 旧パスの案内 | 保存した原文 | 移設前commitの固定リンク |
|---|---|---|
| [`docs/P2_IMPLEMENTATION_PLAN.md`](../P2_IMPLEMENTATION_PLAN.md) | [P2_IMPLEMENTATION_PLAN.md](p2/P2_IMPLEMENTATION_PLAN.md) | [原文](https://github.com/painkiller8880888/SfQC/blob/423d44294cf34684b89b1571cb31e9fd8f7100df/docs/P2_IMPLEMENTATION_PLAN.md) |
| [`docs/ISSUE_19_IMPLEMENTATION_PLAN.md`](../ISSUE_19_IMPLEMENTATION_PLAN.md) | [ISSUE_19_IMPLEMENTATION_PLAN.md](p2/ISSUE_19_IMPLEMENTATION_PLAN.md) | [原文](https://github.com/painkiller8880888/SfQC/blob/423d44294cf34684b89b1571cb31e9fd8f7100df/docs/ISSUE_19_IMPLEMENTATION_PLAN.md) |
| [`docs/ISSUE_28_IMPLEMENTATION_PLAN.md`](../ISSUE_28_IMPLEMENTATION_PLAN.md) | [ISSUE_28_IMPLEMENTATION_PLAN.md](p2/ISSUE_28_IMPLEMENTATION_PLAN.md) | [原文](https://github.com/painkiller8880888/SfQC/blob/423d44294cf34684b89b1571cb31e9fd8f7100df/docs/ISSUE_28_IMPLEMENTATION_PLAN.md) |

## 既知のIssue・PR参照の監査

2026-10-28にGitHub connectorでIssue #16・#19・#22・#23・#28・#43・#44・#45、Issueコメント、PR #42本文・レビューを確認しました。表は移設する3文書への参照だけを対象にし、Issue/PR本文は変更していません。

| 発生元 | 旧パス・参照形式 | 移設後の到達先 | path / anchor / raw判定・補助案内 |
|---|---|---|---|
| [Issue #16](https://github.com/painkiller8880888/SfQC/issues/16)本文・[計画コメント](https://github.com/painkiller8880888/SfQC/issues/16#issuecomment-6353869798) | `docs/P2_IMPLEMENTATION_PLAN.md`の通常パス表記。blob URL・fragment・raw URLではない | 旧パスは[P2案内スタブ](../P2_IMPLEMENTATION_PLAN.md)から[保存原文](p2/P2_IMPLEMENTATION_PLAN.md)へ | 旧パスを保ち、スタブからarchiveへ案内 |
| [Issue #19 計画コメント](https://github.com/painkiller8880888/SfQC/issues/19#issuecomment-6357955990) | `docs/P2_IMPLEMENTATION_PLAN.md`に加え、旧文書の行番号30–37、46–49を本文中に記載。GitHubの行fragmentリンクではない | [保存原文](p2/P2_IMPLEMENTATION_PLAN.md) | 固定した[移設前30–37行](https://github.com/painkiller8880888/SfQC/blob/423d44294cf34684b89b1571cb31e9fd8f7100df/docs/P2_IMPLEMENTATION_PLAN.md#L30-L37)と[46–49行](https://github.com/painkiller8880888/SfQC/blob/423d44294cf34684b89b1571cb31e9fd8f7100df/docs/P2_IMPLEMENTATION_PLAN.md#L46-L49)を参照。旧mainパスの同じ行番号はスタブ上の行となるため互換ではない |
| [Issue #22 計画コメント](https://github.com/painkiller8880888/SfQC/issues/22#issuecomment-6407373998)、[Issue #23 計画コメント](https://github.com/painkiller8880888/SfQC/issues/23#issuecomment-6408510436) | `docs/P2_IMPLEMENTATION_PLAN.md`の通常パス表記 | 旧パスのスタブから[保存原文](p2/P2_IMPLEMENTATION_PLAN.md)へ | blob URL・fragment・raw URLは検出されなかった |
| [Issue #28](https://github.com/painkiller8880888/SfQC/issues/28)本文、[計画コメント](https://github.com/painkiller8880888/SfQC/issues/28#issuecomment-6435612804)、[レビュー指摘コメント](https://github.com/painkiller8880888/SfQC/issues/28#issuecomment-6435798835) | `docs/P2_IMPLEMENTATION_PLAN.md`の通常パス表記 | 旧パスのスタブから[保存原文](p2/P2_IMPLEMENTATION_PLAN.md)へ | blob URL・fragment・raw URLは検出されなかった。最終QAは上記Issue #28最終受入コメントを参照 |
| [Issue #43](https://github.com/painkiller8880888/SfQC/issues/43) | [`blob/main/docs/P2_IMPLEMENTATION_PLAN.md`](https://github.com/painkiller8880888/SfQC/blob/main/docs/P2_IMPLEMENTATION_PLAN.md)。パスfragmentなし | mainの旧パスはスタブとなり、そこから[保存原文](p2/P2_IMPLEMENTATION_PLAN.md)へ | blob pathの到達性とarchive案内を維持。行・見出しfragmentの互換ではない |
| [Issue #44](https://github.com/painkiller8880888/SfQC/issues/44)本文・[実装計画コメント](https://github.com/painkiller8880888/SfQC/issues/44#issuecomment-6461331575) | 3旧パスを通常のコードパスとして列挙。計画コメントはP2計画の81–105行付近を指すが、行fragment URLではない | 各旧パスのスタブから対応する[3保存文書](p2/)へ | G5の根拠は[移設前81–105行](https://github.com/painkiller8880888/SfQC/blob/423d44294cf34684b89b1571cb31e9fd8f7100df/docs/P2_IMPLEMENTATION_PLAN.md#L81-L105)の固定リンクで参照可能 |
| [Issue #45](https://github.com/painkiller8880888/SfQC/issues/45) | 3旧パスへの参照なし | 該当なし | 今回の外部リンク監査対象に該当なし |
| [PR #42](https://github.com/painkiller8880888/SfQC/pull/42)本文・[レビュー](https://github.com/painkiller8880888/SfQC/pull/42) | 本文・再レビューは通常パス表記。初回レビューのG5参照は[`blob/49b83cd…/docs/P2_IMPLEMENTATION_PLAN.md`](https://github.com/painkiller8880888/SfQC/blob/49b83cd35a4331776ec324a259439202adf40c68/docs/P2_IMPLEMENTATION_PLAN.md)のcommit固定blob | `blob/main`の旧パスはスタブとなり、[保存原文](p2/P2_IMPLEMENTATION_PLAN.md)へ。commit固定リンクは引き続き原文を表示 | commit固定blobにfragment/rawはない。選択したIssue/PR本文・コメントにraw.githubusercontent.comまたは移設先3文書への行/見出しfragmentは検出されなかった |

上記は指定されたIssue/PRの既知参照の監査です。未知の外部リンクの不存在までは保証しません。スタブが保証するのは旧blob/mainパスの到達性とarchiveへの案内です。旧パス上の行/見出しfragmentと`raw.githubusercontent.com`の原文内容は再現せず、移設前commitの固定リンクで参照してください。GitHub本文は編集していません。
