import { lazy, Suspense, useState, useEffect } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
  useLocation,
} from 'react-router-dom'
import NotFound from './components/common/NotFound'
import ProtectedRoute from './components/common/ProtectedRoute'
import GuestRoute from './components/common/GuestRoute'
import RoleError from './components/common/RoleError'
import ServerError from './components/common/ServerError'
import Loading from './components/common/Loading'
import { authAPI } from './api/auth.api'
import { t } from './utils/translator'
import { ROUTES } from './constants/routes'
import { getTradeTradeseaAccount, saveTradeTradeseaAccount } from './constants/trade'
import { useTheme } from './hooks/useTheme'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './App.css'
import { RouteScrollRestore } from './components/common/RouteScrollRestore'
import { syncLiveTradeSession } from './services/trading/liveTradeSession'
import LiveTradeViewRetention from './components/trading/Live/LiveTradeViewRetention'
import { getAuthToken } from './api/api'
import { traceStartup } from './services/debug/startupTrace'
import { prefetchRoute, routeModules } from './navigation/routeModules'
import LegacyReplayStatsRedirect from './components/backtester/LegacyReplayStatsRedirect'

const Login = lazy(routeModules.login)
const Register = lazy(routeModules.register)
const VerifyEmail = lazy(routeModules.verifyEmail)
const ForgotPassword = lazy(routeModules.forgotPassword)
const ResetPassword = lazy(routeModules.resetPassword)
const Settings = lazy(routeModules.settings)
const PropsSettings = lazy(routeModules.propsSettings)
const UtilsSettings = lazy(routeModules.utilsSettings)
const KeyboardShortcutsSettings = lazy(routeModules.keyboardSettings)
const AdminWorkspacePage = lazy(routeModules.admin)
const PracticeTradePadPage = lazy(routeModules.practicePad)
const PracticeStatsPage = lazy(routeModules.practiceStats)
const PracticeNewsPage = lazy(routeModules.practiceNews)
const SettingsWorkspacePage = lazy(routeModules.settingsWorkspace)
const PracticeTerminalPage = lazy(routeModules.practice)
const PracticeWorkspacePage = lazy(routeModules.practiceAccounts)
const DashboardPage = lazy(routeModules.dashboard)
const AnalyticsPage = lazy(routeModules.analytics)
const NewsWorkspacePage = lazy(routeModules.news)
const PracticeTradePage = lazy(routeModules.practiceTrade)
const LiveTradePage = lazy(routeModules.liveTrade)
const BacktesterChartView = lazy(routeModules.replayChart)
const BacktesterSessionsList = lazy(routeModules.replay)
const BacktesterDataManagement = lazy(routeModules.replayData)
const JournalPage = lazy(routeModules.journal)
const JournalReviewsPage = lazy(routeModules.journalReviews)
const JournalTradeDetailPage = lazy(routeModules.journalDetail)
const LegacyRedirect = () => <Navigate to={ROUTES.DASHBOARD} replace />

function RouteSessionSync() {
  const location = useLocation()
  // Logout and account/mode changes can happen outside the terminal. Retained
  // sockets must follow the current session even while Live is unmounted.
  useEffect(() => { syncLiveTradeSession() }, [location.key])
  useEffect(() => {
    const syncRetainedSelection = () => {
      // Live's own selector writes storage before replacing its streams. Its
      // provider owns that transition; an idle retained session can end now.
      if (window.location.pathname !== ROUTES.TRADE) syncLiveTradeSession()
    }
    window.addEventListener('storage', syncLiveTradeSession)
    window.addEventListener('tradeTradeseaAccountChanged', syncRetainedSelection)
    window.addEventListener('liveTradePropFirmChanged', syncRetainedSelection)
    return () => {
      window.removeEventListener('storage', syncLiveTradeSession)
      window.removeEventListener('tradeTradeseaAccountChanged', syncRetainedSelection)
      window.removeEventListener('liveTradePropFirmChanged', syncRetainedSelection)
    }
  }, [])
  return null
}

/** /practice/:id/... → /practice/trade/:id/... (legacy short URLs) */
const LegacyPracticeRedirect = ({ from }: { from: '/practice' | '/trade' }) => {
  const { practiceAccountId } = useParams<{ practiceAccountId: string }>()
  const location = useLocation()
  const prefix = `${from}/${practiceAccountId ?? ''}`
  const tail = location.pathname.startsWith(prefix) ? location.pathname.slice(prefix.length) : ''
  return (
    <Navigate
      to={`${ROUTES.PRACTICE_TRADE}/${practiceAccountId ?? ''}${tail}${location.search}`}
      replace
    />
  )
}

