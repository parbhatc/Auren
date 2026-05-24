import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { tradeSideBtnClass, tradeSideMeta, type TradeButtonVariant, type TradeSide } from '../../constants/tradingSide'

export type TradeSideButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  side: TradeSide
  variant: TradeButtonVariant
  active?: boolean
  isDark?: boolean
  className?: string
  children: ReactNode
}

export function TradeSideButton({
  side,
  variant,
  active,
  isDark,
  className = '',
  children,
  type = 'button',
  ...rest
}: TradeSideButtonProps) {
  const cls = [tradeSideBtnClass(side, variant, { active, isDark }), className].filter(Boolean).join(' ')
  const label = tradeSideMeta(side).label

  return (
    <button type={type} className={cls} aria-label={rest['aria-label'] ?? `${label} order`} {...rest}>
      {children}
    </button>
  )
}
