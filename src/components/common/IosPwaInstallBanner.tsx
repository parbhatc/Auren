import { useEffect, useState } from 'react'
import { Share, X } from 'lucide-react'
import {
  IOS_PWA_BANNER_DISMISS_KEY,
  isIosSafariBrowser,
} from '../../utils/pwa'

/** Prompts iOS Safari users to Add to Home Screen for full-screen PWA (no URL bar). */
export function IosPwaInstallBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isIosSafariBrowser()) return
    if (localStorage.getItem(IOS_PWA_BANNER_DISMISS_KEY) === '1') return
    setVisible(true)
  }, [])

  if (!visible) return null

  const dismiss = () => {
    localStorage.setItem(IOS_PWA_BANNER_DISMISS_KEY, '1')
    setVisible(false)
  }

  return (
    <div
      className="fixed inset-x-0 top-0 z-[200] border-b border-indigo-500/30 bg-slate-950/95 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md lg:hidden"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-lg items-start gap-2">
        <Share className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" aria-hidden />
        <p className="min-w-0 flex-1 text-xs leading-snug text-slate-200">
          For full-screen (no Safari bars): tap{' '}
          <span className="font-semibold text-white">Share</span>, then{' '}
          <span className="font-semibold text-white">Add to Home Screen</span>, and open Auren from
          your home screen.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          aria-label="Dismiss install hint"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
