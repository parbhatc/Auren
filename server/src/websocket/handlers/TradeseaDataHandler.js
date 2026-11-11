/**
 * Tradesea Data Handler
 * Handles download, update, overwrite, and reset operations for Tradesea data
 */
import fs from 'fs'
import path from 'path'
import TradeseaIdentityService from '../../services/tradesea/TradeseaIdentityService.js'
import {
  csvFolderForChartResolution,
  ensureMonthFileDir,
  findLatestBarTimestamp,
  monthFilePath,
  monthNameFromIndex,
  resolveMonthFilePath,
} from '../../utils/backtesterCsvPaths.js'
import { parseBacktesterResolution, resolutionToSeconds } from '../../utils/backtesterResolution.js'
import { normalizeTradeseaMarketDataSymbol } from '../../utils/tradeseaMarketDataSymbol.js'

const DEFAULT_HISTORY_CHUNK_SIZE = 5_000

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function historyChunkSize(value) {
  return Math.min(DEFAULT_HISTORY_CHUNK_SIZE, Math.max(500, Math.floor(Number(value) || DEFAULT_HISTORY_CHUNK_SIZE)))
}

function isRateLimited(response) {
  return Number(response?.statusCode) === 429
}

function retryAfterMs(response, fallbackMs) {
  const value = response?.headers?.['retry-after']
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000
  if (value) {
    const timestamp = Date.parse(String(value))
    if (Number.isFinite(timestamp)) return Math.max(0, timestamp - Date.now())
  }
  return fallbackMs
}

class TradeseaDataHandler {
  constructor(websocketInstance, identityService = TradeseaIdentityService, options = {}) {
    this.ws = websocketInstance
    this.identityService = identityService
    const retries = Number(options.historyRetries ?? process.env.TRADESEA_HISTORY_RETRIES)
    const retryBaseMs = Number(options.historyRetryBaseMs ?? process.env.TRADESEA_HISTORY_RETRY_BASE_MS)
    const requestIntervalMs = Number(options.historyRequestIntervalMs ?? process.env.TRADESEA_HISTORY_REQUEST_INTERVAL_MS)
    this.historyRetries = Math.max(0, Number.isFinite(retries) ? retries : 3)
    this.historyRetryBaseMs = Math.max(100, Number.isFinite(retryBaseMs) ? retryBaseMs : 1_000)
    this.historyRequestIntervalMs = Math.max(0, Number.isFinite(requestIntervalMs) ? requestIntervalMs : 350)
    this.wait = options.wait || wait
    this.nextHistoryRequestAt = 0
  }

  async waitForHistorySlot() {
    const delay = Math.max(0, this.nextHistoryRequestAt - Date.now())
    if (delay) await this.wait(delay)
    this.nextHistoryRequestAt = Date.now() + this.historyRequestIntervalMs
  }

  async getHistory(connection, symbol, resolution, countback, from, to) {
    const marketDataSymbol = normalizeTradeseaMarketDataSymbol(
      symbol,
      connection.delayed === true
    )
    const params = new URLSearchParams({
      'connection-user-id': connection.userId,
      'connection-group-id': connection.connectionGroupId,
      symbol: marketDataSymbol,
      resolution,
      from: String(from),
      to: String(to),
      countback: String(countback),
      currencyCode: 'USD',
    })
    let response
    for (let attempt = 0; ; attempt += 1) {
      await this.waitForHistorySlot()
      response = await this.identityService.proxyUdfRequest(
        connection.tokens,
        connection.accountId,
        `/history?${params.toString()}`
      )
      if (!isRateLimited(response) || attempt >= this.historyRetries) break
      const fallback = this.historyRetryBaseMs * (2 ** attempt)
      await this.wait(retryAfterMs(response, fallback))
    }
    let body = response.body
    if (typeof body === 'string') {
      try {
        body = body ? JSON.parse(body) : {}
      } catch {
        throw new Error('Tradesea returned invalid history data')
      }
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      const detail = body?.errmsg || body?.message || body?.error
      throw new Error(
        detail
          ? `Tradesea history request failed: ${detail} (${response.statusCode})`
          : `Tradesea history request failed (${response.statusCode})`
      )
    }
    if (body?.s === 'no_data') return { bars: [] }
    if (body?.s !== 'ok' || !Array.isArray(body.t)) {
      throw new Error(body?.errmsg || body?.message || 'Tradesea history request failed')
    }

    const bars = body.t.map((time, index) => ({
      t: Number(time) * 1000,
      o: Number(body.o?.[index]),
      h: Number(body.h?.[index]),
      l: Number(body.l?.[index]),
      c: Number(body.c?.[index]),
      v: Number(body.v?.[index] ?? 0),
    })).filter((bar) => Number.isFinite(bar.t) && bar.t > 0)

    // The legacy CSV loop pages backward using the final bar in each chunk.
    return { bars: bars.sort((a, b) => b.t - a.t) }
  }

