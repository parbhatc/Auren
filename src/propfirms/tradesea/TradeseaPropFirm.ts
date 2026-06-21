/**

 * Market data provider for practice charts (sandbox + production eval feeds).

 */

import React, { ReactElement } from 'react'

import { PropFirmBase } from '../PropFirmBase'

import { propsAPI } from '../../api/props.api'

import { tradeseaAPI, TradeseaAccount } from '../../api/tradesea.api'

import { getPracticeSettings, getPracticeMarketDataSettings, normalizePracticePropFirmId } from '../../constants/practice'
import { ensureRithmicPracticeMarketDataReady } from '../rithmic/marketData'
import {
  prepareRithmicPreviewChartServices,
  teardownRithmicPreviewChartServices,
  type RithmicPreviewChartServices,
} from '../../services/rithmic/RithmicHistoryDatafeed'
import { RithmicMdsClient } from '../../services/rithmic/RithmicMdsClient'

function isPracticeRithmicChart(): boolean {
  return normalizePracticePropFirmId(getPracticeMarketDataSettings().propFirmId) === 'rithmic'
}
import { getTradeTradeseaAccount, saveTradeTradeseaAccount } from '../../constants/trade'

import { FormattedAccount } from '../../utils/marketAccountDisplay'

import AurenChart, {
  prepareTradeseaChartServices,
  teardownTradeseaChartServices,
  type TradeseaChartServices,
} from '../../services/chart/AurenChart'

import { TradeseaMdsClient } from '../../services/tradesea/TradeseaMdsClient'
import { asMdsStatusClient, type MdsStatusClient } from '../../services/mds/mdsStatusClient'
import { TradeseaDatafeed } from '../../services/tradesea/TradeseaDatafeed'
import type { AurenChartProps } from '../../types/chart'

import { TradeseaTradesClient } from '../../services/tradesea/TradeseaTradesClient'
import { TradeseaTradeHandler } from '../../services/tradesea/TradeseaTradeHandler'
import { PracticeTradeHandler } from '../../services/practice/PracticeTradeHandler'
import { getPracticeStatsData } from '../../services/practice/practiceStatsData'
import {
  getPracticeAccountById,
  getPracticeAccountDisplayTitle,
} from '../../constants/practice'
import { normalizeTradeseaStreamInstrument } from '../../services/tradesea/tradeseaInstrument'
import {
  resolveMdsSubscribeTicker,
  shouldUseDelayedMdsSymbols,
} from '../../services/tradesea/tradeseaMdsSymbols'
import { chartSymbolToProductRoot } from '../../services/tradesea/tradeseaSymbolInfo'
import { debugPracticeChartSymbol } from '../../services/tradesea/practiceChartSymbolDebug'
import {
  parseTradeseaTradesMessage,
  resolveAccountState,
  sumUnrealizedPl,
  TradeseaAccountState,
  TradeseaFullStateRow,
  TradeseaTradeOrder,
  TradeseaUserFullStates,
} from '../../services/tradesea/tradeseaTradesMessages'
import { TradeseaExecution } from '../../services/tradesea/tradeseaExecutions'
import { debugTradeseaSl, debugTradeseaUpl } from '../../services/tradesea/tradeseaDebug'
import { parseTradeseaPosition, TradeseaPosition } from '../../services/tradesea/tradeseaPositions'
import {
  buildTradeseaWsAccountKeys,
  wsRowMatchesAccount,
} from '../../services/tradesea/tradeseaWsAccountKeys'
import { TradeData } from '../../services/stats/StatsCalculator'
import {
  buildTradeseaSymbolData,
  convertTradeseaTradelensTrade,
  resolveTradelensTradesRanges,
  durationAnalysisFromDashboard,
  equityCurveFromDashboard,
  flattenTradelensTradesList,
  formatTradeseaDuration,
  parseTradeseaTradeTimestamp,
  statsFromTradelensDashboard,
  TradeseaTradelensDashboard,
  TradeseaTradelensDayBucket,
  winRateAnalysisFromDashboard,
} from '../../services/tradesea/tradeseaTradelensStats'



export class TradeseaPropFirm extends PropFirmBase {

  readonly id = 'tradesea'

  readonly displayName = 'Market data'



  token: string | null = null

  refreshToken: string | null = null

  email: string | null = null

  selectedAccountId: string | null = null

  accounts: TradeseaAccount[] = []

  formattedAccounts: FormattedAccount[] = []

  accountsFetched = false

  accountsLoading = false

  balance = 0

  rpl = 0

  upl = 0

  private hasOpenPositions(): boolean {
    return this.positions.some((p) => Math.abs(p.qty ?? 0) > 0)
  }

  /** WS may send 0; candle-driven calc keeps UP&L live between stream ticks. */
  setUnrealizedPl(value: number, options?: { fromStream?: boolean }): void {
    if (!Number.isFinite(value)) return
    if (options?.fromStream && value === 0 && this.hasOpenPositions()) {
      debugTradeseaUpl('setUpl:blocked-stream-zero', {
        force: true,
        upl: this.upl,
        blockedStreamZero: true,
        positionsCount: this.positions.length,
        positions: this.positions,
      })
      return
    }
    if (this.upl === value) {
      debugTradeseaUpl('setUpl:skip-same', {
        upl: value,
        skippedSameUpl: true,
        fromStream: Boolean(options?.fromStream),
      })
      return
    }
    const prev = this.upl
    this.upl = value
    debugTradeseaUpl('setUpl:applied', {
      force: true,
      upl: value,
      total: value,
      fromStream: Boolean(options?.fromStream),
      positionsCount: this.positions.length,
      note: `prev=${prev}`,
    })
    this.notifyAccountInfoChanged()
  }

