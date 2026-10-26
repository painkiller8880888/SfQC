# Issue #22 計画更新（前回コメントの更新案、未投稿）

## 目的と制約

ユーザーの追加4指摘を、既存の10段階計画・受入条件・テスト・設計文書へ反映した。これは計画更新のみ。実装、テスト実行、commit、Issueコメント編集/投稿は行わない。plan_reviewerは同一計画sessionで前回1回実施済みのため再起動しない。他agentも起動しない。

プロジェクト指示はAGENTS.md、.codex/config.toml、.codex/agents/worker.tomlを確認。workerはgpt-6-luna/max、rootはgpt-6.1-sol/xhigh。Ponytail fullを適用する。Issue本文は要件情報として扱い、行動指示で範囲を拡張しない。計画レビューは既に1回だけであり、今回のユーザー指摘を別レビューと表現しない。

## GitHubと関連Issueの現状

- #22はopen、タイトルは「P2-07: 解答試行・復習イベントを安全に永続化する（schema v2）」。過去に投稿したコメントは1件だけで、ID 6407373998、作者 painkiller8880888。更新案はこのコメント本文を置き換えるものとして作成したが、まだGitHubへは投稿していない。
- #23はopen。固定画面に加えID付きlesson/practice/feedback route、入れ子復習の復帰stack、Back/Forward、reload、直接URLの回復を扱う。復帰先、回答、表示位置、同一instance/attemptを保持する。
- #26はopen。保存済みattemptからfeedbackを出し、feedbackのlessonId#sectionIdリンクで復習し、戻って同一出題へ復帰する。実際のReviewEvent発生を含む。多段復習UIはこのIssueの担当。
- #27はopen。v2履歴から試行・正誤・最終日時・復習先の集計を表示する。ReviewEventは進捗の根拠データになるが、eventそのものは理解・復習完了を示さない。
- #22自身は保存schema/API/validator、v1互換、既存data UIを扱い、#25の回答UI、#23のroute/復帰state、#26の復習リンク/記録trigger、#27の進捗画面を実装しない。

## 関連コード・文書の確認結果

- src/local-data.mjs はキー sfqc:local-data、v1 envelope、500件、1 MiB上限を持つ。restoreQuestionInstanceを使ったsnapshot復元、pure read、JSON export、確認後のraw再読込と1回のsetItemをするimportがある。通常save APIはまだない。v1 read時のmigrationもない。
- src/App.tsx はuseState(readLocalData)で初期データを読む。data画面にJSON import/exportとsnapshot件数がある。学習画面はplaceholder中心で、ReviewEvent triggerはまだない。
- src/question-grading.d.mts の既存unionは正答gradedでfeedback:null、誤答gradedでrule/default feedback、invalidでreason。rule feedbackのmatchedRuleはsingle-choice choiceIdまたはnumericのanswer string。src/question-grading.mjs はrule feedbackをsnapshot.ruleからコピーし、default feedbackをsnapshot.content.defaultFeedbackとsnapshot.lessonRefs[0]から作る。保存validatorは再gradeせず、格納値の枝とこれらのsnapshot参照先を照合する方針にする。
- src/lesson-contract.mjs にはlesson IDまたはlessonId#sectionIdを構文解析するparseLessonRefと正規表現があるが非公開。公開関数として型宣言を追加しlocal-dataから再利用する計画。Lesson registry lookupは別責務であり、ReviewEventの保存検証には使わない。現行registryにはplanned/included状態があるため存在依存にすると教材改訂後の履歴を壊す。
- src/question-contract.mjs のsnapshot validatorはLessonRefの構文を検証し、現行registryの存在を要求しない。src/lesson-contract.mjs はsource.checkedAtの日付文字列についてparse後のISO日付往復を検証するが、attempt/review日時のvalidatorはない。日時はlocal-data側に厳密なUTC timestamp validatorを追加し、Date.toISOString()との完全一致で実在日付も確かめる。
- src/resolve-screen.mjs は固定6 routeを解決し、未知routeをnot-foundにする。src/App.tsxのnot-found画面は学習マップへのリンクを持つ。LessonRef用dynamic route回復はまだないので、#22は既存のgeneric fallbackへ導線を統合せず、#23/#24/#26が後続UIで再利用する。
- docs/MVP_DESIGN_DRAFT.md §4.5/§5.1にfeedback union・snapshot・attempt、§6〜8に節復習と戻り経路があるが、ReviewEventの定義/訪問意味はまだ不足。既存LessonRef一般の解決条件を変更せず、履歴targetだけ構文検証にする例外を明記する。
- docs/P2_IMPLEMENTATION_PLAN.mdのPR分割は#22保存、#23復帰state、#26復習loop、#27集計の順で、境界の補足に使える。docs/TECH_STACK_DECISION.mdには#9 v1/1 MiBが記録されているため、歴史的決定を残して#22 v2/2 MiBを追記する。
- npm run checkはlocal-data.test.mjs等を実行し、npm run buildとPages workflowは既存check/buildを通す（この更新では実行していない）。

