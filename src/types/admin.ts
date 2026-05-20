import type { Role } from '../api/permissions.api'
import { UserData } from './user'
import { getThemeColors } from '../constants/theme'

export interface RoleFormProps {
  isCreating: boolean
  editingRole: Role | null
  newRole: { id: string; name: string; permissions: string[] }
  availablePermissions: string[]
  saving: boolean
  onCancel: () => void
  onSave: () => void
  onRoleChange: (field: 'id' | 'name', value: string) => void
  onTogglePermission: (permission: string) => void
  isDark: boolean
}

export interface RoleCardProps {
  role: Role
  isExpanded: boolean
  users: any[]
  onEdit: () => void
  onDelete: () => void
  onToggleExpand: () => void
  isDark: boolean
}

export interface PasswordSettingsProps {
  config: {
    minLength: number
    maxLength: number
  }
  onUpdate: (field: 'minLength' | 'maxLength', value: number) => void
  isDark: boolean
}

export interface SignupSettingsProps {
  enabled: boolean
  onUpdate: (enabled: boolean) => void
  isDark: boolean
}

export interface CodeSettingsProps {
  title: string
  lengthKey: string
  expiryKey: string
  config: {
    length: number
    expiryMinutes: number
  }
  onUpdate: (field: 'length' | 'expiryMinutes', value: number) => void
  isDark: boolean
}

export interface EmailSettingsProps {
  config: {
    from: string
    appName: string
    appUrl: string
    supportEmail: string
    smtp: {
      user: string
      password: string
    }
  }
  onUpdate: (path: string[], value: any) => void
  isDark: boolean
}

export interface TokenSettingsProps {
  title: string
  labelKey: string
  value: string | number
  type: 'text' | 'number'
  placeholder?: string
  onUpdate: (value: string | number) => void
  isDark: boolean
}

export interface ConfigData {
  password: {
    minLength: number
    maxLength: number
  }
  signup: {
    enabled: boolean
  }
  verificationCode: {
    length: number
    expiryMinutes: number
  }
  resetCode: {
    length: number
    expiryMinutes: number
  }
  email: {
    from: string
    appName: string
    appUrl: string
    supportEmail: string
    smtp: {
      user: string
      password: string
    }
  }
  jwt: {
    expiresIn: string
  }
  resetToken: {
    expiryHours: number
  }
}

export interface AdminSettingsProps {
  isDark: boolean
  toggleTheme: () => void
  user: UserData
  config: ConfigData | null
  colors: ReturnType<typeof getThemeColors>
  navigate: (path: string) => void
  error: string
  success: string
  saving: boolean
  onSave: () => void
  updateConfig: (path: string[], value: any) => void
}

export interface RolesManagerProps {
  isDark: boolean
  toggleTheme: () => void
  user: UserData
  colors: ReturnType<typeof getThemeColors>
  navigate: (path: string) => void
  roles: Role[]
  availablePermissions: string[]
  error: string
  success: string
  editingRole: Role | null
  isCreating: boolean
  newRole: { id: string; name: string; permissions: string[] }
  saving: boolean
  usersByRole: Record<string, any[]>
  expandedRoles: Set<string>
  deleteConfirm: { isOpen: boolean; roleId: string | null }
  onLoadUsersForRole: (roleId: string) => void
  onToggleRoleExpanded: (roleId: string) => void
  onCreateRole: () => void
  onEditRole: (role: Role) => void
  onCancel: () => void
  onRoleChange: (field: 'id' | 'name', value: string) => void
  onTogglePermission: (permission: string) => void
  onSave: () => void
  onDeleteClick: (roleId: string) => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}

export interface UserManagerProps {
  isDark: boolean
  toggleTheme: () => void
  user: UserData
  colors: ReturnType<typeof getThemeColors>
  navigate: (path: string) => void
  users: any[]
  roles: Role[]
  error: string
  success: string
  editingUser: any | null
  editForm: { name: string; email: string; role: string }
  saving: boolean
  showPasswordReset: string | null
  newPassword: string
  deleteConfirm: { isOpen: boolean; userId: string | null }
  isCreating: boolean
  createForm: { name: string; username: string; email: string; password: string; role: string }
  searchQuery: string
  filteredUsers: any[]
  onEditFormChange: (field: string, value: string) => void
  onCreateFormChange: (field: string, value: string) => void
  onSearchChange: (query: string) => void
  onCreateClick: () => void
  onCreateCancel: () => void
  onCreate: () => void
  onEdit: (user: any) => void
  onCancel: () => void
  onSave: () => void
  onDeleteClick: (userId: string) => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
  onResetPassword: (userId: string) => void
  onShowPasswordReset: (userId: string) => void
  onNewPasswordChange: (password: string) => void
}
