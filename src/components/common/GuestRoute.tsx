import { Navigate } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import { authAPI, authSession } from '../../api/auth.api'
import { Suspense, useEffect, useSyncExternalStore } from 'react'
import Loading from './Loading'
import { useTheme } from '../../hooks/useTheme'

/**
 * Guest Route Component
 * Redirects authenticated users away from auth pages (login, register, forgot password, etc.)
 */
const GuestRoute = ({ children }: { children: React.ReactElement }) => {
  const { isDark } = useTheme()
  const snapshot = useSyncExternalStore(authSession.subscribe, authSession.getSnapshot, authSession.getSnapshot)

  useEffect(() => {
    const current = authSession.sync()
    if (current.token) void authAPI.validateToken(current.token).catch(() => undefined)
  }, [snapshot.token])

  if (snapshot.phase === 'checking' && !snapshot.value) {
    return <Loading message="Checking authentication..." isDark={isDark} />
  }

  // If authenticated, redirect to home
  if (snapshot.value) {
    return <Navigate to={ROUTES.HOME} replace />
  }

  // If not authenticated, allow access to auth pages
  return <Suspense fallback={<Loading message="Loading..." isDark={isDark} />}>{children}</Suspense>
}

export default GuestRoute
