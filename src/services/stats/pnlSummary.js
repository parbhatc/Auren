/**
 * O(1)-memory P&L aggregation.
 *
 * Welford's online variance avoids allocating and scanning separate P&L, wins,
 * and losses arrays. It is also numerically more stable for large histories.
 */
export class PnlAccumulator {
  constructor() {
    this.count = 0
    this.wins = 0
    this.losses = 0
    this.total = 0
    this.totalCompensation = 0
    this.totalWins = 0
    this.totalLosses = 0
    this.largestWin = 0
    this.largestLoss = 0
    this.mean = 0
    this.m2 = 0
  }

  /** @returns {boolean} whether the value was accepted */
  add(rawValue) {
    if (rawValue == null || rawValue === '') return false
    const value = Number(rawValue)
    if (!Number.isFinite(value)) return false

    this.count += 1
    // Kahan summation limits cancellation error across long mixed-sign histories.
    const corrected = value - this.totalCompensation
    const nextTotal = this.total + corrected
    this.totalCompensation = nextTotal - this.total - corrected
    this.total = nextTotal

    const delta = value - this.mean
    this.mean += delta / this.count
    this.m2 += delta * (value - this.mean)

    if (value > 0) {
      this.wins += 1
      this.totalWins += value
      if (this.wins === 1 || value > this.largestWin) this.largestWin = value
    } else {
      // Preserve the existing convention that breakeven trades count as losses.
      this.losses += 1
      this.totalLosses += value
      if (this.losses === 1 || value < this.largestLoss) this.largestLoss = value
    }
    return true
  }

  summary() {
    const avgWin = this.wins > 0 ? this.totalWins / this.wins : 0
    const avgLoss = this.losses > 0 ? this.totalLosses / this.losses : 0
    const lossMagnitude = Math.abs(this.totalLosses)
    const profitFactor =
      lossMagnitude > 0 ? this.totalWins / lossMagnitude : this.totalWins > 0 ? Infinity : 0
    const avgWinLossFactor =
      avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : avgWin > 0 ? Infinity : 0
    const variance = this.count > 0 ? this.m2 / this.count : 0
    const stdDev = Math.sqrt(Math.max(0, variance))

    return {
      count: this.count,
      wins: this.wins,
      losses: this.losses,
      total: this.total,
      avgWin,
      avgLoss,
      largestWin: this.wins > 0 ? this.largestWin : 0,
      largestLoss: this.losses > 0 ? this.largestLoss : 0,
      profitFactor,
      avgWinLossFactor,
      sharpeRatio: stdDev > 0 ? this.total / this.count / stdDev : 0,
    }
  }
}
