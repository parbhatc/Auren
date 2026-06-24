import { FormattedAccount } from '../../../../utils/marketAccountDisplay'

export function resolveFormattedAccounts(accounts: any[]): FormattedAccount[] {
  if (
    accounts.length > 0 &&
    typeof accounts[0] === 'object' &&
    'accountId' in accounts[0]
  ) {
    return accounts as FormattedAccount[]
  }

  return accounts.map((acc: string | any) => ({
    accountId: typeof acc === 'string' ? 0 : acc.accountId || 0,
    displayName: typeof acc === 'string' ? acc : acc.displayName || acc,
    account: typeof acc === 'string' ? null : acc.account || null,
    templateName: '',
    accountName: typeof acc === 'string' ? acc : acc.accountName || '',
    isIneligible: false,
    isCombine: false,
    isExpress: false,
  }))
}

export function resolveAccountsList(
  accountsProp: any[] | undefined,
  activeFirm: any
): any[] {
  if (
    activeFirm?.id === 'tradesea' &&
    activeFirm?.formattedAccounts &&
    Array.isArray(activeFirm.formattedAccounts) &&
    activeFirm.formattedAccounts.length > 0
  ) {
    return activeFirm.formattedAccounts
  }

  if (accountsProp !== undefined && accountsProp !== null) {
    return accountsProp.length > 0 ? accountsProp : []
  }

  return ['Account 1', 'Account 2', 'Account 3']
}