  /**
   * Get month name from month index
   */
  getMonthName(monthIndex) {
    return monthNameFromIndex(monthIndex)
  }

  /**
   * Download Tradesea data and save to CSV files
   */
  async download(apiSymbol, normalizedSymbol, connection, action = 'download', chartResolution = '1', requestedChunkSize) {
    try {
      const resolution = String(chartResolution || '1')
      const csvResolution = csvFolderForChartResolution(resolution)
      let toTime = Math.floor(Date.now() / 1000)
      const countback = historyChunkSize(requestedChunkSize)

      const allBars = []
      let overallFirstBarTime = null
      let overallLastBarTime = null

      this.ws.sendProgress(null, action, normalizedSymbol, 'tradesea', 0, `Starting ${action}... Fetching from current date backwards`)

      let isIncomplete = true
      while (isIncomplete) {
        try {
          const historyResponse = await this.getHistory(
            connection,
            apiSymbol,
            resolution,
            countback,
            0,
            toTime.toString()
          )

          const bars = historyResponse?.bars || []

          if (bars.length < 1) {
            isIncomplete = false
            break
          }

          const firstBar = bars[0]
          const lastBar = bars[bars.length - 1]

          for (const bar of bars) {
            const timestamp = bar.t !== undefined ? bar.t : (bar.timestamp || 0)
            const open = bar.o !== undefined ? bar.o : (bar.open || 0)
            const high = bar.h !== undefined ? bar.h : (bar.high || 0)
            const low = bar.l !== undefined ? bar.l : (bar.low || 0)
            const close = bar.c !== undefined ? bar.c : (bar.close || 0)
            const volume = bar.v !== undefined ? bar.v : (bar.volume || 0)

            if (timestamp > 0) {
              if (!overallFirstBarTime || timestamp < overallFirstBarTime) {
                overallFirstBarTime = timestamp
              }
              if (!overallLastBarTime || timestamp > overallLastBarTime) {
                overallLastBarTime = timestamp
              }
              
              allBars.push({
                time: timestamp,
                open, high, low, close, volume
              })
            }
          }

          const firstDate = overallFirstBarTime ? new Date(overallFirstBarTime) : new Date(firstBar.t)
          const lastDate = overallLastBarTime ? new Date(overallLastBarTime) : new Date(lastBar.t)
          this.ws.sendProgress(null, action, normalizedSymbol, 'tradesea', 0,
            `Fetched ${allBars.length} bars... (${firstDate.toLocaleDateString()} ${firstDate.toLocaleTimeString()} - ${lastDate.toLocaleDateString()} ${lastDate.toLocaleTimeString()})`)

          toTime = Math.floor(lastBar.t / 1000) - 1
          await this.wait(this.historyRequestIntervalMs)
        } catch (error) {
          console.error(`[TradeseaDataHandler] Error fetching chunk:`, error.message)
          throw error
        }
      }

      if (allBars.length === 0) {
        this.ws.broadcast({
          type: 'download_response',
          success: false,
          error: 'No data found for this symbol'
        })
        return
      }

      allBars.sort((a, b) => a.time - b.time)
      this.ws.sendProgress(null, action, normalizedSymbol, 'tradesea', 0, 'Writing CSV files...')

      const barsByMonth = {}
      for (const bar of allBars) {
        const date = new Date(bar.time)
        const year = date.getFullYear()
        const month = date.getMonth()
        const monthName = this.getMonthName(month)
        
        const key = `${year}-${month}`
        if (!barsByMonth[key]) {
          barsByMonth[key] = { year, month, monthName, bars: [] }
        }
        barsByMonth[key].bars.push(bar)
      }

      const symbolDir = path.join(this.ws.csvDir, normalizedSymbol)
      if (!fs.existsSync(symbolDir)) {
        fs.mkdirSync(symbolDir, { recursive: true })
      }

      let filesWritten = 0
      const totalFiles = Object.keys(barsByMonth).length

      for (const key of Object.keys(barsByMonth).sort()) {
        const { year, month, monthName, bars } = barsByMonth[key]
        
        ensureMonthFileDir(this.ws.csvDir, normalizedSymbol, year, csvResolution)
        const filePath = monthFilePath(this.ws.csvDir, normalizedSymbol, year, monthName, csvResolution)
        const csvLines = bars.map(bar => {
          const timestampSeconds = Math.floor(bar.time / 1000)
          return `${timestampSeconds},${bar.open},${bar.high},${bar.low},${bar.close},${bar.volume}`
        })
        
        fs.writeFileSync(filePath, csvLines.join('\n'), 'utf8')
        this.ws.server?.csvLoader?.invalidateMonthData?.(
          normalizedSymbol,
          year,
          month,
          csvResolution,
        )
        filesWritten++

        this.ws.sendProgress(null, action, normalizedSymbol, 'tradesea', 0, `Written ${filesWritten}/${totalFiles} files...`)
      }

      const responseType = action === 'reset' ? 'reset_response' : action === 'overwrite' ? 'overwrite_response' : action === 'update' ? 'update_response' : 'download_response'
      const actionLabel = action === 'reset' ? 'Reset' : action === 'overwrite' ? 'Overwrite' : action === 'update' ? 'Update' : 'Download'
      this.ws.sendProgress(null, action, normalizedSymbol, 'tradesea', 0, `${actionLabel} complete!`)
      this.ws.broadcast({
        type: responseType,
        success: true,
        message: `Successfully ${action === 'reset' ? 'reset' : action === 'overwrite' ? 'overwritten' : action === 'update' ? 'updated' : 'downloaded'} ${allBars.length} bars to ${filesWritten} CSV files`
      })

      console.log(`[TradeseaDataHandler] ${action.charAt(0).toUpperCase() + action.slice(1)} completed for ${normalizedSymbol}: ${allBars.length} bars in ${filesWritten} files`)
    } catch (error) {
      console.error('[TradeseaDataHandler] Error:', error.message)
      this.ws.broadcast({
        type: 'download_response',
        success: false,
        error: error.message || 'Operation failed'
      })
      throw error
    }
  }

