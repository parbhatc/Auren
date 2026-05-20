/** Trade page account selection (separate from Settings → Practice) */
export const TRADE_STORAGE_KEYS = {
  TRADESEA_ACCOUNT_ID: 'tradeTradeseaAccountId',
  TRADESEA_ACCOUNT_LABEL: 'tradeTradeseaAccountLabel',
} as const

export function getTradeTradeseaAccount(): {
  accountId: string
  accountLabel: string
} {
  return {
    accountId: localStorage.getItem(TRADE_STORAGE_KEYS.TRADESEA_ACCOUNT_ID) || '',
    accountLabel: localStorage.getItem(TRADE_STORAGE_KEYS.TRADESEA_ACCOUNT_LABEL) || '',
  }
}

export function saveTradeTradeseaAccount(accountId: string, accountLabel: string): void {
  localStorage.setItem(TRADE_STORAGE_KEYS.TRADESEA_ACCOUNT_ID, accountId)
  localStorage.setItem(TRADE_STORAGE_KEYS.TRADESEA_ACCOUNT_LABEL, accountLabel)
  window.dispatchEvent(new Event('tradeTradeseaAccountChanged'))
}
