import Database from './src/config/Database.js'

async function deleteAllTrades() {
  try {
    await Database.initialize()
    console.log('Connected to database')
    
    await Database.run('DELETE FROM backtester_trades')
    console.log('Deleted all trades from backtester_trades table')
    
    await Database.close()
    console.log('Done!')
    process.exit(0)
  } catch (error) {
    console.error('Error deleting trades:', error)
    process.exit(1)
  }
}

deleteAllTrades()
