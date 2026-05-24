import type { OrderToastKind } from '../../types/toast'
import { aurenToast } from '../../utils/aurenToast'

export function showOrderToast(kind: OrderToastKind, title: string, subtitle?: string): void {
  aurenToast.order(kind, title, subtitle)
}

/** @deprecated use showOrderToast */
export const showPracticeOrderToast = showOrderToast
