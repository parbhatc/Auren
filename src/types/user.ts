/**
 * User-related TypeScript interfaces
 */

export interface UserData {
  id: string
  username: string
  email: string
  name: string
  role: string
  email_verified: boolean
  permissions?: string[]
  isAdmin?: boolean
}

