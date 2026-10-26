# PR #35 ブラウザー手動チェック

対象: PR #35 / `codex/issue-21-question-grading` / `b977d3c`

URL: http://127.0.0.1:5173/SfQC/

## 画面

- [ ] URLを開き、SfQCの学習マップが表示される。
- [ ] 「単元解説へ」を開き、「範囲と分散」の図・説明が表示される。観測値 1.000 / 2.200 / 3.000 mm、平均、各偏差、偏差平方和が読める。
- [ ] ブラウザー幅を320 CSS pxにして、説明の欠落・重なり・横スクロールがないことを確認する。続けて表示倍率200%でも図と説明を確認する。
- [ ] Tabで移動し、スキップリンクと画面内リンクが使える。図自体に不要なフォーカス停止がない。
- [ ] DevTools Consoleに赤いエラーがなく、ページ表示に必要な外部通信が発生していない。

## 採点API（画面からの採点は未接続）

「単元解説」画面を開いた状態で DevTools Console に貼り付ける。1.013 は正答、1.018 は誤答、0.676 は分母 n を使った誤答理由が返ることを確認する。

```js
const [{ getQuestionDefinition }, { createQuestionInstance }, { gradeQuestionAnswer }] = await Promise.all([
  import('/SfQC/src/question-registry.mjs'),
  import('/SfQC/src/question-contract.mjs'),
  import('/SfQC/src/question-grading.mjs'),
]);
const instance = createQuestionInstance(getQuestionDefinition('q-desc-var-num-001'), { instanceId: 'pr35-manual-check' });
const results = ['1.013', '1.018', '0.676'].map((answer) => {
  const result = gradeQuestionAnswer(instance, answer);
  return { answer, revision: instance.questionDefinitionRevision, isCorrect: result.isCorrect, feedback: result.feedback?.explanation ?? '' };
});
console.table(results);
console.assert(results[0].isCorrect === true && results[1].isCorrect === false && results[2].isCorrect === false && results[2].feedback.includes('n=3'), '採点結果が期待値と異なります');
```

演習画面には回答入力・採点結果のUIがまだありません。このsnippetはブラウザー上の採点APIを直接確認するものです。
