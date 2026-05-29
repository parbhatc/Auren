import axios from 'axios'
import { Component } from 'react'
import { Navigate } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import { authAPI } from '../../api/auth.api'
import Loading from './Loading'
import { ProtectedRouteProps, ProtectedRouteState } from '../../types/common'

function isAuthFailure(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  const status = error.response?.status
  return status === 401 || status === 403
}

/**
 * Protected Route component
 * Validates token with server and redirects to login if user is not authenticated
 */
class ProtectedRoute extends Component<ProtectedRouteProps, ProtectedRouteState> {
  state: ProtectedRouteState = {
    isAuthenticated: null,
  }

  componentDidMount() {
    this.validateToken()
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

  validateToken = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        this.setState({ isAuthenticated: false })
        return
      }

      // Validate token with server
      await authAPI.validateToken(token)
      this.setState({ isAuthenticated: true })
    } catch (error) {
      if (isAuthFailure(error)) {
        localStorage.removeItem('token')
        this.setState({ isAuthenticated: false })
        return
      }
      // Server down / 5xx — keep session; don't treat as logged out
      this.setState({ isAuthenticated: true })
    }
  }

  render() {
    const { children } = this.props
    const { isAuthenticated } = this.state
    const isDark = this.getIsDark()

    // Show loading while checking authentication
    if (isAuthenticated === null) {
      return <Loading fullScreen={true} isDark={isDark} />
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      return <Navigate to={ROUTES.LOGIN} replace />
    }

    // Render protected content
    return <>{children}</>
  }
}

export default ProtectedRoute
