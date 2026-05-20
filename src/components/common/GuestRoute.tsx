import { Navigate } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import { authAPI } from '../../api/auth.api'
import { useState, useEffect } from 'react'
import Loading from './Loading'
import { useTheme } from '../../hooks/useTheme'

/**
 * Guest Route Component
 * Redirects authenticated users away from auth pages (login, register, forgot password, etc.)
 */
const GuestRoute = ({ children }: { children: React.ReactElement }) => {
  const { isDark } = useTheme()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          setIsAuthenticated(false)
          setLoading(false)
          return
        }

        const response = await authAPI.validateToken(token)
        setIsAuthenticated(response.success && !!response.user)
      } catch (error) {
        setIsAuthenticated(false)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  if (loading) {
    return <Loading message="Checking authentication..." isDark={isDark} />
  }

  // If authenticated, redirect to home
  if (isAuthenticated) {
    return <Navigate to={ROUTES.HOME} replace />
  }

  // If not authenticated, allow access to auth pages
  return children
}

export default GuestRoute
