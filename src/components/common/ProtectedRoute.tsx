import { Component, Suspense } from 'react'
import { Navigate } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import { authAPI, authSession } from '../../api/auth.api'
import Loading from './Loading'
import { ProtectedRouteProps, ProtectedRouteState } from '../../types/common'
import { ValidatedAuthContext, type ValidatedAuth } from '../../contexts/ValidatedAuthContext'
type SessionSnapshot = ReturnType<typeof authSession.getSnapshot>

function routeState(snapshot: SessionSnapshot): ProtectedRouteState {
  return {
    isAuthenticated: snapshot.phase === 'anonymous' ? false
      : snapshot.value || snapshot.phase === 'unavailable' ? true : null,
    isAdmin: Boolean(snapshot.value?.user.isAdmin),
  }
}

function routeContext(snapshot: SessionSnapshot): ValidatedAuth | null {
  return snapshot.token && snapshot.value
    ? { token: snapshot.token, isAdmin: Boolean(snapshot.value.user.isAdmin) } : null
}

/**
 * Protected Route component
 * Validates token with server and redirects to login if user is not authenticated
 */
class ProtectedRoute extends Component<ProtectedRouteProps, ProtectedRouteState> {
  private validatedAuth: ValidatedAuth | null = routeContext(authSession.getSnapshot())
  private validationGeneration = 0
  private unmounted = false
  private unsubscribeAuth: (() => void) | null = null

  state: ProtectedRouteState = routeState(authSession.getSnapshot())

  componentDidMount() {
    // React's development mount replay reuses the instance after cleanup.
    this.unmounted = false
    this.unsubscribeAuth = authSession.subscribe(this.syncAuthState)
    authSession.sync()
    this.syncAuthState()
    void this.validateToken()
  }

  componentWillUnmount() {
    this.unmounted = true
    this.validationGeneration += 1
    this.unsubscribeAuth?.()
    this.unsubscribeAuth = null
    this.validatedAuth = null
  }

  /**
   * Get theme from localStorage or default to dark
   */
  getIsDark = (): boolean => {
    try {
      const savedTheme = localStorage.getItem('auren-theme')
      if (savedTheme !== null) {
        return savedTheme === 'dark'
      }
      return true // Default to dark mode
    } catch (error) {
      return true // Default to dark mode on error
    }
  }

  private syncAuthState = () => {
    if (this.unmounted) return
    const snapshot = authSession.getSnapshot()
    this.validatedAuth = routeContext(snapshot)
    this.setState(routeState(snapshot))
  }

  validateToken = async (): Promise<void> => {
    if (this.unmounted) return
    const generation = ++this.validationGeneration
    const isCurrent = () => !this.unmounted && this.validationGeneration === generation
    const snapshot = authSession.sync()
    const token = snapshot.token
    this.syncAuthState()
    if (!token) return
    try {
      await authAPI.validateToken(token)
      if (!isCurrent()) return
      // A login/logout in another surface may replace storage mid-request.
      // Validate that current identity instead of publishing the old result.
      if (localStorage.getItem('token') !== token) return this.validateToken()
      this.syncAuthState()
    } catch (error) {
      if (!isCurrent()) return
      if (localStorage.getItem('token') !== token) return this.validateToken()
      // The shared controller keeps a current-token transient failure separate
      // from verified permissions, preserving the existing non-admin fallback.
      this.syncAuthState()
    }
  }

  render() {
    const { children, adminOnly = false } = this.props
    const { isAuthenticated, isAdmin } = this.state
    const isDark = this.getIsDark()

    // Show loading while checking authentication
    if (isAuthenticated === null) {
      return <Loading fullScreen={true} isDark={isDark} />
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      return <Navigate to={ROUTES.LOGIN} replace />
    }

    if (adminOnly && !isAdmin) {
      return <Navigate to={ROUTES.DASHBOARD} replace />
    }

    // Render protected content
    return <ValidatedAuthContext.Provider value={this.validatedAuth}>
      <Suspense fallback={<Loading fullScreen={true} isDark={isDark} />}>{children}</Suspense>
    </ValidatedAuthContext.Provider>
  }
}

export default ProtectedRoute
