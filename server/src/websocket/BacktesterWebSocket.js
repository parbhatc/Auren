import WebSocketBase from './WebSocketBase.js'
import aggregateBars from '../utils/BarAggregator.js'
import { csvFolderForChartResolution } from '../utils/backtesterCsvPaths.js'
import { parseBacktesterResolution, isSubMinuteResolution, capReplayWallForResolution, resolutionToSeconds, resolutionToMinutes, alignTimeToResolutionSec, alignBarOpenSec } from '../utils/backtesterResolution.js'
import { getBacktesterBarsService } from '../services/BacktesterBarsService.js'

class BacktesterWebSocket extends WebSocketBase {

  constructor(server) {
    super({
      serverName: 'backtester',
      path: '/backtester-ws',
      enableHeartbeat: true,
      heartbeatInterval: 5000,
      heartbeatTimeout: 15000,
      pingMessage: 'ServerTime',
      pongMessage: 'ClientTime'
    })
    
    this.server = server;
    this.csvLoader = this.server.csvLoader;
    // BacktesterWebSocket is a singleton shared by every connected client.
    // Replay state must therefore be scoped to the physical WebSocket, not the
    // authenticated user. A user can briefly have two sockets during React
    // StrictMode remounts (or intentionally open two replay tabs).
    this.connections = new Map()
  }

  getConnectionId(clientInfo) {
    return clientInfo?.id || clientInfo?.userId || 'unknown'
  }

  getClientState(clientInfo, create = true) {
    const connectionId = this.getConnectionId(clientInfo)
    let state = this.connections.get(connectionId)
    if (!state && create) {
      state = {
        subscriptions: new Map(),
        symbols: new Map(),
        session: null,
        barCache: null,
        cursor: null,
        runtimeUserId: null,
        runtimeSessionId: null,
      }
      this.connections.set(connectionId, state)
    }
    return state ?? null
  }

  getClientSubscriptions(clientInfo) {
    return this.getClientState(clientInfo).subscriptions
  }

  onMessage(ws, data, clientInfo, serverInfo) {
    if (!data || typeof data !== 'object' || !data.type) {
      console.log('[backtester WS] Unhandled message:', data)
      return
    }

    switch (data.type) {
      case 'date_navigation':
        this.onDateNavigation(ws, data, clientInfo, serverInfo)
        break
      case 'sessionData':
        this.onSessionData(ws, data, clientInfo, serverInfo)
        break;
        case 'symbol_change':
          this.onSymbolChange(ws, data, clientInfo, serverInfo)
        break
      case 'subscribeBars':
        this.onSubscribeBars(ws, data, clientInfo, serverInfo)
        break
      case 'unsubscribeBars':
        this.onUnsubscribeBars(ws, data, clientInfo, serverInfo)
        break
      case 'replay':
        this.onReplay(ws, data, clientInfo, serverInfo)
        break
      case 'nextCandle':
        this.onNextCandle(ws, data, clientInfo, serverInfo)
        break
      case 'syncReplayCursor':
        this.onSyncReplayCursor(ws, data, clientInfo, serverInfo)
        break
      default:
        console.log('[backtester WS] Unhandled message type:', data.type)
    }
  }

  onDateNavigation(ws, data, clientInfo, serverInfo) {
    const state = this.getClientState(clientInfo, false)
    if (!state?.session?.startTime) {
      this.send(ws, {
        type: 'date_navigation_response',
        success: false,
        error: 'Replay session is not initialized',
      })
      return true
    }
    const { direction, currentDate, sessionId, sessionName } = data
    const [year, month, day] = currentDate.split('-').map(Number)
    const [hours, minutes] = state.session.startTime.split(':').map(Number)
    const targetDate = new Date(year, month - 1, day, hours, minutes, 0, 0)
    const symbols = this.getNavigationSymbols(clientInfo)

    switch (direction) {
      case 'calendar':
        this.onChangeDate(ws, targetDate, clientInfo, serverInfo)
        break
        case 'previous':
          let previousDate = this.csvLoader.findPreviousDayWithDataForAnySymbol(symbols, targetDate, true);

          if(!previousDate){
            this.send(ws, {
              type: "date_navigation_response",
              success: false,
              date: currentDate,
              error: "No previous data found"
            });
            return true;
          }
          this.onChangeDate(ws, previousDate, clientInfo, serverInfo)
        break;
      case 'next':
        let nextDate = this.csvLoader.findNextDayWithDataForAnySymbol(symbols, targetDate, true);
        if(!nextDate){
          this.send(ws, {
            type: "date_navigation_response",
            success: false,
            date: currentDate,
            error: "No next data found"
          });
          return true;
        }
        this.onChangeDate(ws, nextDate, clientInfo, serverInfo)
        break;
    }
    return true;
  }

  formatLocalDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  clearSymbolBarCache(clientInfo) {
    const state = this.getClientState(clientInfo, false)
    if (!state) return
    if (state.runtimeUserId && state.runtimeSessionId) {
      getBacktesterBarsService().clearSymbolBarCache(state.runtimeUserId, state.runtimeSessionId)
      return
    }
    state.barCache?.clearAll?.()
  }

  getNavigationSymbols(clientInfo) {
    const state = this.getClientState(clientInfo, false)
    const fromConfig = Array.from(state?.symbols?.keys?.() ?? [])
    if (fromConfig.length > 0) {
      return fromConfig
    }
    const sessionSymbol = state?.session?.symbol
    if (sessionSymbol && sessionSymbol !== 'MULTI') {
      return [sessionSymbol]
    }
    return ['NQ', 'ES', 'MNQ', 'MES', 'GC', 'MGC']
  }

  onSessionData(ws, data, clientInfo, serverInfo) {
    const { session, symbols = {} } = data
    const state = this.getClientState(clientInfo)
    state.symbols.clear()

    for (const symbol of Object.keys(symbols)) {
      state.symbols.set(symbol, symbols[symbol])
    }
    
    if (session && session.startDate && session.startTime) {
      const userId = clientInfo?.userId || clientInfo?.id || 'unknown'
      const runtime = getBacktesterBarsService().initRuntime(userId, session, symbols)
      state.runtimeUserId = userId
      state.runtimeSessionId = session.id
      state.session = { ...runtime.session }
      state.barCache = runtime.barCache

      const startDate = getBacktesterBarsService().sessionAnchorDate(session)
      state.cursor = startDate
      console.log(`[backtester WS] Session data received:`, session.id, `Start: ${startDate.toLocaleString()}`)
      this.send(ws, {
        type: 'sessionDataAck',
        sessionId: session.id,
      })
    } else {
      console.warn(`[backtester WS] Session data missing startDate or startTime:`, session)
    }
  }

  onSymbolChange(ws, data, clientInfo, serverInfo) {
    const { symbol } = data
    const state = this.getClientState(clientInfo, false)
    if (state?.session) state.session.symbol = symbol
    this.send(ws, {
      type: "symbol_change_response",
      success: true,
    })
  }

  onSubscribeBars(ws, data, clientInfo, serverInfo) {
    const { symbol, resolution, subscriberUID } = data
    const clientId = this.getConnectionId(clientInfo)
    const subscriptions = this.getClientSubscriptions(clientInfo)
    
    subscriptions.set(subscriberUID, {
      symbol,
      resolution,
      subscriberUID,
      subscribedAt: Date.now()
    })
    
    console.log(`[backtester WS] Subscription added: ${subscriberUID} for ${symbol}@${resolution} (client: ${clientId})`)
  }

  onUnsubscribeBars(ws, data, clientInfo, serverInfo) {
    const { subscriberUID } = data
    const clientId = this.getConnectionId(clientInfo)
    const subscriptions = this.getClientSubscriptions(clientInfo)
    
    if (subscriptions.has(subscriberUID)) {
      subscriptions.delete(subscriberUID)
      console.log(`[backtester WS] Subscription removed: ${subscriberUID} (client: ${clientId})`)
    }
  }

  toEpochMs(value) {
    return getBacktesterBarsService().toEpochMs(value)
  }

  sanitizeBarsForWire(bars) {
    return getBacktesterBarsService().sanitizeBarsForWire(bars)
  }

