import type { PracticeAccountMode, PracticeAccountRules } from '../constants/practice'
import type { PracticeAccountSize } from '../services/practice/practicePlans'

export type HubTab = 'accounts' | 'market' | 'settings'
export type HubSettingsSection = 'account' | 'market' | 'shortcuts' | 'utils'

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
