# PR #71 人力レビュー checklist

## 対象

- PR: [#71 — モバイル下部カードとマップ操作のアクセシビリティ](https://github.com/painkiller8880888/SfQC/pull/71)（Draft）
- 検証したアプリコード: `b12d99f9c53d203d4259f9eaafebbbb4e1bb3b91`
- ビルド: `2026-11-05 09:53 JST`、`npm run build` — PASS。`npm run check`、157件のテスト、Vite production build、build検査を含みます。
- この文書の追加はドキュメントだけです。`dist/`は追跡していません。手動確認では、このcommitのproduction previewを使ってください。

## 機械・emulationで確認済みの範囲

以下は自動テストまたはviewport emulationの結果で、人力受入の代わりにはなりません。

| 項目 | 結果 |
|---|---|
| `npm run build` | PASS。157/157 tests、Vite build、build検査が成功。 |
| 320×240、320×568のbrowser viewport emulation | keyboard open/close時のfocus可視性、pointer open時の文書scrollなし、pointer close後の「全体表示」fallback可視性を確認済み。実機touchではありません。 |
| nodeがDOMから消えたkeyboard復帰fallback | 通常の画面操作で再現する経路を確認できていません。専用JSDOM試験はReact FlowのDOMを手動削除すると`Array buffer allocation failed`になるため追加していません。製品操作で再現手順が見つからない限り、人力PASSにせず未確認として残してください。 |

## Previewを開く

build済みのproduction previewを使います。開発サーバーではありません。

- このPC上: `http://127.0.0.1:4173/SfQC/#/map`
- 同じLAN上の端末: `http://<このPCのLAN IPv4>:4173/SfQC/#/map`（現在の接続情報は作業handoffに記載。別ネットワークからは使えません。）
- HTTP確認: このPCからloopbackとLAN IPv4の両方でHTTP 200。別端末からの接続は未確認で、Firewall/router設定は変更していません。

現在のpreviewはバックグラウンドで起動しています。停止・再起動が必要な場合:

```powershell
# 再起動（既存サーバーを先に停止してください）
npm run preview -- --host 0.0.0.0 --port 4173

# フォアグラウンドで起動した場合は Ctrl+C で停止
```

起動中のバックグラウンドprocess IDと停止コマンドは作業handoffを参照してください。公開tunnelやFirewall変更は使いません。

## 記録する環境

| 項目 | 記録 |
|---|---|
| 実施者 / 日時（JST） |  |
| 端末・OS / version |  |
| Browser / version |  |
| 画面向き・CSS viewport（幅×高さ） |  |
| Browser zoom / OS display scale |  |
| 入力（touch / hardware keyboard / mouse） |  |
| Screen reader / version（使った場合） |  |
| OS reduced-motion設定と`prefers-reduced-motion`の値 |  |
| URL / 表示中のcommit |  |

各ゲートの結果は `PASS` / `FAIL` / `未実施` と所見を記録してください。正確な320×240 viewportを実機に強制する必要はありません。端末の縦・横向きや200% browser zoomを使い、実際のCSS viewportを記録してください。

## 手動確認

| Gate | 手順と合格条件 | 結果・所見 |
|---|---|---|
| Touch・文書/カード/canvasのスクロール分離 | 同一LANの実スマートフォンで320/375 CSS px相当のportrait幅を使い、実幅・高さを記録。nodeをtapしてカードを開く。カード本文を縦にswipeすると本文だけが動き、document位置とcanvas倍率が変わらないこと。canvas背景を1本指でdragするとgraphがpanし、pinchではgraphがzoomし、カード本文やdocumentが意図せず動かないこと。canvas/cardの外側のページ領域とカードheaderの空白から上下swipeし、documentの上下scroll経路が使えることを確認。操作領域どうしが奪い合う/scroll経路が見つからない場合はFAILとして、開始位置・方向・結果を記録。 | 未実施 |
| Close後のfocusと短画面 | cardを開いてページをscrollし、画面内に見える閉じるbuttonをtap/click。元nodeへ戻るkeyboard経路と、pointer/touchで開いた後にfallbackする「全体表示」buttonの両方について、focus対象がsticky headerに隠れずviewport内にあることを確認。touch browserがactive focusを示さない場合はその旨を記録し、可能ならhardware keyboardまたはbrowser inspectorでactive element/rectを確認。実端末では短いlandscape表示または200% zoomを使い、実際のviewport寸法を記録。短い画面のsticky header/navと本文へ移動するskip linkが利用できること。 | 未実施 |
| 配置編集・reload | 既存ユーザーデータを使わずprivate window/一時profileで行う。`配置編集`を有効にしてnodeを1つ移動し、保存後にreloadして位置が残ることを確認。試験後はその一時sessionを閉じる。通常profileの配置や進捗を消去しない。 | 未実施 |
| Keyboard / focus-visible | mouse/touchを使わずTabでmap nodeへ移動し、focus outlineが見えること。EnterまたはSpaceでcardを開き、cardのH2へfocusが移ってviewport内に見えること。Escapeで閉じ、keyboard起点nodeが再びvisibleになること。再びnodeにfocusしてTabを1回押し、次のnodeに進みedgeはTab stopにならないことを確認。included nodeで「解説を読む」へ移動し、mapへ戻る操作も試す。 | 未実施 |
| Screen reader | 実OSのSR/versionを記録し、上記keyboard経路で試す。map regionが「教材単元の依存関係」、nodeの名前に単元名・分野・進捗/正答情報が含まれ、補助説明でEnter/SpaceとEscape/閉じる操作を案内することを確認。selectionのpolite live regionが選択単元・分野・直接前提の状態を伝えること。詳細カードH2と「<単元名>の詳細を閉じる」、control group「グラフ操作」、拡大/縮小/グラフ全体を表示が識別できること。edgeはkeyboard focusableではなく、読み上げ時に共通必須前提と詳細カードでの確認方法を伝える実装です。異なる読み上げ順や欠落は実際の文言と場所を記録。 | 未実施 |
| OS reduced motion | OSのreduced-motionを有効にし、browserで`matchMedia('(prefers-reduced-motion: reduce)').matches`がtrueであることを確認。node選択時のReact Flow auto-pan、close/restore、Fit View、zoom操作で不要な滑らかな移動が抑えられ、選択・focus・scrollが損なわれないことを観察。repository sourceには明示的な`prefers-reduced-motion`分岐が見つかっていないため、OS設定を切り替えたことだけでPASSにせず、実際の動きを記録。動きが残る/区別できない場合はFAILまたは未実施にする。 | 未実施 |

## 保存データと報告

- node選択・focus確認だけなら進捗データを変更しません。Start/Mark completed、自己点検checkbox、問題回答は押さないでください。
- 配置編集はlocalStorageに保存されます。上の試験はprivate window/一時profileだけで行い、通常profileの保存値を消去・置換しないでください。
- 結果と所見をこの表へ記録し、確認後にPR #71本文へ環境・実測値・未解決事項を追記してください。全ゲートが実施済みになるまでPRはDraft、Issue #56はopenのままにします。
