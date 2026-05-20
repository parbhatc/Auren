import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../../hooks/useTheme'
import KeyboardShortcutsSettingsRenderer from './KeyboardShortcutsSettingsRenderer'
import ConfirmDialog from '../../common/ConfirmDialog'
import {
  getShortcutsWithCustomizations,
  updateShortcutCustomization,
  resetShortcutToDefault,
  resetAllShortcutsToDefault,
  ShortcutCategory,
  CustomizableShortcut,
} from '../../../utils/keyboardShortcutsStorage'

/**
 * Keyboard Shortcuts Settings Wrapper
 * Manages state and passes props to renderer
 */
type KeyboardShortcutsSettingsWrapperProps = {
  embedded?: boolean
  onBack?: () => void
}

const KeyboardShortcutsSettingsWrapper = ({
  embedded,
  onBack,
}: KeyboardShortcutsSettingsWrapperProps = {}) => {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [shortcuts, setShortcuts] = useState<ShortcutCategory[]>([])
  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [showResetAllDialog, setShowResetAllDialog] = useState<boolean>(false)

  useEffect(() => {
    loadShortcuts()
  }, [])

  const loadShortcuts = () => {
    const loaded = getShortcutsWithCustomizations()
    setShortcuts(loaded)
  }

  const handleUpdateShortcut = (
    shortcutId: string,
    customization: Partial<CustomizableShortcut>
  ) => {
    try {
      updateShortcutCustomization(shortcutId, customization)
      loadShortcuts()
      setSuccessMessage('Shortcut updated successfully')
      setTimeout(() => setSuccessMessage(''), 3000)
      setEditingShortcutId(null)
    } catch (error) {
      setErrorMessage('Failed to update shortcut')
      setTimeout(() => setErrorMessage(''), 3000)
    }
  }

  const handleResetShortcut = (shortcutId: string) => {
    try {
      resetShortcutToDefault(shortcutId)
      loadShortcuts()
      setSuccessMessage('Shortcut reset to default')
      setTimeout(() => setSuccessMessage(''), 3000)
      setEditingShortcutId(null)
    } catch (error) {
      setErrorMessage('Failed to reset shortcut')
      setTimeout(() => setErrorMessage(''), 3000)
    }
  }

  const handleResetAllClick = () => {
    setShowResetAllDialog(true)
  }

  const handleResetAllConfirm = () => {
    try {
      resetAllShortcutsToDefault()
      loadShortcuts()
      setSuccessMessage('All shortcuts reset to default')
      setTimeout(() => setSuccessMessage(''), 3000)
      setEditingShortcutId(null)
      setShowResetAllDialog(false)
    } catch (error) {
      setErrorMessage('Failed to reset shortcuts')
      setTimeout(() => setErrorMessage(''), 3000)
      setShowResetAllDialog(false)
    }
  }

  const handleResetAllCancel = () => {
    setShowResetAllDialog(false)
  }

  return (
    <>
      <KeyboardShortcutsSettingsRenderer
        isDark={isDark}
        toggleTheme={toggleTheme}
        navigate={navigate}
        shortcuts={shortcuts}
        editingShortcutId={editingShortcutId}
        onStartEdit={setEditingShortcutId}
        onCancelEdit={() => setEditingShortcutId(null)}
        onUpdateShortcut={handleUpdateShortcut}
        onResetShortcut={handleResetShortcut}
        onResetAll={handleResetAllClick}
        successMessage={successMessage}
        errorMessage={errorMessage}
        embedded={embedded}
        onBack={onBack}
      />
      <ConfirmDialog
        isOpen={showResetAllDialog}
        title="Reset All Shortcuts"
        message="Are you sure you want to reset all keyboard shortcuts to their default values? This action cannot be undone and will remove all your customizations."
        confirmText="Reset All"
        cancelText="Cancel"
        onConfirm={handleResetAllConfirm}
        onCancel={handleResetAllCancel}
        variant="warning"
        isDark={isDark}
      />
    </>
  )
}

export default KeyboardShortcutsSettingsWrapper

