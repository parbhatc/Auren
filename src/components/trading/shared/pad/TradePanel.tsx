import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getPracticeAccountById, type PracticeAccount } from '../../../../constants/practice'
import { getTradePanelSettings } from '../../../../constants/tradePanelSettings'
import { getMaxContractsForSymbol } from '../../../../services/practice/practiceLimits'
import { resolvePracticeProductSymbol } from '../../../../services/practice/practiceSymbol'
import type { TradeseaMarketBook } from '../../../../services/tradesea/tradeseaMarketBook'
import {
  getTradePanelTab,
  saveTradePanelTab,
  type TradePanelTab,
} from '../../../../utils/tradePanelTab'
import { DomTab } from './tabs/DomTab'
import { OrderTab } from './tabs/OrderTab'
import type { TradePanelProps } from './types'
import { isTradePanelTradingEnabled } from '../../../../utils/tradePanelTrading'

export type { TradePanelProps, OrderSide, BracketOptions, OrderSubmitOptions } from './types'
export type {
  TradePanelProps as PracticeTradePanelProps,
  BracketOptions as PracticeBracketOptions,
  OrderSubmitOptions as PracticeOrderSubmitOptions,
} from './types'

function readInitialTab(accountId: string, mobileSheet: boolean): TradePanelTab {
  const saved = getTradePanelTab(accountId)
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
  tab: TradePanelTab
  onTab: (t: TradePanelTab) => void
  onDetach?: () => void
  hideDetach?: boolean
  hideQuickTab?: boolean
}) {
  const tabs = (
    [
      { id: 'quick', label: 'Quick' },
      { id: 'dom', label: 'DOM' },
      { id: 'ticket', label: 'Ticket' },
    ] as const
  ).filter((t) => !(hideQuickTab && t.id === 'quick')) as { id: TradePanelTab; label: string }[]

  const colClass =
    tabs.length === 2 ? 'grid-cols-2' : tabs.length === 1 ? 'grid-cols-1' : 'grid-cols-3'

  return (
    <div className="flex items-center gap-2 bg-[#0f172a] rounded-t-2xl border border-b-0 border-[#475569] shrink-0">
      <div className="flex w-full items-center gap-1 mx-2 border-b border-[#475569] rounded-t-2xl">
        <div
          className={`grid h-10 flex-1 ${colClass} overflow-hidden -mb-px bg-[#020617]`}
          role="tablist"
          aria-label="Trade panel"
        >
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

export default function TradePanel(props: TradePanelProps) {
  const {
    accountId,
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
  const [tab, setTab] = useState<TradePanelTab>(() => readInitialTab(accountId, mobileSheet))
  const rootSymbol = chartSymbol.includes(':') ? chartSymbol.split(':')[1]! : chartSymbol
  const [bookTick, setBookTick] = useState(0)
  const [panelUi, setPanelUi] = useState(() => getTradePanelSettings())
  const [account, setAccount] = useState<PracticeAccount | undefined>(() =>
    getPracticeAccountById(accountId)
  )

  useEffect(() => {
    const onUiChange = () => setPanelUi(getTradePanelSettings())
    window.addEventListener('tradePanelSettingsChanged', onUiChange)
    window.addEventListener('practiceTradePanelSettingsChanged', onUiChange)
    return () => {
      window.removeEventListener('tradePanelSettingsChanged', onUiChange)
      window.removeEventListener('practiceTradePanelSettingsChanged', onUiChange)
    }
  }, [])

  const persistTab = useCallback(
    (next: TradePanelTab) => {
      if (next !== 'quick') saveTradePanelTab(accountId, next)
    },
    [accountId]
  )

  const handleTab = (next: TradePanelTab) => {
    if (next === 'quick' && onDetach && !hideDetach) {
      saveTradePanelTab(accountId, 'quick')
      onDetach()
      return
    }
    persistTab(next)
    setTab(next)
  }

  useEffect(() => {
    if (mobileSheet && tab === 'quick') {
      const saved = getTradePanelTab(accountId)
      setTab(saved === 'dom' ? 'dom' : 'ticket')
    }
  }, [mobileSheet, tab, accountId])

  useEffect(() => {
    if (tab !== 'quick') persistTab(tab)
  }, [tab, persistTab])

  const sync = useCallback(() => setAccount(getPracticeAccountById(accountId)), [accountId])
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
  }, [chartSymbol, accountId])
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
  const tradeOffline = !isTradePanelTradingEnabled(props)

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
        {tradeOffline && (
          <div
            className="shrink-0 mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-center text-[10px] font-medium leading-snug text-amber-300/95"
            role="status"
          >
            Market data offline — trading disabled
          </div>
        )}
        {tab === 'ticket' && (
          <OrderTab
            props={props}
            maxQty={maxQty}
            book={book}
            marketPrice={marketPrice}
            tickSize={tickSize}
            symbolLabel={rootSymbol}
          />
        )}
        {tab === 'dom' && (
          <DomTab
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