  onReplay(ws, data, clientInfo, serverInfo){
    const { time } = data
    const state = this.getClientState(clientInfo, false)
    if (!state?.barCache) {
      this.send(ws, { type: 'error', message: 'Replay session is not initialized' })
      return true
    }
    console.log("onReplay: ", data);
    console.log("Time: " + new Date(time * 1000).toLocaleString());
    this.clearSymbolBarCache(clientInfo)
    state.cursor = new Date(time * 1000)
    state.barCache.last = state.cursor
    this.send(ws, {
      type: 'replayResponse',
      time: new Date(time * 1000).toLocaleString()
    })
    return true;
  }
  
  onChangeDate(ws, targetDate, clientInfo, serverInfo){
        const state = this.getClientState(clientInfo, false)
        if (!state?.barCache) {
          this.send(ws, {
            type: 'date_navigation_response',
            success: false,
            error: 'Replay session is not initialized',
          })
          return true
        }
        // Get all active symbols from subscriptions
        const activeSymbols = []
        for (const subscription of state.subscriptions.values()) {
            if (subscription.symbol) {
              activeSymbols.push(subscription.symbol)
            }
        }
        const uniqueSymbols = [...new Set(activeSymbols)]
        
        // If no subscriptions, check all available symbols from this connection.
        const symbolsToCheck = uniqueSymbols.length > 0 ? uniqueSymbols : Array.from(state.symbols.keys())
        
        // Check if targetDate exists in the data
        if (!this.csvLoader.hasDateDataForAnySymbol(symbolsToCheck, targetDate)) {
            console.error(`[BacktesterWebSocket] Date ${targetDate.toLocaleDateString()} does not exist in CSV data for symbols: ${symbolsToCheck.join(', ')}`);
            this.send(ws, {
                type: "change_date_response",
                success: false,
                date: targetDate.toLocaleString(),
                error: `Date ${targetDate.toLocaleDateString()} does not exist in data`
            });
            return true;
        }
        
        // Check if the exact time exists
        const targetTime = targetDate.getTime();
        let finalDate = targetDate;
        let isExactMatch = false;
        
        // Check if exact candle exists by looking for bars at that exact time across all symbols
        for (const symbol of symbolsToCheck) {
            const monthBars = this.csvLoader.getMonthData(
                symbol, 
                targetDate.getFullYear(), 
                targetDate.getMonth()
            );
            if (monthBars.some(bar => bar.time === targetTime)) {
                isExactMatch = true;
                break;
            }
        }
        
        // If exact candle doesn't exist, find the closest one
        if (!isExactMatch) {
            console.log(`Exact candle not found at ${targetDate.toLocaleString()}, searching for closest...`);
            const closestBar = this.csvLoader.findClosestCandleForAnySymbol(symbolsToCheck, targetTime);
            
            if (closestBar) {
                finalDate = new Date(closestBar.time);
                const timeDiff = Math.abs(closestBar.time - targetTime);
                const minutesDiff = Math.floor(timeDiff / (1000 * 60));
                console.log(`Found closest candle at ${finalDate.toLocaleString()} (${minutesDiff} minutes away)`);
            } else {
                // No data found at all
                console.warn(`No data found for date ${targetDate.toLocaleDateString()} in CSV files for symbols: ${symbolsToCheck.join(', ')}`);
                this.send(ws, {
                    type: "change_date_response",
                    success: false,
                    date: targetDate.toLocaleString(),
                    error: `No data found for ${targetDate.toLocaleDateString()}`
                });
                return true;
            }
        }
        
        // Drop stale symbol bars so the next getBars load is contiguous from the new anchor.
        this.clearSymbolBarCache(clientInfo)
        const startDate = this.formatLocalDate(finalDate)
        if (state.runtimeUserId && state.runtimeSessionId) {
          getBacktesterBarsService().updateSessionAnchor(
            state.runtimeUserId,
            state.runtimeSessionId,
            finalDate,
            startDate,
          )
        }
        state.cursor = finalDate
        state.barCache.last = finalDate;
        if (state.session) {
          state.session.startDate = startDate
        }
        console.log(`Date changed to: ${finalDate.toLocaleString()}${isExactMatch ? '' : ' (closest match)'}`);
        this.send(ws, {
            type: "date_navigation_response",
            success: true,
            date: finalDate.toLocaleString(),
            startDate,
            isExactMatch: isExactMatch,
            originalDate: isExactMatch ? null : targetDate.toLocaleString()
        });
        return true;
  }

