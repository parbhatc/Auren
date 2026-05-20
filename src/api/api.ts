import axios, { AxiosInstance } from 'axios'

/**
 * Get API base URL
 * Uses environment variable if set, otherwise infers from current location
 * For production, VITE_API_URL should always be set via environment variable
 */
export const getApiBaseUrl = (): string => {
  // Use environment variable if set (required for production)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }

  // In development mode (Vite dev server), use relative path which will be proxied
  // Vite proxy is configured in vite.config.ts to forward /api to http://localhost:3001
  if (import.meta.env.DEV) {
    return '/api'
  }

  // Infer API URL from current location for production
  // This works when frontend and API are on same domain
  const hostname = window.location.hostname
  const protocol = window.location.protocol
  const currentPort = window.location.port
  
  // If we have a port, try to infer API port (common pattern: frontend port + 1)
  // Otherwise, use standard ports (80 for http, 443 for https)
  let apiPort = currentPort
  
  // For development: if frontend is on 2000 or 3000, API is typically on 3001
  // For production: API is typically on same port or standard ports
  if (currentPort && (currentPort === '2000' || currentPort === '3000')) {
    apiPort = '3001'
  } else if (!currentPort) {
    // No port specified - use standard ports
    apiPort = protocol === 'https:' ? '443' : '80'
  }
  
  // Construct API URL
  // If port is standard (80/443), omit it from URL
  if (apiPort === '80' && protocol === ' http:') {
    return `${protocol}//${hostname}/api`
  } else if (apiPort === '443' && protocol === 'https:') {
    return `${protocol}//${hostname}/api`
  } else {
    return `${protocol}//${hostname}:${apiPort}/api`
  }
}

const API_BASE_URL = getApiBaseUrl()

/**
 * Extract port number from API base URL
 */
/**
 * Get WebSocket URL from API base URL
 * Converts http:// to ws:// and https:// to wss://
 * In development mode, ensures WebSocket connects to port 3001 (backend) instead of 3000 (frontend)
 */
export const getWebSocketUrl = (path: string = ''): string => {
  const apiUrl = getApiBaseUrl()
  
  // Handle relative paths (development mode with Vite proxy)
  if (apiUrl.startsWith('/')) {
    // In development, WebSocket needs absolute URL pointing to backend port 3001
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const hostname = window.location.hostname
    return `${protocol}//${hostname}:3001${path.startsWith('/') ? path : '/' + path}`
  }
  
  // Handle absolute URLs (production or when VITE_API_URL is set)
  const wsUrl = apiUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
  // Remove /api suffix if present, then add the path
  const baseUrl = wsUrl.replace(/\/api$/, '')
  return `${baseUrl}${path.startsWith('/') ? path : '/' + path}`
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