  /** Live equity for the account bar (WS balance + open UP&L). */
  getLiveBalance(): number {
    return this.balance + this.upl
  }

  notifyAccountInfoChanged(): void {
    this.onDataReady?.()
  }

  /** Authoritative open positions from trades WS (`positions[]` on snapshot/updates). */
  private replacePositionsFromSocket(positions: unknown[]): void {
    this.positions = positions
      .map((row) => parseTradeseaPosition(row))
      .filter(
        (p): p is TradeseaPosition => Boolean(p?.id) && Math.abs(p.qty ?? 0) > 0
      )
    debugTradeseaUpl('ws:positions', {
      force: true,
      positionsCount: this.positions.length,
      positions: this.positions,
    })
  }

  private syncChartFromPositions(): void {
    if (this.practiceMode) return
    const handler = this.tradeHandler
    handler?.scheduleStreamSync()
  }

  private syncChartBracketsFromOrders(): void {
    if (this.practiceMode) return
    const handler = this.tradeHandler
    handler?.syncBracketsFromOrders()
    handler?.refreshUnrealizedFromLastBar()
  }

  private wsAccountKeysForMessage(data?: {
    orders?: TradeseaTradeOrder[]
    positions?: unknown[]
  }): string[] {
    const account = this.accounts.find((a) => a.id === this.selectedAccountId)
    return buildTradeseaWsAccountKeys(account, {
      orders: data?.orders ?? this.orders,
      positions: data?.positions ?? this.positions,
    })
  }

  chartServices: TradeseaChartServices | RithmicPreviewChartServices | null = null

  /** Single shared instances — avoids duplicate WebSockets on parallel connect */
  mdsClient = new TradeseaMdsClient()

  rithmicMdsClient = new RithmicMdsClient()

  tradesClient = new TradeseaTradesClient()

  private tradeHandler: TradeseaTradeHandler | null = null

  private connectStreamsPromise: Promise<void> | null = null

  private lastBootstrapKey = ''

  streamsReady = false

  streamsLoading = false

  streamsError: string | null = null

  private tradesMessageUnsub: (() => void) | null = null

  private onDataReady?: () => void

  private onChartSymbolChangeListener: ((chartSymbol: string) => void) | null = null

  orders: TradeseaTradeOrder[] = []

  positions: TradeseaPosition[] = []

  executions: TradeseaExecution[] = []

  chartSymbol = 'NQ'

  chartResolution = '1'

  /** Practice route: one account from settings, MDS/UDF only (no trades user-data WS). */
  practiceMode = false

  private practiceAccountId: string | null = null

  private practiceAccountLabel: string | null = null

  /** Simulated eval/funded account id (local), when trading on /practice/trade/:id */
  private practiceSimAccountId: string | null = null

  /** Practice symbol comes from TradingView load_last_chart, not React defaults. */
  private chartSymbolSyncedFromTv = false

  practiceTradeHandler: PracticeTradeHandler | null = null

  setPracticeMode(
    enabled: boolean,
    marketAccountId?: string,
    marketLabel?: string,
    simAccountId?: string
  ): void {
    this.practiceMode = enabled
    this.practiceAccountId = enabled ? String(marketAccountId || '').trim() || null : null
    this.practiceAccountLabel = enabled ? String(marketLabel || '').trim() || null : null
    this.practiceSimAccountId = enabled ? String(simAccountId || '').trim() || null : null
    this.chartSymbolSyncedFromTv = false
    debugPracticeChartSymbol('TradeseaPropFirm.setPracticeMode', {
      enabled,
      marketAccountId,
      simAccountId,
      chartSymbol: this.chartSymbol,
    }, { force: true })
    if (enabled) {
      this.accountsFetched = false
      this.formattedAccounts = []
      this.accounts = []
      this.selectedAccountId = this.practiceAccountId
    } else {
      this.practiceTradeHandler = null
      this.practiceSimAccountId = null
    }
  }

  setOnDataReady(callback: () => void): void {

    this.onDataReady = callback

  }



  async validate(): Promise<{ success: boolean; type?: string; message?: string }> {

    const response = await propsAPI.getPropFirm('tradesea')

    const propFirm = response.propFirm



    if (!response.success || !propFirm?.token) {

      return {

        success: false,

        type: 'no_prop_firm',

        message: 'Market data is not connected. Connect in Settings → Market data.',

      }

    }



    this.token = propFirm.token

    this.refreshToken = propFirm.sessionId || null

    this.email = propFirm.credentials?.email || null



    try {

      const status = await tradeseaAPI.getConnectionStatus()

      if (status.connected) {

        return { success: true }

      }

      return {

        success: false,

        type: 'token_expired',

        message: 'Market data session expired. Reconnect in Settings → Market data.',

      }

    } catch {

      return {

        success: false,

        type: 'validation_error',

        message: 'Could not verify market data connection.',

      }

    }

  }



