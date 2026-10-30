import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import type { Viewport } from '@xyflow/react'
import {
  resolveRoute,
  routeToHash,
  screenForRoute,
  type AppRoute,
  type ScreenKind,
} from './resolve-screen.mjs'
import {
  navigateRouteHistory,
  updateRouteHistoryState,
  validateRouteHistoryState,
  type NavigationIntent,
  type RouteHistoryState,
} from './route-history.mjs'
import { exportBackup, exportLegacyLocalData, importBackup } from './backup.mjs'
import { LocalDataError, migrateLocalData, readLocalData, type LocalData } from './local-data.mjs'
import { availablePracticeQuestions, createPracticeInstance, createSimilarPractice, recordReviewEvent, submitPracticeAnswer } from './practice-actions.mjs'
import { PracticeQuestionView, PracticeSelectionView } from './practice-view'
import type { ReadonlyQuestionInstance } from './question-contract.mjs'
import { resolveRouteData } from './route-data.mjs'
import { lessonRegistry } from './lesson-registry.mjs'
import { LessonMap, LessonReference, LessonRouteContent, ProgressView, lessonRefLabel } from './lesson-view'
import { LessonMapView } from './lesson-map-view'
import { deriveProgress } from './progress-data.mjs'
import {
  countCompletedManualProgress,
  updateManualProgress,
  type ManualProgressCommand,
} from './manual-progress.mjs'
import {
  createInitialMapState,
  MapStateError,
  readMapState,
  saveMapState,
  type MapState,
} from './map-state.mjs'
import {
  applyRouteNavigationEffect,
  refreshRouteView,
  resolveRouteView,
  type NavigationCause,
  type RouteView,
  type StoredLocalData,
} from './route-view.mjs'

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
    links: [],
  },
  lesson: {
    title: '単元解説',
    description: '統計の考え方や計算を、基礎から学ぶ画面です。',
    placeholder: '解説本文・図・前提知識への復習リンクは準備中です。',
    links: [
      { label: '学習マップへ', href: '#/map' },
    ],
  },
  practice: {
    title: '演習',
    description: '保存された出題に回答し、結果を確認する画面です。',
    placeholder: '問題を選んでください。',
    links: [],
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
    placeholder: '',
    links: [],
  },
  data: {
    title: 'データ管理',
    description: 'ブラウザー内の演習記録と手動進捗を管理する画面です。',
    placeholder: '演習記録・手動進捗・配置を統合バックアップで書き出し・読み込みできます。',
    links: [{ label: '進捗を見る', href: '#/progress' }],
  },
  'not-found': {
    title: '画面が見つかりません',
    description: '指定したURLに対応する画面はありません。',
    placeholder: '学習マップから利用できる画面へ移動できます。',
    links: [{ label: '学習マップへ戻る', href: '#/map' }],
  },
}

function browserUrl(hash: string) {
  return window.location.pathname + window.location.search + hash
}

function InternalLink({ route, intent = 'normal', children }: {
  route: AppRoute
  intent?: NavigationIntent
  children: ReactNode
}) {
  return <a href={routeToHash(route)} data-nav-intent={intent}>{children}</a>
}

function RouteProblem({ message }: { message: string }) {
  return (
    <section className="placeholder" aria-labelledby="route-problem-title">
      <h2 id="route-problem-title">指定先を開けません</h2>
      <p>{message}</p>
      <p><InternalLink route={{ kind: 'map' }}>学習マップへ</InternalLink> · <InternalLink route={{ kind: 'data' }}>データ管理へ</InternalLink></p>
    </section>
  )
}

