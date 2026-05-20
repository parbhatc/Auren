import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { ghostButtonClass, panelCardClass, primaryButtonClass } from '../../../../styles/aurenTheme'

export default function PracticeHubModal({
  isOpen,
  isDark,
  title,
  description,
  badge,
  children,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  confirmVariant = 'primary',
  isLoading = false,
}: {
  isOpen: boolean
  isDark: boolean
  title: string
  description?: string
  badge?: ReactNode
  children?: ReactNode
  confirmText: string
  cancelText: string
  onConfirm: () => void
  onCancel: () => void
  confirmVariant?: 'primary' | 'warning' | 'danger'
  isLoading?: boolean
}) {
  if (!isOpen) return null

  const confirmClass =
    confirmVariant === 'danger'
      ? 'px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-500 disabled:opacity-50'
      : confirmVariant === 'warning'
        ? 'px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50'
        : `${primaryButtonClass()} disabled:opacity-50`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onCancel}
        disabled={isLoading}
        aria-label="Close"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-lg max-h-[min(90vh,720px)] flex flex-col overflow-hidden animate-slide-down ${panelCardClass(isDark)} !p-0`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`shrink-0 px-5 pt-5 pb-4 border-b ${
            isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50/90'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              {badge}
              <h2 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {title}
              </h2>
              {description ? (
                <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                isDark ? 'text-slate-500 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              }`}
              aria-label={cancelText}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {children ? (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 custom-scrollbar">{children}</div>
        ) : null}

        <div
          className={`shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 py-4 border-t ${
            isDark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50/80'
          }`}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className={`w-full sm:w-auto ${ghostButtonClass(isDark)} disabled:opacity-50`}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`w-full sm:w-auto ${confirmClass}`}
          >
            {isLoading ? '…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
