import { useEffect, useState, createRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LogOut, Play, Pause, SkipForward, RotateCcw, ChevronDown, Save } from 'lucide-react'
import { useTheme } from '../../../hooks/useTheme'
import { ROUTES } from '../../../constants/routes'
import { authAPI } from '../../../api/auth.api'
import Loading from '../../common/Loading'
import Logo from '../../common/Logo'
import ThemeToggle from '../../common/ThemeToggle'
import TradingNav from '../../common/TradingNav'
import AccountInfoBar from '../../common/AccountInfoBar'
import ContractQuantityControl from '../../common/ContractQuantityControl'
import TradeButtons from '../../common/TradeButtons'
import PositionButtons from '../../common/PositionButtons'
import EconomicNewsPanel from '../../common/EconomicNewsPanel'
import { getSavedLayout, saveLayout, resetLayout, LayoutType as StorageLayoutType } from '../../../utils/tradingLayoutStorage'
import { getAccountColorClasses, FormattedAccount } from '../../../utils/topstepxAccounts'
import { propFirmRegistry } from '../../../services/propfirms'
import { TradingLayout, DEFAULT_LAYOUT } from '../../../types/tradingLayout'
import InlineLayoutEditor from './InlineLayoutEditor'

const EditLayoutPage = () => {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showNav, setShowNav] = useState(() => {
    const saved = localStorage.getItem('trading_show_nav')
    return saved === 'true'
  })
  const [session, setSession] = useState<any>(null)
  const [contractQuantity, setContractQuantity] = useState<number | string>(1)
  const [showNews, setShowNews] = useState(() => {
    const path = window.location.pathname
    const key = path.includes('/backtester') ? 'backtester_show_news' : 'trading_show_news'
    const saved = localStorage.getItem(key)
    return saved !== 'false'
  })
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [playbackTimeframe, setPlaybackTimeframe] = useState('5')
  const [showPlaybackTimeframeDropdown, setShowPlaybackTimeframeDropdown] = useState(false)
  const [showPreviousBarSelector, setShowPreviousBarSelector] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState('Account 1')
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const accountDropdownRef = createRef<HTMLDivElement>()
  
  // Determine if this is backtester or trading layout
  // Check URL params first, then pathname
  const layoutParam = searchParams.get('layout')
  const path = window.location.pathname
  // If accessed from /settings/layout, check URL param, otherwise check pathname
  const isBacktester = false
  const layoutCategory: StorageLayoutType = 'trading'
  
  // Set default layout param if accessing from /settings/layout
  useEffect(() => {
    if (path.includes('/settings/layout') && !layoutParam) {
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.set('layout', 'trading')
      navigate(`${path}?${newSearchParams.toString()}`, { replace: true })
    }
  }, [path, layoutParam, searchParams, navigate])
  
  const [layout, setLayout] = useState<TradingLayout>(() => {
    return getSavedLayout(layoutCategory)
  })
  const [showSuccess, setShowSuccess] = useState(false)
  const playbackTimeframeDropdownRef = createRef<HTMLDivElement>()

  // Handle clicks outside playback timeframe dropdown - MUST be before any conditional returns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        playbackTimeframeDropdownRef.current &&
        !playbackTimeframeDropdownRef.current.contains(event.target as Node)
      ) {
        setShowPlaybackTimeframeDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [playbackTimeframeDropdownRef])

  // Get accounts for trading layout
  const getAccounts = (): FormattedAccount[] => {
    for (const firm of propFirmRegistry) {
      const firmAny = firm as any
      if (firmAny.formattedAccounts && Array.isArray(firmAny.formattedAccounts) && firmAny.formattedAccounts.length > 0) {
        return firmAny.formattedAccounts
      }
    }
    return [{ 
      accountId: 0,
      displayName: 'Account 1',
      account: null,
      templateName: '',
      accountName: 'Account 1',
      isIneligible: false,
      isCombine: false,
      isExpress: false
    }]
  }

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          navigate(ROUTES.LOGIN)
          return
        }

        const response = await authAPI.validateToken(token)
        setUser(response.user)
      } catch (error) {
        localStorage.removeItem('token')
        navigate(ROUTES.LOGIN)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()

    // Determine layout category from URL
  }, [navigate, searchParams])

  // Handle clicks outside account dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
        setShowAccountDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const formatTimeframeForDisplay = (timeframe: string): string => {
    const minutes = parseInt(timeframe)
    if (isNaN(minutes)) return timeframe
    
    if (minutes < 60) {
      return `${minutes}m`
    } else if (minutes === 60) {
      return '1h'
    } else {
      const hours = minutes / 60
      return `${hours}h`
    }
  }


  const handleLayoutChange = (newLayout: TradingLayout) => {
    setLayout(newLayout)
    // Auto-save on layout change
    saveLayout(newLayout, layoutCategory)
  }

  const handleSaveLayout = () => {
    saveLayout(layout, layoutCategory)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 2000)
  }

  const handleResetLayout = () => {
    const defaultLayout = DEFAULT_LAYOUT
    setLayout(defaultLayout)
    resetLayout(layoutCategory)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 2000)
  }

  if (loading || !user) {
    return <Loading isDark={isDark} />
  }

  // For backtester, require session
  if (isBacktester && !session) {
    return (
      <div
        className={`min-h-screen transition-all duration-700 ease-in-out ${
          isDark
            ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
            : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
        }`}
      >
        <header
          className={`border-b ${
            isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white/80'
          } backdrop-blur-sm sticky top-0 z-50`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14 sm:h-16">
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <Logo isDark={isDark} compact={true} onClick={() => navigate(ROUTES.PRACTICE)} />
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
                <button
                  onClick={() => navigate(ROUTES.PRACTICE)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all text-xs sm:text-sm ${
                    isDark
                      ? 'bg-slate-800/50 text-slate-300 hover:bg-slate-800/70 border border-slate-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                  }`}
                >
                  Back
                </button>
                <ThemeToggle isDark={isDark} onToggle={toggleTheme} fixed={false} />
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div
            className={`rounded-2xl shadow-2xl border p-12 text-center ${
              isDark
                ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
                : 'bg-white/90 border-slate-200 backdrop-blur-sm'
            }`}
          >
            <p className={`text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Session not found
            </p>
          </div>
        </main>
      </div>
    )
  }

  // Mock values for preview
  const mockBalance = 50000
  const mockRpl = 0
  const mockUpl = 0
  const mockMll = isBacktester ? undefined : 45000

  // Get accounts for trading
  const accounts = isBacktester ? [] : getAccounts()
  const formattedAccounts: FormattedAccount[] = accounts.length > 0 && typeof accounts[0] === 'object' && 'accountId' in accounts[0]
    ? (accounts as FormattedAccount[])
    : accounts.map((acc: string | any) => ({ 
        accountId: typeof acc === 'string' ? 0 : (acc.accountId || 0),
        displayName: typeof acc === 'string' ? acc : (acc.displayName || acc),
        account: typeof acc === 'string' ? null : (acc.account || null),
        templateName: '',
        accountName: typeof acc === 'string' ? acc : (acc.accountName || ''),
        isIneligible: false,
        isCombine: false,
        isExpress: false
      }))

  // Chart element - placeholder for edit layout
  const chartElement = (
    <div
      className={`rounded-lg sm:rounded-xl shadow-lg border overflow-hidden ${
        isDark
          ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
          : 'bg-white/90 border-slate-200 backdrop-blur-sm'
      }`}
      style={{
        width: '100%',
        height: 'calc(100vh - 250px)',
        minHeight: '600px',
      }}
    >
      <div className="flex items-center justify-center h-full">
        <div className={`text-center ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <div className="text-lg font-semibold mb-2">Chart Preview</div>
          <div className="text-sm opacity-75">Chart will be displayed here</div>
        </div>
      </div>
    </div>
  )

  // Helper functions for playback controls
  const handleReplay = () => {
    setShowPreviousBarSelector(!showPreviousBarSelector)
  }

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleNextCandle = () => {
    // Mock next candle action
  }

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed)
  }

  const parseTimeframeFromDisplay = (display: string): string => {
    if (display.endsWith('m')) {
      return display.slice(0, -1)
    } else if (display.endsWith('h')) {
      const hours = parseInt(display.slice(0, -1))
      return (hours * 60).toString()
    }
    return display
  }

  const handlePlaybackTimeframeChange = (tf: string) => {
    const internalFormat = parseTimeframeFromDisplay(tf)
    setPlaybackTimeframe(internalFormat)
    setShowPlaybackTimeframeDropdown(false)
  }

  const handleQuantityChange = (delta: number) => {
    const current = Number(contractQuantity) || 1
    const newQuantity = Math.max(1, current + delta)
    setContractQuantity(newQuantity)
  }

  const handleQuantityUpdate = (quantity: number | string) => {
    setContractQuantity(quantity)
  }

  const handleQuantityInputChange = (value: string) => {
    setContractQuantity(value)
  }

  const handleQuantityBlur = () => {
    const num = Number(contractQuantity)
    if (isNaN(num) || num < 1) {
      setContractQuantity(1)
    } else {
      setContractQuantity(num)
    }
  }

  // Panel element - different for backtester vs trading
  const panelElement = (    <div className="relative" style={{ minHeight: '100%' }}>
      {/* Trade Section - Same structure as BacktesterChartView */}
      <div
        className={`rounded-lg sm:rounded-xl shadow-lg border flex flex-col lg:h-full relative z-10 ${
          isDark
            ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
            : 'bg-white/90 border-slate-200 backdrop-blur-sm'
        }`}
      >
        <div className={`p-3 sm:p-4 border-b flex-shrink-0 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <h3 className={`text-sm sm:text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Trade
          </h3>
        </div>
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 flex-shrink-0">
          <ContractQuantityControl
            quantity={contractQuantity}
            onQuantityChange={handleQuantityChange}
            onQuantityUpdate={handleQuantityUpdate}
            onQuantityInputChange={handleQuantityInputChange}
            onQuantityBlur={handleQuantityBlur}
            isDark={isDark}
          />

          <TradeButtons
            onBuy={() => {
              const qty = Number(contractQuantity) || 1
              console.log('Buy', { quantity: qty })
            }}
            onSell={() => {
              const qty = Number(contractQuantity) || 1
              console.log('Sell', { quantity: qty })
            }}
            isDark={isDark}
          />

          <PositionButtons
            onClose={() => console.log('Close Position')}
            onReverse={() => console.log('Reverse Position')}
            onFlatten={() => console.log('Flatten All Position')}
            isDark={isDark}
          />
        </div>
        
        {/* News Section (Under Trade) */}
        <div className={`flex-shrink-0 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'} lg:flex-1 lg:flex lg:flex-col lg:min-h-0`}>
          {showNews ? (
            <div className={`p-3 sm:p-4 flex flex-col h-full lg:min-h-0`}>
              <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <h3 className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Economic News
                </h3>
                <button
                  onClick={() => {
                    setShowNews(false)
                    localStorage.setItem('trading_show_news', 'false')
                  }}
                  className={`text-xs px-2 py-1 rounded ${
                    isDark
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  Hide
                </button>
              </div>
              <div className="flex-1 overflow-y-auto lg:min-h-0">
                <EconomicNewsPanel isDark={isDark} />
              </div>
            </div>
          ) : (
            <div className={`p-3 sm:p-4`}>
              <button
                onClick={() => {
                  setShowNews(true)
                  localStorage.setItem('trading_show_news', 'true')
                }}
                className={`w-full text-xs px-3 py-2 rounded-lg ${
                  isDark
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Show Economic News
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div
      className={`min-h-screen transition-all duration-700 ease-in-out flex ${
        isDark
          ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
          : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
      }`}
    >
      {/* Navigation Sidebar - Desktop */}
      <div className={`hidden lg:block transition-all duration-300 ease-in-out ${
        showNav ? 'w-16 opacity-100' : 'w-0 opacity-0 overflow-hidden'
      }`}>
        {showNav && (
          <TradingNav
            isDark={isDark}
            navigate={navigate}
            currentPath={window.location.pathname}
            onToggleNav={() => {
              setShowNav(false)
              localStorage.setItem('trading_show_nav', 'false')
            }}
            preserveQueryParams={true}
            showDesktopNav={true}
            showMobileNav={false}
          />
        )}
      </div>
      
      {/* Mobile Bottom Nav */}
      <div className={`lg:hidden fixed bottom-0 left-0 right-0 transition-all duration-300 ease-in-out transform z-50 ${
        showNav ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
      }`}>
        {showNav && (
          <TradingNav
            isDark={isDark}
            navigate={navigate}
            currentPath={window.location.pathname}
            onToggleNav={() => {
              setShowNav(false)
              localStorage.setItem('trading_show_nav', 'false')
            }}
            preserveQueryParams={true}
            showDesktopNav={false}
            showMobileNav={true}
          />
        )}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header
          className={`border-b ${
            isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white/80'
          } backdrop-blur-sm sticky top-0 z-50`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14 sm:h-16">
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                {!showNav && (
                  <button
                    onClick={() => {
                      setShowNav(true)
                      localStorage.setItem('trading_show_nav', 'true')
                    }}
                    className={`lg:fixed lg:left-4 lg:z-50 p-2 rounded-lg transition-all flex items-center ${
                      isDark
                        ? 'hover:bg-slate-800 text-slate-300'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                    style={{ top: '1rem' }}
                    title="Show Navigation"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                )}
                <div className="flex items-center justify-start gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 min-w-0">
                  <Logo isDark={isDark} compact={true} onClick={() => navigate(ROUTES.PRACTICE)} />
                  {isBacktester && session && !path.includes('/settings/layout') && (
                    <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg border ${
                      isDark
                        ? 'bg-slate-800/50 border-slate-700 text-slate-200'
                        : 'bg-slate-100/50 border-slate-300 text-slate-700'
                    }`}>
                      <span className="text-xs sm:text-sm font-medium whitespace-nowrap">
                        Session: <span className="font-semibold">{session.name}</span>
                      </span>
                      {session.symbol && (
                        <span className="text-xs opacity-75 sm:ml-2">
                          {session.symbol} • {session.timeframe}
                        </span>
                      )}
                    </div>
                  )}
                  {!isBacktester && (
                    <div className="relative" ref={accountDropdownRef}>
                      <button
                        onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                        className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg border transition-all text-xs sm:text-sm ${
                          isDark
                            ? 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800'
                            : 'bg-white/80 border-slate-300 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <span className="hidden sm:inline">
                          {formattedAccounts.find(a => a.displayName === selectedAccount)?.displayName || selectedAccount}
                        </span>
                        <span className="sm:hidden">Acc</span>
                        <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${showAccountDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {showAccountDropdown && (
                        <div
                          className={`absolute top-full left-0 mt-1 min-w-[150px] rounded-lg border shadow-lg ${
                            isDark
                              ? 'bg-slate-800 border-slate-700'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          {formattedAccounts.map((formattedAccount) => {
                            const account = formattedAccount.account
                            const displayName = formattedAccount.displayName
                            const isSelected = selectedAccount === displayName
                            const colorClasses = account 
                              ? getAccountColorClasses(account, isDark, isSelected)
                              : (isSelected
                                  ? isDark
                                    ? 'bg-slate-700 text-white'
                                    : 'bg-slate-100 text-slate-900'
                                  : isDark
                                  ? 'text-slate-300 hover:bg-slate-700'
                                  : 'text-slate-700 hover:bg-slate-50')
                            
                            return (
                              <button
                                key={formattedAccount.accountId || displayName}
                                onClick={() => {
                                  setSelectedAccount(displayName)
                                  setShowAccountDropdown(false)
                                }}
                                className={`w-full text-left px-3 py-2 text-xs sm:text-sm transition-colors ${colorClasses}`}
                              >
                                {displayName}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
                <button
                  onClick={() => {
                    localStorage.removeItem('token')
                    navigate(ROUTES.LOGIN)
                  }}
                  className={`flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg transition-all text-xs sm:text-sm ${
                    isDark
                      ? 'bg-red-950/50 text-red-300 hover:bg-red-950/70 border border-red-800/50'
                      : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                  }`}
                  aria-label="Logout"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4 sm:w-4 sm:h-4" />
                  <span className="hidden md:inline">Logout</span>
                </button>
                <ThemeToggle isDark={isDark} onToggle={toggleTheme} fixed={false} />
              </div>
            </div>
          </div>
        </header>

        {/* Layout Controls Bar - Below Header */}
        {path.includes('/settings/layout') && (
          <div className={`border-b ${isDark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-white/50'} backdrop-blur-sm sticky top-14 sm:top-16 z-40`}>
            <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-2 sm:py-3">
              <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
                {/* Layout Category Tabs */}
                {/* Save and Reset Buttons */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={handleSaveLayout}
                    className={`flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg transition-all text-xs sm:text-sm ${
                      isDark
                        ? 'bg-green-900/50 text-green-300 hover:bg-green-900/70 border border-green-700'
                        : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-300'
                    }`}
                    aria-label="Save Layout"
                    title="Save Layout"
                  >
                    <Save className="w-4 h-4" />
                    <span className="hidden sm:inline">Save Layout</span>
                  </button>
                  <button
                    onClick={handleResetLayout}
                    className={`flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg transition-all text-xs sm:text-sm ${
                      isDark
                        ? 'bg-slate-800/50 text-slate-300 hover:bg-slate-800/70 border border-slate-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                    }`}
                    aria-label="Reset Layout"
                    title="Reset Layout"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span className="hidden sm:inline">Reset Layout</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 pb-20 lg:pb-4">
          <AccountInfoBar
            balance={mockBalance}
            mll={mockMll}
            rpl={mockRpl}
            upl={mockUpl}
            isDark={isDark}
          />

          {/* Chart and Panel Layout - Drag and Drop with renderLayout responsiveness */}
          <div className="mb-3 sm:mb-4 lg:h-full">
            <InlineLayoutEditor
              isDark={isDark}
              currentLayout={layout}
              layoutCategory={layoutCategory}
              onLayoutChange={handleLayoutChange}
              onReset={handleResetLayout}
              chartComponent={chartElement}
              panelComponent={panelElement}
            />
          </div>
          
          {/* Success Message */}
          {showSuccess && (
            <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5">
              <div className={`rounded-lg shadow-lg border px-4 py-3 ${
                isDark
                  ? 'bg-green-900/90 border-green-700 text-green-100'
                  : 'bg-green-50 border-green-200 text-green-800'
              }`}>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium">Layout saved successfully!</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default EditLayoutPage
