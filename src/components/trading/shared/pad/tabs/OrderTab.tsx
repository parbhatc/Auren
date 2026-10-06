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
  bracketDollarAmount,
  positionSizeForRisk,
} from '../bracketUtils'
import { PadCheckbox } from '../PadControls'
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
} from '../types'
import { DEFAULT_SL_TICKS, DEFAULT_TP_TICKS } from '../types'
import { isTradePanelTradingEnabled } from '../../../../../utils/tradePanelTrading'
import { resolvePracticeInstrumentTicks } from '../../../../../services/practice/practiceInstrumentTicks'
import {
  formatPracticePositionFamily,
  practiceContractRoot,
  practiceMicroRoot,
} from '../../../../../services/practice/practiceContractFamily'

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
  } | null>(null)
  const [autoMessage, setAutoMessage] = useState<string | null>(null)
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
  const automaticMicroRoot = props.autoRiskContractRouting
    ? practiceContractRoot(props.riskExecutionProductRoot || '') || practiceMicroRoot(chartRoot)
    : null
  const riskExecutionRoot = automaticMicroRoot || currentTradeRoot
  const riskTicks = automaticMicroRoot
    ? resolvePracticeInstrumentTicks(riskExecutionRoot)
    : { tickSize, tickValue }
  const riskDollarEnabled = riskTicks.tickValue > 0
  const riskMaxQty = props.getMaxQuantityForSymbol?.(riskExecutionRoot) ?? maxQty
  const executionRoutingPending = Boolean(
    automaticMicroRoot &&
    !props.riskExecutionProductRoot &&
    currentTradeRoot !== riskExecutionRoot
  )
  const positionFamilySummary = props.getPositionFamilySummary?.() ?? null
  const orderEntryReference = refPrice
  const spread =
    bid != null && ask != null && ask >= bid ? Math.round((ask - bid) * 100) / 100 : null
  const qtyNum = parseInt(String(props.quantity).replace(/\D/g, ''), 10) || 0

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
  }, [riskSettings.riskPerTrade, riskSettings.riskBuffer, riskSettings.sizingBasis, refPrice, stopLossOn, slPrice, slTicks, slDistanceUnit, takeProfitOn, tpPrice, tpTicks, tpDistanceUnit, selectedSide, riskTicks.tickSize, riskTicks.tickValue, riskMaxQty, riskDollarEnabled, chartStopSelected])

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
    const selectChartPrice = (pickedPrice: number) => {
      if (selectionCommitted) return
      const liveEntry = liveEntryRef.current ?? entry
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
        return
      }
      selectionCommitted = true
      cancelPricePickRef.current?.()
      cancelPricePickRef.current = null
      cancelPositionPreviewRef.current?.()
      cancelPositionPreviewRef.current = null
      setArmedSide(null)
      setSelectedSide(side)
      const ticks = Math.abs(Math.round((liveEntry - pickedPrice) / tickSize))
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
      setAutoSubmitRequest({ side, price: pickedPrice, basis })
      setAutoMessage('Calculating contract size…')
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
        appearanceAt: (price) => {
          const liveEntry = liveEntryRef.current ?? entry
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
            riskTicks.tickSize,
            riskTicks.tickValue,
            riskMaxQty,
            riskSettings.riskBuffer
          )
          const dollars = (sizing.quantity > 0
            ? sizing.plannedRisk
            : sizing.perContractRisk
          ).toLocaleString(undefined, { maximumFractionDigits: 2 })
          return {
            label: `${mode === 'auto' ? (previewSide === 'buy' ? 'Long' : 'Short') + ' · ' : ''}${sizing.quantity > 0 ? 'Risk' : '1 contract'} $${dollars}`,
            quantityLabel: sizing.quantity > 0 ? `${sizing.quantity} ${riskExecutionRoot}` : 'Over risk',
          }
        },
      })
    }

    if (!cancel && !cancelPositionPreviewRef.current) {
      setArmedSide(null)
      setAutoMessage('Chart stop selection is unavailable.')
    }
  }, [armedSide, ask, bid, book?.last, cancelChartStopPick, marketPrice, props.pickChartPriceOnce, props.showAutoPositionPreview, riskExecutionRoot, riskMaxQty, riskSettings.riskBuffer, riskSettings.riskPerTrade, riskSettings.sizingBasis, riskTicks.tickSize, riskTicks.tickValue, tickSize, tickValue])

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
      executionRoutingPending ||
      !riskSizing ||
      riskSizing.quantity < 1
    ) return
    if (Number.parseInt(String(props.quantity), 10) === riskSizing.quantity) return
    props.onQuantityInputChange(String(riskSizing.quantity))
  }, [executionRoutingPending, props.quantity, props.onQuantityInputChange, riskSizing])

  useEffect(() => {
    if (!autoSubmitRequest || executionRoutingPending) return
    if (!riskSizing || riskSizing.quantity < 1) {
      setAutoMessage('The selected level cannot be sized within this amount.')
      setAutoSubmitRequest(null)
      return
    }
    if (Number.parseInt(String(props.quantity), 10) !== riskSizing.quantity) return

    setAutoSubmitRequest(null)
    setAutoMessage(
      `Submitting ${riskSizing.quantity} ${riskExecutionRoot} contract${riskSizing.quantity === 1 ? '' : 's'}…`
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
    }
    if (props.onSubmitOrder) {
      props.onSubmitOrder(autoSubmitRequest.side, brackets, {
        orderType: 'market',
        executionSymbol: riskExecutionRoot,
      })
    } else if (autoSubmitRequest.side === 'buy') {
      props.onBuy()
    } else {
      props.onSell()
    }
    setAutoMessage(
      `Order sent: ${riskSizing.quantity} ${riskExecutionRoot}. Drag the chart bracket to adjust it.`
    )
  // resolveBracketPrice intentionally reads the current take-profit state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmitRequest, chartStopSelected, executionRoutingPending, props.quantity, props.onSubmitOrder, riskExecutionRoot, riskSettings.softStopTrigger, riskSettings.stopLossMode, riskSizing])

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
    const entry = parseOrderEntry()
    if (entry == null || qtyNum <= 0 || !riskDollarEnabled) return null
    const sl = stopLossOn && chartStopSelected ? parseBracketPriceInput(slPrice) : null
    const tp = takeProfitOn ? parseBracketPriceInput(tpPrice) : null
    const risk = sl != null
      ? bracketDollarAmount(entry, sl, qtyNum, riskTicks.tickSize, riskTicks.tickValue)
      : null
    const reward = tp != null
      ? bracketDollarAmount(entry, tp, qtyNum, riskTicks.tickSize, riskTicks.tickValue)
      : null
    if (risk == null && reward == null) return null
    const parts: string[] = []
    if (risk != null) parts.push(`Risk $${risk.toLocaleString()}`)
    if (reward != null) parts.push(`Reward $${reward.toLocaleString()}`)
    if (risk != null && reward != null && risk > 0) {
      parts.push(`1:${(Math.round((reward / risk) * 10) / 10).toLocaleString()}`)
    }
    return parts.join(' · ')
    // parseOrderEntry intentionally reads the current ticket entry fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refPrice, qtyNum, riskDollarEnabled, stopLossOn, chartStopSelected, slPrice, takeProfitOn, tpPrice, riskTicks.tickSize, riskTicks.tickValue])

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <fieldset
        disabled={tradeDisabled}
        className="flex flex-col flex-1 min-h-0 overflow-hidden border-0 m-0 p-0 min-w-0"
      >
      <div className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-1 pb-32 sm:gap-3">
        <div className={`rounded-xl border ${surface}`}>
          <div className={`flex items-center justify-between border-b px-3 py-2.5 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}>
            <div className="min-w-0">
              <p className={`truncate text-[10px] font-semibold uppercase tracking-[0.12em] ${mutedText}`}>
                {symbolLabel || 'Instrument'}
              </p>
              <p className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${strongText}`}>
                {marketPrice != null ? fmtPrice(marketPrice) : '—'}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-[9px] uppercase tracking-wide ${mutedText}`}>Spread</p>
              <p className={`mt-0.5 font-mono text-xs tabular-nums ${strongText}`}>
                {spread != null ? fmtPrice(spread) : '—'}
              </p>
            </div>
          </div>

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
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${mutedText}`}>Related positions</span>
              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-semibold text-violet-400">
                {positionFamilySummary.microSymbol
                  ? `${positionFamilySummary.miniSymbol}/${positionFamilySummary.microSymbol}`
                  : positionFamilySummary.miniSymbol}
              </span>
            </div>
            <p className={`mt-1 font-mono text-[11px] font-semibold tabular-nums ${strongText}`}>
              {formatPracticePositionFamily(positionFamilySummary)}
            </p>
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
                      ? 'Browser-managed: closes the full position only after a 1-minute bar closes beyond the line. Keep this page open and connected.'
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

          <div className={`rounded-xl border p-3 ${surface}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-semibold ${strongText}`}>Contracts</span>
              <span className={`text-[9px] ${mutedText}`}>
                Auto ${riskExecutionRoot} · $${riskSettings.riskPerTrade} {riskSettings.sizingBasis === 'stop_loss' ? 'risk' : 'target'} · Max {riskMaxQty}
              </span>
            </div>

            <div className={`mt-2 rounded-lg border px-3 py-2.5 ${isDark ? 'border-blue-500/25 bg-blue-500/5' : 'border-blue-200 bg-blue-50'}`}>
                {!riskDollarEnabled ? (
                  <p className={`text-[10px] ${mutedText}`}>This contract does not report a tick value, so size cannot be calculated.</p>
                ) : executionRoutingPending ? (
                  <p className="text-[10px] font-medium text-blue-400">Switching execution contract to {riskExecutionRoot}…</p>
                ) : !riskSizing ? (
                  <p className="text-[10px] font-medium text-amber-500">
                    Choose a valid {riskSettings.sizingBasis === 'stop_loss' ? 'stop' : 'take profit'} on the correct side of the entry.
                  </p>
                ) : riskSizing.quantity < 1 ? (
                  <p className="text-[10px] font-medium text-amber-500">
                    One contract risks ${riskSizing.perContractRisk.toLocaleString()}, above your ${riskSettings.riskPerTrade.toLocaleString()} limit.
                  </p>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={`font-mono text-lg font-semibold tabular-nums ${strongText}`}>
                        {riskSizing.quantity} {riskExecutionRoot} contract{riskSizing.quantity === 1 ? '' : 's'}
                      </p>
                      <p className={`font-mono text-[9px] tabular-nums ${mutedText}`}>
                        ${riskSizing.perContractRisk.toLocaleString()} each · ${riskSizing.plannedRisk.toLocaleString()} planned {riskSettings.sizingBasis === 'stop_loss' ? 'risk' : 'target'}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-500/15 px-2 py-1 text-[9px] font-semibold text-blue-400">
                      Applied
                    </span>
                  </div>
                )}
            </div>
            {riskSummary ? (
              <p className={`mt-2 font-mono text-[10px] tabular-nums ${mutedText}`}>
                {riskSummary}
              </p>
            ) : null}
          </div>

        </section>
      </div>

      </fieldset>
    </div>
  )
}
