import { useContext, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { LiveTradeViewActive } from '../../../contexts/LiveTradeViewContext'

export default function TradeAccountMenu({
  anchorRef,
  onClose,
  className,
  children,
}: {
  anchorRef: RefObject<HTMLDivElement>
  onClose: () => void
  className: string
  children: ReactNode
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const viewActive = useContext(LiveTradeViewActive)

  useLayoutEffect(() => {
    if (viewActive === false) {
      onClose()
      return
    }
    const anchor = anchorRef.current
    const menu = menuRef.current
    if (!anchor || !menu) return

    const position = () => {
      const rect = anchor.getBoundingClientRect()
      const maxLeft = document.documentElement.clientWidth - menu.offsetWidth - 8
      menu.style.top = `${rect.bottom + 4}px`
      menu.style.left = `${Math.max(8, Math.min(rect.left, maxLeft))}px`
    }
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!anchor.contains(target) && !menu.contains(target)) onClose()
    }

    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    document.addEventListener('pointerdown', dismissOutside, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      document.removeEventListener('pointerdown', dismissOutside, true)
    }
  }, [anchorRef, onClose, viewActive])

  if (viewActive === false) return null

  // BWC mounts its floating drawing tools under body, outside the mobile terminal.
  return createPortal(
    <div ref={menuRef} role="listbox" className={`fixed z-[200] overflow-hidden rounded-lg border shadow-xl ${className}`}>
      {children}
    </div>,
    document.body,
  )
}
