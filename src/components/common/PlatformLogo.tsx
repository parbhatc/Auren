type PlatformBrand = 'tradesea' | 'tradingview'

const BRAND_ASSETS = {
  tradesea: { name: 'Tradesea', path: '/brands/tradesea.svg', width: 373, height: 82 },
  tradingview: { name: 'TradingView', path: '/brands/tradingview-black.svg', width: 755, height: 129 },
} as const

/** Display original local brand artwork on a neutral plate with sufficient contrast. */
export default function PlatformLogo({
  brand,
  isDark,
  className = '',
}: {
  brand: PlatformBrand
  isDark: boolean
  className?: string
}) {
  const asset = BRAND_ASSETS[brand]
  const source = brand === 'tradingview' && isDark ? '/brands/tradingview-white.svg' : asset.path

  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-lg px-3 py-2 ${
      brand === 'tradingview'
        ? isDark ? 'bg-zinc-900' : 'bg-white'
        : 'bg-[#101014]'
    } ${className}`}>
      <img
        src={source}
        alt={`${asset.name} logo`}
        width={asset.width}
        height={asset.height}
        className="h-full w-full object-contain"
        draggable={false}
      />
    </span>
  )
}
