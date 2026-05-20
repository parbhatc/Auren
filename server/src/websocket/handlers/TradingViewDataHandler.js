/**
 * TradingView Data Handler
 * Handles download, update, overwrite, and reset operations for TradingView data
 */
import fs from 'fs'
import path from 'path'

class TradingViewDataHandler {
  constructor(websocketInstance) {
    this.ws = websocketInstance
  }

  /**
   * Get month name from month index
   */
  getMonthName(monthIndex) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return months[monthIndex]
  }

  /**
   * Download TradingView data and save to CSV files
   */
  async download(symbol, action = 'download') {
    try {
      const TradingViewWebSocketModule = await import('../../services/tradingview/TradingViewWebSocket.js')
      const TradingViewWebSocket = TradingViewWebSocketModule.default

      return new Promise((resolve, reject) => {
        const allBars = []
        let overallFirstBarTime = null
        let overallLastBarTime = null
        let lastNoCandles = false
        let oldStart = null
        let isCompleted = false
        let hasError = false

        this.ws.sendProgress(null, action, symbol, 'tradingview', 0, `Starting ${action}... Connecting to TradingView`)

        const wsService = new TradingViewWebSocket()
        
        wsService.connect({
          onSessionInit: () => {
            let series = wsService.createSeries('extended')
            let replay = series.replay()
            
            replay.onReplayError = (error) => {
              if (error.errorCode === "intraday_not_permitted") {
                return
              }
              hasError = true
              wsService.disconnect()
              this.ws.broadcast({
                type: this.getResponseType(action),
                success: false,
                error: `Replay error: ${error.errorCode} - ${error.errorDetails || ''}`
              })
              reject(new Error(`Replay error: ${error.errorCode}`))
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

                  this.processAndSaveBars(allBars, symbol, action, overallFirstBarTime, overallLastBarTime)
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
                isCompleted = true
                wsService.disconnect()
                
                this.processAndSaveBars(allBars, symbol, action, overallFirstBarTime, overallLastBarTime)
                  .then(() => resolve())
                  .catch(err => reject(err))
                return
              }

              oldStart = first.v[0]
              replay.start(first.v[0])
            }

            series.onSeriesCompleted = () => {
              // Series completed
            }

            series.onSymbolError = (error) => {
              hasError = true
              wsService.disconnect()
              this.ws.broadcast({
                type: this.getResponseType(action),
                success: false,
                error: `Symbol error: ${error.error_message || 'Unknown error'}`
              })
              reject(new Error(`Symbol error: ${error.error_message || 'Unknown error'}`))
            }

            series.onSeriesError = (error) => {
              hasError = true
              wsService.disconnect()
              this.ws.broadcast({
                type: this.getResponseType(action),
                success: false,
                error: `Series error: ${error.error_code || 'Unknown error'}`
              })
              reject(new Error(`Series error: ${error.error_code || 'Unknown error'}`))
            }

            series.resolve(symbol, "1", 25000)
          },
          onConnected: () => {
            // Connected
          },
          onDisconnected: () => {
            if (!isCompleted && !hasError && allBars.length > 0) {
              this.processAndSaveBars(allBars, symbol, action, overallFirstBarTime, overallLastBarTime)
                .then(() => resolve())
                .catch(err => reject(err))
            }
          },
          onError: (error) => {
            hasError = true
            this.ws.broadcast({
              type: this.getResponseType(action),
              success: false,
              error: `Connection error: ${error.message || 'Unknown error'}`
            })
            reject(error)
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
   * Update TradingView data - finds latest month and fetches from beginning of that month to now
   */
  async update(symbol) {
    try {
      // Normalize symbol for folder name
      const normalizedSymbol = symbol.replace(/:/g, '__')
      const symbolDir = path.join(this.ws.csvDir, normalizedSymbol)
      
      const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      
      this.ws.sendProgress(null, 'update', symbol, 'tradingview', 0, 'Finding latest data...')

      const now = new Date()
      const nowTimestamp = Math.floor(now.getTime() / 1000)

      // Find latest month and year from all existing files
      let latestYear = null
      let latestMonth = null
      let latestMonthIndex = null

      if (fs.existsSync(symbolDir)) {
        const yearDirs = fs.readdirSync(symbolDir, { withFileTypes: true })
          .filter(item => item.isDirectory() && /^\d{4}$/.test(item.name))
          .map(item => parseInt(item.name))
          .sort((a, b) => b - a)

        for (const year of yearDirs) {
          const yearDir = path.join(symbolDir, year.toString())
          const files = fs.readdirSync(yearDir, { withFileTypes: true })
            .filter(item => item.isFile() && item.name.endsWith('.csv'))
            .map(item => item.name.replace('.csv', ''))

          for (const monthName of files) {
            const monthIndex = MONTH_NAMES.indexOf(monthName)
            if (monthIndex !== -1) {
              if (!latestYear || year > latestYear || (year === latestYear && monthIndex > latestMonthIndex)) {
                latestYear = year
                latestMonth = monthName
                latestMonthIndex = monthIndex
              }
            }
          }
        }
      }

      // Determine update range
      let fromTime = 0
      if (latestYear && latestMonthIndex !== null) {
        fromTime = Math.floor(new Date(latestYear, latestMonthIndex, 1, 0, 0, 0, 0).getTime() / 1000)
        this.ws.sendProgress(null, 'update', symbol, 'tradingview', 0, `Updating from ${latestMonth} ${latestYear} to now...`)
      } else {
        fromTime = 0
        this.ws.sendProgress(null, 'update', symbol, 'tradingview', 0, 'No existing data found, starting full download...')
      }

      this.ws.sendProgress(null, 'update', symbol, 'tradingview', 0, 'Fetching new data...')

      const TradingViewWebSocketModule = await import('../../services/tradingview/TradingViewWebSocket.js')
      const TradingViewWebSocket = TradingViewWebSocketModule.default

      return new Promise((resolve, reject) => {
        const allNewBars = []
        let overallFirstBarTime = null
        let overallLastBarTime = null
        let lastNoCandles = false
        let oldStart = null
        let isCompleted = false
        let hasError = false

        const fromTimeMs = fromTime > 0 ? fromTime * 1000 : null

        const wsService = new TradingViewWebSocket()
        
        wsService.connect({
          onSessionInit: () => {
            let series = wsService.createSeries('extended')
            let replay = series.replay()
            
            replay.onReplayError = (error) => {
              if (error.errorCode === "intraday_not_permitted") {
                return
              }
              hasError = true
              wsService.disconnect()
              this.ws.broadcast({
                type: 'update_response',
                success: false,
                error: `Replay error: ${error.errorCode} - ${error.errorDetails || ''}`
              })
              reject(new Error(`Replay error: ${error.errorCode}`))
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
                  
                  if (allNewBars.length === 0) {
                    // No new bars found - data is already up to date
                    this.ws.broadcast({
                      type: 'update_response',
                      success: true,
                      message: 'No new data to update. All data is already up to date.'
                    })
                    resolve()
                    return
                  }

                  this.processAndSaveBars(allNewBars, symbol, 'update', overallFirstBarTime, overallLastBarTime)
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

              // Track how many bars were added in this batch
              const barsBeforeBatch = allNewBars.length

              // Convert TradingView candles to our format and filter by update range
              for (const candle of candles) {
                const timestamp = candle.v[0] * 1000 // Convert seconds to milliseconds
                
                // Only add bars that are within the update range (from beginning of latest month to now)
                if (fromTimeMs && timestamp < fromTimeMs) {
                  continue // Skip bars older than the beginning of the latest month
                }
                
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

                  allNewBars.push({
                    time: timestamp,
                    open, high, low, close, volume
                  })
                }
              }

              // If no bars were added in this batch and we've passed the fromTime limit, we're done
              const barsAddedInBatch = allNewBars.length - barsBeforeBatch
              if (barsAddedInBatch === 0 && fromTimeMs && last.v[0] * 1000 < fromTimeMs) {
                isCompleted = true
                wsService.disconnect()
                
                if (allNewBars.length === 0) {
                  // No new bars found - data is already up to date
                  this.ws.broadcast({
                    type: 'update_response',
                    success: true,
                    message: 'No new data to update. All data is already up to date.'
                  })
                  resolve()
                  return
                }
                
                this.processAndSaveBars(allNewBars, symbol, 'update', overallFirstBarTime, overallLastBarTime)
                  .then(() => resolve())
                  .catch(err => reject(err))
                return
              }

              const firstDate = overallFirstBarTime ? new Date(overallFirstBarTime) : new Date(first.v[0] * 1000)
              const lastDate = overallLastBarTime ? new Date(overallLastBarTime) : new Date(last.v[0] * 1000)
              this.ws.sendProgress(null, 'update', symbol, 'tradingview', 0, 
                `Fetched ${allNewBars.length} new bars... (${firstDate.toLocaleDateString()} ${firstDate.toLocaleTimeString()} - ${lastDate.toLocaleDateString()} ${lastDate.toLocaleTimeString()})`)

              // Check if we've reached the fromTime limit
              if (fromTimeMs && last.v[0] * 1000 < fromTimeMs) {
                // We've fetched past the beginning of the latest month
                // Check if any remaining candles are still within range
                const remainingInRange = candles.filter(c => c.v[0] * 1000 >= fromTimeMs)
                if (remainingInRange.length === 0) {
                  isCompleted = true
                  wsService.disconnect()
                  
                  if (allNewBars.length === 0) {
                    // No new bars found - data is already up to date
                    this.ws.broadcast({
                      type: 'update_response',
                      success: true,
                      message: 'No new data to update. All data is already up to date.'
                    })
                    resolve()
                    return
                  }
                  
                  this.processAndSaveBars(allNewBars, symbol, 'update', overallFirstBarTime, overallLastBarTime)
                    .then(() => resolve())
                    .catch(err => reject(err))
                  return
                }
              }

              if (oldStart === first.v[0]) {
                isCompleted = true
                wsService.disconnect()
                
                if (allNewBars.length === 0) {
                  // No new bars found - data is already up to date
                  this.ws.broadcast({
                    type: 'update_response',
                    success: true,
                    message: 'No new data to update. All data is already up to date.'
                  })
                  resolve()
                  return
                }
                
                this.processAndSaveBars(allNewBars, symbol, 'update', overallFirstBarTime, overallLastBarTime)
                  .then(() => resolve())
                  .catch(err => reject(err))
                return
              }

              oldStart = first.v[0]
              replay.start(first.v[0])
            }

            series.onSeriesCompleted = () => {
              // Series completed
            }

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

            // Resolve series - this will trigger onTimescaleUpdate
            // For update, we want to start from beginning of latest month
            const startTimeSeconds = fromTimeMs ? Math.floor(fromTimeMs / 1000) : nowTimestamp
            series.resolve(symbol, "1", 25000)
            
            // Start replay from beginning of latest month if we have existing data
            // This will fetch data starting from that time
            if (fromTimeMs) {
              replay.start(startTimeSeconds)
            }
          },
          onConnected: () => {
            // Connected
          },
          onDisconnected: () => {
            if (!isCompleted && !hasError) {
              if (allNewBars.length === 0) {
                // No new bars found - data is already up to date
                this.ws.broadcast({
                  type: 'update_response',
                  success: true,
                  message: 'No new data to update. All data is already up to date.'
                })
                resolve()
                return
              }
              
              this.processAndSaveBars(allNewBars, symbol, 'update', overallFirstBarTime, overallLastBarTime)
                .then(() => resolve())
                .catch(err => reject(err))
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
  async processAndSaveBars(allBars, symbol, action, overallFirstBarTime, overallLastBarTime) {
    if (allBars.length === 0) {
      throw new Error('No bars to save')
    }

    allBars.sort((a, b) => a.time - b.time)
    this.ws.sendProgress(null, action, symbol, 'tradingview', 0, 'Writing CSV files...')

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

    // Normalize symbol for folder name: convert colons to double underscores (Windows doesn't allow colons in folder names)
    const normalizedSymbol = symbol.replace(/:/g, '__')
    const symbolDir = path.join(this.ws.csvDir, normalizedSymbol)
    if (!fs.existsSync(symbolDir)) {
      fs.mkdirSync(symbolDir, { recursive: true })
    }

    let filesWritten = 0
    let filesWithNewCandles = 0
    let totalNewCandles = 0
    const totalFiles = Object.keys(barsByMonth).length

    for (const key of Object.keys(barsByMonth).sort()) {
      const { year, monthName, bars } = barsByMonth[key]
      
      const yearDir = path.join(symbolDir, year.toString())
      if (!fs.existsSync(yearDir)) {
        fs.mkdirSync(yearDir, { recursive: true })
      }

      const filePath = path.join(yearDir, `${monthName}.csv`)
      
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
      
      filesWritten++
      if (action === 'update') {
        this.ws.sendProgress(null, action, symbol, 'tradingview', 0, `Updated ${filesWritten}/${totalFiles} files... (${totalNewCandles} new candles)`)
      } else {
        this.ws.sendProgress(null, action, symbol, 'tradingview', 0, `Written ${filesWritten}/${totalFiles} files...`)
      }
    }

    const responseType = this.getResponseType(action)
    const actionLabel = action === 'reset' ? 'Reset' : action === 'overwrite' ? 'Overwrite' : action === 'update' ? 'Update' : 'Download'
    this.ws.sendProgress(null, action, symbol, 'tradingview', 0, `${actionLabel} complete!`)
    
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
