import { useCallback, useEffect, useRef, useState } from 'react'
import { Lock, Settings2, Timer, Unlock } from 'lucide-react'
import {
  getPracticeAccountById,
  updatePracticeAccount,
  type PracticeAccount,
} from '../../../constants/practice'
import {
  formatLockPresetLabel,
  parseLockDurationMinutes,
  PRACTICE_LOCK_MAX_MINUTES,
  PRACTICE_LOCK_PRESETS,
  usePracticeLockout,
  type PracticeLockDurationUnit,
} from '../../../hooks/usePracticeLockout'
import { getDefaultPracticeRules, getPracticePlanFromAccount } from '../../../services/practice/practicePlans'
import { formatPracticeDollars } from '../../../services/practice/practiceRules'
import type { PracticeAccountRules } from '../../../services/practice/practicePlans'
import { t } from '../../../utils/translator'
import PracticeSwitch from './PracticeSwitch'

function numText(value: number | null | undefined): string {
  return value != null && Number.isFinite(value) ? String(value) : ''
}

function parsePositive(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? n : null
}

export default function PracticeHeaderTradingSettings({
  practiceAccountId,
  isDark,
}: {
  practiceAccountId: string
  isDark: boolean
}) {
  const [open, setOpen] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const { status, countdown, busy, applyLock, clearLock, isActiveAccount, sync } =
    usePracticeLockout(practiceAccountId)

  const [lockoutEnabled, setLockoutEnabled] = useState(false)
  const [dailyLossText, setDailyLossText] = useState('')
  const [maxTradesText, setMaxTradesText] = useState('')
  const [saving, setSaving] = useState(false)
  const [customLockValue, setCustomLockValue] = useState('1')
  const [customLockUnit, setCustomLockUnit] = useState<PracticeLockDurationUnit>('hours')
  const [customLockError, setCustomLockError] = useState('')

  const loadFormFromAccount = useCallback((account: PracticeAccount) => {
    const rules = account.rules ?? getPracticePlanFromAccount(account)
    setLockoutEnabled(rules.lockoutEnabled === true)
    setDailyLossText(rules.dailyLossLimit != null ? String(rules.dailyLossLimit) : '')
    setMaxTradesText(rules.maxTradesPerDay != null ? String(rules.maxTradesPerDay) : '')
  }, [])

  useEffect(() => {
    const account = getPracticeAccountById(practiceAccountId)
    if (account) loadFormFromAccount(account)
  }, [practiceAccountId, loadFormFromAccount])

  useEffect(() => {
    if (!open) return
    const account = getPracticeAccountById(practiceAccountId)
    if (account) loadFormFromAccount(account)
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, practiceAccountId, loadFormFromAccount])

  if (!isActiveAccount || !status) return null

  const locked = status.locked
  const dll = status.dailyLossLimit
  const dllPct =
    dll != null && dll > 0 ? Math.min(100, (status.dailyLossUsed / dll) * 100) : 0

  const account = getPracticeAccountById(practiceAccountId)
  const defaults = account ? getDefaultPracticeRules(account.size, account.mode) : null

  const btnClass = isDark
    ? 'border-slate-600/80 text-slate-400 hover:border-violet-500/40 hover:bg-violet-950/30 hover:text-violet-200'
    : 'border-slate-300 text-slate-500 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700'

  const menuClass = isDark
    ? 'border-slate-700 bg-slate-900 shadow-xl shadow-black/40'
    : 'border-slate-200 bg-white shadow-xl shadow-slate-200/80'

  const fieldClass = `w-full h-9 px-2.5 rounded-lg border text-sm tabular-nums text-right ${
    isDark
      ? 'border-slate-700 bg-slate-950/80 text-slate-100 placeholder:text-slate-600'
      : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
  }`

  const labelClass = `text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`
  const presetBtn = isDark
    ? 'border-slate-600 text-slate-300 hover:bg-slate-800'
    : 'border-slate-200 text-slate-700 hover:bg-slate-50'

  const unitToggleBtn = (active: boolean) =>
    `flex-1 px-2 py-1.5 text-[10px] font-semibold rounded-md transition ${
      active
        ? isDark
          ? 'bg-violet-600/90 text-white'
          : 'bg-violet-600 text-white'
        : isDark
          ? 'text-slate-400 hover:bg-slate-800'
          : 'text-slate-600 hover:bg-slate-100'
    }`

  const applyCustomLock = async () => {
    setCustomLockError('')
    const raw = customLockValue.trim()
    if (!raw) {
      setCustomLockError(t('practice.lockout.customRequired'))
      return
    }
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) {
      setCustomLockError(t('practice.lockout.customRequired'))
      return
    }
    const minutes = parseLockDurationMinutes(n, customLockUnit)
    if (minutes == null) {
      setCustomLockError(
        t('practice.lockout.customInvalidHint', {
          min: '1',
          maxHours: String(PRACTICE_LOCK_MAX_MINUTES / 60),
        })
      )
      return
    }
    const ok = await applyLock(minutes)
    if (ok) setOpen(false)
  }

  const saveLimits = async () => {
    if (!account || !defaults) return
    setSaving(true)
    setSaveMsg('')
    const rules: Partial<PracticeAccountRules> = {
      lockoutEnabled,
      dailyLossLimit: lockoutEnabled ? parsePositive(dailyLossText) : null,
      maxTradesPerDay: parsePositive(maxTradesText),
    }
    try {
      await updatePracticeAccount(practiceAccountId, { rules })
      await sync()
      setSaveMsg(t('practice.lockout.limitsSaved'))
      window.setTimeout(() => setSaveMsg(''), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title={t('practice.lockout.settingsButton')}
        aria-label={t('practice.lockout.settingsButton')}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center justify-center h-7 w-7 rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${btnClass} ${
          open ? (isDark ? 'border-violet-500/50 bg-violet-950/40 text-violet-200' : 'border-violet-300 bg-violet-50 text-violet-700') : ''
        }`}
      >
        <Settings2 className="w-4 h-4" />
        {locked ? (
          <span
            className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ${
              isDark ? 'bg-red-500 ring-slate-950' : 'bg-red-500 ring-white'
            }`}
            aria-hidden
          />
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t('practice.lockout.settingsTitle')}
          className={`absolute right-0 top-full mt-1.5 z-[200] w-[min(20rem,calc(100vw-1rem))] rounded-xl border overflow-hidden ${menuClass}`}
        >
          <div
            className={`px-3 py-2.5 border-b ${isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50/90'}`}
          >
            <p className={`text-xs font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {t('practice.lockout.settingsTitle')}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  locked
                    ? isDark
                      ? 'bg-red-500/20 text-red-200'
                      : 'bg-red-100 text-red-800'
                    : isDark
                      ? 'bg-emerald-500/15 text-emerald-200'
                      : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {locked ? t('practice.lockout.lockedTitle') : t('practice.lockout.activeTitle')}
              </span>
              {locked && countdown ? (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold tabular-nums ${
                    isDark ? 'text-red-300' : 'text-red-700'
                  }`}
                >
                  <Timer className="h-3 w-3" />
                  {countdown}
                </span>
              ) : null}
            </div>
            {locked ? (
              <p className={`text-[11px] mt-1.5 leading-snug ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {status.message}
              </p>
            ) : (
              <p className={`text-[11px] mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                {t('practice.lockout.activeHint', { reset: status.nextSessionResetLabel })}
              </p>
            )}
          </div>

          <div className="p-3 space-y-3 max-h-[min(70vh,28rem)] overflow-y-auto">
            {dll != null && dll > 0 && lockoutEnabled && (
              <div>
                <div className="flex justify-between text-[10px] mb-1 tabular-nums">
                  <span className={isDark ? 'text-slate-500' : 'text-slate-500'}>
                    {t('practice.lockout.dailyLoss')}
                  </span>
                  <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                    ${formatPracticeDollars(status.dailyLossUsed)} / ${formatPracticeDollars(dll)}
                  </span>
                </div>
                <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                  <div
                    className={`h-full rounded-full transition-all ${
                      dllPct >= 100 ? 'bg-red-500' : dllPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, dllPct)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                {t('practice.lockout.limitsSection')}
              </p>

              <PracticeSwitch
                checked={lockoutEnabled}
                onChange={setLockoutEnabled}
                isDark={isDark}
                label={t('practice.lockout.enableLockouts')}
              />

              <div>
                <span className={labelClass}>{t('practice.lockout.dailyLossLimitLabel')}</span>
                <p className={`text-[10px] mb-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  {t('practice.lockout.dailyLossLimitHint')}
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  disabled={!lockoutEnabled}
                  value={dailyLossText}
                  onChange={(e) => setDailyLossText(e.target.value.replace(/[^\d.]/g, ''))}
                  className={`${fieldClass} disabled:opacity-40`}
                  placeholder="—"
                />
              </div>

              <div>
                <span className={labelClass}>{t('practice.lockout.maxTradesLabel')}</span>
                <p className={`text-[10px] mb-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  {t('practice.lockout.maxTradesHint')}
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  value={maxTradesText}
                  onChange={(e) => setMaxTradesText(e.target.value.replace(/\D/g, ''))}
                  className={fieldClass}
                  placeholder={t('practice.lockout.maxTradesPlaceholder')}
                />
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => void saveLimits()}
                className={`w-full rounded-lg py-2 text-xs font-semibold transition-colors ${
                  isDark
                    ? 'bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50'
                    : 'bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50'
                }`}
              >
                {saving ? '…' : t('practice.lockout.saveLimits')}
              </button>
              {saveMsg ? (
                <p className={`text-[10px] text-center ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  {saveMsg}
                </p>
              ) : null}
            </div>

            <div
              className={`pt-3 border-t space-y-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}
            >
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                {t('practice.lockout.lockTradingTitle')}
              </p>

              {status.maxTradesPerDay != null && status.maxTradesPerDay > 0 && (
                <p className={`text-[10px] tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  {t('practice.lockout.tradesToday', {
                    count: String(status.tradesToday),
                    max: String(status.maxTradesPerDay),
                  })}
                </p>
              )}

              {locked && status.canUnlockManually ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void clearLock()}
                  className={`w-full inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-semibold ${
                    isDark
                      ? 'border-emerald-600/50 text-emerald-200 hover:bg-emerald-950/40'
                      : 'border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                  }`}
                >
                  <Unlock className="h-3.5 w-3.5" />
                  {t('practice.lockout.unlock')}
                </button>
              ) : null}

              {!locked ? (
                <>
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                    {t('practice.lockout.selfLock')}
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PRACTICE_LOCK_PRESETS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          const ok = await applyLock(m)
                          if (ok) setOpen(false)
                        }}
                        className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors disabled:opacity-50 ${presetBtn}`}
                      >
                        <Lock className="h-3 w-3 opacity-70" />
                        {formatLockPresetLabel(m)}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {t('practice.lockout.customDuration')}
                    </p>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={customLockValue}
                        disabled={busy}
                        onChange={(e) => {
                          setCustomLockValue(e.target.value.replace(/[^\d.]/g, ''))
                          setCustomLockError('')
                        }}
                        className={`${fieldClass} flex-1 text-left`}
                        placeholder={
                          customLockUnit === 'hours'
                            ? t('practice.lockout.customHoursPlaceholder')
                            : t('practice.lockout.customMinutesPlaceholder')
                        }
                        aria-label={t('practice.lockout.customDuration')}
                      />
                      <div
                        className={`flex shrink-0 rounded-lg border p-0.5 ${
                          isDark ? 'border-slate-700 bg-slate-950/80' : 'border-slate-300 bg-slate-50'
                        }`}
                        role="group"
                        aria-label={t('practice.lockout.customUnitLabel')}
                      >
                        <button
                          type="button"
                          disabled={busy}
                          className={unitToggleBtn(customLockUnit === 'minutes')}
                          onClick={() => setCustomLockUnit('minutes')}
                        >
                          {t('practice.lockout.customMinutes')}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className={unitToggleBtn(customLockUnit === 'hours')}
                          onClick={() => setCustomLockUnit('hours')}
                        >
                          {t('practice.lockout.customHours')}
                        </button>
                      </div>
                    </div>
                    {customLockError ? (
                      <p className={`text-[10px] ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                        {customLockError}
                      </p>
                    ) : (
                      <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                        {t('practice.lockout.customRangeHint', {
                          maxHours: String(PRACTICE_LOCK_MAX_MINUTES / 60),
                        })}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void applyCustomLock()}
                      className={`w-full inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-semibold disabled:opacity-50 ${
                        isDark
                          ? 'border-violet-600/50 bg-violet-950/40 text-violet-200 hover:bg-violet-900/50'
                          : 'border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100'
                      }`}
                    >
                      <Lock className="h-3.5 w-3.5" />
                      {t('practice.lockout.customLockButton')}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
