import { LogOut, ChevronDown } from 'lucide-react'
import { createRef, Component } from 'react'
import Logo from '../../common/Logo'
import ThemeToggle from '../../common/ThemeToggle'
import { ROUTES } from '../../../constants/routes'
import { StatsHeaderProps } from '../../../types/common'
import { getAccountColorClasses, FormattedAccount } from '../../../utils/marketAccountDisplay'

class StatsHeader extends Component<StatsHeaderProps> {
  private accountDropdownRef = createRef<HTMLDivElement>()

  componentDidMount() {
    if (this.props.showAccountDropdown) {
      document.addEventListener('mousedown', this.handleClickOutside)
    }
  }

  componentWillUnmount() {
    if (this.props.showAccountDropdown) {
      document.removeEventListener('mousedown', this.handleClickOutside)
    }
  }

  handleClickOutside = (event: MouseEvent) => {
    if (
      this.accountDropdownRef.current &&
      !this.accountDropdownRef.current.contains(event.target as Node)
    ) {
      // This will be handled by parent component state
    }
  }

  render() {
    const {
      isDark,
      showNav,
      showAccountDropdown,
      showAccountDropdownProp,
      selectedAccount,
      accounts,
      navigate,
      toggleTheme,
      onShowNav,
      onAccountChange,
      onToggleAccountDropdown
    } = this.props
    
    // Check if accounts are FormattedAccount objects or strings
    const formattedAccounts = (accounts as any[]).length > 0 && typeof (accounts as any[])[0] === 'object' && 'accountId' in (accounts as any[])[0]
      ? (accounts as unknown as FormattedAccount[])
      : accounts.map((acc: string) => ({ displayName: acc, account: null } as any))

    return (
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
                  onClick={onShowNav}
                  className={`p-2 rounded-lg transition-all flex items-center lg:fixed lg:left-4 lg:z-50 ${
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
              <div className="flex items-center justify-start">
                <Logo isDark={isDark} compact={true} onClick={() => navigate(ROUTES.PRACTICE)} />
              </div>
              
              {/* Account Dropdown - Only show if enabled */}
              {showAccountDropdownProp && (
                <div className="relative" ref={this.accountDropdownRef}>
                  <button
                    onClick={onToggleAccountDropdown}
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
                            onClick={() => onAccountChange(displayName)}
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

            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => {
                  localStorage.removeItem('token')
                  navigate(ROUTES.LOGIN)
                }}
                className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all text-xs sm:text-sm ${
                  isDark
                    ? 'bg-red-950/50 text-red-300 hover:bg-red-950/70 border border-red-800/50'
                    : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                }`}
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
              <ThemeToggle isDark={isDark} onToggle={toggleTheme} fixed={false} />
            </div>
          </div>
        </div>
      </header>
    )
  }
}

export default StatsHeader
