/**
 * Utility-related TypeScript interfaces
 */

export interface FormattedAccount {
  accountId: number
  displayName: string
  templateName: string
  accountName: string
  isIneligible: boolean
  isCombine: boolean
  isExpress: boolean
  account: any
}

export interface ParsedTimeframe {
  multiplier: number
  unit: 'T' | 'S' | 'M' | 'D' | 'W' | 'MONTH' // 'M' for minutes, 'MONTH' for months
  original: string
  isValid: boolean
  error?: string
}
