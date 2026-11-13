import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type ReactNode } from 'react'
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
import { exportLearningBackup, importLearningBackup, recheckLearningBackupImport, type LearningBackupImportResult } from './backup.mjs'
import { lessonRegistry } from './lesson-registry.mjs'
import { LessonMap, LessonRouteContent } from './lesson-view'
import { DescriptiveStatisticsExercisePreview } from './descriptive-statistics-exercise-preview'
import { DescriptiveStatisticsCourse } from './descriptive-statistics-course'
import { CourseProgressView } from './course-progress-view'
import { LessonMapView, samePositions, type LayoutSaveResult, type Positions } from './lesson-map-view'
import { deriveCourseProgress } from './course-progress.mjs'
import {
  type ManualProgressCommand,
  type ManualProgressState,
} from './manual-progress.mjs'
import { readLearningState, saveLearningState, type LearningState, type LearningStateReadResult } from './learning-state.mjs'
import { appendPracticeResult, readPracticeResults, recheckPracticeResult, type PracticeResultSaveResult, type PracticeResultsReadResult } from './practice-results.mjs'
import {
  applyRouteNavigationEffect,
  resolveRouteView,
  type NavigationCause,
  type RouteView,
} from './route-view.mjs'

const navigation = [
  { label: '学習マップ', href: '#/map', screen: 'map' },
  { label: '進捗', href: '#/progress', screen: 'progress' },
  { label: 'データ管理', href: '#/data', screen: 'data' },
] as const

type Theme = 'light' | 'dark'
type ThemePreference = 'system' | Theme

const themeStorageKey = 'sfqc:theme-preference'
const themeMediaQuery = '(prefers-color-scheme: dark)'

type PendingJudgement = {
  id: string
  record: { categoryId: string; isCorrect: boolean; attemptedAt: string }
  status: 'waiting' | 'not-written' | 'unknown' | 'conflict'
  pendingResult?: PracticeResultSaveResult
}

type PendingLearningChange =
  | { kind: 'layout'; positions: Positions }
  | { kind: 'manual-progress'; lessonId: string; completedAt: string | null }

type PendingLearningWrite = {
  status: 'unknown' | 'retryable'
  expectedRaw: string | null
  candidateRaw: string
  change: PendingLearningChange
}

function emptyLearningState(): LearningState {
  return {
    schemaVersion: 1,
    lessons: Object.fromEntries(lessonRegistry.lessons.map((lesson) => [lesson.lessonId, { completedAt: null }])),
    positions: {},
  }
}

function manualProgressFromLearning(state: LearningState): ManualProgressState {
  return Object.fromEntries(lessonRegistry.lessons.map((lesson) => {
    const completedAt = state.lessons[lesson.lessonId]?.completedAt ?? null
    return [lesson.lessonId, {
      status: completedAt ? 'completed' : 'not-started',
      checks: lesson.learningObjectives.map(() => false),
      completedAt,
    }]
  }))
}

function isReadableLearningState(read: LearningStateReadResult): read is Extract<LearningStateReadResult, { status: 'missing' | 'ok' }> {
  return read.status === 'missing' || read.status === 'ok'
}

function isReadablePracticeResults(read: PracticeResultsReadResult): read is Extract<PracticeResultsReadResult, { status: 'missing' | 'ok' }> {
  return read.status === 'missing' || read.status === 'ok'
}

