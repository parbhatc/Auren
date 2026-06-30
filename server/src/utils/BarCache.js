import { DEFAULT_CSV_RESOLUTION } from './backtesterCsvPaths.js'

function csvResolutionFromOpts(opts = {}) {
  return opts.csvResolution ?? DEFAULT_CSV_RESOLUTION
}

function bucketKey(symbol, csvResolution = DEFAULT_CSV_RESOLUTION) {
  return `${symbol}:${csvResolution}`
}

class BarCache {

  constructor(client, last) {
    this.client = client;
    this.csvLoader = client.csvLoader;
    this.last = last;
    /** @type {Record<string, { bars: Record<number, object>, oldest: number | null, newest: number | null }>} */
    this.cache = {};
  }

  loadCountback(symbol, beforeMs, count, includeBoundary = false, opts = {}) {
    const bars = this.csvLoader.loadCountback(symbol, beforeMs, count, includeBoundary, opts);
    this.addBars(symbol, bars, opts);
    return bars;
  }

  loadForward(symbol, afterMs, count, opts = {}) {
    const bars = this.csvLoader.loadForward(symbol, afterMs, count, opts);
    this.addBars(symbol, bars, opts);
    if (bars.length > 0) {
      this.last = new Date(bars[bars.length - 1].time);
    }
    return bars;
  }

  loadRange(symbol, fromMs, toMs, opts = {}) {
    const bars = this.csvLoader.loadBars(symbol, fromMs, toMs, opts);
    this.addBars(symbol, bars, opts);
    return bars;
  }

  loadDayCountback(symbol, beforeMs, tradingDays, includeBoundary = false, opts = {}) {
    const bars = this.csvLoader.loadDayCountback(symbol, beforeMs, tradingDays, includeBoundary, opts);
    this.addBars(symbol, bars, opts);
    return bars;
  }

  getCount(symbol, opts = {}) {
    const cache = this.cache[bucketKey(symbol, csvResolutionFromOpts(opts))];
    return cache ? Object.keys(cache.bars).length : 0;
  }

  init(symbol, opts = {}) {
    const csvResolution = csvResolutionFromOpts(opts);
    const key = bucketKey(symbol, csvResolution);
    if (!this.cache[key]) {
      this.cache[key] = {
        bars: {},
        oldest: null,
        newest: null,
      };
    }
    return this.cache[key];
  }

  /** Clear one symbol bucket or all resolution buckets for a symbol. */
  clear(symbol, opts = {}) {
    const csvResolution = opts.csvResolution;
    if (csvResolution) {
      delete this.cache[bucketKey(symbol, csvResolution)];
      return;
    }
    const prefix = `${symbol}:`;
    for (const key of Object.keys(this.cache)) {
      if (key === symbol || key.startsWith(prefix)) {
        delete this.cache[key];
      }
    }
  }

  clearAll() {
    this.cache = {};
  }

  addBars(symbol, bars, opts = {}) {
    const cache = this.init(symbol, opts);

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

  gtBarByTime(symbol, time, opts = {}) {
    return this.cache[bucketKey(symbol, csvResolutionFromOpts(opts))]?.bars[time] || null;
  }

  hasData(symbol, opts = {}) {
    const cache = this.cache[bucketKey(symbol, csvResolutionFromOpts(opts))];
    return Boolean(cache && cache.oldest !== null);
  }

  getOldest(symbol, opts = {}) {
    return this.cache[bucketKey(symbol, csvResolutionFromOpts(opts))]?.oldest ?? null;
  }

  getNewest(symbol, opts = {}) {
    return this.cache[bucketKey(symbol, csvResolutionFromOpts(opts))]?.newest ?? null;
  }

  getAllBars(symbol, opts = {}) {
    const cache = this.cache[bucketKey(symbol, csvResolutionFromOpts(opts))];
    if (!cache?.bars) {
      return [];
    }
    return Object.values(cache.bars).sort((a, b) => a.time - b.time);
  }
}

export default BarCache;
