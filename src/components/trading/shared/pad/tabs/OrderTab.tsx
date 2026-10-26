import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownRight, ArrowUpDown, ArrowUpRight } from 'lucide-react'
import type { TradeseaMarketBook } from '../../../../../services/tradesea/tradeseaMarketBook'
import {
  fmtPrice,
  parseBracketPriceInput,
  parseBracketDistanceInput,
  priceFromDistance,
  distanceFromPrice,
  convertDistanceValue,
  formatDistanceEquivalents,
  positionSizeForRisk,
} from '../bracketUtils'
import { PadCheckbox } from '../PadControls'
import type { ChartAutoTradeRequest } from '../../../../common/aurenTradeContextMenu'
import {
  getTradeRiskSettings,
  saveTradeRiskSettings,
  TRADE_RISK_SETTINGS_CHANGED,
  type TradeRiskSettings,
} from '../../../../../utils/tradeRiskSettings'
import type {
  TradePanelProps,
  OrderSide,
  BracketDistanceUnit,
  BracketOptions,
  ChartPricePickContext,
} from '../types'
import { DEFAULT_SL_TICKS, DEFAULT_TP_TICKS } from '../types'
import { isTradePanelTradingEnabled } from '../../../../../utils/tradePanelTrading'
import { resolvePracticeInstrumentTicks } from '../../../../../services/practice/practiceInstrumentTicks'
import {
  formatPracticePositionFamily,
  practiceContractRoot,
  practiceMicroRoot,
} from '../../../../../services/practice/practiceContractFamily'
import { formatChartResolution, normalizeChartResolution } from '../../../../../utils/chartResolution'

