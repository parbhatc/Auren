import { memo } from 'react'
import { TradeSideButton } from '../../../common/TradeSideButton'
import { tradeSideMeta } from '../../../../constants/tradingSide'
import type { LadderRowProps } from '../../../../types/dom'

export type { LadderRowProps } from '../../../../types/dom'

function LadderRow({
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
}: LadderRowProps) {
  const showBid = bidDepth > 0
  const showAsk = askDepth > 0
  const vol = tradeVolume
  const volScale = vol > 0 ? vol / maxVol : 0
  const rowBg = isEntryRow ? 'bg-dom-entry' : isLtp ? 'ltp-row' : ''
  const gridCols = showPnlColumn ? 'grid-cols-8' : 'grid-cols-7'
  const buyMeta = tradeSideMeta('buy')
  const sellMeta = tradeSideMeta('sell')

  return (
    <div className="group/dom-row" style={{ minHeight: 22 }}>
      <div className={`grid ${gridCols} text-xs tabular-nums ${rowBg}`}>
        <div
          className={`flex items-center justify-center py-0.5 ${buyDisabled ? 'pointer-events-none' : ''}`}
        >
          <TradeSideButton
            side="buy"
            variant="compact"
            disabled={buyDisabled}
            title={`Dom buy order at ${priceLabel} quantity ${qty}`}
            onClick={() => onPlaceOrder('buy', price)}
          >
            {qty}
          </TradeSideButton>
        </div>
        <span
          className={`border-l py-0.5 text-center ${
            bidZone ? buyMeta.borderClass : 'border-[#475569]/50'
          } ${showBid ? `${buyMeta.depthBgClass} font-medium ${buyMeta.depthTextClass}` : 'text-[#7d8590]'}`}
        >
          {showBid ? bidDepth : ''}
        </span>
        <span
          className={`col-span-2 border-l py-0.5 text-center dom-ltp-price-cell ${
            bidZone ? buyMeta.borderClass : 'border-[#475569]/50'
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
            askZone ? `border-x border-x-[#475569]/50 ${sellMeta.borderClass}` : 'border-[#475569]/50'
          } ${showAsk ? `${sellMeta.depthBgClass} font-medium ${sellMeta.depthTextClass}` : 'text-[#7d8590]'}`}
        >
          {showAsk ? askDepth : ''}
        </span>
        <div
          className={`flex items-center justify-center border-l py-0.5 ${
            askZone ? sellMeta.borderClass : 'border-[#475569]/50'
          } ${sellDisabled ? 'pointer-events-none' : ''}`}
        >
          <TradeSideButton
            side="sell"
            variant="compact"
            disabled={sellDisabled}
            title={`Dom sell order at ${priceLabel} quantity ${qty}`}
            onClick={() => onPlaceOrder('sell', price)}
          >
            {qty}
          </TradeSideButton>
        </div>
        {showPnlColumn ? (
          <span
            className={`border-l py-0.5 text-center ${pnlCls} ${pnlText ? '' : 'text-trade-muted'}`}
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
        <div className={`border-l ${bidZone ? buyMeta.borderClass : 'border-[#475569]/35'}`} />
        <div className={`col-span-2 border-l ${bidZone ? buyMeta.borderClass : 'border-[#475569]/35'}`} />
        <div className={`border-l ${askZone ? 'border-r-dom-sell' : 'border-[#475569]/35'}`} />
        <div className={`border-l ${askZone ? sellMeta.borderClass : 'border-[#475569]/35'}`} />
        {showPnlColumn ? <div className="border-l border-[#475569]/35" /> : null}
        <div className="col-span-1 border-l border-[#475569]/35" />
      </div>
    </div>
  )
}

function rowPropsEqual(a: LadderRowProps, b: LadderRowProps): boolean {
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

export default memo(LadderRow, rowPropsEqual)
