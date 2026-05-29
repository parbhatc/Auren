import { useState, useEffect } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useSearchParams,
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
import PracticeHubPage from './pages/trading/practice/HubPage'
import PracticeTradePage from './pages/trading/practice/TradePage'
import PracticeTradePadPage from './pages/trading/practice/PadPage'
import PracticeStatsPage from './pages/trading/practice/StatsPage'
import PracticeNewsPage from './pages/trading/practice/NewsPage'
import NotFound from './components/common/NotFound'
import ProtectedRoute from './components/common/ProtectedRoute'
import GuestRoute from './components/common/GuestRoute'
import RoleError from './components/common/RoleError'
import ServerError from './components/common/ServerError'
import Loading from './components/common/Loading'
import { authAPI } from './api/auth.api'
import { t } from './utils/translator'
import { ROUTES } from './constants/routes'
import { useTheme } from './hooks/useTheme'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './App.css'

const LegacyRedirect = () => <Navigate to={ROUTES.HOME} replace />

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

function App() {
  const { isDark } = useTheme()
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

        const isConnectionError =
          error?.code === 'ERR_NETWORK' ||
          error?.code === 'ECONNREFUSED' ||
          error?.message?.includes('ERR_CONNECTION_REFUSED') ||
          error?.message?.includes('Network Error') ||
          error?.message?.includes('Failed to fetch') ||
          (error?.response === undefined && error?.request !== undefined)

        if (isConnectionError) {
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
    return <ServerError isDark={isDark} />
  }

  if (hasRoles === false) {
    return <RoleError isDark={isDark} />
  }

  return (
    <Router>
      <Routes>
        <Route
          path={ROUTES.HOME}
          element={
            <ProtectedRoute>
              <PracticeHubPage />
            </ProtectedRoute>
          }
        />
        <Route path="/practice" element={<Navigate to={ROUTES.HOME} replace />} />
        <Route path="/trade/:firmId/:accountId/*" element={<LegacyRedirect />} />
        <Route path="/backtest/*" element={<LegacyRedirect />} />
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
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PROPS_SETTINGS}
          element={
            <ProtectedRoute>
              <PropsSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.UTILS_SETTINGS}
          element={
            <ProtectedRoute>
              <UtilsSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.KEYBOARD_SHORTCUTS_SETTINGS}
          element={
            <ProtectedRoute>
              <KeyboardShortcutsSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PRACTICE_SETTINGS}
          element={
            <ProtectedRoute>
              <Navigate to={ROUTES.HOME} replace />
            </ProtectedRoute>
          }
        />

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

        {/* Legacy NexusSyncPro paths → home */}
        <Route path="/backtester/*" element={<LegacyRedirect />} />
        <Route path="/journal/*" element={<LegacyRedirect />} />
        <Route path="/economic-news" element={<LegacyRedirect />} />
        <Route path="/dashboard" element={<LegacyRedirect />} />

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
        newestOnTop={false}
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
