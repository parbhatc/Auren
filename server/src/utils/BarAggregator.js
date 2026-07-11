import { alignBarOpenSec } from './backtesterResolution.js'

/**
 * Aggregates 1-minute bars into higher timeframes
 * @param {Array} bars - Array of 1-minute bars with {time, open, high, low, close, volume}
 * @param {string} resolution - Target resolution (e.g., "1", "2", "5", "15", "1D", "1W", "1M")
 * @returns {Array} Array of aggregated bars
 */
function aggregateBars(bars, resolution) {
    // If resolution is "1", return bars as-is (no aggregation needed)
    if (resolution === "1" || !bars || bars.length === 0) {
        return bars;
    }
    
    const buckets = new Map();
    const isDaily = resolution.match(/^(\d+)D$/);
    
    for (const bar of bars) {
        const barDate = new Date(bar.time);
        let bucketKey;
        
        // Handle daily resolution (1D, 2D, etc.)
        const dailyMatch = resolution.match(/^(\d+)D$/);
        if (dailyMatch) {
            const days = parseInt(dailyMatch[1]) || 1;
            // Align to day boundary using UTC to avoid timezone issues
            // Calculate days since epoch and align to period
            const msSinceEpoch = barDate.getTime();
            const daysSinceEpoch = Math.floor(msSinceEpoch / 86400000);
            const alignedDays = Math.floor(daysSinceEpoch / days) * days;
            // Create bucket time at UTC midnight of the aligned day
            bucketKey = alignedDays * 86400000;
        }
        // Handle weekly resolution (1W, 2W, etc.)
        else if (resolution.match(/^(\d+)W$/)) {
            const weeklyMatch = resolution.match(/^(\d+)W$/);
            const weeks = parseInt(weeklyMatch[1]) || 1;
            // Align to week boundary (Monday at 00:00:00)
            const alignedDate = new Date(barDate);
            alignedDate.setHours(0, 0, 0, 0);
            const dayOfWeek = alignedDate.getDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so move back 6 days
            alignedDate.setDate(alignedDate.getDate() - daysToMonday);
            // For multi-week periods, align to the period boundary
            const msSinceEpoch = alignedDate.getTime();
            const daysSinceEpoch = Math.floor(msSinceEpoch / 86400000);
            const weeksSinceEpoch = Math.floor(daysSinceEpoch / 7);
            const alignedWeeks = Math.floor(weeksSinceEpoch / weeks) * weeks;
            const alignedDays = alignedWeeks * 7;
            const bucketTime = new Date(alignedDays * 86400000);
            bucketKey = bucketTime.getTime();
        }
        // Handle monthly resolution (1M, 2M, etc.)
        else if (resolution.match(/^(\d+)M$/)) {
            const monthlyMatch = resolution.match(/^(\d+)M$/);
            const months = parseInt(monthlyMatch[1]) || 1;
            // Align to month boundary (first day of month at 00:00:00)
            const alignedDate = new Date(barDate);
            alignedDate.setHours(0, 0, 0, 0);
            alignedDate.setDate(1); // First day of month
            // For multi-month periods, align to the period boundary
            const monthIndex = alignedDate.getMonth();
            const alignedMonth = Math.floor(monthIndex / months) * months;
            const bucketTime = new Date(alignedDate.getFullYear(), alignedMonth, 1);
            bucketKey = bucketTime.getTime();
        }
        // Handle numeric minute resolutions (1, 2, 5, 15, 60, 240, etc.)
        else {
            const resolutionMinutes = parseInt(resolution);
            if (isNaN(resolutionMinutes) || resolutionMinutes <= 1) {
                return bars; // Invalid resolution, return as-is
            }

            // Align to the CME session (18:00 ET) via alignBarOpenSec so intraday
            // HTF candles match TradingView (4h -> 18/22/02/06/10/14 ET) and stay
            // consistent with the replay path. The old code aligned only
            // minutes-within-the-hour (getMinutes 0-59), collapsing every
            // resolution >= 60min to hourly candles (4h -> 1h).
            bucketKey = alignBarOpenSec(Math.floor(bar.time / 1000), resolution) * 1000;
        }
        
        if (!buckets.has(bucketKey)) {
            buckets.set(bucketKey, {
                time_string: new Date(bucketKey).toLocaleString(),
                time: bucketKey,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                volume: bar.volume || 0,
                firstBarTime: bar.time,  // Track first bar time
                lastBarTime: bar.time    // Track last bar time
            });
        } else {
            const bucket = buckets.get(bucketKey);
            bucket.high = Math.max(bucket.high, bar.high);
            bucket.low = Math.min(bucket.low, bar.low);
            bucket.volume += (bar.volume || 0);
            
            // Update open if this is an earlier bar
            if (bar.time < bucket.firstBarTime) {
                bucket.open = bar.open;
                bucket.firstBarTime = bar.time;
            }
            
            // Update close if this is a later bar
            if (bar.time > bucket.lastBarTime) {
                bucket.close = bar.close;
                bucket.lastBarTime = bar.time;
            }
        }
    }
    
    // Convert map to array and clean up temporary properties, then sort by time
    const result = Array.from(buckets.values()).map(bucket => {
        // Remove tracking properties
        const { firstBarTime, lastBarTime, ...cleanBucket } = bucket;
        return cleanBucket;
    }).sort((a, b) => a.time - b.time);
    
    // Debug for daily aggregation
    if (isDaily && result.length > 0) {
        console.log(`[BarAggregator] Daily aggregation: ${bars.length} 1-min bars → ${result.length} daily candles`);
        console.log(`[BarAggregator] First daily candle: ${new Date(result[0].time).toLocaleString()}`);
        console.log(`[BarAggregator] Last daily candle: ${new Date(result[result.length - 1].time).toLocaleString()}`);
    }
    
    return result;
}


export default aggregateBars;