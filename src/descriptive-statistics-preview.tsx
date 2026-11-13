import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { LessonReference } from './lesson-view'
import {
  generateDescriptiveStatisticsPreviewExercise,
  nextPreviewExerciseIndex,
  previewExerciseDefinitions,
} from './descriptive-statistics-preview-exercises.mjs'
import type { PreviewExerciseId } from './descriptive-statistics-preview-exercises.mjs'
import { InteractiveVarianceComparison, VarianceSimulation } from './figures/interactive-variance-comparison'
import { gradeDecimalAnswer } from './question-grading.mjs'
import previewStyles from './descriptive-statistics-preview.css?inline'
import interactiveStyles from './figures/interactive-variance-comparison.css?inline'

type PreviewSection = { sectionId: string; title: string }

const exerciseTitles: Record<PreviewExerciseId, string> = {
  mean: '平均',
  deviation: '偏差',
  variance: '偏差平方和と不偏分散',
  'standard-deviation': '標準偏差',
}

function normalizeNumericInput(text: string) {
  return text.normalize('NFKC').replace(/−/gu, '-')
}

function scrollToPreviewSection(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault()
  const targetId = event.currentTarget.getAttribute('href')?.slice(1)
  const target = targetId ? event.currentTarget.ownerDocument.getElementById(targetId) : null
  const heading = target?.querySelector<HTMLElement>('h2')
  if (!heading) return
  heading.focus({ preventScroll: true })
  heading.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
}

function PreviewExerciseCard({ id }: { id: PreviewExerciseId }) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [index, setIndex] = useState(previewExerciseDefinitions[id].initialIndex)
  const [values, setValues] = useState<string[]>([])
  const [feedback, setFeedback] = useState({ kind: '', text: '' })
  const exercise = generateDescriptiveStatisticsPreviewExercise(id, index)

  return <aside
    className="lesson-check-question descriptive-statistics-preview-exercise"
    aria-label={`${exerciseTitles[id]}の理解確認`}
    data-preview-exercise={id}
    data-preview-exercise-index={index}
  >
    <h3>確かめてみよう：{exerciseTitles[id]}</h3>
    <p className="ds-exercise-prompt">{exercise.prompt}</p>
    <div className="ds-exercise-fields">{exercise.fields.map((field, fieldIndex) => {
      const inputId = `preview-${id}-${fieldIndex}`
      return <label key={field.label} htmlFor={inputId}>
        {field.label}
        <input
          id={inputId}
          inputMode="decimal"
          autoComplete="off"
          type="text"
          value={values[fieldIndex] ?? ''}
          onChange={(event) => setValues((current) => exercise.fields.map((_, currentIndex) => currentIndex === fieldIndex ? event.target.value : current[currentIndex] ?? ''))}
        />
        <span>{field.unit}</span>
      </label>
    })}</div>
    <div className="ds-exercise-actions">
      <button type="button" className="ds-button ds-button-primary" onClick={() => {
        const results = exercise.fields.map((_, fieldIndex) => gradeDecimalAnswer(
          normalizeNumericInput(values[fieldIndex] ?? ''), exercise.answers[fieldIndex], 0,
        ))
        if (results.some((result) => result.status === 'invalid')) {
          setFeedback({ kind: 'ng', text: '入力形式を確認してください（例：12、−2、+3）。' })
          return
        }
        const incorrectFields = results.flatMap((result, fieldIndex) =>
          result.status === 'graded' && !result.isCorrect ? [exercise.fields[fieldIndex].label] : [])
        setFeedback(incorrectFields.length
          ? { kind: 'ng', text: `合っていないのは「${incorrectFields.join('」「')}」です。「考え方を見る」で途中の計算を確かめられます。` }
          : { kind: 'ok', text: '正解です。' })
      }}>答え合わせ</button>
      <button type="button" className="ds-button" onClick={() => {
        if (detailsRef.current) detailsRef.current.open = false
        setIndex((current) => nextPreviewExerciseIndex(id, current))
        setValues([])
        setFeedback({ kind: '', text: '' })
      }}>別の数値で</button>
    </div>
    <p className={`ds-exercise-feedback ${feedback.kind}`} role="status" aria-live="polite">{feedback.text}</p>
    <details ref={detailsRef}>
      <summary>考え方を見る</summary>
      <p className="ds-exercise-solution" data-preview-exercise-answer>{exercise.solution}</p>
    </details>
  </aside>
}

