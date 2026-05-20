import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getPracticeAccountById, type PracticeAccount } from '../../../constants/practice'
import { getPracticeTradePanelSettings } from '../../../constants/practiceTradePanelSettings'
import { getMaxContractsForSymbol } from '../../../services/practice/practiceLimits'
import { resolvePracticeProductSymbol } from '../../../services/practice/practiceSymbol'
import type { TradeseaMarketBook } from '../../../services/tradesea/tradeseaMarketBook'
import type { DomPositionContext } from '../../../services/tradesea/tradeseaPnL'
import {
  getPracticeTradePanelTab,
  savePracticeTradePanelTab,
  type PracticeTradePanelTab,
} from '../../../utils/practiceTradePanelTab'
import { PracticeDomTab } from './practicePad/tabs/PracticeDomTab'
import { PracticeOrderTab } from './practicePad/tabs/PracticeOrderTab'

import type {
  OrderSide,
  PracticeBracketOptions,
  PracticeOrderSubmitOptions,
} from './practicePad/types'

export type { OrderSide, PracticeBracketOptions, PracticeOrderSubmitOptions } from './practicePad/types'

export type PracticeTradePanelProps = {
  practiceAccountId: string
  isDark: boolean
  chartSymbol?: string
  /** Full stream id (e.g. CME:MNQ) when user picks a contract preset. */
  onChartSymbolChange?: (symbol: string) => void
  quantity: string | number
  onQuantityChange: (delta: number) => void
  onQuantityUpdate: (n: number) => void
  onQuantityInputChange: (v: string) => void
  onQuantityBlur: () => void
  onBuy: () => void
  onSell: () => void
  onJoinBid?: () => void
  onJoinAsk?: () => void
  onSubmitOrder?: (side: OrderSide, brackets: PracticeBracketOptions, order?: PracticeOrderSubmitOptions) => void
  onClose: () => void
  onReverse: () => void
  onFlatten: () => void
  markPrice?: number | null
  tickSize?: number
  getMarketBook?: () => TradeseaMarketBook | null
  subscribeMarketBook?: (onUpdate: () => void) => () => void
  ensureMarketBook?: () => void
  getChartPositionUpl?: () => number | null
  getDomPositionContext?: () => DomPositionContext | null
  hideDetach?: boolean
  onDetach?: () => void
  fullWidth?: boolean
}

function readInitialTab(accountId: string, mobileSheet: boolean): PracticeTradePanelTab {
  const saved = getPracticeTradePanelTab(accountId)
  if (mobileSheet) {
    return saved === 'dom' ? 'dom' : 'ticket'
  }
  if (saved === 'dom' || saved === 'ticket') return saved
  return 'ticket'
}

function DetachIcon({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      title="Detach quick trade"
      aria-label="Detach quick trade"
      onClick={onClick}
      className="h-10 w-8 shrink-0 inline-flex items-center justify-center bg-[#0f172a] hover:opacity-80"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15" fill="none" width="15" height="15">
        <path
          d="M13.5 13.5H10M13.5 13.5L13.5 10M13.5 13.5L9.5 9.5M10 1.5H13.5M13.5 1.5V5M13.5 1.5L9.5 5.5M5 1.5H1.5M1.5 1.5V5M1.5 1.5L5.5 5.5M1.5 10V13.5M1.5 13.5H5M1.5 13.5L5.5 9.5"
          stroke="#7F838B"
        />
      </svg>
    </button>
  )
}

