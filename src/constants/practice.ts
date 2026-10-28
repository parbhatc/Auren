/** Practice hub: market-data + simulated eval/funded accounts (API-backed). */

import { practiceAPI } from '../api/practice.api'
import { getAuthToken } from '../api/api'
import {
  getDefaultPracticeRules,
  getPracticePlanFromAccount,
  type PracticeAccountMode,
  type PracticeAccountRules,
  type PracticeAccountSize,
} from '../services/practice/practicePlans'
import { computeDrawdownFloor, evaluatePracticeRules } from '../services/practice/practiceRules'
import {
  getFirmMarketDataSelection,
  migratePracticeMarketDataSettings,
} from './practiceMarketDataByFirm'
import type { PracticeMarketDataSettings } from './practiceMarketDataTypes'
import {
  PRACTICE_PROP_FIRM_CONFIGS,
  getPracticePropFirmConfig,
  normalizePracticePropFirmId,
  practiceFirmHasExclusiveMdsSlot,
  type PracticePropFirmConfigId,
} from './practicePropFirms'

export {
  PRACTICE_PROP_FIRM_CONFIGS,
  getPracticePropFirmConfig,
  normalizePracticePropFirmId,
  practiceFirmHasExclusiveMdsSlot,
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

/** Quick quantity chips (DOM / order pad / mobile); filtered by account max size. */
export const PRACTICE_CONTRACT_QTY_PRESETS = [1, 3, 6, 10, 15] as const

export const PRACTICE_CONTRACT_QTY_PRESET_CHIP_LIMIT = PRACTICE_CONTRACT_QTY_PRESETS.length

/** Quick Trade / DOM contract root symbols (CME product codes). */
export const PRACTICE_CONTRACT_SYMBOL_PRESETS = [
  'NQ',
  'MNQ',
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

/** Default TradingView chart ticker when practice has no saved layout/symbol. */
export const DEFAULT_PRACTICE_CHART_SYMBOL = 'CME:NQ'

export const PRACTICE_PROP_FIRMS = PRACTICE_PROP_FIRM_CONFIGS.map(({ id, displayName }) => ({
  id,
  displayName,
}))
export type PracticePropFirmId = PracticePropFirmConfigId

export type PracticeAccountStatus = 'active' | 'passed' | 'blown'

export type {
  PracticeFirmMarketDataSelection,
  PracticeMarketDataSettings,
} from './practiceMarketDataTypes'
export {
  applyActiveFirmToMarketDataSettings,
  getFirmMarketDataSelection,
  migratePracticeMarketDataSettings,
  updateFirmMarketDataSelection,
} from './practiceMarketDataByFirm'

export interface PracticeDayPnL {
  date: string
  pnl: number
}

export interface PracticeAccount {
  id: string
  displayName?: string
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
  /** ISO timestamp of the current session's 5:59 PM ET reset boundary. */
  lastResetAt?: string | null
}

let accountsCache: PracticeAccount[] | null = null
let marketDataCache: PracticeMarketDataSettings | null = null
let cacheOwner: string | null | undefined
let cacheGeneration = 0
let localAccountsOwner: string | null | undefined
let localMarketDataOwner: string | null | undefined
let refreshInFlight: {
  owner: string | null
  generation: number
  promise: Promise<{ error?: unknown }>
} | null = null

function syncPracticeOwner(): string | null {
  const owner = getAuthToken()
  if (owner !== cacheOwner) {
    cacheOwner = owner
    cacheGeneration += 1
    accountsCache = null
    marketDataCache = null
  }
  // Claim legacy local data for its first authenticated session. Switching
  // accounts must not expose or migrate that session's local rows to another.
  if (owner) {
    if (localAccountsOwner === undefined) localAccountsOwner = owner
    if (localMarketDataOwner === undefined) localMarketDataOwner = owner
  }
  return owner
}

function practiceSession() {
  const owner = syncPracticeOwner()
  const generation = cacheGeneration
  return { owner, generation, isCurrent: () => syncPracticeOwner() === owner && cacheGeneration === generation }
}

/** Notify UI to re-read cache (does not hit the API). */
export function notifyPracticeDataChanged(): void {
  window.dispatchEvent(new Event('practiceSettingsChanged'))
  window.dispatchEvent(new Event('practiceAccountsChanged'))
}

function loadLocalAccounts(): PracticeAccount[] {
  if (localAccountsOwner !== undefined && localAccountsOwner !== syncPracticeOwner()) return []
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
  if (localMarketDataOwner !== undefined && localMarketDataOwner !== syncPracticeOwner()) {
    return { propFirmId: 'tradesea', accountId: '', accountLabel: '' }
  }
  try {
    const raw = localStorage.getItem(PRACTICE_STORAGE_KEYS.MARKET_DATA)
    if (raw) return JSON.parse(raw) as PracticeMarketDataSettings
  } catch {
    /* ignore */
  }
  const propFirmId = normalizePracticePropFirmId(
    localStorage.getItem(PRACTICE_PROP_FIRM_KEY) || 'tradesea'
  )
  return {
    propFirmId,
    accountId: localStorage.getItem(PRACTICE_ACCOUNT_ID_KEY) || '',
    accountLabel: localStorage.getItem(PRACTICE_ACCOUNT_LABEL_KEY) || '',
  }
}

async function migrateLocalToApiIfNeeded(session: ReturnType<typeof practiceSession>): Promise<void> {
  if (!session.owner || !session.isCurrent() || localAccountsOwner !== session.owner) return
  if (localStorage.getItem(PRACTICE_STORAGE_KEYS.MIGRATED)) return
  const localAccounts = loadLocalAccounts()
  const localMd = loadLocalMarketData()
  try {
    if (localMd.accountId) {
      await practiceAPI.saveMarketData(localMd)
      if (!session.isCurrent()) return
    }
    for (const acc of localAccounts) {
      if (!session.isCurrent()) return
      const rules = acc.rules || getDefaultPracticeRules(acc.size, acc.mode)
      await practiceAPI.createAccount({
        mode: acc.mode,
        size: acc.size,
        rules,
      })
    }
    if (!session.isCurrent()) return
    localStorage.setItem(PRACTICE_STORAGE_KEYS.MIGRATED, '1')
    localStorage.removeItem(PRACTICE_STORAGE_KEYS.ACCOUNTS)
  } catch {
    /* offline or unauthenticated — keep local */
  }
}

export async function refreshPracticeFromApi(options?: { notify?: boolean; strict?: boolean }): Promise<void> {
  const session = practiceSession()
  let flight = refreshInFlight
  if (!flight || flight.owner !== session.owner || flight.generation !== session.generation) {
    const promise = (async (): Promise<{ error?: unknown }> => {
      await migrateLocalToApiIfNeeded(session)
      if (!session.isCurrent()) return { error: new DOMException('Practice session changed', 'AbortError') }
      try {
        const [mdRes, accRes] = await Promise.all([
          practiceAPI.getMarketData(),
          practiceAPI.listAccounts(),
        ])
        if (!session.isCurrent()) return { error: new DOMException('Practice session changed', 'AbortError') }
        const hasSettings = mdRes?.success === true && mdRes.settings && typeof mdRes.settings === 'object'
        const hasAccounts = accRes?.success === true && Array.isArray(accRes.accounts)
        if (hasSettings) marketDataCache = mdRes.settings
        if (hasAccounts) accountsCache = accRes.accounts
        return hasSettings && hasAccounts ? {} : { error: new Error('Practice account data could not be loaded.') }
      } catch (error) {
        if (session.isCurrent()) {
          accountsCache = loadLocalAccounts()
          marketDataCache = loadLocalMarketData()
        }
        return { error }
      }
    })()
    flight = { owner: session.owner, generation: session.generation, promise }
    refreshInFlight = flight
  }
  try {
    const result = await flight.promise
    if (!session.isCurrent()) {
      if (options?.strict) throw new DOMException('Practice session changed', 'AbortError')
      return
    }
    if (options?.strict && result.error) throw result.error
    if (options?.notify) notifyPracticeDataChanged()
  } finally {
    if (refreshInFlight === flight) refreshInFlight = null
  }
}

export function getPracticeMarketDataSettings(): PracticeMarketDataSettings {
  syncPracticeOwner()
  const raw =
    marketDataCache || {
      propFirmId: 'tradesea',
      accountId: '',
      accountLabel: '',
    }
  const propFirmId = normalizePracticePropFirmId(raw.propFirmId)
  const migrated = migratePracticeMarketDataSettings({
    ...raw,
    propFirmId,
  })
  const selection = getFirmMarketDataSelection(migrated, propFirmId)
  return {
    ...migrated,
    propFirmId,
    accountId: selection.accountId,
    accountLabel: selection.accountLabel,
  }
}

export async function savePracticeMarketDataSettings(
  settings: PracticeMarketDataSettings
): Promise<void> {
  const session = practiceSession()
  const normalized = migratePracticeMarketDataSettings({
    ...settings,
    propFirmId: normalizePracticePropFirmId(settings.propFirmId),
  })
  marketDataCache = normalized
  localMarketDataOwner = session.owner ?? undefined
  localStorage.setItem(PRACTICE_STORAGE_KEYS.MARKET_DATA, JSON.stringify(normalized))
  try {
    await practiceAPI.saveMarketData(normalized)
    if (!session.isCurrent()) return
    await refreshPracticeFromApi()
  } catch {
    /* saved locally */
  }
  if (session.isCurrent()) notifyPracticeDataChanged()
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
  syncPracticeOwner()
  return accountsCache ? [...accountsCache] : loadLocalAccounts()
}

export function getPracticeAccountById(id: string): PracticeAccount | undefined {
  return getPracticeAccounts().find((a) => a.id === id)
}

/** Apply a single account row from WS without refetching all practice data. */
export function patchPracticeAccount(account: PracticeAccount): void {
  syncPracticeOwner()
  const list = accountsCache ? [...accountsCache] : loadLocalAccounts()
  const idx = list.findIndex((a) => a.id === account.id)
  if (idx >= 0) list[idx] = account
  else list.push(account)
  accountsCache = list
  notifyPracticeDataChanged()
}

export async function createPracticeAccount(
  mode: PracticeAccountMode,
  size: PracticeAccountSize,
  rules?: Partial<PracticeAccountRules>,
  displayName?: string
): Promise<PracticeAccount> {
  const session = practiceSession()
  const res = await practiceAPI.createAccount({ mode, size, displayName, rules })
  if (session.isCurrent()) await refreshPracticeFromApi({ notify: true })
  return res.account
}

export async function updatePracticeAccount(
  id: string,
  patch: Omit<Partial<PracticeAccount>, 'rules'> & { rules?: Partial<PracticeAccountRules> }
): Promise<PracticeAccount | undefined> {
  const session = practiceSession()
  if (patch.rules || patch.displayName !== undefined) {
    const res = await practiceAPI.updateAccount(id, {
      displayName: patch.displayName,
      rules: patch.rules,
    })
    if (session.isCurrent()) await refreshPracticeFromApi()
    return res.account
  }
  const { rules: _rulesPatch, ...accountPatch } = patch
  accountsCache = getPracticeAccounts().map((a) =>
    a.id === id ? { ...a, ...accountPatch, updatedAt: new Date().toISOString() } : a
  )
  notifyPracticeDataChanged()
  return getPracticeAccountById(id)
}

export async function applyPracticeBalanceChange(
  id: string,
  _delta: number,
  _options?: { recordDay?: boolean }
): Promise<PracticeAccount | undefined> {
  const session = practiceSession()
  await refreshPracticeFromApi()
  return session.isCurrent() ? getPracticeAccountById(id) : undefined
}

export async function resetPracticeAccount(id: string): Promise<PracticeAccount | undefined> {
  const session = practiceSession()
  const res = await practiceAPI.resetAccount(id)
  if (session.isCurrent()) await refreshPracticeFromApi({ notify: true })
  return res.account
}

export async function deletePracticeAccount(id: string): Promise<void> {
  const session = practiceSession()
  await practiceAPI.deleteAccount(id)
  if (session.isCurrent()) await refreshPracticeFromApi({ notify: true })
}

export async function resetAllPracticeAccounts(): Promise<void> {
  const session = practiceSession()
  await practiceAPI.deleteAllAccounts()
  if (!session.isCurrent()) return
  accountsCache = []
  notifyPracticeDataChanged()
}

export function getPracticeAccountLabel(account: PracticeAccount): string {
  return getPracticePlanFromAccount(account).label
}

export function getPracticeAccountDisplayTitle(account: PracticeAccount): string {
  const customName = account.displayName?.trim()
  if (customName) {
    return customName
      .replace(/^LFE/i, 'AUR-E')
      .replace(/^LFF/i, 'AUR-F')
  }
  return generatePracticeAccountName(account.mode, account.size, account.id)
}

export function getPracticeAccountMetaLabel(account: PracticeAccount): string {
  let activeFirmId = getPracticeMarketDataSettings().propFirmId || account.propFirmId
  try {
    activeFirmId = localStorage.getItem('activePropFirm') || activeFirmId
  } catch {
    // Storage is optional.
  }
  const firm =
    PRACTICE_PROP_FIRMS.find((f) => f.id === activeFirmId)?.displayName || activeFirmId
  return `${firm} · ${getPracticeAccountLabel(account)}`
}

export function generatePracticeAccountName(
  mode: PracticeAccountMode,
  size: PracticeAccountSize,
  seed?: string
): string {
  const prefix = mode === 'funded' ? 'AUR-F' : 'AUR-E'
  const sizeCode = String(Math.round(size / 1000)).padStart(3, '0')
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const source = seed?.replace(/[^a-z0-9]/gi, '').toUpperCase() ?? ''
  const token = source
    ? source.slice(-8).padEnd(8, 'X')
    : Array.from(
        { length: 8 },
        () => alphabet[Math.floor(Math.random() * alphabet.length)]
      ).join('')
  let hash = 0
  for (const character of source) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  const serial = String(source ? (hash % 999) + 1 : Math.floor(Math.random() * 999) + 1).padStart(3, '0')
  return `${prefix}${sizeCode}-${token}-TEST${serial}`
}

export { computeDrawdownFloor, evaluatePracticeRules }
export type { PracticeAccountMode, PracticeAccountSize, PracticeAccountRules }
