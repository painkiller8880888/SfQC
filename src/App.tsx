import { useEffect, useRef, useState } from 'react'
import { resolveScreen, type ScreenKind } from './resolve-screen.mjs'

const navigation = [
  { label: '学習マップ', href: '#/map', screen: 'map' },
  { label: '進捗', href: '#/progress', screen: 'progress' },
  { label: 'データ管理', href: '#/data', screen: 'data' },
] as const

const screens: Record<ScreenKind, {
  title: string
  description: string
  placeholder: string
  links: { label: string; href: string }[]
}> = {
  map: {
    title: '学習マップ',
    description: '学ぶ単元を選び、解説と演習へ進みます。',
    placeholder: '単元一覧と前提関係の表示は、教材データの整備後に追加します。',
    links: [{ label: '単元解説へ', href: '#/lesson' }],
  },
  lesson: {
    title: '単元解説',
    description: '統計の考え方や計算を、基礎から学ぶ画面です。',
    placeholder: '解説本文・図・前提知識への復習リンクは準備中です。',
    links: [
      { label: '演習へ', href: '#/practice' },
      { label: '学習マップへ', href: '#/map' },
    ],
  },
  practice: {
    title: '演習',
    description: '学んだ内容を問題で確認する画面です。',
    placeholder: '回答入力、同じ問題の再開は準備中です。',
    links: [{ label: '解答・フィードバックへ', href: '#/feedback' }],
  },
  feedback: {
    title: '解答・フィードバック',
    description: '解答の根拠を確認し、必要な内容を復習する画面です。',
    placeholder: '採点結果・誤答理由・復習先の表示と類題の選出は準備中です。',
    links: [
      { label: '復習先の単元解説へ', href: '#/lesson' },
      { label: '再演習へ', href: '#/practice' },
    ],
  },
  progress: {
    title: '進捗',
    description: '学習状況を振り返り、次に取り組む内容を選ぶ画面です。',
    placeholder: '学習状況や復習対象の表示は、学習記録の保存機能とあわせて追加します。',
    links: [
      { label: '単元解説・復習先へ', href: '#/lesson' },
      { label: '演習へ', href: '#/practice' },
    ],
  },
  data: {
    title: 'データ管理',
    description: 'ブラウザ内の学習記録を管理する画面です。',
    placeholder: '学習記録の書き出し・読み込みは準備中です。',
    links: [{ label: '進捗を見る', href: '#/progress' }],
  },
  'not-found': {
    title: '画面が見つかりません',
    description: '指定したURLに対応する画面はありません。',
    placeholder: '学習マップから利用できる画面へ移動できます。',
    links: [{ label: '学習マップへ戻る', href: '#/map' }],
  },
}

function App() {
  const [screen, setScreen] = useState(() => resolveScreen(window.location.hash))
  const headingRef = useRef<HTMLHeadingElement>(null)
  const previousScreenRef = useRef<ScreenKind>(screen)
  const current = screens[screen]

  useEffect(() => {
    const updateScreen = () => setScreen(resolveScreen(window.location.hash))
    window.addEventListener('hashchange', updateScreen)
    return () => window.removeEventListener('hashchange', updateScreen)
  }, [])

  useEffect(() => {
    document.title = `${current.title} | SfQC`
    if (previousScreenRef.current !== screen) {
      headingRef.current?.focus({ preventScroll: true })
      window.scrollTo(0, 0)
      previousScreenRef.current = screen
    }
  }, [current.title, screen])

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#page-title"
        onClick={(event) => {
          event.preventDefault()
          headingRef.current?.focus({ preventScroll: true })
          headingRef.current?.scrollIntoView()
        }}
      >
        本文へ移動
      </a>
      <header className="site-header">
        <a className="site-brand" href="#/map">SfQC</a>
        <nav className="primary-nav" aria-label="メイン">
          {navigation.map((item) => (
            <a
              key={item.screen}
              href={item.href}
              aria-current={screen === item.screen ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="page-content">
        <article className="screen">
          <h1 id="page-title" ref={headingRef} tabIndex={-1}>{current.title}</h1>
          <p className="description">{current.description}</p>

          {screen === 'practice' ? (
            <>
              <section className="placeholder" aria-labelledby="question-title">
                <h2 id="question-title">問題</h2>
                <p>問題文と条件は準備中です。</p>
              </section>
              <section className="placeholder" aria-labelledby="answer-title">
                <h2 id="answer-title">回答入力</h2>
                <p>{current.placeholder}</p>
              </section>
            </>
          ) : (
            <section className="placeholder" aria-labelledby="placeholder-title">
              <h2 id="placeholder-title">この画面でできること</h2>
              <p>{current.placeholder}</p>
            </section>
          )}

          <nav className="screen-navigation" aria-label="この画面から移動">
            <ul>
              {current.links.map((link) => (
                <li key={link.label}><a href={link.href}>{link.label}</a></li>
              ))}
            </ul>
          </nav>

          <footer className="site-footer">
            <a href={`${import.meta.env.BASE_URL}third-party-licenses.txt`}>使用ライブラリのライセンス</a>
          </footer>
        </article>
      </main>
    </div>
  )
}

export default App
