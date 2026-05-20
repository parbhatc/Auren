import { Component, createRef } from 'react'
import { Keyboard, RotateCcw, Save, X, Edit2, Power } from 'lucide-react'
import SuccessMessage from '../../common/SuccessMessage'
import SettingsPageLayout from '../../layout/SettingsPageLayout'
import { ghostButtonClass, panelCardClass } from '../../../styles/aurenTheme'
import ErrorMessage from '../../common/ErrorMessage'
import {
  ShortcutCategory,
  CustomizableShortcut,
  getActiveShortcut,
} from '../../../utils/keyboardShortcutsStorage'
import { formatShortcut } from '../../../hooks/useKeyboardShortcuts'
import { t } from '../../../utils/translator'
import { KeyboardShortcutsSettingsProps, KeyboardShortcutsSettingsState } from '../../../types/settings'

/**
 * Keyboard Shortcuts Settings Renderer
 * Beautiful, professional UI for customizing keyboard shortcuts
 */
class KeyboardShortcutsSettingsRenderer extends Component<
  KeyboardShortcutsSettingsProps,
  KeyboardShortcutsSettingsState
> {
  private keyCaptureRef = createRef<HTMLDivElement>()

  state: KeyboardShortcutsSettingsState = {
    shortcuts: [],
    selectedShortcut: null,
    isRecording: false,
    recordingKey: null,
    showHelp: false,
    captureKey: false,
    capturedKey: null,
    capturedCtrl: false,
    capturedShift: false,
    capturedAlt: false,
    capturedMeta: false,
  }

  componentDidUpdate(prevProps: KeyboardShortcutsSettingsProps) {
    if (this.props.editingShortcutId && !prevProps.editingShortcutId) {
      // Started editing - start capturing
      this.setState({ 
        captureKey: true,
        capturedKey: null,
        capturedCtrl: false,
        capturedShift: false,
        capturedAlt: false,
        capturedMeta: false,
      })
      document.addEventListener('keydown', this.handleKeyCapture, true)
    } else if (!this.props.editingShortcutId && prevProps.editingShortcutId) {
      // Stopped editing - stop capturing
      this.setState({ captureKey: false })
      document.removeEventListener('keydown', this.handleKeyCapture, true)
    }
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyCapture, true)
  }

  handleKeyCapture = (event: KeyboardEvent) => {
    if (!this.state.captureKey || !this.props.editingShortcutId) return

    // Don't capture Escape - cancel editing
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      this.props.onCancelEdit()
      return
    }

    // Don't capture modifier keys alone
    if (['Control', 'Shift', 'Alt', 'Meta', 'OS', 'Tab'].includes(event.key)) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    // Handle Ctrl/Cmd properly - on Mac, metaKey is true for Cmd
    const isMac = navigator.platform.includes('Mac')
    const hasCtrl = event.ctrlKey || (!isMac && event.metaKey)
    const hasMeta = event.metaKey && isMac

    this.setState({
      capturedKey: event.key,
      capturedCtrl: hasCtrl,
      capturedShift: event.shiftKey,
      capturedAlt: event.altKey,
      capturedMeta: hasMeta,
    })
  }

  handleSave = () => {
    const { editingShortcutId, onUpdateShortcut } = this.props
    const { capturedKey, capturedCtrl, capturedShift, capturedAlt, capturedMeta } = this.state

    if (!capturedKey || !editingShortcutId) return

    onUpdateShortcut(editingShortcutId, {
      customKey: capturedKey,
      customCtrl: capturedCtrl,
      customShift: capturedShift,
      customAlt: capturedAlt,
      customMeta: capturedMeta,
    })

    this.setState({
      captureKey: false,
      capturedKey: null,
      capturedCtrl: false,
      capturedShift: false,
      capturedAlt: false,
      capturedMeta: false,
    })
  }

  render() {
    const {
      isDark,
      toggleTheme,
      navigate,
      shortcuts,
      editingShortcutId,
      onStartEdit,
      onCancelEdit,
      onResetShortcut,
      onResetAll,
      successMessage,
      errorMessage,
      embedded,
      onBack,
    } = this.props

    const { capturedKey, capturedCtrl, capturedShift, capturedAlt, capturedMeta } = this.state

    const card = panelCardClass(isDark)

    return (
      <SettingsPageLayout
        isDark={isDark}
        toggleTheme={toggleTheme}
        navigate={navigate}
        title={t('practice.hub.settings.shortcutsTitle')}
        subtitle={embedded ? t('practice.hub.settings.shortcutsEmbeddedDesc') : t('practice.hub.settings.shortcutsEmbeddedDesc')}
        icon={Keyboard}
        maxWidth="max-w-4xl"
        embedded={embedded}
        onBack={onBack}
      >
          {/* Messages */}
          <SuccessMessage message={successMessage} isDark={isDark} className="mb-4" />
          <ErrorMessage message={errorMessage} isDark={isDark} className="mb-4" />

          <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('practice.hub.settings.shortcutsHint')}
            </p>
            <button
              type="button"
              onClick={onResetAll}
              className={`${ghostButtonClass(isDark)} flex items-center gap-2`}
            >
              <RotateCcw className="w-4 h-4" />
              {t('practice.hub.settings.resetShortcuts')}
            </button>
          </div>

          {/* Shortcuts by Category */}
          <div className="space-y-6">
            {shortcuts.map((category) => (
              <div key={category.id} className={`${card} overflow-hidden !p-0`}>
                <div
                  className={`px-4 sm:px-6 py-4 border-b ${
                    isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <h2
                    className={`${embedded ? 'text-base' : 'text-lg'} font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}
                  >
                    {category.name}
                  </h2>
                </div>
                <div className="divide-y divide-slate-700 dark:divide-slate-700">
                  {category.shortcuts.map((shortcut) => {
                    const isEditing = editingShortcutId === shortcut.id
                    const active = getActiveShortcut(shortcut)
                    const isCustom =
                      shortcut.customKey !== undefined ||
                      shortcut.customCtrl !== undefined ||
                      shortcut.customShift !== undefined ||
                      shortcut.customAlt !== undefined ||
                      shortcut.customMeta !== undefined

                    return (
                      <div
                        key={shortcut.id}
                        className={`px-4 sm:px-6 py-4 transition-colors ${
                          isEditing
                            ? isDark
                              ? 'bg-blue-900/20 border-l-4 border-blue-500'
                              : 'bg-blue-50 border-l-4 border-blue-500'
                            : isDark
                            ? 'hover:bg-slate-900/50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-sm font-medium ${
                                  isDark ? 'text-slate-200' : 'text-slate-900'
                                }`}
                              >
                                {shortcut.description}
                              </span>
                              {isCustom && (
                                <span
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    isDark
                                      ? 'bg-blue-900/30 text-blue-400'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}
                                >
                                  Custom
                                </span>
                              )}
                              {shortcut.enabled === false && (
                                <span
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    isDark
                                      ? 'bg-slate-700 text-slate-400'
                                      : 'bg-slate-200 text-slate-600'
                                  }`}
                                >
                                  Disabled
                                </span>
                              )}
                            </div>
                            {isEditing ? (
                              <div ref={this.keyCaptureRef} className="mt-2">
                                <div
                                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${
                                    isDark
                                      ? 'bg-slate-900 border-blue-500'
                                      : 'bg-white border-blue-500'
                                  }`}
                                >
                                  {capturedKey ? (
                                    <kbd
                                      className={`px-2.5 py-1 rounded text-xs font-mono font-semibold ${
                                        isDark
                                          ? 'bg-slate-700 text-slate-200 border border-slate-600'
                                          : 'bg-slate-200 text-slate-800 border border-slate-300'
                                      }`}
                                    >
                                      {formatShortcut({
                                        key: capturedKey,
                                        ctrl: capturedCtrl,
                                        shift: capturedShift,
                                        alt: capturedAlt,
                                        meta: capturedMeta,
                                        description: '',
                                      })}
                                    </kbd>
                                  ) : (
                                    <span
                                      className={`text-xs ${
                                        isDark ? 'text-slate-400' : 'text-slate-600'
                                      }`}
                                    >
                                      Press any key combination...
                                    </span>
                                  )}
                                </div>
                                <p
                                  className={`text-xs mt-2 ${
                                    isDark ? 'text-slate-400' : 'text-slate-600'
                                  }`}
                                >
                                  Press the keys you want to use for this shortcut
                                </p>
                              </div>
                            ) : (
                              <kbd
                                className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-mono font-semibold ${
                                  isDark
                                    ? 'bg-slate-700 text-slate-200 border border-slate-600'
                                    : 'bg-slate-200 text-slate-800 border border-slate-300'
                                }`}
                              >
                                {formatShortcut({
                                  key: active.key,
                                  ctrl: active.ctrl,
                                  shift: active.shift,
                                  alt: active.alt,
                                  meta: active.meta,
                                  description: '',
                                })}
                              </kbd>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={this.handleSave}
                                  disabled={!capturedKey}
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all text-sm ${
                                    capturedKey
                                      ? isDark
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                      : isDark
                                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                  }`}
                                >
                                  <Save className="w-4 h-4" />
                                  Save
                                </button>
                                <button
                                  onClick={onCancelEdit}
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all text-sm ${
                                    isDark
                                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                  }`}
                                >
                                  <X className="w-4 h-4" />
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() =>
                                    this.props.onUpdateShortcut(shortcut.id, {
                                      enabled: shortcut.enabled !== false ? false : true,
                                    })
                                  }
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all text-sm ${
                                    shortcut.enabled === false
                                      ? isDark
                                        ? 'bg-green-700 text-green-300 hover:bg-green-600'
                                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                                      : isDark
                                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                  }`}
                                  title={shortcut.enabled === false ? 'Enable shortcut' : 'Disable shortcut'}
                                >
                                  <Power className={`w-4 h-4 ${shortcut.enabled === false ? 'opacity-50' : ''}`} />
                                </button>
                                <button
                                  onClick={() => onStartEdit(shortcut.id)}
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all text-sm ${
                                    isDark
                                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                  }`}
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Edit
                                </button>
                                {isCustom && (
                                  <button
                                    onClick={() => onResetShortcut(shortcut.id)}
                                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all text-sm ${
                                      isDark
                                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                    }`}
                                    title="Reset to default"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
      </SettingsPageLayout>
    )
  }
}

export default KeyboardShortcutsSettingsRenderer