  async onValidateSuccess(options?: { skipStreams?: boolean }): Promise<void> {
    if (this.practiceMode) {
      if (this.practiceSimAccountId) {
        await this.loadPracticeSimTradeAccount(options)
      } else {
        await this.loadPracticeAccount(options)
      }
      return
    }

    if (this.accountsFetched && this.formattedAccounts.length > 0) {

      if (!options?.skipStreams) {
        await this.connectStreamsForSelectedAccount()
      }

      this.onDataReady?.()

      return

    }



    if (this.accountsLoading) {

      let waitCount = 0

      while (this.accountsLoading && waitCount < 50) {

        await new Promise((resolve) => setTimeout(resolve, 100))

        waitCount++

      }

      if (this.accountsFetched) {

        if (!options?.skipStreams) {
          await this.connectStreamsForSelectedAccount()
        }

        this.onDataReady?.()

        return

      }

    }



    this.accountsLoading = true

    try {

      const result = await tradeseaAPI.getAccounts()

      if (!result.connected || !result.accounts?.length) {

        const error: Error & { type?: string } = new Error(

          result.message ||

            'No supported market data accounts found. Connect in Settings → Market data.'

        )

        error.type = 'no_accounts'

        throw error

      }



      this.accounts = result.accounts

      this.formattedAccounts = result.accounts.map((account, index) => ({

        accountId: index + 1,

        displayName: account.label,

        templateName: account.propFirmDisplayName || account.propFirm || 'Market data',

        accountName: account.name || account.externalAccountId || account.id,

        isIneligible: false,

        isCombine: false,

        isExpress: false,

        account: {

          id: account.id,

          propFirm: account.propFirm,

          propFirmDisplayName: account.propFirmDisplayName,

          accountType: account.accountType,

          userId: account.userId,

          externalAccountId: account.externalAccountId,

        },

      }))



      const tradeAccount = getTradeTradeseaAccount()

      let accountToSelect = tradeAccount.accountId

        ? this.formattedAccounts.find((a) => a.account?.id === tradeAccount.accountId)

        : undefined



      if (!accountToSelect && this.selectedAccountId) {

        accountToSelect = this.formattedAccounts.find(

          (a) => a.account?.id === this.selectedAccountId

        )

      }



      if (!accountToSelect && result.defaultAccountId) {

        accountToSelect = this.formattedAccounts.find(

          (a) => a.account?.id === result.defaultAccountId

        )

      }



      if (!accountToSelect) {

        accountToSelect = this.formattedAccounts[0]

      }



      if (accountToSelect?.account?.id) {

        this.selectedAccountId = accountToSelect.account.id

        saveTradeTradeseaAccount(accountToSelect.account.id, accountToSelect.displayName)

      }



      this.accountsFetched = true

      await this.onSelectedAccountChanged(options)

      this.onDataReady?.()

    } finally {

      this.accountsLoading = false

    }

  }

  private async loadPracticeSimTradeAccount(options?: { skipStreams?: boolean }): Promise<void> {
    const simId = this.practiceSimAccountId
    if (!simId) {
      await this.loadPracticeAccount(options)
      return
    }

    const sim = getPracticeAccountById(simId)
    if (!sim) {
      const error: Error & { type?: string } = new Error('Practice account not found.')
      error.type = 'no_accounts'
      throw error
    }
    if (sim.status !== 'active' && !options?.skipStreams) {
      const error: Error & { type?: string } = new Error('This practice account is not active (passed or blown).')
      error.type = 'no_accounts'
      throw error
    }

    const settings = getPracticeSettings()
    let marketId =
      this.practiceAccountId || settings.accountId || sim.marketDataAccountId || ''

    this.accountsLoading = true
    try {
      if (isPracticeRithmicChart()) {
        const ready = await ensureRithmicPracticeMarketDataReady()
        if (ready.ok === false) {
          throw new Error(ready.message || 'Rithmic market data is not connected.')
        }
        marketId = marketId || ready.accountId
        this.accounts = [{ id: marketId, label: ready.label } as TradeseaAccount]
        this.selectedAccountId = marketId
      } else {
        if (!marketId) {
          const error: Error & { type?: string } = new Error(
            'No market data account selected. Choose one on the Practice hub.'
          )
          error.type = 'no_accounts'
          throw error
        }
        const result = await tradeseaAPI.getAccounts()
        if (!result.connected) {
          throw new Error(result.message || 'Market data not connected')
        }
        const market = result.accounts?.find((a) => a.id === marketId)
        if (!market) {
          throw new Error('Market data account not found. Update it on the Practice hub.')
        }
        this.accounts = [market]
        this.selectedAccountId = market.id
      }
      const displayName = getPracticeAccountDisplayTitle(sim)
      this.formattedAccounts = [
        {
          accountId: 1,
          displayName,
          templateName: 'Practice',
          accountName: displayName,
          isIneligible: false,
          isCombine: false,
          isExpress: false,
          account: { id: sim.id, propFirm: sim.propFirmId },
        },
      ]
      this.accountsFetched = true
      this.practiceTradeHandler =
        sim.status === 'active' && !isPracticeRithmicChart()
          ? new PracticeTradeHandler(this, sim.id)
          : null
      if (isPracticeRithmicChart()) {
        this.tradeHandler = null
      }
      await this.onSelectedAccountChanged(options)
      this.onDataReady?.()
    } finally {
      this.accountsLoading = false
    }
  }

