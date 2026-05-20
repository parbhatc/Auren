import { Component } from 'react'
import { X } from 'lucide-react'
import { ModalProps } from '../../types/common'

/**
 * Professional modal dialog component
 * Replaces inline forms with modal dialogs
 */
class Modal extends Component<ModalProps> {
  render() {
    const { isOpen, title, onClose, children, size = 'md', isDark } = this.props

    if (!isOpen) return null

    const sizeClasses = {
      sm: 'max-w-sm',
      md: 'max-w-lg',
      lg: 'max-w-2xl',
      xl: 'max-w-4xl',
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div
          className={`relative rounded-xl sm:rounded-2xl shadow-2xl border max-w-full w-full ${sizeClasses[size]} ${
            isDark
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-slate-200'
          } animate-slide-down max-h-[95vh] sm:max-h-[90vh] flex flex-col`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between p-4 sm:p-6 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} truncate pr-2`}>
              {title}
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                isDark
                  ? 'hover:bg-slate-700 text-slate-400'
                  : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {children}
          </div>
        </div>
      </div>
    )
  }
}

export default Modal
