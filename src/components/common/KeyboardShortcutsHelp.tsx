import { Component } from 'react'
import { X, Keyboard } from 'lucide-react'
import { formatShortcut } from '../../hooks/useKeyboardShortcuts'
import { KeyboardShortcutsHelpProps, KeyboardShortcut } from '../../types/settings'

/**
 * Professional keyboard shortcuts help modal
 * Displays all available keyboard shortcuts in an organized, searchable format
 */
class KeyboardShortcutsHelp extends Component<KeyboardShortcutsHelpProps> {
  componentDidMount() {
    if (this.props.isOpen) {
      document.addEventListener('keydown', this.handleEscape)
      document.body.style.overflow = 'hidden'
    }
  }

  componentDidUpdate(prevProps: KeyboardShortcutsHelpProps) {
    if (this.props.isOpen !== prevProps.isOpen) {
      if (this.props.isOpen) {
        document.addEventListener('keydown', this.handleEscape)
        document.body.style.overflow = 'hidden'
      } else {
        document.removeEventListener('keydown', this.handleEscape)
        document.body.style.overflow = ''
      }
    }
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleEscape)
    document.body.style.overflow = ''
  }

  handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.props.isOpen) {
      this.props.onClose()
    }
  }

  render() {
    const { isOpen, onClose, shortcuts, isDark, title = 'Keyboard Shortcuts' } = this.props

    if (!isOpen) return null

    // Group shortcuts by category (if they have categories in description)
    const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
      // Try to extract category from description (e.g., "Playback: Play/Pause")
      const categoryMatch = shortcut.description.match(/^([^:]+):/)
      const category = categoryMatch ? categoryMatch[1].trim() : 'General'
      
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(shortcut)
      return acc
    }, {} as Record<string, typeof shortcuts>)

    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        onClick={onClose}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      >
        <div
          className={`relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl border ${
            isDark
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-slate-200'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between p-4 sm:p-6 border-b ${
              isDark ? 'border-slate-700' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <Keyboard className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
              <h2
                className={`text-xl sm:text-2xl font-bold ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-all ${
                isDark
                  ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-200'
                  : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-4 sm:p-6">
            {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
              <div key={category} className="mb-6 last:mb-0">
                <h3
                  className={`text-sm font-semibold uppercase tracking-wider mb-3 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  {category}
                </h3>
                <div className="space-y-2">
                  {categoryShortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isDark
                          ? 'bg-slate-900/50 hover:bg-slate-900'
                          : 'bg-slate-50 hover:bg-slate-100'
                      } transition-colors`}
                    >
                      <span
                        className={`text-sm ${
                          isDark ? 'text-slate-300' : 'text-slate-700'
                        }`}
                      >
                        {shortcut.description.includes(':')
                          ? shortcut.description.split(':').slice(1).join(':').trim()
                          : shortcut.description}
                      </span>
                      <kbd
                        className={`px-2.5 py-1 rounded text-xs font-mono font-semibold ${
                          isDark
                            ? 'bg-slate-700 text-slate-200 border border-slate-600'
                            : 'bg-slate-200 text-slate-800 border border-slate-300'
                        }`}
                      >
                        {formatShortcut(shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            className={`p-4 sm:p-6 border-t ${
              isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <p
              className={`text-xs text-center ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              Press <kbd className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                isDark
                  ? 'bg-slate-700 text-slate-200 border border-slate-600'
                  : 'bg-slate-200 text-slate-800 border border-slate-300'
              }`}>Esc</kbd> to close
            </p>
          </div>
        </div>
      </div>
    )
  }
}

export default KeyboardShortcutsHelp

