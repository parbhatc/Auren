import type { PracticeAccount } from '../../constants/practice'

/** Ended accounts remain available through their explicit links and account manager. */
export function selectPracticeTerminalAccount(accounts: PracticeAccount[], savedId: string | null): PracticeAccount | null {
  return accounts.find((account) => account.id === savedId && account.status === 'active')
    ?? accounts.find((account) => account.status === 'active')
    ?? null
}
