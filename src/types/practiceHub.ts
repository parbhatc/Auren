import type { PracticeAccountMode, PracticeAccountRules } from '../constants/practice'
import type { PracticeAccountSize } from '../services/practice/practicePlans'

export type HubTab = 'accounts' | 'settings' | 'admin'
export type HubHomeMode = 'practice' | 'live'
export type HubSettingsSection = 'account' | 'market' | 'shortcuts' | 'utils'
export type HubAdminSection = 'site' | 'roles' | 'users'

export type InlineRulesFormHandle = {
  commitPending: () => PracticeAccountRules
  validate: () => string | null
}

export type InlineRulesFormProps = {
  isDark: boolean
  mode: PracticeAccountMode
  size: PracticeAccountSize
  rules: PracticeAccountRules
  defaults: PracticeAccountRules
  onChange: (r: PracticeAccountRules) => void
  onReset?: () => void
  validationError?: string | null
  compact?: boolean
}

/** @deprecated use InlineRulesFormHandle */
export type PracticeInlineRulesFormHandle = InlineRulesFormHandle