function TradePanelTabBar({
  tab,
  onTab,
  onDetach,
  hideDetach,
  hideQuickTab,
}: {
  tab: PracticeTradePanelTab
  onTab: (t: PracticeTradePanelTab) => void
  onDetach?: () => void
  hideDetach?: boolean
  hideQuickTab?: boolean
}) {
  const tabs: { id: PracticeTradePanelTab; label: string }[] = [
    { id: 'quick', label: 'Quick' },
    { id: 'dom', label: 'DOM' },
    { id: 'ticket', label: 'Ticket' },
  ].filter((t) => !(hideQuickTab && t.id === 'quick'))

  const colClass =
    tabs.length === 2 ? 'grid-cols-2' : tabs.length === 1 ? 'grid-cols-1' : 'grid-cols-3'

  return (
    <div className="flex items-center gap-2 bg-[#0f172a] rounded-t-2xl border border-b-0 border-[#475569] shrink-0">
      <div className="flex w-full items-center gap-1 mx-2 border-b border-[#475569] rounded-t-2xl">
        <div className={`grid h-10 flex-1 ${colClass} overflow-hidden -mb-px bg-[#020617]`} role="tablist" aria-label="Trade panel">
          {tabs.map(({ id, label }) => {
            const active = tab === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                title={label}
                onClick={() => onTab(id)}
                className={`flex cursor-pointer items-center justify-center px-0.5 text-[11px] font-semibold leading-tight border-b bg-[#0f172a] sm:text-xs ${
                  active
                    ? 'text-[#8b5cf6] border-[#8b5cf6]'
                    : 'text-[#7d8590] border-transparent hover:text-[#adbac7]'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        {!hideDetach && onDetach && <DetachIcon onClick={onDetach} />}
      </div>
    </div>
  )
}

export default function PracticeTradePanel(props: PracticeTradePanelProps) {
  const {
    practiceAccountId,
    hideDetach,
    onDetach,
    fullWidth = false,
    markPrice,
    tickSize = 0.25,
    getMarketBook,
    subscribeMarketBook,
    ensureMarketBook,
    chartSymbol = 'CME:MNQ',
  } = props

  const mobileSheet = fullWidth && hideDetach
  const [tab, setTab] = useState<PracticeTradePanelTab>(() =>
    readInitialTab(practiceAccountId, mobileSheet)
  )
  const rootSymbol = chartSymbol.includes(':') ? chartSymbol.split(':')[1]! : chartSymbol
  const [bookTick, setBookTick] = useState(0)
  const [panelUi, setPanelUi] = useState(() => getPracticeTradePanelSettings())
  const [account, setAccount] = useState<PracticeAccount | undefined>(() =>
    getPracticeAccountById(practiceAccountId)
  )

  useEffect(() => {
    const onUiChange = () => setPanelUi(getPracticeTradePanelSettings())
    window.addEventListener('practiceTradePanelSettingsChanged', onUiChange)
    return () => window.removeEventListener('practiceTradePanelSettingsChanged', onUiChange)
  }, [])

  const persistTab = useCallback(
    (next: PracticeTradePanelTab) => {
      if (next !== 'quick') savePracticeTradePanelTab(practiceAccountId, next)
    },
    [practiceAccountId]
  )

  const handleTab = (next: PracticeTradePanelTab) => {
    if (next === 'quick' && onDetach && !hideDetach) {
      savePracticeTradePanelTab(practiceAccountId, 'quick')
      onDetach()
      return
    }
    persistTab(next)
    setTab(next)
  }

  useEffect(() => {
    if (mobileSheet && tab === 'quick') {
      const saved = getPracticeTradePanelTab(practiceAccountId)
      setTab(saved === 'dom' ? 'dom' : 'ticket')
    }
  }, [mobileSheet, tab, practiceAccountId])

  useEffect(() => {
    if (tab !== 'quick') persistTab(tab)
  }, [tab, persistTab])

  const sync = useCallback(() => setAccount(getPracticeAccountById(practiceAccountId)), [practiceAccountId])
  useEffect(() => {
    sync()
    const onChange = () => sync()
    window.addEventListener('practiceAccountsChanged', onChange)
    return () => window.removeEventListener('practiceAccountsChanged', onChange)
  }, [sync])

  const subscribeMarketBookRef = useRef(subscribeMarketBook)
  subscribeMarketBookRef.current = subscribeMarketBook

  const bookTickRafRef = useRef<number | null>(null)
  useEffect(() => {
    const sub = subscribeMarketBookRef.current
    if (!sub) return
    return sub(() => {
      if (bookTickRafRef.current != null) return
      bookTickRafRef.current = requestAnimationFrame(() => {
        bookTickRafRef.current = null
        setBookTick((n) => n + 1)
      })
    })
  }, [chartSymbol, practiceAccountId])
  useEffect(() => {
    return () => {
      if (bookTickRafRef.current != null) cancelAnimationFrame(bookTickRafRef.current)
    }
  }, [])

  useEffect(() => {
    ensureMarketBook?.()
  }, [ensureMarketBook, chartSymbol])

  useEffect(() => {
    if (tab === 'dom' || tab === 'ticket') ensureMarketBook?.()
  }, [tab, ensureMarketBook])

  const book = useMemo(() => {
    void bookTick
    return getMarketBook?.() ?? null
  }, [getMarketBook, bookTick])

  const product = account ? resolvePracticeProductSymbol(rootSymbol, null) : rootSymbol
  const maxQty = account ? getMaxContractsForSymbol(account.size, product) : 10
  const marketPrice = book?.last ?? markPrice ?? null

  return (
    <div className={`h-full flex flex-col w-full ${fullWidth ? 'max-w-none' : 'max-w-[332px]'}`}>
      <TradePanelTabBar
        tab={tab}
        onTab={handleTab}
        onDetach={onDetach}
        hideDetach={hideDetach}
        hideQuickTab={mobileSheet}
      />
      <div className="bg-[#0f172a] flex flex-1 min-h-0 flex-col px-2 pt-2 overflow-hidden rounded-b-2xl border border-t-0 border-[#475569]">
        {tab === 'ticket' && (
          <PracticeOrderTab
            props={props}
            maxQty={maxQty}
            book={book}
            marketPrice={marketPrice}
            tickSize={tickSize}
            symbolLabel={rootSymbol}
          />
        )}
        {tab === 'dom' && (
          <PracticeDomTab
            props={props}
            book={book}
            bookTick={bookTick}
            tickSize={tickSize}
            maxQty={maxQty}
            chartSymbol={chartSymbol}
            fallbackLast={marketPrice}
            panelUi={panelUi}
          />
        )}
      </div>
    </div>
  )
}

