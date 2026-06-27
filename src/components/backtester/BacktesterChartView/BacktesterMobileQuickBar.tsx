import { useEffect, useState } from 'react'
import { MobileScalpBar } from '../../trading/shared/mobile/MobileScalpBar'
import type { TradePanelProps } from '../../../types/tradePanel'
import {
  getMobileTradePrefs,
  PRACTICE_MOBILE_TRADE_PREFS_EVENT,
} from '../../../utils/mobileTradePrefs'

type BacktesterMobileQuickBarProps = {
  accountId: string
  padProps: TradePanelProps
  maxQty: number
  isDark: boolean
  showMobileNav: boolean
}

/** Practice-style mobile quick trade for backtester (replay lives on chart toolbar). */
export default function BacktesterMobileQuickBar({
  accountId,
  padProps,
  maxQty,
  isDark,
  showMobileNav,
}: BacktesterMobileQuickBarProps) {
  const [prefs, setPrefs] = useState(() => getMobileTradePrefs(accountId))

  useEffect(() => {
    setPrefs(getMobileTradePrefs(accountId))
  }, [accountId])

  useEffect(() => {
    const onChange = () => setPrefs(getMobileTradePrefs(accountId))
    window.addEventListener(PRACTICE_MOBILE_TRADE_PREFS_EVENT, onChange)
    return () => window.removeEventListener(PRACTICE_MOBILE_TRADE_PREFS_EVENT, onChange)
  }, [accountId])

  if (prefs.floatingPad) return null

  return (
    <MobileScalpBar
      accountId={accountId}
      props={padProps}
      maxQty={maxQty}
      isDark={isDark}
      showMobileNav={showMobileNav}
    />
  )
}
