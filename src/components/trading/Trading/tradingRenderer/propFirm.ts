import { propFirmRegistry } from '../../../../propfirms'
import { FormattedAccount } from '../../../../utils/marketAccountDisplay'
import { saveTradeTradeseaAccount } from '../../../../constants/trade'
import type { TradeseaMdsClient } from '../../../../services/tradesea/TradeseaMdsClient'

export function findPropFirmWithAccount(accountId: number): any {
  for (const firm of propFirmRegistry) {
    const firmAny = firm as any
    if (firmAny.formattedAccounts && Array.isArray(firmAny.formattedAccounts)) {
      const hasAccount = firmAny.formattedAccounts.some((acc: any) => acc.accountId === accountId)
      if (hasAccount) {
        return firmAny
      }
    }
  }
  return null
}

export function getActivePropFirm(_practiceMode?: boolean): any {
  const activePropFirmId = localStorage.getItem('activePropFirm') || propFirmRegistry[0]?.id
  const activePropFirm = propFirmRegistry.find((f) => f.id === activePropFirmId)

  if (activePropFirm) {
    return activePropFirm as any
  }

  for (const firm of propFirmRegistry) {
    const firmAny = firm as any
    if (
      firmAny.formattedAccounts &&
      Array.isArray(firmAny.formattedAccounts) &&
      firmAny.formattedAccounts.length > 0
    ) {
      return firmAny
    }
  }
  return null
}

export function getMdsClient(practiceMode?: boolean): TradeseaMdsClient | null {
  const firm = getActivePropFirm(practiceMode)
  if (!firm) return null
  return firm.chartServices?.mds ?? firm.mdsClient ?? null
}

export function getTradeHandler(practiceMode?: boolean): any {
  const activeFirm = getActivePropFirm(practiceMode)
  if (!activeFirm) {
    return null
  }

  if (practiceMode && activeFirm.practiceTradeHandler) {
    return activeFirm.practiceTradeHandler
  }

  return activeFirm.getHandler?.() || null
}

export function updatePropFirmAccount(accountId: number): void {
  const activeFirm = getActivePropFirm()

  if (activeFirm?.id === 'tradesea' && activeFirm.formattedAccounts) {
    const formatted = activeFirm.formattedAccounts.find(
      (a: FormattedAccount) => a.accountId === accountId
    )
    if (formatted?.account?.id) {
      activeFirm.selectedAccountId = formatted.account.id
      saveTradeTradeseaAccount(formatted.account.id, formatted.displayName)
      activeFirm.onSelectedAccountChanged?.()
    }
    return
  }

  const firm = findPropFirmWithAccount(accountId)
  if (firm && firm.onSelectedAccountChanged) {
    firm.selectedAccountId = accountId
    firm.onSelectedAccountChanged()
  }
}