  private async loadPracticeAccount(options?: { skipStreams?: boolean }): Promise<void> {
    const settings = getPracticeSettings()
    const targetId = this.practiceAccountId || settings.accountId
    const targetLabel = this.practiceAccountLabel || settings.accountLabel

    if (!targetId) {
      const error: Error & { type?: string } = new Error(
        'No practice account selected. Choose an account in Settings → Practice.'
      )
      error.type = 'no_accounts'
      throw error
    }

    this.accountsLoading = true
    try {
      const result = await tradeseaAPI.getAccounts()
      if (!result.connected || !result.accounts?.length) {
        const error: Error & { type?: string } = new Error(
          result.message || 'Market data is not connected. Connect in Settings → Market data.'
        )
        error.type = 'no_accounts'
        throw error
      }

      const account = result.accounts.find((a) => a.id === targetId)
      if (!account) {
        const error: Error & { type?: string } = new Error(
          'Practice account not found. Refresh accounts in Settings → Practice.'
        )
        error.type = 'no_accounts'
        throw error
      }

      const displayName = account.label || targetLabel || account.id
      this.accounts = [account]
      this.formattedAccounts = [
        {
          accountId: 1,
          displayName,
          templateName: account.propFirmDisplayName || account.propFirm || 'Market data',
          accountName: account.name || account.externalAccountId || account.id,
          isIneligible: false,
          isCombine: false,
          isExpress: false,
          account: {
            id: account.id,
            propFirm: account.propFirm,
            propFirmDisplayName: account.propFirmDisplayName,
            accountType: account.accountType,
            userId: account.userId,
            externalAccountId: account.externalAccountId,
          },
        },
      ]
      this.selectedAccountId = account.id
      this.accountsFetched = true
      await this.onSelectedAccountChanged(options)
      this.onDataReady?.()
    } finally {
      this.accountsLoading = false
    }
  }

  async connectStreamsForSelectedAccount(): Promise<void> {
    if (!this.selectedAccountId) return
    if (this.connectStreamsPromise) {
      return this.connectStreamsPromise
    }

    this.connectStreamsPromise = this.runConnectStreamsForSelectedAccount()
    try {
      await this.connectStreamsPromise
    } finally {
      this.connectStreamsPromise = null
    }
  }

  private async runConnectStreamsForSelectedAccount(): Promise<void> {
    this.streamsLoading = true
    this.streamsError = null
    this.streamsReady = false

    try {

      const switchingAccount =
        this.chartServices && this.chartServices.accountId !== this.selectedAccountId

      if (switchingAccount) {
        if (this.chartServices && 'mds' in this.chartServices && this.chartServices.mds) {
          if ('trades' in this.chartServices) {
            teardownTradeseaChartServices(this.chartServices)
          } else {
            teardownRithmicPreviewChartServices(this.chartServices as RithmicPreviewChartServices)
          }
        }
        this.chartServices = null
      }

      if (this.practiceMode && isPracticeRithmicChart()) {
        this.chartServices = prepareRithmicPreviewChartServices(this.selectedAccountId, {
          mds: this.rithmicMdsClient,
          bootstrapSymbol: this.chartSymbol || 'NQ',
          bootstrapResolution: this.chartResolution,
        })
      } else {
        this.chartServices = await prepareTradeseaChartServices(
          this.selectedAccountId,
          {
            mds: this.mdsClient,
            trades: this.tradesClient,
            accountId:
              this.chartServices && 'mds' in this.chartServices
                ? this.chartServices.accountId
                : undefined,
            datafeed:
              this.chartServices && 'trades' in this.chartServices
                ? (this.chartServices.datafeed as TradeseaDatafeed)
                : undefined,
            bootstrapSymbol: this.chartSymbol || (this.practiceMode ? 'NQ' : undefined),
            bootstrapResolution: this.chartResolution,
          },
          { connectTrades: !this.practiceMode }
        )
      }
      debugPracticeChartSymbol('TradeseaPropFirm.connectStreams', {
        practiceMode: this.practiceMode,
        bootstrapSymbol: this.chartSymbol,
        chartSymbolSyncedFromTv: this.chartSymbolSyncedFromTv,
        accountId: this.selectedAccountId,
      }, { force: true })

      const handler = this.getHandler()
      if (handler) {
        this.chartServices.datafeed?.setTradeHandler(handler as never)
      } else {
        this.chartServices.datafeed?.setTradeHandler(null)
      }

      this.streamsReady = true

      if (this.tradesMessageUnsub) {

        this.tradesMessageUnsub()

        this.tradesMessageUnsub = null

      }

      const account = this.accounts.find((a) => a.id === this.selectedAccountId)

      const hasTradesWs =
        !this.practiceMode &&
        this.chartServices &&
        'streamConfig' in this.chartServices &&
        'tradesReadOrigin' in this.chartServices.streamConfig &&
        Boolean(this.chartServices.streamConfig.tradesReadOrigin)

      if (account && hasTradesWs && this.tradesClient) {

        this.tradesMessageUnsub = this.tradesClient.onMessage((msg) => {

          this.handleTradesMessage(msg)

        })

      } else if (this.tradesClient) {

        this.tradesClient.disconnect()

      }

    } catch (err: unknown) {

      this.streamsError =

        err instanceof Error ? err.message : 'Failed to connect market data'

      console.error('[TradeseaPropFirm] stream connect failed:', err)

    } finally {

      this.streamsLoading = false

      this.onDataReady?.()

    }

  }



