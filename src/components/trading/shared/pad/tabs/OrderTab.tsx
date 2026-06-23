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
export function OrderTab({
  props,
  maxQty,
  book,
  marketPrice,
  tickSize,
  symbolLabel,
}: {
  props: TradePanelProps
  maxQty: number
  book: TradeseaMarketBook | null
  marketPrice: number | null
  tickSize: number
  symbolLabel?: string
}) {
  const tradeDisabled = !isTradePanelTradingEnabled(props)
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

  const syncSlFromDistance = useCallback(
    (distanceStr: string, unit: BracketDistanceUnit = slDistanceUnit) => {
      const amount = parseBracketDistanceInput(distanceStr, unit)
      if (refPrice == null || tickSize <= 0 || amount == null) return
      setSlPrice(fmtPrice(priceFromDistance(refPrice, amount, unit, tickSize, 'sl', selectedSide)))
    },
    [refPrice, tickSize, selectedSide, slDistanceUnit]
  )

  const syncSlFromPrice = useCallback(
    (priceStr: string, unit: BracketDistanceUnit = slDistanceUnit) => {
      const price = parseBracketPriceInput(priceStr)
      if (refPrice == null || tickSize <= 0 || price == null) return
      const amount = distanceFromPrice(refPrice, price, unit, tickSize, 'sl', selectedSide)
      if (amount != null) {
        setSlTicks(unit === 'points' && amount % 1 !== 0 ? amount.toFixed(2) : String(amount))
      }
    },
    [refPrice, tickSize, selectedSide, slDistanceUnit]
  )

  const syncTpFromDistance = useCallback(
    (distanceStr: string, unit: BracketDistanceUnit = tpDistanceUnit) => {
      const amount = parseBracketDistanceInput(distanceStr, unit)
      if (refPrice == null || tickSize <= 0 || amount == null) return
      setTpPrice(fmtPrice(priceFromDistance(refPrice, amount, unit, tickSize, 'tp', selectedSide)))
    },
    [refPrice, tickSize, selectedSide, tpDistanceUnit]
  )

  const syncTpFromPrice = useCallback(
    (priceStr: string, unit: BracketDistanceUnit = tpDistanceUnit) => {
      const price = parseBracketPriceInput(priceStr)
      if (refPrice == null || tickSize <= 0 || price == null) return
      const amount = distanceFromPrice(refPrice, price, unit, tickSize, 'tp', selectedSide)
      if (amount != null) {
        setTpTicks(unit === 'points' && amount % 1 !== 0 ? amount.toFixed(2) : String(amount))
      }
    },
    [refPrice, tickSize, selectedSide, tpDistanceUnit]
  )

  const toggleSlDistanceUnit = useCallback(() => {
    setSlDistanceUnit((unit) => {
      const next: BracketDistanceUnit = unit === 'ticks' ? 'points' : 'ticks'
      setSlTicks((v) => convertDistanceValue(v, unit, next, tickSize))
      return next
    })
  }, [tickSize])

  const toggleTpDistanceUnit = useCallback(() => {
    setTpDistanceUnit((unit) => {
      const next: BracketDistanceUnit = unit === 'ticks' ? 'points' : 'ticks'
      setTpTicks((v) => convertDistanceValue(v, unit, next, tickSize))
      return next
    })
  }, [tickSize])

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
      const s =
        slDistanceUnit === 'points' && amount % 1 !== 0 ? amount.toFixed(2) : String(amount)
      setSlTicks(s)
      syncSlFromDistance(s)
    },
    [syncSlFromDistance, slDistanceUnit]
  )

  const applyTpTicks = useCallback(
    (amount: number) => {
      tpBracketSourceRef.current = 'ticks'
      const s =
        tpDistanceUnit === 'points' && amount % 1 !== 0 ? amount.toFixed(2) : String(amount)
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
      return priceFromDistance(refPrice, amount, unit, tickSize, kind, selectedSide)
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
    if (stopLossOn && slTicks) bracketParts.push(`SL ${slTicks}${slDistanceUnit === 'ticks' ? 't' : 'pt'}`)
    if (takeProfitOn && tpTicks) bracketParts.push(`TP ${tpTicks}${tpDistanceUnit === 'ticks' ? 't' : 'pt'}`)
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

  const inputClass =
    'no-spinner font-mono h-11 w-full rounded-xl border border-[#475569] bg-[#020617] px-3.5 text-[#e6edf3] outline-none focus:border-[#a78bfa] focus:ring-1 focus:ring-[#8b5cf6]/30'

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <fieldset
        disabled={tradeDisabled}
        className="flex flex-col flex-1 min-h-0 overflow-hidden border-0 m-0 p-0 min-w-0"
      >
      <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto py-1 pb-36 scrollbar-hide">
        {(spread != null || mid != null) && (
          <div className="flex items-center justify-between rounded-xl border border-[#334155]/80 bg-[#020617]/60 px-3 py-2 text-[10px]">
            <span className="text-[#64748b]">
              Spread{' '}
              <span className="font-mono text-[#94a3b8] tabular-nums">
                {spread != null ? fmtPrice(spread) : '—'}
              </span>
            </span>
            <span className="text-[#64748b]">
              Mid{' '}
              <span className="font-mono text-[#e6edf3] tabular-nums">
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
            <span className="text-[11px] text-[#7d8590]">
              Bid{' '}
              <span className="font-mono text-sm text-[#e6edf3] tabular-nums">
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
            <span className="text-[11px] text-[#7d8590]">
              Ask{' '}
              <span className="font-mono text-sm text-[#e6edf3] tabular-nums">
                {ask != null ? fmtPrice(ask) : '—'}
              </span>
            </span>
          </TradeSideButton>
        </div>

        <div className="flex rounded-xl border border-[#475569] bg-[#020617] p-0.5">
          {ORDER_TYPES.map((t, i) => (
            <button
              key={t}
              type="button"
              tabIndex={3 + i}
              onClick={() => setOrderType(t)}
              className={`flex flex-1 h-9 items-center justify-center rounded-[10px] text-xs font-semibold capitalize transition ${
                orderType === t
                  ? 'bg-[#8b5cf6] text-white shadow-sm'
                  : 'text-[#7d8590] hover:text-[#adbac7]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <section className="rounded-2xl border border-[#334155] bg-[#020617]/50 p-3 flex flex-col gap-3">
          {orderType === 'market' && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#64748b] mb-1">
                Market price
              </p>
              <p className="font-mono text-xl font-semibold text-[#e6edf3] tabular-nums">
                {marketPrice != null ? fmtPrice(marketPrice) : '—'}
              </p>
            </div>
          )}
          {orderType === 'limit' && (
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-[#64748b]">
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
                <span className="text-[10px] font-medium uppercase tracking-wide text-[#64748b]">
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
                <span className="text-[10px] font-medium uppercase tracking-wide text-[#64748b]">
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
              <span className="text-[10px] font-medium uppercase tracking-wide text-[#64748b]">
                Quantity
              </span>
              <span className="text-[9px] text-[#64748b]">Max {maxQty}</span>
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
              <div className="shrink-0 flex items-stretch rounded-xl border border-[#475569] overflow-hidden">
                <button
                  type="button"
                  onClick={() => props.onQuantityChange(-1)}
                  className="px-3 hover:bg-[#1e293b] text-[#7d8590]"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="w-px bg-[#475569]" />
                <button
                  type="button"
                  onClick={() => props.onQuantityChange(1)}
                  className="px-3 hover:bg-[#1e293b] text-[#7d8590]"
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
                        ? 'border-[#8b5cf6] bg-[#8b5cf6]/15 text-[#c4b5fd]'
                        : 'border-[#475569] bg-[#1e293b]/60 text-[#94a3b8] hover:border-[#64748b]'
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
                : 'border-[#334155] bg-[#020617]/30'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PadCheckbox
                  checked={stopLossOn}
                  accent="red"
                  onChange={(v) => {
                    setStopLossOn(v)
                    if (v && !slTicks) applySlTicks(DEFAULT_SL_TICKS)
                  }}
                  tabIndex={13}
                />
                <span className="text-xs font-semibold text-[#e6edf3]">Stop loss</span>
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
              onToggleDistanceUnit={toggleSlDistanceUnit}
              priceTabIndex={14}
              ticksTabIndex={15}
              dimmed={!stopLossOn}
            />
            <TickPresetChips
              disabled={false}
              variant="sl"
              activeDistance={slTicks}
              distanceUnit={slDistanceUnit}
              tickSize={tickSize}
              onSelect={applySlTicks}
            />
          </div>

          <div
            className={`rounded-2xl border p-3 flex flex-col gap-3 transition ${
              takeProfitOn
                ? 'border-[#3fb950]/40 bg-[#3fb950]/5'
                : 'border-[#334155] bg-[#020617]/30'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PadCheckbox
                  checked={takeProfitOn}
                  accent="green"
                  onChange={(v) => {
                    setTakeProfitOn(v)
                    if (v && !tpTicks) applyTpTicks(DEFAULT_TP_TICKS)
                  }}
                  tabIndex={10}
                />
                <span className="text-xs font-semibold text-[#e6edf3]">Take profit</span>
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
              onToggleDistanceUnit={toggleTpDistanceUnit}
              priceTabIndex={11}
              ticksTabIndex={12}
              dimmed={!takeProfitOn}
            />
            <TickPresetChips
              disabled={false}
              variant="tp"
              activeDistance={tpTicks}
              distanceUnit={tpDistanceUnit}
              tickSize={tickSize}
              onSelect={applyTpTicks}
            />
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 shrink-0 pt-2 pb-3 mt-auto border-t border-[#334155] bg-gradient-to-t from-[#0f172a] via-[#0f172a] to-[#0f172a]/95">
        <p className="text-[10px] text-[#64748b] px-0.5 mb-2 truncate" title={orderSummary}>
          {orderSummary}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            tabIndex={17}
            onClick={resetBrackets}
            className="flex-1 py-2.5 px-3 rounded-2xl border border-[#475569] bg-[#1e293b] hover:bg-[#334155] transition"
          >
            <span className="text-sm font-semibold text-[#adbac7]">Reset</span>
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
