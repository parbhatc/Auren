import { Navigate, useParams } from 'react-router-dom'
import { practiceTradePath, ROUTES } from '../../../constants/routes'

/** Legacy popout pad URL — order pad detach is in-page on the trade screen. */
export default function PracticeTradePadPage() {
  const { practiceAccountId } = useParams<{ practiceAccountId: string }>()
  if (!practiceAccountId) {
    return <Navigate to={ROUTES.HOME} replace />
  }
  return <Navigate to={practiceTradePath(practiceAccountId)} replace />
}
