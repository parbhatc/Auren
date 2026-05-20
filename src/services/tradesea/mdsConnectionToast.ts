import { createElement } from 'react'
import { toast, type ToastOptions } from 'react-toastify'
import {
  MdsConnectionToastContent,
  type MdsConnectionToastKind,
} from '../../components/trading/MdsConnectionToastContent'

const TOAST_ID = 'tradesea-mds-connection'

function toastOptions(kind: MdsConnectionToastKind): ToastOptions {
  const pending = kind === 'connecting' || kind === 'reconnecting'
  return {
    toastId: TOAST_ID,
    className: 'mds-connection-toastify',
    icon: false,
    closeButton: kind !== 'connecting' && kind !== 'reconnecting',
    autoClose: pending ? false : kind === 'connected' ? 2800 : 4500,
    hideProgressBar: pending,
    pauseOnHover: !pending,
    draggable: !pending,
  }
}

export function showMdsConnectionToast(
  kind: MdsConnectionToastKind,
  options?: { silent?: boolean }
): void {
  if (options?.silent) return

  const content = () => createElement(MdsConnectionToastContent, { kind })
  const opts = toastOptions(kind)

  if (toast.isActive(TOAST_ID)) {
    toast.update(TOAST_ID, {
      render: content,
      type: kind === 'connected' ? 'success' : kind === 'disconnected' || kind === 'limit' ? 'warning' : 'info',
      ...opts,
    })
    return
  }

  const type =
    kind === 'connected'
      ? 'success'
      : kind === 'disconnected' || kind === 'limit'
        ? 'warning'
        : 'info'

  toast(content, { type, ...opts })
}

export function dismissMdsConnectionToast(): void {
  toast.dismiss(TOAST_ID)
}
