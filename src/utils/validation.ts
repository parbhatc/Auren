import { VALIDATION_RULES, ERROR_MESSAGES } from '../constants/messages'

export const validateEmail = (email: string): string | null => {
  if (!email) {
    return ERROR_MESSAGES.REQUIRED_FIELD
  }
  if (!VALIDATION_RULES.EMAIL_REGEX.test(email)) {
    return ERROR_MESSAGES.INVALID_EMAIL
  }
  return null
}

export const validatePassword = (password: string): string | null => {
  if (!password) {
    return ERROR_MESSAGES.REQUIRED_FIELD
  }
  if (password.length < VALIDATION_RULES.MIN_PASSWORD_LENGTH) {
    return ERROR_MESSAGES.PASSWORD_TOO_SHORT
  }
  return null
}

export const validatePasswordMatch = (
  password: string,
  confirmPassword: string
): string | null => {
  if (password !== confirmPassword) {
    return ERROR_MESSAGES.PASSWORD_MISMATCH
  }
  return null
}

export const validateRequired = (value: string, fieldName: string): string | null => {
  if (!value || value.trim() === '') {
    return `${fieldName} is required`
  }
  return null
}

