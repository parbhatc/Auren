import { FormattedAccount } from '../types/utils'

export type { FormattedAccount }

export function formatAccountDisplay(account: any, template: any | null): string {
  const templateName = template?.name || template?.title || 'Unknown Template'
  const accountName = account.accountName || account.nickname || `Account ${account.accountId}`
  const ineligibleText = account.ineligible ? ' (ineligible)' : ''
  return `${templateName} | ${accountName}${ineligibleText}`
}

export function getAccountType(account: any): 'combine' | 'express' | 'unknown' {
  if (account.type === 1) return 'combine'
  if (account.type === 2) return 'express'
  return 'unknown'
}

export function getAccountColorClasses(
  account: any,
  isDark: boolean,
  isSelected: boolean = false
): string {
  const isIneligible = account.ineligible
  const accountType = getAccountType(account)

  if (isSelected) {
    return isDark ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-900'
  }
  if (isIneligible) {
    return isDark ? 'text-red-400 hover:bg-slate-700' : 'text-red-600 hover:bg-slate-50'
  }
  if (accountType === 'combine') {
    return isDark ? 'text-blue-400 hover:bg-slate-700' : 'text-blue-600 hover:bg-slate-50'
  }
  if (accountType === 'express') {
    return isDark ? 'text-green-400 hover:bg-slate-700' : 'text-green-600 hover:bg-slate-50'
  }
  return isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'
}

export function formatAccounts(accounts: any[], templates: any[]): FormattedAccount[] {
  return accounts.map((account) => {
    const template = templates.find((t) => t.id === account.templateId || t.id === account.templateId)
    const accountType = getAccountType(account)
    return {
      accountId: account.accountId || account.id,
      displayName: formatAccountDisplay(account, template),
      templateName: template?.name || template?.title || 'Unknown Template',
      accountName: account.accountName || account.nickname || `Account ${account.accountId || account.id}`,
      isIneligible: account.ineligible || false,
      isCombine: accountType === 'combine',
      isExpress: accountType === 'express',
      account,
    }
  })
}

const SELECTED_ACCOUNT_KEY = 'market_data_selected_account_id'

export function getSelectedAccountId(): number | null {
  try {
    const stored = localStorage.getItem(SELECTED_ACCOUNT_KEY)
    return stored ? parseInt(stored, 10) : null
  } catch {
    return null
  }
}

export function saveSelectedAccountId(accountId: number): void {
  try {
    localStorage.setItem(SELECTED_ACCOUNT_KEY, accountId.toString())
  } catch {
    /* ignore */
  }
}
