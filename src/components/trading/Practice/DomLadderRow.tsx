import { memo } from 'react'
import type { OrderSide } from './PracticeTradePanel'

export type DomLadderRowProps = {
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

function DomLadderRow({
  price,
  bidDepth,
  askDepth,
  tradeVolume,
  isLtp,
  isEntryRow,
  buyDisabled,
  sellDisabled,
  bidZone,
  askZone,
  qty,
  maxVol,
  priceLabel,
  showPnlColumn,
  pnlText,
  pnlCls,
  onPlaceOrder,
}: DomLadderRowProps) {
  const showBid = bidDepth > 0
  const showAsk = askDepth > 0
  const vol = tradeVolume
  const volScale = vol > 0 ? vol / maxVol : 0
  const rowBg = isEntryRow ? 'bg-dom-entry' : isLtp ? 'ltp-row' : ''
  const gridCols = showPnlColumn ? 'grid-cols-8' : 'grid-cols-7'

  return (
    <div className="group/dom-row" style={{ minHeight: 22 }}>
      <div className={`grid ${gridCols} text-xs tabular-nums ${rowBg}`}>
        <div
          className={`flex items-center justify-center py-0.5 ${buyDisabled ? 'pointer-events-none' : ''}`}
        >
          <button
            type="button"
            aria-label="Dom buy order"
            title={`Dom buy order at ${priceLabel} quantity ${qty}`}
            disabled={buyDisabled}
            onClick={() => onPlaceOrder('buy', price)}
            className="flex h-4 min-w-[1.75rem] max-w-[2.25rem] items-center justify-center rounded-sm bg-[#238636] px-0.5 text-[9px] font-bold text-white opacity-0 group-hover/dom-row:opacity-100 disabled:!opacity-0"
          >
            {qty}
          </button>
        </div>
        <span
          className={`border-l py-0.5 text-center ${
            bidZone ? 'border-dom-buy' : 'border-[#475569]/50'
          } ${showBid ? 'bg-[#238636]/12 font-medium text-[#3fb950]' : 'text-[#7d8590]'}`}
        >
          {showBid ? bidDepth : ''}
        </span>
        <span
          className={`col-span-2 border-l py-0.5 text-center dom-ltp-price-cell ${
            bidZone ? 'border-dom-buy' : 'border-[#475569]/50'
          } ${isLtp ? 'bg-ltp' : ''}`}
        >
          <span
            className={`inline-flex items-center justify-center ${
              isLtp ? 'text-sm font-bold tabular-nums text-text-ltp' : 'text-dom-price'
            }`}
          >
            {isLtp ? <span className="dom-ltp-badge">LTP</span> : null}
            {priceLabel}
          </span>
        </span>
        <span
          className={`border-l py-0.5 text-center ${
            askZone ? 'border-x border-x-[#475569]/50 border-r-dom-sell' : 'border-[#475569]/50'
          } ${showAsk ? 'bg-[#da3633]/12 font-medium text-[#f85149]' : 'text-[#7d8590]'}`}
        >
          {showAsk ? askDepth : ''}
        </span>
        <div
          className={`flex items-center justify-center border-l py-0.5 ${
            askZone ? 'border-dom-sell' : 'border-[#475569]/50'
          } ${sellDisabled ? 'pointer-events-none' : ''}`}
        >
          <button
            type="button"
            aria-label="Dom sell order"
            title={`Dom sell order at ${priceLabel} quantity ${qty}`}
            disabled={sellDisabled}
            onClick={() => onPlaceOrder('sell', price)}
            className="flex h-4 min-w-[1.75rem] max-w-[2.25rem] items-center justify-center rounded-sm bg-[#da3633] px-0.5 text-[9px] font-bold text-white opacity-0 group-hover/dom-row:opacity-100 disabled:!opacity-0"
          >
            {qty}
          </button>
        </div>
        {showPnlColumn ? (
          <span
            className={`border-l py-0.5 text-center ${pnlCls} ${pnlText ? '' : 'text-[#7d8590]'}`}
          >
            {pnlText}
          </span>
        ) : null}
        <div className="relative col-span-1 flex items-center justify-end border-l border-[#475569]/50 py-0.5 pr-1">
          <div
            className="pointer-events-none absolute inset-y-0 right-0 origin-right bg-volume"
            style={{ transform: `scaleX(${volScale})`, width: '100%' }}
          />
          <span className="relative z-10 text-[10px] tabular-nums text-[#adbac7]">{vol > 0 ? vol : ''}</span>
        </div>
      </div>
      <div className={`pointer-events-none grid h-px ${gridCols}`} aria-hidden>
        <div />
        <div className={`border-l ${bidZone ? 'border-dom-buy' : 'border-[#475569]/35'}`} />
        <div className={`col-span-2 border-l ${bidZone ? 'border-dom-buy' : 'border-[#475569]/35'}`} />
        <div className={`border-l ${askZone ? 'border-r-dom-sell' : 'border-[#475569]/35'}`} />
        <div className={`border-l ${askZone ? 'border-dom-sell' : 'border-[#475569]/35'}`} />
        {showPnlColumn ? <div className="border-l border-[#475569]/35" /> : null}
        <div className="col-span-1 border-l border-[#475569]/35" />
      </div>
    </div>
  )
}

function rowPropsEqual(a: DomLadderRowProps, b: DomLadderRowProps): boolean {
  return (
    a.price === b.price &&
    a.bidDepth === b.bidDepth &&
    a.askDepth === b.askDepth &&
    a.tradeVolume === b.tradeVolume &&
    a.isLtp === b.isLtp &&
    a.isEntryRow === b.isEntryRow &&
    a.buyDisabled === b.buyDisabled &&
    a.sellDisabled === b.sellDisabled &&
    a.bidZone === b.bidZone &&
    a.askZone === b.askZone &&
    a.qty === b.qty &&
    a.maxVol === b.maxVol &&
    a.priceLabel === b.priceLabel &&
    a.showPnlColumn === b.showPnlColumn &&
    a.pnlText === b.pnlText &&
    a.pnlCls === b.pnlCls
  )
}

export default memo(DomLadderRow, rowPropsEqual)
