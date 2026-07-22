import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type DisplayUnit = 'usd' | 'r' | 'points' | 'percent'

type DisplayUnitContextValue = {
  unit: DisplayUnit
  setUnit: (unit: DisplayUnit) => void
  format: (value: number, startingBalance?: number, riskUnit?: number) => string
}

const STORAGE_KEY = 'auren-display-unit'

const DisplayUnitContext = createContext<DisplayUnitContextValue | undefined>(undefined)

function readInitialUnit(): DisplayUnit {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'usd' || saved === 'r' || saved === 'points' || saved === 'percent') return saved
  } catch {
    // Storage is optional.
  }
  return 'usd'
}

export function DisplayUnitProvider({ children }: { children: ReactNode }) {
  const [unit, setUnitState] = useState<DisplayUnit>(readInitialUnit)

  const value = useMemo<DisplayUnitContextValue>(() => {
    const setUnit = (next: DisplayUnit) => {
      setUnitState(next)
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Storage is optional.
      }
    }

    const format = (amount: number, startingBalance = 1, riskUnit = 100) => {
      if (unit === 'r') return `${(amount / Math.max(riskUnit, 1)).toFixed(2)}R`
      if (unit === 'points') return `${(amount / 20).toFixed(1)} pts`
      if (unit === 'percent') return `${((amount / Math.max(startingBalance, 1)) * 100).toFixed(2)}%`
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
        signDisplay: amount === 0 ? 'auto' : 'always',
      }).format(amount)
    }

    return { unit, setUnit, format }
  }, [unit])

  return <DisplayUnitContext.Provider value={value}>{children}</DisplayUnitContext.Provider>
}

export function useDisplayUnit() {
  const context = useContext(DisplayUnitContext)
  if (!context) throw new Error('useDisplayUnit must be used within DisplayUnitProvider')
  return context
}
