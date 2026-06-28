import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTheme } from '../../../hooks/useTheme'
import { getThemeColors } from '../../../constants/theme'
import { ROUTES } from '../../../constants/routes'
import { authAPI } from '../../../api/auth.api'
import { backtesterAPI } from '../../../api/backtester.api'
import { toast } from 'react-toastify'
import BacktesterDataManagementRenderer from './BacktesterDataManagementRenderer'
import { UserData } from '../../../types/user'
import { BacktesterDataClient } from '../../../backtester/services/BacktesterDataClient'
import { SymbolData, CsvInventoryEntry } from '../../../types/backtesterDataManagement'
import type { HubTab } from '../../../types/practiceHub'
import { t } from '../../../utils/translator'
import {
  type CsvDataWsSource,
  resolveDataManagementTab,
} from './csvDataPrefs'
import { getSymbolTicker } from './symbolTickers'

const BacktesterDataManagementWrapper = () => {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
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
  const [activeTab, setActiveTab] = useState<'symbol-info' | 'csv-data'>(() =>
    resolveDataManagementTab(searchParams.get('tab'))
  )
  const [csvInventory, setCsvInventory] = useState<CsvInventoryEntry[]>([])
  const [loadingCsvInventory, setLoadingCsvInventory] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const wsClientRef = useRef<BacktesterDataClient | null>(null)
  const activeTabRef = useRef<'symbol-info' | 'csv-data'>('symbol-info')
  const initialTabSentRef = useRef<boolean>(false)
  const [tradingviewCurrentToken, setTradingviewCurrentToken] = useState<string>('')

  // Progress tracking state (only from WebSocket, not persisted)
  const [progressState, setProgressState] = useState<Record<string, {
    symbol: string
    source: CsvDataWsSource
    action: 'download' | 'update' | 'overwrite' | 'reset'
    progress: number
    message: string
    timestamp: number
  }>>({})

  useEffect(() => {
    setActiveTab(resolveDataManagementTab(searchParams.get('tab')))
  }, [searchParams])

  const handleTabChange = useCallback((tab: 'symbol-info' | 'csv-data') => {
    setActiveTab(tab)
    if (tab === 'csv-data') {
      setSearchParams({ tab: 'csv' }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }, [setSearchParams])

  const tvTokenSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleCsvTradingViewTokenChange = useCallback((token: string) => {
    setTradingviewCurrentToken(token)
    if (tvTokenSaveTimeoutRef.current) {
      clearTimeout(tvTokenSaveTimeoutRef.current)
    }
    tvTokenSaveTimeoutRef.current = setTimeout(() => {
      if (!wsClientRef.current) return
      wsClientRef.current.sendSaveToken(token, 'tradingview')
    }, 500)
  }, [])

  const handleCsvTradingViewTokenBlur = useCallback((token: string) => {
    if (tvTokenSaveTimeoutRef.current) {
      clearTimeout(tvTokenSaveTimeoutRef.current)
      tvTokenSaveTimeoutRef.current = null
    }
    if (!wsClientRef.current) return
    wsClientRef.current.sendSaveToken(token, 'tradingview')
  }, [])

  // Clean up stale progress entries periodically
  useEffect(() => {
    const cleanupStaleProgress = () => {
      setProgressState(prevState => {
        const now = Date.now()
        const oneMinute = 60 * 1000 // 1 minute - cleanup stale entries
        const cleaned: Record<string, {
          symbol: string
          source: CsvDataWsSource
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
          const tokens = data.data.tokens || {}
          if (tokens.tradingview) {
            const tv = String(tokens.tradingview).trim()
            setTradingviewCurrentToken(tv.length >= 8 ? tv : '')
          }

          setSymbols(data.data.symbols || {})
          setLoading(false)
        }
      },
      onSaveTokenResponse: () => {},
      onUserLoginResponse: () => {},
      onTabChangeResponse: () => {},
      onSearchResponse: () => {},
      onProgressResponse: (data) => {
        // Handle progress updates for download/update/overwrite/reset operations
        // Validate data structure
        if (!data || !data.action || !data.symbol || !data.source || data.progress === undefined) {
          console.error('[Backtester Data] Invalid progress data:', data)
          return
        }
        
        // Create unique key for this operation
        const clientSource: CsvDataWsSource =
          data.source === 'topstep' ? 'tradesea' : 'tradingview'
        const progressKey = `${clientSource}_${data.symbol}_${data.action}`
        
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
              source: clientSource,
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
    }
  }, [activeTab, wsConnected])

  const loadCsvInventory = async () => {
    try {
      setLoadingCsvInventory(true)
      const response = await backtesterAPI.getCsvInventory()
      if (response.success) {
        setCsvInventory(response.inventory || [])
      }
    } catch (err) {
      console.error('Error loading CSV inventory:', err)
      toast.error('Failed to load CSV inventory')
    } finally {
      setLoadingCsvInventory(false)
    }
  }

  useEffect(() => {
    if (!user?.isAdmin || activeTab !== 'csv-data') return
    loadCsvInventory()
  }, [user, activeTab])

  const normalizeCsvSymbol = (symbol: string) => symbol.replace(/^\//, '')

  const resolveCsvTicker = (storageSymbol: string, source: CsvDataWsSource) => {
    const pref = source === 'tradesea' ? 'tradesea' : 'tradingview'
    const ticker = getSymbolTicker(symbols[storageSymbol], pref)
    if (!ticker) {
      throw new Error(`No ${pref} ticker configured for ${storageSymbol}`)
    }
    return ticker
  }

  const runCsvDownload = async (symbol: string, source: CsvDataWsSource, resolution = '1') => {
    if (!wsClientRef.current) {
      toast.error('WebSocket not connected')
      return
    }

    const storageSymbol = normalizeCsvSymbol(symbol)
    const ticker = resolveCsvTicker(storageSymbol, source)

    return new Promise<void>((resolve) => {
      const client = wsClientRef.current as any
      const originalCallback = client.callbacks?.onDownloadResponse
      client.callbacks = client.callbacks || {}
      client.callbacks.onDownloadResponse = (data: any) => {
        client.callbacks.onDownloadResponse = originalCallback

        const progressKey = `${source}_${storageSymbol}_download`
        setProgressState((prevState) => {
          const newState = { ...prevState }
          delete newState[progressKey]
          return newState
        })

        if (data.success) {
          toast.success(data.message || `Download completed for ${storageSymbol}`)
          setTimeout(async () => {
            await loadCsvInventory()
          }, 500)
        } else {
          toast.error(data.error || 'Download failed')
        }

        resolve()
      }

      wsClientRef.current!.sendDownload(storageSymbol, source, ticker, resolution)
    })
  }

  const runCsvUpdate = async (symbol: string, source: CsvDataWsSource, resolution = '1') => {
    if (!wsClientRef.current) {
      toast.error('WebSocket not connected')
      return
    }

    const storageSymbol = normalizeCsvSymbol(symbol)
    const ticker = resolveCsvTicker(storageSymbol, source)

    return new Promise<void>((resolve) => {
      const client = wsClientRef.current as any
      const originalCallback = client.callbacks?.onUpdateResponse
      client.callbacks = client.callbacks || {}
      client.callbacks.onUpdateResponse = (data: any) => {
        client.callbacks.onUpdateResponse = originalCallback

        const progressKey = `${source}_${storageSymbol}_update`
        setProgressState((prevState) => {
          const newState = { ...prevState }
          delete newState[progressKey]
          return newState
        })

        if (data.success) {
          toast.success(data.message || `Update completed for ${storageSymbol}`)
          setTimeout(async () => {
            await loadCsvInventory()
          }, 500)
        } else {
          toast.error(data.error || 'Update failed')
        }

        resolve()
      }

      wsClientRef.current!.sendUpdate(storageSymbol, source, ticker, resolution)
    })
  }

  const runCsvOverwrite = async (symbol: string, source: CsvDataWsSource, resolution = '1') => {
    if (!wsClientRef.current) {
      toast.error('WebSocket not connected')
      return
    }

    const storageSymbol = normalizeCsvSymbol(symbol)
    const ticker = resolveCsvTicker(storageSymbol, source)

    return new Promise<void>((resolve) => {
      const client = wsClientRef.current as any
      const originalCallback = client.callbacks?.onOverwriteResponse
      client.callbacks = client.callbacks || {}
      client.callbacks.onOverwriteResponse = (data: any) => {
        client.callbacks.onOverwriteResponse = originalCallback

        const progressKey = `${source}_${storageSymbol}_overwrite`
        setProgressState((prevState) => {
          const newState = { ...prevState }
          delete newState[progressKey]
          return newState
        })

        if (data.success) {
          toast.success(data.message || `Overwrite completed for ${storageSymbol}`)
          setTimeout(async () => {
            await loadCsvInventory()
          }, 500)
        } else {
          toast.error(data.error || 'Overwrite failed')
        }

        resolve()
      }

      wsClientRef.current!.sendOverwrite(storageSymbol, source, ticker, resolution)
    })
  }

  const handleHubTabChange = (tab: HubTab) => {
    if (tab === 'accounts') {
      navigate('/')
    } else if (tab === 'settings') {
      navigate('/?tab=settings')
    } else if (tab === 'admin') {
      navigate('/?tab=admin&section=site')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate(ROUTES.LOGIN)
  }

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

  const handleEdit = (symbol: string) => {
    const symbolData = symbols[symbol]
    if (symbolData) {
      setEditingSymbol(symbol)
      setEditingData({
        symbol,
        tickSize: symbolData.tickSize,
        tickValue: symbolData.tickValue,
        exchangeFee: symbolData.exchangeFee,
        regulatoryFee: symbolData.regulatoryFee,
        commissionFee: symbolData.commissionFee,
        totalFees: symbolData.totalFees,
        description: symbolData.description,
        tickers: symbolData.tickers ? { ...symbolData.tickers } : {},
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
        tickers: editingData?.tickers ?? data.tickers,
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
      tickers: {},
    })
  }

  const handleUpdateEditingData = (
    field: keyof SymbolData | 'symbol' | 'tradeseaTicker' | 'tradingviewTicker',
    value: string | number
  ) => {
    if (!editingData) return

    if (field === 'tradeseaTicker' || field === 'tradingviewTicker') {
      const key = field === 'tradeseaTicker' ? 'tradesea' : 'tradingview'
      setEditingData({
        ...editingData,
        tickers: {
          ...editingData.tickers,
          [key]: String(value),
        },
      })
      return
    }

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
      onTabChange={handleTabChange}
      csvInventory={csvInventory}
      loadingCsvInventory={loadingCsvInventory}
      onCsvUpdate={runCsvUpdate}
      onCsvOverwrite={runCsvOverwrite}
      onCsvDownload={runCsvDownload}
      onCsvTradingViewTokenChange={handleCsvTradingViewTokenChange}
      onCsvTradingViewTokenBlur={handleCsvTradingViewTokenBlur}
      onHubTabChange={handleHubTabChange}
      onLogout={handleLogout}
      tradingviewCurrentToken={tradingviewCurrentToken}
      progressState={progressState}
    />
  )
}

export default BacktesterDataManagementWrapper
