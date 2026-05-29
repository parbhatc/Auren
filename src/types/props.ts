/**
 * Prop Firm Types
 */

export type PropFirmType = 'tradesea' | 'rithmic' | 'custom'

export interface PropFirm {
  id: string
  type: PropFirmType
  name: string
  displayName: string
  enabled: boolean
  credentials: PropFirmCredentials
  token?: string | null
  sessionId?: string | null
  expiration?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface PropFirmCredentials {
  username?: string
  password?: string
  email?: string
  accessToken?: string
  apiKey?: string
  creditcal?: string
  sessionId?: string
  sessionIdAuth?: string
  /** Rithmic — last successful login session metadata */
  systemName?: string
  gatewayName?: string
  gatewayUri?: string | null
  loginPassed?: boolean
  uniqueUserId?: string
  fcmId?: string
  ibId?: string
  infraType?: number
  rpCode?: string
  [key: string]: any // Allow for custom credentials
}

export interface PropFirmFormData {
  type: PropFirmType
  credentials: PropFirmCredentials
}

export interface PropsSettingsResponse {
  success: boolean
  message?: string
  propFirms?: PropFirm[]
  propFirm?: PropFirm
}

export interface PropsSettingsRendererProps {
  isDark: boolean
  toggleTheme: () => void
  navigate: (path: string) => void
  propFirms: PropFirm[]
  loading: boolean
  saving: boolean
  error: string
  success: string
  onSave: (data: PropFirmFormData) => void
  onDelete: (type: string) => void
  onTest: (type: string, credentials: { username: string; password: string }) => void
  onNotifySuccess?: (message: string) => void
  onNotifyError?: (message: string) => void
  onRefreshPropFirms?: () => void
  user?: { isAdmin?: boolean } | null
  embedded?: boolean
  onBack?: () => void
}

// Prop firm definitions are now managed through the prop firm registry
// See src/propfirms/registry.ts

