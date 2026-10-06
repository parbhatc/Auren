export type TradeRiskSettings = {
  riskPerTrade: number
  riskBuffer: number
  sizingBasis: 'stop_loss' | 'take_profit'
  stopLossMode: 'hard' | 'soft'
  softStopTrigger: 'bar_close'
}

export const TRADE_RISK_SETTINGS_CHANGED = 'tradeRiskSettingsChanged'

const STORAGE_KEY = 'auren.tradeRiskSettings.v1'
const DEFAULT_SETTINGS: TradeRiskSettings = {
  riskPerTrade: 300,
  riskBuffer: 0,
  sizingBasis: 'stop_loss',
  stopLossMode: 'hard',
  softStopTrigger: 'bar_close',
}

export function getTradeRiskSettings(): TradeRiskSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<TradeRiskSettings>
    return {
      riskPerTrade:
        Number.isFinite(parsed.riskPerTrade) && Number(parsed.riskPerTrade) > 0
          ? Number(parsed.riskPerTrade)
          : DEFAULT_SETTINGS.riskPerTrade,
      riskBuffer:
        Number.isFinite(parsed.riskBuffer) && Number(parsed.riskBuffer) >= 0
          ? Number(parsed.riskBuffer)
          : DEFAULT_SETTINGS.riskBuffer,
      sizingBasis:
        parsed.sizingBasis === 'take_profit' ? 'take_profit' : 'stop_loss',
      stopLossMode: parsed.stopLossMode === 'soft' ? 'soft' : 'hard',
      softStopTrigger: 'bar_close',
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveTradeRiskSettings(settings: TradeRiskSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  window.dispatchEvent(new CustomEvent(TRADE_RISK_SETTINGS_CHANGED, { detail: settings }))
}
