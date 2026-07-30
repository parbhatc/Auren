/**
 * TradingView Data Handler
 * Handles download, update, overwrite, and reset operations for TradingView data
 */
import fs from 'fs'
import path from 'path'
import {
  csvFolderForChartResolution,
  ensureMonthFileDir,
  findLatestBarTimestamp,
  monthFilePath,
  monthNameFromIndex,
} from '../../utils/backtesterCsvPaths.js'

/** Replay errors that are safe to ignore while historical pagination continues. */
const IGNORABLE_REPLAY_ERRORS = new Set(['intraday_not_permitted', 'already_in_session'])

class TradingViewDataHandler {
  constructor(websocketInstance) {
    this.ws = websocketInstance
  }

  getTradingViewToken() {
    try {
      if (!fs.existsSync(this.ws.configPath)) return null
      const config = JSON.parse(fs.readFileSync(this.ws.configPath, 'utf8'))
      const raw = config.tokens?.tradingview
      if (raw == null) return null
      const token = String(raw).trim()
      // Placeholder / invalid tokens break the WS session — fall back to unauthorized access.
      if (!token || token.length < 8) return null
      return token
    } catch {
      return null
    }
  }

  isIgnorableReplayError(errorCode) {
    return IGNORABLE_REPLAY_ERRORS.has(errorCode)
  }

  /**
   * Get month name from month index
   */
  getMonthName(monthIndex) {
    return monthNameFromIndex(monthIndex)
  }

