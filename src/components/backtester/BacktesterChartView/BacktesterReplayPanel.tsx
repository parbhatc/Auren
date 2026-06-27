import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import { ghostButtonClass, primaryButtonClass } from '../../../styles/aurenTheme'
import { practiceTradePanelClass } from '../../trading/Practice/practiceTradeTheme'

export type BacktesterReplayPanelProps = {
  isDark: boolean
  isPlaying: boolean
  playbackSpeed: number
  showPreviousBarSelector: boolean
  onReplay: () => void
  onPlayPause: () => void
  onNextCandle: () => void
  onSpeedChange: (speed: number) => void
}

export default function BacktesterReplayPanel({
  isDark,
  isPlaying,
  playbackSpeed,
  showPreviousBarSelector,
  onReplay,
  onPlayPause,
  onNextCandle,
  onSpeedChange,
}: BacktesterReplayPanelProps) {
  const heading = isDark ? 'text-white' : 'text-slate-900'
  const label = isDark ? 'text-slate-300' : 'text-slate-700'
  const sectionBorder = isDark ? 'border-slate-700' : 'border-slate-200'

  return (
    <section
      className={`flex flex-col min-h-0 flex-1 overflow-hidden ${practiceTradePanelClass(isDark)}`}
      aria-label="Replay controls"
    >
      <div className={`px-3 py-2 border-b ${sectionBorder} shrink-0`}>
        <h3 className={`text-sm font-bold ${heading}`}>Replay</h3>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReplay}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs ${
              showPreviousBarSelector ? primaryButtonClass() : ghostButtonClass(isDark)
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            Replay
          </button>
          <button
            type="button"
            onClick={onPlayPause}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs ${
              isPlaying ? primaryButtonClass() : ghostButtonClass(isDark)
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={onNextCandle}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs ${ghostButtonClass(isDark)}`}
          >
            <SkipForward className="w-4 h-4" />
            Next
          </button>
        </div>

        <div>
          <label className={`block text-xs font-medium mb-1.5 ${label}`}>Playback Speed</label>
          <div className="grid grid-cols-4 gap-1">
            {[1, 2, 4, 8].map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => onSpeedChange(speed)}
                className={`px-2 py-1.5 rounded text-xs font-medium ${
                  playbackSpeed === speed ? primaryButtonClass() : ghostButtonClass(isDark)
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
