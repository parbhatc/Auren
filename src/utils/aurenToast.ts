import { createElement } from 'react'
import { toast, type ToastOptions, type TypeOptions } from 'react-toastify'
import { AurenToastContent, type AurenToastKind } from '../components/common/AurenToastContent'
import { t } from './translator'

const TOAST_CLASS = 'auren-toastify'

const DEFAULT_AUTO_CLOSE = 3200

function baseOptions(kind: AurenToastKind, type: TypeOptions): ToastOptions {
  return {
    className: TOAST_CLASS,
    icon: false,
    autoClose: DEFAULT_AUTO_CLOSE,
    hideProgressBar: true,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    type,
  }
}

function show(kind: AurenToastKind, title: string, subtitle?: string, type: TypeOptions = 'default') {
  toast(
    () => createElement(AurenToastContent, { kind, title, subtitle: subtitle || undefined }),
    baseOptions(kind, type)
  )
}

/** Map raw API / legacy strings to title + subtitle. */
function mapMessage(message: string): { title: string; subtitle?: string } {
  const m = message.trim()
  if (!m) return { title: t('toast.genericError') }

  const known: Record<string, { title: string; subtitle?: string }> = {
    'Self-imposed lockout is active.': {
      title: t('toast.lockout.manualTitle'),
      subtitle: t('toast.lockout.manualSubtitle'),
    },
    'Self-imposed trading lockout is active.': {
      title: t('toast.lockout.manualTitle'),
      subtitle: t('toast.lockout.manualSubtitle'),
    },
    [t('toast.lockout.manualSubtitle')]: {
      title: t('toast.lockout.manualTitle'),
      subtitle: t('toast.lockout.manualSubtitle'),
    },
    'Practice account is not active': {
      title: t('toast.practice.inactiveTitle'),
      subtitle: t('toast.practice.inactiveSubtitle'),
    },
    'Practice account has blown. Max drawdown reached.': {
      title: t('toast.practice.blownTitle'),
      subtitle: t('toast.practice.blownSubtitle'),
    },
    'Practice evaluation already passed': {
      title: t('toast.practice.passedTitle'),
      subtitle: t('toast.practice.passedSubtitle'),
    },
    'Waiting for market data…': {
      title: t('toast.marketData.waitTitle'),
      subtitle: t('toast.marketData.waitSubtitle'),
    },
    'Enter a valid quantity': {
      title: t('toast.order.invalidQtyTitle'),
      subtitle: t('toast.order.invalidQtySubtitle'),
    },
    'Enter a valid limit price': {
      title: t('toast.order.invalidPriceTitle'),
      subtitle: t('toast.order.invalidPriceSubtitle'),
    },
    'No open position': {
      title: t('toast.order.noPositionTitle'),
      subtitle: t('toast.order.noPositionSubtitle'),
    },
  }

  if (known[m]) return known[m]

  if (m.includes('Daily loss limit')) {
    return { title: t('toast.lockout.dailyLossTitle'), subtitle: m }
  }
  if (m.includes('Max') && m.includes('trades')) {
    return { title: t('toast.lockout.maxTradesTitle'), subtitle: m }
  }
  if (m.includes('Locked until')) {
    return { title: t('toast.lockout.lockedTitle'), subtitle: m }
  }
  if (m.includes('Trading is locked')) {
    return { title: t('toast.lockout.lockedTitle'), subtitle: m }
  }

  if (m.length > 72) {
    const dot = m.indexOf('. ')
    if (dot > 0 && dot < 80) {
      return { title: m.slice(0, dot + 1), subtitle: m.slice(dot + 2) }
    }
    return { title: m.slice(0, 72) + '…', subtitle: m }
  }

  return { title: m }
}

export const aurenToast = {
  success(title: string, subtitle?: string) {
    show('success', title, subtitle, 'success')
  },

  error(message: string, subtitle?: string) {
    const mapped = subtitle ? { title: message, subtitle } : mapMessage(message)
    show('error', mapped.title, mapped.subtitle, 'error')
  },

  info(title: string, subtitle?: string) {
    show('info', title, subtitle, 'info')
  },

  warning(title: string, subtitle?: string) {
    show('warning', title, subtitle, 'warning')
  },

  lockout(title: string, subtitle?: string) {
    show('lockout', title, subtitle, 'warning')
  },

  order(kind: 'buy' | 'sell' | 'pending', title: string, subtitle?: string) {
    show(kind, title, subtitle, kind === 'pending' ? 'info' : 'success')
  },
}
