/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
}

/**
 * Application constants
 */
export const APP_CONFIG = {
  JWT_EXPIRES_IN: '7d',
  RESET_TOKEN_EXPIRY: 3600000, // 1 hour in milliseconds
  MIN_PASSWORD_LENGTH: 6,
}

