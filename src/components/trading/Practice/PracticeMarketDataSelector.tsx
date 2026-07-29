import { useCallback, useEffect, useState } from 'react'
import { Check, RefreshCw } from 'lucide-react'
import { tradeseaAPI, type TradeseaAccount } from '../../../api/tradesea.api'
import {
  getPracticeMarketDataSettings,
  savePracticeMarketDataSettings,
  updateFirmMarketDataSelection,
} from '../../../constants/practice'

interface PracticeMarketDataSelectorProps {
  isDark: boolean
  onOpenConnectionSettings: () => void
}

export default function PracticeMarketDataSelector({
  isDark,
  onOpenConnectionSettings,
}: PracticeMarketDataSelectorProps) {
  const [accounts, setAccounts] = useState<TradeseaAccount[]>([])
  const [savedMarketData, setSavedMarketData] = useState(() =>
    getPracticeMarketDataSettings()
  )
  const [selectedAccountId, setSelectedAccountId] = useState(savedMarketData.accountId)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const result = await tradeseaAPI.getAccounts()
      if (!result.connected || !result.accounts?.length) {
        throw new Error(result.message || 'No supported market data accounts are available.')
      }
      const saved = getPracticeMarketDataSettings()
      const savedAccount = result.accounts.find((account) => account.id === saved.accountId)
      setSavedMarketData(saved)
      setAccounts(result.accounts)
      setSelectedAccountId(savedAccount?.id ?? '')
    } catch (caught) {
      setAccounts([])
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not load available market data accounts.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  const savedAccountAvailable = accounts.some(
    (account) => account.id === savedMarketData.accountId
  )

  const saveSelection = async (accountId: string) => {
    const selectedAccount = accounts.find((account) => account.id === accountId)
    if (!selectedAccount) return
    setSelectedAccountId(accountId)
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const accountLabel = selectedAccount.label || selectedAccount.id
      const next = updateFirmMarketDataSelection(
        getPracticeMarketDataSettings(),
        'tradesea',
        {
          accountId: selectedAccount.id,
          accountLabel,
        }
      )
      await savePracticeMarketDataSettings(next)
      setSavedMarketData(getPracticeMarketDataSettings())
      setSuccess('Saved')
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not save the Practice market data account.'
      )
    } finally {
      setSaving(false)
    }
  }

  const muted = isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'
  const inputClass = `h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:max-w-md ${
    isDark
      ? 'border-[#3F3F46] bg-[#09090B] text-[#FAFAFA]'
      : 'border-[#D4D4D8] bg-white text-[#09090B]'
  }`

  return (
    <section className="mb-5" aria-label="Practice market data">
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor="practice-market-data-account"
          className={`text-xs font-semibold ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}
        >
          Market data
        </label>
        {loading ? (
          <span className={`inline-flex h-9 items-center gap-2 text-xs ${muted}`}>
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500" aria-hidden />
            Loading…
          </span>
        ) : accounts.length ? (
          <>
            <select
              id="practice-market-data-account"
              value={selectedAccountId}
              disabled={saving}
              onChange={(event) => void saveSelection(event.target.value)}
              className={inputClass}
            >
              {!savedAccountAvailable ? <option value="">Select an account…</option> : null}
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label || account.id}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadAccounts()}
              aria-label="Refresh available market data accounts"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${
                isDark
                  ? 'border-[#3F3F46] text-[#A1A1AA] hover:bg-[#27272A]'
                  : 'border-[#D4D4D8] text-[#52525B] hover:bg-[#F4F4F5]'
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            </button>
            {saving ? (
              <span className={`text-xs ${muted}`}>Saving…</span>
            ) : success ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                {success}
              </span>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            onClick={onOpenConnectionSettings}
            className="text-xs font-semibold text-blue-500 hover:text-blue-400"
          >
            Connect Tradesea
          </button>
        )}
      </div>

      {!loading && !savedAccountAvailable && savedMarketData.accountId && accounts.length ? (
        <p
          role="alert"
          className={`mt-2 text-xs ${isDark ? 'text-amber-300' : 'text-amber-700'}`}
        >
          The saved account is unavailable. Select another account.
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className={`mt-2 text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}
        >
          {error}
        </p>
      ) : null}
    </section>
  )
}
