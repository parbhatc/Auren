import { Component } from 'react'
import { Moon, RefreshCw, ServerOff, Sun } from 'lucide-react'
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
    const { isDark, onToggleTheme } = this.props
    const port = getApiPort()

    return (
      <div
        className={`min-h-screen flex items-center justify-center px-4 py-10 transition-colors duration-200 ${
          isDark ? 'bg-[#09090B]' : 'bg-[#FAFAFA]'
        }`}
      >
        <main className="w-full max-w-lg" aria-labelledby="server-error-title">
          <div className="mb-4 flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                  isDark
                    ? 'border-[#27272A] bg-[#18181B] text-[#FAFAFA]'
                    : 'border-[#E4E4E7] bg-white text-[#09090B]'
                }`}
              >
                <ServerOff className="h-4 w-4" aria-hidden="true" />
              </span>
              <span
                className={`text-sm font-semibold tracking-tight ${
                  isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'
                }`}
              >
                Auren
              </span>
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-2 ${
                isDark
                  ? 'border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:bg-[#27272A] hover:text-[#FAFAFA] focus:ring-offset-[#09090B]'
                  : 'border-[#E4E4E7] bg-white text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B] focus:ring-offset-[#FAFAFA]'
              }`}
              aria-label={isDark ? t('serverError.useLightMode') : t('serverError.useDarkMode')}
              title={isDark ? t('serverError.useLightMode') : t('serverError.useDarkMode')}
            >
              {isDark ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>

          <div
            className={`overflow-hidden rounded-xl border ${
              isDark
                ? 'border-[#27272A] bg-[#18181B]'
                : 'border-[#E4E4E7] bg-white'
            }`}
          >
            <section className="px-6 pb-6 pt-7 sm:px-8 sm:pb-8 sm:pt-9">
              <div
                className={`mb-5 flex h-11 w-11 items-center justify-center rounded-lg border ${
                  isDark
                    ? 'border-[#3B82F6]/35 bg-[#3B82F6]/10 text-[#3B82F6]'
                    : 'border-[#2563EB]/25 bg-[#2563EB]/[0.07] text-[#2563EB]'
                }`}
              >
                <ServerOff className="h-5 w-5" aria-hidden="true" />
              </div>

              <h1
                id="server-error-title"
                className={`text-xl font-semibold tracking-[-0.02em] sm:text-2xl ${
                  isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'
                }`}
              >
                {t('serverError.title')}
              </h1>
              <p
                className={`mt-2 text-sm leading-6 ${
                  isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'
                }`}
              >
                {t('serverError.message')}
              </p>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className={`mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-2 ${
                  isDark
                    ? 'bg-[#FAFAFA] text-[#09090B] hover:bg-[#E4E4E7] focus:ring-offset-[#18181B]'
                    : 'bg-[#18181B] text-white hover:bg-[#27272A] focus:ring-offset-white'
                }`}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {t('serverError.tryAgain')}
              </button>
            </section>

            <section
              className={`border-t px-6 py-5 sm:px-8 ${
                isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'
              }`}
            >
              <h2
                className={`text-xs font-semibold uppercase tracking-[0.08em] ${
                  isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'
                }`}
              >
                {t('serverError.howToFix')}
              </h2>
              <ol className="mt-4 space-y-3">
                {[t('serverError.step1'), t('serverError.step2', { port }), t('serverError.step3')].map(
                  (step, index) => (
                    <li key={step} className="flex gap-3 text-sm leading-5">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                          isDark
                            ? 'border-[#3F3F46] text-[#A1A1AA]'
                            : 'border-[#D4D4D8] text-[#52525B]'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className={isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}>{step}</span>
                    </li>
                  )
                )}
              </ol>
            </section>
          </div>
        </main>
      </div>
    )
  }
}

export default ServerError
