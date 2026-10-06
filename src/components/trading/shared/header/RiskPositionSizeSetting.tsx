import { useEffect, useState } from 'react'
import {
  getTradeRiskSettings,
  saveTradeRiskSettings,
  TRADE_RISK_SETTINGS_CHANGED,
  type TradeRiskSettings,
} from '../../../../utils/tradeRiskSettings'

export default function RiskPositionSizeSetting({ isDark }: { isDark: boolean }) {
  const [settings, setSettings] = useState<TradeRiskSettings>(getTradeRiskSettings)
  const [riskText, setRiskText] = useState(() => String(getTradeRiskSettings().riskPerTrade))
  const [bufferText, setBufferText] = useState(() => String(getTradeRiskSettings().riskBuffer))

  useEffect(() => {
    const refresh = () => {
      const next = getTradeRiskSettings()
      setSettings(next)
      setRiskText(String(next.riskPerTrade))
      setBufferText(String(next.riskBuffer))
    }
    window.addEventListener(TRADE_RISK_SETTINGS_CHANGED, refresh)
    return () => window.removeEventListener(TRADE_RISK_SETTINGS_CHANGED, refresh)
  }, [])

  const persist = (next: TradeRiskSettings) => {
    setSettings(next)
    saveTradeRiskSettings(next)
  }

  const saveRisk = (raw: string) => {
    const amount = Number.parseFloat(raw)
    if (!Number.isFinite(amount) || amount <= 0) {
      setRiskText(String(settings.riskPerTrade))
      return
    }
    setRiskText(String(amount))
    persist({ ...settings, riskPerTrade: amount })
  }

  const saveBuffer = (raw: string) => {
    const amount = Number.parseFloat(raw)
    if (!Number.isFinite(amount) || amount < 0) {
      setBufferText(String(settings.riskBuffer))
      return
    }
    setBufferText(String(amount))
    persist({ ...settings, riskBuffer: amount })
  }

  const cardClass = isDark
    ? 'border-slate-700 bg-slate-950/40'
    : 'border-slate-200 bg-slate-50'
  const labelClass = isDark ? 'text-slate-400' : 'text-slate-600'
  const textClass = isDark ? 'text-slate-100' : 'text-slate-900'
  const inputClass = isDark
    ? 'border-slate-700 bg-slate-900 text-slate-100 focus:border-violet-500'
    : 'border-slate-300 bg-white text-slate-900 focus:border-violet-500'

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div>
        <h2 className={`text-sm font-semibold ${textClass}`}>Risk &amp; position size</h2>
        <p className={`mt-1 text-xs leading-5 ${labelClass}`}>
          Auto uses these values to calculate contract quantity from your selected chart line.
        </p>
      </div>

      <section className={`rounded-xl border p-4 ${cardClass}`}>
        <label>
          <span className={`mb-1.5 block text-xs font-semibold ${textClass}`}>Risk per trade</span>
          <div className="relative">
            <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm ${labelClass}`}>$</span>
            <input
              type="text"
              inputMode="decimal"
              value={riskText}
              onChange={(event) => setRiskText(event.target.value.replace(/[^0-9.]/g, ''))}
              onBlur={() => saveRisk(riskText)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  saveRisk(riskText)
                  event.currentTarget.blur()
                }
              }}
              aria-label="Risk per trade in dollars"
              className={`h-10 w-full rounded-lg border pl-7 pr-3 text-right font-mono text-sm outline-none transition focus:ring-2 focus:ring-violet-500/20 ${inputClass}`}
            />
          </div>
        </label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[100, 300, 500].map((amount) => (
            <button
              key={amount}
              type="button"
              aria-pressed={settings.riskPerTrade === amount}
              onClick={() => saveRisk(String(amount))}
              className={`h-8 rounded-lg border font-mono text-xs transition ${
                settings.riskPerTrade === amount
                  ? 'border-violet-500 bg-violet-600 text-white'
                  : isDark
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-300 text-slate-700 hover:bg-white'
              }`}
            >
              ${amount}
            </button>
          ))}
        </div>
      </section>

      <section className={`rounded-xl border p-4 ${cardClass}`}>
        <p className={`text-xs font-semibold ${textClass}`}>Size contracts from</p>
        <p className={`mt-1 text-[11px] leading-4 ${labelClass}`}>
          Choose which chart line determines the automatic quantity.
        </p>
        <div className={`mt-3 grid grid-cols-2 rounded-lg border p-1 ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`}>
          {([
            ['stop_loss', 'Stop loss'],
            ['take_profit', 'Take profit'],
          ] as const).map(([basis, label]) => (
            <button
              key={basis}
              type="button"
              aria-pressed={settings.sizingBasis === basis}
              onClick={() => persist({ ...settings, sizingBasis: basis })}
              className={`h-9 rounded-md text-xs font-semibold transition ${
                settings.sizingBasis === basis
                  ? 'bg-violet-600 text-white shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className={`rounded-xl border p-4 ${cardClass}`}>
        <label>
          <span className={`mb-1.5 block text-xs font-semibold ${textClass}`}>Round-up buffer</span>
          <div className="relative">
            <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm ${labelClass}`}>$</span>
            <input
              type="text"
              inputMode="decimal"
              value={bufferText}
              onChange={(event) => setBufferText(event.target.value.replace(/[^0-9.]/g, ''))}
              onBlur={() => saveBuffer(bufferText)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  saveBuffer(bufferText)
                  event.currentTarget.blur()
                }
              }}
              aria-label="Contract sizing round-up buffer in dollars"
              className={`h-10 w-full rounded-lg border pl-7 pr-3 text-right font-mono text-sm outline-none transition focus:ring-2 focus:ring-violet-500/20 ${inputClass}`}
            />
          </div>
        </label>
        <p className={`mt-2 text-[11px] leading-4 ${labelClass}`}>
          Default $0. Allows one extra contract only when its calculated risk stays within this amount above your risk limit.
        </p>
      </section>
    </div>
  )
}
