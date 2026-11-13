import { useEffect, useState } from 'react'
import {
  getTradePadMicroOnly,
  saveTradePadMicroOnly,
  TRADE_PAD_MICRO_ONLY_EVENT,
} from '../../../../utils/tradePadSymbol'

export default function MicroOnlySetting({ accountId, isDark }: { accountId: string; isDark: boolean }) {
  const [enabled, setEnabled] = useState(() => getTradePadMicroOnly(accountId))
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    const read = () => setEnabled(getTradePadMicroOnly(accountId))
    read()
    setSaveFailed(false)
    window.addEventListener(TRADE_PAD_MICRO_ONLY_EVENT, read)
    window.addEventListener('storage', read)
    return () => {
      window.removeEventListener(TRADE_PAD_MICRO_ONLY_EVENT, read)
      window.removeEventListener('storage', read)
    }
  }, [accountId])

  return (
    <section className={`border-b px-4 py-4 ${isDark ? 'border-slate-700 text-slate-100' : 'border-slate-200 text-slate-900'}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-violet-600"
          checked={enabled}
          onChange={(event) => {
            try {
              saveTradePadMicroOnly(accountId, event.target.checked)
              setSaveFailed(false)
            } catch {
              setSaveFailed(true)
            }
          }}
        />
        <span>
          <span className="block text-sm font-semibold">Micro only</span>
          <span className={`mt-1 block text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Allow new orders only for MES and MNQ on this account in this browser.
          </span>
        </span>
      </label>
      {saveFailed && <p role="alert" className="mt-2 text-xs text-red-500">Couldn’t save this setting.</p>}
    </section>
  )
}