function SectionDetails({ children, title }: { children: ReactNode; title: string }) {
  return <details className="ds-more">
    <summary>{title}</summary>
    <div>{children}</div>
  </details>
}

export function DescriptiveStatisticsPreview({ sections, currentLessonHref, practicePreviewHref }: {
  sections: readonly PreviewSection[]
  currentLessonHref: string
  practicePreviewHref: string
}) {
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `${previewStyles}\n${interactiveStyles}`
    document.head.append(style)
    return () => style.remove()
  }, [])

  const sectionTitles: Record<string, string> = {
    mean: '平均：データの中心を1つの数で言う',
    deviation: '偏差：1本ずつ、平均からのずれを見る',
    variance: '分散：ずれの大きさを、打ち消さずにまとめる',
    'standard-deviation': '標準偏差：単位を mm に戻す',
  }

  return <section className="lesson-panel descriptive-statistics-preview" aria-label="基本統計量の比較用モック">
    <div className="descriptive-statistics-preview-content">
      <header className="ds-preview-header">
        <p className="ds-preview-lead">シャフトの長さの測定データ1組を使って、平均、偏差、分散、標準偏差を順に作っていきます。図の点は動かせます。各節の最後に、自分で計算する問題があります。</p>
        <nav className="ds-section-nav" aria-label="節の一覧">
          {sections.map((section, index) => <a key={section.sectionId} href={`#${section.sectionId}`} onClick={scrollToPreviewSection}>{index + 1} {section.sectionId === 'standard-deviation' ? '標準偏差' : section.sectionId === 'variance' ? '分散' : section.title}</a>)}
          <a href="#preview-summary" onClick={scrollToPreviewSection}>まとめ</a>
        </nav>
      </header>

      <section className="ds-intro" aria-labelledby="preview-intro-title">
        <h2 id="preview-intro-title">2つのラインの測定結果</h2>
        <p>目標の長さが 100 mm のシャフトを、ライン A とライン B で作っています。それぞれから3本ずつ取り出して、長さを測りました。</p>
        <div className="ds-table-wrap">
          <table>
            <caption>測定した長さ（mm）</caption>
            <thead><tr><th scope="col">ライン</th><th scope="col">1本目</th><th scope="col">2本目</th><th scope="col">3本目</th></tr></thead>
            <tbody>
              <tr><th scope="row"><span className="ivc-tag">A</span></th><td className="num">98</td><td className="num">100</td><td className="num">102</td></tr>
              <tr><th scope="row"><span className="ivc-tag ivc-tag-b">B</span></th><td className="num">99</td><td className="num">100</td><td className="num">101</td></tr>
            </tbody>
          </table>
        </div>
        <p className="ds-ask">平均を計算すると、A も B も 100 mm です。この2つのラインは、同じ品質だといえるでしょうか。</p>
        <p>値を見比べると、A のほうが 100 mm から離れた値を出しているように見えます。この「離れ方」を数字にする道具が、これから学ぶ偏差・分散・標準偏差です。まず平均から確認します。</p>
      </section>

      {sections.map((section, index) => {
        const sectionId = section.sectionId
        const title = sectionTitles[sectionId] ?? section.title
        return <section
          className="lesson-observation descriptive-statistics-preview-section ds-section"
          id={sectionId}
          aria-labelledby={`preview-${sectionId}-title`}
          key={sectionId}
        >
          <span className="ds-stepno">{index + 1} / 4</span>
          <h2 id={`preview-${sectionId}-title`} tabIndex={-1}>{title}</h2>
          {sectionId === 'mean' && <>
            <p className="ds-ask">3本の長さの「中心」は、数直線のどこにあるでしょう。</p>
            <InteractiveVarianceComparison mode="mean" />
            <p>▲の位置は、値を全部足して個数で割ると求まります。</p>
            <div className="ds-calc">
              <p><strong>A</strong><span>(98 + 100 + 102) ÷ 3 = 300 ÷ 3 = 100 mm</span></p>
              <p><strong>B</strong><span>(99 + 100 + 101) ÷ 3 = 300 ÷ 3 = 100 mm</span></p>
            </div>
            <p>この結果を<strong>平均</strong>と呼びます。単位は元の値と同じ mm です。A も B も 100 mm なので、平均だけでは2つのラインを区別できません。次は、1本ずつが平均からどれだけ外れているかを見ます。</p>
            <SectionDetails title="もっと正確に（記号と使える条件）">
              <ul>
                <li>調べたい対象全体の平均を<strong>母平均 μ</strong>、実際に測った一部（標本）の平均を<strong>標本平均 x̄</strong>と書きます。</li>
                <li>標本平均は x̄ = (x₁ + x₂ + … + xₙ) ÷ n です。「全部足す」ことを記号 Σ で書いて、x̄ = (Σ xᵢ) ÷ n とも表します。</li>
                <li>平均が使えるのは、値が同じ種類の量で、同じ単位で測られているときです。カテゴリに便宜上つけた番号には使いません。</li>
                <li>平均は、実際の測定値のどれかと一致するとは限りません。</li>
                <li><LessonReference targetRef="math-algebra-sigma#sigma" label="総和記号 Σ の読み方" />も確認できます。</li>
              </ul>
            </SectionDetails>
            <PreviewExerciseCard id="mean" />
          </>}
          {sectionId === 'deviation' && <>
            <p className="ds-ask">A の 98 mm は、平均の 100 mm からどちらへ、どれだけ外れているでしょう。</p>
            <InteractiveVarianceComparison mode="deviation" />
            <div className="ds-calc">
              <p><strong>A</strong><span>98 − 100 = −2　100 − 100 = 0　102 − 100 = +2　(mm)</span></p>
              <p><strong>B</strong><span>99 − 100 = −1　100 − 100 = 0　101 − 100 = +1　(mm)</span></p>
            </div>
            <p>「値 − 平均」を<strong>偏差</strong>と呼びます。単位は mm です。A の偏差は ±2 mm、B の偏差は ±1 mm で、A のほうが大きく外れています。</p>
            <p>ところが、偏差を全部足すと A も B も 0 mm になります。正と負が打ち消し合うためです。図の点をどう動かしても、合計は 0 のままです。偏差を足しただけでは、ばらつきの大きさを比べられません。次は、打ち消し合わない方法を考えます。</p>
            <SectionDetails title="もっと正確に（記号と条件）">
              <ul>
                <li>母集団の偏差は xᵢ − μ、標本の偏差は xᵢ − x̄ と書きます。</li>
                <li>値と平均は、同じ量、同じ単位、同じ対象についてのものである必要があります。</li>
                <li>偏差の合計が 0 になるのは、平均が「偏差の合計を 0 にする位置」として決まっているからです。</li>
              </ul>
            </SectionDetails>
            <PreviewExerciseCard id="deviation" />
          </>}
          {sectionId === 'variance' && <>
            <p className="ds-ask">正と負を打ち消さずに、3本分のずれを1つの数にするには、どうすればよいでしょう。</p>
            <p>偏差を2乗すると、負の値も正になります。2乗は、一辺の長さが偏差の正方形の面積とみなせます。</p>
            <InteractiveVarianceComparison mode="variance" />
            <div className="ds-calc">
              <p><strong>A</strong><span>(−2)² + 0² + (+2)² = 4 + 0 + 4 = 8 mm²</span></p>
              <p><strong>B</strong><span>(−1)² + 0² + (+1)² = 1 + 0 + 1 = 2 mm²</span></p>
            </div>
            <p>この合計を<strong>偏差平方和</strong>（記号 S）と呼びます。2乗したので、単位は mm² です。</p>
            <h3 className="ds-subheading">知りたいのは、ロット全体のばらつき</h3>
            <p>調べたい対象の全部を<strong>母集団</strong>、実際に測った一部を<strong>標本</strong>と呼びます。ここでの母集団は、ラインが作るシャフトの全体（ロット全体）です。本当に知りたいのは、この母集団のばらつきで、これを<strong>母分散</strong>と呼びます。</p>
            <p>たとえば、寸法が 98〜102 mm の5種類だけで、どれも同じ割合で入っている、とても大きなロットがあるとします。全部測れるなら、偏差を2乗して平均すれば、母分散が求まります。</p>
            <div className="ds-calc">
              <p><span>平均 100 mm　偏差：−2, −1, 0, +1, +2 (mm)</span></p>
              <p><span>(4 + 1 + 0 + 1 + 4) ÷ 5 = 2 mm²</span></p>
            </div>
            <h3 className="ds-subheading">全部は測れないから、3本から見積もる</h3>
            <p>現実には、ロットの全部は測れません。A と B も、3本だけ取り出した標本です。標本の3本から母分散を<strong>見積もる</strong>ときは、S を n ではなく <strong>n − 1 = 2</strong> で割ります（n は標本の本数）。</p>
            <div className="ds-calc">
              <p><strong>A</strong><span>8 ÷ 2 = 4 mm²</span></p>
              <p><strong>B</strong><span>2 ÷ 2 = 1 mm²</span></p>
            </div>
            <p>この値を<strong>不偏分散</strong>（記号 V）と呼びます。A は 4 mm²、B は 1 mm² で、A のほうがばらついている、と数字で言えます。V は標本から出した<strong>見積もり</strong>で、母分散そのものではありません。標本が変われば、値も変わります。</p>
            <p>n ではなく n − 1 で割るのは、標本の平均が測った3本に合わせて決まるため、平均からのずれが、ロット全体の平均からのずれより小さく出がちだからです。n で割ると母分散を小さめに見積もってしまうので、n − 1 で割ってその分を補います。</p>
            <p>なぜちょうど n − 1 なのかは、QC検定の範囲を超えるため、この教材では説明しません。気になる人は、<a href="https://ja.wikipedia.org/wiki/%E8%87%AA%E7%94%B1%E5%BA%A6" target="_blank" rel="noopener">Wikipedia「自由度」</a>の統計学の説明を見てください。</p>
            <SectionDetails title="確かめてみる：n − 1 で割ると、本当に母分散に合うのか">
              <VarianceSimulation />
            </SectionDetails>
            <SectionDetails title="もっと正確に（分散の使い分けと注意）">
              <ul>
                <li><strong>母分散</strong>（記号 σ²）：母集団の全部を調べたときの分散で、偏差平方和を母集団の個数 N で割ります。</li>
                <li><strong>不偏分散</strong>（記号 V）：標本から母分散を見積もるときに使い、n − 1 で割ります。上の A の 4 mm² と B の 1 mm² がこれです。</li>
                <li><strong>標本内の分散</strong>：測った標本そのものの散らばりを記述するだけなら、n で割ります。A の3本では 8 ÷ 3 ≈ 2.67 mm² です。母分散の見積もりには使いません。</li>
                <li>n − 1 で割ると平均が母分散に一致するのは、同じ母集団から独立に取った標本で、母分散が有限のときです。1回の見積もりが母分散に近いことは保証しません。</li>
                <li>n = 3 は小さな標本です。この3本だけでライン全体の品質は判断できません。</li>
                <li>最大値 − 最小値を<strong>範囲</strong>といいます。A は 4 mm、B は 2 mm です。範囲は両端の2点しか使わないので、途中の値の違いは表せません。</li>
                <li>このページでは、偏差平方和を S、不偏分散を V、標準偏差を s と書きます。</li>
              </ul>
            </SectionDetails>
            <PreviewExerciseCard id="variance" />
          </>}
          {sectionId === 'standard-deviation' && <>
            <p className="ds-ask">分散は mm² で、長さとしては感覚がつかみにくい数です。長さの単位に戻すには、どうすればよいでしょう。</p>
            <p>面積の平方根をとると、辺の長さに戻ります。分散の平方根が<strong>標準偏差</strong>（記号 s）です。</p>
            <div className="ds-calc">
              <p><strong>A</strong><span>s = √4 = 2 mm</span></p>
              <p><strong>B</strong><span>s = √1 = 1 mm</span></p>
            </div>
            <InteractiveVarianceComparison mode="sd" />
            <p>A は平均 100 mm のまわりに約 2 mm、B は約 1 mm の散らばりがある、と読めます。測定値と同じ mm で言えるので、規格や公差と比べやすくなります。</p>
            <SectionDetails title="もっと正確に（読み方の注意）">
              <ul>
                <li>標準偏差は、偏差の絶対値を平均したものではありません。</li>
                <li>分布の形などの条件が分からないまま、「大半の値が平均から s 以内に入る」とは言えません。図の帯は s の長さを見せるもので、点がすべて入る範囲ではありません。</li>
                <li>不偏分散 V の平方根は、母標準偏差の不偏な推定値になるとは限りません。</li>
                <li>母集団全体の標準偏差は σ、標本から計算する標準偏差は s と書きます。</li>
                <li><LessonReference targetRef="math-powers-roots" label="平方根の復習" />を確認できます。</li>
              </ul>
            </SectionDetails>
            <PreviewExerciseCard id="standard-deviation" />
          </>}
        </section>
      })}

      <section className="ds-summary" id="preview-summary" aria-labelledby="preview-summary-title">
        <h2 id="preview-summary-title" tabIndex={-1}>A と B を並べる</h2>
        <p>同じ平均 100 mm でも、散らばりを表す3つの数字ははっきり違います。</p>
        <div className="ds-table-wrap">
          <table className="ds-summary-table">
            <thead><tr><th scope="col">指標</th><th scope="col">A</th><th scope="col">B</th><th scope="col">何を表すか</th></tr></thead>
            <tbody>
              <tr><th scope="row">平均</th><td className="num">100 mm</td><td className="num">100 mm</td><td>データの中心</td></tr>
              <tr><th scope="row">範囲</th><td className="num">4 mm</td><td className="num">2 mm</td><td>最大と最小の幅</td></tr>
              <tr><th scope="row">偏差平方和 S</th><td className="num">8 mm²</td><td className="num">2 mm²</td><td>ずれの2乗の合計</td></tr>
              <tr><th scope="row">不偏分散 V</th><td className="num">4 mm²</td><td className="num">1 mm²</td><td>S ÷ (n − 1)。工程のばらつきの見積もり</td></tr>
              <tr><th scope="row">標準偏差 s</th><td className="num">2 mm</td><td className="num">1 mm</td><td>√V。mm に戻したばらつき</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="ds-current-link"><a href={currentLessonHref}>現行版を表示</a></p>
      <p><a href={practicePreviewHref}>演習の比較用モックを開く</a></p>
      <details className="descriptive-statistics-preview-references">
        <summary>出典・参考資料と確認状況</summary>
        <ul>
          <li>
            <a href="https://webdesk.jsa.or.jp/">JSA「3級のレベル表」Ver.20150130.2、p.1（JSA GROUP Webdeskトップから参照）</a>
            <p>資料URL（参照記録）: <code>https://webdesk.jsa.or.jp/pdf/qc/md_4609.pdf</code></p>
            <p>本文確認日: 2026-11-11。教材registryの前回確認日は2026-10-21。該当箇所: p.1「基本統計量とグラフ」。PDF p.2に「© QM / QC Examination Center, 2019」の表示があり、個別の再利用許諾表示は見当たりません。</p>
            <p>到達確認日: 2026-11-11。公式経路はWebdeskトップ → QC検定 → 各級のレベルと内容 → 3級のレベル表です。サイト条件はトップを原則リンクフリーとし、下位ページは問い合わせを求めています。サービス規約は無承諾のコンテンツ利用とJSAページ/ファイル/画像への直接リンクを禁じています。このmockはトップページだけをリンクします。参照目的は出題範囲との照合で、本文・表・図・設問は転載・翻案していません。</p>
          </li>
          <li>
            <a href="https://webdesk.jsa.or.jp/">JSA「4級のレベル表」Ver.20150130.2、p.1「平均とばらつき」「平均と範囲」（JSA GROUP Webdeskトップから参照）</a>
            <p>資料URL（参照記録）: <code>https://webdesk.jsa.or.jp/pdf/qc/md_4610.pdf</code></p>
            <p>本文確認日: 2026-11-11。教材registryの前回確認日は2026-10-21。該当箇所: p.1「平均とばらつき」「平均と範囲」。PDF p.1に「© QM / QC Examination Center, 2019」の表示があり、個別の再利用許諾表示は見当たりません。</p>
            <p>到達確認日: 2026-11-11。公式経路はWebdeskトップ → QC検定 → 各級のレベルと内容 → 4級のレベル表です。参照目的は出題範囲との照合で、本文・表・図・設問は転載・翻案していません。</p>
          </li>
          <li>
            <a href="https://openstax.org/books/introductory-statistics-2e/pages/2-7-measures-of-the-spread-of-the-data">OpenStax, Barbara Illowsky / Susan Dean, Introductory Statistics 2e, §2.7 (2023)</a>
            <p>本文確認日・到達確認日: 2026-11-11。書籍詳細からView onlineを開き、目次の第2章 → §2.7へ進みました。公式経路は<a href="https://openstax.org/">OpenStaxトップ</a> → Browse the free library → Subjects → Math → Statistics → <a href="https://openstax.org/details/books/introductory-statistics-2e">Introductory Statistics 2e</a> → View online → §2.7です。</p>
            <p>Web版<a href="https://openstax.org/books/introductory-statistics-2e/pages/preface">Preface</a>のライセンスはCC BY-NC-SA 4.0です。参照目的は用語・式の照合で、本文・図・問題は転載・翻案していません。</p>
          </li>
          <li>
            <a href="https://assets.openstax.org/oscms-prodcms/media/documents/introductory-statistics-2e_-_WEB.pdf">OpenStax, Introductory Statistics 2e, 書籍詳細ページ掲載PDF</a>
            <p>到達確認日: 2026-11-11。書籍詳細ページのGet the book → Download a PDFから取得した現行PDF（847ページ）です。本文確認日: 2026-11-11。PDF p.119（印刷p.107）の§2.7で用語・式を確認しました。</p>
            <p>PDF p.4（印刷ページ番号なし）に©2026 Rice UniversityとCC BY-NC-SA 4.0が表示され、出版年は2023年です。非営利・改変時の同一ライセンス・配布時のcredit表示が条件で、OpenStax/Riceの商標・ロゴ・表紙はライセンス対象外です。Web Prefaceと条件は一致します（<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>）。参照のみで、本文・図・問題は転載・翻案していません。</p>
          </li>
        </ul>
      </details>
      <p className="descriptive-statistics-preview-license-credit">配色: Solarized by Ethan Schoonover (Copyright (c) 2011; MIT License).{' '}
        <a href={import.meta.env.BASE_URL + 'third-party-licenses.txt'}>全文のライセンス通知</a>
      </p>
      <footer className="ds-note">教材の再設計案を確かめるためのモックです。図の操作と演習の入力は保存されません。本文の数値は計算コードで検算しています。</footer>
    </div>
  </section>
}
