import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getPracticeAccountById,
  refreshPracticeFromApi,
  type PracticeAccount,
} from '../constants/practice'
import { practiceAPI } from '../api/practice.api'
import {
  evaluatePracticeLockout,
  formatLockoutCountdown,
  lockoutExpired,
  type PracticeLockoutStatus,
} from '../services/practice/practiceLockout'
import { aurenToast } from '../utils/aurenToast'
import { t } from '../utils/translator'

export const PRACTICE_LOCK_PRESETS = [15, 30, 60, 120] as const
export const PRACTICE_LOCK_MIN_MINUTES = 1
export const PRACTICE_LOCK_MAX_MINUTES = 24 * 60

export type PracticeLockDurationUnit = 'minutes' | 'hours'

export function formatLockPresetLabel(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`
  return `${minutes}m`
}

export function parseLockDurationMinutes(
  value: number,
  unit: PracticeLockDurationUnit
): number | null {
  if (!Number.isFinite(value) || value <= 0) return null
  const mins = unit === 'hours' ? Math.round(value * 60) : Math.round(value)
  if (mins < PRACTICE_LOCK_MIN_MINUTES || mins > PRACTICE_LOCK_MAX_MINUTES) return null
  return mins
}

export function formatLockDurationApplied(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    return t('practice.lockout.lockedForHours', { hours: String(minutes / 60) })
  }
  return t('practice.lockout.lockedForMinutes', { minutes: String(minutes) })
}

export function usePracticeLockout(practiceAccountId: string | undefined) {
  const [account, setAccount] = useState<PracticeAccount | undefined>()
  const [lockout, setLockout] = useState<PracticeLockoutStatus | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const expiryToastShownRef = useRef(false)

  const sync = useCallback(async () => {
    if (!practiceAccountId) return
    setAccount(getPracticeAccountById(practiceAccountId))
    try {
      const res = await practiceAPI.getLockout(practiceAccountId)
      if (res.success && res.lockout) {
        setLockout(res.lockout as unknown as PracticeLockoutStatus)
      }
    } catch {
      const acc = getPracticeAccountById(practiceAccountId)
      if (acc) setLockout(evaluatePracticeLockout(acc))
    }
  }, [practiceAccountId])

  useEffect(() => {
    void sync()
    const onChange = () => void sync()
    window.addEventListener('practiceAccountsChanged', onChange)
    return () => window.removeEventListener('practiceAccountsChanged', onChange)
  }, [sync])

  useEffect(() => {
    if (lockout?.until && !lockoutExpired(lockout.until)) {
      expiryToastShownRef.current = false
    }
  }, [lockout?.until])

  useEffect(() => {
    if (!lockout?.until) {
      setCountdown(null)
      return
    }
    const tick = () => {
      const cd = formatLockoutCountdown(lockout.until)
      setCountdown(cd)
      if (cd == null && lockout.locked) {
        if (!expiryToastShownRef.current) {
          expiryToastShownRef.current = true
          aurenToast.success(
            t('practice.lockout.expiredTitle'),
            t('practice.lockout.expiredSubtitle')
          )
        }
        void sync()
      }
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [lockout, sync])

  const applyLock = useCallback(
    async (minutes: number) => {
      if (!practiceAccountId) return false
      const mins = parseLockDurationMinutes(minutes, 'minutes')
      if (mins == null) {
        aurenToast.warning(
          t('practice.lockout.customInvalidTitle'),
          t('practice.lockout.customInvalidHint', {
            min: String(PRACTICE_LOCK_MIN_MINUTES),
            maxHours: String(PRACTICE_LOCK_MAX_MINUTES / 60),
          })
        )
        return false
      }
      setBusy(true)
      try {
        await practiceAPI.setLockout(practiceAccountId, mins)
        await refreshPracticeFromApi({ notify: true })
        await sync()
        aurenToast.lockout(
          t('practice.lockout.lockedTitle'),
          formatLockDurationApplied(mins)
        )
        return true
      } finally {
        setBusy(false)
      }
    },
    [practiceAccountId, sync]
  )

  const clearLock = useCallback(async () => {
    if (!practiceAccountId) return
    setBusy(true)
    try {
      await practiceAPI.clearLockout(practiceAccountId)
      await refreshPracticeFromApi({ notify: true })
      await sync()
    } finally {
      setBusy(false)
    }
  }, [practiceAccountId, sync])

  const status = (() => {
    if (!account) return null
    const evaluated = evaluatePracticeLockout(account)
    if (!lockout) return evaluated
    if (lockout.until && lockoutExpired(lockout.until)) return evaluated
    if (!lockout.locked) return evaluated
    return { ...evaluated, ...lockout, locked: true }
  })()

  return {
    account,
    status,
    countdown,
    busy,
    sync,
    applyLock,
    clearLock,
    isActiveAccount: account?.status === 'active',
  }
}
