import { useEffect, useRef, useState } from 'react'

/**
 * Throttle a fast-changing counter to at most one advance per `intervalMs`.
 *
 * Used to decouple expensive position/PnL re-renders from the ~60Hz market
 * `bookTick`: human eyes can't read a PnL value changing faster than ~10Hz, so
 * gating the PnL UI on a throttled tick keeps the chart's animation frames free
 * while the numbers still update smoothly.
 *
 * Trailing-edge: the most recent source value always lands once the interval
 * elapses, so the displayed value never gets stuck behind the live stream.
 */
export function useThrottledTick(sourceTick: number, intervalMs = 100): number {
  const [throttled, setThrottled] = useState(sourceTick)
  const lastRunRef = useRef(0)
  const latestRef = useRef(sourceTick)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  latestRef.current = sourceTick

  useEffect(() => {
    const now = Date.now()
    const elapsed = now - lastRunRef.current
    if (elapsed >= intervalMs) {
      lastRunRef.current = now
      setThrottled(latestRef.current)
    } else if (timeoutRef.current == null) {
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        lastRunRef.current = Date.now()
        setThrottled(latestRef.current)
      }, intervalMs - elapsed)
    }
  }, [sourceTick, intervalMs])

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) clearTimeout(timeoutRef.current)
    }
  }, [])

  return throttled
}
