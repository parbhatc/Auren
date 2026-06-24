import { t } from '../../../../utils/translator'
import type { HubAdminSection } from '../../../../types/practiceHub'
import { HUB_ADMIN_SECTIONS } from './hubAdminSections'

export default function HubAdminSectionNav({
  section,
  onSectionChange,
  isDark,
}: {
  section: HubAdminSection
  onSectionChange: (section: HubAdminSection) => void
  isDark: boolean
}) {
  return (
    <nav
      className={`relative overflow-hidden rounded-2xl p-1.5 sm:p-2 ${
        isDark
          ? 'bg-slate-900/70 ring-1 ring-slate-800/90 shadow-xl shadow-black/20'
          : 'bg-white ring-1 ring-slate-200/90 shadow-lg shadow-slate-200/50'
      }`}
      role="tablist"
      aria-label={t('practice.hub.nav.admin')}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${
          isDark ? 'via-amber-500/50' : 'via-amber-400/60'
        } to-transparent`}
        aria-hidden
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2">
        {HUB_ADMIN_SECTIONS.map(({ id, icon: Icon, labelKey, navDescKey }) => {
          const active = section === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSectionChange(id)}
              className={`group relative flex items-start gap-3 rounded-xl px-4 py-3.5 text-left transition-all duration-300 ${
                active
                  ? isDark
                    ? 'bg-gradient-to-br from-amber-500/20 via-amber-500/8 to-transparent ring-1 ring-amber-500/35 shadow-lg shadow-amber-950/25'
                    : 'bg-gradient-to-br from-amber-50 via-orange-50/90 to-white ring-1 ring-amber-200/80 shadow-md shadow-amber-100/60'
                  : isDark
                    ? 'hover:bg-slate-800/50'
                    : 'hover:bg-slate-50/90'
              }`}
            >
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-300 ${
                  active
                    ? isDark
                      ? 'bg-amber-500/25 text-amber-300 shadow-inner shadow-amber-950/30'
                      : 'bg-amber-500 text-white shadow-md shadow-amber-500/35'
                    : isDark
                      ? 'bg-slate-800/80 text-slate-500 group-hover:text-slate-300'
                      : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-semibold tracking-tight ${
                    active
                      ? isDark
                        ? 'text-amber-50'
                        : 'text-amber-950'
                      : isDark
                        ? 'text-slate-300 group-hover:text-slate-100'
                        : 'text-slate-700 group-hover:text-slate-900'
                  }`}
                >
                  {t(labelKey)}
                </p>
                <p
                  className={`mt-0.5 text-xs leading-snug ${
                    active
                      ? isDark
                        ? 'text-amber-200/60'
                        : 'text-amber-800/70'
                      : isDark
                        ? 'text-slate-500'
                        : 'text-slate-500'
                  }`}
                >
                  {t(navDescKey)}
                </p>
              </div>

              {active ? (
                <span
                  className={`absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent ${
                    isDark ? 'via-amber-400/70' : 'via-amber-500/50'
                  } to-transparent`}
                  aria-hidden
                />
              ) : null}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