function readSystemTheme(): Theme {
  try {
    const mediaQuery = window.matchMedia(themeMediaQuery)
    return mediaQuery.matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function readThemePreference(): ThemePreference {
  try {
    const preference = window.localStorage.getItem(themeStorageKey)
    return preference === 'light' || preference === 'dark' ? preference : 'system'
  } catch {
    return 'system'
  }
}

function saveThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') window.localStorage.removeItem(themeStorageKey)
    else window.localStorage.setItem(themeStorageKey, preference)
  } catch {
    // Theme preference failure must not affect learning data.
  }
}

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
    description: '基本統計量の理解を確かめるコース演習です。',
    placeholder: '学習マップから単元の演習を開いてください。',
    links: [],
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
  const [themePreference, setThemePreference] = useState(readThemePreference)
  const [systemTheme, setSystemTheme] = useState(readSystemTheme)
  const theme = themePreference === 'system' ? systemTheme : themePreference
  const [view, setView] = useState(() => resolveRouteView(
    window.location.hash, window.history.state, 'initial', 0,
  ))
  const [mapStateRead, setMapStateRead] = useState(() => readLearningState(lessonRegistry))
  const [pendingLearningWrite, setPendingLearningWrite] = useState<PendingLearningWrite | null>(null)
  const initialMapState = isReadableLearningState(mapStateRead) ? mapStateRead.state : emptyLearningState()
  const [manualProgress, setManualProgress] = useState(() => manualProgressFromLearning(initialMapState))
  const [positionSyncRevision, setPositionSyncRevision] = useState(0)
  const [mapStateConfirmed, setMapStateConfirmed] = useState(() => isReadableLearningState(mapStateRead))
  const initialMapMessage = mapStateRead.status === 'invalid' || mapStateRead.status === 'unsupported' || mapStateRead.status === 'unreadable'
      ? mapStateRead.error.message : ''
  const [mapStateMessage, setMapStateMessage] = useState(initialMapMessage)
  const [dataMessage, setDataMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [mapView, setMapView] = useState<'graph' | 'list'>('graph')
  const [mapAuthorMode, setMapAuthorMode] = useState(false)
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
  const mapStateRef = useRef<LearningState>(initialMapState)
  const mapStateReadRef = useRef(mapStateRead)
  const pendingLearningWriteRef = useRef<PendingLearningWrite | null>(pendingLearningWrite)
  const publishedPositionsRef = useRef(initialMapState.positions)
  const navigationIdRef = useRef(0)
  const lastHandledRef = useRef('')
  const busyRef = useRef(false)
  const [practiceResultsRead, setPracticeResultsRead] = useState(() => readPracticeResults())
  const practiceResultsReadRef = useRef(practiceResultsRead)
  const expectedPracticeRawRef = useRef(isReadablePracticeResults(practiceResultsRead) ? practiceResultsRead.raw : null)
  const [pendingJudgements, setPendingJudgements] = useState<PendingJudgement[]>([])
  const pendingJudgementsRef = useRef<PendingJudgement[]>([])
  const judgementIdRef = useRef(0)
  const [pendingBackupImport, setPendingBackupImport] = useState<LearningBackupImportResult | null>(null)
  const keepJudgementsAfterRestoreRef = useRef(true)
  const onMapMove = useCallback((viewport: Viewport) => {
    mapViewportRef.current = viewport
  }, [])
  const onMapSelectionChange = useCallback((lessonId: string | null) => {
    selectedLessonIdRef.current = lessonId
  }, [])

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (themePreference !== 'system') return
    let mediaQuery: MediaQueryList
    try {
      mediaQuery = window.matchMedia(themeMediaQuery)
      setSystemTheme(mediaQuery.matches ? 'dark' : 'light')
    } catch {
      setSystemTheme('light')
      return
    }
    const onSystemThemeChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'dark' : 'light')
    try {
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', onSystemThemeChange)
        return () => mediaQuery.removeEventListener('change', onSystemThemeChange)
      }
      if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(onSystemThemeChange)
        return () => mediaQuery.removeListener(onSystemThemeChange)
      }
    } catch {
      // A failed subscription must not override the current system theme value.
    }
  }, [themePreference])

  const handleThemePreferenceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const preference = event.currentTarget.value
    if (preference !== 'system' && preference !== 'light' && preference !== 'dark') return
    setThemePreference(preference)
    if (preference === 'system') setSystemTheme(readSystemTheme())
    saveThemePreference(preference)
  }

  const publishMapStateRead = (next: LearningStateReadResult, syncPositions = true) => {
    mapStateReadRef.current = next
    setMapStateRead(next)
    if (isReadableLearningState(next)) {
      const positionsChanged = !samePositions(publishedPositionsRef.current, next.state.positions)
      publishedPositionsRef.current = next.state.positions
      if (syncPositions && positionsChanged) setPositionSyncRevision((revision) => revision + 1)
      mapStateRef.current = next.state
      setMapStateConfirmed(true)
      setManualProgress(manualProgressFromLearning(next.state))
      setMapStateMessage('')
    } else {
      setMapStateMessage('error' in next ? next.error.message : '手動進捗を読み取れません。')
    }
  }

  const publishPendingLearningWrite = (next: PendingLearningWrite | null) => {
    pendingLearningWriteRef.current = next
    setPendingLearningWrite(next)
  }

  const refreshMapState = () => publishMapStateRead(readLearningState(lessonRegistry))

  const saveLearningChange = (change: PendingLearningChange, base: Extract<LearningStateReadResult, { status: 'missing' | 'ok' }>): LayoutSaveResult => {
    const candidate: LearningState = change.kind === 'layout'
      ? { ...base.state, positions: { ...base.state.positions, ...change.positions } }
      : { ...base.state, lessons: { ...base.state.lessons, [change.lessonId]: { completedAt: change.completedAt } } }
    const result = saveLearningState(candidate, base.raw, lessonRegistry)
    if (result.status === 'saved') {
      publishMapStateRead(result.latest)
      publishPendingLearningWrite(null)
      setMapStateMessage('')
      return { ok: true, positions: result.state.positions }
    }

    const latestRead = isReadableLearningState(result.latest) ? result.latest : null
    if (latestRead && result.candidateRaw !== null && latestRead.raw === result.candidateRaw) {
      publishMapStateRead(result.latest)
      publishPendingLearningWrite(null)
      setMapStateMessage('保存状態を確認し、対象の変更が保存済みであることを確認しました。')
      return { ok: true, positions: latestRead.state.positions }
    }
    publishMapStateRead(result.latest)
    if (result.candidateRaw !== null) {
      publishPendingLearningWrite({
        status: result.status === 'unknown' || !latestRead ? 'unknown' : 'retryable',
        expectedRaw: latestRead ? latestRead.raw : result.expectedRaw,
        candidateRaw: result.candidateRaw,
        change,
      })
    }
    const message = result.status === 'unknown' || !latestRead
      ? '手動進捗・マップ配置の保存結果を確認できません。データ管理画面で保存状態を再確認してください。'
      : result.status === 'conflict'
        ? '保存データが別の変更で更新されました。対象の変更は保持しています。確認後に再試行できます。'
        : result.error?.message ?? '手動進捗・マップ配置を保存できませんでした。対象の変更は保持しています。'
    setMapStateMessage(message)
    return { ok: false, positions: latestRead ? latestRead.state.positions : mapStateRef.current.positions }
  }

  const onMapLayoutSave = useCallback((positions: Positions, changedPositions: Positions): LayoutSaveResult => {
    const currentRead = mapStateReadRef.current
    if (pendingLearningWriteRef.current) {
      setMapStateMessage('保存結果が確認できていない変更があります。データ管理画面で確認または再試行してください。')
      return { ok: false, positions: mapStateRef.current.positions }
    }
    if (!isReadableLearningState(currentRead)) {
      setMapStateMessage('手動進捗の保存状態を確認できないため、配置の編集と保存を停止しています。データ管理画面で保存状態を確認してください。')
      return { ok: false, positions: mapStateRef.current.positions }
    }
    return saveLearningChange({ kind: 'layout', positions: changedPositions }, {
      ...currentRead,
      state: { ...currentRead.state, positions: { ...currentRead.state.positions, ...positions } },
    })
  }, [])

  const onManualProgressAction = useCallback((lessonId: string, command: ManualProgressCommand) => {
    const currentRead = mapStateReadRef.current
    if (pendingLearningWriteRef.current) {
      setMapStateMessage('保存結果が確認できていない変更があります。データ管理画面で確認または再試行してください。')
      return
    }
    if (!isReadableLearningState(currentRead)) {
      setMapStateMessage('手動進捗を確認できないため、編集と保存を停止しています。データ管理画面で保存状態を確認してください。')
      return
    }
    if (command.type !== 'complete' && command.type !== 'reopen') return
    const prior = currentRead.state.lessons[lessonId]
    if (!prior) return
    const completedAt = command.type === 'complete' ? new Date().toISOString() : null
    if (prior.completedAt === completedAt) return
    saveLearningChange({ kind: 'manual-progress', lessonId, completedAt }, currentRead)
  }, [])

  const recheckPendingLearningWrite = () => {
    const pending = pendingLearningWriteRef.current
    if (!pending || pending.status !== 'unknown') return
    const latest = readLearningState(lessonRegistry)
    if (!isReadableLearningState(latest)) {
      publishMapStateRead(latest)
      setMapStateMessage('手動進捗の読み取りがまだできません。候補を保持したまま、再確認を続けてください。')
      return
    }
    publishMapStateRead(latest)
    if (latest.raw === pending.candidateRaw) {
      publishPendingLearningWrite(null)
      setMapStateMessage('保存状態を再確認し、保留中の変更が保存済みであることを確認しました。')
      return
    }
    publishPendingLearningWrite({ ...pending, status: 'retryable', expectedRaw: latest.raw })
    setMapStateMessage('保存状態を再確認しました。変更は未保存のまま保持されています。必要なら再試行してください。')
  }

  const retryPendingLearningWrite = () => {
    const pending = pendingLearningWriteRef.current
    if (!pending || pending.status !== 'retryable') return
    const latest = readLearningState(lessonRegistry)
    if (!isReadableLearningState(latest)) {
      publishMapStateRead(latest)
      publishPendingLearningWrite({ ...pending, status: 'unknown' })
      setMapStateMessage('手動進捗の読み取りができないため再試行を保留しました。候補を保持して再確認してください。')
      return
    }
    if (latest.raw === pending.candidateRaw) {
      publishMapStateRead(latest)
      publishPendingLearningWrite(null)
      setMapStateMessage('保存状態を確認し、保留中の変更が保存済みであることを確認しました。')
      return
    }
    if (latest.raw !== pending.expectedRaw) {
      publishMapStateRead(latest)
      publishPendingLearningWrite({ ...pending, expectedRaw: latest.raw })
      setMapStateMessage('保存状態が再試行前に更新されました。変更を保持しています。保存状態を確認してから再試行してください。')
      return
    }
    publishMapStateRead(latest)
    saveLearningChange(pending.change, latest)
  }

  const publishPracticeResultsRead = (next: PracticeResultsReadResult) => {
    practiceResultsReadRef.current = next
    setPracticeResultsRead(next)
    if (isReadablePracticeResults(next)) expectedPracticeRawRef.current = next.raw
  }

  const publishPendingJudgements = (next: PendingJudgement[]) => {
    pendingJudgementsRef.current = next
    setPendingJudgements(next)
  }

  const savePendingJudgement = (id: string) => {
    const current = pendingJudgementsRef.current.find((item) => item.id === id)
    if (!current || current.status === 'unknown') return
    const result = appendPracticeResult(current.record as Parameters<typeof appendPracticeResult>[0], expectedPracticeRawRef.current)
    publishPracticeResultsRead(result.latest)
    if (result.status === 'saved') {
      publishPendingJudgements(pendingJudgementsRef.current.filter((item) => item.id !== id))
      return
    }
    publishPendingJudgements(pendingJudgementsRef.current.map((item) => item.id !== id ? item : {
      ...item,
      status: result.status === 'unknown' ? 'unknown' : result.status === 'conflict' ? 'conflict' : 'not-written',
      pendingResult: result,
    }))
  }

  const drainPendingJudgements = () => {
    for (const candidate of pendingJudgementsRef.current) {
      if (candidate.status === 'unknown') return
      if (candidate.status !== 'waiting') continue
      savePendingJudgement(candidate.id)
      if (pendingJudgementsRef.current.some((item) => item.status === 'unknown')) return
    }
  }

  const handleFirstGrade = (categoryId: string, isCorrect: boolean) => {
    const candidate: PendingJudgement = {
      id: 'judgement-' + Date.now() + '-' + (++judgementIdRef.current),
      record: { categoryId, isCorrect, attemptedAt: new Date().toISOString() },
      status: 'waiting',
    }
    publishPendingJudgements([...pendingJudgementsRef.current, candidate])
    drainPendingJudgements()
  }

  const retryPendingJudgement = (candidate: PendingJudgement) => {
    if (candidate.status === 'unknown' && candidate.pendingResult) {
      const result = recheckPracticeResult(candidate.pendingResult)
      publishPracticeResultsRead(result.latest)
      if (result.status === 'saved') {
        publishPendingJudgements(pendingJudgementsRef.current.filter((item) => item.id !== candidate.id))
        drainPendingJudgements()
        return
      }
      publishPendingJudgements(pendingJudgementsRef.current.map((item) => item.id === candidate.id ? {
        ...item,
        status: result.status === 'unknown' ? 'unknown' : result.status === 'conflict' ? 'conflict' : 'not-written',
        pendingResult: result,
      } : item))
      if (result.status !== 'unknown') drainPendingJudgements()
      return
    }
    if (candidate.status === 'conflict' && !window.confirm('保存状態が変わっています。この判定を現在の保存済み記録に追加しますか？')) return
    publishPendingJudgements(pendingJudgementsRef.current.map((item) => item.id === candidate.id ? { ...item, status: 'waiting' } : item))
    drainPendingJudgements()
  }

  const recheckPracticeStorage = () => {
    const latest = readPracticeResults()
    publishPracticeResultsRead(latest)
    if (latest.status === 'missing' || latest.status === 'ok') drainPendingJudgements()
  }

  useEffect(() => {
    if (pendingJudgements.length === 0 && pendingLearningWrite === null) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [pendingJudgements.length, pendingLearningWrite !== null])

  const screen = screenForRoute(view.route)
  const current = screens[screen]
  const entityTitle = view.resolved.status === 'lesson'
    ? view.resolved.section?.title ?? view.resolved.lesson.title
    : view.resolved.status === 'course-practice'
      ? view.resolved.lesson.title + 'の演習'
      : current.title
  const pageTitle = entityTitle
  const documentTitle = screen === 'lesson' && view.resolved.status === 'lesson' && view.resolved.section
    ? view.resolved.section.title + ' | ' + view.resolved.lesson.title
    : pageTitle
  const mapStateUnavailable = mapStateRead.status === 'invalid' || mapStateRead.status === 'unsupported' || mapStateRead.status === 'unreadable'
  const practiceResultsUnavailable = practiceResultsRead.status === 'invalid' || practiceResultsRead.status === 'unsupported' || practiceResultsRead.status === 'unreadable'
  const canExportCombined = isReadableLearningState(mapStateRead) && isReadablePracticeResults(practiceResultsRead)
    && pendingLearningWrite === null
  const mapStateStatusLabel = mapStateRead.status === 'missing' ? '未作成（初期値）'
    : mapStateRead.status === 'ok' ? '保存済み'
      : mapStateRead.status === 'invalid' ? '破損または容量超過'
        : mapStateRead.status === 'unsupported' ? '未対応の保存形式'
          : '読み込み不能'
  const manualProgressDisabled = mapStateUnavailable || pendingLearningWrite !== null
  const manualProgressNotice = pendingLearningWrite
    ? '未確定の保存候補があります。データ管理画面で保存状態を確認または再試行するまで、編集を停止しています。'
    : mapStateUnavailable
    ? mapStateConfirmed
      ? '手動進捗の保存状態を確認できません。画面には最後に確認した値を表示し、編集と保存を停止しています。'
      : '手動進捗の保存状態を確認できません。画面の初期値は現在の保存内容を示さず、編集と保存を停止しています。'
    : '手動完了とマップ配置はこのブラウザーに保存され、演習結果とは別に集計されます。バックアップに含まれます。'
  const manualCompletedCount = Object.values(manualProgress).filter((item) => item.status === 'completed').length
  const progress = useMemo(() => {
    if (!isReadableLearningState(mapStateRead) || !isReadablePracticeResults(practiceResultsRead)) return null
    return deriveCourseProgress(mapStateRead.state, practiceResultsRead.results, lessonRegistry)
  }, [mapStateRead, practiceResultsRead])
  const publishRouteView = (next: RouteView) => {
    viewRef.current = next
    setView(next)
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
    patch: Partial<Pick<RouteHistoryState, 'scrollY'>>,
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
    let nextState: RouteHistoryState | null
    try {
      nextState = navigateRouteHistory(currentState, route, hash, intent)
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
    if (!['normal', 'review', 'section', 'return'].includes(intent)) return
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

  const requestLessonDomainDownload = useCallback((json: string) =>
    requestDownload(json, 'sfqc-lesson-domain-draft.json'), [])

  const handleExport = () => {
    if (busyRef.current) return
    if (pendingLearningWriteRef.current) {
      setDataMessage('手動進捗・マップ配置の保存状態を確認してから、バックアップを書き出してください。')
      return
    }
    busyRef.current = true
    setBusy(true)
    setDataMessage('')
    try {
      const json = exportLearningBackup()
      if (!requestDownload(json, 'sfqc-learning-backup.json')) {
        throw new Error('JSONファイルを書き出せませんでした。')
      }
      setDataMessage('学習進捗と保存済み演習結果の書き出しを開始しました。'
        + (pendingJudgementsRef.current.length ? ' このバックアップには未保存の判定' + pendingJudgementsRef.current.length + '件が含まれません。' : ''))
    } catch (error) {
      setDataMessage(error instanceof Error ? error.message : '書き出しに失敗しました。')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const applyLearningBackupResult = (result: LearningBackupImportResult) => {
    if (result.status === 'imported') {
      publishMapStateRead(result.latest.learningState)
      publishPracticeResultsRead(result.latest.practiceResults)
      if (keepJudgementsAfterRestoreRef.current) {
        publishPendingJudgements(pendingJudgementsRef.current.map((item) => ({
          ...item, status: 'not-written', pendingResult: undefined,
        })))
      } else {
        publishPendingJudgements([])
      }
      setPendingBackupImport(null)
      setDataMessage('学習進捗と保存済み演習結果を復元しました。'
        + (keepJudgementsAfterRestoreRef.current && pendingJudgementsRef.current.length
          ? ' 未保存の判定は候補として保持しました。必要に応じて再保存してください。' : ''))
      return
    }
    if (isReadableLearningState(result.latest.learningState)) publishMapStateRead(result.latest.learningState)
    if (isReadablePracticeResults(result.latest.practiceResults)) publishPracticeResultsRead(result.latest.practiceResults)
    if (result.pending) {
      setPendingBackupImport(result)
      setDataMessage(result.status === 'recovery-required'
        ? '復元結果を確定できません。保存状態を再確認し、必要なら救出rawを保全してください。'
        : '復元の保存状態を確定できません。再確認が必要です。')
      return
    }
    setPendingBackupImport(null)
    setDataMessage(result.status === 'cancelled'
      ? '復元をキャンセルしました。保存データは変更されていません。'
      : result.error?.message ?? '復元は完了しませんでした（' + result.status + '）。')
  }

  const handleRecheckBackupImport = () => {
    if (!pendingBackupImport?.pending) return
    applyLearningBackupResult(recheckLearningBackupImport(pendingBackupImport.pending, lessonRegistry))
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    if (busyRef.current) {
      input.value = ''
      return
    }
    if (pendingLearningWriteRef.current) {
      setDataMessage('手動進捗・マップ配置の保存状態を確認してから、バックアップを復元してください。')
      input.value = ''
      return
    }
    if (pendingJudgementsRef.current.some((item) => item.status === 'unknown')) {
      setDataMessage('未保存判定の保存状態を再確認してから、バックアップを復元してください。')
      input.value = ''
      return
    }
    if (pendingBackupImport?.pending) {
      setDataMessage('前回のバックアップ復元の保存状態を再確認してから、新しい復元を開始してください。')
      input.value = ''
      return
    }

    let keepJudgements = true
    if (pendingJudgementsRef.current.length > 0) {
      const count = pendingJudgementsRef.current.length
      keepJudgements = window.confirm('未保存の判定' + count + '件があります。復元後も候補として保持しますか？ OKで保持、キャンセルで次の確認へ進みます。')
      if (!keepJudgements && !window.confirm('未保存の判定' + count + '件を破棄してバックアップを復元しますか？')) {
        input.value = ''
        setDataMessage('復元をキャンセルしました。未保存の判定は保持されています。')
        return
      }
    }

    busyRef.current = true
    setBusy(true)
    setDataMessage('')
    keepJudgementsAfterRestoreRef.current = keepJudgements
    try {
      const result = await importLearningBackup(file, (state) => window.confirm(
        '全データを新形式のバックアップで置き換えます。現在は手動完了'
        + state.existing.learningState.completedLessons + '単元・演習判定'
        + state.existing.practiceResults.records + '件、選択ファイルは手動完了'
        + state.imported.learningState.completedLessons + '単元・演習判定'
        + state.imported.practiceResults.records + '件です。復元しますか？',
      ), {
        requestRecoveryDownload: (json) => requestDownload(json, 'sfqc-recovery-raw.json'),
        confirmRecovery: () => window.confirm('元データの保全ファイルのダウンロード要求を出しました。ブラウザーは実際にファイルへ保存されたかを確認できません。保全ファイルを保存できたことを確認した場合だけ続行してください。'),
      })
      applyLearningBackupResult(result)
    } catch (error) {
      setDataMessage(error instanceof Error ? error.message : '復元に失敗しました。')
      refreshMapState()
      recheckPracticeStorage()
    } finally {
      input.value = ''
      busyRef.current = false
      setBusy(false)
    }
  }

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
    if (event.key !== 'Escape' || selectedLessonIdRef.current === null || mapAuthorMode) return
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
    {mapStateUnavailable && <p className="storage-alert" role="alert">
      {mapStateMessage || '手動進捗を確認できません。'} {mapStateConfirmed
        ? '画面には最後に確認した値を表示し、編集と保存を停止しています。'
        : '画面の初期値は現在の保存内容を示さず、編集と保存を停止しています。'}
    </p>}
    {!mapStateUnavailable && mapStateMessage && <p className="storage-alert" role="status" aria-live="polite">{mapStateMessage}</p>}
    {pendingLearningWrite && <section className="practice-recovery" role={pendingLearningWrite.status === 'unknown' ? 'alert' : 'status'} aria-live="polite">
      <p>{pendingLearningWrite.change.kind === 'layout' ? 'マップ配置' : '手動進捗'}の変更をメモリ上に保持しています。再読み込みすると失われます。保存状態が確認できるまで、他の手動進捗変更とバックアップ操作を停止しています。</p>
      <button type="button" onClick={pendingLearningWrite.status === 'unknown' ? recheckPendingLearningWrite : retryPendingLearningWrite}>
        {pendingLearningWrite.status === 'unknown' ? '手動進捗の保存状態を再確認' : '未保存の変更を再試行'}
      </button>
    </section>}
    {practiceResultsUnavailable && <p className="storage-alert" role="alert">{'error' in practiceResultsRead ? practiceResultsRead.error.message : '演習結果を読み取れません。'} <button type="button" onClick={recheckPracticeStorage}>保存状態を再確認</button></p>}
    {pendingJudgements.length > 0 && <section className="practice-recovery" role="status" aria-live="polite">
      <h2>未保存の判定</h2>
      <p>未保存の判定{pendingJudgements.length}件はこのページのメモリにあります。再読み込みすると失われます。</p>
      <ul>{pendingJudgements.map((candidate) => <li key={candidate.id}>
        {candidate.record.categoryId}：{candidate.record.isCorrect ? '正解' : '不正解'} · {candidate.status === 'unknown' ? '保存結果未確認' : candidate.status === 'conflict' ? '保存データに競合' : candidate.status === 'not-written' ? '未保存' : '保存待ち'}
        {' '}<button type="button" onClick={() => retryPendingJudgement(candidate)}>
          {candidate.status === 'unknown' ? '保存状態を再確認' : candidate.status === 'conflict' ? '確認して再保存' : '再保存'}
        </button>
      </li>)}</ul>
    </section>}
    {pendingBackupImport?.pending && <section className="practice-recovery" role="alert">
      <p>バックアップ復元の状態を確認できません。復元中の保存データを再確認してください。</p>
      <button type="button" onClick={handleRecheckBackupImport}>復元状態を再確認</button>
    </section>}
    {view.historyWarning && (
      <p className="storage-alert" role="status">
        このURLの復帰情報は利用できないため、URLから画面を再構築しました。読書位置や復習経路の一部は復元できないことがあります。
      </p>
    )}
  </>

  const renderLessonRoute = () => {
    if (view.route.kind !== 'lesson-id') return null
    if (view.resolved.status === 'unknown-id') {
      return <RouteProblem message={view.resolved.target === 'section'
        ? 'この単元に指定された節はありません。別の節を選ぶか、学習マップへ戻ってください。'
        : '指定された単元IDは教材レジストリにありません。学習マップから利用できる教材を選んでください。'} />
    }
    if (view.resolved.status === 'unavailable-lesson') {
      return <RouteProblem message="この教材はまだ収録されていません。学習マップから利用できる教材を選んでください。" />
    }
    if (view.resolved.status !== 'lesson') return null
    return <>
      <LessonRouteContent
        lesson={view.resolved.lesson}
        sectionId={view.route.sectionId}
        sectionHeadingRef={sectionHeadingRef}
      />
    </>
  }

  const renderCourseLessonRoute = () => {
    if (view.route.kind !== 'course-lesson') return null
    if (view.resolved.status === 'unknown-id') return <RouteProblem message="指定した節は教材レジストリにありません。目次から利用できる節を選んでください。" />
    if (view.resolved.status === 'unavailable-lesson') return <RouteProblem message="この教材はまだ収録されていません。" />
    if (view.resolved.status !== 'lesson') return null
    return <DescriptiveStatisticsCourse
      lesson={view.resolved.lesson}
      activeSectionId={view.route.sectionId}
      sectionHeadingRef={sectionHeadingRef}
    />
  }

  const renderCoursePracticeRoute = () => {
    if (view.route.kind !== 'course-practice') return null
    if (view.resolved.status === 'unknown-id') return <RouteProblem message="指定した単元は教材レジストリにありません。" />
    if (view.resolved.status === 'unavailable-lesson') return <RouteProblem message="この教材はまだ収録されていません。" />
    if (view.resolved.status !== 'course-practice') return null
    if (view.route.courseId !== 'descriptive-statistics') return <RouteProblem message="この単元の演習は準備中です。" />
    return <DescriptiveStatisticsExercisePreview
      currentLessonHref={routeToHash({ kind: 'course-lesson', courseId: view.route.courseId, sectionId: 'mean' })}
      onFirstGrade={handleFirstGrade}
    />
  }

  return (
    <div className={`app-shell${screen === 'map' ? ` map-app-shell${mapView === 'list' ? ' map-list-layout' : ''}${import.meta.env.DEV && mapView === 'graph' && mapAuthorMode ? ' map-author-mode' : ''}` : ''}`} data-theme={theme} onClick={handleInternalClick}>
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
        <div className="theme-control">
          <label htmlFor="theme-preference">表示テーマ</label>
          <select id="theme-preference" value={themePreference} onChange={handleThemePreferenceChange}>
            <option value="system">端末設定</option>
            <option value="light">ライト</option>
            <option value="dark">ダーク</option>
          </select>
        </div>
      </header>

      {screen === 'map' ? (
        <main className="map-workspace" onKeyDownCapture={handleMapKeyDownCapture}>
          <div className="map-route-messages" tabIndex={mapAuthorMode && (
            mapStateUnavailable || mapStateMessage || view.historyWarning || pendingLearningWrite
            || practiceResultsUnavailable || pendingJudgements.length > 0 || pendingBackupImport?.pending
          ) ? 0 : undefined}>{routeMessages}</div>
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
                theme={theme}
                viewport={mapViewportRef.current}
                selectedLessonId={selectedLessonIdRef.current}
                progress={progress}
                manualProgress={manualProgress}
                manualProgressDisabled={manualProgressDisabled}
                positions={mapStateRef.current.positions}
                positionSyncRevision={positionSyncRevision}
                onLayoutSave={onMapLayoutSave}
                onManualProgressAction={onManualProgressAction}
                onViewportChange={onMapMove}
                onSelectionChange={onMapSelectionChange}
                onAuthorModeChange={setMapAuthorMode}
                onAuthorExport={requestLessonDomainDownload}
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
              <p>保存済み演習判定：{isReadablePracticeResults(practiceResultsRead) ? practiceResultsRead.results.records.length + '件' : '読み込みエラー'}</p>
              <p>未保存の判定：{pendingJudgements.length}件（このページのメモリ上に保持）</p>
              <p>手動進捗・マップ配置：{mapStateStatusLabel}{!mapStateUnavailable ? `（手動完了 ${manualCompletedCount} / ${lessonRegistry.lessons.length}）` : ''}</p>
              <p>データはこのブラウザー内に保存され、サーバーへ送信されません。統合バックアップは手動進捗、マップ配置、保存済み演習判定を含みます。</p>
              {pendingJudgements.length > 0 && <p className="storage-alert" role="status">このバックアップには未保存の判定{pendingJudgements.length}件が含まれません。</p>}
              <div className="data-actions">
                <button type="button" onClick={handleExport} disabled={busy || !canExportCombined}>
                  全データを書き出し
                </button>
                <label htmlFor="backup-file">JSONを読み込む</label>
                <input
                  id="backup-file"
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImport}
                  disabled={busy || !!pendingBackupImport?.pending || !!pendingLearningWrite || pendingJudgements.some((item) => item.status === 'unknown')}
                />
              </div>
              {pendingLearningWrite && <p className="storage-alert" role="status">未確定の手動進捗・配置変更が1件あります。候補はこのページのメモリに保持しています。</p>}
              {mapStateUnavailable && !pendingLearningWrite && <button type="button" onClick={refreshMapState}>手動進捗の保存状態を再確認</button>}
              <p className="data-limit">手動進捗・マップ配置は64 KiB、演習判定は最大25件・8 KiBです。</p>
              <p className="data-message" role="status" aria-live="polite">{dataMessage}</p>
            </section>
          ) : screen === 'lesson' && view.route.kind === 'course-lesson' ? (
            renderCourseLessonRoute()
          ) : screen === 'lesson' && view.route.kind === 'lesson-id' ? (
            renderLessonRoute()
          ) : screen === 'lesson' ? (
            <section className="lesson-panel" aria-labelledby="lesson-selection-title">
              <h2 id="lesson-selection-title">単元を選んでください</h2>
              <p>学習マップから収録済みの単元または節を選ぶと、教材を表示できます。</p>
            </section>
          ) : screen === 'practice' && view.route.kind === 'course-practice' ? (
            renderCoursePracticeRoute()
          ) : screen === 'practice' ? (
            <RouteProblem message="演習は学習マップから単元を選んで開いてください。" />
          ) : screen === 'progress' ? (
            progress
              ? <CourseProgressView progress={progress} />
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
