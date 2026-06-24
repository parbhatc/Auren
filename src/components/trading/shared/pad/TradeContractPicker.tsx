import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Loader2, Search } from 'lucide-react'
import {
  chartSymbolToProductRoot,
  type TradeseaSearchSymbolResult,
} from '../../../../services/tradesea/tradeseaSymbolInfo'
import type { TradePanelProps } from '../../../../types/tradePanel'

const SEARCH_DEBOUNCE_MS = 200
const MENU_WIDTH_PX = 288

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
  streamLabel: string
  onPick: (symbol: string) => void
  disabled?: boolean
  chartSymbolHint?: string | null
  searchSymbols?: (query: string) => Promise<TradeseaSearchSymbolResult[]>
  /** Open menu above trigger — best for bottom mobile bars. */
  placement?: 'above' | 'below'
}

export function PadTradeSymbolPicker({
  props,
  disabled,
  placement,
}: {
  props: Pick<
    TradePanelProps,
    'chartSymbol' | 'chartSymbolHint' | 'searchSymbols' | 'onChartSymbolChange'
  >
  disabled?: boolean
  placement?: 'above' | 'below'
}) {
  if (!props.chartSymbol) return null
  return (
    <TradeContractPicker
      streamLabel={props.chartSymbol}
      chartSymbolHint={props.chartSymbolHint}
      searchSymbols={props.searchSymbols}
      disabled={disabled}
      placement={placement}
      onPick={(sym) => props.onChartSymbolChange?.(sym)}
    />
  )
}

export function TradeContractPicker({
  streamLabel,
  onPick,
  disabled,
  chartSymbolHint,
  searchSymbols,
  placement = 'below',
}: TradeContractPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TradeseaSearchSymbolResult[]>([])
  const [loading, setLoading] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchSymbolsRef = useRef(searchSymbols)
  const searchRequestRef = useRef(0)
  const seedQueryRef = useRef('NQ')
  searchSymbolsRef.current = searchSymbols

  const activeRoot =
    chartSymbolToProductRoot(streamLabel) || streamLabel.replace(/^CME:/i, '').toUpperCase()

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    searchRequestRef.current += 1
    setLoading(false)
  }, [])

  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const pad = 8
    let left = Math.max(pad, rect.left)
    if (left + MENU_WIDTH_PX > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - MENU_WIDTH_PX - pad)
    }

    if (placement === 'above') {
      setMenuStyle({
        position: 'fixed',
        left,
        bottom: window.innerHeight - rect.top + 4,
        width: MENU_WIDTH_PX,
        zIndex: 9999,
      })
      return
    }

    setMenuStyle({
      position: 'fixed',
      left,
      top: rect.bottom + 4,
      width: MENU_WIDTH_PX,
      zIndex: 9999,
    })
  }, [placement])

  const openDropdown = useCallback(() => {
    seedQueryRef.current = activeRoot || 'NQ'
    setQuery('')
    setOpen(true)
  }, [activeRoot])

  useEffect(() => {
    if (!open) return
    positionMenu()
    const onLayout = () => positionMenu()
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    return () => {
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
    }
  }, [open, positionMenu])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      close()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, close])

  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => searchRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const search = searchSymbolsRef.current
    if (!search) return

    const q = query.trim() || seedQueryRef.current
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
  }, [open, query])

  const pick = (result: TradeseaSearchSymbolResult) => {
    onPick(pickStreamSymbol(result))
    close()
  }

  const showChartHint =
    chartSymbolHint != null &&
    chartSymbolHint.trim() !== '' &&
    chartSymbolHint.trim().toUpperCase() !== streamLabel.trim().toUpperCase()

  const menu = open ? (
    <div
      ref={menuRef}
      style={menuStyle}
      className="rounded-lg border border-[#475569] bg-[#0f172a] p-2 shadow-xl"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[#64748b]">
          Trade contract
        </p>
        {loading ? <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[#64748b]" /> : null}
      </div>
      {searchSymbols ? (
        <>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748b]" />
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
              placeholder="Search symbol…"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-md border border-[#475569]/70 bg-[#020617] py-1.5 pl-7 pr-2 text-xs text-[#e6edf3] outline-none placeholder:text-[#64748b] focus:border-amber-500/50"
            />
          </div>
          <div
            className="max-h-52 overflow-y-auto overscroll-contain scrollbar-hide"
            role="listbox"
            aria-label="Symbol search results"
          >
            {results.length === 0 && !loading ? (
              <p className="py-4 text-center text-xs text-[#64748b]">No symbols found</p>
            ) : (
              results.map((result) => {
                const active = isActiveResult(result, streamLabel)
                const ticker = listItemTicker(result)
                const label = resultLabel(result)
                return (
                  <button
                    key={`${result.symbol}-${result.streamTicker || result.ticker || ''}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => pick(result)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left ${
                      active
                        ? 'bg-amber-500/15 text-amber-200'
                        : 'text-[#94a3b8] hover:bg-[#1e293b]'
                    }`}
                  >
                    <span className="w-12 shrink-0 text-[11px] font-semibold tabular-nums">
                      {ticker}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px]">{label}</span>
                    <span className="shrink-0 text-[10px] text-[#64748b]">{result.exchange}</span>
                  </button>
                )
              })
            )}
          </div>
        </>
      ) : (
        <p className="py-3 text-center text-xs text-[#64748b]">Symbol search unavailable</p>
      )}
    </div>
  ) : null

  return (
    <div className="relative min-w-0" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : openDropdown())}
        className="flex max-w-full items-center gap-1 rounded-md border border-[#475569]/60 bg-[#0f172a]/80 px-1.5 py-0.5 text-left hover:border-amber-500/40 disabled:opacity-60"
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Change trade contract"
      >
        <span className="truncate text-[11px] font-medium uppercase tracking-wide text-[#7d8590]">
          {streamLabel}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 text-[#7d8590]" />
      </button>
      {showChartHint ? (
        <p className="mt-0.5 truncate text-[9px] text-[#64748b]">Chart: {chartSymbolHint}</p>
      ) : null}
      {menu ? createPortal(menu, document.body) : null}
    </div>
  )
}
