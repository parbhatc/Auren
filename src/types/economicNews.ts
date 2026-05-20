import { NavigateFunction } from 'react-router-dom'

export interface EconomicNewsProps {
  isDark: boolean
  toggleTheme: () => void
  navigate: NavigateFunction
}

export interface EconomicNewsWrapperProps {
  // Add any wrapper-specific props here
}

export interface EconomicEvent {
  time: string
  currency: string
  impact: 'high' | 'medium' | 'low'
  event: string
  forecast?: string
  previous?: string
  actual?: string
}

