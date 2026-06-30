import WebSocketBase from './WebSocketBase.js'
import aggregateBars from '../utils/BarAggregator.js'
import { csvFolderForChartResolution } from '../utils/backtesterCsvPaths.js'
import { parseBacktesterResolution, isSubMinuteResolution, capReplayWallForResolution, resolutionToSeconds, resolutionToMinutes } from '../utils/backtesterResolution.js'
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
    this.subscriptions = new Map()
    this.symbols = new Map()
    this.session = null
    this.barCache = null
    this.runtimeUserId = null
    this.runtimeSessionId = null
  }

  getClientSubscriptions(clientId) {
    if (!this.subscriptions.has(clientId)) {
      this.subscriptions.set(clientId, new Map())
    }
    return this.subscriptions.get(clientId)
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
    const { direction, currentDate, sessionId, sessionName } = data
    const [year, month, day] = currentDate.split('-').map(Number)
    const [hours, minutes] = this.session.startTime.split(':').map(Number)
    const targetDate = new Date(year, month - 1, day, hours, minutes, 0, 0)
    const symbols = this.getNavigationSymbols()

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

  clearSymbolBarCache() {
    if (this.runtimeUserId && this.runtimeSessionId) {
      getBacktesterBarsService().clearSymbolBarCache(this.runtimeUserId, this.runtimeSessionId)
      return
    }
    this.barCache?.clearAll?.()
  }

  getNavigationSymbols() {
    const fromConfig = Array.from(this.symbols.keys())
    if (fromConfig.length > 0) {
      return fromConfig
    }
    const sessionSymbol = this.session?.symbol
    if (sessionSymbol && sessionSymbol !== 'MULTI') {
      return [sessionSymbol]
    }
    return ['NQ', 'ES', 'MNQ', 'MES', 'GC', 'MGC']
  }

  onSessionData(ws, data, clientInfo, serverInfo) {
    const { session, symbols } = data

    for (const symbol of Object.keys(symbols)) {
      this.symbols.set(symbol, symbols[symbol])
    }
    
    if (session && session.startDate && session.startTime) {
      const userId = clientInfo?.userId || clientInfo?.id || 'unknown'
      const runtime = getBacktesterBarsService().initRuntime(userId, session, symbols)
      this.runtimeUserId = userId
      this.runtimeSessionId = session.id
      this.session = runtime.session
      this.barCache = runtime.barCache

      const startDate = getBacktesterBarsService().sessionAnchorDate(session)
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
    this.session.symbol = symbol;
    this.send(ws, {
      type: "symbol_change_response",
      success: true,
    })
  }

  onSubscribeBars(ws, data, clientInfo, serverInfo) {
    const { symbol, resolution, subscriberUID } = data
    const clientId = clientInfo?.userId || clientInfo?.id || 'unknown'
    const subscriptions = this.getClientSubscriptions(clientId)
    
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
    const clientId = clientInfo?.userId || clientInfo?.id || 'unknown'
    const subscriptions = this.getClientSubscriptions(clientId)
    
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
    console.log("onReplay: ", data);
    console.log("Time: " + new Date(time * 1000).toLocaleString());
    this.clearSymbolBarCache()
    this.barCache.last = new Date(time * 1000);
    this.send(ws, {
      type: 'replayResponse',
      time: new Date(time * 1000).toLocaleString()
    })
    return true;
  }
  
  onChangeDate(ws, targetDate, clientInfo, serverInfo){
        // Get all active symbols from subscriptions
        // this.subscriptions is a Map of Maps: clientId -> Map<subscriberUID, subscription>
        const activeSymbols = []
        for (const clientSubscriptions of this.subscriptions.values()) {
          for (const subscription of clientSubscriptions.values()) {
            if (subscription.symbol) {
              activeSymbols.push(subscription.symbol)
            }
          }
        }
        const uniqueSymbols = [...new Set(activeSymbols)]
        
        // If no subscriptions, check all available symbols from this.symbols Map
        const symbolsToCheck = uniqueSymbols.length > 0 ? uniqueSymbols : Array.from(this.symbols.keys())
        
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
        this.clearSymbolBarCache()
        const startDate = this.formatLocalDate(finalDate)
        if (this.runtimeUserId && this.runtimeSessionId) {
          getBacktesterBarsService().updateSessionAnchor(
            this.runtimeUserId,
            this.runtimeSessionId,
            finalDate,
            startDate,
          )
        }
        this.barCache.last = finalDate;
        if (this.session) {
          this.session.startDate = startDate
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
    if (!this.barCache?.last) {
      this.barCache.last = new Date(cursorMs)
      return true
    }
    if (cursorMs > this.barCache.last.getTime()) {
      this.barCache.last = new Date(cursorMs)
    }
    return true
  }

  onNextCandle(ws, data, clientInfo, serverInfo) {
      const { playbackTimeframe, cursorSec, stepSec, targetSec } = data
      const last = this.barCache.last;

      if (!last){
          console.log("No cached data for replay next");
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

      console.log({
          stepWallSec,
          stepResolution,
          baseSec,
          targetWallSec,
          last: last.toLocaleString(),
      })

      const groups = new Map()

      for (const clientSubscriptions of this.subscriptions.values()) {
        for (const [uid, sub] of clientSubscriptions.entries()) {
          const key = `${sub.symbol}:${sub.resolution}`
          if (!groups.has(key)) {
            groups.set(key, { symbol: sub.symbol, resolution: sub.resolution, uids: [] })
          }
          groups.get(key).uids.push(uid)
        }
      }

      for (const group of groups.values()) {
        const { symbol, resolution, uids } = group
        const subRes = parseBacktesterResolution(resolution)
        const nativeSubMinute = isSubMinuteResolution(subRes)
        const csvResolution = csvFolderForChartResolution(subRes)
        const capSec = capReplayWallForResolution(targetWallSec, stepResolution, subRes)
        const capMs = capSec * 1000

        const loadOpts = { csvResolution }
        const newestMs = this.barCache.getNewest(symbol, loadOpts)
        let afterMs = newestMs ?? last.getTime()
        if (cursorSec != null && Number.isFinite(Number(cursorSec))) {
          afterMs = Math.max(afterMs, Number(cursorSec) * 1000)
        }

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
            this.barCache.addBars(symbol, bars, loadOpts)
          }
        } else {
          const minuteOpts = { csvResolution: '1m' }
          const resolutionMinutes = Math.max(1, resolutionToMinutes(subRes))
          const fetchBars = Math.max(1, Math.ceil(stepWallSec / (resolutionMinutes * 60)))
          bars = this.barCache.loadForward(symbol, afterMs, fetchBars, minuteOpts)
          bars = bars.filter((bar) => bar.time <= capMs)
        }

        if (!bars.length) {
          console.log(`No forward bars for ${symbol}@${resolution} through ${new Date(capMs).toLocaleString()}`)
          continue
        }

        for (const bar of bars) {
          console.log("bar: " + symbol + " " + new Date(bar.time).toLocaleString())
        }

        for (const uid of uids) {
          if (nativeSubMinute) {
            for (const bar of bars) {
              this.send(ws, {
                type: "realtimeBar",
                subscriberUID: uid,
                candle: bar
              })
            }
            continue
          }

          let barsToAggregate = bars
          if (subRes !== '1') {
            const resolutionMinutes = this.getResolutionInMinutes(resolution)
            const allCachedBars = this.barCache.getAllBars(symbol, { csvResolution: '1m' })

            if (allCachedBars.length > 0) {
              const capDate = new Date(capMs)
              const minutes = capDate.getMinutes()
              const alignedMinutes = Math.floor(minutes / resolutionMinutes) * resolutionMinutes
              const currentCandleStart = new Date(capMs)
              currentCandleStart.setMinutes(alignedMinutes, 0, 0)
              currentCandleStart.setSeconds(0, 0)
              barsToAggregate = allCachedBars.filter(bar => bar.time >= currentCandleStart.getTime())
            }
          }

          const aggregatedBars = aggregateBars(barsToAggregate, resolution)
          if (!aggregatedBars.length) continue

          for (const bar of aggregatedBars) {
            if (bar.time > capMs) continue
            this.send(ws, {
              type: "realtimeBar",
              subscriberUID: uid,
              candle: bar
            })
          }
        }
      }

      this.barCache.last = new Date(targetWallSec * 1000)
      return true;
    }

  handleClose(ws, clientInfo, serverInfo) {
    const clientId = clientInfo?.userId || clientInfo?.id || 'unknown'
    if (this.subscriptions.has(clientId)) {
      const count = this.subscriptions.get(clientId).size
      this.subscriptions.delete(clientId)
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
