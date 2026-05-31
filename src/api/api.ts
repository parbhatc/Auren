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
 * WebSocket URL for Tradesea MDS / trades streams.
 * Production: same host + port as the page (Nginx proxies /tradesea-*-ws → :3001).
 * Dev: backend on :3001 (WS paths are not under /api).
 */
export const getWebSocketUrl = (path: string = ''): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const { hostname, port, protocol } = window.location
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'

  if (import.meta.env.DEV) {
    return `${wsProtocol}//${hostname}:3001${normalizedPath}`
  }

  const portSuffix =
    port && port !== '80' && port !== '443' ? `:${port}` : ''
  return `${wsProtocol}//${hostname}${portSuffix}${normalizedPath}`
}

export const getApiPort = (): string => {
  try {
    const url = new URL(API_BASE_URL)
    return url.port || (url.protocol === 'https:' ? '443' : '80')
  } catch {
    // Fallback: try to extract port from string
    const match = API_BASE_URL.match(/:(\d+)/)
    return match ? match[1] : ''
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

