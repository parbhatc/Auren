import { createContext } from 'react'

export type ValidatedAuth = {
  token: string
  isAdmin: boolean
}

/** The current route's completed server check, never a persisted auth cache. */
export const ValidatedAuthContext = createContext<ValidatedAuth | null>(null)
