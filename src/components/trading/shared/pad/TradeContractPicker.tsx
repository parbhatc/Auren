import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Loader2, Search, X } from 'lucide-react'
import Toggle from '../../../common/Toggle'
import {
  chartSymbolToProductRoot,
  type TradeseaSearchSymbolResult,
} from '../../../../services/tradesea/tradeseaSymbolInfo'
import type { TradePanelProps } from '../../../../types/tradePanel'
import { TRADE_PAD_AUTO_CHANGE_EVENT } from '../../../../utils/tradePadSymbol'

const SEARCH_DEBOUNCE_MS = 200
const MENU_WIDTH_PX = 320
const MOBILE_PICKER_MQ = '(max-width: 1023px)'
const MOBILE_MODAL_Z = 10050

function isMobilePickerViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_PICKER_MQ).matches
}

function listItemTicker(result: TradeseaSearchSymbolResult): string {
  const full = result.streamTicker || result.ticker || result.symbol
  const colon = full.lastIndexOf(':')
  if (colon >= 0) return full.slice(colon + 1)
  return full
}

function resultLabel(result: TradeseaSearchSymbolResult): string {
  return result.name || result.description || result.full_name || result.symbol || ''
}

function pickStreamSymbol(result: TradeseaSearchSymbolResult): string {
  return (
    result.streamTicker ||
    result.ticker ||
    (result.symbol.includes(':') ? result.symbol : `CME:${result.symbol}`)
  )
}

function isActiveResult(result: TradeseaSearchSymbolResult, streamLabel: string): boolean {
  const active = streamLabel.trim().toUpperCase()
  const candidates = [
    result.streamTicker,
    result.ticker,
    result.symbol,
    result.full_name,
    pickStreamSymbol(result),
  ]
    .filter(Boolean)
    .map((s) => String(s).trim().toUpperCase())
  if (candidates.includes(active)) return true
  const activeRoot = chartSymbolToProductRoot(streamLabel)
  return activeRoot !== '' && result.symbol.toUpperCase() === activeRoot
}

type TradeContractPickerProps = {
  tradeProductRoot: string
  chartProductRoot?: string
  chartStreamLabel?: string
  tradeStreamLabel: string
  onPickTrade: (symbol: string) => void
  disabled?: boolean
  searchSymbols?: (query: string) => Promise<TradeseaSearchSymbolResult[]>
  autoChangeTradeContract?: boolean
  onAutoChangeTradeContract?: (enabled: boolean) => void
  placement?: 'above' | 'below'
  dockCompact?: boolean
}

export function PadTradeSymbolPicker({
  props,
  disabled,
  placement,
  dockCompact = false,
}: {
  props: Pick<
    TradePanelProps,
    | 'chartSymbol'
    | 'chartProductRoot'
    | 'chartSymbolHint'
    | 'tradeProductRoot'
    | 'searchSymbols'
    | 'onChartSymbolChange'
    | 'autoChangeTradeContract'
    | 'onAutoChangeTradeContract'
  >
  disabled?: boolean
  placement?: 'above' | 'below'
  /** Mobile quick-trade toolbar: show full symbol, hide chart diff suffix. */
  dockCompact?: boolean
}) {
  if (!props.chartSymbol) return null

  const tradeRoot =
    props.tradeProductRoot?.trim().toUpperCase() ||
    chartSymbolToProductRoot(props.chartSymbol) ||
    props.chartSymbol.replace(/^CME:/i, '').toUpperCase()

  const chartRoot = props.chartProductRoot?.trim().toUpperCase() || tradeRoot
  const chartStream =
    props.chartSymbolHint?.trim() ||
    (chartRoot ? `CME:${chartRoot}` : props.chartSymbol)

  return (
    <TradeContractPicker
      tradeProductRoot={tradeRoot}
      chartProductRoot={props.chartProductRoot}
      chartStreamLabel={chartStream}
      tradeStreamLabel={props.chartSymbol}
      searchSymbols={props.searchSymbols}
      disabled={disabled}
      placement={placement}
      dockCompact={dockCompact}
      autoChangeTradeContract={props.autoChangeTradeContract}
      onAutoChangeTradeContract={props.onAutoChangeTradeContract}
      onPickTrade={(sym) => props.onChartSymbolChange?.(sym)}
    />
  )
}

