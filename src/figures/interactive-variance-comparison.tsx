import { useEffect, useState, type ChangeEvent } from 'react'
import { summarizeMeasurements } from './interactive-variance-comparison-data.mjs'
import type { MeasurementValues } from './interactive-variance-comparison-data.mjs'
import interactiveStyles from './interactive-variance-comparison.css?inline'

type Series = 'A' | 'B'
type Observation = 1 | 2 | 3
type FieldKey = `${Series}-${Observation}`
type Values = Record<FieldKey, number>
type Drafts = Record<FieldKey, string>
type Messages = Record<FieldKey, string>

const seriesList: readonly Series[] = ['A', 'B']
const observations: readonly Observation[] = [1, 2, 3]
const xPositions = [100, 170, 240]
const yTicks = [1, 1.5, 2, 2.5, 3]
const initialValues: Values = {
  'A-1': 1, 'A-2': 2.2, 'A-3': 3,
  'B-1': 1.8, 'B-2': 2, 'B-3': 2.4,
}

const fieldKey = (series: Series, observation: Observation): FieldKey => `${series}-${observation}`
const inputValue = (value: number) => value.toFixed(1)
const formatValue = (value: number) => `${value.toFixed(3)} mm`
const formatSquaredValue = (value: number) => `${value.toFixed(3)} mm²`
const formatDeviation = (value: number) => `${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(3)} mm`
const chartY = (value: number) => 177 - ((value - 1) / 2) * 130

function valuesFor(series: Series, values: Values): MeasurementValues {
  return [values[`${series}-1`], values[`${series}-2`], values[`${series}-3`]]
}