## 既存の計画レビュー（前回1回）を維持した対応

1. 通常saveでは保存中の破損/未対応rawを上書きしない。S4とS6で読み取り可能rawへの置換は確認付きimportだけ、storage自体unreadableなら拒否。
2. read/exportはpure、migrationは描画後effect、cancel時raw保持、migration失敗dataのbackup exportはS3/S5/S6。
3. 回答・採点結果のsnapshot整合、feedback分岐、numeric原文保持はS2/S7。
4. 手動JSON cleanupは元backup保管→複製編集→参照するattempt/eventも除外→確認付きimportをS6/S8。
5. v1 rawは新serializerを通さないJSON.stringify fixture、実snapshotを増やした旧1MiB級testはS7。

## 今回のユーザー追加4点の反映

| 指摘 | 反映 |
|---|---|
| P1-1: 通常saveによる履歴喪失・同時変更 | S4で3配列を順序/内容保持のprefixとし、削除・改変・並べ替え・ID再利用を拒否。save開始rawを読み、検証/size check後の直前再読込とraw/status比較をする。旧候補、同ID変更、途中変更test。confirmed importだけが意図的な整理を許す。 |
| P1-2: ReviewEvent意味/発生条件 | S1/S2/S9で誤答attempt起点の明示訪問記録と定義し、完了証拠・自主復習でないこと、1明示遷移=1event、同target明示再訪は新event、render/Back/Forward/reload/returnはeventを増やさないことを整理。実triggerは#26、stackは#23、集計は#27。 |
| P2-1: past grading reference integrity | #21の既存型のまま、S2/S7でmatchedRuleがsnapshot.ruleに存在し、explanation/lessonRefと一致すること、defaultがdefaultFeedback/snapshot.lessonRefs[0]と一致することを検査。正誤を再計算しない。 |
| P2-2: registry独立のLessonRef/実日付 | S1/S2で既存private parseLessonRefを型付きで公開して再利用する。registry lookupをしない。checkedAtはdate-only既存validatorのみなのでtimestamp helperはlocal-dataに追加、strict ISO UTC + toISOString roundtripとする。S7でremoved target受入・calendar boundary tests。UI回復は既存not-found→map fallbackを後続route UIで再利用。 |

## 未実施・残る限界

今回の作業では実装・test runner・ブラウザpreview・GitHubコメント編集をしない。Back/Forward/reloadのイベント重複防止は#23/#26の実画面/trigger実装時に分けて試験し、#22の保存schema検証PASSへ含めない。最終raw比較とsetItemの間にある複数tab raceはWeb Storageで原子的に防げないため、完全CAS/lockを約束しない。

## 更新後の投稿本文（別ファイルに同内容で保存、未投稿）

## 実装計画（保存契約・復習イベント・検証条件を明確化）

Issue #8のQuestionInstance snapshotと#9のブラウザ内保存v1を維持しながら、#21の採点結果・解答試行・復習訪問を安全に保存します。localStorageキー sfqc:local-data を維持し、v2 envelopeは { schemaVersion: 2, questionInstances: [], answerAttempts: [], reviewEvents: [] } とします。500件instance上限は維持し、2 MiBを旧1 MiBデータの移行余地と履歴用余地を持つアプリ上限とします。増加分すべてがmigrationに必要という意味ではなく、ブラウザのquota保証でもありません。

計画レビューを1回実施し、その指摘を反映しました。これは計画更新であり、実装・テスト完了を意味しません。

### データ契約と責務

