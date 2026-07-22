import { useState, useEffect } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
  useLocation,
} from 'react-router-dom'
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import VerifyEmail from './components/auth/verify_email'
import ForgotPassword from './components/auth/forgot_password'
import ResetPassword from './components/auth/reset_password'
import Settings from './components/settings/account'
import PropsSettings from './components/settings/prop_firms'
import UtilsSettings from './components/settings/utils'
import KeyboardShortcutsSettings from './components/settings/keyboard_shortcuts'
import AdminSettings from './components/admin/site_settings'
import RolesManager from './components/admin/roles'
import UserManager from './components/admin/users'
import PracticeTradePage from './pages/trading/practice/TradePage'
import PracticeTradePadPage from './pages/trading/practice/PadPage'
import PracticeStatsPage from './pages/trading/practice/StatsPage'
import PracticeNewsPage from './pages/trading/practice/NewsPage'
import LiveTradePage from './pages/trading/live/TradePage'
import BacktesterChartView from './components/backtester/BacktesterChartView'
import BacktesterSessionsList from './components/backtester/BacktesterSessionsList'
import BacktesterStats from './components/backtester/Stats'
import BacktesterDataManagement from './components/backtester/DataManagement'
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
import {
  AnalyticsPage,
  DashboardPage,
  JournalPage,
  JournalTradeDetailPage,
  NewsWorkspacePage,
} from './pages/workspace/WorkspacePages'
import SettingsWorkspacePage from './pages/settings/SettingsWorkspacePage'
import PracticeWorkspacePage from './pages/practice/PracticeWorkspacePage'

const LegacyRedirect = () => <Navigate to={ROUTES.DASHBOARD} replace />

/** /practice/:id/... → /practice/trade/:id/... (legacy short URLs) */
const LegacyShortPracticeRedirect = () => {
  const { practiceAccountId } = useParams<{ practiceAccountId: string }>()
  const location = useLocation()
  const prefix = `/practice/${practiceAccountId ?? ''}`
  const tail = location.pathname.startsWith(prefix) ? location.pathname.slice(prefix.length) : ''
  return <Navigate to={`${ROUTES.PRACTICE_TRADE}/${practiceAccountId ?? ''}${tail}${location.search}`} replace />
}

/** /trade/:id/... → /practice/trade/:id/... (legacy practice URLs) */
const LegacyTradeToPracticeRedirect = () => {
  const { practiceAccountId } = useParams<{ practiceAccountId: string }>()
  const location = useLocation()
  const prefix = `/trade/${practiceAccountId ?? ''}`
  const tail = location.pathname.startsWith(prefix) ? location.pathname.slice(prefix.length) : ''
  return <Navigate to={`${ROUTES.PRACTICE_TRADE}/${practiceAccountId ?? ''}${tail}${location.search}`} replace />
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
    const checkRoles = async () => {
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
      <RouteScrollRestore />
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
              <PracticeWorkspacePage />
            </ProtectedRoute>
          }
        />
        <Route path="/trade/:firmId/:accountId/*" element={<LegacyRedirect />} />
        <Route path="/backtest/*" element={<Navigate to={ROUTES.BACKTESTER} replace />} />
        <Route
          path={ROUTES.TRADE}
          element={
            <ProtectedRoute>
              <LiveTradePage />
            </ProtectedRoute>
          }
        />
        <Route path="/trade/:practiceAccountId/*" element={<LegacyTradeToPracticeRedirect />} />
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
        <Route
          path={`${ROUTES.LIVE_TRADE}/:accountId`}
          element={<LegacyLiveTradeRedirect />}
        />
        <Route
          path={`${ROUTES.PRACTICE_TRADE}/:practiceAccountId`}
          element={
            <ProtectedRoute>
              <PracticeTradePage />
            </ProtectedRoute>
          }
        />

        <Route path="/practice/:practiceAccountId/*" element={<LegacyShortPracticeRedirect />} />

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
          <Route path="practice" element={<Navigate to={ROUTES.PRACTICE} replace />} />
        </Route>

        <Route
          path={ROUTES.ADMIN_SETTINGS}
          element={
            <ProtectedRoute>
              <AdminSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PERMISSION_MANAGER}
          element={
            <ProtectedRoute>
              <RolesManager />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.USER_MANAGER}
          element={
            <ProtectedRoute>
              <UserManager />
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
          path={`${ROUTES.BACKTESTER_STATS}`}
          element={
            <ProtectedRoute>
              <BacktesterStats />
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
            <ProtectedRoute>
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
