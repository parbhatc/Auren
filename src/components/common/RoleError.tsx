import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'
import { t } from '../../utils/translator'
import { RoleErrorProps } from '../../types/common'

/**
 * Role Error component
 * Displays when no roles are configured on the server
 */
class RoleError extends Component<RoleErrorProps> {
  render() {
    const { isDark } = this.props

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
                {t('roleError.title')}
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
              <strong className="font-semibold">{t('roleError.message')}</strong>
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
              {t('roleError.howToFix')}
            </h2>
            <ol
              className={`text-sm space-y-2 list-decimal list-inside ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              <li>{t('roleError.step1')} <code className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-400">server/data/roles.json</code></li>
              <li>
                {t('roleError.step2')}
                <pre
                  className={`mt-2 p-3 rounded text-xs overflow-x-auto ${
                    isDark ? 'bg-slate-900 text-slate-300' : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {JSON.stringify(
                    {
                      roles: [
                        {
                          id: 'user',
                          name: 'User',
                          permissions: ['user.read', 'user.write'],
                        },
                        {
                          id: 'admin',
                          name: 'Admin',
                          permissions: ['*'],
                        },
                      ],
                    },
                    null,
                    2
                  )}
                </pre>
              </li>
              <li>{t('roleError.step3')}</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }
}

export default RoleError
