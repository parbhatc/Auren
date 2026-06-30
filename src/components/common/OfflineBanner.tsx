import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { subscribeOnlineStatus } from '../../utils/pwa'

/** Shown when the device loses network; cached shell still works offline. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine,
  )

  useEffect(() => subscribeOnlineStatus((online) => setOffline(!online)), [])

  if (!offline) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[200] border-t border-amber-500/30 bg-slate-950/95 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-lg items-center justify-center gap-2 text-xs text-amber-100">
        <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Offline — showing cached app. Live data and trades need a connection.</span>
      </div>
    </div>
  )
}
