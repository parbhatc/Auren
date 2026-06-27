export type BwcToolbarRegion = 'left' | 'right'

export type BwcToolbarSlotAnchor = 'symbol' | 'timeframe' | 'indicators' | 'replay' | 'end' | string

export type BwcToolbarSlotOptions = {
  region?: BwcToolbarRegion
  id: string
  className?: string
  after?: BwcToolbarSlotAnchor
  separator?: boolean
}

export type BwcToolbarSlot = {
  id: string
  region: BwcToolbarRegion
  element: HTMLElement
  remove: () => void
}

export type BwcToolbarApi = {
  createSlot: (opts: BwcToolbarSlotOptions) => BwcToolbarSlot
  getSlot: (id: string) => BwcToolbarSlot | null
  removeSlot: (id: string) => void
  destroy: () => void
}
