/**
 * Merge TradingView UDF history chunks ({ t, o, h, l, c, v }) by bar time (seconds).
 * Later chunks overwrite earlier bars at the same timestamp.
 */
export function mergeUdfChunks(chunks) {
  const byTime = new Map()

  for (const chunk of chunks) {
    const udf = chunk?.udf ?? chunk
    if (!udf?.t?.length) continue
    for (let i = 0; i < udf.t.length; i++) {
      const t = Number(udf.t[i])
      if (!Number.isFinite(t)) continue
      byTime.set(t, {
        t,
        o: Number(udf.o?.[i]),
        h: Number(udf.h?.[i]),
        l: Number(udf.l?.[i]),
        c: Number(udf.c?.[i]),
        v: Number(udf.v?.[i] ?? 0),
      })
    }
  }

  const bars = [...byTime.values()].sort((a, b) => a.t - b.t)
  return {
    s: 'ok',
    t: bars.map((b) => b.t),
    o: bars.map((b) => b.o),
    h: bars.map((b) => b.h),
    l: bars.map((b) => b.l),
    c: bars.map((b) => b.c),
    v: bars.map((b) => b.v),
  }
}

export function slugForCandleDebug(symbol, resolution) {
  return `${symbol}_${resolution}`.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 120)
}
