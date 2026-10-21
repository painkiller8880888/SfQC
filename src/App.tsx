function App() {
  return (
    <main className="page">
      <section className="welcome" aria-labelledby="welcome-title">
        <p className="brand">SfQC</p>
        <h1 id="welcome-title">統計を基礎から学び、QC検定2級を目指す。</h1>
        <p className="description">
          統計学の初学者向け教材を準備しています。学習マップや演習は、これから順次整備します。
        </p>
        <footer className="footer">
          <a href={`${import.meta.env.BASE_URL}third-party-licenses.txt`}>使用ライブラリのライセンス</a>
        </footer>
      </section>
    </main>
  )
}

export default App
