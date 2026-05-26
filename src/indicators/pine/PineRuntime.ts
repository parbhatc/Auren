import type { BaseIndicator } from '../base/BaseIndicator'
import type { PineJS, PineJSContext } from '../types'

/**
 * PineScript-like runtime — series accessors, inputs, and helpers inside `main()`.
 *
 * @example
 * const p = this.pine(context)
 * if (p.close > p.close(1)) return p.close
 * const len = p.input.int('check_bars')
 */
export class PineRuntime {
  /** Pine `na` — not-a-number sentinel. */
  readonly na = NaN

  constructor(
    private readonly indicator: BaseIndicator,
    private readonly context: PineJSContext,
    private readonly PineJS: PineJS,
    private readonly seriesId = 'current'
  ) {}

  /** Current bar index (0-based, increments once per new bar). */
  get bar_index(): number {
    return this.indicator.getBarIndex()
  }

  /** Bars between `timeMs` and the latest bar (0 = latest bar). */
  barsBack(timeMs: number): number {
    return this.indicator.barsBackFromLatest(timeMs)
  }

  /** True when `timeMs` is within the last `lookback` bars. */
  inLookback(timeMs: number, lookback: number): boolean {
    return this.indicator.isWithinLookback(timeMs, lookback)
  }

  open(offset = 0): number {
    return this.ohlc('open', offset)
  }

  high(offset = 0): number {
    return this.ohlc('high', offset)
  }

  low(offset = 0): number {
    return this.ohlc('low', offset)
  }

  close(offset = 0): number {
    return this.ohlc('close', offset)
  }

  /** Current bar OHLC shortcuts — Pine-style (`p.o`, `p.h`, `p.l`, `p.c`). */
  get o(): number {
    return this.open(0)
  }
  get h(): number {
    return this.high(0)
  }
  get l(): number {
    return this.low(0)
  }
  get c(): number {
    return this.close(0)
  }

  /** Bar open time in ms (Pine `time`). */
  time(offset = 0): number {
    const c = this.indicator.candle(offset, this.seriesId)
    return c?.time ?? this.na
  }

  /** Bar open time in seconds. */
  timeSec(offset = 0): number {
    const t = this.time(offset)
    return Number.isFinite(t) ? t / 1000 : this.na
  }

  hl2(offset = 0): number {
    return (this.high(offset) + this.low(offset)) / 2
  }

  hlc3(offset = 0): number {
    return (this.high(offset) + this.low(offset) + this.close(offset)) / 3
  }

  ohlc4(offset = 0): number {
    return (this.open(offset) + this.high(offset) + this.low(offset) + this.close(offset)) / 4
  }

  nz(value: number, replacement = 0): number {
    return Number.isFinite(value) ? value : replacement
  }

  /** Read a registered study input by id. */
  get(id: string): unknown {
    return this.indicator.getInputValueById(id)
  }

  /** Typed input accessors (PineScript-style). Falls back to study input defval when not cached yet. */
  readonly input = {
    bool: (id: string) => {
      const stored = this.indicator.getInputValueById(id)
      if (stored !== undefined) return Boolean(stored)
      const def = this.indicator.inputs.find((i) => i.id === id)
      return Boolean(def?.defval ?? false)
    },
    int: (id: string, fallback = 0) => {
      const stored = this.indicator.getInputValueById(id)
      if (stored !== undefined) {
        const v = Number(stored)
        return Number.isFinite(v) ? v : fallback
      }
      const def = this.indicator.inputs.find((i) => i.id === id)
      const v = Number(def?.defval)
      return Number.isFinite(v) ? v : fallback
    },
    float: (id: string, fallback = 0) => {
      const stored = this.indicator.getInputValueById(id)
      if (stored !== undefined) {
        const v = Number(stored)
        return Number.isFinite(v) ? v : fallback
      }
      const def = this.indicator.inputs.find((i) => i.id === id)
      const v = Number(def?.defval)
      return Number.isFinite(v) ? v : fallback
    },
    string: (id: string, fallback = '') => {
      const stored = this.indicator.getInputValueById(id)
      if (stored !== undefined) return String(stored)
      const def = this.indicator.inputs.find((i) => i.id === id)
      return def?.defval != null ? String(def.defval) : fallback
    },
    color: (id: string, fallback = '#ffffff') => {
      const stored = this.indicator.getInputValueById(id)
      if (stored !== undefined) return String(stored)
      const def = this.indicator.inputs.find((i) => i.id === id)
      return def?.defval != null ? String(def.defval) : fallback
    },
  }

  /** Bar time from Pine context (ms), without feeding the candle chain. */
  contextTime(): number {
    return this.PineJS.Std.time(this.context)
  }

  /** Candle already stored for `timeMs` (ms), or null if that bar was never fed. */
  candleAtTime(timeMs: number): import('../base/CandleNode').CandleNode | null {
    const map = this.indicator.candleMap?.get(this.seriesId)
    return map?.get(timeMs) ?? null
  }

  /** Last bar in the linked chain for this series. */
  latestCandle(): import('../base/CandleNode').CandleNode | null {
    return this.indicator.latestCandle?.get(this.seriesId) ?? null
  }

  /** Feed current context bar into the candle chain; returns the node or null on duplicate tick. */
  feedCandle(): import('../base/CandleNode').CandleNode | null {
    const time = this.contextTime()
    const open = this.PineJS.Std.open(this.context)
    const high = this.PineJS.Std.high(this.context)
    const low = this.PineJS.Std.low(this.context)
    const close = this.PineJS.Std.close(this.context)
    return this.indicator.processCandle(time, open, high, low, close, this.seriesId)
  }

  /** Process current bar OHLCV into the candle chain; returns false on duplicate tick. */
  feed(): boolean {
    return this.feedCandle() != null
  }

  private ohlc(field: 'open' | 'high' | 'low' | 'close', offset: number): number {
    const c = this.indicator.candle(offset, this.seriesId)
    if (!c) return this.na
    return c[field]
  }
}
