/**
 * Candle Node - Linked list node for candles
 */
export class CandleNode {
  time: number
  open: number
  high: number
  low: number
  close: number
  previous: CandleNode | null
  next: CandleNode | null

  constructor(time: number, open: number, high: number, low: number, close: number) {
    this.time = time
    this.open = open
    this.high = high
    this.low = low
    this.close = close
    this.previous = null
    this.next = null
  }

  /**
   * Get candle at offset (0 = current, 1 = previous, 2 = 2 bars ago, etc.)
   * @param offset - Offset from current candle
   * @returns CandleNode or null
   */
  at(offset: number): CandleNode | null {
    if (offset === 0) return this
    if (offset < 0) {
      // Go forward
      let node: CandleNode | null = this
      for (let i = 0; i < Math.abs(offset); i++) {
        if (!node?.next) return null
        node = node.next
      }
      return node
    } else {
      // Go backward
      let node: CandleNode | null = this
      for (let i = 0; i < offset; i++) {
        if (!node?.previous) return null
        node = node.previous
      }
      return node
    }
  }
}