  /**
   * Download TradingView data and save to CSV files
   */
  async download(apiSymbol, action = 'download', storageSymbol = null, chartResolution = '1') {
    const folderSymbol = storageSymbol || apiSymbol
    const symbol = apiSymbol
    const tvInterval = String(chartResolution || '1')
    try {
      const TradingViewWebSocketModule = await import('../../services/tradingview/TradingViewWebSocket.js')
      const TradingViewWebSocket = TradingViewWebSocketModule.default

      return new Promise((resolve, reject) => {
        const allBars = []
        let overallFirstBarTime = null
        let overallLastBarTime = null
        let lastNoCandles = false
        let oldStart = null
        let lastReplayStart = null
        let isCompleted = false
        let hasError = false
        const flags = { hasError: false, isCompleted: false }

        const fail = (message) => {
          if (flags.hasError || flags.isCompleted) return
          flags.hasError = true
          hasError = true
          wsService?.disconnect()
          this.ws.broadcast({
            type: this.getResponseType(action),
            success: false,
            error: message,
          })
          reject(new Error(message))
        }

        this.ws.sendProgress(null, action, symbol, 'tradingview', 0, `Starting ${action}... Connecting to TradingView`)

        const wsService = new TradingViewWebSocket({ token: this.getTradingViewToken() })
        
        wsService.connect({
          onSessionInit: () => {
            let series = wsService.createSeries('extended')
            let replay = series.replay()
            
            replay.onReplayError = (error) => {
              if (this.isIgnorableReplayError(error.errorCode)) {
                console.warn(`[TradingViewDataHandler] Ignoring replay error: ${error.errorCode}`)
                return
              }
              fail(`Replay error: ${error.errorCode} - ${error.errorDetails || ''}`)
            }

            series.onSymbolResolved = () => {
              // Symbol resolved successfully
            }

            series.onTimescaleUpdate = (data) => {
              if (isCompleted || hasError) return

              const candles = data.series_data?.s || []

              if (candles.length < 1) {
                if (lastNoCandles) {
                  isCompleted = true
                  wsService.disconnect()
                  
                  if (allBars.length === 0) {
                    this.ws.broadcast({
                      type: this.getResponseType(action),
                      success: false,
                      error: 'No data found for this symbol'
                    })
                    reject(new Error('No data found'))
                    return
                  }

                  this.processAndSaveBars(allBars, symbol, action, overallFirstBarTime, overallLastBarTime, folderSymbol, tvInterval)
                    .then(() => resolve())
                    .catch(err => reject(err))
                  return
                }
                lastNoCandles = true
                return
              }

              lastNoCandles = false
              let first = candles[0]
              let last = candles[candles.length - 1]

              // Convert TradingView candles to our format
              for (const candle of candles) {
                const timestamp = candle.v[0] * 1000 // Convert seconds to milliseconds
                const open = candle.v[1]
                const high = candle.v[2]
                const low = candle.v[3]
                const close = candle.v[4]
                const volume = candle.v[5] || 0

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

              const firstDate = overallFirstBarTime ? new Date(overallFirstBarTime) : new Date(first.v[0] * 1000)
              const lastDate = overallLastBarTime ? new Date(overallLastBarTime) : new Date(last.v[0] * 1000)
              this.ws.sendProgress(null, action, symbol, 'tradingview', 0, 
                `Fetched ${allBars.length} bars... (${firstDate.toLocaleDateString()} ${firstDate.toLocaleTimeString()} - ${lastDate.toLocaleDateString()} ${lastDate.toLocaleTimeString()})`)

              if (oldStart === first.v[0]) {
                flags.isCompleted = true
                isCompleted = true
                wsService.disconnect()
                
                this.processAndSaveBars(allBars, symbol, action, overallFirstBarTime, overallLastBarTime, folderSymbol, tvInterval)
                  .then(() => resolve())
                  .catch(err => reject(err))
                return
              }

              oldStart = first.v[0]
              if (lastReplayStart !== first.v[0]) {
                lastReplayStart = first.v[0]
                replay.start(first.v[0])
              }
            }

            series.onSeriesCompleted = () => {
              // Series completed
            }

            series.onSymbolError = (error) => {
              fail(`Symbol error: ${error.error_message || 'Unknown error'}`)
            }

            series.onSeriesError = (error) => {
              fail(`Series error: ${error.error_code || 'Unknown error'}`)
            }

            series.resolve(symbol, tvInterval, 25000)
          },
          onConnected: () => {
            // Connected
          },
          onDisconnected: () => {
            if (!isCompleted && !hasError && allBars.length > 0) {
              this.processAndSaveBars(allBars, symbol, action, overallFirstBarTime, overallLastBarTime, folderSymbol, tvInterval)
                .then(() => resolve())
                .catch(err => reject(err))
            }
          },
          onError: (error) => {
            fail(`Connection error: ${error.message || 'Unknown error'}`)
          }
        })
      })
    } catch (error) {
      console.error('[TradingViewDataHandler] Error:', error.message)
      this.ws.broadcast({
        type: this.getResponseType(action),
        success: false,
        error: error.message || 'Download failed'
      })
      throw error
    }
  }

  /**
   * Update TradingView data — fetches candles after the last bar on disk (quick update).
   */
  async update(apiSymbol, storageSymbol = null, chartResolution = '1') {
    const folderSymbol = storageSymbol || apiSymbol
    const symbol = apiSymbol
    const tvInterval = String(chartResolution || '1')
    const csvResolution = csvFolderForChartResolution(tvInterval)
    const progressSymbol = folderSymbol

    try {
      const normalizedSymbol = folderSymbol.replace(/:/g, '__')

      this.ws.sendProgress(null, 'update', progressSymbol, 'tradingview', 0, 'Finding latest data...')

      const lastBar = findLatestBarTimestamp(this.ws.csvDir, normalizedSymbol, csvResolution)
      const afterTimeMs = lastBar?.timestampMs ?? null

      if (afterTimeMs != null) {
        const lastDate = new Date(afterTimeMs)
        this.ws.sendProgress(
          null,
          'update',
          progressSymbol,
          'tradingview',
          0,
          `Updating after ${lastDate.toLocaleDateString()} ${lastDate.toLocaleTimeString()}...`
        )
      } else {
        this.ws.sendProgress(null, 'update', progressSymbol, 'tradingview', 0, 'No existing data found, starting full download...')
        return this.download(apiSymbol, 'update', folderSymbol, tvInterval)
      }

      this.ws.sendProgress(null, 'update', progressSymbol, 'tradingview', 0, 'Fetching new data...')

      const TradingViewWebSocketModule = await import('../../services/tradingview/TradingViewWebSocket.js')
      const TradingViewWebSocket = TradingViewWebSocketModule.default

      return new Promise((resolve, reject) => {
        const allNewBars = []
        let overallFirstBarTime = null
        let overallLastBarTime = null
        let isCompleted = false
        let hasError = false
        let sawTimescale = false
        let sawSeriesCompleted = false

        const finishUpdate = () => {
          if (allNewBars.length === 0) {
            this.ws.broadcast({
              type: 'update_response',
              success: true,
              message: 'No new data to update. All data is already up to date.'
            })
            resolve()
            return
          }

          this.processAndSaveBars(allNewBars, symbol, 'update', overallFirstBarTime, overallLastBarTime, folderSymbol, tvInterval)
            .then(() => resolve())
            .catch((err) => reject(err))
        }

        const addCandle = (candle) => {
          const timestamp = candle.v[0] * 1000
          if (afterTimeMs && timestamp <= afterTimeMs) return false

          const open = candle.v[1]
          const high = candle.v[2]
          const low = candle.v[3]
          const close = candle.v[4]
          const volume = candle.v[5] || 0
          if (timestamp <= 0) return false

          if (!overallFirstBarTime || timestamp < overallFirstBarTime) overallFirstBarTime = timestamp
          if (!overallLastBarTime || timestamp > overallLastBarTime) overallLastBarTime = timestamp

          allNewBars.push({ time: timestamp, open, high, low, close, volume })
          return true
        }

        const wsService = new TradingViewWebSocket({ token: this.getTradingViewToken() })

        wsService.connect({
          onSessionInit: () => {
            const series = wsService.createSeries('extended')

            series.onSymbolError = (error) => {
              hasError = true
              wsService.disconnect()
              this.ws.broadcast({
                type: 'update_response',
                success: false,
                error: `Symbol error: ${error.error_message || 'Unknown error'}`
              })
              reject(new Error(`Symbol error: ${error.error_message || 'Unknown error'}`))
            }

            series.onSeriesError = (error) => {
              hasError = true
              wsService.disconnect()
              this.ws.broadcast({
                type: 'update_response',
                success: false,
                error: `Series error: ${error.error_code || 'Unknown error'}`
              })
              reject(new Error(`Series error: ${error.error_code || 'Unknown error'}`))
            }

            series.onTimescaleUpdate = (data) => {
              if (isCompleted || hasError) return

              const candles = data.series_data?.s || []
              if (candles.length > 0) sawTimescale = true
              for (const candle of candles) addCandle(candle)

              if (allNewBars.length > 0) {
                const firstDate = new Date(overallFirstBarTime)
                const lastDate = new Date(overallLastBarTime)
                this.ws.sendProgress(
                  null,
                  'update',
                  progressSymbol,
                  'tradingview',
                  0,
                  `Fetched ${allNewBars.length} new bars... (${firstDate.toLocaleDateString()} ${firstDate.toLocaleTimeString()} - ${lastDate.toLocaleDateString()} ${lastDate.toLocaleTimeString()})`
                )
              }
            }

            series.onSeriesCompleted = () => {
              if (!isCompleted && !hasError) {
                sawSeriesCompleted = true
                isCompleted = true
                wsService.disconnect()
                finishUpdate()
              }
            }

            series.resolve(symbol, tvInterval, 25000)
          },
          onDisconnected: () => {
            if (!isCompleted && !hasError) {
              if (!sawTimescale && !sawSeriesCompleted) {
                hasError = true
                this.ws.broadcast({
                  type: 'update_response',
                  success: false,
                  error: 'TradingView disconnected before any candle data was received. Check your TradingView token in Symbol Info / CSV settings.'
                })
                reject(new Error('TradingView disconnected before candle data'))
                return
              }
              isCompleted = true
              finishUpdate()
            }
          },
          onError: (error) => {
            hasError = true
            this.ws.broadcast({
              type: 'update_response',
              success: false,
              error: `Connection error: ${error.message || 'Unknown error'}`
            })
            reject(error)
          }
        })
      })
    } catch (error) {
      console.error('[TradingViewDataHandler] Update error:', error.message)
      this.ws.broadcast({
        type: 'update_response',
        success: false,
        error: error.message || 'Update failed'
      })
      throw error
    }
  }

  /**
   * Process and save TradingView bars to CSV files
   */
  async processAndSaveBars(allBars, symbol, action, overallFirstBarTime, overallLastBarTime, storageSymbol = null, chartResolution = '1') {
    if (allBars.length === 0) {
      throw new Error('No bars to save')
    }

    const csvResolution = csvFolderForChartResolution(chartResolution)

    allBars.sort((a, b) => a.time - b.time)

    const folderSymbol = storageSymbol || symbol
    const progressSymbol = folderSymbol
    const normalizedSymbol = folderSymbol.replace(/:/g, '__')
    const symbolDir = path.join(this.ws.csvDir, normalizedSymbol)
    if (!fs.existsSync(symbolDir)) {
      fs.mkdirSync(symbolDir, { recursive: true })
    }

    this.ws.sendProgress(null, action, progressSymbol, 'tradingview', 0, 'Writing CSV files...')

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

    let filesWritten = 0
    let filesWithNewCandles = 0
    let totalNewCandles = 0
    const totalFiles = Object.keys(barsByMonth).length

    for (const key of Object.keys(barsByMonth).sort()) {
      const { year, month, monthName, bars } = barsByMonth[key]
      
      ensureMonthFileDir(this.ws.csvDir, normalizedSymbol, year, csvResolution)
      const filePath = monthFilePath(this.ws.csvDir, normalizedSymbol, year, monthName, csvResolution)
      
      let newCandlesInFile = 0
      
      if (action === 'update' && fs.existsSync(filePath)) {
        // Merge with existing file
        const existingContent = fs.readFileSync(filePath, 'utf8')
        const existingLines = existingContent.split('\n').filter(line => line.trim())
        
        const existingTimestamps = new Map()
        for (const line of existingLines) {
          const timestamp = line.split(',')[0]
          existingTimestamps.set(timestamp, line)
        }
        
        // Track new candles for this file
        for (const bar of bars) {
          const timestampSeconds = Math.floor(bar.time / 1000)
          const csvLine = `${timestampSeconds},${bar.open},${bar.high},${bar.low},${bar.close},${bar.volume}`
          if (!existingTimestamps.has(timestampSeconds.toString())) {
            newCandlesInFile++
            totalNewCandles++
          }
          existingTimestamps.set(timestampSeconds.toString(), csvLine)
        }
        
        const allLines = Array.from(existingTimestamps.values()).sort((a, b) => {
          const tsA = parseInt(a.split(',')[0])
          const tsB = parseInt(b.split(',')[0])
          return tsA - tsB
        })
        
        fs.writeFileSync(filePath, allLines.join('\n'), 'utf8')
        
        // Only count files that actually had new candles
        if (newCandlesInFile > 0) {
          filesWithNewCandles++
        }
      } else {
        // Write new file (for download/overwrite/reset, all bars are new)
        const csvLines = bars.map(bar => {
          const timestampSeconds = Math.floor(bar.time / 1000)
          return `${timestampSeconds},${bar.open},${bar.high},${bar.low},${bar.close},${bar.volume}`
        })
        
        fs.writeFileSync(filePath, csvLines.join('\n'), 'utf8')
        totalNewCandles += bars.length
      }

      this.ws.server?.csvLoader?.invalidateMonthData?.(
        normalizedSymbol,
        year,
        month,
        csvResolution,
      )
      
      filesWritten++
      if (action === 'update') {
        this.ws.sendProgress(null, action, progressSymbol, 'tradingview', 0, `Updated ${filesWritten}/${totalFiles} files... (${totalNewCandles} new candles)`)
      } else {
        this.ws.sendProgress(null, action, progressSymbol, 'tradingview', 0, `Written ${filesWritten}/${totalFiles} files...`)
      }
    }

    const responseType = this.getResponseType(action)
    const actionLabel = action === 'reset' ? 'Reset' : action === 'overwrite' ? 'Overwrite' : action === 'update' ? 'Update' : 'Download'
    this.ws.sendProgress(null, action, progressSymbol, 'tradingview', 0, `${actionLabel} complete!`)
    
    // Create appropriate success message
    let successMessage = ''
    if (action === 'update') {
      if (totalNewCandles === 0) {
        successMessage = 'No new data to update. All data is already up to date.'
      } else if (filesWithNewCandles === 1) {
        successMessage = `Successfully updated: ${totalNewCandles} new bars added to 1 file`
      } else {
        successMessage = `Successfully updated: ${totalNewCandles} new bars added to ${filesWithNewCandles} files`
      }
    } else {
      successMessage = `Successfully ${action === 'reset' ? 'reset' : action === 'overwrite' ? 'overwritten' : 'downloaded'} ${allBars.length} bars to ${filesWritten} CSV files`
    }
    
    this.ws.broadcast({
      type: responseType,
      success: true,
      message: successMessage
    })

    console.log(`[TradingViewDataHandler] ${action.charAt(0).toUpperCase() + action.slice(1)} completed for ${symbol}: ${allBars.length} bars in ${filesWritten} files`)
  }

  /**
   * Get response type based on action
   */
  getResponseType(action) {
    return action === 'reset' ? 'reset_response' 
      : action === 'overwrite' ? 'overwrite_response' 
      : action === 'update' ? 'update_response' 
      : 'download_response'
  }
}

export default TradingViewDataHandler
