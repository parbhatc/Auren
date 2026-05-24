import { useCallback, useEffect, useRef, useState } from 'react'
import { ScalpFloat } from './ScalpFloat'
import { dockTradePanel, getPadFloatPosition } from '../../../../utils/tradePanelPopout'
import type { TradePanelProps } from '../pad/TradePanel'

const FLOAT_WIDTH = 346
const FLOAT_HEIGHT = 200

export function DetachedTradePanel({
  accountId,
  onDock,
  padProps,
  chartSymbol,
  maxQty,
  dockTitle = 'Dock to chart',
  dockMode = 'detach-pad',
}: {
  accountId: string
  isDark: boolean
  onDock: () => void
  padProps: TradePanelProps
  chartSymbol: string
  maxQty: number
  dockTitle?: string
  /** `mobile-float` only runs parent onDock (restores bottom quick trade). */
  dockMode?: 'detach-pad' | 'mobile-float'
}) {
  const [pos, setPos] = useState(() => getPadFloatPosition(FLOAT_WIDTH, FLOAT_HEIGHT))
  const dragRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null)

  useEffect(() => {
    const onResize = () => setPos(getPadFloatPosition(FLOAT_WIDTH, FLOAT_HEIGHT))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onDragStart = useCallback((clientX: number, clientY: number) => {
    dragRef.current = { x: pos.x, y: pos.y, startX: clientX, startY: clientY }
  }, [pos.x, pos.y])

  useEffect(() => {
    const onMove = (clientX: number, clientY: number) => {
      const d = dragRef.current
      if (!d) return
      setPos({
        x: Math.max(8, d.x + clientX - d.startX),
        y: Math.max(8, d.y + clientY - d.startY),
      })
    }
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY)
    const onMouseUp = () => {
      dragRef.current = null
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onMouseUp)
    }
  }, [])

  return (
    <div
      className="fixed z-[60] pointer-events-none"
      style={{ left: pos.x, top: pos.y, width: FLOAT_WIDTH }}
    >
      <ScalpFloat
        chartSymbol={chartSymbol}
        props={padProps}
        maxQty={maxQty}
        onDragStart={onDragStart}
        dockTitle={dockTitle}
        onDock={() => {
          if (dockMode === 'detach-pad') dockTradePanel(accountId)
          onDock()
        }}
      />
    </div>
  )
}
