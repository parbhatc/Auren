import type { OrderSide } from './order'

export type LadderRowKind = 'ask' | 'bid' | 'last'

export type LadderRow = {
  kind: LadderRowKind
  price: number
  bidDepth: number
  askDepth: number
  tradeVolume: number
}

export type LadderRowProps = {
  price: number
  bidDepth: number
  askDepth: number
  tradeVolume: number
  isLtp: boolean
  isEntryRow: boolean
  buyDisabled: boolean
  sellDisabled: boolean
  bidZone: boolean
  askZone: boolean
  qty: number
  maxVol: number
  priceLabel: string
  showPnlColumn: boolean
  pnlText: string
  pnlCls: string
  onPlaceOrder: (side: OrderSide, price: number) => void
}