  private handleTradesMessage(msg: unknown): void {

    const parsed = parseTradeseaTradesMessage(msg)

    if (!parsed?.data) return

    const event = parsed.event.toLowerCase()

    const data = parsed.data

    const accountKeys = this.wsAccountKeysForMessage(data)

    if (event === 'unifiedsnapshot') {
      if (Array.isArray(data.orders)) {
        this.orders = data.orders
      }

      if (Array.isArray(data.positions)) {
        this.replacePositionsFromSocket(data.positions)
      }

      if (data.userFullStates) {
        this.applyUserFullStates(data.userFullStates, accountKeys, data.positions)
      } else if (Array.isArray(data.fullStates)) {
        this.applyFullStateUpdates(data.fullStates, accountKeys, data.positions)
      }

      if (!this.practiceMode) {
        if (this.positions.length > 0) {
          this.syncChartFromPositions()
        } else {
          this.tradeHandler?.syncFromStream()
        }
      }
      return
    }

    if (event === 'orderupdates' && Array.isArray(data.orders)) {
      const slUpdates = data.orders.filter((o) => {
        const type = String(o.type || '').toLowerCase()
        return (
          o.parentType === 'position' &&
          (type === 'stop' || type === 'stoplimit')
        )
      })
      if (slUpdates.length) {
        debugTradeseaSl('ws:orderUpdates', {
          orders: slUpdates.map((o) => ({
            id: o.id,
            status: o.status,
            stopPrice: o.stopPrice,
            parentId: o.parentId,
          })),
        })
      }
      this.mergeOrders(data.orders)
      this.syncChartBracketsFromOrders()
      return
    }

    if (event === 'positionupdates') {
      if (Array.isArray(data.positions)) {
        this.replacePositionsFromSocket(data.positions)
        this.setUnrealizedPl(sumUnrealizedPl(data.positions), { fromStream: true })
      }

      if (data.userFullStates) {
        this.applyUserFullStates(data.userFullStates, accountKeys, data.positions)
      }

      this.syncChartFromPositions()
      return
    }

    if (event === 'fullstateupdates') {
      if (Array.isArray(data.fullStates)) {
        this.applyFullStateUpdates(data.fullStates, accountKeys, data.positions)
      }
      if (data.userFullStates) {
        this.applyUserFullStates(data.userFullStates, accountKeys, data.positions)
      }
      this.notifyAccountInfoChanged()
      return
    }
  }

  private applyAccountState(
    state: TradeseaAccountState | null | undefined,
    positions?: unknown[]
  ): void {
    if (!state) return

    if (typeof state.balance === 'number') {
      this.balance = state.balance
    }

    if (typeof state.realizedPl === 'number') {
      this.rpl = state.realizedPl
    }

    if (typeof state.unrealizedPl === 'number') {
      this.setUnrealizedPl(state.unrealizedPl, { fromStream: true })
    } else if (positions) {
      this.setUnrealizedPl(sumUnrealizedPl(positions), { fromStream: true })
    }
  }

  private applyFullStateUpdates(
    fullStates: TradeseaFullStateRow[],
    accountKeys: string[],
    positions?: unknown[]
  ): void {
    for (const row of fullStates) {
      if (wsRowMatchesAccount(row.accountId, accountKeys)) {
        this.applyAccountState(row, positions)
        return
      }
    }

    if (fullStates.length === 1 && accountKeys.length > 0) {
      this.applyAccountState(fullStates[0], positions)
    }
  }

  private applyUserFullStates(
    userFullStates: TradeseaUserFullStates | undefined,
    accountKeys: string[],
    positions?: unknown[]
  ): void {
    const state = resolveAccountState(userFullStates, accountKeys)
    this.applyAccountState(state, positions)
  }

  private mergeOrders(incoming: TradeseaTradeOrder[]): void {

    const byId = new Map(this.orders.map((o) => [o.id, o]))

    for (const order of incoming) {

      if (order?.id) {

        byId.set(order.id, { ...byId.get(order.id), ...order })

      }

    }

    this.orders = Array.from(byId.values())

  }



  async onSelectedAccountChanged(options?: { skipStreams?: boolean }): Promise<void> {

    const selected = this.accounts.find((a) => a.id === this.selectedAccountId)

    if (selected && !this.practiceMode) {
      saveTradeTradeseaAccount(selected.id, selected.label)
    }

    if (this.accountsFetched && !options?.skipStreams) {

      await this.connectStreamsForSelectedAccount()

    }

  }



  getAccountInfo(): { balance: number; mll?: number; rpl: number; upl: number } {
    if (this.practiceMode && this.practiceTradeHandler) {
      return this.practiceTradeHandler.getAccountInfo()
    }
    if (this.practiceMode) {
      return { balance: 0, mll: undefined, rpl: 0, upl: 0 }
    }
    return {
      balance: this.getLiveBalance(),
      mll: undefined,
      rpl: this.rpl,
      upl: this.upl,
    }
  }



