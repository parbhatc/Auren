import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTheme } from '../../../hooks/useTheme'
import { ROUTES } from '../../../constants/routes'
import { authAPI } from '../../../api/auth.api'
import { backtesterAPI } from '../../../api/backtester.api'
import { getThemeColors } from '../../../constants/theme'
import Loading from '../../common/Loading'
import BacktesterChartView from './BacktesterChartView'
import { BacktestSession } from '../../../types/backtester'
import { UserData } from '../../../types/user'

/**
 * Backtester Chart View wrapper component
 * Handles chart view page at /backtester/chart
 */
const BacktesterChartViewWrapper = () => {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const colors = getThemeColors(isDark)
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<BacktestSession | null>(null)
  const [sessions, setSessions] = useState<BacktestSession[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          navigate(ROUTES.LOGIN)
          return
        }

        const userResponse = await authAPI.validateToken(token)
        setUser(userResponse.user)

        // Get session ID from URL params
        const sessionId = searchParams.get('sessionId')
        if (sessionId) {
          // Load session from database
          const sessionsResponse = await backtesterAPI.getSessions()
          if (sessionsResponse.success) {
            setSessions(sessionsResponse.sessions)
            if (sessionId) {
              const foundSession = sessionsResponse.sessions.find((s) => s.id === sessionId)
              if (foundSession) {
                setSession(foundSession)
              }
            }
          }
        }
      } catch (err: any) {
        if (err?.response?.status === 401) {
          localStorage.removeItem('token')
          navigate(ROUTES.LOGIN)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [navigate, searchParams])

  const handleRunBacktest = async (_sessionId: string) => {
    if (!session) return
    
    const updatedSession: BacktestSession = { ...session }
    await backtesterAPI.updateSession(updatedSession)
    setSession(updatedSession)

    // Simulate backtest running
    setTimeout(async () => {
      const completed: BacktestSession = {
        ...updatedSession,
        results: {
          totalTrades: Math.floor(Math.random() * 100) + 10,
          winRate: Math.random() * 30 + 50,
          profit: (Math.random() - 0.3) * 10000,
          maxDrawdown: Math.random() * 20 + 5,
        },
      }
      await backtesterAPI.updateSession(completed)
      setSession(completed)
    }, 3000)
  }

  const handleStopBacktest = async (_sessionId: string) => {
    if (!session) return
    
    const updatedSession: BacktestSession = { ...session }
    await backtesterAPI.updateSession(updatedSession)
    setSession(updatedSession)
  }

  if (loading || !user) {
    return <Loading isDark={isDark} />
  }

  const handleSessionUpdate = (updatedSession: BacktestSession) => {
    setSession(updatedSession)
  }

  return (
    <BacktesterChartView
      isDark={isDark}
      toggleTheme={toggleTheme}
      navigate={navigate}
      colors={colors}
      session={session}
      sessions={sessions}
      onRunBacktest={handleRunBacktest}
      onStopBacktest={handleStopBacktest}
      onSessionUpdate={handleSessionUpdate}
    />
  )
}

export default BacktesterChartViewWrapper