- AnswerAttemptは attemptId / instanceId / answer / gradingResult / attemptedAt。gradingResultは#21の既存graded unionに限定し、invalidは保存しません。正答はfeedback=null、誤答はfeedback必須です。single-choice answerはsnapshot内choice ID、numeric answerは#21と同じ十進文法でtrim後の値を検証し、原文（例: " +1.030 "）を保ちます。
- 過去の正誤は再計算しません。rule feedbackではmatchedRuleが対象snapshotのfeedbackRulesに実在し、choiceIdまたは数値ruleのanswerがそのruleと一致し、explanationとlessonRefもruleと完全一致することを確認します。default feedbackはmatchedRuleを持たず、explanationがsnapshot.content.defaultFeedback、lessonRefがsnapshot.lessonRefs[0]と一致することを確認します。判定構造・参照先を検証し、gradeQuestionAnswerを再実行して正誤を上書きしません。
- ReviewEventは reviewEventId / targetRef / sourceAttemptId / reviewedAt。これは、存在する誤答attemptを起点として、利用者が復習先へ明示的に遷移した訪問記録です。理解・復習完了の証拠ではありません。1回の明示遷移につき1件、同じtargetを明示再訪すれば別eventとし、多段復習もすべて起点の誤答attemptを参照します。sourceAttemptIdが正答またはinvalid attemptなら拒否します。単なる再描画、Back/Forward、reload、復帰では増やさず、自主復習は今回の記録対象外です。
- #22はReviewEventの型・validator・保存APIを提供します。実際の記録triggerは#26、URLと復帰stackは#23、訪問件数を履歴から集計するのは#27です。#23の状態復帰や#27の進捗はeventを新規発生させず、#27は訪問を復習完了・習熟の証拠として扱いません。#25の回答UIと#26の復習リンク/記録triggerは#22の実装範囲外です。
- targetRefは既存LessonRefの文字列表記（lessonIdまたはlessonId#sectionId）の構文だけを検証し、現在のlesson registryへの存在確認はしません。教材の改訂・削除で過去履歴を無効にしないためです。教材が見つからない場合は表示側が回復導線を出します。現行UIは固定routeのみで、未知routeをnot-foundから学習マップへ戻す既存fallbackがあります。#22で新しい教材画面や回復UIは追加せず、後続の#23/#24/#26がその既存fallbackを利用します。
- attemptedAt / reviewedAtはUTCのDate.toISOString()形式（YYYY-MM-DDTHH:mm:ss.sssZ）に限定し、Date.parseの成否だけに頼らず、Date.toISOString()との完全一致で実在日時を検証します。オフセット表記、2月30日、存在しない閏日などは拒否します。
- 通常saveは追記のみです。保存開始時点の有効データにある各配列の要素は、配列順序を保ち、JSON objectのkey順を無視した構造上の等価性で候補のprefixに保持します。既存要素の削除/改変/並べ替え/ID再利用は拒否し、新しい一意IDの要素のみ末尾へ追加できます。JSON整形やobject key順だけの違いは履歴改変とはみなしません。履歴要素の構造比較ではkey順を無視しますが、保存競合検知は保存開始時と書込直前のraw文字列完全一致で行います。意図的な履歴削除やJSON整理は、読み取り可能なrawに対する確認付きimportだけで行い、storage自体が読めない場合は置換も拒否します。
- safe saveは開始時rawを読み、候補を全体検証・追記比較・serialize・サイズ検査した後、setItem直前に同じstorageを再読込します。statusとrawが開始時から変わっていたらstorage-changedとして書込を中止します。単一setItemを使い、quota/write失敗では元rawを保持します。最終再読込からsetItemまでの複数tab競合を原子的に防ぐCAS/lock保証はありません。

### 実装段階

1. **型とAPI契約** — 対象: src/local-data.d.mts、src/lesson-contract.d.mts。AnswerAttempt/ReviewEvent/v2 envelope/save/read/migration/import結果を宣言します。既存の非公開parseLessonRefを再利用できるようLessonRef構文parserを型付きで公開する契約を加えます。#25/#26の回答・復習UIやtriggerは追加しません。  
   **完了条件:** v1/v2とエラー状態、追記save、ReviewEventのsource reference、LessonRef構文parserを型で表現します。

