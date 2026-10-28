import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import { saveDashboardAccountSelection } from '../../services/dashboard/dashboardAccountSelection'

/** Kept inside ProtectedRoute: select before Overview mounts or starts its reads. */
export default function LegacyReplayStatsRedirect() {
  const { search } = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const sessionId = new URLSearchParams(search).get('sessionId')?.trim()
    if (sessionId)
      saveDashboardAccountSelection({ source: 'replay', accountId: sessionId })
    navigate(ROUTES.DASHBOARD, { replace: true })
  }, [search, navigate])
  return null
}
