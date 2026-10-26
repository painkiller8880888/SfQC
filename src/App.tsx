import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { resolveScreen, type ScreenKind } from './resolve-screen.mjs'
import {
  exportLocalData,
  importLocalData,
  LocalDataError,
  migrateLocalData,
  readLocalData,
  type LocalData,
  type LocalDataReadResult,
} from './local-data.mjs'
import { lessonRegistry } from './lesson-registry.mjs'
import { FigureRef } from './figures/figure-ref'

const navigation = [
  { label: '学習マップ', href: '#/map', screen: 'map' },
  { label: '進捗', href: '#/progress', screen: 'progress' },
  { label: 'データ管理', href: '#/data', screen: 'data' },
] as const

const varianceLesson = lessonRegistry.lessons.find((lesson) => lesson.lessonId === 'descriptive-statistics')
const includedVarianceLesson = varianceLesson?.availability === 'included' ? varianceLesson : undefined
const varianceFigureRef = includedVarianceLesson?.sections
  .find((section) => section.sectionId === 'variance')?.blocks
  .find((block) => block.kind === 'figureRef')

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
    description: 'ブラウザ内の出題・解答・復習記録を管理する画面です。',
    placeholder: '出題snapshot、解答試行、復習イベントをJSONで書き出し・読み込みできます。',
    links: [{ label: '進捗を見る', href: '#/progress' }],
  },
  'not-found': {
    title: '画面が見つかりません',
    description: '指定したURLに対応する画面はありません。',
    placeholder: '学習マップから利用できる画面へ移動できます。',
    links: [{ label: '学習マップへ戻る', href: '#/map' }],
  },
}

type StoredLocalData = LocalDataReadResult
  | { status: 'migration-failed'; raw: string; data: LocalData; error: Error }

