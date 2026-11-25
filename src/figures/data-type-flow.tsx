import './data-type-flow.css'

export function DataTypeFlow({ description }: { description: string }) {
  return <figure className="data-type-flow">
    <div className="data-type-flow-chart" role="img" aria-label={description}>
      <div className="data-type-flow-node data-type-flow-question">記録した値は何を表しているか？</div>
      <div className="data-type-flow-split">
        <div className="data-type-flow-branch">
          <span className="data-type-flow-label">種類・判定</span>
          <div className="data-type-flow-node data-type-flow-category">
            <strong>カテゴリ</strong>
            <span>適合・不適合</span>
          </div>
        </div>
        <div className="data-type-flow-branch">
          <span className="data-type-flow-label">数量</span>
          <div className="data-type-flow-node data-type-flow-question">どう得られた数量か？</div>
          <div className="data-type-flow-split data-type-flow-quantity">
            <div className="data-type-flow-branch">
              <span className="data-type-flow-label">測る</span>
              <div className="data-type-flow-node data-type-flow-measure">
                <strong>計量値</strong>
                <span>長さ・重量</span>
                <span>連続量の測定</span>
              </div>
            </div>
            <div className="data-type-flow-branch">
              <span className="data-type-flow-label">数える</span>
              <div className="data-type-flow-node data-type-flow-count">
                <strong>計数値</strong>
                <span>傷の件数</span>
                <span>離散的な個数</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <figcaption className="data-type-flow-description">
      <strong>判断の順序</strong>
      <ol>
        <li>記録した値が適合・不適合などの種類や判定なら、カテゴリです。数量なら、次にどう得られたかを確かめます。</li>
        <li>長さや重量のように連続量を測って得た値は計量値です。傷の件数のように個数を数えて得た離散的な値は計数値です。</li>
      </ol>
    </figcaption>
  </figure>
}
