import { Suspense, useContext } from 'react'
import { Outlet, useMatch, useNavigate } from 'react-router-dom'
import { ROUTES } from '../../../constants/routes'
import { ValidatedAuthContext } from '../../../contexts/ValidatedAuthContext'
import { useTheme } from '../../../hooks/useTheme'
import BacktesterNav from './BacktesterNav'
import Loading from '../../common/Loading'
import ProductHeader from '../../layout/ProductHeader'
import { workspaceThemeStyle } from '../../layout/WorkspacePrimitives'

export default function BacktesterPageShell() {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const auth = useContext(ValidatedAuthContext)
  const dataRoute = useMatch(ROUTES.BACKTESTER_DATA_MANAGEMENT)

  return (
    <div
      style={workspaceThemeStyle(isDark)}
      className="auren-shell-offset auren-workspace min-h-screen"
    >
      <ProductHeader isDark={isDark} toggleTheme={toggleTheme} />
      <main className="mx-auto max-w-[1400px] px-4 py-7 sm:px-7 sm:py-9 xl:px-9">
        <BacktesterNav
          isDark={isDark}
          toggleTheme={toggleTheme}
          navigate={navigate}
          activeTab={dataRoute ? 'data' : 'sessions'}
          showAdmin={auth?.isAdmin}
        />
        <Suspense fallback={<Loading fullScreen={false} isDark={isDark} />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
