import { createElement } from 'react'
import { toast, type ToastOptions } from 'react-toastify'
import {
  PracticeOrderToastContent,
  type PracticeOrderToastKind,
} from '../../components/trading/PracticeOrderToastContent'

const TOAST_CLASS = 'mds-connection-toastify'

function baseOptions(kind: PracticeOrderToastKind): ToastOptions {
  return {
    className: TOAST_CLASS,
    icon: false,
    autoClose: 2800,
    hideProgressBar: true,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    type: kind === 'pending' ? 'info' : 'success',
  }
}

export function showPracticeOrderToast(
  kind: PracticeOrderToastKind,
  title: string,
  subtitle?: string
): void {
  toast(() => createElement(PracticeOrderToastContent, { kind, title, subtitle }), baseOptions(kind))
}