  onSyncReplayCursor(ws, data, clientInfo, serverInfo) {
    const cursorMs = this.toEpochMs(data?.cursorSec)
    if (cursorMs == null || !Number.isFinite(cursorMs)) return true
    const state = this.getClientState(clientInfo, false)
    if (!state?.barCache) return true
    if (!state.cursor) {
      state.cursor = new Date(cursorMs)
      state.barCache.last = state.cursor
      return true
    }
    if (cursorMs > state.cursor.getTime()) {
      state.cursor = new Date(cursorMs)
      state.barCache.last = state.cursor
    }
    return true
  }

  onNextCandle(ws, data, clientInfo, serverInfo) {
      const { playbackTimeframe, cursorSec, stepSec, targetSec } = data
      const state = this.getClientState(clientInfo, false)
      const last = state?.cursor ?? state?.barCache?.last

      if (!last){
          console.log("No cached data for replay next");
          this.send(ws, {
            type: 'nextCandleAck',
            cursorSec: Number.isFinite(Number(cursorSec)) ? Math.floor(Number(cursorSec)) : 0,
            emitted: 0,
          })
          return true;
      }

      const stepResolution = playbackTimeframe || '1'
      const stepWallSec = Number(stepSec) > 0
        ? Math.floor(Number(stepSec))
        : Math.max(1, resolutionToSeconds(stepResolution))

      let baseSec = cursorSec != null ? Math.floor(Number(cursorSec)) : Math.floor(last.getTime() / 1000)
      if (!Number.isFinite(baseSec)) baseSec = Math.floor(last.getTime() / 1000)

      const targetWallSec = targetSec != null && Number.isFinite(Number(targetSec))
        ? Math.floor(Number(targetSec))
        : baseSec + stepWallSec

      const groups = new Map()
      let emittedFrames = 0

      for (const [uid, sub] of state.subscriptions.entries()) {
          const key = `${sub.symbol}:${sub.resolution}`
          if (!groups.has(key)) {
            groups.set(key, { symbol: sub.symbol, resolution: sub.resolution, uids: [] })
          }
          groups.get(key).uids.push(uid)
      }

      for (const group of groups.values()) {
        const { symbol, resolution, uids } = group
        const subRes = parseBacktesterResolution(resolution)
        const nativeSubMinute = isSubMinuteResolution(subRes)
        const csvResolution = csvFolderForChartResolution(subRes)
        const capSec = capReplayWallForResolution(targetWallSec, stepResolution, subRes)
        const capMs = capSec * 1000

        // Intrabar replay: a step finer than the chart resolution (e.g. 30s step on
        // a 1m chart) advances the replay clock by the sub-step and rebuilds the
        // currently-forming chart candle from finer data, so its H/L/C update in
        // place (TradingView-style) instead of failing to advance (the 1m cache has
        // no bar before the next full minute). Emits ONE candle stamped at the chart
        // candle open, folded from finer bars whose open time is in [candleStart, targetWall).
        const subResSec = resolutionToSeconds(subRes)
        if (!nativeSubMinute && stepWallSec > 0 && stepWallSec < subResSec) {
          const fineOpts = { csvResolution: csvFolderForChartResolution(stepResolution) }
          const candleStartSec = alignBarOpenSec(targetWallSec - 1, subRes)
          const candleStartMs = candleStartSec * 1000
          const windowEndMs = targetWallSec * 1000
          const fineBars = this.csvLoader
            .loadForward(symbol, candleStartMs - 1, 64, fineOpts)
            .filter((bar) => bar.time >= candleStartMs && bar.time < windowEndMs)
          if (!fineBars.length) continue
          let high = -Infinity
          let low = Infinity
          let volume = 0
          for (const bar of fineBars) {
            if (bar.high > high) high = bar.high
            if (bar.low < low) low = bar.low
            volume += bar.volume || 0
          }
          const partial = {
            time: candleStartMs,
            time_string: new Date(candleStartMs).toLocaleString(),
            open: fineBars[0].open,
            high,
            low,
            close: fineBars[fineBars.length - 1].close,
            volume,
          }
          for (const uid of uids) {
            this.send(ws, { type: "realtimeBars", subscriberUID: uid, candles: [partial] })
          }
          emittedFrames += 1
          continue
        }

        const loadOpts = { csvResolution }
        const newestMs = state.barCache.getNewest(symbol, loadOpts)
        // Full replay wall for this step; capMs is only the last emitted candle OPEN.
        const loadToMs = Math.max(capMs, targetWallSec * 1000)
        // The client cursor is authoritative when provided. Using the cache's
        // newest bar as the floor breaks after any backward move (prev-day nav,
        // rewind): the cache still holds future bars, so loadForward starts past
        // the cap and every step emits nothing — permanently dead stepping.
        let afterMs = cursorSec != null && Number.isFinite(Number(cursorSec))
          ? Number(cursorSec) * 1000
          : (newestMs ?? last.getTime())

        let bars = []
        if (nativeSubMinute) {
          let guard = 0
          while (guard < 64) {
            guard += 1
            const chunk = this.csvLoader.loadForward(symbol, afterMs, 32, loadOpts)
            if (!chunk.length) break
            for (const bar of chunk) {
              if (bar.time <= capMs) bars.push(bar)
            }
            const chunkLast = chunk[chunk.length - 1]
            afterMs = chunkLast.time
            if (chunkLast.time >= capMs) break
            if (chunk.length < 32) break
          }
          if (bars.length) {
            state.barCache.addBars(symbol, bars, loadOpts)
          }
        } else {
          const minuteOpts = { csvResolution: '1m' }
          // Load 1m bars through the FULL replay wall (targetWallSec), not just the
          // emitted candle's open (capMs). With an unaligned cursor (e.g. 9:29 on a
          // 4h chart), capMs is the new candle's open (10:00) while the wall is
          // 13:29 — loading only to capMs left the new candle with one minute of
          // data (wrong OHLC until a history reload re-fetched it).
          const fetchBars = Math.max(1, Math.ceil((loadToMs - afterMs) / 60000))
          bars = state.barCache.loadForward(symbol, afterMs, fetchBars, minuteOpts)
          bars = bars.filter((bar) => bar.time <= loadToMs)
        }

        if (!bars.length) {
          console.log(`No forward bars for ${symbol}@${resolution} through ${new Date(capMs).toLocaleString()}`)
          continue
        }

        // Bars to emit are identical for every uid in the group — compute once.
        let framesToSend = bars
        if (!nativeSubMinute) {
          let barsToAggregate = bars
          if (subRes !== '1') {
            // Aggregate the COMPLETE window from the candle containing the pre-step
            // cursor through the replay wall, loaded straight from the (memory-cached)
            // CSV data. Rebuilding from the WS bar cache broke two ways: the forming
            // candle's head (bars before the replay session started stepping) may
            // only live in the HTTP history service's cache — re-aggregating without
            // it corrupts the candle's open/high/low — and stale cached step bars
            // couldn't complete the previous candle after an unaligned cursor.
            const candleStartMs = alignBarOpenSec(baseSec, resolution) * 1000
            const windowBars = state.barCache.loadRange(symbol, candleStartMs - 1, loadToMs, { csvResolution: '1m' })
            barsToAggregate = windowBars.filter(
              (bar) => bar.time >= candleStartMs && bar.time <= loadToMs,
            )
          }
          framesToSend = aggregateBars(barsToAggregate, resolution).filter(
            (bar) => bar.time <= capMs,
          )
        }
        if (!framesToSend.length) continue

        for (const uid of uids) {
          this.send(ws, {
            type: "realtimeBars",
            subscriberUID: uid,
            candles: framesToSend
          })
        }
        emittedFrames += framesToSend.length
      }

      state.cursor = new Date(targetWallSec * 1000)
      state.barCache.last = state.cursor
      // Always ack — several paths above emit nothing (no fine bars, no forward
      // bars, empty frames, no subscriptions). Without an ack the client's
      // nextCandleInFlight latch waits out its 2s timeout on every such step.
      this.send(ws, {
        type: 'nextCandleAck',
        cursorSec: targetWallSec,
        emitted: emittedFrames,
      })
      return true;
    }

