import { Navigate, useParams } from 'react-router-dom'
import { practiceSessionPath, ROUTES } from '../../../../constants/routes'

/** Legacy popout pad URL — order pad detach is in-page on the trade screen. */
export default function TradePadRedirectPage() {
  const { accountId, practiceAccountId } = useParams<{
    accountId?: string
    practiceAccountId?: string
  }>()
  const id = accountId ?? practiceAccountId
  if (!id) {
    return <Navigate to={ROUTES.HOME} replace />
  }
  return <Navigate to={practiceSessionPath(id)} replace />
}

/** @deprecated use TradePadRedirectPage */
export { TradePadRedirectPage as PracticeTradePadPage }