/** /live/trade/:accountId → /trade (legacy live URLs) */
const LegacyLiveTradeRedirect = () => {
  const { accountId } = useParams<{ accountId: string }>()
  const id = String(accountId || '').trim()
  if (id) {
    const existing = getTradeTradeseaAccount()
    saveTradeTradeseaAccount(id, existing.accountLabel || id)
  }
  return <Navigate to={ROUTES.TRADE} replace />
}

function App() {
  const { isDark, toggleTheme } = useTheme()
  const [hasRoles, setHasRoles] = useState<boolean | null>(null)
  const [serverError, setServerError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void prefetchRoute(window.location.pathname)
    // Public code can load alongside auth checks. Account data and trading
    // services still wait for ProtectedRoute and server authorization.
    if (window.location.pathname === ROUTES.TRADE && getAuthToken()) {
      void routeModules.liveTrade().catch(() => undefined)
      void import('./services/chart/loadAurenChartBoot')
        .then(({ loadAurenChartBoot }) => loadAurenChartBoot())
        .catch(() => undefined)
    }
    const checkRoles = async () => {
      traceStartup('roles-start')
      try {
        const response = await authAPI.getRolesStatus()
        setHasRoles(response.hasRoles)
        setServerError(false)
      } catch (error: any) {
        console.error('Error checking roles:', error)

        const status = error?.response?.status as number | undefined
        const isServerUnreachable =
          error?.code === 'ERR_NETWORK' ||
          error?.code === 'ECONNREFUSED' ||
          error?.message?.includes('ERR_CONNECTION_REFUSED') ||
          error?.message?.includes('Network Error') ||
          error?.message?.includes('Failed to fetch') ||
          (error?.response === undefined && error?.request !== undefined) ||
          (typeof status === 'number' && status >= 500)

        if (isServerUnreachable) {
          setServerError(true)
          setHasRoles(null)
        } else if (error?.response) {
          const responseData = error.response?.data
          if (responseData?.hasRoles === false || responseData?.error?.includes('role')) {
            setHasRoles(false)
            setServerError(false)
          } else {
            setHasRoles(null)
            setServerError(false)
          }
        } else {
          setServerError(true)
          setHasRoles(null)
        }
      } finally {
        traceStartup('roles-ready')
        setLoading(false)
      }
    }

    checkRoles()
  }, [])

  if (loading) {
    return <Loading message={t('common.loading')} isDark={isDark} />
  }

  if (serverError) {
    return <ServerError isDark={isDark} onToggleTheme={toggleTheme} />
  }

  if (hasRoles === false) {
    return <RoleError isDark={isDark} />
  }

  return (
    <Router>
      <RouteSessionSync />
      <RouteScrollRestore />
      <Suspense fallback={<Loading fullScreen isDark={isDark} />}>
        <LiveTradeViewRetention>
          <ProtectedRoute>
            <Suspense fallback={<Loading fullScreen isDark={isDark} />}>
              <LiveTradePage />
            </Suspense>
          </ProtectedRoute>
        </LiveTradeViewRetention>
      </Suspense>
      <Suspense fallback={<Loading fullScreen isDark={isDark} />}>
        <Routes>
          <Route
            path={ROUTES.DASHBOARD}
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.ANALYTICS}
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.JOURNAL}
            element={
              <ProtectedRoute>
                <JournalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={`${ROUTES.JOURNAL}/reviews`}
            element={<ProtectedRoute><JournalReviewsPage /></ProtectedRoute>}
          />
          <Route
            path={`${ROUTES.JOURNAL}/:tradeId`}
            element={
              <ProtectedRoute>
                <JournalTradeDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.NEWS}
            element={
              <ProtectedRoute>
                <NewsWorkspacePage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.HOME}
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.PRACTICE}
            element={
              <ProtectedRoute>
                <PracticeTerminalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.PRACTICE_ACCOUNTS}
            element={
              <ProtectedRoute>
                <PracticeWorkspacePage />
              </ProtectedRoute>
            }
          />
          <Route path="/trade/:firmId/:accountId/*" element={<LegacyRedirect />} />
          <Route path="/backtest/*" element={<Navigate to={ROUTES.BACKTESTER} replace />} />
          <Route
            path={ROUTES.TRADE}
            element={null}
          />
          <Route
            path="/trade/:practiceAccountId/*"
            element={<LegacyPracticeRedirect from="/trade" />}
          />
          <Route
            path={`${ROUTES.PRACTICE_TRADE}/:practiceAccountId/stats`}
            element={
              <ProtectedRoute>
                <PracticeStatsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={`${ROUTES.PRACTICE_TRADE}/:practiceAccountId/news`}
            element={
              <ProtectedRoute>
                <PracticeNewsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={`${ROUTES.PRACTICE_TRADE}/:practiceAccountId/pad`}
            element={
              <ProtectedRoute>
                <PracticeTradePadPage />
              </ProtectedRoute>
            }
          />
          <Route path={`${ROUTES.LIVE_TRADE}/:accountId`} element={<LegacyLiveTradeRedirect />} />
          <Route
            path={`${ROUTES.PRACTICE_TRADE}/:practiceAccountId`}
            element={
              <ProtectedRoute>
                <PracticeTradePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/practice/:practiceAccountId/*"
            element={<LegacyPracticeRedirect from="/practice" />}
          />

          <Route
            path={ROUTES.SETTINGS}
            element={
              <ProtectedRoute>
                <SettingsWorkspacePage />
              </ProtectedRoute>
            }
          >
            <Route index element={<Settings embedded />} />
            <Route path="props" element={<PropsSettings embedded />} />
            <Route path="utils" element={<UtilsSettings embedded />} />
            <Route path="keyboard-shortcuts" element={<KeyboardShortcutsSettings embedded />} />
            <Route path="practice" element={<Navigate to={ROUTES.PRACTICE_ACCOUNTS} replace />} />
          </Route>

          <Route
            path={ROUTES.ADMIN_SETTINGS}
            element={
              <ProtectedRoute adminOnly>
                <AdminWorkspacePage section="settings" />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.PERMISSION_MANAGER}
            element={
              <ProtectedRoute adminOnly>
                <AdminWorkspacePage section="roles" />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.USER_MANAGER}
            element={
              <ProtectedRoute adminOnly>
                <AdminWorkspacePage section="users" />
              </ProtectedRoute>
            }
          />

          <Route
            path={ROUTES.BACKTESTER}
            element={
              <ProtectedRoute>
                <BacktesterSessionsList />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.BACKTESTER_CHART}
            element={
              <ProtectedRoute>
                <BacktesterChartView />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.BACKTESTER_STATS}
            element={
              <ProtectedRoute>
                <LegacyReplayStatsRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/backtester/testing-strategies"
            element={<Navigate to={ROUTES.BACKTESTER} replace />}
          />
          <Route
            path={ROUTES.BACKTESTER_DATA_MANAGEMENT}
            element={
              <ProtectedRoute adminOnly>
                <BacktesterDataManagement />
              </ProtectedRoute>
            }
          />

          {/* Legacy NexusSyncPro paths → home */}
          <Route path="/journal/*" element={<Navigate to={ROUTES.JOURNAL} replace />} />
          <Route path="/economic-news" element={<Navigate to={ROUTES.NEWS} replace />} />

          <Route
            path={ROUTES.LOGIN}
            element={
              <GuestRoute>
                <Login />
              </GuestRoute>
            }
          />
          <Route
            path={ROUTES.REGISTER}
            element={
              <GuestRoute>
                <Register />
              </GuestRoute>
            }
          />
          <Route
            path={ROUTES.FORGOT_PASSWORD}
            element={
              <GuestRoute>
                <ForgotPassword />
              </GuestRoute>
            }
          />
          <Route
            path={ROUTES.RESET_PASSWORD}
            element={
              <GuestRoute>
                <ResetPassword />
              </GuestRoute>
            }
          />
          <Route
            path={ROUTES.VERIFY_EMAIL}
            element={
              <GuestRoute>
                <VerifyEmail />
              </GuestRoute>
            }
          />

          <Route path="*" element={<NotFound isDark={isDark} />} />
        </Routes>
      </Suspense>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar
        newestOnTop
        limit={2}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={isDark ? 'dark' : 'light'}
      />
    </Router>
  )
}

export default App
