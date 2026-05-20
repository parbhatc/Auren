import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES, practiceTradeStatsPath } from '../../../../constants/routes'
import type { PracticeAccount } from '../../../../constants/practice'
import { t } from '../../../../utils/translator'
import PracticeAccountCard from './PracticeAccountCard'

export default function PracticeAccountsList({
  accounts,
  isDark,
  onViewAccount,
  onResetAccount,
  onDeleteAccount,
  onResetAll,
}: {
  accounts: PracticeAccount[]
  isDark: boolean
  onViewAccount: (account: PracticeAccount) => void
  onResetAccount: (id: string) => void
  onDeleteAccount: (id: string) => void
  onResetAll: () => void
}) {
  const navigate = useNavigate()

  const groups = useMemo(
    () =>
      [
        { key: 'active' as const, title: t('practice.hub.active') },
        { key: 'passed' as const, title: t('practice.hub.passed') },
        { key: 'blown' as const, title: t('practice.hub.blown') },
      ],
    []
  )

  return (
    <>
      {groups.map(({ key, title }) => {
        const list = accounts.filter((a) => a.status === key)
        if (list.length === 0) return null
        return (
          <section key={key}>
            <h2
              className={`text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2 ${
                isDark ? 'text-slate-500' : 'text-slate-500'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  key === 'active'
                    ? 'bg-violet-500'
                    : key === 'passed'
                      ? 'bg-emerald-500'
                      : 'bg-red-500'
                }`}
              />
              {title}
              <span className={`font-normal normal-case tracking-normal ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                ({list.length})
              </span>
            </h2>
            <div className="grid gap-3">
              {list.map((account) => (
                <PracticeAccountCard
                  key={account.id}
                  account={account}
                  isDark={isDark}
                  onView={() => onViewAccount(account)}
                  onTrade={() => navigate(`${ROUTES.PRACTICE_TRADE}/${account.id}`)}
                  onStats={() => navigate(practiceTradeStatsPath(account.id))}
                  onReset={() => onResetAccount(account.id)}
                  onDelete={() => onDeleteAccount(account.id)}
                />
              ))}
            </div>
          </section>
        )
      })}

      {accounts.length === 0 && (
        <div
          className={`text-center py-16 px-6 rounded-2xl border border-dashed ${
            isDark
              ? 'border-slate-700/80 bg-slate-900/30 text-slate-500'
              : 'border-slate-300 bg-slate-50/80 text-slate-500'
          }`}
        >
          <p className="text-sm font-medium">{t('practice.hub.empty')}</p>
          <p className={`text-xs mt-2 max-w-sm mx-auto ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            {t('practice.hub.nav.connectMarketHint')}
          </p>
        </div>
      )}

      {accounts.length > 0 && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onResetAll}
            className={`text-sm px-3 py-2 rounded-lg border ${
              isDark
                ? 'border-red-900/50 text-red-400 hover:bg-red-950/30'
                : 'border-red-200 text-red-600 hover:bg-red-50'
            }`}
          >
            {t('practice.hub.resetAll')}
          </button>
        </div>
      )}
    </>
  )
}
