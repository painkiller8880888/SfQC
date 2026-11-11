import { useEffect, useRef, useState } from 'react'
import { summarizeMeasurements } from './interactive-variance-comparison-data.mjs'
import type { MeasurementSummary, MeasurementValues } from './interactive-variance-comparison-data.mjs'

type Series = 'A' | 'B'
type FigureMode = 'mean' | 'deviation' | 'variance' | 'sd'
type FigureValues = Record<Series, MeasurementValues>
type PointKey = `${Series}${number}`

const seriesList: readonly Series[] = ['A', 'B']
const minimum = 96
const maximum = 104
const defaults: FigureValues = { A: [98, 100, 102], B: [99, 100, 101] }
const population = [98, 99, 100, 101, 102]
const trueVariance = 2
const varianceScale = 4
const expectedSimulation = (() => {
  let sumByN = 0
  let sumByNMinusOne = 0
  let count = 0
  for (const first of population) for (const second of population) for (const third of population) {
    const statistics = summarizeMeasurements([first, second, third])
    sumByN += statistics.variance
    sumByNMinusOne += statistics.sumOfSquaredDeviations / 2
    count += 1
  }
  return { count, byN: sumByN / count, byNMinusOne: sumByNMinusOne / count }
})()

const formatValue = (value: number) => {
  const rounded = Math.round(value * 100) / 100
  return `${rounded < 0 ? '−' : ''}${Math.abs(rounded)}`
}
const formatDeviation = (value: number) => {
  const rounded = Math.round(value * 100) / 100
  if (rounded === 0) return '0'
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}`
}
const figureDescriptions: Record<FigureMode, string> = {
  mean: 'ラインAとBの測定値を並べた数直線。点は動かせる。三角形は平均の位置',
  deviation: '各点から平均までの距離を矢印で示した数直線。点は動かせる',
  variance: '各点の偏差を一辺とする正方形を並べた図。点は動かせる',
  sd: '平均を中心に標準偏差の幅の帯を重ねた数直線。点は動かせる',
}

function measurementSummary(values: MeasurementValues): MeasurementSummary & { unbiasedVariance: number } {
  const summary = summarizeMeasurements(values)
  return { ...summary, unbiasedVariance: summary.sumOfSquaredDeviations / (values.length - 1) }
}

function FigureReadout({ mode, values, summaries }: {
  mode: FigureMode
  values: FigureValues
  summaries: Record<Series, MeasurementSummary & { unbiasedVariance: number }>
}) {
  const row = (label: string, valueA: string, valueB: string) => <tr key={label}>
    <th scope="row">{label}</th><td className="num">{valueA}</td><td className="num">{valueB}</td>
  </tr>
  return <div className="ivc-readout">
    <table>
      <thead><tr><th scope="col">いまの図の値</th><th scope="col">A</th><th scope="col">B</th></tr></thead>
      <tbody>
        {row('値 (mm)', values.A.join(', '), values.B.join(', '))}
        {mode === 'mean' && row('平均 (mm)', formatValue(summaries.A.mean), formatValue(summaries.B.mean))}
        {mode === 'deviation' && <>
          {row('偏差 (mm)', summaries.A.deviations.map(formatDeviation).join(', '), summaries.B.deviations.map(formatDeviation).join(', '))}
          {row('偏差の合計 (mm)', formatValue(summaries.A.deviations.reduce((sum, value) => sum + value, 0)), formatValue(summaries.B.deviations.reduce((sum, value) => sum + value, 0)))}
        </>}
        {mode === 'variance' && <>
          {row('偏差平方和 S (mm²)', formatValue(summaries.A.sumOfSquaredDeviations), formatValue(summaries.B.sumOfSquaredDeviations))}
          {row('不偏分散 V = S ÷ 2 (mm²)', formatValue(summaries.A.unbiasedVariance), formatValue(summaries.B.unbiasedVariance))}
        </>}
        {mode === 'sd' && <>
          {row('不偏分散 V (mm²)', formatValue(summaries.A.unbiasedVariance), formatValue(summaries.B.unbiasedVariance))}
          {row('標準偏差 s = √V (mm)', formatValue(Math.sqrt(summaries.A.unbiasedVariance)), formatValue(Math.sqrt(summaries.B.unbiasedVariance)))}
        </>}
      </tbody>
    </table>
  </div>
}

export function InteractiveVarianceComparison({ mode }: { mode: FigureMode }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dragKeyRef = useRef<PointKey | null>(null)
  const [width, setWidth] = useState(640)
  const [values, setValues] = useState<FigureValues>(defaults)
  const summaries = {
    A: measurementSummary(values.A),
    B: measurementSummary(values.B),
  }
  const padding = width < 480 ? 22 : 32
  const pixelsPerMm = (width - 2 * padding) / (maximum - minimum)
  const squareScale = Math.min(22, pixelsPerMm * 0.32)
  const rowHeight = mode === 'mean' ? 104 : mode === 'deviation' ? 134 : mode === 'sd' ? 96 : Math.round(106 + 5.4 * squareScale)
  const gridBottom = 2 * rowHeight + 8
  const axisY = 2 * rowHeight + 20
  const height = axisY + 40
  const xPosition = (value: number) => padding + (value - minimum) * pixelsPerMm
  const label = (x: number, y: number, text: string, className: string) => <text
    className={className}
    x={x}
    y={y}
    textAnchor={x < padding + 40 ? 'start' : x > width - padding - 40 ? 'end' : 'middle'}
  >{text}</text>
  const setValue = (key: PointKey, value: number) => {
    const nextValue = Math.max(minimum, Math.min(maximum, value))
    const series = key[0] as Series
    const index = Number(key.slice(1))
    setValues((current) => {
      const seriesValues: [number, number, number] = [...current[series]]
      seriesValues[index] = nextValue
      return { ...current, [series]: seriesValues }
    })
  }

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const resize = () => {
      const nextWidth = Math.max(300, Math.floor(wrapper.clientWidth || 600))
      setWidth((current) => current === nextWidth ? current : nextWidth)
    }
    resize()
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(resize)
      observer.observe(wrapper)
      return () => observer.disconnect()
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  return <figure className="interactive-variance-comparison ivc-figure" data-figure-mode={mode}>
    <div className="ivc-legend" aria-label="図の凡例">
      <span><span className="ivc-tag">A</span> 丸</span>
      <span><span className="ivc-tag ivc-tag-b">B</span> 四角</span>
      <span>{mode === 'mean' ? '点をドラッグ、または点を選んで矢印キー' : mode === 'deviation' ? '点を動かして、矢印の向きと長さを確かめる' : mode === 'variance' ? '正方形は、偏差を一辺とした面積（mm²）' : '帯は、平均 ± s の幅'}</span>
    </div>
    <div className="ivc-svg-wrap" ref={wrapperRef}>
      <svg
        className="ivc-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label={figureDescriptions[mode]}
        onPointerDown={(event) => {
          const target = (event.target as Element).closest<SVGElement>('[data-k]')
          const key = target?.getAttribute('data-k') as PointKey | null
          if (!key) return
          dragKeyRef.current = key
          try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* pointer capture is optional */ }
          event.preventDefault()
        }}
        onPointerMove={(event) => {
          const key = dragKeyRef.current
          if (!key) return
          const rect = event.currentTarget.getBoundingClientRect()
          const x = (event.clientX - rect.left) * (width / rect.width)
          setValue(key, Math.round(minimum + (x - padding) / pixelsPerMm))
        }}
        onPointerUp={() => { dragKeyRef.current = null }}
        onPointerCancel={() => { dragKeyRef.current = null }}
        onKeyDown={(event) => {
          const target = (event.target as Element).closest<SVGElement>('[data-k]')
          const key = target?.getAttribute('data-k') as PointKey | null
          if (!key) return
          const current = values[key[0] as Series][Number(key.slice(1))]
          const next = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? current - 1
            : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? current + 1
              : event.key === 'Home' ? minimum : event.key === 'End' ? maximum : null
          if (next === null) return
          event.preventDefault()
          setValue(key, next)
        }}
      >
        {Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index).map((tick) => <g key={tick}>
          <line className="ivc-grid" x1={xPosition(tick)} y1="6" x2={xPosition(tick)} y2={gridBottom} />
          {(width < 480 ? (tick - minimum) % 2 === 0 : true) && <text className="ivc-axis-label" x={xPosition(tick)} y={axisY + 14} textAnchor="middle">{tick}</text>}
        </g>)}
        <text className="ivc-axis-label" x={width / 2} y={axisY + 32} textAnchor="middle">長さ (mm)</text>
        {seriesList.map((series, rowIndex) => {
          const summary = summaries[series]
          const meanX = xPosition(summary.mean)
          const baselineY = 6 + rowIndex * rowHeight + 50
          const className = `ivc-series-${series.toLowerCase()}`
          const pointCount = new Map<number, number>()
          return <g key={series}>
            <text className={`ivc-series-label ${className}`} x={padding} y={6 + rowIndex * rowHeight + 14}>{series} ライン</text>
            <line className="ivc-base" x1={padding} y1={baselineY} x2={width - padding} y2={baselineY} />
            {mode === 'mean' && <>
              <polygon className={`ivc-fill ${className}`} points={`${meanX},${baselineY + 10} ${meanX - 8},${baselineY + 24} ${meanX + 8},${baselineY + 24}`} />
              {label(meanX, baselineY + 42, `平均 ${formatValue(summary.mean)} mm`, `ivc-series-label ${className}`)}
            </>}
            {mode === 'deviation' && <>
              <line className={`ivc-dash ${className}`} x1={meanX} y1={baselineY - 14} x2={meanX} y2={baselineY + 28 + 3 * 18 - 8} />
              {label(meanX, baselineY - 20, `平均 ${formatValue(summary.mean)}`, `ivc-series-label ${className}`)}
              {summary.deviations.map((deviation, index) => {
                const point = values[series][index]
                const y = baselineY + 30 + index * 18
                const x = xPosition(point)
                let textX = deviation >= 0 ? x + 10 : x - 10
                let textAnchor: 'start' | 'end' = deviation >= 0 ? 'start' : 'end'
                if (Math.abs(deviation) < 0.005) { textX = meanX + 10; textAnchor = 'start' }
                if (textAnchor === 'start' && textX > width - padding - 34) { textX = x - 10; textAnchor = 'end' }
                if (textAnchor === 'end' && textX < padding + 34) { textX = x + 10; textAnchor = 'start' }
                return <g key={index}>
                  <line className={`ivc-dash ${className}`} x1={x} y1={baselineY + 10} x2={x} y2={y} />
                  <line className={`ivc-arrow ${className}`} x1={meanX} y1={y} x2={x} y2={y} />
                  <text className="ivc-point-label" x={textX} y={y + 4} textAnchor={textAnchor}>{index + 1}本目 {formatDeviation(deviation)}</text>
                </g>
              })}
            </>}
            {mode === 'variance' && <>
              <line className={`ivc-dash ${className}`} x1={meanX} y1={baselineY - 14} x2={meanX} y2={baselineY + 14} />
              {label(meanX, baselineY - 20, `平均 ${formatValue(summary.mean)}`, `ivc-series-label ${className}`)}
              {summary.deviations.map((deviation, index) => {
                const side = Math.abs(deviation) * squareScale
                const x = padding + index * ((width - 2 * padding) / 3)
                const y = baselineY + 40
                return <g key={index}>
                  <text className="ivc-axis-label" x={x} y={baselineY + 32}>{index + 1}本目 {formatValue(deviation * deviation)} mm²</text>
                  {side > 0.6
                    ? <rect className={`ivc-square ${className}`} x={x} y={y} width={side} height={side} />
                    : <circle className={`ivc-fill ${className}`} cx={x + 2} cy={y + 2} r="2.5" />}
                </g>
              })}
            </>}
            {mode === 'sd' && <>
              <line className={`ivc-dash ${className}`} x1={meanX} y1={baselineY - 16} x2={meanX} y2={baselineY + 16} />
              {label(meanX, baselineY - 24, `平均 ± s = ± ${formatValue(Math.sqrt(summary.unbiasedVariance))} mm`, `ivc-series-label ${className}`)}
              <rect
                className={`ivc-band ${className}`}
                x={Math.max(padding, xPosition(summary.mean - Math.sqrt(summary.unbiasedVariance)))}
                y={baselineY - 16}
                width={Math.max(0, Math.min(width - padding, xPosition(summary.mean + Math.sqrt(summary.unbiasedVariance))) - Math.max(padding, xPosition(summary.mean - Math.sqrt(summary.unbiasedVariance))))}
                height="32"
                rx="4"
              />
            </>}
            {values[series].map((value, index) => {
              const key = `${series}${index}` as PointKey
              const duplicate = pointCount.get(value) ?? 0
              pointCount.set(value, duplicate + 1)
              const x = xPosition(value)
              const y = baselineY - duplicate * 17
              const common = {
                'data-k': key,
                tabIndex: 0,
                role: 'slider' as const,
                'aria-label': `${series}ライン ${index + 1}本目の長さ`,
                'aria-valuemin': minimum,
                'aria-valuemax': maximum,
                'aria-valuenow': value,
                'aria-valuetext': `${value} mm`,
              }
              return <g key={key}>
                {series === 'A'
                  ? <circle className={`ivc-dot ${className}`} {...common} cx={x} cy={y} r="11" />
                  : <rect className={`ivc-dot ivc-dot-square ${className}`} {...common} x={x - 10} y={y - 10} width="20" height="20" rx="4" />}
                <text className="ivc-dot-number" x={x} y={y + 4} textAnchor="middle" aria-hidden="true">{index + 1}</text>
              </g>
            })}
          </g>
        })}
      </svg>
    </div>
    <FigureReadout mode={mode} values={values} summaries={summaries} />
    <figcaption className="ivc-caption">{mode === 'mean'
      ? '三角形（▲）は平均の位置です。3つの点を同じ重さの玉と考えると、▲を支点にして数直線がつり合います。点を動かすと▲も動きます。'
      : mode === 'deviation'
        ? '点線は平均の位置です。矢印は、平均から各点までの向きと長さを示します。平均より右にある点は正、左にある点は負です。'
        : mode === 'variance'
          ? '点を動かすと、平均からのずれが大きい点の正方形ほど大きくなります。正方形の面積を全部足したものが偏差平方和です。'
          : '帯の幅は、ばらつきの目安です。点を広げると帯が広がり、寄せると狭まります。'}</figcaption>
    <button className="ds-button ivc-reset" type="button" onClick={() => setValues(defaults)}>初期値に戻す</button>
  </figure>
}

type SimulationResult = {
  count: number
  sumByN: number
  sumByNMinusOne: number
  last: null | { values: MeasurementValues; byN: number; byNMinusOne: number }
}

export function VarianceSimulation() {
  const [result, setResult] = useState<SimulationResult>({ count: 0, sumByN: 0, sumByNMinusOne: 0, last: null })
  const averageByN = result.count ? result.sumByN / result.count : null
  const averageByNMinusOne = result.count ? result.sumByNMinusOne / result.count : null
  const draw = () => population[Math.floor(Math.random() * population.length)]
  const sample = (): MeasurementValues => [draw(), draw(), draw()]
  const run = (count: number, showLast: boolean) => {
    const trials = Array.from({ length: count }, () => {
      const values = sample()
      const summary = summarizeMeasurements(values)
      return { values, byN: summary.variance, byNMinusOne: summary.sumOfSquaredDeviations / 2 }
    })
    setResult((current) => {
    let totalCount = current.count
    let sumByN = current.sumByN
    let sumByNMinusOne = current.sumByNMinusOne
    let last = current.last
    for (const trial of trials) {
      totalCount += 1
      sumByN += trial.byN
      sumByNMinusOne += trial.byNMinusOne
      last = trial
    }
    return { count: totalCount, sumByN, sumByNMinusOne, last: showLast ? last : null }
    })
  }
  const bar = (label: string, value: number | null, className: string) => <div className="ivc-bar-row" key={label}>
    <span>{label}</span>
    <div className="ivc-bar" role="progressbar" aria-label={`${label}の平均値`} aria-valuemin={0} aria-valuemax={varianceScale} aria-valuenow={value === null ? 0 : Math.min(value, varianceScale)}>
      <i className={className} style={{ width: `${value === null ? 0 : Math.min(100, value / varianceScale * 100)}%` }} />
      <b aria-hidden="true" style={{ left: `${trueVariance / varianceScale * 100}%` }} />
    </div>
    <span className="num">{value === null ? '—' : value.toFixed(2)}</span>
  </div>
  return <section className="ivc-simulation" aria-label="復元抽出シミュレーション">
    <p>上で例にしたロットでは、母分散が 2 mm² だと分かっています。ここから3本を取り出し（取り出したら戻す）、S を n = 3 で割った値と、n − 1 = 2 で割った値を比べます。</p>
    <div className="ivc-population" aria-label="ロットに含まれる寸法">{population.map((value) => <span key={value}>{value}</span>)}</div>
    <p>3本の取り方は全部で <strong>{expectedSimulation.count}</strong> 通りあります。そのすべてについて分散を計算して平均すると、n で割った場合は <strong>{expectedSimulation.byN.toFixed(2)}</strong>、n − 1 で割った場合は <strong>{expectedSimulation.byNMinusOne.toFixed(2)}</strong> です。母分散 2 と合うのは、n − 1 で割った場合です。</p>
    <p>実際に何回か取り出して確かめます。黒い縦線が母分散 2 mm² です。</p>
    <div className="ivc-bars">{bar('n で割る', averageByN, 'ivc-bar-n')}{bar('n − 1 で割る', averageByNMinusOne, 'ivc-bar-n-minus-one')}</div>
    <p className="ivc-simulation-last" role="status" aria-live="polite">{result.count === 0
      ? 'まだ取り出していません。'
      : result.last
        ? `直前の3本：${result.last.values.join(', ')}　n で割る ${result.last.byN.toFixed(2)}、n − 1 で割る ${result.last.byNMinusOne.toFixed(2)}（${result.count} 回の平均を表示中）`
        : `${result.count} 回取り出した平均です。`}</p>
    <div className="ivc-simulation-actions">
      <button className="ds-button" type="button" onClick={() => run(1, true)}>3本取り出す</button>
      <button className="ds-button" type="button" onClick={() => run(100, false)}>100回くり返す</button>
      <button className="ds-button" type="button" onClick={() => setResult({ count: 0, sumByN: 0, sumByNMinusOne: 0, last: null })}>やり直す</button>
    </div>
    <p className="ivc-simulation-explanation">この実験は、ロットの中身が分かっているから、母分散と比べられます。現実に標本を取れるのは1回だけで、n − 1 で割った V を1つ使います。1回ごとの値は母分散とずれます（「直前の3本」の値で確かめられます）。同じ取り方を何度もくり返して平均したとき、母分散に一致する、という性質です。</p>
  </section>
}