export function InteractiveVarianceComparison() {
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = interactiveStyles
    document.head.append(style)
    return () => style.remove()
  }, [])
  const [values, setValues] = useState<Values>(initialValues)
  const [drafts, setDrafts] = useState<Drafts>(() => Object.fromEntries(
    Object.entries(initialValues).map(([key, value]) => [key, inputValue(value)]),
  ) as Drafts)
  const [messages, setMessages] = useState<Messages>({
    'A-1': '', 'A-2': '', 'A-3': '', 'B-1': '', 'B-2': '', 'B-3': '',
  })
  const [status, setStatus] = useState('')
  const summaries = {
    A: summarizeMeasurements(valuesFor('A', values)),
    B: summarizeMeasurements(valuesFor('B', values)),
  }

  const commitValue = (key: FieldKey, value: number) => {
    setValues((current) => ({ ...current, [key]: value }))
    setDrafts((current) => ({ ...current, [key]: inputValue(value) }))
    setMessages((current) => ({ ...current, [key]: '' }))
    setStatus('')
  }

  const editNumber = (key: FieldKey, event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    setDrafts((current) => ({ ...current, [key]: input.value }))
    if (!input.validity.valid || !Number.isFinite(input.valueAsNumber)) {
      setMessages((current) => ({ ...current, [key]: '1.0〜3.0 mmの値を0.1 mm刻みで入力してください。' }))
      return
    }
    setValues((current) => ({ ...current, [key]: input.valueAsNumber }))
    setMessages((current) => ({ ...current, [key]: '' }))
    setStatus('')
  }

  const finishNumberEdit = (key: FieldKey) => {
    const restoredValue = values[key]
    setDrafts((current) => ({ ...current, [key]: inputValue(restoredValue) }))
    if (!messages[key]) return
    setMessages((current) => ({ ...current, [key]: '' }))
    setStatus(`${key[0]}系列${key[2]}番目の測定値を、最後に確定した ${inputValue(restoredValue)} mm に戻しました。`)
  }

  const setFromRange = (key: FieldKey, event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    if (input.validity.valid && Number.isFinite(input.valueAsNumber)) commitValue(key, input.valueAsNumber)
  }

  const chartDescription = seriesList.map((series) => {
    const summary = summaries[series]
    return `${series}の平均 ${formatValue(summary.mean)}、分散 ${formatSquaredValue(summary.variance)}、標準偏差 ${formatValue(summary.standardDeviation)}`
  }).join('。')

  return <section className="lesson-observation interactive-variance-comparison" aria-labelledby="ivc-title">
    <h3 id="ivc-title">平均・偏差・分散・標準偏差の関係を操作して確かめる</h3>
    <p>これは操作中のA/Bの復習図です。標準偏差の説明後に、4つの指標がどうつながるかを確かめます。本文は初期値の計算例で、この図の操作で本文の数値は変わりません。</p>
    <p>各系列の3個の値を1.0〜3.0 mm、0.1 mm刻みで変更できます。実線と円はA、破線と四角はBです。色だけに頼らず、下の表にも現在値を示します。</p>

    <figure className="ivc-figure">
      <svg className="ivc-svg" viewBox="0 0 320 220" role="img" aria-labelledby="ivc-chart-title ivc-chart-description">
        <title id="ivc-chart-title">操作中の測定値、平均、各偏差</title>
        <desc id="ivc-chart-description">{chartDescription}。各点から系列の平均線までの縦線が偏差を表します。</desc>
        {yTicks.map((tick) => <g key={tick}>
          <line className="ivc-grid" x1="58" x2="274" y1={chartY(tick)} y2={chartY(tick)} />
          <text className="ivc-label" x="51" y={chartY(tick) + 4} textAnchor="end">{tick.toFixed(1)}</text>
        </g>)}
        <line className="ivc-axis" x1="58" x2="274" y1="177" y2="177" />
        <line className="ivc-axis" x1="58" x2="58" y1="47" y2="177" />
        {observations.map((observation, index) => <text className="ivc-label" key={observation} x={xPositions[index]} y="196" textAnchor="middle">{observation}</text>)}
        <text className="ivc-label" x="166" y="215" textAnchor="middle">観測番号</text>
        <text className="ivc-label" x="14" y="112" textAnchor="middle" transform="rotate(-90 14 112)">測定値（mm）</text>
        {seriesList.map((series) => {
          const seriesValues = valuesFor(series, values)
          const summary = summaries[series]
          return <g className={`ivc-series-${series.toLowerCase()}`} key={series}>
            {observations.map((observation, index) => <line
              className="ivc-deviation"
              data-series={series}
              data-observation={observation}
              key={`${series}-deviation-${observation}`}
              x1={xPositions[index]}
              x2={xPositions[index]}
              y1={chartY(summary.mean)}
              y2={chartY(seriesValues[index])}
            />)}
            <line className="ivc-mean" data-series={series} x1="58" x2="274" y1={chartY(summary.mean)} y2={chartY(summary.mean)} />
            {observations.map((observation, index) => series === 'A'
              ? <circle
                className="ivc-point"
                data-series={series}
                data-observation={observation}
                data-value={seriesValues[index]}
                key={`${series}-point-${observation}`}
                cx={xPositions[index]}
                cy={chartY(seriesValues[index])}
                r="5"
              />
              : <rect
                className="ivc-point"
                data-series={series}
                data-observation={observation}
                data-value={seriesValues[index]}
                key={`${series}-point-${observation}`}
                x={xPositions[index] - 4.5}
                y={chartY(seriesValues[index]) - 4.5}
                width="9"
                height="9"
              />)}
          </g>
        })}
      </svg>
      <figcaption className="ivc-figcaption">各点から平均線までの縦線が符号付き偏差を示します。点同士は結んでいません。完全に重なる値も下のA/B別の表で確認できます。</figcaption>
    </figure>

    <ol>
      <li>課題A: Bを1.9、2.1、2.5 mmにします。平均はどう変わり、偏差・分散・標準偏差はどうなるでしょうか。</li>
      <li>課題B: Bを1.6、2.0、2.6 mmにします。平均を保ったまま、分散・標準偏差はどう変わるでしょうか。</li>
    </ol>
    <p><strong>確認:</strong> 課題Aでは各値と平均が同じ0.1 mmだけ増えるため、偏差は変わらず、分散と標準偏差も同じです。課題Bでは平均は2.067 mmのまま、平均からの偏差が広がるため、分散と標準偏差が増えます。</p>

    <div className="ivc-controls" aria-label="操作中の6個の測定値">
      {seriesList.map((series) => <fieldset className="ivc-series-controls" key={series}>
        <legend>系列 {series}</legend>
        {observations.map((observation) => {
          const key = fieldKey(series, observation)
          const numberId = `ivc-${key}-number`
          const rangeId = `ivc-${key}-range`
          const messageId = `ivc-${key}-message`
          return <div className="ivc-measurement" key={key}>
            <label className="ivc-number-label" htmlFor={numberId}>{observation}番目の測定値（mm）
              <input
                id={numberId}
                className="ivc-number-input"
                type="number"
                min="1.0"
                max="3.0"
                step="0.1"
                required
                value={drafts[key]}
                data-series={series}
                data-observation={observation}
                data-input-kind="number"
                aria-invalid={Boolean(messages[key])}
                aria-describedby={messageId}
                onChange={(event) => editNumber(key, event)}
                onBlur={() => finishNumberEdit(key)}
              />
            </label>
            <input
              id={rangeId}
              className="ivc-range-input"
              type="range"
              min="1.0"
              max="3.0"
              step="0.1"
              value={values[key]}
              data-series={series}
              data-observation={observation}
              data-input-kind="range"
              aria-label={`系列${series} ${observation}番目の測定値（mm）をスライダーで調整`}
              aria-valuetext={`${inputValue(values[key])} mm`}
              aria-describedby={messageId}
              onChange={(event) => setFromRange(key, event)}
            />
            <p className="ivc-field-message" id={messageId} role="status">{messages[key]}</p>
          </div>
        })}
      </fieldset>)}
    </div>
    <p className="ivc-status" role="status" aria-live="polite">{status}</p>

    <div className="ivc-summaries" aria-label="系列ごとの読み上げ用数値">
      {seriesList.map((series) => {
        const summary = summaries[series]
        const seriesValues = valuesFor(series, values)
        return <section className="ivc-series-summary" data-series-summary={series} key={series} aria-labelledby={`ivc-summary-${series}`}>
          <h4 id={`ivc-summary-${series}`}>操作中の系列 {series}</h4>
          <table className="ivc-summary-table">
            <caption>系列 {series} の測定値と平均からの偏差</caption>
            <thead><tr><th scope="col">観測番号</th><th scope="col">測定値</th><th scope="col">偏差</th></tr></thead>
            <tbody>{observations.map((observation, index) => <tr key={observation}>
              <th scope="row">{observation}</th>
              <td>{formatValue(seriesValues[index])}</td>
              <td>{formatDeviation(summary.deviations[index])}</td>
            </tr>)}</tbody>
          </table>
          <dl className="ivc-statistics">
            <dt>平均</dt><dd data-statistic="mean">{formatValue(summary.mean)}</dd>
            <dt>偏差平方和</dt><dd data-statistic="sum-of-squared-deviations">{formatSquaredValue(summary.sumOfSquaredDeviations)}</dd>
            <dt>操作中の3点を記述する分散（n=3）</dt><dd data-statistic="variance">{formatSquaredValue(summary.variance)}</dd>
            <dt>標準偏差</dt><dd data-statistic="standard-deviation">{formatValue(summary.standardDeviation)}</dd>
          </dl>
        </section>
      })}
    </div>
  </section>
}