function App() {
  const [screen, setScreen] = useState(() => resolveScreen(window.location.hash))
  const [storedData, setStoredData] = useState<StoredLocalData>(readLocalData)
  const [dataMessage, setDataMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const busyRef = useRef(false)
  const previousScreenRef = useRef<ScreenKind>(screen)
  const current = screens[screen]
  const storageError = storedData.status === 'invalid' || storedData.status === 'unreadable'
  const storageIssue = storageError || storedData.status === 'migration-failed'
    ? storedData.error
    : null
  const hasCounts = storedData.status === 'missing' || storedData.status === 'ok'
    || storedData.status === 'legacy' || storedData.status === 'migration-failed'

  const handleExport = () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setDataMessage('')
    try {
      const json = exportLocalData()
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'sfqc-backup.json'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setDataMessage('JSONファイルの書き出しを開始しました。')
    } catch (error) {
      setDataMessage(error instanceof LocalDataError ? error.message : '書き出しに失敗しました。')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    if (busyRef.current) {
      input.value = ''
      return
    }

    busyRef.current = true
    setBusy(true)
    setDataMessage('')
    try {
      const result = await importLocalData(file, ({ damaged, existingCounts, importCounts }) => {
        const imported = `${importCounts.questionInstances}件のsnapshot、${importCounts.answerAttempts}件の解答試行、${importCounts.reviewEvents}件の復習イベント`
        return window.confirm(damaged
          ? `現在の保存データは破損しているか、このアプリでは対応していない形式のため、通常の方法で読み出し・バックアップできません。元の保存データは元に戻せません。選択したファイル（${imported}）で置き換えますか？`
          : `保存済みの全データを置き換えます。現在はsnapshot ${existingCounts?.questionInstances}件、解答試行 ${existingCounts?.answerAttempts}件、復習イベント ${existingCounts?.reviewEvents}件です。選択したファイル（${imported}）で置き換えますか？`)
      })
      if (result.status === 'cancelled') {
        setDataMessage('復元をキャンセルしました。保存データは変更されていません。')
      } else {
        setStoredData({ status: 'ok', raw: result.raw, data: result.data })
        setDataMessage(`snapshot ${result.data.questionInstances.length}件、解答試行 ${result.data.answerAttempts.length}件、復習イベント ${result.data.reviewEvents.length}件を復元しました。`)
      }
    } catch (error) {
      setDataMessage(error instanceof LocalDataError ? error.message : '復元に失敗しました。')
      if (error instanceof LocalDataError && error.code === 'storage-changed') {
        setStoredData(readLocalData())
      }
    } finally {
      input.value = ''
      busyRef.current = false
      setBusy(false)
    }
  }

  useEffect(() => {
    const updateScreen = () => setScreen(resolveScreen(window.location.hash))
    window.addEventListener('hashchange', updateScreen)
    return () => window.removeEventListener('hashchange', updateScreen)
  }, [])

  useEffect(() => {
    if (storedData.status !== 'legacy') return
    try {
      const result = migrateLocalData(storedData.raw, storedData.data)
      setStoredData({ status: 'ok', raw: result.raw, data: result.data })
      setDataMessage('保存データをschemaVersion 2へ移行しました。')
    } catch (error) {
      if (error instanceof LocalDataError && error.code === 'storage-changed') {
        setStoredData(readLocalData())
        return
      }
      const migrationError = error instanceof Error
        ? error
        : new Error('保存データの移行に失敗しました。元のデータはそのままです。')
      setStoredData({ status: 'migration-failed', raw: storedData.raw, data: storedData.data, error: migrationError })
      setDataMessage(`${migrationError.message} データ管理画面からバックアップを保存できます。`)
    }
  }, [storedData])

  useEffect(() => {
    document.title = `${current.title} | SfQC`
    if (previousScreenRef.current !== screen) {
      headingRef.current?.focus({ preventScroll: true })
      const scrollTimeout = window.setTimeout(() => window.scrollTo(0, 0), 0)
      previousScreenRef.current = screen

      return () => {
        window.clearTimeout(scrollTimeout)
      }
    }
  }, [current.title, screen])

  return (
    <div className="app-shell">
      <button
        type="button"
        className="skip-link"
        onClick={() => {
          headingRef.current?.focus({ preventScroll: true })
          headingRef.current?.scrollIntoView()
        }}
      >
        本文へ移動
      </button>
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
        {storageIssue && (
          <p className="storage-alert" role="alert">
            {storageIssue.message} 保存データを空として扱ったり、自動で上書きしたりしません。データ管理画面で確認してください。
          </p>
        )}
        <article className="screen">
          <h1 id="page-title" ref={headingRef} tabIndex={-1}>{current.title}</h1>
          <p className="description">{current.description}</p>

          {screen === 'data' ? (
            <section className="data-panel" aria-labelledby="data-title">
              <h2 id="data-title">保存データ</h2>
              <p>出題snapshot：{hasCounts ? `${storedData.data.questionInstances.length}件` : '読み込みエラー'}</p>
              <p>解答試行：{hasCounts ? `${storedData.data.answerAttempts.length}件` : '読み込みエラー'}</p>
              <p>復習イベント：{hasCounts ? `${storedData.data.reviewEvents.length}件` : '読み込みエラー'}</p>
              <p>このデータはこのブラウザ内に保存され、サーバーへ送信されません。バックアップは安全な場所に保管してください。</p>
              <div className="data-actions">
                <button type="button" onClick={handleExport} disabled={busy || storageError}>
                  JSONを書き出す
                </button>
                <label htmlFor="backup-file">JSONを読み込む</label>
                <input
                  id="backup-file"
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImport}
                  disabled={busy}
                />
              </div>
              <p className="data-limit">schemaVersion 2 · snapshot最大500件 · JSONはUTF-8で2 MiBまで</p>
              <p>容量上限を超えるときは未編集バックアップを保存し、複製したJSONを整理してから読み込みます。snapshotを除く場合は参照する解答試行も、解答試行を除く場合は参照する復習イベントも一緒に除いてください。保存履歴は自動削除しません。</p>
              <p className="data-message" role="status" aria-live="polite">{dataMessage}</p>
            </section>
          ) : screen === 'lesson' ? (
            <section className="lesson-panel" aria-labelledby="variance-lesson-title">
              <h2 id="variance-lesson-title">範囲と分散</h2>
              {includedVarianceLesson && varianceFigureRef?.kind === 'figureRef' ? (
                <FigureRef lesson={includedVarianceLesson} figureId={varianceFigureRef.figureId} />
              ) : (
                <p>教材の図を読み込めませんでした。</p>
              )}
            </section>
          ) : screen === 'practice' ? (
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