  /**
   * Update Tradesea data (merges with existing)
   */
  async update(apiSymbol, normalizedSymbol, connection, chartResolution = '1', requestedChunkSize) {
    try {
      const resolution = String(chartResolution || '1')
      const csvResolution = csvFolderForChartResolution(resolution)
      const symbolDir = path.join(this.ws.csvDir, normalizedSymbol)
      
      this.ws.sendProgress(null, 'update', normalizedSymbol, 'tradesea', 0, 'Finding latest data...')

      const latest = await findLatestBarTimestamp(
        this.ws.csvDir,
        normalizedSymbol,
        csvResolution
      )
      // Include the last saved candle so we can refresh it if it was still forming.
      const fromTime = latest?.timestampSeconds ?? 0
      const startMessage = latest
        ? `Fetching updates since ${new Date(latest.timestampMs).toLocaleString()}...`
        : 'No existing data found, starting full download...'
      this.ws.sendProgress(null, 'update', normalizedSymbol, 'tradesea', 0, startMessage)

      const maxCountback = historyChunkSize(requestedChunkSize)
      const barSeconds = /^\d+(?:S|D|W)?$/i.test(parseBacktesterResolution(resolution))
        ? resolutionToSeconds(resolution)
        : 0
      const uniqueBars = new Map()
      let toTime = Math.floor(Date.now() / 1000) + 1
      let newBarsFetched = 0

      while (toTime >= fromTime && toTime > 0) {
        // UDF providers may prioritize countback over from. Shrink the final page for fixed intervals.
        const countback = fromTime && barSeconds
          ? Math.min(maxCountback, Math.floor((toTime - fromTime) / barSeconds) + 1)
          : maxCountback
        const { bars } = await this.getHistory(connection, apiSymbol, resolution, countback, fromTime, toTime)
        if (!bars.length) break

        for (const bar of bars) {
          const timestamp = Math.floor(bar.t / 1000)
          if (timestamp < fromTime || timestamp > toTime || uniqueBars.has(timestamp)) continue
          uniqueBars.set(timestamp, {
            time: bar.t, open: bar.o, high: bar.h, low: bar.l, close: bar.c, volume: bar.v,
          })
          if (timestamp > fromTime) newBarsFetched++
        }

        this.ws.sendProgress(null, 'update', normalizedSymbol, 'tradesea', 0,
          `Fetched ${newBarsFetched.toLocaleString()} new bars…`)

        const oldest = Math.floor(bars.at(-1).t / 1000)
        if (oldest <= fromTime) break
        if (oldest > toTime) throw new Error('Tradesea history did not advance the update')
        // With an exclusive upper bound, the next page starts just before the oldest bar.
        // If the provider includes that bound, deduplication handles the overlap.
        toTime = Math.min(toTime - 1, oldest)
      }

      if (uniqueBars.size === 0) {
        this.ws.broadcast({
          type: 'update_response',
          success: true,
          message: 'No new data to update'
        })
        return
      }

      // Merge with existing files
      this.ws.sendProgress(null, 'update', normalizedSymbol, 'tradesea', 0, 'Merging data...')

      const barsByMonth = {}
      for (const bar of uniqueBars.values()) {
        const date = new Date(bar.time)
        const year = date.getFullYear()
        const month = date.getMonth()
        const monthName = this.getMonthName(month)
        
        const key = `${year}-${month}`
        if (!barsByMonth[key]) {
          barsByMonth[key] = { year, month, monthName, bars: [] }
        }
        barsByMonth[key].bars.push(bar)
      }

      if (!fs.existsSync(symbolDir)) {
        fs.mkdirSync(symbolDir, { recursive: true })
      }

      let filesWithNewCandles = 0
      let totalNewCandles = 0
      const totalFiles = Object.keys(barsByMonth).length

      for (const key of Object.keys(barsByMonth).sort()) {
        const { year, month, monthName, bars } = barsByMonth[key]
        
        ensureMonthFileDir(this.ws.csvDir, normalizedSymbol, year, csvResolution)
        const filePath = monthFilePath(this.ws.csvDir, normalizedSymbol, year, monthName, csvResolution)

        // Read existing file if it exists
        const existingPath = resolveMonthFilePath(this.ws.csvDir, normalizedSymbol, year, monthName, csvResolution)
        const existingContent = fs.existsSync(existingPath) ? fs.readFileSync(existingPath, 'utf8') : ''
        const existingLines = existingContent.split('\n').filter(line => line.trim())
        
        const existingTimestamps = new Map()
        for (const line of existingLines) {
          const timestamp = line.split(',')[0]
          existingTimestamps.set(timestamp, line)
        }
        
        // Track new candles for this file
        let newCandlesInFile = 0
        
        // Add new bars, overwriting duplicates
        for (const bar of bars) {
          const timestampSeconds = Math.floor(bar.time / 1000)
          const csvLine = `${timestampSeconds},${bar.open},${bar.high},${bar.low},${bar.close},${bar.volume}`
          if (!existingTimestamps.has(timestampSeconds.toString())) {
            newCandlesInFile++
            totalNewCandles++
          }
          existingTimestamps.set(timestampSeconds.toString(), csvLine)
        }
        
        // Sort and write
        const allLines = Array.from(existingTimestamps.values()).sort((a, b) => {
          const tsA = parseInt(a.split(',')[0])
          const tsB = parseInt(b.split(',')[0])
          return tsA - tsB
        })
        
        fs.writeFileSync(filePath, allLines.join('\n'), 'utf8')
        this.ws.server?.csvLoader?.invalidateMonthData?.(
          normalizedSymbol,
          year,
          month,
          csvResolution,
        )
        
        // Only count files that actually had new candles
        if (newCandlesInFile > 0) {
          filesWithNewCandles++
        }

        this.ws.sendProgress(null, 'update', normalizedSymbol, 'tradesea', 0, `Updated ${Object.keys(barsByMonth).indexOf(key) + 1}/${totalFiles} files... (${totalNewCandles} new candles)`)
      }

      this.ws.sendProgress(null, 'update', normalizedSymbol, 'tradesea', 0, 'Update complete!')
      
      // Create appropriate message based on whether any new bars were added
      let successMessage = ''
      if (totalNewCandles === 0) {
        successMessage = 'No new data to update. All data is already up to date.'
      } else if (filesWithNewCandles === 1) {
        successMessage = `Successfully updated: ${totalNewCandles} new bars added to 1 file`
      } else {
        successMessage = `Successfully updated: ${totalNewCandles} new bars added to ${filesWithNewCandles} files`
      }
      
      this.ws.broadcast({
        type: 'update_response',
        success: true,
        message: successMessage
      })

      console.log(`[TradeseaDataHandler] Update completed for ${normalizedSymbol}: ${totalNewCandles} new bars in ${filesWithNewCandles} files`)
    } catch (error) {
      console.error('[TradeseaDataHandler] Error updating:', error.message)
      this.ws.broadcast({
        type: 'update_response',
        success: false,
        error: error.message || 'Update failed'
      })
      throw error
    }
  }
}

export default TradeseaDataHandler

