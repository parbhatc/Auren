import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import InSessionJournalCapture from '../../src/journal/InSessionJournalCapture'
import { captureOpenPosition } from '../../src/journal/journalCapture'
import '../../src/index.css'

function Preview() {
  const chart = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = chart.current!.getContext('2d')!
    ctx.fillStyle = '#18181b'
    ctx.fillRect(0, 0, 800, 320)
    ctx.fillStyle = '#e4e4e7'
    ctx.font = '18px sans-serif'
    ctx.fillText('Synthetic NQ chart · 1m', 24, 32)
    for (let i = 0; i < 24; i++) {
      const y = 150 + Math.sin(i / 3) * 60
      ctx.fillStyle = i % 3 ? '#10b981' : '#ef4444'
      ctx.fillRect(30 + i * 30, y, 12, 40)
      ctx.fillRect(35 + i * 30, y - 15, 2, 70)
    }
  }, [])
  const [mode, setMode] = useState<'practice' | 'live' | 'replay'>('practice')
  const [ticks, setTicks] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTicks((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  return (
    <main className="min-h-screen bg-zinc-950 p-5 text-white">
      <h1>Isolated in-session journal fixture</h1>
      <p>No broker or real account is connected. Synthetic open short: 2 NQ at 20000.</p>
      <p role="status" aria-label="Simulated stream">
        Simulated stream ticks: {ticks}
      </p>
      <label>
        Session{' '}
        <select
          className="m-3 bg-zinc-800"
          aria-label="Fixture session"
          value={mode}
          onChange={(event) => setMode(event.target.value as typeof mode)}
        >
          <option>practice</option>
          <option>live</option>
          <option>replay</option>
        </select>
      </label>
      <div data-journal-chart className="my-4 max-w-4xl">
        <canvas ref={chart} width={800} height={320} className="w-full" />
      </div>
      <InSessionJournalCapture
        key={mode}
        isDark
        getSnapshot={() => ({
          ...captureOpenPosition({
            source: mode === 'live' ? 'live' : 'practice',
            symbol: 'NQ',
            accountId: `qa-${mode}`,
            accountName: `Synthetic ${mode} session`,
            resolution: '1',
            now: new Date('2026-09-10T14:00:00Z'),
            position: {
              symbol: 'NQ',
              contracts: -2,
              entry: 20000,
              entryTime: 1789047900,
              positionId: `qa-${mode}-open`,
              stopLoss: 20010,
              takeProfit: 19980,
            },
          }),
          source: mode,
        })}
      />
    </main>
  )
}
createRoot(document.getElementById('root')!).render(<Preview />)
