import { LessonReference } from './lesson-view'

type PreviewSection = { sectionId: string; title: string }

export function DescriptiveStatisticsPreview({ sections, currentLessonHref }: {
  sections: readonly PreviewSection[]
  currentLessonHref: string
}) {
  return <section className="lesson-panel descriptive-statistics-preview" aria-label="基本統計量の比較用モック">
    <p>これは一時的な比較用モックです。ここでの操作状態は保存されません。</p>
    <div className="lesson-observation">
      <h2>同じ平均でも、測定値の散らばりは同じでしょうか</h2>
      <p>AとBは異なる工程です。それぞれの工程で作られる製品全体から、製品を3個ずつ独立に無作為抽出し、1個につき1回、寸法を測定しました。AとBの値を見比べ、平均だけで散らばりの違いまで説明できるか考えながら読み進めてください。</p>
      <table>
        <caption>製品寸法の測定値</caption>
        <thead><tr><th scope="col">系列</th><th scope="col">測定値（mm）</th></tr></thead>
        <tbody>
          <tr><th scope="row">A</th><td>1.000、2.200、3.000</td></tr>
          <tr><th scope="row">B</th><td>1.800、2.000、2.400</td></tr>
        </tbody>
      </table>
    </div>
    {sections.map((section) => <section
      className="lesson-observation descriptive-statistics-preview-section"
      id={section.sectionId}
      aria-labelledby={`preview-${section.sectionId}-title`}
      key={section.sectionId}
    >
      <h2 id={`preview-${section.sectionId}-title`}>{section.title}</h2>
      {section.sectionId === 'mean' && <>
        <p>Aの値を合計して3で割ると、(1.000 + 2.200 + 3.000) / 3 = 6.200 / 3 = 31/15 ≈ 2.067 mmです。Bも (1.800 + 2.000 + 2.400) / 3 = 31/15 ≈ 2.067 mmになり、平均は同じです。</p>
        <p>このように、数値の差が意味を持つ同じ種類の量をまとめるとき、合計を個数で割った値を算術平均として使います。平均の単位は測定値と同じmmです。</p>
        <p>対象全体の平均を母平均 μ、観測した一部（標本）の平均を標本平均 x̄ と書きます。どちらも「値を足して個数で割る」計算です。一般には <code>μ = (Σ<sub>i=1</sub><sup>N</sup> x<sub>i</sub>)/N</code>、<code>x̄ = (Σ<sub>i=1</sub><sup>n</sup> x<sub>i</sub>)/n</code> と表します。Σの下の i=1 は足し始める位置、上の N や n は足し終わる位置です。母平均は母集団のN個、標本平均は標本のn個の値を足します。<LessonReference targetRef="math-algebra-sigma#sigma" label="総和記号の読み方" />も参照できます。</p>
        <p>AとBは平均が同じでも、平均だけでは値の広がり方を表せません。次は各測定値が平均からどちらへどれだけ離れているかを見ます。</p>
        <aside className="lesson-check-question" aria-label="平均の理解確認">
          <strong>理解確認</strong>
          <p>別ロットの寸法が 9.8 mm、10.1 mm、10.4 mm でした。この3点の算術平均を求め、単位も書いてください。</p>
        </aside>
      </>}
      {section.sectionId === 'deviation' && <>
        <p>平均31/15 mmと比べると、Aの1.000 mmは平均より下、2.200 mmと3.000 mmは上にあります。測定値から平均を引くと、それぞれ −16/15 mm、2/15 mm、14/15 mmです。Bでは −4/15 mm、−1/15 mm、5/15 mmになります。このように平均からの距離を符号付きで表した差を偏差と呼びます。</p>
        <p>値と平均は、同じ種類の量・単位で、同じ対象を表している必要があります。偏差は「測定値 − 平均」という符号付きの差で、今回はどれもmmです。</p>
        <p>AもBも、正の偏差と負の偏差を足すと合計は0 mmです。平均を基準にすると上下の偏差が打ち消し合うため、偏差をそのまま足した値では散らばりの大きさを比べられません。次は偏差を二乗してから足します。</p>
        <aside className="lesson-check-question" aria-label="偏差の理解確認">
          <strong>理解確認</strong>
          <p>別の測定では平均が20.0 mmで、3つの値は19.4 mm、20.0 mm、20.6 mmでした。それぞれの偏差の符号と値を考えてください。</p>
        </aside>
      </>}
      {section.sectionId === 'variance' && <>
        <p>まず範囲は、最大値から最小値を引いた幅です。Aの範囲は 3.000 − 1.000 = 2.000 mm、Bは 2.400 − 1.800 = 0.600 mmです。最初の問いに戻ると、Aの測定値のほうが広く散らばっています。平均が同じかどうかだけでは分からなかった違いです。</p>
        <p>範囲は端の2点しか使いません。たとえばC=[1.0, 2.0, 3.0] mmとD=[1.0, 1.1, 3.0] mmは、どちらも範囲が2.0 mmですが、途中の値が違います。そこで、全ての値を平均からの距離で比べる分散も見ます。偏差をそのまま足すと正負が打ち消し合うため、偏差を二乗してから足します。二乗するので単位は mm² です。Aの偏差平方和は (−16/15)² + (2/15)² + (14/15)² = (256 + 4 + 196)/225 = 152/75 mm²、Bは 14/75 mm²です。</p>
        <p>この3個の製品そのもののばらつきを記述する分散は、偏差平方和を n=3 で割ります。Aは (152/75)/3 = 152/225 ≈ 0.676 mm²、Bは 14/225 ≈ 0.062 mm²です。対象全体の製品すべてを測定した場合は、偏差平方和を個数 N で割ったものが母分散です。</p>
        <p>一方、工程全体の製品寸法のばらつきを標本から推定するには、各工程内の製品寸法が同じ分布に従い、測定した3個がその分布から互いに独立に抽出されていること（母分散が有限、n≥2）が条件です。この場合は不偏分散として偏差平方和を n−1=2 で割り、Aは 76/75 ≈ 1.013 mm²、Bは 7/75 ≈ 0.093 mm²と推定します。</p>
        <p>標本平均を使って偏差を計算すると偏差平方和は小さくなりやすく、nで割るだけでは母分散を平均的に小さく見積もります。n−1で割る補正により、同じ条件の標本を繰り返したとき、不偏分散の平均は母分散に一致します。「不偏」は1回の推定値が真の値に一致したり、必ず近かったりする意味ではありません。n=3では推定の不確実性も大きく、この例の3点だけで工程全体の品質や能力は判断できません。</p>
        <p>途中で丸めず、表示する最後の値だけを丸めます。平均からΣの計算をもう一度確認したい場合は、<LessonReference targetRef="math-algebra-sigma#sigma" label="総和記号の読み方" />を復習できます。</p>
        <aside className="lesson-check-question" aria-label="分散の理解確認">
          <strong>理解確認</strong>
          <p>ある工程から無作為に独立抽出した5個の製品寸法で工程全体の分散を推定します。偏差平方和を何で割るか、またその分母を選ぶ理由を考えてください。</p>
        </aside>
      </>}
      {section.sectionId === 'standard-deviation' && <>
        <p>分散は二乗した偏差を使うので単位が mm² です。その平方根をとると、測定値と同じmmに戻ります。この量を標準偏差と呼び、散らばりを元の測定単位で表します。平方根の計算に迷ったら、<LessonReference targetRef="math-powers-roots" label="平方根の復習" />を確認できます。</p>
        <p>Aを3点そのものとして記述する標準偏差は √(152/225) ≈ 0.822 mm、Bは √(14/225) ≈ 0.249 mmです。標本から母分散を推定するときに不偏分散を使う場合は、そこから計算した標準偏差はAが √(76/75) ≈ 1.007 mm、Bが √(7/75) ≈ 0.306 mmです。</p>
        <p>標準偏差は、偏差の絶対値を平均したものではありません。また、分布の形などの条件が分からないまま「大半の値が平均から標準偏差以内にある」とは言えません。不偏分散の平方根も、一般には母標準偏差の不偏推定量とは限りません。</p>
        <aside className="lesson-check-question" aria-label="標準偏差の理解確認">
          <strong>理解確認</strong>
          <p>別の寸法データの分散が 0.81 mm² でした。標準偏差の値と単位を考え、分散の単位との違いを説明してください。</p>
        </aside>
      </>}
    </section>)}
    <p><a href={currentLessonHref}>現行版を表示</a></p>
  </section>
}
