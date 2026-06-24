import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { MOBILE_NAV_CLEARANCE_CSS } from '../../../../constants/mobileTrade'

/** Full-screen mobile overlay above chart chrome; leaves bottom tab bar tappable. */
export function MobileTradeOverlayShell({
  open,
  onClose,
  ariaLabel,
  children,
}: {
  open: boolean
  onClose: () => void
  ariaLabel: string
  children: ReactNode
}) {
  if (!open) return null

  return createPortal(
    <div
      className="lg:hidden fixed inset-x-0 top-0 z-[130] flex flex-col justify-end pointer-events-none"
      style={{ bottom: MOBILE_NAV_CLEARANCE_CSS }}
      role="dialog"
      aria-modal
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 pointer-events-auto touch-manipulation"
        aria-label="Close panel"
        onPointerDown={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div className="relative pointer-events-auto">{children}</div>
    </div>,
    document.body
  )
}
