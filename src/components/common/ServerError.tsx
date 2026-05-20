import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'
import { t } from '../../utils/translator'
import { getApiPort } from '../../api'
import { ServerErrorProps } from '../../types/common'

/**
 * Server Error component
 * Displays when the server cannot be reached
 */
class ServerError extends Component<ServerErrorProps> {
  private reloadInterval: NodeJS.Timeout | null = null

  componentDidMount() {
    // Auto-reload page every 60 seconds to check if server is back online
    this.reloadInterval = setInterval(() => {
      window.location.reload()
    }, 60000) // 60 seconds
  }

  componentWillUnmount() {
    // Cleanup interval on unmount
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval)
    }
  }

  render() {
    const { isDark } = this.props
    const port = getApiPort()

    return (
      <div
        className={`min-h-screen flex items-center justify-center p-4 transition-all duration-700 ease-in-out ${
          isDark
            ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
            : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
        }`}
      >
        <div
          className={`max-w-md w-full p-8 rounded-2xl shadow-2xl border ${
            isDark
              ? 'bg-slate-800/90 border-red-800/50 backdrop-blur-sm'
              : 'bg-white/90 border-red-300 backdrop-blur-sm'
          }`}
        >
          <div className="flex items-center gap-4 mb-6">
            <div
              className={`p-3 rounded-full ${
                isDark ? 'bg-red-950/50' : 'bg-red-100'
              }`}
            >
              <AlertTriangle
                className={`w-8 h-8 ${
                  isDark ? 'text-red-400' : 'text-red-600'
                }`}
              />
            </div>
            <div>
              <h1
                className={`text-2xl font-bold ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {t('serverError.title')}
              </h1>
            </div>
          </div>

          <div
            className={`p-4 rounded-lg mb-6 ${
              isDark
                ? 'bg-red-950/40 border border-red-800/50'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <p
              className={`text-sm leading-relaxed ${
                isDark ? 'text-red-200' : 'text-red-800'
              }`}
            >
              <strong className="font-semibold">{t('serverError.message')}</strong>
            </p>
          </div>

          <div
            className={`p-4 rounded-lg ${
              isDark ? 'bg-slate-700/50' : 'bg-slate-50'
            }`}
          >
            <h2
              className={`text-sm font-semibold mb-2 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              {t('serverError.howToFix')}
            </h2>
            <ol
              className={`text-sm space-y-2 list-decimal list-inside ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              <li>{t('serverError.step1')}</li>
              <li>{t('serverError.step2', { port })}</li>
              <li>{t('serverError.step3')}</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }
}

export default ServerError
