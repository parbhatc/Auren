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

function readInitialTab(
  accountId: string,
  mobileSheet: boolean,
  hideTicketTab?: boolean,
): TradePanelTab {
  if (hideTicketTab) return 'dom'
  if (mobileSheet) return 'ticket'
  const saved = getTradePanelTab(accountId)
  if (saved === 'dom' || saved === 'ticket') return saved
  return 'ticket'
}

function DetachIcon({ onClick, isDark }: { onClick: () => void; isDark: boolean }) {
  return (
    <button
      type="button"
      title="Detach quick trade"
      aria-label="Detach quick trade"
      onClick={onClick}
      className={`inline-flex h-10 w-8 shrink-0 items-center justify-center ${
        isDark
          ? 'text-[#71717A] hover:bg-[#27272A] hover:text-[#FAFAFA]'
          : 'text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#09090B]'
      }`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15" fill="none" width="15" height="15">
        <path
          d="M13.5 13.5H10M13.5 13.5L13.5 10M13.5 13.5L9.5 9.5M10 1.5H13.5M13.5 1.5V5M13.5 1.5L9.5 5.5M5 1.5H1.5M1.5 1.5V5M1.5 1.5L5.5 5.5M1.5 10V13.5M1.5 13.5H5M1.5 13.5L5.5 9.5"
          stroke="currentColor"
          strokeWidth="1.5"
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
  hideTicketTab,
  isDark,
}: {
  tab: TradePanelTab
  onTab: (t: TradePanelTab) => void
  onDetach?: () => void
  hideDetach?: boolean
  hideQuickTab?: boolean
  hideTicketTab?: boolean
  isDark: boolean
}) {
  const tabs = (
    [
      { id: 'quick', label: 'Quick' },
      { id: 'dom', label: 'DOM' },
      { id: 'ticket', label: 'Order' },
    ] as const
  )
    .filter((t) => !(hideQuickTab && t.id === 'quick'))
    .filter((t) => !(hideTicketTab && t.id === 'ticket')) as { id: TradePanelTab; label: string }[]

  const colClass =
    tabs.length === 2 ? 'grid-cols-2' : tabs.length === 1 ? 'grid-cols-1' : 'grid-cols-3'

  return (
    <div className={`flex shrink-0 items-center gap-2 border-b ${isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-white'}`}>
      <div className="mx-2 flex w-full items-center gap-1">
        <div
          className={`grid h-10 flex-1 ${colClass} overflow-hidden ${isDark ? 'bg-[#18181B]' : 'bg-white'}`}
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
                className={`flex cursor-pointer items-center justify-center border-b-2 px-0.5 text-[11px] font-semibold leading-tight transition-colors sm:text-xs ${
                  active
                    ? 'border-[#3B82F6] text-[#60A5FA]'
                    : isDark
                      ? 'border-transparent text-[#71717A] hover:text-[#D4D4D8]'
                      : 'border-transparent text-[#71717A] hover:text-[#09090B]'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        {!hideDetach && onDetach && <DetachIcon onClick={onDetach} isDark={isDark} />}
      </div>
    </div>
  )
}

export default function TradePanel(props: TradePanelProps) {
  const {
    accountId,
    hideDetach,
    hideTicketTab,
    onDetach,
    fullWidth = false,
    markPrice,
    tickSize = 0.25,
    tickValue = 0,
    getMarketBook,
    subscribeMarketBook,
    ensureMarketBook,
    releaseMarketBook,
    chartSymbol = 'CME:MNQ',
  } = props

  const mobileSheet = fullWidth && hideDetach
  const isDark = props.isDark
  const [tab, setTab] = useState<TradePanelTab>(() =>
    readInitialTab(accountId, mobileSheet, hideTicketTab),
  )
  const rootSymbol = chartSymbol.includes(':') ? chartSymbol.split(':')[1]! : chartSymbol
  const [ltpTick, setLtpTick] = useState(0)
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
      if (hideTicketTab) {
        setTab('dom')
        return
      }
      setTab(saved === 'dom' ? 'dom' : 'ticket')
    }
  }, [mobileSheet, tab, accountId, hideTicketTab])

  useEffect(() => {
    if (hideTicketTab && tab === 'ticket') setTab('dom')
  }, [hideTicketTab, tab])

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
  const ltpTickRafRef = useRef<number | null>(null)
  useEffect(() => {
    const sub = subscribeMarketBookRef.current
    if (!sub) return
    const scheduleBookTick = () => {
      if (bookTickRafRef.current != null) return
      bookTickRafRef.current = requestAnimationFrame(() => {
        bookTickRafRef.current = null
        setBookTick((n) => n + 1)
      })
    }
    const scheduleLtpTick = () => {
      if (ltpTickRafRef.current != null) return
      ltpTickRafRef.current = requestAnimationFrame(() => {
        ltpTickRafRef.current = null
        setLtpTick((n) => n + 1)
      })
    }
    return sub((_streamId, kind) => {
      // LTP lives inside the book snapshot — always refresh book; ltpTick for LTP-only UI.
      scheduleBookTick()
      if (kind === 'ltp') scheduleLtpTick()
    })
  }, [chartSymbol, accountId])
  useEffect(() => {
    return () => {
      if (bookTickRafRef.current != null) cancelAnimationFrame(bookTickRafRef.current)
      if (ltpTickRafRef.current != null) cancelAnimationFrame(ltpTickRafRef.current)
    }
  }, [])

  useEffect(() => {
    ensureMarketBook?.()
    return () => releaseMarketBook?.()
    // The callbacks are rebuilt with the pad props; chartSymbol/accountId are
    // the semantic subscription identity and avoid release/re-add churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartSymbol, accountId])

  useEffect(() => {
    if (tab === 'dom' || tab === 'ticket') {
      ensureMarketBook?.()
      setBookTick((n) => n + 1)
      setLtpTick((n) => n + 1)
    }
  }, [tab, ensureMarketBook])

  const book = useMemo(() => {
    void bookTick
    return getMarketBook?.() ?? null
  }, [getMarketBook, bookTick])

  const product = account ? resolvePracticeProductSymbol(rootSymbol, null) : rootSymbol
  const maxQty = account ? getMaxContractsForSymbol(account.size, product) : 10
  const marketPrice = book?.last ?? markPrice ?? null
  const tradeOffline = !isTradePanelTradingEnabled(props)
  const effectivePanelUi = useMemo(
    () => ({ ...panelUi, ...props.panelUiOverrides }),
    [panelUi, props.panelUiOverrides],
  )

  return (
    <div
      className={`h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border ${
        isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-white'
      } ${fullWidth ? 'flex max-w-none flex-1' : 'flex max-w-[312px]'}`}
    >
      <TradePanelTabBar
        tab={tab}
        onTab={handleTab}
        onDetach={onDetach}
        hideDetach={hideDetach}
        hideQuickTab={mobileSheet}
        hideTicketTab={hideTicketTab}
        isDark={isDark}
      />
      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden px-2 pt-2 ${isDark ? 'bg-[#18181B]' : 'bg-white'}`}>
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
            tickValue={tickValue}
            symbolLabel={rootSymbol}
          />
        )}
        {tab === 'dom' && (
          <DomTab
            props={props}
            book={book}
            ltpTick={ltpTick}
            bookTick={bookTick}
            tickSize={tickSize}
            maxQty={maxQty}
            chartSymbol={chartSymbol}
            fallbackLast={marketPrice}
            panelUi={effectivePanelUi}
            compact={mobileSheet}
          />
        )}
      </div>
    </div>
  )
}
