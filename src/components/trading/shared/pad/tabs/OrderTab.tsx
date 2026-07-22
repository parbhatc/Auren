import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { TradeSideButton } from '../../../../common/TradeSideButton'
import { tradeSideMeta } from '../../../../../constants/tradingSide'
import {
  PRACTICE_CONTRACT_QTY_PRESET_CHIP_LIMIT,
  PRACTICE_CONTRACT_QTY_PRESETS,
} from '../../../../../constants/practice'
import type { TradeseaMarketBook } from '../../../../../services/tradesea/tradeseaMarketBook'
import {
  fmtPrice,
  parseBracketPriceInput,
  parseBracketDistanceInput,
  priceFromDistance,
  distanceFromPrice,
  convertDistanceValue,
  formatDistanceEquivalents,
  bracketDollarAmount,
  BRACKET_UNIT_SHORT,
} from '../bracketUtils'
import { PadCheckbox, BracketPriceTicksRow, TickPresetChips } from '../PadControls'
import type {
  TradePanelProps,
  OrderSide,
  OrderType,
  BracketDistanceUnit,
  BracketOptions,
  OrderSubmitOptions,
} from '../types'
import { DEFAULT_SL_TICKS, DEFAULT_TP_TICKS } from '../types'
import { isTradePanelTradingEnabled } from '../../../../../utils/tradePanelTrading'

const ORDER_TYPES: OrderType[] = ['market', 'limit', 'stop']

const BRACKET_PREFS_PREFIX = 'trade_panel_brackets_'

type BracketPrefs = {
  slTicks?: string
  tpTicks?: string
  slUnit?: BracketDistanceUnit
  tpUnit?: BracketDistanceUnit
}

function loadBracketPrefs(symbol: string | undefined): BracketPrefs | null {
  if (!symbol) return null
  try {
    const raw = localStorage.getItem(BRACKET_PREFS_PREFIX + symbol)
    return raw ? (JSON.parse(raw) as BracketPrefs) : null
  } catch {
    return null
  }
}