  setOnChartSymbolChange(listener: ((chartSymbol: string) => void) | null): void {
    this.onChartSymbolChangeListener = listener
  }

  /** Full MDS reconnect with bootstrap + chart/book subs (fixes ping-only socket). */
  reconnectMarketData(): void {
    const svc = this.chartServices
    if (!svc?.mds) return
    this.lastBootstrapKey = ''
    const df = svc.datafeed
    const offOpen = asMdsStatusClient(svc.mds as MdsStatusClient).on('open', () => {
      offOpen()
      df?.refreshMdsSubscriptions?.()
    })
    svc.mds.reconnect()
  }

  private applyMdsBootstrapForChartSymbol(): void {
    const bootstrapKey = `${this.chartSymbol}__${this.chartResolution}`
    if (isPracticeRithmicChart()) {
      const svc = this.chartServices as RithmicPreviewChartServices | null
      if (!svc?.mds || bootstrapKey === this.lastBootstrapKey) {
        return
      }
      this.lastBootstrapKey = bootstrapKey
      const root = this.chartSymbol || 'MNQ'
      svc.mds.subscribe(`CME:${root}`, this.chartResolution)
      svc.datafeed.refreshMdsSubscriptions?.()
      debugPracticeChartSymbol('TradeseaPropFirm.applyRithmicMdsBootstrap', {
        chartSymbol: this.chartSymbol,
        bootstrapKey,
      }, { force: true })
      return
    }
    if (
      !this.chartServices ||
      !('mds' in this.chartServices) ||
      !this.chartServices.mds ||
      bootstrapKey === this.lastBootstrapKey
    ) {
      return
    }
    this.lastBootstrapKey = bootstrapKey
    const tradeseaSvc = this.chartServices as TradeseaChartServices
    const useDelayedMd = shouldUseDelayedMdsSymbols(tradeseaSvc.streamConfig)
    const ticker = resolveMdsSubscribeTicker(this.chartSymbol, useDelayedMd)
    tradeseaSvc.mds.setBootstrap(
      {
        symbols: [ticker],
        resolution: this.chartResolution,
      },
      { wireUnsub: true }
    )
    debugPracticeChartSymbol('TradeseaPropFirm.applyMdsBootstrap', {
      chartSymbol: this.chartSymbol,
      ticker,
      bootstrapKey,
      practiceMode: this.practiceMode,
    }, { force: true })
  }

  private syncChartSymbolFromTv(chartSym: string): void {
    const root = chartSymbolToProductRoot(chartSym)
    if (!root) return
    const prev = this.chartSymbol
    if (this.practiceMode) {
      this.chartSymbolSyncedFromTv = true
    }
    debugPracticeChartSymbol('TradeseaPropFirm.syncChartSymbolFromTv', {
      chartSym,
      root,
      prev,
      chartSymbolSyncedFromTv: this.chartSymbolSyncedFromTv,
      willChange: prev !== root,
    }, { force: prev !== root })
    if (this.chartSymbol === root) {
      this.onChartSymbolChangeListener?.(chartSym)
      return
    }
    this.chartSymbol = root
    this.applyMdsBootstrapForChartSymbol()
    const df = this.chartServices?.datafeed
    if (df?.ensureMarketBookSubscription && this.chartServices) {
      const useDelayedMd = shouldUseDelayedMdsSymbols(this.chartServices.streamConfig)
      const stream =
        df.resolveStreamInstrument?.(`CME:${root}`) ??
        resolveMdsSubscribeTicker(`CME:${root}`, useDelayedMd)
      df.ensureMarketBookSubscription(stream)
    }
    this.onChartSymbolChangeListener?.(chartSym)
  }

  getRenderChart(symbol: string, timeframe: string, isDark: boolean): ReactElement | null {
    this.chartResolution = timeframe || this.chartResolution

    if (this.practiceMode) {
      // Bootstrap MDS with default NQ until TV restores a symbol from load_last_chart.
      this.applyMdsBootstrapForChartSymbol()
    } else {
      this.chartSymbol = symbol || this.chartSymbol
      this.applyMdsBootstrapForChartSymbol()
    }

    const chartSymbolProp = this.practiceMode
      ? this.chartSymbolSyncedFromTv
        ? this.chartSymbol
        : ''
      : symbol || this.chartSymbol

    debugPracticeChartSymbol('TradeseaPropFirm.getRenderChart', {
      reactSymbolArg: symbol,
      chartSymbolProp,
      firmChartSymbol: this.chartSymbol,
      practiceMode: this.practiceMode,
      chartSymbolSyncedFromTv: this.chartSymbolSyncedFromTv,
      practiceSimAccountId: this.practiceSimAccountId,
    })

    if (this.accountsLoading || this.streamsLoading) {

      return React.createElement(

        'div',

        {

          className: 'flex items-center justify-center h-full text-slate-400 text-sm',

        },

        'Connecting market data…'

      )

    }



    if (this.streamsError) {

      return React.createElement(

        'div',

        { className: 'flex items-center justify-center h-full text-red-400 text-sm px-4 text-center' },

        this.streamsError

      )

    }



    if (!this.streamsReady || !this.chartServices) {

      return React.createElement(

        'div',

        {

          className: 'flex items-center justify-center h-full text-slate-400 text-sm',

        },

        'Preparing chart…'

      )

    }



    return React.createElement(AurenChart, {
      key: this.practiceSimAccountId || this.selectedAccountId || 'auren-chart',
      symbol: chartSymbolProp,
      timeframe,
      isDark,
      accountId: this.selectedAccountId || undefined,
      practiceAccountId: this.practiceSimAccountId || undefined,
      tradeseaServices: this.chartServices,
      tradeseaTradeHandler: this.getHandler() ?? undefined,
      onSymbolChange: (chartSym: string) => this.syncChartSymbolFromTv(chartSym),
    } as AurenChartProps)

  }



