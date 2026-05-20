/** Practice hub: market-data + simulated eval/funded accounts (API-backed). */

import { practiceAPI } from '../api/practice.api'
import {
  getDefaultPracticeRules,
  getPracticePlanFromAccount,
  type PracticeAccountMode,
  type PracticeAccountRules,
  type PracticeAccountSize,
} from '../services/practice/practicePlans'
import { computeDrawdownFloor, evaluatePracticeRules } from '../services/practice/practiceRules'
import {
  PRACTICE_PROP_FIRM_CONFIGS,
  getPracticePropFirmConfig,
  practiceFirmHasExclusiveMdsSlot,
  practiceFirmShowsOfflineModeSection,
  practiceFirmSupportsOfflineBracketWatcher,
  resolveOfflineModePositionsForFirm,
  type PracticePropFirmConfigId,
} from './practicePropFirms'

export {
  PRACTICE_PROP_FIRM_CONFIGS,
  getPracticePropFirmConfig,
  practiceFirmHasExclusiveMdsSlot,
  practiceFirmShowsOfflineModeSection,
  practiceFirmSupportsOfflineBracketWatcher,
  resolveOfflineModePositionsForFirm,
  type PracticePropFirmConfigId,
  type PracticeMarketDataSlotPolicy,
  type PracticePropFirmMarketDataConfig,
} from './practicePropFirms'

export const PRACTICE_STORAGE_KEYS = {
  MARKET_DATA: 'practiceMarketData',
  ACCOUNTS: 'practiceAccounts_v1',
  ACTIVE_TRADE_ID: 'practiceActiveTradeAccountId',
  MIGRATED: 'practiceMigratedToApi_v1',
} as const

export const PRACTICE_PROP_FIRM_KEY = 'practicePropFirm'
export const PRACTICE_ACCOUNT_ID_KEY = 'practiceAccountId'
export const PRACTICE_ACCOUNT_LABEL_KEY = 'practiceAccountLabel'

/** Quick quantity chips (mobile scalp bar + DOM); filtered by account max size. */
export const PRACTICE_CONTRACT_QTY_PRESETS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 35, 40, 50, 60,
] as const

/** Quick Trade / DOM contract root symbols (CME product codes). */
export const PRACTICE_CONTRACT_SYMBOL_PRESETS = [
  'MNQ',
  'NQ',
  'MES',
  'ES',
  'MGC',
  'GC',
  'MYM',
  'YM',
  'MCL',
  'CL',
  'M2K',
  'RTY',
] as const

export const PRACTICE_PROP_FIRMS = PRACTICE_PROP_FIRM_CONFIGS.map(({ id, displayName }) => ({
  id,
  displayName,
}))
export type PracticePropFirmId = PracticePropFirmConfigId

export type PracticeAccountStatus = 'active' | 'passed' | 'blown'

export interface PracticeMarketDataSettings {
  propFirmId: string
  accountId: string
  accountLabel: string
  /** When true, server holds the MDS slot while away and tracks SL/TP on open bracket positions. */
  offlineModePositions?: boolean
}

export interface PracticeDayPnL {
  date: string
  pnl: number
}

export interface PracticeAccount {
  id: string
  propFirmId: PracticePropFirmId
  mode: PracticeAccountMode
  size: PracticeAccountSize
  status: PracticeAccountStatus
  balance: number
  highWaterMark: number
  drawdownFloorLocked: boolean
  rules: PracticeAccountRules
  dayPnL: PracticeDayPnL[]
  createdAt: string
  updatedAt: string
  passedAt?: string
  blownAt?: string
  marketDataAccountId: string
  marketDataAccountLabel: string
  lockoutUntil?: string | null
  lockoutReason?: string | null
}

let accountsCache: PracticeAccount[] | null = null
let marketDataCache: PracticeMarketDataSettings | null = null
let refreshInFlight: Promise<void> | null = null

/** Notify UI to re-read cache (does not hit the API). */
export function notifyPracticeDataChanged(): void {
  window.dispatchEvent(new Event('practiceSettingsChanged'))
  window.dispatchEvent(new Event('practiceAccountsChanged'))
}