  handleClose(ws, clientInfo, serverInfo) {
    const clientId = this.getConnectionId(clientInfo)
    const state = this.connections.get(clientId)
    if (state) {
      const count = state.subscriptions.size
      this.connections.delete(clientId)
      console.log(`[backtester WS] Cleaned up ${count} subscriptions for client: ${clientId}`)
    }
    super.handleClose(ws, clientInfo, serverInfo)
  }

  isCompleteCandle(date, resolution) {
    const dateObj = new Date(date);
    const res = parseBacktesterResolution(resolution)
    if (isSubMinuteResolution(res)) {
      return true
    }
    const resolutionMinutes = this.getResolutionInMinutes(resolution);
    
    // Handle numeric minute resolutions (1, 2, 5, 15, etc.)
    const numericMatch = resolution.match(/^(\d+)$/);
    if (numericMatch) {
        // For a period starting at aligned time, the last bar needed is (aligned + resolutionMinutes - 1)
        // Example: 2-min period 9:30-9:32 needs bars at 9:30 and 9:31
        // So if last is 9:31, it's complete. If last is 9:30, it's incomplete.
        const minutes = dateObj.getMinutes();
        const alignedMinutes = Math.floor(minutes / resolutionMinutes) * resolutionMinutes;
        const lastBarMinutes = alignedMinutes + resolutionMinutes - 1;
        
        // Check if current minutes is the last bar of the period
        return minutes === lastBarMinutes;
    }
    
    // Handle daily resolution (1D, 2D, etc.)
    const dailyMatch = resolution.match(/^(\d+)D$/);
    if (dailyMatch) {
        // Check if it's at midnight (start of day)
        return dateObj.getHours() === 0 && dateObj.getMinutes() === 0 && dateObj.getSeconds() === 0;
    }
    
    // Handle weekly resolution (1W, 2W, etc.)
    const weeklyMatch = resolution.match(/^(\d+)W$/);
    if (weeklyMatch) {
        // Check if it's Monday at midnight
        return dateObj.getDay() === 1 && dateObj.getHours() === 0 && dateObj.getMinutes() === 0;
    }
    
    // Handle monthly resolution (1M, 2M, etc.)
    const monthlyMatch = resolution.match(/^(\d+)M$/);
    if (monthlyMatch) {
        // Check if it's the 1st of the month at midnight
        return dateObj.getDate() === 1 && dateObj.getHours() === 0 && dateObj.getMinutes() === 0;
    }
    
    // Default: assume complete
    return true;
}

