import fs from 'fs';
import {
    DEFAULT_CSV_RESOLUTION,
    monthNameFromIndex,
    resolveMonthFilePath as resolveBacktesterMonthPath,
} from './backtesterCsvPaths.js';

class CSVLoader {
    
    constructor(csvDir) {
        this.csvDir = csvDir;
        // Cache: {symbol: {csvResolution: {year: {month: {bars, lastAccess}}}}}
        this.monthCache = {};
        this.cacheTTL = 60 * 60 * 1000; // 1 hour in milliseconds
        
        // Start cleanup interval (runs every 10 minutes)
        setInterval(() => this.cleanupCache(), 10 * 60 * 1000);
    }
    
    // Get month data (loads from file if not cached)
    getMonthData(symbol, year, month, csvResolution = DEFAULT_CSV_RESOLUTION) {
        if (!this.monthCache[symbol]) {
            this.monthCache[symbol] = {};
        }
        if (!this.monthCache[symbol][csvResolution]) {
            this.monthCache[symbol][csvResolution] = {};
        }
        if (!this.monthCache[symbol][csvResolution][year]) {
            this.monthCache[symbol][csvResolution][year] = {};
        }
        
        const monthName = this.getMonthName(month);
        const cacheEntry = this.monthCache[symbol][csvResolution][year][monthName];
        
        // Check if cached and still valid
        if (cacheEntry && (Date.now() - cacheEntry.lastAccess) < this.cacheTTL) {
            cacheEntry.lastAccess = Date.now(); // Update access time
            return cacheEntry.bars;
        }
        
        const filePath = this.resolveMonthFilePath(symbol, year, monthName, csvResolution);
        
        if (!filePath || !fs.existsSync(filePath)) {
            this.monthCache[symbol][csvResolution][year][monthName] = {
                bars: [],
                lastAccess: Date.now()
            };
            return [];
        }
        
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.trim().split("\n");
        const bars = [];
        
        for (const line of lines) {
            const parts = line.split(",");
            if (parts.length >= 6) {
                bars.push({
                    time_string: new Date(parseInt(parts[0]) * 1000).toLocaleString(),
                    time: parseInt(parts[0]) * 1000,
                    open: parseFloat(parts[1]),
                    high: parseFloat(parts[2]),
                    low: parseFloat(parts[3]),
                    close: parseFloat(parts[4]),
                    volume: parseInt(parts[5])
                });
            }
        }
        bars.sort((a, b) => a.time - b.time);
        
        // Cache the result
        this.monthCache[symbol][csvResolution][year][monthName] = {
            bars: bars,
            lastAccess: Date.now()
        };
        
        return bars;
    }
    
