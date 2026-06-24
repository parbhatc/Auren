import {
  getPracticeMarketDataSettings,
  normalizePracticePropFirmId,
} from '../constants/practice'
import { getDefaultPropFirmId } from '../propfirms/MarketDataConnection'

const LIVE_TRADE_PROP_FIRM_KEY = 'liveTradePropFirmId'

export function getLiveTradePropFirmId(): string {
  const stored = localStorage.getItem(LIVE_TRADE_PROP_FIRM_KEY)
  if (stored) {
    return normalizePracticePropFirmId(stored)
  }
  const md = getPracticeMarketDataSettings()
  return normalizePracticePropFirmId(md.propFirmId || getDefaultPropFirmId())
}

export function saveLiveTradePropFirmId(firmId: string): void {
  const normalized = normalizePracticePropFirmId(firmId)
  localStorage.setItem(LIVE_TRADE_PROP_FIRM_KEY, normalized)
  localStorage.setItem('activePropFirm', normalized)
  window.dispatchEvent(new Event('liveTradePropFirmChanged'))
}
