import { useState, useCallback, useRef, useEffect } from 'react'
import { GripVertical, Maximize2, X } from 'lucide-react'
import { ResizableDraggableSectionProps } from '../../../types/tradingLayout'

/**
 * Simple, user-friendly resizable and draggable section component
 * - Click and drag the header to move
 * - Drag the bottom-right corner to resize
 * - Simple, intuitive controls
 */
export const ResizableDraggableSection = ({
  children,
  title,
  isDark,
  defaultWidth = 400,
  defaultHeight = 300,
  minWidth = 250,
  minHeight = 200,
  maxWidth,
  maxHeight,
  onClose,
  className = '',
  defaultPosition,
}: ResizableDraggableSectionProps & { defaultPosition?: { x: number; y: number } }) => {
  const [position, setPosition] = useState(defaultPosition ?? { x: 0, y: 0 })
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; size: { width: number; height: number } } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle drag start - click and drag header
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    setIsDragging(true)
    setDragStart({ x: clientX - position.x, y: clientY - position.y })
  }, [position])

  // Handle resize start - drag bottom-right corner
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    setIsResizing(true)
    setResizeStart({ x: clientX, y: clientY, size: { ...size } })
  }, [size])

  // Handle mouse/touch move
  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (isDragging && dragStart) {
        const newX = Math.max(0, clientX - dragStart.x)
        const newY = Math.max(0, clientY - dragStart.y)
        setPosition({ x: newX, y: newY })
      } else if (isResizing && resizeStart) {
        const deltaX = clientX - resizeStart.x
        const deltaY = clientY - resizeStart.y
        const newWidth = Math.max(
          minWidth,
          Math.min(maxWidth || Infinity, resizeStart.size.width + deltaX)
        )
        const newHeight = Math.max(
          minHeight,
          Math.min(maxHeight || Infinity, resizeStart.size.height + deltaY)
        )
        setSize({ width: newWidth, height: newHeight })
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return
      e.preventDefault()
      handleMove(e.touches[0].clientX, e.touches[0].clientY)
    }

    const handleEnd = () => {
      setIsDragging(false)
      setIsResizing(false)
      setDragStart(null)
      setResizeStart(null)
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleEnd)
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleEnd)
      document.addEventListener('touchcancel', handleEnd)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleEnd)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleEnd)
        document.removeEventListener('touchcancel', handleEnd)
      }
    }
  }, [isDragging, isResizing, dragStart, resizeStart, minWidth, minHeight, maxWidth, maxHeight])

  return (
    <div
      ref={containerRef}
      className={`absolute ${className}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: isDragging || isResizing ? 1000 : 10,
      }}
    >
      <div
        className={`relative h-full w-full rounded-lg border shadow-lg transition-all ${
          isDark
            ? 'bg-slate-800/95 border-slate-600 backdrop-blur-sm'
            : 'bg-white/95 border-slate-300 backdrop-blur-sm'
        } ${isDragging ? 'shadow-2xl ring-2 ring-blue-500/30' : ''} ${isResizing ? 'ring-2 ring-blue-500/30' : ''}`}
      >
        {/* Header - Click and drag to move */}
        {title && (
          <div
            className={`flex items-center justify-between px-3 py-2 border-b cursor-move select-none ${
              isDark ? 'border-slate-700 bg-slate-750/50' : 'border-slate-200 bg-slate-50/50'
            } ${isDragging ? 'bg-blue-500/10' : 'hover:bg-slate-700/30'}`}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            title="Click and drag to move"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <GripVertical className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              <span className={`text-sm font-semibold truncate ${
                isDark ? 'text-slate-200' : 'text-slate-800'
              }`}>
                {title}
              </span>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className={`p-1 rounded transition-all ${
                  isDark
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                }`}
                title="Close"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="overflow-auto" style={{ height: title ? 'calc(100% - 40px)' : '100%' }}>
          {children}
        </div>

        {/* Resize handle - Bottom-right corner - Simple and clear */}
        <div
          className={`absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center rounded-tl-lg transition-all ${
            isDark
              ? 'bg-slate-700/80 hover:bg-slate-600 text-slate-300 border border-slate-600'
              : 'bg-slate-200/80 hover:bg-slate-300 text-slate-600 border border-slate-300'
          } ${isResizing ? 'opacity-100 scale-110' : 'opacity-70 hover:opacity-100'}`}
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          title="Drag to resize"
        >
          <Maximize2 className="w-3 h-3 rotate-45" />
        </div>
      </div>
    </div>
  )
}

export default ResizableDraggableSection
