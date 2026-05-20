import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'
import { ConfirmDialogProps } from '../../types/common'
import { ghostButtonClass, panelCardClass, primaryButtonClass } from '../../styles/aurenTheme'

/**
 * Confirmation dialog — styled to match Auren modals.
 */
class ConfirmDialog extends Component<ConfirmDialogProps> {
  render() {
    const {
      isOpen,
      title,
      message,
      children,
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      onConfirm,
      onCancel,
      variant = 'danger',
      isDark = false,
    } = this.props

    if (!isOpen) return null

    const confirmClass =
      variant === 'danger'
        ? 'px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-500'
        : variant === 'warning'
          ? 'px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-600 text-white hover:bg-amber-500'
          : primaryButtonClass()

    const iconWrap =
      variant === 'danger'
        ? isDark
          ? 'bg-red-500/15 text-red-400'
          : 'bg-red-100 text-red-600'
        : variant === 'warning'
          ? isDark
            ? 'bg-amber-500/15 text-amber-400'
            : 'bg-amber-100 text-amber-700'
          : isDark
            ? 'bg-violet-500/15 text-violet-400'
            : 'bg-violet-100 text-violet-600'

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <button
          type="button"
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
          onClick={onCancel}
          aria-label="Close"
        />
        <div
          role="dialog"
          aria-modal="true"
          className={`relative w-full max-w-md overflow-hidden animate-slide-down ${panelCardClass(isDark)} !p-0`}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={`flex items-start gap-3 px-5 py-4 border-b ${
              isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50/80'
            }`}
          >
            <div className={`p-2 rounded-xl shrink-0 ${iconWrap}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className={`text-lg font-bold tracking-tight flex-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {title}
            </h3>
          </div>

          <div className="px-5 py-5">
            <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{message}</p>
            {children ? <div className="mt-4">{children}</div> : null}
          </div>

          <div
            className={`flex flex-col-reverse sm:flex-row gap-2 px-5 py-4 border-t ${
              isDark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50/50'
            }`}
          >
            <button type="button" onClick={onCancel} className={`flex-1 sm:flex-none ${ghostButtonClass(isDark)}`}>
              {cancelText}
            </button>
            <button type="button" onClick={onConfirm} className={`flex-1 sm:flex-none ${confirmClass}`}>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default ConfirmDialog
