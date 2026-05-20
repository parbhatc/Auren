/**
 * Trading Layout Types
 */
export type LayoutType = 'chart-left' | 'chart-right' | 'chart-top' | 'chart-bottom' | 'chart-full'

export interface TradingLayout {
  type: LayoutType
  chartSize: number // percentage (0-100) - width for horizontal, height for vertical
  panelSize: number // percentage (0-100) - width for horizontal, height for vertical
  chartHeight?: number // percentage (0-100) - height of chart within chart area (for horizontal layouts only)
}

export type StorageLayoutType = 'trading' | 'backtester'

export interface InlineLayoutEditorProps {
  isDark: boolean
  currentLayout: TradingLayout
  layoutCategory: StorageLayoutType
  onLayoutChange: (layout: TradingLayout) => void
  onReset: () => void
  chartComponent?: React.ReactElement
  panelComponent?: React.ReactElement
}

export const DEFAULT_LAYOUT: TradingLayout = {
  type: 'chart-left',
  chartSize: 66,
  panelSize: 34,
}

/**
 * Layout configurations for different screen sizes
 */
export const LAYOUT_PRESETS: Record<LayoutType, { name: string; description: string; chartSize: number; panelSize: number }> = {
  'chart-left': {
    name: 'Chart Left',
    description: 'Chart on left, trading panel on right',
    chartSize: 66,
    panelSize: 34,
  },
  'chart-right': {
    name: 'Chart Right',
    description: 'Chart on right, trading panel on left',
    chartSize: 66,
    panelSize: 34,
  },
  'chart-top': {
    name: 'Chart Top',
    description: 'Chart on top, trading panel below',
    chartSize: 70,
    panelSize: 30,
  },
  'chart-bottom': {
    name: 'Chart Bottom',
    description: 'Chart below, trading panel on top',
    chartSize: 70,
    panelSize: 30,
  },
  'chart-full': {
    name: 'Full Chart',
    description: 'Chart takes full width, panel separate',
    chartSize: 100,
    panelSize: 100,
  },
}

/**
 * Resizable Draggable Section Types
 */
export interface ResizableDraggableSectionProps {
  children: React.ReactNode
  title?: string
  isDark: boolean
  defaultWidth?: number
  defaultHeight?: number
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  onClose?: () => void
  className?: string
}

export interface LayoutDragDropEditorProps {
  isDark: boolean
  currentLayout: TradingLayout
  layoutCategory: StorageLayoutType
  onLayoutChange: (layout: TradingLayout) => void
  onReset: () => void
}

export interface InlineLayoutEditorPropsWithComponents extends InlineLayoutEditorProps {
  chartComponent?: React.ReactElement
  panelComponent?: React.ReactElement
}

export interface LayoutSettingsProps {
  isDark: boolean
  toggleTheme: () => void
  navigate: (path: string) => void
}

