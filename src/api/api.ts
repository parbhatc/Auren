import axios, { AxiosInstance } from 'axios'

/**
 * Get API base URL
 * Dev and production both use `/api` (Vite proxy locally, Nginx on VPS).
 * Override with VITE_API_URL only when the API is on a different origin.
 */
export const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  return '/api'
}

const API_BASE_URL = getApiBaseUrl()

/**
 * WebSocket URL for Tradesea MDS / trades / practice account streams.
 * Dev and production both use the page origin (Vite or Nginx proxy WS → backend).
 */
export const getWebSocketUrl = (path: string = ''): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (import.meta.env.VITE_WS_URL) {
    const base = String(import.meta.env.VITE_WS_URL).replace(/\/$/, '')
    return `${base}${normalizedPath}`
  }

  const { hostname, port, protocol } = window.location
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'

  // Vite dev: plain HTTP uses direct WS to the API server; HTTPS uses same-origin WSS via Vite proxy
  if (import.meta.env.DEV && (port === '3000' || port === '5173')) {
    if (protocol === 'https:') {
      return `${wsProtocol}//${hostname}:${port}${normalizedPath}`
    }
    const backendPort = import.meta.env.VITE_API_PORT || '3001'
    return `ws://${hostname}:${backendPort}${normalizedPath}`
  }

  const portSuffix =
    port && port !== '80' && port !== '443' ? `:${port}` : ''
  return `${wsProtocol}//${hostname}${portSuffix}${normalizedPath}`
}

export const getApiPort = (): string => {
  const configuredPort = import.meta.env.VITE_API_PORT
  if (configuredPort) return configuredPort

  try {
    const url = new URL(API_BASE_URL)
    return url.port || (url.protocol === 'https:' ? '443' : '80')
  } catch {
    // Relative `/api` uses the Vite proxy in development and the current origin in production.
    const match = API_BASE_URL.match(/:(\d+)/)
    if (match) return match[1]
    if (import.meta.env.DEV) return '3001'
    return window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
  }
}

/**
 * Axios instance with default configuration
 */
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Get authentication token from localStorage
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem('token')
}

/**
 * Create authorization headers
 */
export const getAuthHeaders = () => {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Add request interceptor to include auth token in all requests
 */
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

export default api