  getBarsNeededToComplete(date, resolution) {
    const dateObj = new Date(date);
    const resolutionMinutes = this.getResolutionInMinutes(resolution);
    
    // Handle numeric minute resolutions (1, 2, 5, 15, etc.)
    const numericMatch = resolution.match(/^(\d+)$/);
    if (numericMatch) {
        const minutes = dateObj.getMinutes();
        const alignedMinutes = Math.floor(minutes / resolutionMinutes) * resolutionMinutes;
        const lastBarMinutes = alignedMinutes + resolutionMinutes - 1;
        
        // Calculate how many bars are still needed
        const barsNeeded = lastBarMinutes - minutes;
        return Math.max(0, barsNeeded); // Return 0 if already complete
    }
    
    // For daily/weekly/monthly, return 0 (too complex to calculate)
    return 0;
}

  getResolutionInMinutes(resolution) {
    // Handle numeric resolutions (minutes)
    const numericMatch = resolution.match(/^(\d+)$/);
    if (numericMatch) {
        return parseInt(numericMatch[1]);
    }
    
    // Handle daily resolution (1D)
    const dailyMatch = resolution.match(/^(\d+)D$/);
    if (dailyMatch) {
        const days = parseInt(dailyMatch[1]) || 1;
        // 24 hours * 60 minutes = 1440 minutes per day
        return days * 1440;
    }
    
    // Handle weekly resolution (1W)
    const weeklyMatch = resolution.match(/^(\d+)W$/);
    if (weeklyMatch) {
        const weeks = parseInt(weeklyMatch[1]) || 1;
        // 7 days per week * 1440 minutes = 10080 minutes per week
        return weeks * 10080;
    }
    
    // Handle monthly resolution (1M)
    const monthlyMatch = resolution.match(/^(\d+)M$/);
    if (monthlyMatch) {
        const months = parseInt(monthlyMatch[1]) || 1;
        // ~30 days per month * 1440 minutes = 43200 minutes per month
        return months * 43200;
    }
    
    // Default to 1 minute if resolution format is unknown
    console.warn(`Unknown resolution format: ${resolution}, defaulting to 1 minute`);
    return 1;
}
}

export default BacktesterWebSocket
