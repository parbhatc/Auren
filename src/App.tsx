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
import ForgotPassword from './components/auth/ForgotPassword'
import ResetPassword from './components/auth/ResetPassword'
import Settings from './components/settings/Settings'
import PropsSettings from './components/settings/PropsSettings'
import UtilsSettings from './components/settings/UtilsSettings'
import KeyboardShortcutsSettings from './components/settings/KeyboardShortcutsSettings'
import AdminSettings from './components/admin/AdminSettings'
import RolesManager from './components/admin/RolesManager'
import UserManager from './components/admin/UserManager'
import PracticeHub from './components/trading/Practice/PracticeHub'
import PracticeTrade from './components/trading/Practice/PracticeTradeWrapper'
import PracticeTradePadPage from './components/trading/Practice/PracticeTradePadPage'
import PracticeStatsWrapper from './components/trading/Practice/PracticeStatsWrapper'
import PracticeNewsWrapper from './components/trading/Practice/PracticeNewsWrapper'
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

const VerifyEmailRedirect = () => {
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code')
  const email = searchParams.get('email')

  const params = new URLSearchParams()
  if (code) params.set('code', code)
  if (email) params.set('email', email)

  return <Navigate to={`${ROUTES.REGISTER}?${params.toString()}`} replace />
}

/** Redirect removed NexusSyncPro routes to practice hub */
const LegacyRedirect = () => <Navigate to={ROUTES.HOME} replace />

/** /practice/trade/:id/... → /trade/:id/... */
const LegacyPracticeTradeRedirect = () => {
  const { practiceAccountId } = useParams<{ practiceAccountId: string }>()
  const location = useLocation()
  const prefix = `/practice/trade/${practiceAccountId ?? ''}`
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
              <PracticeHub />
            </ProtectedRoute>
          }
        />
        <Route path="/practice" element={<Navigate to={ROUTES.HOME} replace />} />
        <Route path="/practice/trade/:practiceAccountId/*" element={<LegacyPracticeTradeRedirect />} />
        <Route
          path={`${ROUTES.PRACTICE_TRADE}/:practiceAccountId/stats`}
          element={
            <ProtectedRoute>
              <PracticeStatsWrapper />
            </ProtectedRoute>
          }
        />
        <Route
          path={`${ROUTES.PRACTICE_TRADE}/:practiceAccountId/news`}
          element={
            <ProtectedRoute>
              <PracticeNewsWrapper />
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
              <PracticeTrade />
            </ProtectedRoute>
          }
        />

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
          path="/verify-email"
          element={
            <GuestRoute>
              <VerifyEmailRedirect />
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
