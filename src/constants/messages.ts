import { t } from '../utils/translator'

// Re-export translator for convenience
export { t } from '../utils/translator'

// Legacy exports using translator (for backward compatibility)
export const AUTH_MESSAGES = {
  LOGIN_SUCCESS: t('messages.success.login'),
  REGISTER_SUCCESS: t('messages.success.register'),
  PASSWORD_RESET_SENT: t('messages.success.passwordResetSent'),
  PASSWORD_RESET_SUCCESS: t('messages.success.passwordResetSuccess'),
  LOGOUT_SUCCESS: t('messages.success.logout'),
} as const

export const ERROR_MESSAGES = {
  REQUIRED_FIELD: t('messages.error.requiredField'),
  INVALID_EMAIL: t('messages.error.invalidEmail'),
  PASSWORD_MISMATCH: t('messages.error.passwordMismatch'),
  PASSWORD_TOO_SHORT: t('messages.error.passwordTooShort'),
  USERNAME_REQUIRED: t('messages.error.usernameRequired'),
  PASSWORD_REQUIRED: t('messages.error.passwordRequired'),
  LOGIN_FAILED: t('messages.error.loginFailed'),
  REGISTER_FAILED: t('messages.error.registerFailed'),
  USERNAME_EXISTS: t('messages.error.usernameExists'),
  EMAIL_EXISTS: t('messages.error.emailExists'),
  NETWORK_ERROR: t('messages.error.networkError'),
  API_NOT_REACHABLE: t('messages.error.apiNotReachable'),
  SERVER_ERROR: t('messages.error.serverError'),
  UNKNOWN_ERROR: t('messages.error.unknownError'),
  INVALID_CREDENTIALS: t('messages.error.invalidCredentials'),
  ACCOUNT_NOT_FOUND: t('messages.error.accountNotFound'),
  RESET_TOKEN_INVALID: t('messages.error.resetTokenInvalid'),
  RESET_FAILED: t('messages.error.resetFailed'),
} as const

export const VALIDATION_RULES = {
  MIN_PASSWORD_LENGTH: 6,
  EMAIL_REGEX: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
} as const