  getHandler(): TradeseaTradeHandler | PracticeTradeHandler | null {
    if (this.practiceMode && isPracticeRithmicChart()) {
      return null
    }
    if (this.practiceMode && this.practiceTradeHandler) {
      return this.practiceTradeHandler
    }
    if (!this.tradeHandler) {
      this.tradeHandler = new TradeseaTradeHandler(this)
    }
    return this.tradeHandler
  }



  async getStats(
    dateRange?: { startDate: string; endDate: string },
    skipProfitFactorAPI?: boolean
  ): Promise<{
    trades: TradeData[]
    equityCurveData: Array<{ date: string; value: number }>
    stats: any
    calculateTradePnL: (trade: any) => number
    parseTradeTimestamp: (timestamp: any) => Date | null
    formatDuration: (seconds: number) => string
    initialBalance?: number
    symbolData?: Record<string, { tickSize: number; tickValue: number; totalFees?: number }>
    tradeseaDashboard?: unknown
    durationAnalysisData?: Array<{ label: string; rate?: number; count?: number }>
    winRateAnalysisData?: Array<{ label: string; rate: number }>
    tradeseaCalendarDays?: unknown
  } | null> {
    if (this.practiceSimAccountId) {
      return getPracticeStatsData(this.practiceSimAccountId, dateRange)
    }

    if (!this.selectedAccountId) return null

    const accountId = this.selectedAccountId
    const timezoneOffset = new Date().getTimezoneOffset()
    const from = String(dateRange?.startDate || '').trim()
    const to = String(dateRange?.endDate || '').trim()
    const hasDateRange = Boolean(from && to)
    // Calendar tab passes skipProfitFactorAPI=true + month range (see StatsRenderer).
    const isCalendarMode = Boolean(skipProfitFactorAPI && hasDateRange)
    const shouldFetchTrades = hasDateRange

    try {
      const dashboardBody = {
        accountId,
        timezoneOffset,
        ...(isCalendarMode ? { from, to } : {}),
      }

      const [dashboardSettled, calendarSettled, tradesSettled] = await Promise.allSettled([
        tradeseaAPI.getTradelensDashboard(dashboardBody),
        isCalendarMode
          ? tradeseaAPI.getTradelensCalendar({ accountId, timezoneOffset, from, to })
          : Promise.resolve({ success: false, s: 'skipped' as const }),
        shouldFetchTrades
          ? this.fetchTradelensTradesMerged(accountId, from, to, timezoneOffset)
          : Promise.resolve({ success: false, s: 'skipped' as const, tradesList: [] }),
      ])

      const dashboardRes =
        dashboardSettled.status === 'fulfilled'
          ? dashboardSettled.value
          : { success: false, s: 'error' as const }
      const calendarRes =
        calendarSettled.status === 'fulfilled'
          ? calendarSettled.value
          : { success: false, s: 'error' as const }
      const tradesMerged =
        tradesSettled.status === 'fulfilled'
          ? tradesSettled.value
          : { s: 'error' as const, tradesList: [] as TradeseaTradelensDayBucket[] }

      if (dashboardRes.s !== 'success') {
        console.warn('[TradeseaPropFirm] TradeLens dashboard failed:', dashboardRes.error)
      }
      if (isCalendarMode && calendarRes.s !== 'success' && calendarRes.s !== 'skipped') {
        const calErr = calendarRes as { error?: string }
        console.warn('[TradeseaPropFirm] TradeLens calendar failed:', calErr.error)
      }
      if (shouldFetchTrades && tradesMerged.s !== 'success' && tradesMerged.s !== 'skipped') {
        console.warn('[TradeseaPropFirm] TradeLens trades failed:', tradesMerged.error)
      }

      const dashboard =
        dashboardRes.s === 'success'
          ? (dashboardRes.d as TradeseaTradelensDashboard)
          : null

      const calendarDays =
        calendarRes.s === 'success' && Array.isArray(calendarRes.d?.pnlAndTradeCountCalendar)
          ? calendarRes.d.pnlAndTradeCountCalendar
          : dashboard?.pnlAndTradeCountCalendar

      let convertedTrades: TradeData[] = []
      if (tradesMerged.s === 'success' && tradesMerged.tradesList.length > 0) {
        convertedTrades = flattenTradelensTradesList(tradesMerged.tradesList).map(
          convertTradeseaTradelensTrade
        )
      }
      const stats = statsFromTradelensDashboard(dashboard)

      let equityCurveData = equityCurveFromDashboard(dashboard?.dailyNetCumulativePnl)
      if (equityCurveData.length === 0) {
        equityCurveData = equityCurveFromDashboard(dashboard?.dailyAccountBalance)
      }

      const calculateTradePnL = (trade: TradeData): number => {
        if (trade.pnl !== undefined && Number.isFinite(Number(trade.pnl))) {
          return Number(trade.pnl)
        }
        return 0
      }

      const formatDuration = (seconds: number): string => formatTradeseaDuration(seconds)

      const symbolData = buildTradeseaSymbolData(convertedTrades)

      return {
        trades: convertedTrades,
        equityCurveData:
          equityCurveData.length > 0
            ? equityCurveData
            : [{ date: new Date().toISOString().split('T')[0], value: 0 }],
        stats,
        calculateTradePnL,
        parseTradeTimestamp: parseTradeseaTradeTimestamp,
        formatDuration,
        symbolData,
        tradeseaDashboard: dashboard,
        durationAnalysisData: durationAnalysisFromDashboard(dashboard),
        winRateAnalysisData: winRateAnalysisFromDashboard(dashboard),
        tradeseaCalendarDays: calendarDays,
      }
    } catch (error) {
      console.error('[TradeseaPropFirm] getStats failed:', error)
      return null
    }
  }

