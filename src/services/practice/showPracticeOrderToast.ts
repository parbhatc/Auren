import type { PracticeOrderToastKind } from '../../components/trading/PracticeOrderToastContent'
import { aurenToast } from '../../utils/aurenToast'

export function showPracticeOrderToast(
  kind: PracticeOrderToastKind,
  title: string,
  subtitle?: string
): void {
  aurenToast.order(kind, title, subtitle)
}