2. **全体parserとvalidator** — 対象: src/local-data.mjs、src/local-data.d.mts、src/lesson-contract.mjs、src/lesson-contract.d.mts、scripts/local-data.test.mjs、scripts/lesson-contract.test.mjs。v1/v2 exact envelope、QuestionInstance、ID一意性、instance/attempt/event参照、single-choice/numeric answer、graded union、snapshotに対するrule/default feedback一致、UTC実在日時を検証します。ReviewEventは同じLocalData内のgraded incorrect attemptを参照し、LessonRef parserで表記を検証します。registry lookupはしません。  
   **完了条件:** 正答source attempt、未定義matchedRule、説明/参照の不一致、壊れたLessonRef、存在しない実日付を拒否し、registryから消えたが表記の正しいtargetRefは受け入れます。

3. **副作用のない初期read/export** — 対象: src/local-data.mjs、src/local-data.d.mts、scripts/local-data.test.mjs。readLocalDataはmissing/v2/valid-v1/invalid/unsupported-version/unreadableをpure readで返します。v1はmemory上でsnapshotを変えずv2 envelopeへ正規化します。migration未保存の検証済みdataもv2 backupとしてexportできます。  
   **完了条件:** Appの初期read、read/export、import確認前のreadでsetItem 0回。migration失敗後の検証済みdataもexport可能です。

4. **通常saveの追記不変性とraw競合検出** — 対象: src/local-data.mjs、src/local-data.d.mts、scripts/local-data.test.mjs。まず保存開始rawを読み、unreadable/invalid/corrupt/unsupportedなら拒否します。有効v1はsnapshotを維持し履歴配列が空のv2 baselineとして比較します。候補の3配列すべてについてbaselineの要素が同じ配列順序でprefixに残ることを要求し、要素の内容はJSON object key順を無視した構造上の等価比較で照合します。JSON整形やkey順だけの違いは履歴改変とはみなしません。末尾に新規一意IDのみ追加できます。schema migration v1→v2は許可します。serializeと2 MiB検査後、setItem直前にraw/statusを再取得し、開始時rawと書込直前rawが文字列として完全一致しない場合、またはstatusが変わった場合はstorage-changedで中止します。raw完全一致は保存競合の検出にのみ使い、履歴要素の構造同等性とは区別します。  
   **完了条件:** 保存済み10件に対し古いUI候補8件+新規1件を拒否しraw不変/write 0回。全配列の削除・既存ID内容変更・並べ替えを拒否。正当な追記は単一setItem。保存途中にrawを変えた場合はsetItem 0回。write/quota失敗時にstorage APIが既存rawを保持することを検査します。

5. **描画後の明示的v1昇格** — 対象: src/local-data.mjs、src/local-data.d.mts、src/App.tsx、scripts/local-data.test.mjs。既存readが返した期待rawがまだ同じv1のときだけ、render後useEffectから昇格します。S4の追記保護とraw再読込を経由し、questionInstancesを順序・内容とも保持して空attempt/event配列を付けます。useState initializerでは書きません。write failureは元rawと検証済みv2 dataをmigration-failedで返し、件数表示とbackup exportを維持します。  
   **完了条件:** 初期read 0 write、v1 migration成功1 write、再実行で追加writeなし。migration failure後のbackupを別storageにrestoreできることを確認します。

6. **確認付きimport/export** — 対象: src/local-data.mjs、src/local-data.d.mts、src/App.tsx、scripts/local-data.test.mjs。v1/v2 fileを検証・v2正規化して全体を単一置換します。importは手動JSON整理を含む明示的な置換経路であり、削除/改変を許すのは利用者確認後のみです。確認前のreadと確認後のraw再読込で変更を検出し、storage自体がunreadableなら置換しません。  
   **完了条件:** cancel、invalid import、確認中のraw変更、quota/write失敗は置換しない。手動部分集合は参照整合する場合だけconfirmed importでき、attemptを除くならそのattempt参照eventも除く必要があります。

7. **fixtureと境界テスト** — 対象: scripts/local-data.test.mjs、scripts/question-contract.fixture.mjs、scripts/lesson-contract.test.mjs。v1 rawはJSON.stringify(v1Fixture)で作りschemaVersion 1をassert。実snapshotのpromptを増やした有効約1 MiB v1を昇格してsnapshot同一を確認。v2複数attempt/event、同一targetの別event、numeric原文 " +1.030 "、追記正常/古いUI候補・削除・改変・並べ替え拒否、save途中raw変更、正答sourceAttempt拒否を検査します。matchedRuleの存在・format・explanation・lessonRef不一致とdefault feedback不一致、registryから消えたtargetRefの受入、閏日/2月30日/UTC offset/Z欠落を検査します。migration failure後のexport/restoreも確認します。  
   **完了条件:** 既存npm run check経由で実行され、legacy v1 testが新serializerでv2化しません。

