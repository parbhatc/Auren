import { createElement } from 'react'
import { toast, type ToastOptions, type TypeOptions } from 'react-toastify'
import { AurenToastContent } from '../../components/common/AurenToastContent'
import type { OrderToastKind } from '../../types/toast'
import { t } from '../../utils/translator'

const TOAST_ID = 'auren-order-fill'
const BURST_MS = 1600
const AUTO_CLOSE = 2800

let burstCount = 0
let burstKind: OrderToastKind | null = null
let burstTimer: ReturnType<typeof setTimeout> | null = null

function resetBurstLater(): void {
  if (burstTimer) clearTimeout(burstTimer)
  burstTimer = setTimeout(() => {
    burstCount = 0
    burstKind = null
    burstTimer = null
  }, BURST_MS)
}

function orderToastOptions(kind: OrderToastKind): ToastOptions {
  const type: TypeOptions = kind === 'pending' ? 'info' : 'success'
  return {
    toastId: TOAST_ID,
    className: 'auren-toastify',
    icon: false,
    autoClose: AUTO_CLOSE,
    hideProgressBar: true,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    type,
  }
}

function formatSubtitle(subtitle: string | undefined, count: number): string | undefined {
  if (count <= 1) return subtitle
  const more = t('toast.order.burstMore', { count: count - 1 })
  if (subtitle) return `${subtitle} · ${more}`
  return more
}

export function showOrderToast(kind: OrderToastKind, title: string, subtitle?: string): void {
  if (burstKind === kind) {
    burstCount++
  } else {
    burstCount = 1
    burstKind = kind
  }
  resetBurstLater()

  const displaySubtitle = formatSubtitle(subtitle, burstCount)
  const content = () =>
    createElement(AurenToastContent, {
      kind,
      title,
      subtitle: displaySubtitle,
    })
  const opts = orderToastOptions(kind)

  if (toast.isActive(TOAST_ID)) {
    toast.update(TOAST_ID, {
      render: content,
      ...opts,
    })
    return
  }

  toast(content, opts)
}

/** @deprecated use showOrderToast */
export const showPracticeOrderToast = showOrderToast
