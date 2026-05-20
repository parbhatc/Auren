class BarCache {

  constructor(client, last) {
    this.client = client;
    this.csvLoader = client.csvLoader;
    this.last = last;
    this.cache = {};
  }
  
  
  loadCountback(symbol, beforeMs, count, includeBoundary = false) {
    const bars = this.csvLoader.loadCountback(symbol, beforeMs, count, includeBoundary);
    this.addBars(symbol, bars);
    return bars;
  }
  
  loadForward(symbol, afterMs, count) {
    const bars = this.csvLoader.loadForward(symbol, afterMs, count);
    this.addBars(symbol, bars);
    this.last = new Date(bars[bars.length - 1].time);
    return bars;
  }

  loadRange(symbol, fromMs, toMs) {
    const bars = this.csvLoader.loadBars(symbol, fromMs, toMs);
    this.addBars(symbol, bars);
    return bars;
  }

  loadDayCountback(symbol, beforeMs, tradingDays, includeBoundary = false) {
    const bars = this.csvLoader.loadDayCountback(symbol, beforeMs, tradingDays, includeBoundary);
    this.addBars(symbol, bars);
    return bars;
  }

  getCount(symbol) {
    return this.cache[symbol] ? Object.keys(this.cache[symbol].bars).length : 0;
  }

  init(symbol) {
    if (!this.cache[symbol]) {
      this.cache[symbol] = {
        bars: {},
        oldest: null,
        newest: null
      }
    }
    return this.cache[symbol];
  }

  clear(symbol) {
    delete this.cache[symbol];
  }
  
  addBars(symbol, bars) {
    const cache = this.init(symbol);
        
    for (const bar of bars) {
        cache.bars[bar.time] = bar;
        
        if (cache.oldest === null || bar.time < cache.oldest) {
            cache.oldest = bar.time;
        }
        if (cache.newest === null || bar.time > cache.newest) {
            cache.newest = bar.time;
        }
    }
  }


  gtBarByTime(symbol, time) {
    return this.cache[symbol]?.bars[time] || null;
  }

  hasData(symbol) {
    return this.cache[symbol] && this.cache[symbol].oldest !== null;
  }

  getOldest(symbol) {
    return this.cache[symbol].oldest || null;
  }

  getNewest(symbol) {
    return this.cache[symbol].newest || null;
  }

  getAllBars(symbol) {
    if (!this.cache[symbol] || !this.cache[symbol].bars) {
      return [];
    }
    // Convert the bars object to an array and sort by time
    return Object.values(this.cache[symbol].bars).sort((a, b) => a.time - b.time);
  }
}

export default BarCache;