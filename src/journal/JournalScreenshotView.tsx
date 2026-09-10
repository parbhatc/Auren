import { useId, useRef, useState } from 'react'
import type { JournalAnnotation, JournalScreenshot } from '../api/journal.api'

export default function JournalScreenshotView({
  image,
  onChange,
}: {
  image: JournalScreenshot
  onChange?: (image: JournalScreenshot) => void
}) {
  const id = useId().replace(/:/g, '')
  const [tool, setTool] = useState<'view' | 'arrow' | 'level'>('view')
  const start = useRef<{ x: number; y: number } | null>(null)
  const [preview, setPreview] = useState<JournalAnnotation | null>(null)
  const marks = image.annotations ?? []
  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    }
  }
  const change = (annotations: JournalAnnotation[]) => onChange?.({ ...image, annotations })
  return (
    <div>
      {onChange && (
        <div className="mb-2 flex flex-wrap gap-2 text-xs">
          {(['view', 'arrow', 'level'] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={tool === value}
              aria-label={`${value} annotation tool`}
              onClick={() => {
                start.current = null
                setPreview(null)
                setTool(value)
              }}
              className={`rounded border px-2 py-1 ${tool === value ? 'border-blue-500 text-blue-500' : 'border-zinc-500/30'}`}
            >
              {value}
            </button>
          ))}
          <button type="button" disabled={!marks.length} onClick={() => change(marks.slice(0, -1))}>
            Undo mark
          </button>
          <button type="button" disabled={!marks.length} onClick={() => change([])}>
            Clear marks
          </button>
          <span className="text-zinc-500">Drag on the image · {marks.length}/30 marks</span>
        </div>
      )}
      <div className="relative w-full overflow-hidden rounded-lg border border-zinc-500/20">
        <img
          src={image.dataUrl}
          alt={image.caption || 'Chart screenshot'}
          className="block h-auto w-full"
          draggable={false}
        />
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          role={onChange ? 'application' : 'img'}
          aria-label="Chart annotations"
          tabIndex={onChange && tool !== 'view' ? 0 : undefined}
          className={`absolute inset-0 h-full w-full ${onChange && tool !== 'view' ? 'touch-none cursor-crosshair' : 'pointer-events-none'}`}
          onKeyDown={(e) => {
            if (!onChange || tool === 'view' || marks.length >= 30) return
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key))
              return
            e.preventDefault()
            e.stopPropagation()
            const mark = preview ?? { kind: tool, x1: 0.25, y1: 0.5, x2: 0.75, y2: 0.5 }
            if (e.key === 'Enter') {
              change([...marks, mark])
              setPreview(null)
              return
            }
            const key =
              `${e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? 'x' : 'y'}${e.shiftKey ? '1' : '2'}` as
                | 'x1'
                | 'x2'
                | 'y1'
                | 'y2'
            const next = {
              ...mark,
              [key]: Math.max(
                0,
                Math.min(
                  1,
                  mark[key] + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -0.02 : 0.02)
                )
              ),
            }
            if (tool === 'level') next.y2 = next.y1
            setPreview(next)
          }}
          onPointerDown={(e) => {
            if (tool === 'view' || !onChange || marks.length >= 30) return
            e.preventDefault()
            start.current = point(e)
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (!start.current || tool === 'view') return
            const p = point(e)
            setPreview({
              kind: tool,
              x1: start.current.x,
              y1: start.current.y,
              x2: p.x,
              y2: tool === 'level' ? start.current.y : p.y,
            })
          }}
          onPointerUp={(e) => {
            if (!start.current || tool === 'view') return
            const p = point(e)
            const a = start.current
            if (Math.abs(a.x - p.x) + Math.abs(a.y - p.y) > 0.005)
              change([
                ...marks,
                { kind: tool, x1: a.x, y1: a.y, x2: p.x, y2: tool === 'level' ? a.y : p.y },
              ])
            start.current = null
            setPreview(null)
          }}
          onPointerCancel={() => {
            start.current = null
            setPreview(null)
          }}
        >
          <defs>
            <marker
              id={id}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
            </marker>
          </defs>
          {[...marks, ...(preview ? [preview] : [])].map((m, i) => (
            <line
              key={i}
              x1={m.x1 * 1000}
              y1={m.y1 * 1000}
              x2={m.x2 * 1000}
              y2={m.y2 * 1000}
              stroke="#f59e0b"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              markerEnd={m.kind === 'arrow' ? `url(#${id})` : undefined}
            />
          ))}
        </svg>
      </div>
      {onChange && tool !== 'view' && (
        <p className="mt-1 text-xs text-zinc-500">
          Keyboard: focus the image, arrows move the endpoint, Shift+arrows move the start, Enter
          adds the mark.
        </p>
      )}
      {image.capturedAt && (
        <p className="mt-1 text-xs text-zinc-500">
          Captured {new Date(image.capturedAt).toLocaleString()} ·{' '}
          {image.chartResolution || 'chart'} · Cursor {image.cursorTime || 'live'}
        </p>
      )}
    </div>
  )
}