function loadLocalAccounts(): PracticeAccount[] {
  try {
    const raw = localStorage.getItem(PRACTICE_STORAGE_KEYS.ACCOUNTS)
    if (!raw) return []
    const list = JSON.parse(raw) as PracticeAccount[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function loadLocalMarketData(): PracticeMarketDataSettings {
  try {
    const raw = localStorage.getItem(PRACTICE_STORAGE_KEYS.MARKET_DATA)
    if (raw) return JSON.parse(raw) as PracticeMarketDataSettings
  } catch {
    /* ignore */
  }
  const propFirmId = localStorage.getItem(PRACTICE_PROP_FIRM_KEY) || 'tradesea'
  return {
    propFirmId,
    accountId: localStorage.getItem(PRACTICE_ACCOUNT_ID_KEY) || '',
    accountLabel: localStorage.getItem(PRACTICE_ACCOUNT_LABEL_KEY) || '',
    offlineModePositions: getPracticePropFirmConfig(propFirmId).defaultOfflineModePositions,
  }
}

/** Effective offline bracket mode for the selected prop firm. */
export function resolveOfflineModePositions(
  settings?: PracticeMarketDataSettings | null
): boolean {
  return resolveOfflineModePositionsForFirm(
    settings?.propFirmId,
    settings?.offlineModePositions
  )
}

async function migrateLocalToApiIfNeeded(): Promise<void> {
  if (localStorage.getItem(PRACTICE_STORAGE_KEYS.MIGRATED)) return
  const localAccounts = loadLocalAccounts()
  const localMd = loadLocalMarketData()
  try {
    if (localMd.accountId) {
      await practiceAPI.saveMarketData(localMd)
    }
    for (const acc of localAccounts) {
      const rules = acc.rules || getDefaultPracticeRules(acc.size, acc.mode)
      await practiceAPI.createAccount({
        mode: acc.mode,
        size: acc.size,
        rules,
      })
    }
    localStorage.setItem(PRACTICE_STORAGE_KEYS.MIGRATED, '1')
    localStorage.removeItem(PRACTICE_STORAGE_KEYS.ACCOUNTS)
  } catch {
    /* offline or unauthenticated — keep local */
  }
}

export async function refreshPracticeFromApi(options?: { notify?: boolean }): Promise<void> {
  if (refreshInFlight) {
    await refreshInFlight
    if (options?.notify) notifyPracticeDataChanged()
    return
  }

  refreshInFlight = (async () => {
    await migrateLocalToApiIfNeeded()
    try {
      const [mdRes, accRes] = await Promise.all([
        practiceAPI.getMarketData(),
        practiceAPI.listAccounts(),
      ])
      if (mdRes.success) marketDataCache = mdRes.settings
      if (accRes.success) accountsCache = accRes.accounts
    } catch {
      accountsCache = loadLocalAccounts()
      marketDataCache = loadLocalMarketData()
    }
  })()

  try {
    await refreshInFlight
  } finally {
    refreshInFlight = null
  }

  if (options?.notify) notifyPracticeDataChanged()
}

export function getPracticeMarketDataSettings(): PracticeMarketDataSettings {
  const raw =
    marketDataCache || {
      propFirmId: 'tradesea',
      accountId: '',
      accountLabel: '',
    }
  return {
    ...raw,
    offlineModePositions: resolveOfflineModePositions(raw),
  }
}

export async function savePracticeMarketDataSettings(
  settings: PracticeMarketDataSettings
): Promise<void> {
  marketDataCache = settings
  localStorage.setItem(PRACTICE_STORAGE_KEYS.MARKET_DATA, JSON.stringify(settings))
  try {
    await practiceAPI.saveMarketData(settings)
    await refreshPracticeFromApi()
  } catch {
    /* saved locally */
  }
  notifyPracticeDataChanged()
}

export function getPracticeSettings(): PracticeMarketDataSettings {
  return getPracticeMarketDataSettings()
}

export function savePracticeSettings(
  propFirmId: string,
  accountId: string,
  accountLabel: string
): void {
  void savePracticeMarketDataSettings({ propFirmId, accountId, accountLabel })
}

export function getPracticeAccounts(): PracticeAccount[] {
  return accountsCache ? [...accountsCache] : loadLocalAccounts()
}

export function getPracticeAccountById(id: string): PracticeAccount | undefined {
  return getPracticeAccounts().find((a) => a.id === id)
}

export async function createPracticeAccount(
  mode: PracticeAccountMode,
  size: PracticeAccountSize,
  rules?: Partial<PracticeAccountRules>
): Promise<PracticeAccount> {
  const res = await practiceAPI.createAccount({ mode, size, rules })
  await refreshPracticeFromApi({ notify: true })
  return res.account
}

export async function updatePracticeAccount(
  id: string,
  patch: Partial<PracticeAccount> & { rules?: Partial<PracticeAccountRules> }
): Promise<PracticeAccount | undefined> {
  if (patch.rules) {
    const res = await practiceAPI.updateAccount(id, { rules: patch.rules })
    await refreshPracticeFromApi()
    return res.account
  }
  accountsCache = getPracticeAccounts().map((a) =>
    a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a
  )
  notifyPracticeDataChanged()
  return getPracticeAccountById(id)
}

export async function applyPracticeBalanceChange(
  id: string,
  _delta: number,
  _options?: { recordDay?: boolean }
): Promise<PracticeAccount | undefined> {
  await refreshPracticeFromApi()
  return getPracticeAccountById(id)
}

export async function resetPracticeAccount(id: string): Promise<PracticeAccount | undefined> {
  const res = await practiceAPI.resetAccount(id)
  await refreshPracticeFromApi({ notify: true })
  return res.account
}

export async function deletePracticeAccount(id: string): Promise<void> {
  await practiceAPI.deleteAccount(id)
  await refreshPracticeFromApi({ notify: true })
}

export async function resetAllPracticeAccounts(): Promise<void> {
  await practiceAPI.deleteAllAccounts()
  accountsCache = []
  notifyPracticeDataChanged()
}

export function getPracticeAccountLabel(account: PracticeAccount): string {
  return getPracticePlanFromAccount(account).label
}

export function getPracticeAccountDisplayTitle(account: PracticeAccount): string {
  const firm =
    PRACTICE_PROP_FIRMS.find((f) => f.id === account.propFirmId)?.displayName ||
    account.propFirmId
  return `${firm} · ${getPracticeAccountLabel(account)}`
}

export { computeDrawdownFloor, evaluatePracticeRules }
export type { PracticeAccountMode, PracticeAccountSize, PracticeAccountRules }
