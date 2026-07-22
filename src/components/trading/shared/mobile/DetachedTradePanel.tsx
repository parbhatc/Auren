import { useCallback, useEffect, useRef, useState } from 'react'
import { ScalpFloat } from './ScalpFloat'
import {
  clampPadFloatPosition,
  dockTradePanel,
  getSavedPadFloatPosition,
  savePadFloatPosition,
} from '../../../../utils/tradePanelPopout'
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
  const [pos, setPos] = useState(() => getSavedPadFloatPosition(accountId, FLOAT_WIDTH, FLOAT_HEIGHT))
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const measurePanel = useCallback(() => {
    const el = panelRef.current
    return {
      width: el?.offsetWidth ?? FLOAT_WIDTH,
      height: el?.offsetHeight ?? FLOAT_HEIGHT,
    }
  }, [])

  const clampPosition = useCallback(
    (x: number, y: number) => {
      const { width, height } = measurePanel()
      return clampPadFloatPosition(x, y, width, height)
    },
    [measurePanel]
  )

  useEffect(() => {
    const onResize = () => setPos((p) => {
      const next = clampPosition(p.x, p.y)
      savePadFloatPosition(accountId, next)
      return next
    })
    onResize()
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('scroll', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('scroll', onResize)
    }
  }, [accountId, clampPosition])

  const onDragStart = useCallback((clientX: number, clientY: number) => {
    dragRef.current = { x: pos.x, y: pos.y, startX: clientX, startY: clientY }
    setDragging(true)
  }, [pos.x, pos.y])

  const onNudge = useCallback((deltaX: number, deltaY: number) => {
    setPos((current) => {
      const next = clampPosition(current.x + deltaX, current.y + deltaY)
      savePadFloatPosition(accountId, next)
      return next
    })
  }, [accountId, clampPosition])

  useEffect(() => {
    const onMove = (clientX: number, clientY: number) => {
      const d = dragRef.current
      if (!d) return
      setPos(clampPosition(d.x + clientX - d.startX, d.y + clientY - d.startY))
    }
    const onPointerMove = (e: PointerEvent) => onMove(e.clientX, e.clientY)
    const onPointerUp = () => {
      if (dragRef.current) {
        setPos((p) => {
          const next = clampPosition(p.x, p.y)
          savePadFloatPosition(accountId, next)
          return next
        })
      }
      dragRef.current = null
      setDragging(false)
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [accountId, clampPosition])

  return (
    <div
      ref={panelRef}
      className={`fixed z-[120] pointer-events-none ${dragging ? 'cursor-grabbing' : ''}`}
      style={{ left: pos.x, top: pos.y, width: `min(${FLOAT_WIDTH}px, calc(100vw - 16px))` }}
    >
      <ScalpFloat
        chartSymbol={chartSymbol}
        props={padProps}
        maxQty={maxQty}
        onDragStart={onDragStart}
        onNudge={onNudge}
        dragging={dragging}
        dockTitle={dockTitle}
        onDock={() => {
          if (dockMode === 'detach-pad') dockTradePanel(accountId)
          onDock()
        }}
      />
    </div>
  )
}
