import { useState } from 'react'
import Switch from '../../Practice/Switch'
import {
  getRestoreLastReplayCandle,
  setRestoreLastReplayCandle,
} from '../../../../utils/replayPreferences'

export default function ReplaySettingsPanel({ isDark }: { isDark: boolean }) {
  const [restoreLastCandle, setRestoreLastCandle] = useState(getRestoreLastReplayCandle)

  return (
    <div className="space-y-4 p-4">
      <div>
        <p className={`text-xs font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
          Replay session
        </p>
        <p className={`mt-1 text-[11px] leading-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Control what Auren restores when you reopen or refresh a replay chart.
        </p>
      </div>

      <div
        className={`rounded-xl border p-3 ${
          isDark ? 'border-slate-700 bg-slate-950/55' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <Switch
          checked={restoreLastCandle}
          onChange={(enabled) => {
            setRestoreLastCandle(enabled)
            setRestoreLastReplayCandle(enabled)
          }}
          isDark={isDark}
          label="Restore last candle after refresh"
        />
        <p className={`mt-2 text-[10px] leading-4 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
          Saves the most recently revealed candle separately for each replay session. When off,
          replay opens from the session start as before.
        </p>
      </div>
    </div>
  )
}