    // Cleanup cache - remove entries not accessed in 1 hour
    cleanupCache() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const symbol in this.monthCache) {
            for (const csvResolution in this.monthCache[symbol]) {
                for (const year in this.monthCache[symbol][csvResolution]) {
                    for (const month in this.monthCache[symbol][csvResolution][year]) {
                        const entry = this.monthCache[symbol][csvResolution][year][month];
                        if ((now - entry.lastAccess) >= this.cacheTTL) {
                            delete this.monthCache[symbol][csvResolution][year][month];
                            cleaned++;
                        }
                    }
                    
                    if (Object.keys(this.monthCache[symbol][csvResolution][year]).length === 0) {
                        delete this.monthCache[symbol][csvResolution][year];
                    }
                }
                
                if (Object.keys(this.monthCache[symbol][csvResolution]).length === 0) {
                    delete this.monthCache[symbol][csvResolution];
                }
            }
            
            if (Object.keys(this.monthCache[symbol]).length === 0) {
                delete this.monthCache[symbol];
            }
        }
        
        if (cleaned > 0) {
            console.log(`[CSVLoader] Cleaned ${cleaned} expired month cache entries`);
        }
    }
    
    getMonthName(monthIndex) {
        return monthNameFromIndex(monthIndex);
    }

    /** Prefer symbol/1m/year/month.csv; falls back to legacy symbol/year/month.csv */
    resolveMonthFilePath(symbol, year, monthName, resolution = DEFAULT_CSV_RESOLUTION) {
        return resolveBacktesterMonthPath(this.csvDir, symbol, year, monthName, resolution);
    }

    /**
     * Drop one cached CSV month after data management rewrites its file.
     * Without this, replay can keep an hour-old in-memory month and reject a
     * newly downloaded trading day even though the inventory sees it on disk.
     */
    invalidateMonthData(symbol, year, month, csvResolution = DEFAULT_CSV_RESOLUTION) {
        const monthName = this.getMonthName(month);
        const resolutionCache = this.monthCache?.[symbol]?.[csvResolution];
        const yearCache = resolutionCache?.[year];
        if (!yearCache || !Object.prototype.hasOwnProperty.call(yearCache, monthName)) {
            return;
        }

        delete yearCache[monthName];
        if (Object.keys(yearCache).length === 0) delete resolutionCache[year];
        if (Object.keys(resolutionCache).length === 0) delete this.monthCache[symbol][csvResolution];
        if (Object.keys(this.monthCache[symbol]).length === 0) delete this.monthCache[symbol];
    }

    invalidateSymbolData(symbol, csvResolution = null) {
        if (!this.monthCache?.[symbol]) return;
        if (csvResolution == null) {
            delete this.monthCache[symbol];
            return;
        }
        delete this.monthCache[symbol][csvResolution];
        if (Object.keys(this.monthCache[symbol]).length === 0) delete this.monthCache[symbol];
    }
    
    // Load candles for a specific time range
    loadBars(symbol, fromMs, toMs, opts = {}) {
        const csvResolution = opts.csvResolution ?? DEFAULT_CSV_RESOLUTION;
        const fromDate = new Date(fromMs);
        const toDate = new Date(toMs);
        
        let bars = [];
        const fromYear = fromDate.getFullYear();
        const toYear = toDate.getFullYear();
        
        for (let year = fromYear; year <= toYear; year++) {
            const startMonth = (year === fromYear) ? fromDate.getMonth() : 0;
            const endMonth = (year === toYear) ? toDate.getMonth() : 11;
            
            for (let month = startMonth; month <= endMonth; month++) {
                const monthBars = this.getMonthData(symbol, year, month, csvResolution);
                
                // Filter by time range
                for (const bar of monthBars) {
                    if (bar.time >= fromMs && bar.time <= toMs) {
                        bars.push(bar);
                    }
                }
            }
        }
        
        bars.sort((a, b) => a.time - b.time);
        console.log(`Loaded ${bars.length} bars for ${symbol} (${fromDate.toLocaleString()} - ${toDate.toLocaleString()})`);
        
        return bars;
    }
    
    // Load N bars before a specific time
    loadCountback(symbol, beforeMs, count, includeBoundary = false, opts = {}) {
        const csvResolution = opts.csvResolution ?? DEFAULT_CSV_RESOLUTION;
        const beforeDate = new Date(beforeMs);
        let currentYear = beforeDate.getFullYear();
        let currentMonth = beforeDate.getMonth();
        
        let bars = [];
        
        // Go backwards through months until we have enough bars
        while (bars.length < count) {
            const monthBars = this.getMonthData(symbol, currentYear, currentMonth, csvResolution);
            
            // Filter bars before the time (include/exclude boundary based on parameter)
            for (const bar of monthBars) {
                if (includeBoundary ? bar.time <= beforeMs : bar.time < beforeMs) {
                    bars.push(bar);
                }
            }
            
            // Go to previous month
            currentMonth--;
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            
            // Safety: stop if we've gone too far back (e.g., 10 years)
            if (currentYear < beforeDate.getFullYear() - 10) {
                break;
            }
        }
        
        // Sort and take last N bars
        bars.sort((a, b) => a.time - b.time);
        bars = bars.slice(-count);
        
        console.log(`Loaded ${bars.length} bars (countback ${count}) for ${symbol} before ${beforeDate.toLocaleString()}`);
        
        return bars;
    }
    
    // Load N bars after a specific time
    loadForward(symbol, afterMs, count, opts = {}) {
        const csvResolution = opts.csvResolution ?? DEFAULT_CSV_RESOLUTION;
        const afterDate = new Date(afterMs);
        let currentYear = afterDate.getFullYear();
        let currentMonth = afterDate.getMonth();
        
        let bars = [];
        
        // Go forward through months until we have enough bars
        while (bars.length < count) {
            const monthBars = this.getMonthData(symbol, currentYear, currentMonth, csvResolution);
    
            // Filter bars after the time
            for (const bar of monthBars) {
                if (bar.time > afterMs) {
                    bars.push(bar);

                    // Stop if we have enough bars
                    if (bars.length >= count) {
                        break;
                    }
                }
            }
            
            // Go to next month
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            
            // Safety: stop if we've gone too far forward (e.g., 10 years)
            if (currentYear > afterDate.getFullYear() + 10) {
                break;
            }
        }
        
        // Sort and take first N bars
        bars.sort((a, b) => a.time - b.time);
        bars = bars.slice(0, count);
        
        console.log(`Loaded ${bars.length} bars (forward ${count}) for ${symbol} after ${afterDate.toLocaleString()}`);
        
        return bars;
    }
    
    // Load N trading days before a specific time
    loadDayCountback(symbol, beforeMs, tradingDays, includeBoundary = false, opts = {}) {
        const csvResolution = opts.csvResolution ?? DEFAULT_CSV_RESOLUTION;
        const beforeDate = new Date(beforeMs);
        let currentYear = beforeDate.getFullYear();
        let currentMonth = beforeDate.getMonth();
        
        let allBars = [];
        let tradingDaySet = new Set();
        let dayBarsMap = new Map();
        let loadedMonths = 0;
        const maxMonthsToLoad = Math.ceil(tradingDays / 20) + 12;
        
        console.log(`[loadDayCountback] Starting to load data for ${tradingDays} trading days, maxMonths: ${maxMonthsToLoad}`);
        
        // Load months going backwards until we have enough trading days
        while (loadedMonths < maxMonthsToLoad) {
            const monthBars = this.getMonthData(symbol, currentYear, currentMonth, csvResolution);
            
            for (const bar of monthBars) {
                if (includeBoundary ? bar.time <= beforeMs : bar.time < beforeMs) {
                    allBars.push(bar);
                    
                    const barDate = new Date(bar.time);
                    const daysSinceEpoch = Math.floor(barDate.getTime() / 86400000);
                    const dayOfWeek = barDate.getUTCDay();
                    const isTradingDay = dayOfWeek >= 1 && dayOfWeek <= 5;
                    
                    if (isTradingDay) {
                        if (!dayBarsMap.has(daysSinceEpoch)) {
                            dayBarsMap.set(daysSinceEpoch, []);
                        }
                        dayBarsMap.get(daysSinceEpoch).push(bar);
                        tradingDaySet.add(daysSinceEpoch);
                    }
                }
            }
            
            loadedMonths++;
            
            // Check if we have enough trading days
            if (tradingDaySet.size >= tradingDays) {
                console.log(`[loadDayCountback] Found ${tradingDaySet.size} trading days after loading ${loadedMonths} months`);
                break;
            }
            
            // Go to previous month
            currentMonth--;
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            
            // Safety: stop if we've gone too far back
            if (currentYear < beforeDate.getFullYear() - 10) {
                break;
            }
        }
        
        // Get the most recent N trading days
        const sortedTradingDays = Array.from(tradingDaySet).sort((a, b) => b - a);
        const selectedDays = sortedTradingDays.slice(0, tradingDays);
        
        const resultBars = [];
        for (const dayKey of selectedDays.sort((a, b) => a - b)) {
            const dayBars = dayBarsMap.get(dayKey);
            if (dayBars) {
                dayBars.sort((a, b) => a.time - b.time);
                resultBars.push(...dayBars);
            }
        }
        
        console.log(`Loaded ${resultBars.length} bars for ${selectedDays.length} trading days for ${symbol}`);
        
        return resultBars;
    }
    
    // Check if a specific date has data for a symbol
    hasDateData(symbol, date) {
        const dateObj = new Date(date);
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth();
        const day = dateObj.getDate();
        
        // Get the start and end of the day in milliseconds
        const dayStart = new Date(year, month, day, 0, 0, 0, 0).getTime();
        const dayEnd = new Date(year, month, day, 23, 59, 59, 999).getTime();
        
        // Get month data
        const monthBars = this.getMonthData(symbol, year, month);
        
        // Check if any bars exist for this date
        const hasData = monthBars.some(bar => {
            const barTime = bar.time;
            return barTime >= dayStart && barTime <= dayEnd;
        });
        
        return hasData;
    }
    
    // Check if any of the given symbols have data for a date
    hasDateDataForAnySymbol(symbols, date) {
        for (const symbol of symbols) {
            if (this.hasDateData(symbol, date)) {
                return true;
            }
        }
        return false;
    }
    
    // Find the previous day (before the given date) that has data
    // Returns a Date object for the day, or null if no data found
    // If withTime is true, checks for exact candle with same hour and minutes
    findPreviousDayWithData(symbol, date, withTime = false) {
        const dateObj = new Date(date);
        const maxDaysBack = 365; // Limit search to 1 year back
        let currentDate = new Date(dateObj);
        currentDate.setDate(currentDate.getDate() - 1); // Start from day before
        
        // Get original hour and minute if withTime is true
        const originalHour = dateObj.getHours();
        const originalMinute = dateObj.getMinutes();
        
        for (let i = 0; i < maxDaysBack; i++) {
            let hasData = false;
            
            if (withTime) {
                // Check for exact candle with same hour and minute
                const targetTime = new Date(currentDate);
                targetTime.setHours(originalHour);
                targetTime.setMinutes(originalMinute);
                targetTime.setSeconds(0);
                targetTime.setMilliseconds(0);
                hasData = this.hasExactCandle(symbol, targetTime.getTime());
            } else {
                // Check if day has any data
                hasData = this.hasDateData(symbol, currentDate);
            }
            
            if (hasData) {
                if (withTime) {
                    // Return date with original hour and minute
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    const day = currentDate.getDate();
                    return new Date(year, month, day, originalHour, originalMinute, 0, 0);
                } else {
                    // Return date at midnight of the day with data
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    const day = currentDate.getDate();
                    return new Date(year, month, day, 0, 0, 0, 0);
                }
            }
            currentDate.setDate(currentDate.getDate() - 1);
        }
        
        return null; // No data found
    }
    
    findPreviousDayWithDataForAnySymbol(symbols, date, withTime = false) {
        const dateObj = new Date(date);
        const maxDaysBack = 365;
        let currentDate = new Date(dateObj);
        currentDate.setDate(currentDate.getDate() - 1);

        const originalHour = dateObj.getHours();
        const originalMinute = dateObj.getMinutes();

        for (let i = 0; i < maxDaysBack; i++) {
            let hasData = false;

            if (withTime) {
                const targetTime = new Date(currentDate);
                targetTime.setHours(originalHour);
                targetTime.setMinutes(originalMinute);
                targetTime.setSeconds(0);
                targetTime.setMilliseconds(0);
                for (const symbol of symbols) {
                    if (this.hasExactCandle(symbol, targetTime.getTime())) {
                        hasData = true;
                        break;
                    }
                }
            } else {
                hasData = this.hasDateDataForAnySymbol(symbols, currentDate);
            }

            if (hasData) {
                if (withTime) {
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    const day = currentDate.getDate();
                    return new Date(year, month, day, originalHour, originalMinute, 0, 0);
                }
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth();
                const day = currentDate.getDate();
                return new Date(year, month, day, 0, 0, 0, 0);
            }
            currentDate.setDate(currentDate.getDate() - 1);
        }

        return null;
    }
    
    // Find the next day (after the given date) that has data
    // Returns a Date object for the day, or null if no data found
    // If withTime is true, checks for exact candle with same hour and minutes
    findNextDayWithData(symbol, date, withTime = false) {
        const dateObj = new Date(date);
        const maxDaysForward = 365; // Limit search to 1 year forward
        let currentDate = new Date(dateObj);
        currentDate.setDate(currentDate.getDate() + 1); // Start from day after
        
        // Get original hour and minute if withTime is true
        const originalHour = dateObj.getHours();
        const originalMinute = dateObj.getMinutes();
        
        for (let i = 0; i < maxDaysForward; i++) {
            let hasData = false;
            
            if (withTime) {
                // Check for exact candle with same hour and minute
                const targetTime = new Date(currentDate);
                targetTime.setHours(originalHour);
                targetTime.setMinutes(originalMinute);
                targetTime.setSeconds(0);
                targetTime.setMilliseconds(0);
                hasData = this.hasExactCandle(symbol, targetTime.getTime());
            } else {
                // Check if day has any data
                hasData = this.hasDateData(symbol, currentDate);
            }
            
            if (hasData) {
                if (withTime) {
                    // Return date with original hour and minute
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    const day = currentDate.getDate();
                    return new Date(year, month, day, originalHour, originalMinute, 0, 0);
                } else {
                    // Return date at midnight of the day with data
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    const day = currentDate.getDate();
                    return new Date(year, month, day, 0, 0, 0, 0);
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return null; // No data found
    }

    findNextDayWithDataForAnySymbol(symbols, date, withTime = false) {
        const dateObj = new Date(date);
        const maxDaysForward = 365;
        let currentDate = new Date(dateObj);
        currentDate.setDate(currentDate.getDate() + 1);

        const originalHour = dateObj.getHours();
        const originalMinute = dateObj.getMinutes();

        for (let i = 0; i < maxDaysForward; i++) {
            let hasData = false;

            if (withTime) {
                const targetTime = new Date(currentDate);
                targetTime.setHours(originalHour);
                targetTime.setMinutes(originalMinute);
                targetTime.setSeconds(0);
                targetTime.setMilliseconds(0);
                for (const symbol of symbols) {
                    if (this.hasExactCandle(symbol, targetTime.getTime())) {
                        hasData = true;
                        break;
                    }
                }
            } else {
                hasData = this.hasDateDataForAnySymbol(symbols, currentDate);
            }

            if (hasData) {
                if (withTime) {
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    const day = currentDate.getDate();
                    return new Date(year, month, day, originalHour, originalMinute, 0, 0);
                }
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth();
                const day = currentDate.getDate();
                return new Date(year, month, day, 0, 0, 0, 0);
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return null;
    }
    
    // Find the closest candle to a given time for a symbol
    findClosestCandle(symbol, targetTime) {
        const targetDate = new Date(targetTime);
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth();
        
        // Get month data
        const monthBars = this.getMonthData(symbol, year, month);
        
        if (monthBars.length === 0) {
            // Try previous and next month
            let prevMonth = month - 1;
            let prevYear = year;
            if (prevMonth < 0) {
                prevMonth = 11;
                prevYear--;
            }
            
            let nextMonth = month + 1;
            let nextYear = year;
            if (nextMonth > 11) {
                nextMonth = 0;
                nextYear++;
            }
            
            const prevBars = this.getMonthData(symbol, prevYear, prevMonth);
            const nextBars = this.getMonthData(symbol, nextYear, nextMonth);
            const allBars = [...prevBars, ...nextBars];
            
            if (allBars.length === 0) {
                return null;
            }
            
            // Find closest bar
            let closest = allBars[0];
            let minDiff = Math.abs(allBars[0].time - targetTime);
            
            for (const bar of allBars) {
                const diff = Math.abs(bar.time - targetTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = bar;
                }
            }
            
            return closest;
        }
        
        // Find closest bar in the same month
        let closest = monthBars[0];
        let minDiff = Math.abs(monthBars[0].time - targetTime);
        
        for (const bar of monthBars) {
            const diff = Math.abs(bar.time - targetTime);
            if (diff < minDiff) {
                minDiff = diff;
                closest = bar;
            }
        }
        
        return closest;
    }
    
    // Find the closest candle across multiple symbols
    findClosestCandleForAnySymbol(symbols, targetTime) {
        let closestBar = null;
        let minDiff = Infinity;
        
        for (const symbol of symbols) {
            const bar = this.findClosestCandle(symbol, targetTime);
            if (bar) {
                const diff = Math.abs(bar.time - targetTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestBar = bar;
                }
            }
        }
        
        return closestBar;
    }
    
    // Find the latest candle in a specific day for a symbol
    findLatestCandleInDay(symbol, date) {
        const dateObj = new Date(date);
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth();
        const day = dateObj.getDate();
        
        // Get the start and end of the day in milliseconds
        const dayStart = new Date(year, month, day, 0, 0, 0, 0).getTime();
        const dayEnd = new Date(year, month, day, 23, 59, 59, 999).getTime();
        
        // Get month data
        const monthBars = this.getMonthData(symbol, year, month);
        
        // Filter bars for this day and find the latest
        const dayBars = monthBars.filter(bar => {
            return bar.time >= dayStart && bar.time <= dayEnd;
        });
        
        if (dayBars.length === 0) {
            return null;
        }
        
        // Return the bar with the latest time
        return dayBars.reduce((latest, bar) => {
            return bar.time > latest.time ? bar : latest;
        });
    }
    
    // Check if exact candle exists at a specific time
    hasExactCandle(symbol, time) {
        const dateObj = new Date(time);
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth();
        
        const monthBars = this.getMonthData(symbol, year, month);
        return monthBars.some(bar => bar.time === time);
    }

    // Clear all cache
    clearCache() {
        this.monthCache = {};
    }
}

export default CSVLoader;
