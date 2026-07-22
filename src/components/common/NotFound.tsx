import { Component } from 'react'
import { Link } from 'react-router-dom'
import { Home, AlertCircle } from 'lucide-react'
import { t } from '../../utils/translator'
import { ROUTES } from '../../constants/routes'
import Logo from './Logo'
import { NotFoundProps } from '../../types/common'

/**
 * 404 Not Found component
 * Displays when a route doesn't exist
 */
class NotFound extends Component<NotFoundProps> {
  render() {
    const { isDark } = this.props

    return (
      <div
        className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-200 ${
          isDark ? 'bg-[#09090B]' : 'bg-[#FAFAFA]'
        }`}
      >
        <div
          className={`max-w-md w-full p-8 rounded-xl border ${
            isDark ? 'bg-[#18181B] border-[#27272A]' : 'bg-white border-[#E4E4E7]'
          }`}
        >
          <div className="text-center mb-6">
            <Logo isDark={isDark} />
          </div>

          <div className="flex items-center justify-center gap-4 mb-6">
            <div
              className={`p-3 rounded-full ${
                isDark ? 'bg-orange-950/50' : 'bg-orange-100'
              }`}
            >
              <AlertCircle
                className={`w-8 h-8 ${
                  isDark ? 'text-orange-400' : 'text-orange-600'
                }`}
              />
            </div>
            <div>
              <h1
                className={`text-3xl font-bold ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                404
              </h1>
            </div>
          </div>

          <div className="text-center mb-6">
            <h2
              className={`text-xl font-semibold mb-2 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              {t('notFound.title')}
            </h2>
            <p
              className={`text-sm ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              {t('notFound.message')}
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              to={ROUTES.HOME}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 ${
                isDark
                  ? 'bg-blue-950/50 text-blue-300 hover:bg-blue-950/70 border border-blue-800/50'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              <Home className="w-4 h-4" />
              <span className="text-sm font-medium">{t('notFound.goHome')}</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }
}

export default NotFound
