import { UseFormRegisterReturn, UseFormHandleSubmit, FieldErrors } from 'react-hook-form'
import { UserData } from './user'

export interface PasswordFormData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface NameFormData {
  name: string
}

export interface EmailFormData {
  email: string
}

export interface SettingsProps {
  isDark: boolean
  toggleTheme: () => void
  user: UserData
  navigate: (path: string) => void
  passwordForm: {
    register: (name: keyof PasswordFormData, options?: any) => UseFormRegisterReturn
    handleSubmit: UseFormHandleSubmit<PasswordFormData>
    formState: { errors: FieldErrors<PasswordFormData> }
    watch: (name: 'newPassword') => string
    reset: () => void
  }
  nameForm: {
    register: (name: keyof NameFormData, options?: any) => UseFormRegisterReturn
    handleSubmit: UseFormHandleSubmit<NameFormData>
    formState: { errors: FieldErrors<NameFormData> }
    reset: (values?: { name: string }) => void
  }
  emailForm: {
    register: (name: keyof EmailFormData, options?: any) => UseFormRegisterReturn
    handleSubmit: UseFormHandleSubmit<EmailFormData>
    formState: { errors: FieldErrors<EmailFormData> }
    reset: (values?: { email: string }) => void
  }
  newPassword: string
  passwordError: string
  passwordSuccess: string
  passwordLoading: boolean
  nameError: string
  nameSuccess: string
  nameLoading: boolean
  emailError: string
  emailSuccess: string
  emailLoading: boolean
  onPasswordSubmit: (data: PasswordFormData) => void
  onNameSubmit: (data: NameFormData) => void
  onEmailSubmit: (data: EmailFormData) => void
  embedded?: boolean
  onBack?: () => void
}

export interface UtilsSettingsProps {
  isDark: boolean
  toggleTheme: () => void
  navigate: (path: string) => void
  embedded?: boolean
  onBack?: () => void
}

export interface SettingsTabsProps {
  isDark: boolean
  navigate: (path: string) => void
}

/**
 * Keyboard Shortcuts Interfaces
 */
export interface CustomizableShortcut {
  id: string
  category: string
  description: string
  defaultKey: string
  defaultCtrl?: boolean
  defaultShift?: boolean
  defaultAlt?: boolean
  defaultMeta?: boolean
  customKey?: string
  customCtrl?: boolean
  customShift?: boolean
  customAlt?: boolean
  customMeta?: boolean
  enabled?: boolean
}

export interface ShortcutCategory {
  id: string
  name: string
  shortcuts: CustomizableShortcut[]
}

export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  description: string
  action: () => void
  preventDefault?: boolean
  stopPropagation?: boolean
  shortcutId?: string
  enabled?: boolean
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean
  ignoreInputElements?: boolean
}

export interface KeyboardShortcutsSettingsProps {
  isDark: boolean
  toggleTheme: () => void
  navigate: (path: string) => void
  shortcuts: ShortcutCategory[]
  editingShortcutId: string | null
  onStartEdit: (shortcutId: string) => void
  onCancelEdit: () => void
  onUpdateShortcut: (shortcutId: string, customization: Partial<CustomizableShortcut>) => void
  onResetShortcut: (shortcutId: string) => void
  onResetAll: () => void
  successMessage: string
  errorMessage: string
  embedded?: boolean
  onBack?: () => void
}

export interface KeyboardShortcutsSettingsState {
  shortcuts: ShortcutCategory[]
  selectedShortcut: CustomizableShortcut | null
  isRecording: boolean
  recordingKey: string | null
  showHelp: boolean
  captureKey: boolean
  capturedKey: string | null
  capturedCtrl: boolean
  capturedShift: boolean
  capturedAlt: boolean
  capturedMeta: boolean
}

export interface KeyboardShortcutsHelpProps {
  isOpen: boolean
  onClose: () => void
  shortcuts: Array<Omit<KeyboardShortcut, 'action'>>
  isDark: boolean
  title?: string
}