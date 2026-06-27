import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../../hooks/useTheme'
import { getThemeColors } from '../../../constants/theme'
import { ROUTES } from '../../../constants/routes'
import { authAPI } from '../../../api/auth.api'
import { backtesterAPI } from '../../../api/backtester.api'
import { topstepxAPI } from '../../../api/topstepx.api'
import { toast } from 'react-toastify'
import BacktesterDataManagementRenderer from './BacktesterDataManagementRenderer'
import { UserData } from '../../../types/user'
import { BacktesterDataClient } from '../../../backtester/services/BacktesterDataClient'
import { SymbolData } from '../../../types/backtesterDataManagement'
import { t } from '../../../utils/translator'

const BacktesterDataManagementWrapper = () => {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const colors = getThemeColors(isDark)
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [symbols, setSymbols] = useState<Record<string, SymbolData>>({})
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<Partial<SymbolData & { symbol?: string }> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; symbol: string | null }>({
    isOpen: false,
    symbol: null,
  })
  const [activeTab, setActiveTab] = useState<'symbol-info' | 'topstep' | 'tradingview'>('symbol-info')
  const [topstepFiles, setTopstepFiles] = useState<any[]>([])
  const [tradingviewFiles, setTradingviewFiles] = useState<any[]>([])
  const [unknownFiles, setUnknownFiles] = useState<any[]>([])
  const [loadingFiles, setLoadingFiles] = useState(true) // Start as true, will be set to false when WebSocket sends initial data
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set())
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set())
  const [wsConnected, setWsConnected] = useState(false)
  const wsClientRef = useRef<BacktesterDataClient | null>(null)
  const activeTabRef = useRef<'symbol-info' | 'topstep' | 'tradingview'>('symbol-info')
  const initialTabSentRef = useRef<boolean>(false)
  const [topstepSearch, setTopstepSearch] = useState<string>('')
  const [tradingviewSearch, setTradingviewSearch] = useState<string>('')
  const [topstepSearchResults, setTopstepSearchResults] = useState<any[]>([])
  const [tradingviewSearchResults, setTradingviewSearchResults] = useState<any[]>([])
  const [topstepSearchError, setTopstepSearchError] = useState<string>('')
  const [tradingviewSearchError, setTradingviewSearchError] = useState<string>('')
  const [topstepSearchLoading, setTopstepSearchLoading] = useState<boolean>(false)
  const [tradingviewSearchLoading, setTradingviewSearchLoading] = useState<boolean>(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Token selection for topstep and tradingview
  const [topstepCurrentToken, setTopstepCurrentToken] = useState<string>('')
  const [tradingviewCurrentToken, setTradingviewCurrentToken] = useState<string>('')
  const [savedTokens, setSavedTokens] = useState<{ topstep?: string; tradingview?: string }>({})
  
  // Symbol info dialog state
  const [selectedSymbol, setSelectedSymbol] = useState<{ 
    symbol: string
    type: 'topstep' | 'tradingview'
    topstepData?: any
    tradingViewData?: any
  } | null>(null)

  // Progress tracking state (only from WebSocket, not persisted)
  const [progressState, setProgressState] = useState<Record<string, {
    symbol: string
    source: 'topstep' | 'tradingview'
    action: 'download' | 'update' | 'overwrite' | 'reset'
    progress: number
    message: string
    timestamp: number
  }>>({})

  // Clean up stale progress entries periodically
  useEffect(() => {
    const cleanupStaleProgress = () => {
      setProgressState(prevState => {
        const now = Date.now()
        const oneMinute = 60 * 1000 // 1 minute - cleanup stale entries
        const cleaned: Record<string, {
          symbol: string
          source: 'topstep' | 'tradingview'
          action: 'download' | 'update' | 'overwrite' | 'reset'
          progress: number
          message: string
          timestamp: number
        }> = {}
        
        for (const [key, value] of Object.entries(prevState)) {
          const age = now - value.timestamp
          // Keep only active progress that's less than 1 minute old
          if (value.progress < 100 && age < oneMinute) {
            cleaned[key] = value
          }
        }
        
        return cleaned
      })
    }

    // Clean up periodically (every 30 seconds)
    const cleanupInterval = setInterval(cleanupStaleProgress, 30000)
    
    return () => clearInterval(cleanupInterval)
  }, [])

  // Clear all progress when WebSocket disconnects
  useEffect(() => {
    if (!wsConnected) {
      setProgressState({})
    }
  }, [wsConnected])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem('token')
        if (!token) {
          navigate(ROUTES.LOGIN)
          return
        }

        const userResponse = await authAPI.validateToken(token)
        setUser(userResponse.user)

        if (!userResponse.user.isAdmin) {
          setError(t('backtesterDataManagement.adminRequired'))
          return
        }

        // Initial data will be loaded via WebSocket on connection
      } catch (err: any) {
        console.error('Error fetching data:', err)
        if (err?.response?.status === 401) {
          localStorage.removeItem('token')
          navigate(ROUTES.LOGIN)
        } else if (err?.response?.status === 403) {
          setError(t('backtesterDataManagement.adminRequired'))
        } else {
          const errorMessage = err.response?.data?.message || 'Failed to load data'
          setError(errorMessage)
          toast.error(errorMessage)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [navigate])

  // Initialize WebSocket connection when user is loaded and is admin
  useEffect(() => {
    if (!user || !user.isAdmin) {
      return
    }

    // Initialize WebSocket client
    const wsClient = new BacktesterDataClient({
      onConnected: () => {
        setWsConnected(true)
        // Send initial tab change with current active tab when connection is established
        setTimeout(() => {
          if (wsClient && activeTabRef.current && !initialTabSentRef.current) {
            wsClient.sendTabChange(activeTabRef.current)
            initialTabSentRef.current = true
          }
        }, 100) // Small delay to ensure connection is fully ready
      },
      onDisconnected: () => {
        setWsConnected(false)
        // Reset flag when disconnected so we send initial tab again on reconnect
        initialTabSentRef.current = false
      },
      onMessage: () => {
        // Handle messages if needed
      },
      onError: () => {
        setWsConnected(false)
      },
      onInitialData: (data) => {
        if (data.success && data.data) {
          // Set tokens
          const tokens = data.data.tokens || {}
          setSavedTokens(tokens)
          // Initialize current tokens with saved tokens if available
          if (tokens.topstep) {
            setTopstepCurrentToken(tokens.topstep)
          }
          if (tokens.tradingview) {
            setTradingviewCurrentToken(tokens.tradingview)
          }

          // Set symbols
          setSymbols(data.data.symbols || {})

          // Set CSV files
          if (data.data.csvFiles) {
            setTopstepFiles(data.data.csvFiles.topstep || [])
            setTradingviewFiles(data.data.csvFiles.tradingview || [])
            setUnknownFiles(data.data.csvFiles.unknown || [])
            // Note: unknown files are available in data.data.csvFiles.unknown but not used in UI yet
            setLoadingFiles(false)
          }
          
          // Set loading to false once initial data is received
          setLoading(false)
        }
      },
      onSaveTokenResponse: () => {
        // This is handled by the promise resolver in onSaveToken callbacks
        // The callback is temporarily replaced, then restored
      },
      onUserLoginResponse: () => {
        // This will be handled by the promise resolver in onUserLogin callback
      },
      onTabChangeResponse: () => {
        // Handle tab change response if needed
      },
      onSearchResponse: (data) => {
        const currentTab = activeTabRef.current
        if (data.success && data.results) {
          // Update results based on current tab when response arrives
          if (currentTab === 'topstep') {
            setTopstepSearchResults(data.results || [])
            setTopstepSearchError('') // Clear any previous errors
            setTopstepSearchLoading(false) // Search completed
          } else if (currentTab === 'tradingview') {
            setTradingviewSearchResults(data.results || [])
            setTradingviewSearchError('') // Clear any previous errors
            setTradingviewSearchLoading(false) // Search completed
          }
        } else {
          // Clear results and set error if search failed
          if (currentTab === 'topstep') {
            setTopstepSearchResults([])
            setTopstepSearchError(data.error || 'Search failed. Please try again.')
            setTopstepSearchLoading(false) // Search completed (with error)
          } else if (currentTab === 'tradingview') {
            setTradingviewSearchResults([])
            setTradingviewSearchError(data.error || 'Search failed. Please try again.')
            setTradingviewSearchLoading(false) // Search completed (with error)
          }
        }
      },
      onProgressResponse: (data) => {
        // Handle progress updates for download/update/overwrite/reset operations
        // Validate data structure
        if (!data || !data.action || !data.symbol || !data.source || data.progress === undefined) {
          console.error('[Backtester Data] Invalid progress data:', data)
          return
        }
        
        // Create unique key for this operation
        const progressKey = `${data.source}_${data.symbol}_${data.action}`
        
        // Check if this is a completion message
        const isCompleted = data.completed === true || 
                            (data.message || '').toLowerCase().includes('complete') ||
                            (data.message || '').toLowerCase().includes('completed')
        
        // If completed, clear immediately instead of updating
        // Note: The actual success message with bar counts comes from update_response/download_response/etc
        // This progress message is just for clearing the UI state
        if (isCompleted) {
          setProgressState(prev => {
            const newState = { ...prev }
            delete newState[progressKey]
            return newState
          })
          return
        }
        
        // Update progress state
        setProgressState(prev => {
          const updated = {
            ...prev,
            [progressKey]: {
              symbol: data.symbol,
              source: data.source,
              action: data.action,
              progress: data.progress,
              message: data.message || '',
              timestamp: Date.now(),
              completed: data.completed || false
            }
          }
          
          // Remove completed operations (progress >= 100) after 2 seconds
          if (data.progress >= 100) {
            setTimeout(() => {
              setProgressState(prevState => {
                const newState = { ...prevState }
                delete newState[progressKey]
                return newState
              })
            }, 2000)
          }
          
          return updated
        })
      }
    })

    wsClientRef.current = wsClient
    
    // Connect on window.onload for backtester-data management WebSocket
    const connectOnLoad = () => {
      if (wsClientRef.current) {
        wsClientRef.current.connect()
      }
    }

    // Check if window has already loaded
    if (document.readyState === 'complete') {
      // Window already loaded, connect immediately
      connectOnLoad()
    } else {
      // Wait for window.onload
      window.addEventListener('load', connectOnLoad, { once: true })
    }

    // Cleanup on unmount
    return () => {
      window.removeEventListener('load', connectOnLoad)
      if (wsClientRef.current) {
        wsClientRef.current.disconnect()
        wsClientRef.current = null
      }
    }
  }, [user])

  // Update activeTabRef when activeTab changes
  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  // Send tab change when activeTab changes and WebSocket is connected
  // Skip initial send since it's handled in onConnected callback
  useEffect(() => {
    if (wsClientRef.current && wsConnected && activeTab && initialTabSentRef.current) {
      wsClientRef.current.sendTabChange(activeTab)
      // Clear search results and errors when switching tabs
      setTopstepSearchResults([])
      setTradingviewSearchResults([])
      setTopstepSearchError('')
      setTradingviewSearchError('')
      setTopstepSearchLoading(false)
      setTradingviewSearchLoading(false)
    }
  }, [activeTab, wsConnected])

  // Handle search for Topstep tab
  useEffect(() => {
    if (!wsClientRef.current || !wsConnected || activeTab !== 'topstep') {
      return
    }

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Clear results and errors if search is empty
    if (!topstepSearch.trim()) {
      setTopstepSearchResults([])
      setTopstepSearchError('')
      setTopstepSearchLoading(false)
      return
    }

    // Debounce search - wait 300ms after user stops typing
    searchTimeoutRef.current = setTimeout(() => {
      if (wsClientRef.current && wsConnected && topstepSearch.trim()) {
        // Use current token, fallback to saved token or login token
        const token = topstepCurrentToken.trim() || savedTokens.topstep || (localStorage.getItem('token') || '')
        
        setTopstepSearchLoading(true) // Start loading
        setTopstepSearchError('') // Clear previous errors
        wsClientRef.current.sendSearch(topstepSearch.trim(), token)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [topstepSearch, topstepCurrentToken, savedTokens.topstep, wsConnected, activeTab])

  // Handle search for TradingView tab
  useEffect(() => {
    if (!wsClientRef.current || !wsConnected || activeTab !== 'tradingview') {
      return
    }

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Clear results and errors if search is empty
    if (!tradingviewSearch.trim()) {
      setTradingviewSearchResults([])
      setTradingviewSearchError('')
      setTradingviewSearchLoading(false)
      return
    }

    // Debounce search - wait 300ms after user stops typing
    searchTimeoutRef.current = setTimeout(() => {
      if (wsClientRef.current && wsConnected && tradingviewSearch.trim()) {
        // TradingView search doesn't require a token - don't send one
        setTradingviewSearchLoading(true) // Start loading
        setTradingviewSearchError('') // Clear previous errors
        wsClientRef.current.sendSearch(tradingviewSearch.trim())
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [tradingviewSearch, tradingviewCurrentToken, savedTokens.tradingview, wsConnected, activeTab])

  const loadSymbols = async () => {
    try {
      const response = await backtesterAPI.getSymbolsConfig()
      if (response.success) {
        setSymbols(response.symbols || {})
      }
    } catch (err: any) {
      console.error('Error loading symbols:', err)
      toast.error('Failed to load symbols')
    }
  }

  const loadCSVFiles = async () => {
    try {
      setLoadingFiles(true)
      const [topstepResponse, tradingviewResponse, unknownResponse] = await Promise.all([
        backtesterAPI.getCSVFilesByType('topstep'),
        backtesterAPI.getCSVFilesByType('tradingview'),
        backtesterAPI.getUnknownFiles(),
      ])

      if (topstepResponse.success) {
        setTopstepFiles(topstepResponse.files || [])
      }
      if (tradingviewResponse.success) {
        setTradingviewFiles(tradingviewResponse.files || [])
      }
      if (unknownResponse.success) {
        setUnknownFiles(unknownResponse.files || [])
      }
    } catch (err: any) {
      console.error('Error loading CSV files:', err)
      toast.error('Failed to load CSV files')
    } finally {
      setLoadingFiles(false)
    }
  }

  const handleEdit = (symbol: string) => {
    const symbolData = symbols[symbol]
    if (symbolData) {
      setEditingSymbol(symbol)
      // Initialize with all current values from the symbol
      setEditingData({
        tickSize: symbolData.tickSize,
        tickValue: symbolData.tickValue,
        exchangeFee: symbolData.exchangeFee,
        regulatoryFee: symbolData.regulatoryFee,
        commissionFee: symbolData.commissionFee,
        totalFees: symbolData.totalFees,
        description: symbolData.description,
        type: symbolData.type || 'topstep',
      })
    }
  }

  const handleCancelEdit = () => {
    setEditingSymbol(null)
    setEditingData(null)
    setError('')
    setSuccess('')
  }

  const handleSave = async (symbol: string, data: SymbolData) => {
    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const isNew = editingSymbol === 'NEW'
      const symbolToSave = isNew ? (editingData?.symbol as string || symbol) : editingSymbol!

      if (!symbolToSave) {
        throw new Error('Symbol name is required')
      }

      const response = await backtesterAPI.saveSymbolConfig({
        symbol: symbolToSave,
        tickSize: data.tickSize,
        tickValue: data.tickValue,
        exchangeFee: data.exchangeFee,
        regulatoryFee: data.regulatoryFee,
        commissionFee: data.commissionFee,
        totalFees: data.totalFees,
        description: data.description,
        type: data.type || 'topstep',
      })

      if (response.success) {
        setSuccess(response.message)
        toast.success(response.message)
        await loadSymbols()
        handleCancelEdit()
      } else {
        throw new Error(response.message || 'Failed to save symbol')
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to save symbol'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = (symbol: string) => {
    setDeleteConfirm({ isOpen: true, symbol })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.symbol) return

    try {
      setError('')
      setSuccess('')

      const response = await backtesterAPI.deleteSymbolConfig(deleteConfirm.symbol)

      if (response.success) {
        setSuccess(response.message)
        toast.success(response.message)
        await loadSymbols()
      } else {
        throw new Error(response.message || 'Failed to delete symbol')
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to delete symbol'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setDeleteConfirm({ isOpen: false, symbol: null })
    }
  }

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, symbol: null })
  }

  const handleAdd = () => {
    setEditingSymbol('NEW')
    setEditingData({
      symbol: '',
      tickSize: 0,
      tickValue: 0,
      exchangeFee: 0,
      regulatoryFee: 0,
      commissionFee: 0,
      totalFees: 0,
      description: '',
      type: 'topstep',
    })
  }

  const handleUpdateEditingData = (field: keyof SymbolData | 'symbol', value: string | number) => {
    if (!editingData) return

    setEditingData({
      ...editingData,
      [field]: value,
    })
  }

  return (
    <BacktesterDataManagementRenderer
      isDark={isDark}
      toggleTheme={toggleTheme}
      user={user}
      colors={colors}
      navigate={navigate}
      symbols={symbols}
      loading={loading}
      error={error}
      success={success}
      editingSymbol={editingSymbol}
      editingData={editingData}
      onEdit={handleEdit}
      onCancelEdit={handleCancelEdit}
      onSave={handleSave}
      onDelete={handleDeleteClick}
      onAdd={handleAdd}
      deleteConfirm={deleteConfirm}
      onDeleteConfirm={handleDeleteConfirm}
      onDeleteCancel={handleDeleteCancel}
      onUpdateEditingData={handleUpdateEditingData}
      saving={saving}
      activeTab={activeTab}
      onTabChange={(tab) => {
        setActiveTab(tab)
        // Tab change message will be sent automatically via useEffect when activeTab changes
      }}
      topstepFiles={topstepFiles}
      tradingviewFiles={tradingviewFiles}
      unknownFiles={unknownFiles}
      loadingFiles={loadingFiles}
      expandedSymbols={expandedSymbols}
      expandedYears={expandedYears}
      onToggleSymbol={(symbol) => {
        const newSet = new Set(expandedSymbols)
        if (newSet.has(symbol)) {
          newSet.delete(symbol)
        } else {
          newSet.add(symbol)
        }
        setExpandedSymbols(newSet)
      }}
      onToggleYear={(yearKey) => {
        const newSet = new Set(expandedYears)
        if (newSet.has(yearKey)) {
          newSet.delete(yearKey)
        } else {
          newSet.add(yearKey)
        }
        setExpandedYears(newSet)
      }}
      topstepSearch={topstepSearch}
      tradingviewSearch={tradingviewSearch}
      topstepSearchResults={topstepSearchResults}
      tradingviewSearchResults={tradingviewSearchResults}
      topstepSearchError={topstepSearchError}
      tradingviewSearchError={tradingviewSearchError}
      topstepSearchLoading={topstepSearchLoading}
      tradingviewSearchLoading={tradingviewSearchLoading}
      onTopstepSearchChange={setTopstepSearch}
      onTradingviewSearchChange={setTradingviewSearch}
      topstepCurrentToken={topstepCurrentToken}
      tradingviewCurrentToken={tradingviewCurrentToken}
      topstepSavedToken={savedTokens.topstep}
      tradingviewSavedToken={savedTokens.tradingview}
      onTopstepCurrentTokenChange={setTopstepCurrentToken}
      onTradingviewCurrentTokenChange={setTradingviewCurrentToken}
      onTopstepTokenObtained={async (token) => {
        setTopstepCurrentToken(token)
        setSavedTokens(prev => ({ ...prev, topstep: token }))
      }}
      onTradingviewTokenObtained={async (token) => {
        setTradingviewCurrentToken(token)
        setSavedTokens(prev => ({ ...prev, tradingview: token }))
      }}
      onTopstepSaveToken={async (token, source) => {
        return new Promise((resolve) => {
          if (!wsClientRef.current) {
            resolve({ success: false, error: 'WebSocket not connected' })
            return
          }

          // Set up one-time listener for the response
          const client = wsClientRef.current as any
          const originalCallback = client.callbacks?.onSaveTokenResponse
          client.callbacks = client.callbacks || {}
          client.callbacks.onSaveTokenResponse = (data: any) => {
            // Restore original callback
            client.callbacks.onSaveTokenResponse = originalCallback
            
            if (data.success) {
              // Update saved tokens in state
              setSavedTokens(prev => ({
                ...prev,
                topstep: token
              }))
            }
            
            resolve({
              success: data.success || false,
              message: data.message,
              error: data.error
            })
          }

          // Send save token message
          wsClientRef.current.sendSaveToken(token, source)
        })
      }}
      onTradingviewSaveToken={async (token, source) => {
        return new Promise((resolve) => {
          if (!wsClientRef.current) {
            resolve({ success: false, error: 'WebSocket not connected' })
            return
          }

          // Set up one-time listener for the response
          const client = wsClientRef.current as any
          const originalCallback = client.callbacks?.onSaveTokenResponse
          client.callbacks = client.callbacks || {}
          client.callbacks.onSaveTokenResponse = (data: any) => {
            // Restore original callback
            client.callbacks.onSaveTokenResponse = originalCallback
            
            if (data.success) {
              // Update saved tokens in state
              setSavedTokens(prev => ({
                ...prev,
                tradingview: token
              }))
            }
            
            resolve({
              success: data.success || false,
              message: data.message,
              error: data.error
            })
          }

          // Send save token message
          wsClientRef.current.sendSaveToken(token, source)
        })
      }}
      onTopstepUserLogin={async (username, password) => {
        try {
          // Use TopStep API directly instead of WebSocket
          const result = await topstepxAPI.login(username, password)
          
          if (result.result === 0 && result.token) {
            return {
              success: true,
              token: result.token,
              error: undefined
            }
          } else {
            let errorMessage = 'Login failed'
            if (result.result === 1) {
              errorMessage = 'Wrong username'
            } else if (result.result === 2) {
              errorMessage = 'Invalid password'
            }
            return {
              success: false,
              token: undefined,
              error: errorMessage
            }
          }
        } catch (error: any) {
          return {
            success: false,
            token: undefined,
            error: error.message || 'Failed to connect to TopStep API'
          }
        }
      }}
      onTradingviewUserLogin={async (username, password, source) => {
        return new Promise((resolve) => {
          if (!wsClientRef.current) {
            resolve({ success: false, error: 'WebSocket not connected' })
            return
          }

          // Set up one-time listener for the response
          const client = wsClientRef.current as any
          const originalCallback = client.callbacks?.onUserLoginResponse
          client.callbacks = client.callbacks || {}
          client.callbacks.onUserLoginResponse = (data: any) => {
            // Restore original callback
            client.callbacks.onUserLoginResponse = originalCallback
            resolve({
              success: data.success || false,
              token: data.token,
              error: data.error
            })
          }

          // Send login message
          wsClientRef.current.sendUserLogin(username, password, source)
        })
      }}
      selectedSymbol={selectedSymbol}
      onSymbolClick={(symbol, type) => {
        // Find the full result data from search results
        let tradingViewData = null
        let topstepData = null
        
        if (type === 'tradingview') {
          const result = tradingviewSearchResults.find((r: any) => {
            if (typeof r === 'object' && r !== null) {
              const formattedSymbol = r.formattedSymbol || r.symbol
              return formattedSymbol === symbol || r.symbol === symbol || r.full_name === symbol
            }
            return String(r) === symbol
          })
          if (result && typeof result === 'object') {
            tradingViewData = result
          }
        } else if (type === 'topstep') {
          const result = topstepSearchResults.find((r: any) => {
            if (typeof r === 'object' && r !== null) {
              return r.symbol === symbol || r.full_name === symbol || String(r) === symbol
            }
            return String(r) === symbol
          })
          if (result && typeof result === 'object') {
            topstepData = result
          }
        }
        setSelectedSymbol({ symbol, type, tradingViewData, topstepData })
      }}
      onSymbolDialogClose={() => {
        setSelectedSymbol(null)
      }}
      onSymbolUpdate={async (symbol) => {
        return new Promise<void>((resolve) => {
          if (!wsClientRef.current) {
            toast.error('WebSocket not connected')
            resolve()
            return
          }

          const currentType = selectedSymbol?.type || 'topstep'
          // Normalize symbol for Topstep (remove leading slash)
          const normalizedSymbol = currentType === 'topstep' && symbol.startsWith('/') 
            ? symbol.slice(1) 
            : symbol
          
          // Set up one-time listener for the response
          const client = wsClientRef.current as any
          const originalCallback = client.callbacks?.onUpdateResponse
          client.callbacks = client.callbacks || {}
          client.callbacks.onUpdateResponse = (data: any) => {
            // Restore original callback
            client.callbacks.onUpdateResponse = originalCallback

            // Clear progress when update completes
            const progressKey = `${currentType}_${normalizedSymbol}_update`
            setProgressState(prevState => {
              const newState = { ...prevState }
              delete newState[progressKey]
              return newState
            })
            
            if (data.success) {
              toast.success(data.message || `Update completed for ${normalizedSymbol}`)
              
              // Reload CSV files to update UI
              // Add a small delay to ensure files are written to disk, then reload
              setTimeout(async () => {
                await loadCSVFiles()
                // Force dialog to re-render by updating selectedSymbol
                if (selectedSymbol && selectedSymbol.symbol === symbol && selectedSymbol.type === currentType) {
                  setSelectedSymbol({ ...selectedSymbol })
                }
              }, 500)
            } else {
              toast.error(data.error || 'Update failed')
            }
            
            resolve()
          }

          // Send update message with normalized symbol
          wsClientRef.current.sendUpdate(normalizedSymbol, currentType)
        })
      }}
      onSymbolOverwrite={async (symbol) => {
        return new Promise<void>((resolve) => {
          if (!wsClientRef.current) {
            toast.error('WebSocket not connected')
            resolve()
            return
          }

          const currentType = selectedSymbol?.type || 'topstep'
          // Normalize symbol for Topstep (remove leading slash)
          const normalizedSymbol = currentType === 'topstep' && symbol.startsWith('/') 
            ? symbol.slice(1) 
            : symbol
          
          // Set up one-time listener for the response
          const client = wsClientRef.current as any
          const originalCallback = client.callbacks?.onOverwriteResponse
          client.callbacks = client.callbacks || {}
          client.callbacks.onOverwriteResponse = (data: any) => {
            // Restore original callback
            client.callbacks.onOverwriteResponse = originalCallback

            // Clear progress when overwrite completes
            const progressKey = `${currentType}_${normalizedSymbol}_overwrite`
            setProgressState(prevState => {
              const newState = { ...prevState }
              delete newState[progressKey]
              return newState
            })
            
            if (data.success) {
              toast.success(data.message || `Overwrite completed for ${normalizedSymbol}`)
              
              // Reload CSV files to update UI
              // Add a small delay to ensure files are written to disk, then reload
              setTimeout(async () => {
                await loadCSVFiles()
                // Force dialog to re-render by updating selectedSymbol
                if (selectedSymbol && selectedSymbol.symbol === symbol && selectedSymbol.type === currentType) {
                  setSelectedSymbol({ ...selectedSymbol })
                }
              }, 500)
            } else {
              toast.error(data.error || 'Overwrite failed')
            }
            
            resolve()
          }

          // Send overwrite message with normalized symbol
          wsClientRef.current.sendOverwrite(normalizedSymbol, currentType)
        })
      }}
      onSymbolReset={async (symbol) => {
        return new Promise((resolve) => {
          if (!wsClientRef.current) {
            toast.error('WebSocket not connected')
            resolve()
            return
          }

          const currentType = selectedSymbol?.type || 'topstep'
          // Normalize symbol for Topstep (remove leading slash)
          const normalizedSymbol = currentType === 'topstep' && symbol.startsWith('/') 
            ? symbol.slice(1) 
            : symbol
          
          // Set up one-time listener for the response
          const client = wsClientRef.current as any
          const originalCallback = client.callbacks?.onResetResponse
          client.callbacks = client.callbacks || {}
          client.callbacks.onResetResponse = (data: any) => {
            // Restore original callback
            client.callbacks.onResetResponse = originalCallback

            // Clear progress when reset completes
            const progressKey = `${currentType}_${normalizedSymbol}_reset`
            setProgressState(prevState => {
              const newState = { ...prevState }
              delete newState[progressKey]
              return newState
            })
            
            if (data.success) {
              toast.success(data.message || `Reset completed for ${normalizedSymbol}`)
              
              // Reload CSV files to update UI
              // Add a small delay to ensure files are written to disk, then reload
              setTimeout(async () => {
                await loadCSVFiles()
                // Force dialog to re-render by updating selectedSymbol
                if (selectedSymbol && selectedSymbol.symbol === symbol && selectedSymbol.type === currentType) {
                  setSelectedSymbol({ ...selectedSymbol })
                }
              }, 500)
            } else {
              toast.error(data.error || 'Reset failed')
            }
            
            resolve()
          }

          // Send reset message with normalized symbol
          wsClientRef.current.sendReset(normalizedSymbol, currentType)
        })
      }}
      onSymbolDownload={async (symbol, type) => {
        return new Promise<void>((resolve) => {
          if (!wsClientRef.current) {
            toast.error('WebSocket not connected')
            resolve()
            return
          }

          // Normalize symbol for Topstep (remove leading slash)
          const normalizedSymbol = type === 'topstep' && symbol.startsWith('/') 
            ? symbol.slice(1) 
            : symbol

          // Set up one-time listener for the response
          const client = wsClientRef.current as any
          const originalCallback = client.callbacks?.onDownloadResponse
          client.callbacks = client.callbacks || {}
          client.callbacks.onDownloadResponse = (data: any) => {
            // Restore original callback
            client.callbacks.onDownloadResponse = originalCallback

            // Update progress to 100% and then clear after a short delay
            const progressKey = `${type}_${normalizedSymbol}_download`
            if (data.success) {
              // Clear immediately on success
              setProgressState(prevState => {
                const newState = { ...prevState }
                delete newState[progressKey]
                return newState
              })
              
              // Show success message with bar count
              toast.success(data.message || `Successfully downloaded data for ${normalizedSymbol}`)
              
              // Reload CSV files to update UI (show files, hide download button)
              // Add a small delay to ensure files are written to disk, then reload
              setTimeout(async () => {
                await loadCSVFiles()
                // Force dialog to re-render by updating selectedSymbol
                if (selectedSymbol && selectedSymbol.symbol === symbol && selectedSymbol.type === type) {
                  setSelectedSymbol({ ...selectedSymbol })
                }
              }, 500)
            } else {
              // Clear immediately on failure
              setProgressState(prevState => {
                const newState = { ...prevState }
                delete newState[progressKey]
                return newState
              })
              toast.error(data.error || 'Download failed')
            }

            resolve()
          }

          // Send download message with normalized symbol
          wsClientRef.current.sendDownload(normalizedSymbol, type)
        })
      }}
      progressState={progressState}
    />
  )
}

export default BacktesterDataManagementWrapper
