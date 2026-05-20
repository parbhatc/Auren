import Database from '../config/Database.js'
import crypto from 'crypto'

class TradingJournalController {
  // ========== TRADES ==========
  
  async createTrade(req, res) {
    try {
      const userId = req.user.id
      const {
        strategy_id,
        symbol,
        market,
        trade_date,
        session,
        direction,
        entry_price,
        exit_price,
        stop_loss,
        take_profit,
        position_size,
        notes,
        before_screenshot,
        after_screenshot,
        entry_time,
        exit_time,
        emotion_before,
        emotion_during,
        emotion_after,
        confidence,
        fomo,
        hesitation,
        revenge,
        fees,
        tick_size
      } = req.body

      // Auto-calculate fields
      const riskPerTrade = stop_loss && entry_price && position_size
        ? Math.abs(entry_price - stop_loss) * position_size
        : null

      const rMultiplePlanned = stop_loss && take_profit && entry_price
        ? direction === 'LONG'
          ? (take_profit - entry_price) / (entry_price - stop_loss)
          : (entry_price - take_profit) / (stop_loss - entry_price)
        : null

      const rMultipleActual = exit_price && stop_loss && entry_price
        ? direction === 'LONG'
          ? (exit_price - entry_price) / (entry_price - stop_loss)
          : (entry_price - exit_price) / (stop_loss - entry_price)
        : null

      const pnlDollars = exit_price && entry_price && position_size
        ? direction === 'LONG'
          ? (exit_price - entry_price) * position_size
          : (entry_price - exit_price) * position_size
        : null

      const pnlPercent = entry_price && pnlDollars
        ? (pnlDollars / (entry_price * position_size)) * 100
        : null

      let outcome = null
      if (exit_price && stop_loss && take_profit) {
        if (direction === 'LONG') {
          if (exit_price >= take_profit) outcome = 'WIN'
          else if (exit_price <= stop_loss) outcome = 'LOSS'
          else outcome = 'BE'
        } else {
          if (exit_price <= take_profit) outcome = 'WIN'
          else if (exit_price >= stop_loss) outcome = 'LOSS'
          else outcome = 'BE'
        }
      }

      const tradeDuration = entry_time && exit_time
        ? Math.floor((new Date(exit_time) - new Date(entry_time)) / 1000 / 60) // minutes
        : null

      // Check for rule violations
      const ruleViolations = await this.checkRuleViolations(userId, {
        trade_date,
        pnl_dollars: pnlDollars,
        strategy_id
      })

      const tradeId = crypto.randomUUID()
      await Database.run(`
        INSERT INTO trades (
          id, user_id, strategy_id, symbol, market, trade_date, session, direction,
          entry_price, exit_price, stop_loss, take_profit, position_size, notes,
          before_screenshot, after_screenshot, risk_per_trade, r_multiple_planned,
          r_multiple_actual, pnl_dollars, pnl_percent, outcome, trade_duration,
          fees, tick_size, emotion_before, emotion_during, emotion_after, confidence,
          fomo, hesitation, revenge, rule_violations, entry_time, exit_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tradeId, userId, strategy_id || null, symbol, market, trade_date, session || null,
        direction, entry_price, exit_price || null, stop_loss || null, take_profit || null,
        position_size, notes || null, before_screenshot || null, after_screenshot || null,
        riskPerTrade, rMultiplePlanned, rMultipleActual, pnlDollars, pnlPercent, outcome,
        tradeDuration, fees || null, tick_size ? parseFloat(tick_size) : null, emotion_before || null, emotion_during || null, emotion_after || null,
        confidence || null, fomo ? 1 : 0, hesitation ? 1 : 0, revenge ? 1 : 0,
        ruleViolations.length > 0 ? JSON.stringify(ruleViolations) : null,
        entry_time || null, exit_time || null
      ])

      const trade = await Database.get('SELECT * FROM trades WHERE id = ?', [tradeId])
      res.json({ success: true, trade })
    } catch (error) {
      console.error('Error creating trade:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async getTrades(req, res) {
    try {
      const userId = req.user.id
      const { start_date, end_date, strategy_id, market, session, outcome } = req.query

      let query = 'SELECT * FROM trades WHERE user_id = ?'
      const params = [userId]

      if (start_date) {
        query += ' AND trade_date >= ?'
        params.push(start_date)
      }
      if (end_date) {
        query += ' AND trade_date <= ?'
        params.push(end_date)
      }
      if (strategy_id) {
        query += ' AND strategy_id = ?'
        params.push(strategy_id)
      }
      if (market) {
        query += ' AND market = ?'
        params.push(market)
      }
      if (session) {
        query += ' AND session = ?'
        params.push(session)
      }
      if (outcome) {
        query += ' AND outcome = ?'
        params.push(outcome)
      }

      query += ' ORDER BY trade_date DESC, entry_time DESC'

      const trades = await Database.query(query, params)
      res.json({ success: true, trades })
    } catch (error) {
      console.error('Error fetching trades:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async getTrade(req, res) {
    try {
      const userId = req.user.id
      const { id } = req.params
      const trade = await Database.get('SELECT * FROM trades WHERE id = ? AND user_id = ?', [id, userId])
      
      if (!trade) {
        return res.status(404).json({ success: false, error: 'Trade not found' })
      }
      
      res.json({ success: true, trade })
    } catch (error) {
      console.error('Error fetching trade:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async updateTrade(req, res) {
    try {
      const userId = req.user.id
      const tradeId = req.params.id
      const updateData = req.body

      // Verify ownership
      const trade = await Database.get('SELECT * FROM trades WHERE id = ? AND user_id = ?', [tradeId, userId])
      if (!trade) {
        return res.status(404).json({ success: false, error: 'Trade not found' })
      }

      // Recalculate auto-calculated fields if relevant fields changed
      if (updateData.exit_price || updateData.entry_price || updateData.stop_loss || updateData.take_profit || updateData.position_size) {
        const merged = { ...trade, ...updateData }
        // Recalculate (same logic as createTrade)
        // ... (omitted for brevity, same calculation logic)
      }

      // Build update query dynamically
      const fields = []
      const values = []
      Object.keys(updateData).forEach(key => {
        if (key !== 'id' && key !== 'user_id' && key !== 'created_at') {
          // Include the field even if value is null (to allow clearing fields)
          fields.push(`${key} = ?`)
          values.push(updateData[key] !== undefined ? updateData[key] : null)
        }
      })
      values.push(new Date().toISOString()) // updated_at
      values.push(tradeId, userId)

      await Database.run(`
        UPDATE trades 
        SET ${fields.join(', ')}, updated_at = ?
        WHERE id = ? AND user_id = ?
      `, values)

      const updated = await Database.get('SELECT * FROM trades WHERE id = ?', [tradeId])
      res.json({ success: true, trade: updated })
    } catch (error) {
      console.error('Error updating trade:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async deleteTrade(req, res) {
    try {
      const userId = req.user.id
      const tradeId = req.params.id

      // Check if trade exists first
      const trade = await Database.get('SELECT * FROM trades WHERE id = ? AND user_id = ?', [tradeId, userId])
      if (!trade) {
        return res.status(404).json({ success: false, error: 'Trade not found' })
      }

      await Database.run('DELETE FROM trades WHERE id = ? AND user_id = ?', [tradeId, userId])
      res.json({ success: true, message: 'Trade deleted' })
    } catch (error) {
      console.error('Error deleting trade:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // ========== STRATEGIES ==========

  async createStrategy(req, res) {
    try {
      const userId = req.user.id
      const { name, timeframes, entry_conditions, invalidation_rules, max_risk } = req.body

      const strategyId = crypto.randomUUID()
      await Database.run(`
        INSERT INTO strategies (id, user_id, name, timeframes, entry_conditions, invalidation_rules, max_risk)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [strategyId, userId, name, JSON.stringify(timeframes || []), JSON.stringify(entry_conditions || []), JSON.stringify(invalidation_rules || []), max_risk || null])

      const strategy = await Database.get('SELECT * FROM strategies WHERE id = ?', [strategyId])
      res.json({ success: true, strategy })
    } catch (error) {
      console.error('Error creating strategy:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async getStrategies(req, res) {
    try {
      const userId = req.user.id
      const strategies = await Database.query('SELECT * FROM strategies WHERE user_id = ? ORDER BY created_at DESC', [userId])
      res.json({ success: true, strategies })
    } catch (error) {
      console.error('Error fetching strategies:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async getStrategy(req, res) {
    try {
      const userId = req.user.id
      const { id } = req.params
      const strategy = await Database.get('SELECT * FROM strategies WHERE id = ? AND user_id = ?', [id, userId])
      
      if (!strategy) {
        return res.status(404).json({ success: false, error: 'Strategy not found' })
      }
      
      res.json({ success: true, strategy })
    } catch (error) {
      console.error('Error fetching strategy:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async updateStrategy(req, res) {
    try {
      const userId = req.user.id
      const { id } = req.params
      const { name, timeframes, entry_conditions, invalidation_rules, max_risk } = req.body
      
      await Database.run(`
        UPDATE strategies 
        SET name = ?, timeframes = ?, entry_conditions = ?, invalidation_rules = ?, max_risk = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `, [name, JSON.stringify(timeframes || []), JSON.stringify(entry_conditions || []), JSON.stringify(invalidation_rules || []), max_risk || null, new Date().toISOString(), id, userId])
      
      const strategy = await Database.get('SELECT * FROM strategies WHERE id = ?', [id])
      res.json({ success: true, strategy })
    } catch (error) {
      console.error('Error updating strategy:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async deleteStrategy(req, res) {
    try {
      const userId = req.user.id
      const { id } = req.params
      
      await Database.run('DELETE FROM strategies WHERE id = ? AND user_id = ?', [id, userId])
      res.json({ success: true })
    } catch (error) {
      console.error('Error deleting strategy:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // ========== RULES ==========

  async getOrCreateRules(req, res) {
    try {
      const userId = req.user.id
      let rules = await Database.get('SELECT * FROM rules WHERE user_id = ?', [userId])

      if (!rules) {
        const rulesId = crypto.randomUUID()
        await Database.run(`
          INSERT INTO rules (id, user_id, max_trades_per_day, max_daily_loss, news_filter)
          VALUES (?, ?, ?, ?, ?)
        `, [rulesId, userId, null, null, 0])
        rules = await Database.get('SELECT * FROM rules WHERE id = ?', [rulesId])
      }

      res.json({ success: true, rules })
    } catch (error) {
      console.error('Error fetching rules:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async updateRules(req, res) {
    try {
      const userId = req.user.id
      const { max_trades_per_day, max_daily_loss, news_filter } = req.body

      let rules = await Database.get('SELECT * FROM rules WHERE user_id = ?', [userId])
      if (!rules) {
        const rulesId = crypto.randomUUID()
        await Database.run(`
          INSERT INTO rules (id, user_id, max_trades_per_day, max_daily_loss, news_filter)
          VALUES (?, ?, ?, ?, ?)
        `, [rulesId, userId, max_trades_per_day, max_daily_loss, news_filter ? 1 : 0])
        rules = await Database.get('SELECT * FROM rules WHERE id = ?', [rulesId])
      } else {
        await Database.run(`
          UPDATE rules 
          SET max_trades_per_day = ?, max_daily_loss = ?, news_filter = ?, updated_at = ?
          WHERE id = ? AND user_id = ?
        `, [max_trades_per_day, max_daily_loss, news_filter ? 1 : 0, new Date().toISOString(), rules.id, userId])
        rules = await Database.get('SELECT * FROM rules WHERE id = ?', [rules.id])
      }

      res.json({ success: true, rules })
    } catch (error) {
      console.error('Error updating rules:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // ========== ANALYTICS ==========

  async getAnalytics(req, res) {
    try {
      const userId = req.user.id
      const { start_date, end_date, strategy_id, market, session } = req.query

      let query = 'SELECT * FROM trades WHERE user_id = ?'
      const params = [userId]

      if (start_date) {
        query += ' AND trade_date >= ?'
        params.push(start_date)
      }
      if (end_date) {
        query += ' AND trade_date <= ?'
        params.push(end_date)
      }
      if (strategy_id) {
        query += ' AND strategy_id = ?'
        params.push(strategy_id)
      }
      if (market) {
        query += ' AND market = ?'
        params.push(market)
      }
      if (session) {
        query += ' AND session = ?'
        params.push(session)
      }

      const trades = await Database.query(query, params)

      // Calculate analytics
      const wins = trades.filter(t => t.outcome === 'WIN')
      const losses = trades.filter(t => t.outcome === 'LOSS')
      
      // Breakdown by strategy
      const byStrategy = new Map()
      trades.forEach(trade => {
        const strategyId = trade.strategy_id || 'none'
        if (!byStrategy.has(strategyId)) {
          byStrategy.set(strategyId, { strategy: strategyId, wins: 0, losses: 0, count: 0 })
        }
        const stats = byStrategy.get(strategyId)
        stats.count++
        if (trade.outcome === 'WIN') stats.wins++
        if (trade.outcome === 'LOSS') stats.losses++
      })
      
      // Get strategy names
      const strategies = await Database.query('SELECT * FROM strategies WHERE user_id = ?', [userId])
      const strategyMap = new Map(strategies.map(s => [s.id, s.name]))
      
      const byStrategyArray = Array.from(byStrategy.values()).map(stats => ({
        strategy: strategyMap.get(stats.strategy) || 'No Strategy',
        winRate: stats.count > 0 ? (stats.wins / stats.count) * 100 : 0,
        count: stats.count,
      }))
      
      // Breakdown by session
      const bySession = new Map()
      trades.forEach(trade => {
        const session = trade.session || 'none'
        if (!bySession.has(session)) {
          bySession.set(session, { session, wins: 0, losses: 0, count: 0 })
        }
        const stats = bySession.get(session)
        stats.count++
        if (trade.outcome === 'WIN') stats.wins++
        if (trade.outcome === 'LOSS') stats.losses++
      })
      
      const bySessionArray = Array.from(bySession.values()).map(stats => ({
        session: stats.session === 'none' ? 'No Session' : stats.session,
        winRate: stats.count > 0 ? (stats.wins / stats.count) * 100 : 0,
        count: stats.count,
      }))
      
      const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0
      const totalProfit = wins.reduce((sum, t) => sum + (t.pnl_dollars || 0), 0)
      const totalLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnl_dollars || 0), 0))
      const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : 0
      const avgRR = trades.filter(t => t.r_multiple_actual).length > 0
        ? trades.filter(t => t.r_multiple_actual).reduce((sum, t) => sum + t.r_multiple_actual, 0) / trades.filter(t => t.r_multiple_actual).length
        : 0
      const avgWin = wins.length > 0 ? totalProfit / wins.length : 0
      const avgLoss = losses.length > 0 ? totalLoss / losses.length : 0
      const expectancy = trades.length > 0 ? (winRate / 100 * avgWin) - ((1 - winRate / 100) * avgLoss) : 0

      // Calculate max drawdown
      let peak = 0
      let maxDrawdown = 0
      let runningTotal = 0
      trades.sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date))
      trades.forEach(trade => {
        runningTotal += trade.pnl_dollars || 0
        if (runningTotal > peak) peak = runningTotal
        const drawdown = peak - runningTotal
        if (drawdown > maxDrawdown) maxDrawdown = drawdown
      })

      res.json({
        success: true,
        analytics: {
          totalTrades: trades.length,
          winRate,
          profitFactor,
          avgRR,
          expectancy,
          maxDrawdown,
          totalProfit,
          totalLoss,
          byStrategy: byStrategyArray,
          bySession: bySessionArray,
        }
      })
    } catch (error) {
      console.error('Error fetching analytics:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // ========== HELPER METHODS ==========

  async checkRuleViolations(userId, tradeData) {
    const violations = []
    const rules = await Database.get('SELECT * FROM rules WHERE user_id = ?', [userId])

    if (!rules) return violations

    // Check max trades per day
    if (rules.max_trades_per_day) {
      const tradesToday = await Database.query(
        'SELECT COUNT(*) as count FROM trades WHERE user_id = ? AND trade_date = ?',
        [userId, tradeData.trade_date]
      )
      if (tradesToday[0]?.count >= rules.max_trades_per_day) {
        violations.push({
          type: 'MAX_TRADES_PER_DAY',
          message: `Exceeded max trades per day (${rules.max_trades_per_day})`
        })
      }
    }

    // Check max daily loss
    if (rules.max_daily_loss) {
      const dailyPnL = await Database.query(
        'SELECT SUM(pnl_dollars) as total FROM trades WHERE user_id = ? AND trade_date = ?',
        [userId, tradeData.trade_date]
      )
      const currentLoss = Math.abs(dailyPnL[0]?.total || 0)
      if (currentLoss >= rules.max_daily_loss) {
        violations.push({
          type: 'MAX_DAILY_LOSS',
          message: `Exceeded max daily loss ($${rules.max_daily_loss})`
        })
      }
    }

    // Check news filter (would need integration with economic news API)
    if (rules.news_filter) {
      // This would check if trade was taken during high-impact news
      // Implementation depends on economic news integration
    }

    return violations
  }

  // ========== DAILY REVIEWS ==========

  async createDailyReview(req, res) {
    try {
      const userId = req.user.id
      const { review_date, followed_rules, biggest_mistake, best_execution } = req.body

      const reviewId = crypto.randomUUID()
      await Database.run(`
        INSERT INTO daily_reviews (id, user_id, review_date, followed_rules, biggest_mistake, best_execution)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [reviewId, userId, review_date, followed_rules ? 1 : 0, biggest_mistake || null, best_execution || null])

      const review = await Database.get('SELECT * FROM daily_reviews WHERE id = ?', [reviewId])
      res.json({ success: true, review })
    } catch (error) {
      console.error('Error creating daily review:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async getDailyReview(req, res) {
    try {
      const userId = req.user.id
      const { date } = req.params
      const review = await Database.get('SELECT * FROM daily_reviews WHERE user_id = ? AND review_date = ?', [userId, date])
      res.json({ success: true, review })
    } catch (error) {
      console.error('Error fetching daily review:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async updateDailyReview(req, res) {
    try {
      const userId = req.user.id
      const { id } = req.params
      const { followed_rules, biggest_mistake, best_execution } = req.body
      
      await Database.run(`
        UPDATE daily_reviews 
        SET followed_rules = ?, biggest_mistake = ?, best_execution = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `, [followed_rules ? 1 : 0, biggest_mistake || null, best_execution || null, new Date().toISOString(), id, userId])
      
      const review = await Database.get('SELECT * FROM daily_reviews WHERE id = ?', [id])
      res.json({ success: true, review })
    } catch (error) {
      console.error('Error updating daily review:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // ========== WEEKLY REVIEWS ==========

  async getWeeklyReviews(req, res) {
    try {
      const userId = req.user.id
      const reviews = await Database.query('SELECT * FROM weekly_reviews WHERE user_id = ? ORDER BY week_start_date DESC', [userId])
      res.json({ success: true, reviews })
    } catch (error) {
      console.error('Error fetching weekly reviews:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async getWeeklyReview(req, res) {
    try {
      const userId = req.user.id
      const { weekStart } = req.params
      const review = await Database.get('SELECT * FROM weekly_reviews WHERE user_id = ? AND week_start_date = ?', [userId, weekStart])
      res.json({ success: true, review })
    } catch (error) {
      console.error('Error fetching weekly review:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async generateWeeklyReview(req, res) {
    try {
      const userId = req.user.id
      
      // Get current week
      const today = new Date()
      const dayOfWeek = today.getDay()
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - dayOfWeek)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      
      const weekStartStr = weekStart.toISOString().split('T')[0]
      const weekEndStr = weekEnd.toISOString().split('T')[0]
      
      // Check if review already exists
      let review = await Database.get('SELECT * FROM weekly_reviews WHERE user_id = ? AND week_start_date = ?', [userId, weekStartStr])
      
      if (review) {
        return res.json({ success: true, review })
      }
      
      // Get trades for the week
      const trades = await Database.query(`
        SELECT * FROM trades 
        WHERE user_id = ? AND trade_date >= ? AND trade_date <= ?
        ORDER BY trade_date DESC
      `, [userId, weekStartStr, weekEndStr])
      
      // Get strategies
      const strategies = await Database.query('SELECT * FROM strategies WHERE user_id = ?', [userId])
      const strategyMap = new Map(strategies.map(s => [s.id, s.name]))
      
      // Calculate best strategy
      const strategyStats = new Map()
      trades.forEach(trade => {
        const strategyName = strategyMap.get(trade.strategy_id) || 'No Strategy'
        if (!strategyStats.has(strategyName)) {
          strategyStats.set(strategyName, { wins: 0, total: 0, pnl: 0 })
        }
        const stats = strategyStats.get(strategyName)
        stats.total++
        if (trade.outcome === 'WIN') stats.wins++
        if (trade.pnl_dollars) stats.pnl += trade.pnl_dollars
      })
      
      let bestStrategy = 'N/A'
      let bestPnl = -Infinity
      strategyStats.forEach((stats, name) => {
        if (stats.pnl > bestPnl) {
          bestPnl = stats.pnl
          bestStrategy = name
        }
      })
      
      // Get daily reviews for the week
      const dailyReviews = await Database.query(`
        SELECT * FROM daily_reviews 
        WHERE user_id = ? AND review_date >= ? AND review_date <= ?
      `, [userId, weekStartStr, weekEndStr])
      
      // Find most common violation
      const violations = new Map()
      trades.forEach(trade => {
        if (trade.rule_violations) {
          try {
            const violationsList = typeof trade.rule_violations === 'string' ? JSON.parse(trade.rule_violations) : trade.rule_violations
            if (Array.isArray(violationsList)) {
              violationsList.forEach((v) => {
                violations.set(v, (violations.get(v) || 0) + 1)
              })
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      })
      
      let mostCommonViolation = 'None'
      let maxCount = 0
      violations.forEach((count, violation) => {
        if (count > maxCount) {
          maxCount = count
          mostCommonViolation = violation
        }
      })
      
      // Find worst mistake from daily reviews
      const mistakes = dailyReviews
        .filter(r => r.biggest_mistake)
        .map(r => r.biggest_mistake)
      
      const worstMistake = mistakes.length > 0 ? mistakes[0] : 'No significant mistakes recorded'
      
      // Create review
      const reviewId = crypto.randomUUID()
      await Database.run(`
        INSERT INTO weekly_reviews (id, user_id, week_start_date, week_end_date, best_strategy, worst_mistake, most_common_violation, focus_rule)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [reviewId, userId, weekStartStr, weekEndStr, bestStrategy, worstMistake, mostCommonViolation, 'Focus on following your rules'])
      
      review = await Database.get('SELECT * FROM weekly_reviews WHERE id = ?', [reviewId])
      res.json({ success: true, review })
    } catch (error) {
      console.error('Error generating weekly review:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }
}

export default new TradingJournalController()

