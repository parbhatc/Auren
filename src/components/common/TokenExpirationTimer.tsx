import { Component } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'
import { TokenExpirationTimerProps, TokenExpirationTimerState } from '../../types/common'

class TokenExpirationTimer extends Component<TokenExpirationTimerProps, TokenExpirationTimerState> {
  private intervalId?: NodeJS.Timeout

  state: TokenExpirationTimerState = {
    timeRemaining: null,
    isExpired: false
  }

  componentDidMount() {
    this.updateTimeRemaining()
    // Update every second
    this.intervalId = setInterval(() => {
      this.updateTimeRemaining()
    }, 1000)
  }

  componentDidUpdate(prevProps: TokenExpirationTimerProps) {
    if (prevProps.expirationTimestamp !== this.props.expirationTimestamp) {
      this.updateTimeRemaining()
    }
  }

  componentWillUnmount() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
  }

  updateTimeRemaining = () => {
    const { expirationTimestamp } = this.props
    
    if (!expirationTimestamp) {
      this.setState({ timeRemaining: null, isExpired: false })
      return
    }

    const now = Date.now()
    const remaining = expirationTimestamp - now

    if (remaining <= 0) {
      this.setState({ timeRemaining: 0, isExpired: true })
    } else {
      this.setState({ timeRemaining: remaining, isExpired: false })
    }
  }

  formatTimeRemaining = (ms: number): string => {
    if (ms <= 0) {
      return 'Expired'
    }

    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }

  render() {
    const { isDark } = this.props
    const { timeRemaining, isExpired } = this.state

    // Don't render if no expiration timestamp
    if (timeRemaining === null) {
      return null
    }

    const isExpiringSoon = timeRemaining !== null && timeRemaining < 5 * 60 * 1000 // Less than 5 minutes
    const isWarning = isExpiringSoon && !isExpired

    return (
      <div className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border transition-all ${
        isExpired
          ? isDark
            ? 'bg-red-950/50 border-red-800/50'
            : 'bg-red-50 border-red-200'
          : isWarning
          ? isDark
            ? 'bg-yellow-950/50 border-yellow-800/50'
            : 'bg-yellow-50 border-yellow-200'
          : isDark
          ? 'bg-slate-800/50 border-slate-700'
          : 'bg-white/50 border-slate-200'
      }`}>
        {isExpired || isWarning ? (
          <AlertTriangle className={`w-3 h-3 sm:w-4 sm:h-4 ${
            isExpired
              ? 'text-red-500'
              : 'text-yellow-500'
          }`} />
        ) : (
          <Clock className={`w-3 h-3 sm:w-4 sm:h-4 ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`} />
        )}
        <div className="flex flex-col">
          <div className={`text-[9px] sm:text-[10px] md:text-xs ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Token Expires
          </div>
          <div className={`text-xs sm:text-sm md:text-base font-bold ${
            isExpired
              ? 'text-red-500'
              : isWarning
              ? 'text-yellow-500'
              : isDark
              ? 'text-white'
              : 'text-slate-900'
          }`}>
            {this.formatTimeRemaining(timeRemaining || 0)}
          </div>
        </div>
      </div>
    )
  }
}

export default TokenExpirationTimer

