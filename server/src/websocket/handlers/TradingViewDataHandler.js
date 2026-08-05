import fs from 'fs'
import path from 'path'
import {
  csvFolderForChartResolution,
  ensureMonthFileDir,
  monthFilePath,
  monthNameFromIndex,
} from '../../utils/backtesterCsvPaths.js'
import TradingViewMarketDataClient from '../../services/tradingview/TradingViewMarketDataClient.js'

class TradingViewDataHandler {
  constructor(websocketInstance) {
    this.ws = websocketInstance
    this.marketData = new TradingViewMarketDataClient({ configPath: websocketInstance.configPath })
  }

  getMonthName(monthIndex) {
    return monthNameFromIndex(monthIndex)
  }

  async download(apiSymbol, action = 'download', storageSymbol = null, chartResolution = '1') {
    const folderSymbol = storageSymbol || apiSymbol
    const interval = String(chartResolution || '1')
    const allBars = []
    let to
    let previousOldest = null

    this.ws.sendProgress(null, action, folderSymbol, 'tradingview', 0, `Starting ${action} through TradingviewServer`)
    for (;;) {
      const history = await this.marketData.history(apiSymbol, {
        interval,
        bars: 5000,
        ...(to == null ? {} : { to }),
      })
      const batch = Array.isArray(history?.bars) ? history.bars : []
      if (!batch.length) break
      allBars.push(...batch.map((bar) => ({ ...bar, time: Number(bar.time) * 1000 })))
      const oldest = Math.min(...batch.map((bar) => Number(bar.time)).filter(Number.isFinite))
      if (!Number.isFinite(oldest) || oldest === previousOldest || history.historyExhausted) break
      previousOldest = oldest
      to = oldest - 1
      this.ws.sendProgress(null, action, folderSymbol, 'tradingview', 0, `Loaded ${allBars.length.toLocaleString()} bars`)
    }

    const unique = [...new Map(allBars.map((bar) => [bar.time, bar])).values()].sort((a, b) => a.time - b.time)
    if (!unique.length) throw new Error('No TradingView bars were returned by TradingviewServer')
    return this.processAndSaveBars(
      unique,
      apiSymbol,
      action,
      unique[0].time,
      unique.at(-1).time,
      folderSymbol,
      interval
    )
  }

  update(apiSymbol, storageSymbol = null, chartResolution = '1') {
    return this.download(apiSymbol, 'update', storageSymbol, chartResolution)
  }

  async processAndSaveBars(allBars, symbol, action, overallFirstBarTime, overallLastBarTime, storageSymbol = null, chartResolution = '1') {
    if (allBars.length === 0) throw new Error('No bars to save')

    const csvResolution = csvFolderForChartResolution(chartResolution)
    allBars.sort((a, b) => a.time - b.time)

    const folderSymbol = storageSymbol || symbol
    const normalizedSymbol = folderSymbol.replace(/:/g, '__')
    const symbolDir = path.join(this.ws.csvDir, normalizedSymbol)
    if (!fs.existsSync(symbolDir)) fs.mkdirSync(symbolDir, { recursive: true })

    this.ws.sendProgress(null, action, folderSymbol, 'tradingview', 0, 'Writing CSV files...')

    const barsByMonth = {}
    for (const bar of allBars) {
      const date = new Date(bar.time)
      const year = date.getFullYear()
      const month = date.getMonth()
      const monthName = this.getMonthName(month)
      const key = `${year}-${month}`
      barsByMonth[key] ||= { year, month, monthName, bars: [] }
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
        const existingLines = fs.readFileSync(filePath, 'utf8').split('\n').filter((line) => line.trim())
        const linesByTimestamp = new Map(existingLines.map((line) => [line.split(',')[0], line]))
        for (const bar of bars) {
          const timestamp = String(Math.floor(bar.time / 1000))
          if (!linesByTimestamp.has(timestamp)) {
            newCandlesInFile += 1
            totalNewCandles += 1
          }
          linesByTimestamp.set(timestamp, `${timestamp},${bar.open},${bar.high},${bar.low},${bar.close},${bar.volume}`)
        }
        const lines = [...linesByTimestamp.values()].sort((left, right) => Number(left.split(',')[0]) - Number(right.split(',')[0]))
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
        if (newCandlesInFile > 0) filesWithNewCandles += 1
      } else {
        const lines = bars.map((bar) => `${Math.floor(bar.time / 1000)},${bar.open},${bar.high},${bar.low},${bar.close},${bar.volume}`)
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
        totalNewCandles += bars.length
      }

      this.ws.server?.csvLoader?.invalidateMonthData?.(normalizedSymbol, year, month, csvResolution)
      filesWritten += 1
      const message = action === 'update'
        ? `Updated ${filesWritten}/${totalFiles} files... (${totalNewCandles} new candles)`
        : `Written ${filesWritten}/${totalFiles} files...`
      this.ws.sendProgress(null, action, folderSymbol, 'tradingview', 0, message)
    }

    const actionLabel = action === 'reset' ? 'Reset' : action === 'overwrite' ? 'Overwrite' : action === 'update' ? 'Update' : 'Download'
    this.ws.sendProgress(null, action, folderSymbol, 'tradingview', 0, `${actionLabel} complete!`)
    let message
    if (action === 'update') {
      message = totalNewCandles === 0
        ? 'No new data to update. All data is already up to date.'
        : `Successfully updated: ${totalNewCandles} new bars added to ${filesWithNewCandles} ${filesWithNewCandles === 1 ? 'file' : 'files'}`
    } else {
      const verb = action === 'reset' ? 'reset' : action === 'overwrite' ? 'overwritten' : 'downloaded'
      message = `Successfully ${verb} ${allBars.length} bars to ${filesWritten} CSV files`
    }
    this.ws.broadcast({ type: this.getResponseType(action), success: true, message })
    console.log(`[TradingViewDataHandler] ${actionLabel} completed for ${symbol}: ${allBars.length} bars in ${filesWritten} files`)
  }

  getResponseType(action) {
    return action === 'reset' ? 'reset_response'
      : action === 'overwrite' ? 'overwrite_response'
      : action === 'update' ? 'update_response'
      : 'download_response'
  }
}

export default TradingViewDataHandler