function App() {
  const [view, setView] = useState(() => resolveRouteView(
    window.location.hash, window.history.state, 'initial', 0,
  ))
  const [storedData, setStoredData] = useState<StoredLocalData>(() => view.storedData)
  const [mapStateRead, setMapStateRead] = useState(() => readMapState(lessonRegistry))
  const initialMapState = mapStateRead.status === 'missing' || mapStateRead.status === 'ok' || mapStateRead.status === 'migrated'
    ? mapStateRead.state : createInitialMapState(lessonRegistry)
  const [manualProgress, setManualProgress] = useState(() => initialMapState.lessons)
  const [mapStateConfirmed, setMapStateConfirmed] = useState(() => ['missing', 'ok', 'migrated'].includes(mapStateRead.status))
  const initialMapMessage = mapStateRead.status === 'migrated' && mapStateRead.changedLessonIds.length
    ? `教材改訂を検出しました。${mapStateRead.changedLessonIds.length}単元の自己点検を再確認してください。内容は次の手動操作時に保存されます。`
    : mapStateRead.status === 'invalid' || mapStateRead.status === 'unsupported' || mapStateRead.status === 'unreadable'
      ? mapStateRead.error.message : ''
  const [mapStateMessage, setMapStateMessage] = useState(initialMapMessage)
  const [dataMessage, setDataMessage] = useState('')
  const [reviewMessage, setReviewMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [practiceError, setPracticeError] = useState('')
  const [practiceBusy, setPracticeBusy] = useState(false)
  const [pendingPracticeNavigation, setPendingPracticeNavigation] = useState<{ route: AppRoute; message: string; sourceEntryId: string } | null>(null)
  const [mapView, setMapView] = useState<'graph' | 'list'>('graph')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const sectionHeadingRef = useRef<HTMLHeadingElement>(null)
  const mapViewportRef = useRef<Viewport | null>(null)
  const selectedLessonIdRef = useRef<string | null>(null)
  const clearMapSelectionRef = useRef<(() => void) | null>(null)
  const mapGraphContentRef = useRef<HTMLDivElement>(null)
  const mapListContentRef = useRef<HTMLDivElement>(null)
  const mapGraphButtonRef = useRef<HTMLButtonElement>(null)
  const mapListButtonRef = useRef<HTMLButtonElement>(null)
  const viewRef = useRef(view)
  const mapStateRef = useRef<MapState>(initialMapState)
  const mapStateReadRef = useRef(mapStateRead)
  const expectedMapRawRef = useRef(mapStateRead.raw ?? null)
  const mapStateConfirmedRef = useRef(['missing', 'ok', 'migrated'].includes(mapStateRead.status))
  const navigationIdRef = useRef(0)
  const lastHandledRef = useRef('')
  const busyRef = useRef(false)
  const practiceBusyRef = useRef(false)
  const onMapMove = useCallback((viewport: Viewport) => {
    mapViewportRef.current = viewport
  }, [])
  const onMapSelectionChange = useCallback((lessonId: string | null) => {
    selectedLessonIdRef.current = lessonId
  }, [])

  const publishMapStateRead = (next: ReturnType<typeof readMapState>) => {
    mapStateReadRef.current = next
    setMapStateRead(next)
    if (next.status === 'missing' || next.status === 'ok' || next.status === 'migrated') {
      mapStateRef.current = next.state
      expectedMapRawRef.current = next.raw
      mapStateConfirmedRef.current = true
      setMapStateConfirmed(true)
      setManualProgress(next.state.lessons)
      if (next.status === 'migrated' && next.changedLessonIds.length) {
        setMapStateMessage(`教材改訂を検出しました。${next.changedLessonIds.length}単元の自己点検を再確認してください。内容は次の手動操作時に保存されます。`)
      } else {
        setMapStateMessage('')
      }
    } else {
      setMapStateMessage('error' in next ? next.error.message : '手動進捗を読み取れません。')
    }
  }

  const refreshMapState = () => publishMapStateRead(readMapState(lessonRegistry))

  const onManualProgressAction = useCallback((lessonId: string, command: ManualProgressCommand) => {
    const currentRead = mapStateReadRef.current
    if (!['missing', 'ok', 'migrated'].includes(currentRead.status)) {
      setMapStateMessage('手動進捗を確認できないため、編集と保存を停止しています。データ管理画面で保存状態を確認してください。')
      return
    }
    const action = command.type === 'complete'
      ? { ...command, completedAt: new Date().toISOString() }
      : command
    const lessons = updateManualProgress(mapStateRef.current.lessons, lessonId, action)
    if (lessons === mapStateRef.current.lessons) return
    const candidate: MapState = { ...mapStateRef.current, lessons: lessons as MapState['lessons'] }
    try {
      const result = saveMapState(candidate, expectedMapRawRef.current, lessonRegistry)
      mapStateRef.current = result.state
      expectedMapRawRef.current = result.raw
      const read = { status: 'ok' as const, raw: result.raw, state: result.state, changedLessonIds: [] }
      mapStateReadRef.current = read
      setMapStateRead(read)
      setManualProgress(result.state.lessons)
      setMapStateConfirmed(true)
      mapStateConfirmedRef.current = true
      if (currentRead.status !== 'migrated') setMapStateMessage('')
    } catch (error) {
      if (error instanceof MapStateError && error.code === 'storage-changed') refreshMapState()
      setMapStateMessage(error instanceof Error ? error.message : '手動進捗を保存できませんでした。')
    }
  }, [])
  const screen = screenForRoute(view.route)
  const current = screens[screen]
  const entityTitle = view.resolved.status === 'lesson'
    ? view.resolved.section?.title ?? view.resolved.lesson.title
    : view.resolved.status === 'practice'
      ? view.resolved.instance.questionId + 'の演習'
      : view.resolved.status === 'feedback'
        ? '解答結果'
        : current.title
  const pageTitle = entityTitle
  const documentTitle = screen === 'lesson' && view.resolved.status === 'lesson' && view.resolved.section
    ? view.resolved.section.title + ' | ' + view.resolved.lesson.title
    : pageTitle
  const storageError = storedData.status === 'invalid' || storedData.status === 'unreadable'
  const storageIssue = storageError || storedData.status === 'migration-failed'
    ? storedData.error
    : null
  const hasCounts = storedData.status === 'missing' || storedData.status === 'ok'
    || storedData.status === 'legacy' || storedData.status === 'migration-failed'
  const canWritePracticeData = storedData.status === 'missing' || storedData.status === 'ok' || storedData.status === 'legacy'
  const mapStateUnavailable = mapStateRead.status === 'invalid' || mapStateRead.status === 'unsupported' || mapStateRead.status === 'unreadable'
  const canExportCombined = !storageError && !mapStateUnavailable
  const canExportPractice = !storageError
  const mapStateStatusLabel = mapStateRead.status === 'missing' ? '未作成（初期値）'
    : mapStateRead.status === 'ok' ? '保存済み'
      : mapStateRead.status === 'migrated' ? '教材改訂を反映（次回操作時に保存）'
        : mapStateRead.status === 'invalid' ? '破損または容量超過'
          : mapStateRead.status === 'unsupported' ? '未対応の保存形式'
            : '読み込み不能'
  const manualProgressDisabled = mapStateUnavailable
  const manualProgressNotice = mapStateUnavailable
    ? mapStateConfirmed
      ? '手動進捗の保存状態を確認できません。画面には最後に確認した値を表示し、編集と保存を停止しています。'
      : '手動進捗の保存状態を確認できません。画面の初期値は現在の保存内容を示さず、編集と保存を停止しています。'
    : '手動進捗とチェックはこのブラウザーに保存され、演習記録とは別です。統合バックアップに含まれます。'
  const practiceQuestions = availablePracticeQuestions()
  const manualCompletedCount = countCompletedManualProgress(manualProgress, lessonRegistry)
  const progress = useMemo(() => {
    if (storedData.status === 'invalid' || storedData.status === 'unreadable') return null
    return deriveProgress(storedData.data, lessonRegistry, Date.now())
  }, [view.navigationId, storedData])
  const canResolveProgressRoute = (route: Extract<AppRoute, { kind: 'feedback-id' | 'practice-id' }>) => {
    const resolved = resolveRouteData(route, storedData)
    return route.kind === 'feedback-id' ? resolved.status === 'feedback' : resolved.status === 'practice'
  }

  const publishRouteView = (next: RouteView) => {
    setPendingPracticeNavigation((pending) =>
      pending?.sourceEntryId === next.historyState.entryId ? pending : null)
    viewRef.current = next
    setView(next)
    setStoredData(next.storedData)
  }

  const resolveCurrentLocation = (cause: NavigationCause, rawState: unknown, historyWarning = false) => {
    const nextId = ++navigationIdRef.current
    const next = resolveRouteView(window.location.hash, rawState, cause, nextId)
    if (historyWarning) next.historyWarning = true
    if (next.stateNeedsRepair) {
      try {
        window.history.replaceState(next.historyState, '', browserUrl(next.historyState.routeHash))
      } catch {
        next.historyWarning = true
      }
    }
    publishRouteView(next)
  }

  const replaceCurrentEntry = (
    patch: Partial<Pick<RouteHistoryState, 'draft' | 'scrollY'>>,
    publish = true,
  ) => {
    const hash = window.location.hash
    const liveState = validateRouteHistoryState(window.history.state, hash)
    const currentState = liveState ?? viewRef.current.historyState
    if (currentState.routeHash !== hash) return false
    try {
      const nextState = updateRouteHistoryState(currentState, patch)
      window.history.replaceState(nextState, '', browserUrl(hash))
      const nextView = { ...viewRef.current, historyState: nextState }
      viewRef.current = nextView
      if (publish) setView(nextView)
      return true
    } catch {
      setDataMessage('この画面の入力や表示位置を履歴へ保存できませんでした。現在の画面に留まっています。')
      return false
    }
  }

  const saveCurrentPosition = () => {
    return replaceCurrentEntry({ scrollY: window.scrollY })
  }

  const pushNavigation = (route: AppRoute, hash: string, intent: NavigationIntent) => {
    if (!saveCurrentPosition()) return false
    const currentView = viewRef.current
    const currentState = validateRouteHistoryState(window.history.state, window.location.hash)
      ?? currentView.historyState
    const sourceFrame = currentState.returnStack.find((frame) => frame.route.kind === 'feedback-id')
    const sourceAttemptRoute = sourceFrame?.route.kind === 'feedback-id' ? sourceFrame.route : null
    const savedSourceAttempt = sourceAttemptRoute && currentView.storedData.status === 'ok'
      ? currentView.storedData.data.answerAttempts.find((attempt) => attempt.attemptId === sourceAttemptRoute.attemptId)
      : null
    const sourceAttemptId = intent !== 'review' ? null
      : currentView.resolved.status === 'feedback'
        ? currentView.resolved.attempt.gradingResult.isCorrect ? null : currentView.resolved.attempt.attemptId
        : savedSourceAttempt && !savedSourceAttempt.gradingResult.isCorrect ? savedSourceAttempt.attemptId : null
    let options: { attemptId?: string; answer?: string } = {}
    if (intent === 'resume') {
      if (currentView.resolved.status !== 'feedback'
        || route.kind !== 'practice-id'
        || route.instanceId !== currentView.resolved.attempt.instanceId) {
        setDataMessage('保存済み解答から同じ出題を再開できません。')
        return false
      }
      options = {
        attemptId: currentView.resolved.attempt.attemptId,
        answer: currentView.resolved.attempt.answer,
      }
    }
    let nextState: RouteHistoryState | null
    try {
      nextState = navigateRouteHistory(currentState, route, hash, intent, options)
    } catch {
      setDataMessage('画面の復帰情報を作成できませんでした。現在の画面に留まっています。')
      return false
    }
    if (!nextState) {
      setDataMessage('これ以上戻れる復習先はありません。')
      return false
    }
    try {
      window.history.pushState(nextState, '', browserUrl(hash))
    } catch {
      setDataMessage('ブラウザー履歴に復帰情報を保存できませんでした。現在の画面に留まっています。')
      return false
    }
    setReviewMessage('')
    if (intent === 'review' && sourceAttemptId && route.kind === 'lesson-id') {
      try {
        recordReviewEvent(route.lessonId + (route.sectionId ? '#' + route.sectionId : ''), sourceAttemptId)
      } catch {
        setReviewMessage('復習先には移動しましたが、誤答からの復習訪問を保存できませんでした。保存データを確認してください。')
      }
    }
    lastHandledRef.current = hash + '\u0000' + nextState.entryId
    resolveCurrentLocation(intent, nextState)
    return true
  }

  const handleInternalClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const anchor = target.closest<HTMLAnchorElement>('a[data-nav-intent]')
    if (!anchor || event.defaultPrevented || event.button !== 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || (anchor.target && anchor.target !== '_self')
      || anchor.hasAttribute('download')) return
    const url = new URL(anchor.href, window.location.href)
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname
      || url.search !== window.location.search) return
    const intent = anchor.dataset.navIntent as NavigationIntent
    if (!['normal', 'review', 'section', 'resume', 'return'].includes(intent)) return
    event.preventDefault()
    pushNavigation(resolveRoute(url.hash), url.hash, intent)
  }

  const requestDownload = (json: string, filename: string) => {
    let url: string | null = null
    try {
      url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      window.setTimeout(() => { if (url) URL.revokeObjectURL(url) }, 0)
      return true
    } catch {
      if (url) URL.revokeObjectURL(url)
      return false
    }
  }

  const handleExport = (kind: 'combined' | 'practice') => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setDataMessage('')
    try {
      const json = kind === 'combined' ? exportBackup() : exportLegacyLocalData()
      if (!requestDownload(json, kind === 'combined' ? 'sfqc-backup.json' : 'sfqc-practice-v2.json')) {
        throw new Error('JSONファイルを書き出せませんでした。')
      }
      setDataMessage(kind === 'combined' ? '全データの書き出しを開始しました。' : '演習記録のみの書き出しを開始しました。')
    } catch (error) {
      setDataMessage(error instanceof Error ? error.message : '書き出しに失敗しました。')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const refreshRouteWithData = (data: StoredLocalData) => {
    const hash = window.location.hash
    const currentView = viewRef.current
    const state = validateRouteHistoryState(window.history.state, hash) ?? currentView.historyState
    // A data-only refresh must not cancel the route's pending scroll effect.
    const next = refreshRouteView(currentView, data, hash, state)
    if (next.stateNeedsRepair) {
      try {
        window.history.replaceState(next.historyState, '', browserUrl(hash))
      } catch {
        next.historyWarning = true
      }
    }
    publishRouteView(next)
  }

  const openSavedPracticeRoute = (saved: { data: LocalData; raw: string }, route: AppRoute, message: string) => {
    refreshRouteWithData({ status: 'ok', raw: saved.raw, data: saved.data })
    if (pushNavigation(route, routeToHash(route), 'normal')) {
      setPendingPracticeNavigation(null)
    } else {
      setPendingPracticeNavigation({ route, message, sourceEntryId: viewRef.current.historyState.entryId })
    }
  }

  const handlePracticeFailure = (error: unknown) => {
    if (error instanceof LocalDataError && error.code === 'storage-changed') {
      refreshRouteWithData(readLocalData())
    }
    setPracticeError(error instanceof Error ? error.message : '保存に失敗しました。')
  }

  const handleStartPractice = (questionId: string) => {
    if (practiceBusyRef.current) return
    if (!canWritePracticeData) {
      setPracticeError('保存データを読み込めないため、新しい出題を記録できません。')
      return
    }
    practiceBusyRef.current = true
    setPracticeBusy(true)
    setPracticeError('')
    let saved = false
    try {
      const record = createPracticeInstance(questionId)
      saved = true
      openSavedPracticeRoute(record, { kind: 'practice-id', instanceId: record.instance.instanceId },
        '出題snapshotは保存済みですが、画面を開けませんでした。保存済みの出題を開いてください。')
    } catch (error) {
      handlePracticeFailure(error)
    } finally {
      if (!saved) {
        practiceBusyRef.current = false
        setPracticeBusy(false)
      }
    }
  }

  const handleSimilarPractice = (instance: ReadonlyQuestionInstance) => {
    if (practiceBusyRef.current) return
    practiceBusyRef.current = true
    setPracticeBusy(true)
    setPracticeError('')
    let saved = false
    try {
      const record = createSimilarPractice(instance)
      saved = true
      openSavedPracticeRoute(record, { kind: 'practice-id', instanceId: record.instance.instanceId },
        '類題のsnapshotは保存済みですが、画面を開けませんでした。保存済みの出題を開いてください。')
    } catch (error) {
      handlePracticeFailure(error)
    } finally {
      if (!saved) {
        practiceBusyRef.current = false
        setPracticeBusy(false)
      }
    }
  }

  const handleSubmitPractice = (instance: ReadonlyQuestionInstance, answer: string) => {
    if (practiceBusyRef.current || (
      pendingPracticeNavigation?.sourceEntryId === viewRef.current.historyState.entryId
      && pendingPracticeNavigation.route.kind === 'feedback-id'
    )) return
    practiceBusyRef.current = true
    setPracticeBusy(true)
    setPracticeError('')
    let saved = false
    try {
      const result = submitPracticeAnswer(instance, answer)
      if (result.status === 'invalid') {
        const content = instance.questionDefinitionSnapshot.content
        setPracticeError(result.reason === 'invalid-instance'
          ? 'この出題snapshotを確認できません。データ管理画面で保存状態を確認してください。'
          : content.format === 'single-choice'
            ? answer === '' ? '選択肢を1つ選んでください。' : '利用できる選択肢を1つ選んでください。'
            : answer.trim() === '' ? '数値を入力してください。' : '符号付き整数または小数の十進数で入力してください。')
        return
      }
      saved = true
      openSavedPracticeRoute(result, { kind: 'feedback-id', attemptId: result.attempt.attemptId },
        '回答は保存済みですが、解答結果を開けませんでした。保存済みの結果を開いてください。')
    } catch (error) {
      handlePracticeFailure(error)
    } finally {
      if (!saved) {
        practiceBusyRef.current = false
        setPracticeBusy(false)
      }
    }
  }

  const handleRetryPracticeNavigation = () => {
    if (!pendingPracticeNavigation || pendingPracticeNavigation.sourceEntryId !== viewRef.current.historyState.entryId) return
    if (pushNavigation(
      pendingPracticeNavigation.route,
      routeToHash(pendingPracticeNavigation.route),
      'normal',
    )) setPendingPracticeNavigation(null)
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
      const result = await importBackup(file, (state) => {
        if (state.kind === 'legacy') {
          const imported = state.importCounts.questionInstances + '件のsnapshot、' + state.importCounts.answerAttempts + '件の解答試行、' + state.importCounts.reviewEvents + '件の復習イベント'
          return window.confirm(state.damaged
            ? '現在の演習記録は破損しているか未対応形式のため、通常の方法で読み出せません。選択したファイル（' + imported + '）で演習記録のみを置き換えますか？手動進捗と配置は維持します。'
            : '演習記録のみを置き換えます。現在はsnapshot ' + state.existingCounts?.questionInstances + '件、解答試行 ' + state.existingCounts?.answerAttempts + '件、復習イベント ' + state.existingCounts?.reviewEvents + '件です。選択したファイル（' + imported + '）を読み込みますか？手動進捗と配置は維持します。')
        }
        const existingPractice = state.existing.localData
        const existingMap = state.existing.mapState
        const imported = state.imported.localData
        const mapImported = state.imported.mapState.completedLessons
        const statusLabel = (status: string) => ({
          missing: '未保存', ok: '保存済み', migrated: '教材改訂を反映中',
          damaged: '破損', unsupported: '未対応形式', unreadable: '読み込み不能',
        }[status] ?? status)
        return window.confirm(
          '全データを統合バックアップで置き換えます。現在の演習記録は' + statusLabel(existingPractice.status)
          + '（snapshot ' + existingPractice.counts.questionInstances + '件、解答試行 ' + existingPractice.counts.answerAttempts
          + '件、復習イベント ' + existingPractice.counts.reviewEvents + '件）、手動進捗は' + statusLabel(existingMap.status)
          + '（完了 ' + existingMap.completedLessons + '単元）です。選択したファイルの演習記録 '
          + imported.questionInstances + '件・解答試行 ' + imported.answerAttempts + '件・復習イベント '
          + imported.reviewEvents + '件、手動完了 ' + mapImported + '単元で置き換えますか？',
        )
      }, {
        requestRecoveryDownload: (json) => requestDownload(json, 'sfqc-recovery-raw.json'),
        confirmRecovery: () => window.confirm('元データの保全ファイルのダウンロード要求を出しました。ブラウザーは実際にファイルへ保存されたかを確認できません。保全ファイルを保存できたことを確認した場合だけ続行してください。'),
      })
      if (result.status === 'cancelled') {
        setDataMessage('復元をキャンセルしました。演習記録と手動進捗は変更されていません。')
      } else {
        const importedData = { status: 'ok' as const, raw: result.raw, data: result.data }
        refreshRouteWithData(importedData)
        if (result.kind === 'backup') {
          const importedMapState = { status: 'ok' as const, raw: result.mapRaw, state: result.mapState, changedLessonIds: [] }
          publishMapStateRead(importedMapState)
          if (result.changedLessonIds.length) {
            setMapStateMessage(`教材改訂により、${result.changedLessonIds.length}単元の自己点検を未確認にしました。`)
          }
          setDataMessage('演習記録と手動進捗・配置を復元しました。')
        } else {
          setDataMessage('演習記録のみを復元しました。手動進捗と配置は維持しました。')
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '復元に失敗しました。'
      setDataMessage(message + (error && typeof error === 'object' && 'recoveryRequired' in error && error.recoveryRequired
        ? ' ' + ('recoveryDownloadFailed' in error && error.recoveryDownloadFailed
          ? '救出ファイルを書き出せませんでした。保存状態を直ちに確認してください。'
          : '救出rawファイルを保存し、READMEの保守復旧手順を確認してください。') : ''))
      refreshRouteWithData(readLocalData())
      refreshMapState()
    } finally {
      input.value = ''
      busyRef.current = false
      setBusy(false)
    }
  }

  useEffect(() => {
    practiceBusyRef.current = false
    setPracticeBusy(false)
    setPracticeError('')
  }, [view.navigationId])

  useEffect(() => {
    const originalScrollRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    const initial = viewRef.current
    if (initial.stateNeedsRepair) {
      try {
        window.history.replaceState(initial.historyState, '', browserUrl(initial.historyState.routeHash))
      } catch {
        const failed = { ...initial, historyWarning: true }
        viewRef.current = failed
        setView(failed)
      }
    }
    lastHandledRef.current = initial.historyState.routeHash + '\u0000' + initial.historyState.entryId

    const handleLocationChange = () => {
      setReviewMessage('')
      const hash = window.location.hash
      const rawState = window.history.state
      const structuralState = validateRouteHistoryState(rawState, hash)
      const signature = structuralState ? hash + '\u0000' + structuralState.entryId : hash + '\u0000invalid'
      if (signature === lastHandledRef.current) return
      const next = resolveRouteView(hash, rawState, structuralState ? 'restore' : 'normal', ++navigationIdRef.current)
      if (next.stateNeedsRepair) {
        try {
          window.history.replaceState(next.historyState, '', browserUrl(hash))
        } catch {
          next.historyWarning = true
        }
      }
      lastHandledRef.current = hash + '\u0000' + next.historyState.entryId
      publishRouteView(next)
    }

    window.addEventListener('popstate', handleLocationChange)
    window.addEventListener('hashchange', handleLocationChange)
    return () => {
      window.removeEventListener('popstate', handleLocationChange)
      window.removeEventListener('hashchange', handleLocationChange)
      window.history.scrollRestoration = originalScrollRestoration
    }
  }, [])

  useEffect(() => {
    const viewAtSchedule = view
    const isCurrent = () => viewRef.current.navigationId === viewAtSchedule.navigationId
      && window.history.state?.entryId === viewAtSchedule.historyState.entryId
      && window.location.hash === viewAtSchedule.historyState.routeHash
    const frame = window.requestAnimationFrame(() => {
      if (!isCurrent()) return
      applyRouteNavigationEffect(viewAtSchedule.navigation, viewAtSchedule.historyState, {
        heading: headingRef.current,
        sectionHeading: sectionHeadingRef.current,
        scrollTo: (x, y) => window.scrollTo(x, y),
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [view.navigationId])

  useEffect(() => {
    document.title = documentTitle + ' | SfQC'
  }, [documentTitle])

  useEffect(() => {
    const onScroll = () => {
      const scheduled = viewRef.current
      const hash = window.location.hash
      const currentState = validateRouteHistoryState(window.history.state, hash)
      if (!currentState || currentState.entryId !== scheduled.historyState.entryId
        || viewRef.current.navigationId !== scheduled.navigationId) return
      replaceCurrentEntry({ scrollY: window.scrollY }, false)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [view.navigationId])

  useEffect(() => {
    if (storedData.status !== 'legacy') return
    try {
      const result = migrateLocalData(storedData.raw, storedData.data)
      const migrated = { status: 'ok' as const, raw: result.raw, data: result.data }
      refreshRouteWithData(migrated)
      setDataMessage('保存データをschemaVersion 2へ移行しました。')
    } catch (error) {
      if (error instanceof LocalDataError && error.code === 'storage-changed') {
        refreshRouteWithData(readLocalData())
        return
      }
      const migrationError = error instanceof Error
        ? error
        : new Error('保存データの移行に失敗しました。元のデータはそのままです。')
      const failed: StoredLocalData = {
        status: 'migration-failed', raw: storedData.raw, data: storedData.data, error: migrationError,
      }
      refreshRouteWithData(failed)
      setDataMessage(migrationError.message + ' データ管理画面からバックアップを保存できます。')
    }
  }, [storedData])

  const changeMapView = (next: 'graph' | 'list') => {
    const focusedContent = mapView === 'graph' ? mapGraphContentRef.current : mapListContentRef.current
    const returnFocus = focusedContent?.contains(document.activeElement) ?? false
    setMapView(next)
    if (returnFocus) {
      window.requestAnimationFrame(() => {
        (next === 'graph' ? mapGraphButtonRef.current : mapListButtonRef.current)?.focus()
      })
    }
  }

  const handleMapKeyDownCapture = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || selectedLessonIdRef.current === null) return
    event.preventDefault()
    event.stopPropagation()
    if (mapView === 'graph') {
      if (clearMapSelectionRef.current) clearMapSelectionRef.current()
      else selectedLessonIdRef.current = null
    } else {
      selectedLessonIdRef.current = null
    }
  }

  const routeMessages = <>
    {storageIssue && (
      <p className="storage-alert" role="alert">
        {storageIssue.message} 保存データを空として扱ったり、自動で上書きしたりしません。データ管理画面で確認してください。
      </p>
    )}
    {mapStateUnavailable && <p className="storage-alert" role="alert">
      {mapStateMessage || '手動進捗を確認できません。'} {mapStateConfirmed
        ? '画面には最後に確認した値を表示し、編集と保存を停止しています。'
        : '画面の初期値は現在の保存内容を示さず、編集と保存を停止しています。'}
    </p>}
    {!mapStateUnavailable && mapStateMessage && <p className="storage-alert" role="status" aria-live="polite">{mapStateMessage}</p>}
    {view.historyWarning && (
      <p className="storage-alert" role="status">
        このURLの復帰情報は利用できないため、保存データとURLだけで画面を開きました。読書位置や復習経路の一部は復元できないことがあります。
      </p>
    )}
    {reviewMessage && <p className="storage-alert" role="status" aria-live="polite">{reviewMessage}</p>}
    {pendingPracticeNavigation && (
      <section className="practice-recovery" role="status" aria-live="polite">
        <p>{pendingPracticeNavigation.message}</p>
        <button type="button" onClick={handleRetryPracticeNavigation}>保存済みの画面を開く</button>
      </section>
    )}
  </>

  const renderLessonRoute = () => {
    if (view.route.kind !== 'lesson-id') return null
    if (view.resolved.status === 'data-error') return <RouteProblem message="保存データに問題があるため、このID付き画面を解決できません。データ管理画面で保存状態を確認してください。" />
    if (view.resolved.status === 'unknown-id') {
      return <RouteProblem message={view.resolved.target === 'section'
        ? 'この単元に指定された節はありません。別の節を選ぶか、学習マップへ戻ってください。'
        : '指定された単元IDは教材レジストリにありません。学習マップから利用できる教材を選んでください。'} />
    }
    if (view.resolved.status === 'unavailable-lesson') {
      return <RouteProblem message="この教材はまだ収録されていません。学習マップから利用できる教材を選んでください。" />
    }
    if (view.resolved.status !== 'lesson') return null
    return <LessonRouteContent
      lesson={view.resolved.lesson}
      sectionId={view.route.sectionId}
      sectionHeadingRef={sectionHeadingRef}
    />
  }

  const renderPracticeRoute = () => {
    if (view.route.kind !== 'practice-id') return null
    if (view.resolved.status === 'data-error') return <RouteProblem message="保存データに問題があるため、出題IDを解決できません。データ管理画面で保存状態を確認してください。" />
    if (view.resolved.status === 'unknown-id') {
      return <RouteProblem message="指定された出題IDは保存データにありません。別の問題へ自動で置き換えていません。学習マップから利用できる内容を選んでください。" />
    }
    if (view.resolved.status !== 'practice') return null
    const { instance } = view.resolved
    const canCreateSimilar = instance.kind === 'generated' && practiceQuestions.some(
      (question) => question.kind === 'generated' && question.questionId === instance.questionId,
    )
    return (
      <PracticeQuestionView
        instance={instance}
        entryId={view.historyState.entryId}
        draft={view.historyState.draft}
        error={practiceError}
        busy={practiceBusy}
        canCreateSimilar={canCreateSimilar}
        similarUnavailableMessage="現在の問題定義が利用できないため、類題を作成できません。"
        onDraftChange={(draft) => {
          setPracticeError('')
          return replaceCurrentEntry({ draft })
        }}
        onSubmit={(answer) => handleSubmitPractice(instance, answer)}
        onSimilar={() => handleSimilarPractice(instance)}
      />
    )
  }

  const renderFeedbackRoute = () => {
    if (view.route.kind !== 'feedback-id') return null
    if (view.resolved.status === 'data-error') return <RouteProblem message="保存データに問題があるため、解答IDを解決できません。データ管理画面で保存状態を確認してください。" />
    if (view.resolved.status === 'unknown-id') {
      return <RouteProblem message="指定された解答IDは保存データにありません。新しい解答や別の問題へ置き換えていません。" />
    }
    if (view.resolved.status !== 'feedback') return null
    const { attempt, instance } = view.resolved
    const feedback = attempt.gradingResult.feedback
    const practiceRoute: AppRoute = { kind: 'practice-id', instanceId: instance.instanceId }
    return (
      <section className="route-summary" aria-labelledby="feedback-title">
        <p>解答ID：<code>{attempt.attemptId}</code></p>
        <p>出題ID：<code>{instance.instanceId}</code></p>
        <h2 id="feedback-title">解答結果</h2>
        <p>あなたの回答：{attempt.answer}</p>
        <p>{attempt.gradingResult.isCorrect ? '正解です。' : '不正解です。'}</p>
        <p>{instance.questionDefinitionSnapshot.content.solution}</p>
        {feedback && (
          <div className="reference-group">
            <h3>解説</h3>
            <p>{feedback.explanation}</p>
            <LessonReference
              targetRef={feedback.lessonRef}
              label={lessonRefLabel(feedback.lessonRef)}
              intent="review"
            />
          </div>
        )}
        <p><InternalLink route={practiceRoute} intent="resume">同じ出題を再開する</InternalLink></p>
      </section>
    )
  }

  return (
    <div className={`app-shell${screen === 'map' ? ` map-app-shell${mapView === 'list' ? ' map-list-layout' : ''}` : ''}`} onClick={handleInternalClick}>
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
        <a className="site-brand" href="#/map" data-nav-intent="normal">SfQC</a>
        <nav className="primary-nav" aria-label="メイン">
          {navigation.map((item) => (
            <a
              key={item.screen}
              href={item.href}
              data-nav-intent="normal"
              aria-current={screen === item.screen ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      {screen === 'map' ? (
        <main className="map-workspace" onKeyDownCapture={handleMapKeyDownCapture}>
          <div className="map-route-messages">{routeMessages}</div>
          {view.historyState.returnStack.length > 0 && (
            <nav className="return-navigation map-return-navigation" aria-label="復習から戻る">
              <a href={view.historyState.returnStack.at(-1)?.routeHash} data-nav-intent="return">1段戻る</a>
            </nav>
          )}
          <header className="map-toolbar">
            <div className="map-heading">
              <h1 id="page-title" ref={headingRef} tabIndex={-1}>{pageTitle}</h1>
              <p>{current.description}</p>
              <p className="manual-progress-count">手動完了 {manualCompletedCount} / {lessonRegistry.lessons.length}</p>
              <p className="manual-progress-notice">{manualProgressNotice}</p>
            </div>
            <div className="map-toolbar-actions">
              <div className="map-mode-toggle" role="group" aria-label="学習マップの表示">
                <button
                  ref={mapGraphButtonRef}
                  type="button"
                  className="map-mode-button"
                  aria-pressed={mapView === 'graph'}
                  onClick={() => changeMapView('graph')}
                >マップ表示</button>
                <button
                  ref={mapListButtonRef}
                  type="button"
                  className="map-mode-button"
                  aria-pressed={mapView === 'list'}
                  onClick={() => changeMapView('list')}
                >教材一覧</button>
              </div>
              <a className="map-license-link" aria-label="使用ライブラリのライセンス" href={import.meta.env.BASE_URL + 'third-party-licenses.txt'}>ライセンス</a>
            </div>
          </header>
          {mapView === 'graph' ? (
            <div className="map-graph-content" ref={mapGraphContentRef}>
              <LessonMapView
                viewport={mapViewportRef.current}
                selectedLessonId={selectedLessonIdRef.current}
                manualProgress={manualProgress}
                manualProgressDisabled={manualProgressDisabled}
                onManualProgressAction={onManualProgressAction}
                onViewportChange={onMapMove}
                onSelectionChange={onMapSelectionChange}
                clearSelectionRef={clearMapSelectionRef}
              />
            </div>
          ) : (
            <div className="map-list-content" ref={mapListContentRef}>
              <article className="screen map-list-screen"><LessonMap progress={progress} /></article>
            </div>
          )}
        </main>
      ) : (
      <main className="page-content">
        {routeMessages}
        <article className="screen">
          <h1 id="page-title" ref={headingRef} tabIndex={-1}>{pageTitle}</h1>
          <p className="description">{current.description}</p>

          {screen === 'data' ? (
            <section className="data-panel" aria-labelledby="data-title">
              <h2 id="data-title">保存データ</h2>
              <p>出題snapshot：{hasCounts ? storedData.data.questionInstances.length + '件' : '読み込みエラー'}</p>
              <p>解答試行：{hasCounts ? storedData.data.answerAttempts.length + '件' : '読み込みエラー'}</p>
              <p>復習イベント：{hasCounts ? storedData.data.reviewEvents.length + '件' : '読み込みエラー'}</p>
              <p>手動進捗・自己点検：{mapStateStatusLabel}{!mapStateUnavailable ? `（手動完了 ${manualCompletedCount} / ${lessonRegistry.lessons.length}）` : ''}</p>
              <p>データはこのブラウザー内に保存され、サーバーへ送信されません。統合バックアップは演習記録・手動進捗・配置を含みます。演習記録のみの書き出しも選べます。</p>
              <div className="data-actions">
                <button type="button" onClick={() => handleExport('combined')} disabled={busy || !canExportCombined}>
                  全データを書き出し
                </button>
                <button type="button" onClick={() => handleExport('practice')} disabled={busy || !canExportPractice}>
                  演習記録のみを書き出し（schema v2）
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
              <p className="data-limit">演習記録：schemaVersion 2・snapshot最大500件・JSONはUTF-8で2 MiBまで。手動進捗：独立保存領域・64 KiBまで。</p>
              <p>容量上限を超えるときは未編集バックアップを保存し、複製したJSONを整理してから読み込みます。snapshotを除く場合は参照する解答試行も、解答試行を除く場合は参照する復習イベントも一緒に除いてください。保存履歴は自動削除しません。</p>
              <p className="data-message" role="status" aria-live="polite">{dataMessage}</p>
            </section>
          ) : screen === 'lesson' && view.route.kind === 'lesson-id' ? (
            renderLessonRoute()
          ) : screen === 'lesson' ? (
            <section className="lesson-panel" aria-labelledby="lesson-selection-title">
              <h2 id="lesson-selection-title">単元を選んでください</h2>
              <p>学習マップから収録済みの単元または節を選ぶと、教材を表示できます。</p>
            </section>
          ) : screen === 'practice' && view.route.kind === 'practice-id' ? (
            renderPracticeRoute()
          ) : screen === 'practice' ? (
            <PracticeSelectionView
              questions={practiceQuestions}
              disabled={!canWritePracticeData || practiceBusy}
              error={practiceError}
              onStart={handleStartPractice}
            />
          ) : screen === 'feedback' && view.route.kind === 'feedback-id' ? (
            renderFeedbackRoute()
          ) : screen === 'progress' ? (
            progress
              ? <ProgressView
                progress={progress}
                canResolveRoute={canResolveProgressRoute}
                unavailableMessage={storedData.status === 'migration-failed'
                  ? '保存形式の移行に失敗したため、この保存IDは開けません。'
                  : '保存IDを現在のデータから解決できません。'}
              />
              : <section className="placeholder" aria-labelledby="progress-unavailable-title">
                <h2 id="progress-unavailable-title">進捗を集計できません</h2>
                <p>保存データを検証できないため、数値を表示していません。データ管理画面で保存状態を確認してください。</p>
                <p><InternalLink route={{ kind: 'data' }}>データ管理へ</InternalLink></p>
              </section>
          ) : (
            <section className="placeholder" aria-labelledby="placeholder-title">
              <h2 id="placeholder-title">この画面でできること</h2>
              <p>{current.placeholder}</p>
            </section>
          )}

          {view.historyState.returnStack.length > 0 && (
            <nav className="return-navigation" aria-label="復習から戻る">
              <a
                href={view.historyState.returnStack.at(-1)?.routeHash}
                data-nav-intent="return"
              >
                1段戻る
              </a>
            </nav>
          )}

          {current.links.length > 0 && <nav className="screen-navigation" aria-label="この画面から移動">
            <ul>{current.links.map((link) => (
              <li key={link.label}>
                <a href={link.href} data-nav-intent="normal">{link.label}</a>
              </li>
            ))}</ul>
          </nav>}

          <footer className="site-footer">
            <a href={import.meta.env.BASE_URL + 'third-party-licenses.txt'}>使用ライブラリのライセンス</a>
          </footer>
        </article>
      </main>
      )}
    </div>
  )
}

export default App