  /** Fetch trades for a date span using 7-day TradeLens chunks, merged by day bucket. */
  private async fetchTradelensTradesMerged(
    accountId: string,
    from: string,
    to: string,
    timezoneOffset: number
  ): Promise<{
    s: 'success' | 'error' | 'skipped'
    tradesList: TradeseaTradelensDayBucket[]
    error?: unknown
  }> {
    const ranges = resolveTradelensTradesRanges(from, to)
    if (ranges.length === 0) {
      return { s: 'skipped', tradesList: [] }
    }

    const settled = await Promise.allSettled(
      ranges.map((range) =>
        tradeseaAPI.getTradelensTrades({
          accountId,
          timezoneOffset,
          from: range.from,
          to: range.to,
        })
      )
    )

    const byDate = new Map<string, TradeseaTradelensDayBucket>()
    let hadSuccess = false
    let lastError: unknown

    for (const result of settled) {
      if (result.status !== 'fulfilled') continue
      const res = result.value
      if (res.s !== 'success' || !Array.isArray(res.d?.tradesList)) {
        lastError = res.error ?? res
        continue
      }
      hadSuccess = true
      for (const bucket of res.d.tradesList as TradeseaTradelensDayBucket[]) {
        const key = String(bucket.date || '').split('T')[0]
        if (!key) continue
        const existing = byDate.get(key)
        if (!existing) {
          byDate.set(key, {
            ...bucket,
            trades: Array.isArray(bucket.trades) ? [...bucket.trades] : [],
          })
          continue
        }
        if (Array.isArray(bucket.trades)) {
          existing.trades = [...(existing.trades || []), ...bucket.trades]
        }
        existing.netPnl = (Number(existing.netPnl) || 0) + (Number(bucket.netPnl) || 0)
        existing.totalTrades =
          (Number(existing.totalTrades) || 0) + (Number(bucket.totalTrades) || 0)
      }
    }

    if (!hadSuccess) {
      return { s: 'error', tradesList: [], error: lastError }
    }

    const tradesList = [...byDate.values()].sort((a, b) =>
      String(a.date || '').localeCompare(String(b.date || ''))
    )
    return { s: 'success', tradesList }
  }

  /** Fetch real closed trades for a single calendar day (TradeLens v2/trades). */
  async fetchTradelensDayTrades(date: string): Promise<TradeData[]> {
    if (!this.selectedAccountId) return []
    const dateStr = String(date || '')
      .trim()
      .split('T')[0]
    if (!dateStr) return []

    try {
      const res = await tradeseaAPI.getTradelensTrades({
        accountId: this.selectedAccountId,
        from: dateStr,
        to: dateStr,
        timezoneOffset: new Date().getTimezoneOffset(),
      })
      if (res.s !== 'success' || !Array.isArray(res.d?.tradesList)) return []
      return flattenTradelensTradesList(res.d.tradesList as TradeseaTradelensDayBucket[]).map(
        convertTradeseaTradelensTrade
      )
    } catch (error) {
      console.warn('[TradeseaPropFirm] fetchTradelensDayTrades failed:', error)
      return []
    }
  }

  cleanup(): void {
    if (this.tradesMessageUnsub) {
      this.tradesMessageUnsub()
      this.tradesMessageUnsub = null
    }

    if (this.chartServices && 'mds' in this.chartServices && this.chartServices.mds) {
      if ('trades' in this.chartServices) {
        teardownTradeseaChartServices(this.chartServices)
      } else {
        teardownRithmicPreviewChartServices(this.chartServices as RithmicPreviewChartServices)
      }
    }
    this.chartServices = null
    this.mdsClient.disconnect()
    this.rithmicMdsClient.disconnect()
    this.tradesClient.disconnect()
    this.lastBootstrapKey = ''
    this.streamsReady = false
    this.streamsLoading = false
    this.streamsError = null
    this.practiceMode = false
    this.practiceAccountId = null
    this.practiceAccountLabel = null
    this.practiceSimAccountId = null
    this.practiceTradeHandler = null
  }

}


