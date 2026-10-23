import { useId } from 'react'
import {
  chart,
  mean,
  meanFractionLabel,
  observations,
  sumOfSquaredDeviationsLabel,
} from './variance-deviation-bars-data.mjs'

type Props = { description: string }

export function VarianceDeviationBars({ description }: Props) {
  const id = useId()

  return (
    <figure className="variance-figure">
      <svg
        className="variance-svg"
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        aria-labelledby={`${id}-title ${id}-description`}
      >
        <title id={`${id}-title`}>平均と各観測値の偏差</title>
        <desc id={`${id}-description`}>{description}</desc>
        {chart.ticks.map(({ value, y, label }) => (
          <g key={value}>
            <line
              className="variance-grid-line"
              data-role="tick"
              data-value={value}
              data-y={y}
              x1="48"
              y1={y}
              x2="336"
              y2={y}
            />
            <text className="variance-tick-label" x="42" y={y + 3} textAnchor="end">{label}</text>
          </g>
        ))}
        <line className="variance-axis" x1="48" y1="24" x2="48" y2="156" />
        <line className="variance-axis" x1="48" y1="156" x2="336" y2="156" />
        {chart.deviationLines.map((line) => (
          <line
            key={line.observation}
            className={`variance-deviation-line variance-deviation-${line.observation}`}
            data-role="deviation"
            data-observation={line.observation}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
          />
        ))}
        <line
          className="variance-mean-line"
          data-role="mean"
          x1={chart.meanLine.x1}
          y1={chart.meanLine.y1}
          x2={chart.meanLine.x2}
          y2={chart.meanLine.y2}
        />
        <text className="variance-mean-label" x="332" y={chart.meanLine.y1 - 4} textAnchor="end">平均</text>
        {chart.points.map((point) => (
          <g key={point.number}>
            {point.number === 1 ? (
              <circle
                className="variance-point"
                data-role="observation"
                data-observation={point.number}
                data-x={point.x}
                data-y={point.y}
                cx={point.x}
                cy={point.y}
                r="4"
              />
            ) : point.number === 2 ? (
              <rect
                className="variance-point"
                data-role="observation"
                data-observation={point.number}
                data-x={point.x}
                data-y={point.y}
                x={point.x - 4}
                y={point.y - 4}
                width="8"
                height="8"
              />
            ) : (
              <path
                className="variance-point"
                data-role="observation"
                data-observation={point.number}
                data-x={point.x}
                data-y={point.y}
                d={`M ${point.x} ${point.y - 4} L ${point.x + 5} ${point.y + 2} L ${point.x - 5} ${point.y + 2} Z`}
              />
            )}
            <text className="variance-observation-label" x={point.x} y="170" textAnchor="middle">{point.number}</text>
          </g>
        ))}
      </svg>
      <figcaption>
        <p>横軸は観測番号（カテゴリ）、縦軸は測定値（mm、線形）です。縦軸は1.0〜3.0 mmを0.5 mm刻みで示します。平均は破線、偏差は観測値と平均を結ぶ線、観測値は丸・四角・三角と番号で区別します。</p>
        <p>測定値1.000、2.200、3.000 mmの平均は {meanFractionLabel} mm（約 {mean.toFixed(3)} mm）です。</p>
        <ol className="variance-values">
          {observations.map((observation) => (
            <li key={observation.number}>
              観測{observation.number}: {observation.value.toFixed(3)} mm、偏差 {observation.deviationLabel} mm（約 {observation.deviation < 0 ? '−' : '+'}{Math.abs(observation.deviation).toFixed(3)} mm）、偏差の二乗（{observation.deviationLabel} mm）² = {observation.squaredDeviationLabel} mm²
            </li>
          ))}
        </ol>
        <p>偏差平方和は {sumOfSquaredDeviationsLabel} mm² です。図は分散を求める前の偏差平方和までを示します。分散は目的に応じて分母で割ります。母分散は N、観測標本そのものを記述する分散は n、母分散の不偏推定量は n−1 で割ります。</p>
      </figcaption>
    </figure>
  )
}