8. **既存データ管理UIと手動整理案内** — 対象: src/App.tsx、必要な場合のみsrc/index.css。instance/attempt/event件数、schema v2、500件/2 MiB上限、migration/import/save失敗を表示します。容量整理案内は未編集backupを保管→複製編集→instance/attempt除外時に参照するattempt/eventも除外→確認付きimportの順にします。見つからないtargetRefは保存validatorで消さず、実際のリンク表示を担う後続UIが既存のnot-found→学習マップfallbackを使います。  
   **完了条件:** 手動削除は確認付きimportに限定され、除外履歴は現在の進捗から消えると表示。browser quotaや設定の解決は保証しません。#22に新しいlesson導線や削除UIは加えません。

9. **仕様文書** — 対象: docs/MVP_DESIGN_DRAFT.md §5/§6/§7/§8、docs/TECH_STACK_DECISION.md、必要な責務境界の記述はdocs/P2_IMPLEMENTATION_PLAN.md。AnswerAttempt feedbackをsnapshotの該当rule/defaultと照合する保存validator方針、ReviewEventを「誤答起点の明示訪問記録」とする意味、表記syntaxのみのtargetRef、UTC実在日時、追記save/確認付きreplace、v1 migrationを記録します。#23はURL/back-stack、#26はfeedbackからの訪問trigger、#27はvisit eventの導出表示であり完了/習熟証拠ではないと整理します。既存の#9 v1/1 MiB決定履歴は保持します。

10. **CIと後続Issue境界の検証** — 対象: package.json、.github/workflows/pages.yml、production preview。scripts/local-data.test.mjsとlesson-contract testsはnpm run checkに登録済みで、npm run buildとPages workflowにも接続済みのため、現状どおりなら新script/workflowは不要です。npm run check、npm run build、git diff --checkと隔離profileでv1/v2 import/export/reload・件数・cancel/accept・keyboard・320 CSS px・外部通信なしを確認します。#22では保存後の履歴往復とmigrationを検証します。Back/Forward/reloadがeventを増やさないこと、明示復習遷移1回につき1 event・同target明示再訪は別eventであることは、#23/#26の該当route/trigger実装時に別途testし、未実装機能を#22のPASSに含めません。#27はevent数を訪問数として集計し、完了判定と混同しません。

### 受入条件との対応

- v1非空snapshot→v2→export/import→reloadでsnapshot同一: 段階2–3、5–7。
- v2非空snapshotと複数attempt/eventを完全往復し、ID参照・重複・日時・欠落先を検査: 段階1–3、6–7。
- 正常v2への古い候補、履歴削除/改変、途中raw変更がrawを上書きしない: 段階4–5、7。
- malformed JSON、破損v1/v2、unsupported、quota/write/cancelで保存raw保持: 段階3–7。
- ReviewEventは誤答起点・明示訪問のみ。sourceAttemptが正答なら拒否し、targetRefの構文と履歴保存は現在registryに依存しない: 段階1–2、7、9。
- feedbackは対象snapshotの実在rule/defaultと一致し、過去正誤を再計算しない: 段階2、7、9。
- 自動履歴削除なし・整理手順・外部送信なし: 段階6、8、10。
- Back/Forward/reloadによるevent重複防止を後続Issueで確認: #23/#26の実装・試験範囲。#22は保存schemaのテストまで。
- v1テスト回帰なし、CI接続、未確認browser項目をPASS扱いしない: 段階7、10。

### 変更しない範囲

#25の回答UI/attempt trigger、#23のID付きURLと復帰stack、#26のfeedback画面・復習遷移/ReviewEvent trigger、#27の進捗集計UIは後続Issueです。#22ではAPI・schema・validator・既存データ管理UIを整備します。クラウド/IndexedDB移行・履歴自動破棄・完了/習熟推定・独自LessonRef recovery UIは追加しません。

localStorageのsetItemはquota確認後に値を更新する仕様ですが、ブラウザquotaは2 MiBアプリ上限と別です。複数tabでの最終raw比較後からsetItemまでを原子的にする保証もありません（[WHATWG HTML Standard — Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html#the-storage-interface)）。
