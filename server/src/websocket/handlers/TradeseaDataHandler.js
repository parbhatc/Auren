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
  findLatestMonth,
  monthFilePath,
  monthNameFromIndex,
} from '../../utils/backtesterCsvPaths.js'
import { normalizeTradeseaMarketDataSymbol } from '../../utils/tradeseaMarketDataSymbol.js'

class TradeseaDataHandler {
  constructor(websocketInstance, identityService = TradeseaIdentityService) {
    this.ws = websocketInstance
    this.identityService = identityService
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
    const response = await this.identityService.proxyUdfRequest(
      connection.tokens,
      connection.accountId,
      `/history?${params.toString()}`
    )
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
  async download(apiSymbol, normalizedSymbol, connection, action = 'download', chartResolution = '1') {
    try {
      const resolution = String(chartResolution || '1')
      const csvResolution = csvFolderForChartResolution(resolution)
      let toTime = Math.floor(Date.now() / 1000)
      const countback = 25000

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
          await new Promise(resolve => setTimeout(resolve, 100))
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
  async update(apiSymbol, normalizedSymbol, connection, chartResolution = '1') {
    try {
      const resolution = String(chartResolution || '1')
      const csvResolution = csvFolderForChartResolution(resolution)
      const symbolDir = path.join(this.ws.csvDir, normalizedSymbol)
      
      this.ws.sendProgress(null, 'update', normalizedSymbol, 'tradesea', 0, 'Finding latest data...')

      const now = new Date()
      const nowTimestamp = Math.floor(now.getTime() / 1000)
      
      const { latestYear, latestMonth, latestMonthIndex } = findLatestMonth(
        this.ws.csvDir,
        normalizedSymbol,
        csvResolution
      )

      // Determine update range
      let fromTime = 0
      if (latestYear && latestMonthIndex !== null) {
        fromTime = Math.floor(new Date(latestYear, latestMonthIndex, 1, 0, 0, 0, 0).getTime() / 1000)
        this.ws.sendProgress(null, 'update', normalizedSymbol, 'tradesea', 0, `Updating from ${latestMonth} ${latestYear} to now...`)
      } else {
        fromTime = 0
        this.ws.sendProgress(null, 'update', normalizedSymbol, 'tradesea', 0, 'No existing data found, starting full download...')
      }

      this.ws.sendProgress(null, 'update', normalizedSymbol, 'tradesea', 0, 'Fetching new data...')
      
      const allNewBars = []
      let toTime = nowTimestamp
      const countback = 25000
      let overallFirstBarTime = null
      let overallLastBarTime = null

      const fromTimeMs = fromTime > 0 ? fromTime * 1000 : null
      let hasReachedFromTime = false

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

          // Check if we've gone past the fromTime limit
          // But continue fetching to fill gaps - only add bars within the update range
          if (fromTimeMs && lastBar.t < fromTimeMs) {
            // We've fetched past the beginning of the latest month
            // Check if any bars in this batch are still within range
            const barsInRange = bars.filter(bar => {
              const timestamp = bar.t !== undefined ? bar.t : (bar.timestamp || 0)
              return timestamp >= fromTimeMs
            })
            
            if (barsInRange.length === 0) {
              // No more bars in range, we're done
              isIncomplete = false
              console.log(`[TradeseaDataHandler] Reached fromTime limit (update mode)`)
              break
            }
            // Continue processing barsInRange below
          }
          
          // Process all bars, but only add those within the update range (from beginning of latest month to now)
          for (const bar of bars) {
            const timestamp = bar.t !== undefined ? bar.t : (bar.timestamp || 0)
            
            // Only add bars that are within the update range
            if (fromTimeMs && timestamp < fromTimeMs) {
              continue // Skip bars older than the beginning of the latest month
            }
            
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
              
              allNewBars.push({
                time: timestamp,
                open, high, low, close, volume
              })
            }
          }

          const firstDate = overallFirstBarTime ? new Date(overallFirstBarTime) : new Date(firstBar.t)
          const lastDate = overallLastBarTime ? new Date(overallLastBarTime) : new Date(lastBar.t)
          this.ws.sendProgress(null, 'update', normalizedSymbol, 'tradesea', 0,
            `Fetched ${allNewBars.length} new bars... (${firstDate.toLocaleDateString()} ${firstDate.toLocaleTimeString()} - ${lastDate.toLocaleDateString()} ${lastDate.toLocaleTimeString()})`)

          toTime = Math.floor(lastBar.t / 1000) - 1
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          console.error(`[TradeseaDataHandler] Error fetching update chunk:`, error.message)
          throw error
        }
      }

      if (allNewBars.length === 0) {
        this.ws.broadcast({
          type: 'update_response',
          success: true,
          message: 'No new data to update'
        })
        return
      }

      // Remove duplicates
      const uniqueBars = new Map()
      for (const bar of allNewBars) {
        const timestamp = Math.floor(bar.time / 1000)
        if (!uniqueBars.has(timestamp)) {
          uniqueBars.set(timestamp, bar)
        }
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
        const existingContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
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