function saveBracketPrefs(symbol: string | undefined, prefs: BracketPrefs): void {
  if (!symbol) return
  try {
    localStorage.setItem(BRACKET_PREFS_PREFIX + symbol, JSON.stringify(prefs))
  } catch {
    // ignore
  }
}
export function OrderTab({
  props,
  maxQty,
  book,
  marketPrice,
  tickSize,
  tickValue = 0,
  symbolLabel,
}: {
  props: TradePanelProps
  maxQty: number
  book: TradeseaMarketBook | null
  marketPrice: number | null
  tickSize: number
  tickValue?: number
  symbolLabel?: string
}) {
  const dollarEnabled = tickValue > 0
  const tradeDisabled = !isTradePanelTradingEnabled(props)
  const isDark = props.isDark
  const surface = isDark
    ? 'border-[#27272A] bg-[#121215]'
    : 'border-[#E4E4E7] bg-[#FAFAFA]'
  const strongText = isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'
  const mutedText = isDark ? 'text-[#71717A]' : 'text-[#71717A]'
  const [orderType, setOrderType] = useState<OrderType>('market')
  const [selectedSide, setSelectedSide] = useState<OrderSide>('buy')
  const [stopLossOn, setStopLossOn] = useState(false)
  const [takeProfitOn, setTakeProfitOn] = useState(false)
  const [slTicks, setSlTicks] = useState(String(DEFAULT_SL_TICKS))
  const [tpTicks, setTpTicks] = useState(String(DEFAULT_TP_TICKS))
  const [slPrice, setSlPrice] = useState('')
  const [tpPrice, setTpPrice] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [stopPrice, setStopPrice] = useState('')
  const [stopLimitPrice, setStopLimitPrice] = useState('')
  const [slDistanceUnit, setSlDistanceUnit] = useState<BracketDistanceUnit>('ticks')
  const [tpDistanceUnit, setTpDistanceUnit] = useState<BracketDistanceUnit>('ticks')
  const slBracketSourceRef = useRef<'price' | 'ticks' | null>(null)
  const tpBracketSourceRef = useRef<'price' | 'ticks' | null>(null)
  const prevOrderTypeRef = useRef<OrderType>('market')
  const pendingOrderPriceSeedRef = useRef<OrderType | null>(null)
  const prefsLoadedForRef = useRef<string | null>(null)

  // Restore last-used bracket distances/units for this symbol.
  useEffect(() => {
    if (!symbolLabel || prefsLoadedForRef.current === symbolLabel) return
    prefsLoadedForRef.current = symbolLabel
    const prefs = loadBracketPrefs(symbolLabel)
    if (!prefs) return
    const safeUnit = (u?: BracketDistanceUnit): BracketDistanceUnit | null =>
      u === 'ticks' || u === 'points' || (u === 'dollars' && dollarEnabled) ? u : null
    const slUnit = safeUnit(prefs.slUnit)
    const tpUnit = safeUnit(prefs.tpUnit)
    if (slUnit) setSlDistanceUnit(slUnit)
    if (tpUnit) setTpDistanceUnit(tpUnit)
    if (prefs.slTicks && parseBracketDistanceInput(prefs.slTicks, slUnit ?? 'ticks') != null) {
      setSlTicks(prefs.slTicks)
    }
    if (prefs.tpTicks && parseBracketDistanceInput(prefs.tpTicks, tpUnit ?? 'ticks') != null) {
      setTpTicks(prefs.tpTicks)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolLabel, dollarEnabled])

  // Debounced — distance inputs fire per keystroke and price-sync writes.
  useEffect(() => {
    if (!symbolLabel || prefsLoadedForRef.current !== symbolLabel) return
    const timer = setTimeout(() => {
      saveBracketPrefs(symbolLabel, {
        slTicks,
        tpTicks,
        slUnit: slDistanceUnit,
        tpUnit: tpDistanceUnit,
      })
    }, 400)
    return () => clearTimeout(timer)
  }, [symbolLabel, slTicks, tpTicks, slDistanceUnit, tpDistanceUnit])

  const bid = book?.bestBid ?? null
  const ask = book?.bestAsk ?? null
  const refPrice = marketPrice ?? (selectedSide === 'buy' ? ask : bid) ?? book?.last ?? null
  const spread =
    bid != null && ask != null && ask >= bid ? Math.round((ask - bid) * 100) / 100 : null
  const mid =
    bid != null && ask != null ? Math.round(((bid + ask) / 2) * 100) / 100 : marketPrice

  const qtyPresets = useMemo(
    () =>
      PRACTICE_CONTRACT_QTY_PRESETS.filter((p) => p <= maxQty).slice(
        0,
        PRACTICE_CONTRACT_QTY_PRESET_CHIP_LIMIT
      ),
    [maxQty]
  )
  const qtyNum = parseInt(String(props.quantity).replace(/\D/g, ''), 10) || 0

  useEffect(() => {
    if (orderType !== prevOrderTypeRef.current) {
      prevOrderTypeRef.current = orderType
      pendingOrderPriceSeedRef.current =
        orderType === 'limit' || orderType === 'stop' ? orderType : null
    }
    const pending = pendingOrderPriceSeedRef.current
    if (pending == null || refPrice == null) return
    const p = fmtPrice(refPrice)
    if (pending === 'limit') setLimitPrice(p)
    if (pending === 'stop') {
      setStopPrice(p)
      setStopLimitPrice(p)
    }
    pendingOrderPriceSeedRef.current = null
  }, [orderType, refPrice])

  const fmtDistance = (amount: number, unit: BracketDistanceUnit) =>
    unit !== 'ticks' && amount % 1 !== 0 ? amount.toFixed(2) : String(amount)

  const syncSlFromDistance = useCallback(
    (distanceStr: string, unit: BracketDistanceUnit = slDistanceUnit) => {
      const amount = parseBracketDistanceInput(distanceStr, unit)
      if (refPrice == null || tickSize <= 0 || amount == null) return
      setSlPrice(
        fmtPrice(priceFromDistance(refPrice, amount, unit, tickSize, 'sl', selectedSide, tickValue))
      )
    },
    [refPrice, tickSize, tickValue, selectedSide, slDistanceUnit]
  )

  const syncSlFromPrice = useCallback(
    (priceStr: string, unit: BracketDistanceUnit = slDistanceUnit) => {
      const price = parseBracketPriceInput(priceStr)
      if (refPrice == null || tickSize <= 0 || price == null) return
      const amount = distanceFromPrice(refPrice, price, unit, tickSize, 'sl', selectedSide, tickValue)
      if (amount != null) setSlTicks(fmtDistance(amount, unit))
    },
    [refPrice, tickSize, tickValue, selectedSide, slDistanceUnit]
  )

  const syncTpFromDistance = useCallback(
    (distanceStr: string, unit: BracketDistanceUnit = tpDistanceUnit) => {
      const amount = parseBracketDistanceInput(distanceStr, unit)
      if (refPrice == null || tickSize <= 0 || amount == null) return
      setTpPrice(
        fmtPrice(priceFromDistance(refPrice, amount, unit, tickSize, 'tp', selectedSide, tickValue))
      )
    },
    [refPrice, tickSize, tickValue, selectedSide, tpDistanceUnit]
  )

  const syncTpFromPrice = useCallback(
    (priceStr: string, unit: BracketDistanceUnit = tpDistanceUnit) => {
      const price = parseBracketPriceInput(priceStr)
      if (refPrice == null || tickSize <= 0 || price == null) return
      const amount = distanceFromPrice(refPrice, price, unit, tickSize, 'tp', selectedSide, tickValue)
      if (amount != null) setTpTicks(fmtDistance(amount, unit))
    },
    [refPrice, tickSize, tickValue, selectedSide, tpDistanceUnit]
  )

  const changeSlDistanceUnit = useCallback(
    (next: BracketDistanceUnit) => {
      setSlDistanceUnit((unit) => {
        if (unit === next) return unit
        setSlTicks((v) => convertDistanceValue(v, unit, next, tickSize, tickValue))
        return next
      })
    },
    [tickSize, tickValue]
  )

  const changeTpDistanceUnit = useCallback(
    (next: BracketDistanceUnit) => {
      setTpDistanceUnit((unit) => {
        if (unit === next) return unit
        setTpTicks((v) => convertDistanceValue(v, unit, next, tickSize, tickValue))
        return next
      })
    },
    [tickSize, tickValue]
  )

  useEffect(() => {
    if (refPrice == null || tickSize <= 0) return
    if (slBracketSourceRef.current !== 'price') {
      syncSlFromDistance(slTicks, slDistanceUnit)
    }
  }, [slDistanceUnit, tickSize, refPrice, selectedSide, slTicks, syncSlFromDistance])

  useEffect(() => {
    if (refPrice == null || tickSize <= 0) return
    if (tpBracketSourceRef.current !== 'price') {
      syncTpFromDistance(tpTicks, tpDistanceUnit)
    }
  }, [tpDistanceUnit, tickSize, refPrice, selectedSide, tpTicks, syncTpFromDistance])

  const handleSlTicksChange = useCallback(
    (value: string) => {
      slBracketSourceRef.current = 'ticks'
      setSlTicks(value)
      syncSlFromDistance(value)
    },
    [syncSlFromDistance]
  )

  const handleSlPriceChange = useCallback(
    (value: string) => {
      slBracketSourceRef.current = 'price'
      setSlPrice(value)
      syncSlFromPrice(value)
    },
    [syncSlFromPrice]
  )

  const handleTpTicksChange = useCallback(
    (value: string) => {
      tpBracketSourceRef.current = 'ticks'
      setTpTicks(value)
      syncTpFromDistance(value)
    },
    [syncTpFromDistance]
  )

  const handleTpPriceChange = useCallback(
    (value: string) => {
      tpBracketSourceRef.current = 'price'
      setTpPrice(value)
      syncTpFromPrice(value)
    },
    [syncTpFromPrice]
  )

  const applySlTicks = useCallback(
    (amount: number) => {
      slBracketSourceRef.current = 'ticks'
      const s = fmtDistance(amount, slDistanceUnit)
      setSlTicks(s)
      syncSlFromDistance(s)
    },
    [syncSlFromDistance, slDistanceUnit]
  )

  const applyTpTicks = useCallback(
    (amount: number) => {
      tpBracketSourceRef.current = 'ticks'
      const s = fmtDistance(amount, tpDistanceUnit)
      setTpTicks(s)
      syncTpFromDistance(s)
    },
    [syncTpFromDistance, tpDistanceUnit]
  )

  const handleSlPriceBlur = useCallback(() => {
    const price = parseBracketPriceInput(slPrice)
    if (price == null) return
    const formatted = fmtPrice(price)
    setSlPrice(formatted)
    syncSlFromPrice(formatted)
  }, [slPrice, syncSlFromPrice])

  const handleTpPriceBlur = useCallback(() => {
    const price = parseBracketPriceInput(tpPrice)
    if (price == null) return
    const formatted = fmtPrice(price)
    setTpPrice(formatted)
    syncTpFromPrice(formatted)
  }, [tpPrice, syncTpFromPrice])

  useEffect(() => {
    slBracketSourceRef.current = null
    tpBracketSourceRef.current = null
  }, [selectedSide])

  useEffect(() => {
    if (refPrice == null || tickSize <= 0) return
    if (slBracketSourceRef.current === 'price') {
      syncSlFromPrice(slPrice)
    } else {
      syncSlFromDistance(slTicks, slDistanceUnit)
    }
    if (tpBracketSourceRef.current === 'price') {
      syncTpFromPrice(tpPrice, tpDistanceUnit)
    } else {
      syncTpFromDistance(tpTicks, tpDistanceUnit)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refPrice, tickSize, selectedSide, syncSlFromPrice, syncSlFromDistance, syncTpFromPrice, syncTpFromDistance])

  const armStopLoss = useCallback(() => {
    setStopLossOn(true)
    if (!slTicks) applySlTicks(DEFAULT_SL_TICKS)
  }, [applySlTicks, slTicks])

  const armTakeProfit = useCallback(() => {
    setTakeProfitOn(true)
    if (!tpTicks) applyTpTicks(DEFAULT_TP_TICKS)
  }, [applyTpTicks, tpTicks])

  const resolveBracketPrice = (
    enabled: boolean,
    priceStr: string,
    ticksStr: string,
    kind: 'sl' | 'tp',
    unit: BracketDistanceUnit
  ): number | null => {
    if (!enabled) return null
    const manual = parseFloat(priceStr.replace(/,/g, ''))
    if (Number.isFinite(manual) && manual > 0) return manual
    const amount = parseBracketDistanceInput(ticksStr, unit)
    if (refPrice != null && amount != null && tickSize > 0) {
      return priceFromDistance(refPrice, amount, unit, tickSize, kind, selectedSide, tickValue)
    }
    return null
  }

  const parseOrderEntry = (): number | null => {
    if (orderType === 'market') return refPrice
    if (orderType === 'limit') {
      const p = parseFloat(limitPrice.replace(/,/g, ''))
      return Number.isFinite(p) && p > 0 ? p : null
    }
    const stop = parseFloat(stopPrice.replace(/,/g, ''))
    const stopLimit = parseFloat(stopLimitPrice.replace(/,/g, ''))
    if (Number.isFinite(stopLimit) && stopLimit > 0) return stopLimit
    if (Number.isFinite(stop) && stop > 0) return stop
    return null
  }

  const handleConfirm = () => {
    if (tradeDisabled) return
    const entry = parseOrderEntry()
    if (entry == null) return
    const brackets: BracketOptions = {
      stopLoss: resolveBracketPrice(stopLossOn, slPrice, slTicks, 'sl', slDistanceUnit),
      takeProfit: resolveBracketPrice(takeProfitOn, tpPrice, tpTicks, 'tp', tpDistanceUnit),
    }
    const orderOpts: OrderSubmitOptions = {
      orderType,
      entryPrice: orderType === 'market' ? undefined : entry ?? undefined,
      stopLimitPrice:
        orderType === 'stop'
          ? (() => {
              const p = parseFloat(stopLimitPrice.replace(/,/g, ''))
              return Number.isFinite(p) && p > 0 ? p : undefined
            })()
          : undefined,
    }
    if (props.onSubmitOrder) {
      props.onSubmitOrder(selectedSide, brackets, orderOpts)
      return
    }
    if (selectedSide === 'buy') props.onBuy()
    else props.onSell()
  }

  const resetBrackets = () => {
    setStopLossOn(false)
    setTakeProfitOn(false)
    setSlTicks(String(DEFAULT_SL_TICKS))
    setTpTicks(String(DEFAULT_TP_TICKS))
    setSlPrice('')
    setTpPrice('')
  }

  const orderSummary = useMemo(() => {
    const side = selectedSide === 'buy' ? 'Buy' : 'Sell'
    const qty = props.quantity || '—'
    const sym = symbolLabel ? ` ${symbolLabel}` : ''
    const typeLabel = orderType.charAt(0).toUpperCase() + orderType.slice(1)
    const bracketParts: string[] = []
    if (stopLossOn && slTicks) bracketParts.push(`SL ${slTicks}${BRACKET_UNIT_SHORT[slDistanceUnit]}`)
    if (takeProfitOn && tpTicks) bracketParts.push(`TP ${tpTicks}${BRACKET_UNIT_SHORT[tpDistanceUnit]}`)
    const brackets = bracketParts.length ? ` · ${bracketParts.join(' · ')}` : ''
    return `${side} ${qty}${sym} · ${typeLabel}${brackets}`
  }, [
    selectedSide,
    props.quantity,
    symbolLabel,
    orderType,
    stopLossOn,
    slTicks,
    slDistanceUnit,
    takeProfitOn,
    tpTicks,
    tpDistanceUnit,
  ])

  const slEquivalents = useMemo(
    () => (stopLossOn ? formatDistanceEquivalents(slTicks, slDistanceUnit, tickSize, tickValue) : null),
    [stopLossOn, slTicks, slDistanceUnit, tickSize, tickValue]
  )
  const tpEquivalents = useMemo(
    () => (takeProfitOn ? formatDistanceEquivalents(tpTicks, tpDistanceUnit, tickSize, tickValue) : null),
    [takeProfitOn, tpTicks, tpDistanceUnit, tickSize, tickValue]
  )

  /** Total $ risk / reward at the armed brackets, and the resulting R:R ratio. */
  const riskSummary = useMemo(() => {
    if (refPrice == null || qtyNum <= 0 || !dollarEnabled) return null
    const sl = stopLossOn ? parseBracketPriceInput(slPrice) : null
    const tp = takeProfitOn ? parseBracketPriceInput(tpPrice) : null
    const risk = sl != null ? bracketDollarAmount(refPrice, sl, qtyNum, tickSize, tickValue) : null
    const reward = tp != null ? bracketDollarAmount(refPrice, tp, qtyNum, tickSize, tickValue) : null
    if (risk == null && reward == null) return null
    const parts: string[] = []
    if (risk != null) parts.push(`Risk $${risk.toLocaleString()}`)
    if (reward != null) parts.push(`Reward $${reward.toLocaleString()}`)
    if (risk != null && reward != null && risk > 0) {
      parts.push(`1:${(Math.round((reward / risk) * 10) / 10).toLocaleString()}`)
    }
    return parts.join(' · ')
  }, [refPrice, qtyNum, dollarEnabled, stopLossOn, slPrice, takeProfitOn, tpPrice, tickSize, tickValue])

  const inputClass =
    `no-spinner h-11 w-full rounded-xl border px-3.5 font-mono outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 ${
      isDark
        ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]'
        : 'border-[#D4D4D8] bg-white text-[#09090B]'
    }`

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <fieldset
        disabled={tradeDisabled}
        className="flex flex-col flex-1 min-h-0 overflow-hidden border-0 m-0 p-0 min-w-0"
      >
      <div className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-1 pb-32 sm:gap-3">
        {(spread != null || mid != null) && (
          <div className={`flex items-center justify-between rounded-xl border px-3 py-2 text-[10px] ${surface}`}>
            <span className={mutedText}>
              Spread{' '}
              <span className={`font-mono tabular-nums ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>
                {spread != null ? fmtPrice(spread) : '—'}
              </span>
            </span>
            <span className={mutedText}>
              Mid{' '}
              <span className={`font-mono tabular-nums ${strongText}`}>
                {mid != null ? fmtPrice(mid) : '—'}
              </span>
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <TradeSideButton
            side="buy"
            variant="select"
            active={selectedSide === 'buy'}
            tabIndex={1}
            onClick={() => setSelectedSide('buy')}
          >
            <span className={`text-xs font-bold uppercase tracking-wide ${tradeSideMeta('buy').textClass}`}>
              Buy
            </span>
            <span className={`text-[11px] ${mutedText}`}>
              Bid{' '}
              <span className={`font-mono text-sm tabular-nums ${strongText}`}>
                {bid != null ? fmtPrice(bid) : '—'}
              </span>
            </span>
          </TradeSideButton>
          <TradeSideButton
            side="sell"
            variant="select"
            active={selectedSide === 'sell'}
            tabIndex={2}
            onClick={() => setSelectedSide('sell')}
          >
            <span className={`text-xs font-bold uppercase tracking-wide ${tradeSideMeta('sell').textClass}`}>
              Sell
            </span>
            <span className={`text-[11px] ${mutedText}`}>
              Ask{' '}
              <span className={`font-mono text-sm tabular-nums ${strongText}`}>
                {ask != null ? fmtPrice(ask) : '—'}
              </span>
            </span>
          </TradeSideButton>
        </div>

        <div className={`flex rounded-xl border p-0.5 ${surface}`}>
          {ORDER_TYPES.map((t, i) => (
            <button
              key={t}
              type="button"
              tabIndex={3 + i}
              onClick={() => setOrderType(t)}
              className={`flex flex-1 h-9 items-center justify-center rounded-[10px] text-xs font-semibold capitalize transition ${
                orderType === t
                  ? 'bg-[#3b82f6] text-white'
                  : isDark
                    ? 'text-[#71717A] hover:text-[#D4D4D8]'
                    : 'text-[#52525B] hover:text-[#09090B]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <section className={`flex flex-col gap-3 rounded-xl border p-3 ${surface}`}>
          {orderType === 'market' && (
            <div>
              <p className={`mb-1 text-[10px] font-medium uppercase tracking-wide ${mutedText}`}>
                Market price
              </p>
              <p className={`font-mono text-xl font-semibold tabular-nums ${strongText}`}>
                {marketPrice != null ? fmtPrice(marketPrice) : '—'}
              </p>
            </div>
          )}
          {orderType === 'limit' && (
            <label className="flex flex-col gap-1">
              <span className={`text-[10px] font-medium uppercase tracking-wide ${mutedText}`}>
                Limit price
              </span>
              <input
                type="text"
                inputMode="decimal"
                tabIndex={6}
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className={inputClass}
              />
            </label>
          )}
          {orderType === 'stop' && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className={`text-[10px] font-medium uppercase tracking-wide ${mutedText}`}>
                  Stop trigger
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  tabIndex={6}
                  value={stopPrice}
                  onChange={(e) => setStopPrice(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={`text-[10px] font-medium uppercase tracking-wide ${mutedText}`}>
                  Stop limit
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  tabIndex={7}
                  value={stopLimitPrice}
                  onChange={(e) => setStopLimitPrice(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-medium uppercase tracking-wide ${mutedText}`}>
                Quantity
              </span>
              <span className={`text-[9px] ${mutedText}`}>Max {maxQty}</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                tabIndex={9}
                value={props.quantity}
                onChange={(e) => props.onQuantityInputChange(e.target.value)}
                onBlur={props.onQuantityBlur}
                className={`${inputClass} flex-1 min-w-0`}
              />
              <div className={`flex shrink-0 items-stretch overflow-hidden rounded-xl border ${isDark ? 'border-[#3F3F46]' : 'border-[#D4D4D8]'}`}>
                <button
                  type="button"
                  onClick={() => props.onQuantityChange(-1)}
                  className={`px-3 ${isDark ? 'text-[#A1A1AA] hover:bg-[#27272A] hover:text-[#FAFAFA]' : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B]'}`}
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className={`w-px ${isDark ? 'bg-[#3F3F46]' : 'bg-[#D4D4D8]'}`} />
                <button
                  type="button"
                  onClick={() => props.onQuantityChange(1)}
                  className={`px-3 ${isDark ? 'text-[#A1A1AA] hover:bg-[#27272A] hover:text-[#FAFAFA]' : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B]'}`}
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            {qtyPresets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {qtyPresets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => props.onQuantityInputChange(String(p))}
                    className={`font-mono text-[10px] h-7 min-w-[1.75rem] px-2 rounded-lg border transition ${
                      qtyNum === p
                        ? 'border-[#3b82f6] bg-[#3b82f6]/15 text-[#BFDBFE]'
                        : isDark
                          ? 'border-[#3F3F46] bg-[#27272A] text-[#A1A1AA] hover:border-[#52525B]'
                          : 'border-[#D4D4D8] bg-white text-[#52525B] hover:border-[#A1A1AA]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div
            className={`rounded-2xl border p-3 flex flex-col gap-3 transition ${
              stopLossOn
                ? 'border-[#f85149]/40 bg-[#f85149]/5'
                : surface
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PadCheckbox
                  checked={stopLossOn}
                  accent="red"
                  isDark={isDark}
                  onChange={(v) => {
                    setStopLossOn(v)
                    if (v && !slTicks) applySlTicks(DEFAULT_SL_TICKS)
                  }}
                  tabIndex={13}
                />
                <span className={`text-xs font-semibold ${strongText}`}>Stop loss</span>
              </div>
              {stopLossOn && slPrice && (
                <span className="font-mono text-[10px] text-[#f85149] tabular-nums">{slPrice}</span>
              )}
            </div>
            <BracketPriceTicksRow
              priceDisabled={false}
              ticksDisabled={false}
              priceValue={slPrice}
              ticksValue={slTicks}
              onPriceChange={handleSlPriceChange}
              onTicksChange={handleSlTicksChange}
              onPriceFocus={() => {
                slBracketSourceRef.current = 'price'
                armStopLoss()
              }}
              onTicksFocus={() => {
                slBracketSourceRef.current = 'ticks'
                armStopLoss()
              }}
              onPriceBlur={handleSlPriceBlur}
              distanceUnit={slDistanceUnit}
              onDistanceUnitChange={changeSlDistanceUnit}
              priceTabIndex={14}
              ticksTabIndex={15}
              dimmed={!stopLossOn}
              dollarEnabled={dollarEnabled}
              equivalents={slEquivalents}
              isDark={isDark}
            />
            <TickPresetChips
              disabled={false}
              variant="sl"
              activeDistance={slTicks}
              distanceUnit={slDistanceUnit}
              tickSize={tickSize}
              tickValue={tickValue}
              onSelect={applySlTicks}
              isDark={isDark}
            />
          </div>

          <div
            className={`rounded-2xl border p-3 flex flex-col gap-3 transition ${
              takeProfitOn
                ? 'border-[#3fb950]/40 bg-[#3fb950]/5'
                : surface
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PadCheckbox
                  checked={takeProfitOn}
                  accent="green"
                  isDark={isDark}
                  onChange={(v) => {
                    setTakeProfitOn(v)
                    if (v && !tpTicks) applyTpTicks(DEFAULT_TP_TICKS)
                  }}
                  tabIndex={10}
                />
                <span className={`text-xs font-semibold ${strongText}`}>Take profit</span>
              </div>
              {takeProfitOn && tpPrice && (
                <span className="font-mono text-[10px] text-[#3fb950] tabular-nums">{tpPrice}</span>
              )}
            </div>
            <BracketPriceTicksRow
              priceDisabled={false}
              ticksDisabled={false}
              priceValue={tpPrice}
              ticksValue={tpTicks}
              onPriceChange={handleTpPriceChange}
              onTicksChange={handleTpTicksChange}
              onPriceFocus={() => {
                tpBracketSourceRef.current = 'price'
                armTakeProfit()
              }}
              onTicksFocus={() => {
                tpBracketSourceRef.current = 'ticks'
                armTakeProfit()
              }}
              onPriceBlur={handleTpPriceBlur}
              distanceUnit={tpDistanceUnit}
              onDistanceUnitChange={changeTpDistanceUnit}
              priceTabIndex={11}
              ticksTabIndex={12}
              dimmed={!takeProfitOn}
              dollarEnabled={dollarEnabled}
              equivalents={tpEquivalents}
              isDark={isDark}
            />
            <TickPresetChips
              disabled={false}
              variant="tp"
              activeDistance={tpTicks}
              distanceUnit={tpDistanceUnit}
              tickSize={tickSize}
              tickValue={tickValue}
              onSelect={applyTpTicks}
              isDark={isDark}
            />
          </div>
        </section>
      </div>

      <div className={`sticky bottom-0 mt-auto shrink-0 border-t pb-3 pt-2 ${isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-white'}`}>
        <p className={`mb-2 truncate px-0.5 text-[10px] ${mutedText}`} title={orderSummary}>
          {orderSummary}
        </p>
        {riskSummary && (
          <p className={`-mt-1 mb-2 truncate px-0.5 font-mono text-[10px] tabular-nums ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`} title={riskSummary}>
            {riskSummary}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            tabIndex={17}
            onClick={resetBrackets}
            className={`flex-1 rounded-xl border px-3 py-2.5 transition ${isDark ? 'border-[#3F3F46] bg-[#27272A] hover:bg-[#3F3F46]' : 'border-[#D4D4D8] bg-white hover:bg-[#F4F4F5]'}`}
          >
            <span className={`text-sm font-semibold ${isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}`}>Reset</span>
          </button>
          <TradeSideButton
            side={selectedSide}
            variant="confirm"
            tabIndex={16}
            disabled={parseOrderEntry() == null || tradeDisabled}
            onClick={handleConfirm}
            className="disabled:opacity-50"
          >
            Confirm {selectedSide === 'buy' ? 'buy' : 'sell'}
          </TradeSideButton>
        </div>
      </div>
      </fieldset>
    </div>
  )
}
