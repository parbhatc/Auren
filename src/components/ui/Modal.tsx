import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { panelCardClass } from '../../styles/aurenTheme'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

const sizeClass: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-3xl',
}

export default function Modal({
  isOpen,
  isDark,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  accent,
  bodyClassName,
}: {
  isOpen: boolean
  isDark: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: ModalSize
  accent?: ReactNode
  bodyClassName?: string
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${sizeClass[size]} overflow-hidden animate-slide-down ${panelCardClass(isDark)} !p-0`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-start gap-3 px-5 sm:px-6 py-4 border-b ${
            isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50/80'
          }`}
        >
          {accent ? <div className="shrink-0 pt-0.5">{accent}</div> : null}
          <div className="flex-1 min-w-0">
            <h2 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {title}
            </h2>
            {subtitle ? (
              <div
                className={`mt-1.5 ${typeof subtitle === 'string' ? `text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}` : ''}`}
              >
                {typeof subtitle === 'string' ? <p>{subtitle}</p> : subtitle}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl shrink-0 transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className={`px-5 sm:px-6 py-5 overflow-y-auto ${bodyClassName ?? 'max-h-[min(65vh,480px)]'}`}
        >
          {children}
        </div>

        {footer ? (
          <div
            className={`flex flex-col-reverse sm:flex-row gap-2 px-5 sm:px-6 py-4 border-t ${
              isDark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50/50'
            }`}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
