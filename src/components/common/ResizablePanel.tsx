import { Component, createRef } from 'react'
import { ResizablePanelProps, ResizablePanelState } from '../../types/common'

/**
 * Resizable Panel Component
 * Allows users to resize two panels by dragging a separator
 */
class ResizablePanel extends Component<ResizablePanelProps, ResizablePanelState> {
  private containerRef = createRef<HTMLDivElement>()
  private separatorRef = createRef<HTMLDivElement>()

  constructor(props: ResizablePanelProps) {
    super(props)
    this.state = {
      size: props.initialSize || 66,
      isResizing: false,
    }
  }

  componentDidMount() {
    document.addEventListener('mousemove', this.handleMouseMove)
    document.addEventListener('mouseup', this.handleMouseUp)
  }

  componentWillUnmount() {
    document.removeEventListener('mousemove', this.handleMouseMove)
    document.removeEventListener('mouseup', this.handleMouseUp)
  }

  handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    this.setState({ isResizing: true })
  }

  handleMouseMove = (e: MouseEvent) => {
    if (!this.state.isResizing || !this.containerRef.current) return

    const container = this.containerRef.current
    const rect = container.getBoundingClientRect()
    const { direction, minSize = 20, maxSize = 80 } = this.props

    let newSize: number
    if (direction === 'horizontal') {
      const x = e.clientX - rect.left
      newSize = (x / rect.width) * 100
    } else {
      const y = e.clientY - rect.top
      newSize = (y / rect.height) * 100
    }

    // Clamp between min and max
    newSize = Math.max(minSize, Math.min(maxSize, newSize))

    this.setState({ size: newSize })
    if (this.props.onResize) {
      this.props.onResize(newSize)
    }
  }

  handleMouseUp = () => {
    if (this.state.isResizing) {
      this.setState({ isResizing: false })
    }
  }

  render() {
    const { children, direction, isDark, className = '' } = this.props
    const { size, isResizing } = this.state

    const isHorizontal = direction === 'horizontal'

    return (
      <div
        ref={this.containerRef}
        className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} ${className}`}
        style={{ position: 'relative' }}
      >
        {/* First Panel */}
        <div
          style={{
            [isHorizontal ? 'width' : 'height']: `${size}%`,
            flexShrink: 0,
          }}
          className="overflow-hidden"
        >
          {children[0]}
        </div>

        {/* Resizer */}
        <div
          ref={this.separatorRef}
          onMouseDown={this.handleMouseDown}
          className={`
            ${isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
            ${isResizing ? 'bg-blue-500' : isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-300 hover:bg-slate-400'}
            transition-colors
            flex items-center justify-center
            group
          `}
          style={{
            [isHorizontal ? 'minWidth' : 'minHeight']: '4px',
            userSelect: 'none',
          }}
        >
          <div
            className={`
              ${isHorizontal ? 'w-0.5 h-8' : 'h-0.5 w-8'}
              ${isDark ? 'bg-slate-500' : 'bg-slate-400'}
              rounded-full
              opacity-0 group-hover:opacity-100 transition-opacity
            `}
          />
        </div>

        {/* Second Panel */}
        <div
          style={{
            [isHorizontal ? 'width' : 'height']: `${100 - size}%`,
            flex: 1,
          }}
          className="overflow-hidden"
        >
          {children[1]}
        </div>
      </div>
    )
  }
}

export default ResizablePanel