const BRACKET_PREFS_PREFIX = 'trade_panel_brackets_'
type AutoDirectionMode = OrderSide | 'auto'

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
  autoArmRequest,
  maxQty,
  book,
  marketPrice,
  tickSize,
  tickValue = 0,
  symbolLabel,
}: {
  props: TradePanelProps
  autoArmRequest?: ChartAutoTradeRequest | null
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
  const [selectedSide, setSelectedSide] = useState<OrderSide>('buy')
  const [stopLossOn, setStopLossOn] = useState(true)
  const [takeProfitOn, setTakeProfitOn] = useState(false)
  const [slTicks, setSlTicks] = useState(String(DEFAULT_SL_TICKS))
  const [tpTicks, setTpTicks] = useState(String(DEFAULT_TP_TICKS))
  const [slPrice, setSlPrice] = useState('')
  const [tpPrice, setTpPrice] = useState('')
  const [riskSettings, setRiskSettings] = useState<TradeRiskSettings>(getTradeRiskSettings)
  const [armedSide, setArmedSide] = useState<AutoDirectionMode | null>(null)
  const [chartStopSelected, setChartStopSelected] = useState(false)
  const [autoSubmitRequest, setAutoSubmitRequest] = useState<{
    side: OrderSide
    price: number
    basis: TradeRiskSettings['sizingBasis']
    resolution: string
    entry: number
    executionSymbol: string
    tickSize: number
    tickValue: number
    maxQuantity: number
  } | null>(null)
  const [selectedChartResolution, setSelectedChartResolution] = useState(() =>
    normalizeChartResolution(props.getActiveChartResolution?.())
  )
  const [autoMessage, setAutoMessage] = useState<string | null>(null)
  const [closeQuantities, setCloseQuantities] = useState<Record<string, string>>({})
  const [slDistanceUnit, setSlDistanceUnit] = useState<BracketDistanceUnit>('ticks')
  const [tpDistanceUnit, setTpDistanceUnit] = useState<BracketDistanceUnit>('ticks')
  const slBracketSourceRef = useRef<'price' | 'ticks' | null>(null)
  const tpBracketSourceRef = useRef<'price' | 'ticks' | null>(null)
  const prefsLoadedForRef = useRef<string | null>(null)
  const cancelPricePickRef = useRef<(() => void) | null>(null)
  const cancelPositionPreviewRef = useRef<(() => void) | null>(null)

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

  useEffect(() => {
    const refresh = () => {
      const next = getTradeRiskSettings()
      setRiskSettings(next)
    }
    window.addEventListener(TRADE_RISK_SETTINGS_CHANGED, refresh)
    return () => window.removeEventListener(TRADE_RISK_SETTINGS_CHANGED, refresh)
  }, [])

  const bid = book?.bestBid ?? null
  const ask = book?.bestAsk ?? null
  const refPrice = marketPrice ?? (selectedSide === 'buy' ? ask : bid) ?? book?.last ?? null
  const liveEntryRef = useRef<number | null>(refPrice)
  liveEntryRef.current = refPrice
  const chartRoot = practiceContractRoot(props.chartProductRoot || symbolLabel || '')
  const currentTradeRoot = practiceContractRoot(props.tradeProductRoot || symbolLabel || '')
  const requestedRiskRoot = practiceContractRoot(props.riskExecutionProductRoot || '') || chartRoot
  const automaticMicroRoot = props.autoRiskContractRouting
    ? practiceMicroRoot(requestedRiskRoot) || requestedRiskRoot
    : null
  const riskExecutionRoot = automaticMicroRoot || currentTradeRoot
  const riskTicks = automaticMicroRoot
    ? resolvePracticeInstrumentTicks(riskExecutionRoot)
    : { tickSize, tickValue }
  const riskDollarEnabled = riskTicks.tickValue > 0
  const riskMaxQty = props.getMaxQuantityForSymbol?.(riskExecutionRoot) ?? maxQty
  const resolveAutoSizingContext = useCallback((context?: ChartPricePickContext) => {
    const resolved = context ? props.getAutoOrderSizingContext?.(context) : null
    if (resolved) return resolved
    const entry = liveEntryRef.current
    if (entry == null || !Number.isFinite(entry)) return null
    return {
      entry,
      executionSymbol: riskExecutionRoot,
      tickSize: riskTicks.tickSize,
      tickValue: riskTicks.tickValue,
      maxQuantity: riskMaxQty,
    }
  }, [props.getAutoOrderSizingContext, riskExecutionRoot, riskMaxQty, riskTicks.tickSize, riskTicks.tickValue])
  const executionRoutingPending = Boolean(
    automaticMicroRoot &&
    !props.riskExecutionProductRoot &&
    currentTradeRoot !== riskExecutionRoot
  )
  const positionFamilySummary = props.getPositionFamilySummary?.() ?? null
  const orderEntryReference = refPrice
  const setCloseQuantity = useCallback((key: string, value: number, maximum: number) => {
    const next = Math.max(1, Math.min(maximum, Math.floor(value) || 1))
    setCloseQuantities((current) => ({ ...current, [key]: String(next) }))
  }, [])

  useEffect(() => {
    if (!executionRoutingPending || !props.onChartSymbolChange) return
    props.onChartSymbolChange(riskExecutionRoot)
  }, [executionRoutingPending, props.onChartSymbolChange, riskExecutionRoot])

  const fmtDistance = (amount: number, unit: BracketDistanceUnit) =>
    unit !== 'ticks' && amount % 1 !== 0 ? amount.toFixed(2) : String(amount)

  const syncSlFromDistance = useCallback(
    (distanceStr: string, unit: BracketDistanceUnit = slDistanceUnit) => {
      const amount = parseBracketDistanceInput(distanceStr, unit)
      if (orderEntryReference == null || tickSize <= 0 || amount == null) return
      setSlPrice(
        fmtPrice(priceFromDistance(orderEntryReference, amount, unit, tickSize, 'sl', selectedSide, tickValue))
      )
    },
    [orderEntryReference, tickSize, tickValue, selectedSide, slDistanceUnit]
  )

  const syncSlFromPrice = useCallback(
    (priceStr: string, unit: BracketDistanceUnit = slDistanceUnit) => {
      const price = parseBracketPriceInput(priceStr)
      if (orderEntryReference == null || tickSize <= 0 || price == null) return
      const amount = distanceFromPrice(orderEntryReference, price, unit, tickSize, 'sl', selectedSide, tickValue)
      if (amount != null) setSlTicks(fmtDistance(amount, unit))
    },
    [orderEntryReference, tickSize, tickValue, selectedSide, slDistanceUnit]
  )

  const syncTpFromDistance = useCallback(
    (distanceStr: string, unit: BracketDistanceUnit = tpDistanceUnit) => {
      const amount = parseBracketDistanceInput(distanceStr, unit)
      if (orderEntryReference == null || tickSize <= 0 || amount == null) return
      setTpPrice(
        fmtPrice(priceFromDistance(orderEntryReference, amount, unit, tickSize, 'tp', selectedSide, tickValue))
      )
    },
    [orderEntryReference, tickSize, tickValue, selectedSide, tpDistanceUnit]
  )

  const syncTpFromPrice = useCallback(
    (priceStr: string, unit: BracketDistanceUnit = tpDistanceUnit) => {
      const price = parseBracketPriceInput(priceStr)
      if (orderEntryReference == null || tickSize <= 0 || price == null) return
      const amount = distanceFromPrice(orderEntryReference, price, unit, tickSize, 'tp', selectedSide, tickValue)
      if (amount != null) setTpTicks(fmtDistance(amount, unit))
    },
    [orderEntryReference, tickSize, tickValue, selectedSide, tpDistanceUnit]
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
    if (orderEntryReference == null || tickSize <= 0) return
    if (slBracketSourceRef.current !== 'price') {
      syncSlFromDistance(slTicks, slDistanceUnit)
    }
  }, [slDistanceUnit, tickSize, orderEntryReference, selectedSide, slTicks, syncSlFromDistance])

  useEffect(() => {
    if (orderEntryReference == null || tickSize <= 0) return
    if (tpBracketSourceRef.current !== 'price') {
      syncTpFromDistance(tpTicks, tpDistanceUnit)
    }
  }, [tpDistanceUnit, tickSize, orderEntryReference, selectedSide, tpTicks, syncTpFromDistance])

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
    if (orderEntryReference == null || tickSize <= 0) return
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
  }, [orderEntryReference, tickSize, selectedSide, syncSlFromPrice, syncSlFromDistance, syncTpFromPrice, syncTpFromDistance])

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
    if (orderEntryReference != null && amount != null && tickSize > 0) {
      return priceFromDistance(orderEntryReference, amount, unit, tickSize, kind, selectedSide, tickValue)
    }
    return null
  }

  const parseOrderEntry = (): number | null => {
    return refPrice
  }

  const riskSizing = useMemo(() => {
    if (autoSubmitRequest) {
      return positionSizeForRisk(
        riskSettings.riskPerTrade,
        autoSubmitRequest.entry,
        autoSubmitRequest.price,
        autoSubmitRequest.tickSize,
        autoSubmitRequest.tickValue,
        autoSubmitRequest.maxQuantity,
        riskSettings.riskBuffer
      )
    }
    const entry = parseOrderEntry()
    const sizingFromTarget = riskSettings.sizingBasis === 'take_profit'
    if (!sizingFromTarget && !chartStopSelected) return null
    const basisPrice = sizingFromTarget
      ? resolveBracketPrice(takeProfitOn, tpPrice, tpTicks, 'tp', tpDistanceUnit)
      : resolveBracketPrice(stopLossOn, slPrice, slTicks, 'sl', slDistanceUnit)
    if (
      !riskDollarEnabled ||
      entry == null ||
      basisPrice == null ||
      distanceFromPrice(
        entry,
        basisPrice,
        'ticks',
        riskTicks.tickSize,
        sizingFromTarget ? 'tp' : 'sl',
        selectedSide,
        riskTicks.tickValue
      ) == null
    ) {
      return null
    }
    return positionSizeForRisk(
      riskSettings.riskPerTrade,
      entry,
      basisPrice,
      riskTicks.tickSize,
      riskTicks.tickValue,
      riskMaxQty,
      riskSettings.riskBuffer
    )
  // parseOrderEntry and resolveBracketPrice intentionally read the current ticket state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmitRequest, riskSettings.riskPerTrade, riskSettings.riskBuffer, riskSettings.sizingBasis, refPrice, stopLossOn, slPrice, slTicks, slDistanceUnit, takeProfitOn, tpPrice, tpTicks, tpDistanceUnit, selectedSide, riskTicks.tickSize, riskTicks.tickValue, riskMaxQty, riskDollarEnabled, chartStopSelected])

  const setStopLossMode = (stopLossMode: TradeRiskSettings['stopLossMode']) => {
    const next = { ...riskSettings, stopLossMode }
    setRiskSettings(next)
    saveTradeRiskSettings(next)
  }

  const cancelChartStopPick = useCallback(() => {
    cancelPricePickRef.current?.()
    cancelPricePickRef.current = null
    cancelPositionPreviewRef.current?.()
    cancelPositionPreviewRef.current = null
    setArmedSide(null)
    setAutoSubmitRequest(null)
    setAutoMessage(null)
    setChartStopSelected(false)
  }, [])

  const armChartStopPick = useCallback((mode: AutoDirectionMode) => {
    if (armedSide === mode) {
      cancelChartStopPick()
      return
    }
    cancelPricePickRef.current?.()
    cancelPositionPreviewRef.current?.()
    cancelPricePickRef.current = null
    cancelPositionPreviewRef.current = null
    const basis = riskSettings.sizingBasis
    if (mode === 'auto' && basis !== 'stop_loss') {
      setAutoMessage('Auto direction is available when sizing from the stop loss.')
      setArmedSide(null)
      return
    }
    const initialSide: OrderSide = mode === 'auto' ? 'buy' : mode
    setSelectedSide(initialSide)
    if (basis === 'stop_loss') {
      setStopLossOn(true)
      setChartStopSelected(false)
    }
    else setTakeProfitOn(true)
    setAutoSubmitRequest(null)
    setSelectedChartResolution(normalizeChartResolution(props.getActiveChartResolution?.()))
    const entry = marketPrice ?? (initialSide === 'buy' ? ask : bid) ?? book?.last ?? null
    if (entry == null || !Number.isFinite(entry)) {
      setAutoMessage('Waiting for a live market price.')
      setArmedSide(null)
      return
    }
    if (!props.pickChartPriceOnce) {
      setAutoMessage('Chart stop selection is unavailable.')
      setArmedSide(null)
      return
    }
    setArmedSide(mode)
    setAutoMessage(
      basis === 'stop_loss'
        ? mode === 'auto'
          ? 'Auto mode — below entry is Long; above entry is Short. Click the chart to enter.'
          : `${mode === 'buy' ? 'Buy' : 'Sell'} mode — move to your stop, then click the chart.`
        : `${mode === 'buy' ? 'Buy' : 'Sell'} armed — tap the chart for the take profit.`
    )
    let selectionCommitted = false
    const selectChartPrice: Parameters<NonNullable<TradePanelProps['pickChartPriceOnce']>>[0] = (pickedPrice, context) => {
      if (selectionCommitted) return
      const sizingContext = resolveAutoSizingContext(context)
      if (!sizingContext) {
        setAutoMessage('Waiting for a live market price on this chart.')
        return false
      }
      const liveEntry = sizingContext.entry
      const side: OrderSide = mode === 'auto'
        ? pickedPrice < liveEntry ? 'buy' : 'sell'
        : mode
      const validSide = basis === 'stop_loss'
        ? pickedPrice !== liveEntry && (mode === 'auto' || (side === 'buy' ? pickedPrice < liveEntry : pickedPrice > liveEntry))
        : side === 'buy' ? pickedPrice > liveEntry : pickedPrice < liveEntry
      if (!validSide) {
        setAutoMessage(
          basis === 'stop_loss'
            ? mode === 'auto'
              ? 'Move the stop above or below the live entry.'
              : side === 'buy'
              ? 'A buy stop must be below the market entry.'
              : 'A sell stop must be above the market entry.'
            : side === 'buy'
              ? 'A buy take profit must be above the market entry.'
              : 'A sell take profit must be below the market entry.'
        )
        return false
      }
      selectionCommitted = true
      cancelPricePickRef.current?.()
      cancelPricePickRef.current = null
      cancelPositionPreviewRef.current?.()
      cancelPositionPreviewRef.current = null
      setArmedSide(null)
      setSelectedSide(side)
      const ticks = Math.abs(Math.round((liveEntry - pickedPrice) / sizingContext.tickSize))
      if (basis === 'stop_loss') {
        slBracketSourceRef.current = 'price'
        setSlDistanceUnit('ticks')
        setSlPrice(fmtPrice(pickedPrice))
        setSlTicks(String(ticks))
        setChartStopSelected(true)
      } else {
        tpBracketSourceRef.current = 'price'
        setTpDistanceUnit('ticks')
        setTpPrice(fmtPrice(pickedPrice))
        setTpTicks(String(ticks))
      }
      const resolution = normalizeChartResolution(context?.resolution || props.getActiveChartResolution?.())
      setSelectedChartResolution(resolution)
      setAutoSubmitRequest({
        side,
        price: pickedPrice,
        basis,
        resolution,
        ...sizingContext,
      })
      setAutoMessage('Calculating contract size…')
      return true
    }
    const cancel = props.pickChartPriceOnce(selectChartPrice)
    cancelPricePickRef.current = cancel

    if (basis === 'stop_loss' && props.showAutoPositionPreview) {
      const previewStop = priceFromDistance(
        entry,
        DEFAULT_SL_TICKS,
        'ticks',
        tickSize,
        'sl',
        initialSide,
        tickValue
      )
      cancelPositionPreviewRef.current = props.showAutoPositionPreview({
        side: initialSide,
        entry,
        stopLoss: previewStop,
        tickSize,
        appearanceAt: (price, context) => {
          const sizingContext = resolveAutoSizingContext(context)
          if (!sizingContext) return { label: 'Waiting for price', quantityLabel: '' }
          const liveEntry = sizingContext.entry
          const previewSide: OrderSide = mode === 'auto'
            ? price < liveEntry ? 'buy' : 'sell'
            : mode
          const validSide = price !== liveEntry && (
            mode === 'auto' || (previewSide === 'buy' ? price < liveEntry : price > liveEntry)
          )
          if (!validSide) {
            return {
              label: mode === 'auto'
                ? 'Move above or below entry'
                : `Move ${previewSide === 'buy' ? 'below' : 'above'} entry`,
              quantityLabel: '',
            }
          }
          const sizing = positionSizeForRisk(
            riskSettings.riskPerTrade,
            liveEntry,
            price,
            sizingContext.tickSize,
            sizingContext.tickValue,
            sizingContext.maxQuantity,
            riskSettings.riskBuffer
          )
          const dollars = (sizing.quantity > 0
            ? sizing.plannedRisk
            : sizing.perContractRisk
          ).toLocaleString(undefined, { maximumFractionDigits: 2 })
          return {
            label: `${mode === 'auto' ? (previewSide === 'buy' ? 'Long' : 'Short') + ' · ' : ''}${sizing.quantity > 0 ? 'Risk' : '1 contract'} $${dollars}`,
            quantityLabel: sizing.quantity > 0 ? `${sizing.quantity} ${sizingContext.executionSymbol}` : 'Over risk',
          }
        },
        tickSizeAt: (context) => resolveAutoSizingContext(context)?.tickSize ?? tickSize,
      })
    }

    if (!cancel && !cancelPositionPreviewRef.current) {
      setArmedSide(null)
      setAutoMessage('Chart stop selection is unavailable.')
    }
  }, [armedSide, ask, bid, book?.last, cancelChartStopPick, marketPrice, props.getActiveChartResolution, props.pickChartPriceOnce, props.showAutoPositionPreview, resolveAutoSizingContext, riskSettings.riskBuffer, riskSettings.riskPerTrade, riskSettings.sizingBasis, tickSize, tickValue])

  useEffect(() => {
    if (!autoArmRequest) return
    armChartStopPick(autoArmRequest.side)
    // requestId intentionally makes repeated selections of the same side actionable.
  }, [autoArmRequest?.requestId])

  useEffect(() => () => {
    cancelPricePickRef.current?.()
    cancelPositionPreviewRef.current?.()
  }, [])

  useEffect(() => {
    if (!armedSide) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      cancelChartStopPick()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [armedSide, cancelChartStopPick])

  useEffect(() => {
    if (
      (executionRoutingPending && !autoSubmitRequest) ||
      !riskSizing ||
      riskSizing.quantity < 1
    ) return
    if (Number.parseInt(String(props.quantity), 10) === riskSizing.quantity) return
    props.onQuantityInputChange(String(riskSizing.quantity))
  }, [autoSubmitRequest, executionRoutingPending, props.quantity, props.onQuantityInputChange, riskSizing])

  useEffect(() => {
    if (!autoSubmitRequest) return
    if (!riskSizing || riskSizing.quantity < 1) {
      setAutoMessage('The selected level cannot be sized within this amount.')
      setAutoSubmitRequest(null)
      return
    }
    if (Number.parseInt(String(props.quantity), 10) !== riskSizing.quantity) return

    setAutoSubmitRequest(null)
    setAutoMessage(
      `Submitting ${riskSizing.quantity} ${autoSubmitRequest.executionSymbol} contract${riskSizing.quantity === 1 ? '' : 's'}…`
    )
    const brackets: BracketOptions = {
      stopLoss:
        autoSubmitRequest.basis === 'stop_loss'
          ? autoSubmitRequest.price
          : chartStopSelected
            ? resolveBracketPrice(stopLossOn, slPrice, slTicks, 'sl', slDistanceUnit)
            : null,
      takeProfit:
        autoSubmitRequest.basis === 'take_profit'
          ? autoSubmitRequest.price
          : resolveBracketPrice(takeProfitOn, tpPrice, tpTicks, 'tp', tpDistanceUnit),
      stopLossMode: riskSettings.stopLossMode,
      softStopTrigger: riskSettings.softStopTrigger,
      softStopResolution: autoSubmitRequest.resolution,
    }
    if (props.onSubmitOrder) {
      props.onSubmitOrder(autoSubmitRequest.side, brackets, {
        orderType: 'market',
        entryPrice: autoSubmitRequest.entry,
        executionSymbol: autoSubmitRequest.executionSymbol,
      })
    } else if (autoSubmitRequest.side === 'buy') {
      props.onBuy()
    } else {
      props.onSell()
    }
    setAutoMessage(
      `Order sent: ${riskSizing.quantity} ${autoSubmitRequest.executionSymbol}. Drag the chart bracket to adjust it.`
    )
  // resolveBracketPrice intentionally reads the current take-profit state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmitRequest, chartStopSelected, props.quantity, props.onSubmitOrder, riskSettings.softStopTrigger, riskSettings.stopLossMode, riskSizing])

  const slEquivalents = useMemo(
    () => (stopLossOn ? formatDistanceEquivalents(slTicks, slDistanceUnit, tickSize, tickValue) : null),
    [stopLossOn, slTicks, slDistanceUnit, tickSize, tickValue]
  )
  const tpEquivalents = useMemo(
    () => (takeProfitOn ? formatDistanceEquivalents(tpTicks, tpDistanceUnit, tickSize, tickValue) : null),
    [takeProfitOn, tpTicks, tpDistanceUnit, tickSize, tickValue]
  )

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <fieldset
        disabled={tradeDisabled}
        className="flex flex-col flex-1 min-h-0 overflow-hidden border-0 m-0 p-0 min-w-0"
      >
      <div className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-1 pb-32 sm:gap-3">
        <div className={`rounded-xl border ${surface}`}>
          <div className="grid grid-cols-3 gap-1 p-1.5">
            <button
              type="button"
              tabIndex={1}
              aria-pressed={armedSide === 'buy'}
              onClick={() => armChartStopPick('buy')}
              className={`flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                armedSide === 'buy'
                  ? isDark
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-emerald-300 bg-emerald-50'
                  : isDark
                    ? 'border-transparent hover:bg-[#27272A]'
                    : 'border-transparent hover:bg-white'
              }`}
            >
              <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-500" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0">
                <span className={`block text-xs font-semibold ${strongText}`}>Buy</span>
                <span className={`block truncate font-mono text-[10px] tabular-nums ${mutedText}`}>
                  {riskSettings.sizingBasis === 'stop_loss' ? 'Place stop on chart' : 'Tap chart for target'}
                </span>
              </span>
            </button>
            <button
              type="button"
              tabIndex={2}
              aria-pressed={armedSide === 'sell'}
              onClick={() => armChartStopPick('sell')}
              className={`flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                armedSide === 'sell'
                  ? isDark
                    ? 'border-red-500/40 bg-red-500/10'
                    : 'border-red-300 bg-red-50'
                  : isDark
                    ? 'border-transparent hover:bg-[#27272A]'
                    : 'border-transparent hover:bg-white'
              }`}
            >
              <ArrowDownRight className="h-4 w-4 shrink-0 text-red-500" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0">
                <span className={`block text-xs font-semibold ${strongText}`}>Sell</span>
                <span className={`block truncate font-mono text-[10px] tabular-nums ${mutedText}`}>
                  {riskSettings.sizingBasis === 'stop_loss' ? 'Place stop on chart' : 'Tap chart for target'}
                </span>
              </span>
            </button>
            <button
              type="button"
              tabIndex={3}
              disabled={riskSettings.sizingBasis !== 'stop_loss'}
              aria-pressed={armedSide === 'auto'}
              aria-label="Auto direction Place stop on chart"
              title={riskSettings.sizingBasis === 'stop_loss'
                ? 'Below entry selects Long; above entry selects Short'
                : 'Auto direction requires stop-loss sizing'}
              onClick={() => armChartStopPick('auto')}
              className={`flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                armedSide === 'auto'
                  ? isDark
                    ? 'border-violet-500/50 bg-violet-500/10'
                    : 'border-violet-300 bg-violet-50'
                  : isDark
                    ? 'border-transparent hover:bg-[#27272A]'
                    : 'border-transparent hover:bg-white'
              }`}
            >
              <ArrowUpDown className="h-4 w-4 shrink-0 text-violet-400" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0">
                <span className={`block text-xs font-semibold ${strongText}`}>Auto</span>
                <span className={`block truncate font-mono text-[10px] tabular-nums ${mutedText}`}>
                  Direction by stop
                </span>
              </span>
            </button>
          </div>
          {autoMessage ? (
            <div className={`mx-1.5 mb-1.5 flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[10px] font-medium ${
              armedSide
                ? 'bg-blue-500/10 text-blue-300'
                : isDark
                  ? 'bg-[#27272A] text-[#D4D4D8]'
                  : 'bg-[#F4F4F5] text-[#52525B]'
            }`} role="status">
              <span>{autoMessage}</span>
              {armedSide ? (
                <button type="button" onClick={cancelChartStopPick} className="shrink-0 font-semibold text-blue-400 hover:text-blue-300">
                  Cancel
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {positionFamilySummary ? (
          <div className={`rounded-xl border px-3 py-2.5 ${isDark ? 'border-violet-500/25 bg-violet-500/5' : 'border-violet-200 bg-violet-50'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${mutedText}`}>Open positions</span>
              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-semibold text-violet-400">
                {positionFamilySummary.microSymbol
                  ? `${positionFamilySummary.miniSymbol}/${positionFamilySummary.microSymbol}`
                  : positionFamilySummary.miniSymbol}
              </span>
            </div>
            <p className={`mt-1 font-mono text-[11px] font-semibold tabular-nums ${strongText}`}>
              {formatPracticePositionFamily(positionFamilySummary)}
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {positionFamilySummary.positions.map((position) => {
                const maximum = Math.abs(position.contracts)
                const key = `${position.symbol}:${position.closeSymbol || position.symbol}`
                const selected = Math.max(
                  1,
                  Math.min(maximum, Number.parseInt(closeQuantities[key] || '1', 10) || 1)
                )
                return (
                  <div
                    key={key}
                    className={`rounded-lg border p-2 ${isDark ? 'border-[#3F3F46] bg-black/15' : 'border-violet-200 bg-white/80'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[11px] font-semibold ${strongText}`}>
                        {maximum} {position.symbol}
                      </span>
                      <span className={`text-[9px] font-semibold uppercase ${position.contracts > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {position.contracts > 0 ? 'Long' : 'Short'}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-[92px_1fr] gap-2">
                      <div className={`flex h-8 items-center overflow-hidden rounded-lg border ${isDark ? 'border-[#3F3F46] bg-[#18181B]' : 'border-[#D4D4D8] bg-white'}`}>
                        <button
                          type="button"
                          aria-label={`Decrease ${position.symbol} close quantity`}
                          onClick={() => setCloseQuantity(key, selected - 1, maximum)}
                          className={`h-full w-7 text-sm ${mutedText} hover:text-violet-400`}
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={`${position.symbol} quantity to close`}
                          value={closeQuantities[key] ?? '1'}
                          onChange={(event) => {
                            const digits = event.target.value.replace(/\D/g, '')
                            setCloseQuantities((current) => ({ ...current, [key]: digits }))
                          }}
                          onBlur={() => setCloseQuantity(key, selected, maximum)}
                          className={`h-full min-w-0 flex-1 bg-transparent text-center font-mono text-xs outline-none ${strongText}`}
                        />
                        <button
                          type="button"
                          aria-label={`Increase ${position.symbol} close quantity`}
                          onClick={() => setCloseQuantity(key, selected + 1, maximum)}
                          className={`h-full w-7 text-sm ${mutedText} hover:text-violet-400`}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => props.onClose(selected, position.closeSymbol || position.symbol)}
                        className="h-8 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2 text-[10px] font-semibold text-amber-300 transition hover:bg-amber-500/20"
                      >
                        Close {selected}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => props.onClose(maximum, position.closeSymbol || position.symbol)}
                      className="mt-2 h-8 w-full rounded-lg bg-red-600 text-[10px] font-semibold text-white transition hover:bg-red-500"
                    >
                      Close position
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        <section className="flex flex-col gap-3">
          <div
            className={`rounded-xl border p-3 flex flex-col gap-3 transition ${
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
                    if (!v) setChartStopSelected(false)
                    if (v && !slTicks) applySlTicks(DEFAULT_SL_TICKS)
                  }}
                  tabIndex={13}
                />
                {riskSettings.sizingBasis === 'stop_loss' ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15 text-[9px] font-bold text-red-400">1</span>
                ) : null}
                <span className={`text-xs font-semibold ${strongText}`}>Stop loss</span>
              </div>
              {stopLossOn && chartStopSelected && slPrice && (
                <span className="font-mono text-[10px] text-[#f85149] tabular-nums">{slPrice}</span>
              )}
            </div>
            {stopLossOn ? (
              <div>
                <p className={`mb-1.5 text-[9px] font-medium uppercase tracking-wide ${mutedText}`}>
                  Protection type
                </p>
                <div className={`grid grid-cols-2 rounded-lg border p-1 ${isDark ? 'border-[#3F3F46] bg-[#18181B]' : 'border-[#D4D4D8] bg-white'}`}>
                  {([['hard', 'Hard stop'], ['soft', 'Soft close']] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={riskSettings.stopLossMode === mode}
                      onClick={() => setStopLossMode(mode)}
                      className={`h-8 rounded-md text-[10px] font-semibold transition ${
                        riskSettings.stopLossMode === mode
                          ? mode === 'hard'
                            ? 'bg-red-600 text-white'
                            : 'bg-amber-500 text-black'
                          : isDark
                            ? 'text-[#A1A1AA] hover:bg-[#27272A]'
                            : 'text-[#52525B] hover:bg-[#F4F4F5]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {props.mode !== 'backtest' ? (
                  <p className={`mt-1.5 text-[9px] leading-4 ${riskSettings.stopLossMode === 'soft' ? 'text-amber-400' : mutedText}`}>
                    {riskSettings.stopLossMode === 'soft'
                      ? `Browser-managed: closes the full position after a ${formatChartResolution(selectedChartResolution)} bar closes beyond the line. The timeframe comes from the chart pane used for entry; keep this page open and connected.`
                      : 'Closes as soon as price touches the line. On Tradesea, it is sent as broker-side protection.'}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className={`rounded-lg border px-3 py-2.5 ${isDark ? 'border-red-500/20 bg-black/10' : 'border-red-200 bg-white/70'}`}>
              <p className={`text-[10px] font-semibold ${chartStopSelected ? 'text-red-400' : strongText}`}>
                {chartStopSelected && slPrice
                  ? `Chart stop selected at ${slPrice}`
                  : 'Press Buy, Sell, or Auto, then move your cursor to the stop price.'}
              </p>
              <p className={`mt-1 text-[9px] leading-4 ${mutedText}`}>
                The risk and contract size follow your cursor. Click the chart to enter or press Esc to cancel.
              </p>
            </div>
          </div>

        </section>
      </div>

      </fieldset>
    </div>
  )
}