export function TradeContractPicker({
  tradeProductRoot,
  chartProductRoot,
  chartStreamLabel,
  tradeStreamLabel,
  onPickTrade,
  disabled,
  searchSymbols,
  autoChangeTradeContract = true,
  onAutoChangeTradeContract,
  placement = 'below',
  dockCompact = false,
}: TradeContractPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TradeseaSearchSymbolResult[]>([])
  const [loading, setLoading] = useState(false)
  const [autoChange, setAutoChange] = useState(autoChangeTradeContract)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchSymbolsRef = useRef(searchSymbols)
  const searchRequestRef = useRef(0)
  searchSymbolsRef.current = searchSymbols

  const tradeRoot = tradeProductRoot.trim().toUpperCase()
  const chartRoot = chartProductRoot?.trim().toUpperCase() || tradeRoot
  const chartStream = chartStreamLabel?.trim() || (chartRoot ? `CME:${chartRoot}` : tradeStreamLabel)
  const mobileModal = isMobilePickerViewport()
  const compact = !mobileModal
  const tradeMatchesChart = chartRoot === tradeRoot

  useEffect(() => {
    setAutoChange(autoChangeTradeContract)
  }, [autoChangeTradeContract])

  useEffect(() => {
    const onPrefs = () => setAutoChange(autoChangeTradeContract)
    window.addEventListener(TRADE_PAD_AUTO_CHANGE_EVENT, onPrefs)
    return () => window.removeEventListener(TRADE_PAD_AUTO_CHANGE_EVENT, onPrefs)
  }, [autoChangeTradeContract])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    searchRequestRef.current += 1
    setLoading(false)
  }, [])

  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current
    const pad = 8

    if (mobileModal) {
      setMenuStyle({
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(24rem, 94vw)',
        maxHeight: 'min(82vh, 36rem)',
        zIndex: MOBILE_MODAL_Z,
      })
      return
    }

    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    let left = Math.max(pad, rect.left)
    const width = MENU_WIDTH_PX
    if (left + width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - width - pad)
    }

    if (placement === 'above') {
      setMenuStyle({
        position: 'fixed',
        left,
        bottom: window.innerHeight - rect.top + 4,
        width,
        zIndex: MOBILE_MODAL_Z,
      })
      return
    }

    setMenuStyle({
      position: 'fixed',
      left,
      top: rect.bottom + 4,
      width,
      zIndex: MOBILE_MODAL_Z,
    })
  }, [mobileModal, placement])

  const openDropdown = useCallback(() => {
    setQuery(tradeRoot || '')
    setOpen(true)
  }, [tradeRoot])

  useEffect(() => {
    if (!open) return
    positionMenu()
    const onLayout = () => positionMenu()
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    window.visualViewport?.addEventListener('resize', onLayout)
    return () => {
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
      window.visualViewport?.removeEventListener('resize', onLayout)
    }
  }, [open, positionMenu])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      close()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => {
      const input = searchRef.current
      if (!input) return
      input.focus()
      input.select()
    })
    return () => window.cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const search = searchSymbolsRef.current
    if (!search) return

    const q = query.trim() || tradeRoot || 'NQ'
    const requestId = ++searchRequestRef.current

    const handle = window.setTimeout(() => {
      setLoading(true)
      void search(q)
        .then((rows) => {
          if (requestId !== searchRequestRef.current) return
          setResults(rows)
        })
        .catch(() => {
          if (requestId !== searchRequestRef.current) return
          setResults([])
        })
        .finally(() => {
          if (requestId !== searchRequestRef.current) return
          setLoading(false)
        })
    }, query.trim() ? SEARCH_DEBOUNCE_MS : 0)

    return () => window.clearTimeout(handle)
  }, [open, query, tradeRoot])

  const pick = (result: TradeseaSearchSymbolResult) => {
    onPickTrade(pickStreamSymbol(result))
    close()
  }

  const useChartContract = () => {
    if (!tradeMatchesChart) {
      onPickTrade(chartStream)
    }
    close()
  }

  const shellPad = mobileModal ? 'px-4 pb-4' : 'p-2.5'

  const menu = open ? (
    <>
      <div
        data-trade-contract-backdrop
        className={`fixed inset-0 touch-manipulation ${
          mobileModal
            ? 'z-[10049] bg-[#020617]/60 backdrop-blur-[3px]'
            : 'z-[9998] bg-transparent'
        }`}
        aria-hidden
        onPointerDown={(e) => {
          e.preventDefault()
          close()
        }}
      />
      <div
        ref={menuRef}
        style={menuStyle}
        className={`flex flex-col overflow-hidden border border-[#334155] bg-[#0f172a] shadow-2xl ${
          mobileModal ? 'max-h-[inherit] rounded-2xl' : 'rounded-xl shadow-xl'
        }`}
        role="dialog"
        aria-label="Trade contract"
      >
        <div
          className={`flex shrink-0 items-center justify-between gap-2 border-b border-[#1e293b] ${
            mobileModal ? 'px-4 py-3' : 'px-2.5 py-2'
          }`}
        >
          <p className="text-sm font-semibold text-[#e6edf3]">Trade contract</p>
          <div className="flex items-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#64748b]" /> : null}
            {mobileModal ? (
              <button
                type="button"
                onClick={close}
                className="rounded-md p-1 text-[#64748b] hover:bg-[#1e293b] hover:text-[#e6edf3]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {searchSymbols ? (
          <div className={`flex min-h-0 flex-1 flex-col ${shellPad}`}>
            <div className={`flex shrink-0 items-center gap-2 ${compact ? 'pt-2' : 'pt-3'}`}>
              <button
                type="button"
                onClick={useChartContract}
                disabled={tradeMatchesChart}
                className={`flex min-w-0 flex-1 flex-col items-start rounded-xl border px-3 text-left transition ${
                  compact ? 'py-2' : 'py-2.5'
                } ${
                  tradeMatchesChart
                    ? 'cursor-default border-[#334155]/80 bg-[#0b1220]/60 opacity-70'
                    : 'border-[#334155] bg-[#0b1220] hover:border-violet-500/40 hover:bg-[#111827]'
                }`}
              >
                <span
                  className={`font-medium uppercase tracking-wider text-[#64748b] ${
                    compact ? 'text-[9px]' : 'text-[10px]'
                  }`}
                >
                  Use chart contract
                </span>
                <span
                  className={`mt-0.5 w-full truncate font-semibold uppercase tracking-wide text-[#e6edf3] ${
                    compact ? 'text-xs' : 'text-sm'
                  }`}
                >
                  {chartRoot}
                </span>
              </button>

              {onAutoChangeTradeContract ? (
                <div
                  className={`flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-[#334155] bg-[#0b1220] px-2.5 ${
                    compact ? 'py-2' : 'py-2.5'
                  }`}
                  title="Auto change trade when chart symbol changes"
                >
                  <span
                    className={`whitespace-nowrap font-medium uppercase tracking-wider text-[#64748b] ${
                      compact ? 'text-[8px]' : 'text-[9px]'
                    }`}
                  >
                    Auto
                  </span>
                  <Toggle
                    checked={autoChange}
                    onChange={(checked) => {
                      setAutoChange(checked)
                      onAutoChangeTradeContract(checked)
                    }}
                    size="sm"
                    isDark
                    accent="blue"
                  />
                </div>
              ) : null}
            </div>

            <div className={`relative shrink-0 ${compact ? 'mb-2 mt-2' : 'mb-2.5 mt-3'}`}>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    close()
                  }
                }}
                placeholder="Search trade contract"
                autoComplete="off"
                spellCheck={false}
                className={`w-full rounded-lg border border-[#334155] bg-[#020617] text-[#e6edf3] outline-none placeholder:text-[#64748b] focus:border-violet-500/50 ${
                  compact ? 'py-1.5 pl-8 pr-2 text-xs' : 'py-2 pl-9 pr-3 text-sm'
                }`}
              />
            </div>

            <div
              className={`min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide ${
                compact ? 'max-h-48' : ''
              }`}
              role="listbox"
              aria-label="Symbol search results"
            >
              {results.length === 0 && !loading ? (
                <p className={`text-center text-[#64748b] ${compact ? 'py-4 text-xs' : 'py-6 text-sm'}`}>
                  No symbols found
                </p>
              ) : (
                results.map((result) => {
                  const tradeMatch = isActiveResult(result, tradeStreamLabel)
                  const chartMatch = isActiveResult(result, chartRoot)
                  const ticker = listItemTicker(result)
                  const label = resultLabel(result)
                  return (
                    <button
                      key={`${result.symbol}-${result.streamTicker || result.ticker || ''}`}
                      type="button"
                      role="option"
                      aria-selected={tradeMatch}
                      onClick={() => pick(result)}
                      className={`flex w-full items-center gap-2.5 text-left transition ${
                        compact ? 'rounded-md px-2 py-1.5' : 'rounded-lg px-2.5 py-2'
                      } ${
                        tradeMatch
                          ? 'bg-violet-500/15 text-violet-100'
                          : 'text-[#94a3b8] hover:bg-[#1e293b]'
                      }`}
                    >
                      <span
                        className={`shrink-0 font-semibold tabular-nums ${
                          compact ? 'w-11 text-[11px]' : 'w-12 text-sm'
                        }`}
                      >
                        {ticker}
                      </span>
                      <span className={`min-w-0 flex-1 truncate ${compact ? 'text-[11px]' : 'text-sm'}`}>
                        {label}
                      </span>
                      {tradeMatch || chartMatch ? (
                        <span className="flex shrink-0 gap-1">
                          {chartMatch ? (
                            <span className="rounded bg-[#1e293b] px-1 py-0.5 text-[9px] font-medium uppercase text-[#94a3b8]">
                              C
                            </span>
                          ) : null}
                          {tradeMatch ? (
                            <span className="rounded bg-[#1e293b] px-1 py-0.5 text-[9px] font-medium uppercase text-[#94a3b8]">
                              T
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <p className={`text-center text-[#64748b] ${mobileModal ? 'px-4 py-6 text-sm' : 'py-3 text-xs'}`}>
            Symbol search unavailable
          </p>
        )}
      </div>
    </>
  ) : null

  const chartDiffers = chartRoot !== tradeRoot

  return (
    <div className={`relative min-w-0 ${dockCompact ? 'shrink-0' : ''}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : openDropdown())}
        className={`flex items-center gap-1 rounded-md border border-[#475569]/60 bg-[#0f172a]/80 px-1.5 py-0.5 text-left hover:border-violet-500/40 disabled:opacity-60 ${
          dockCompact ? 'shrink-0' : 'max-w-full'
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Change trade contract"
      >
        <span
          className={
            dockCompact
              ? 'whitespace-nowrap text-[11px] font-medium uppercase tracking-wide text-[#e6edf3]'
              : 'truncate text-[11px] font-medium uppercase tracking-wide text-[#e6edf3]'
          }
        >
          {tradeRoot}
        </span>
        {chartDiffers && !dockCompact ? (
          <span className="shrink-0 text-[9px] font-medium uppercase text-[#64748b]">· {chartRoot}</span>
        ) : null}
        <ChevronDown className="h-3 w-3 shrink-0 text-[#7d8590]" />
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  )
}
