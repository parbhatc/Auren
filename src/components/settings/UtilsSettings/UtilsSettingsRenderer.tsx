import { Component } from 'react'
import { Clock, Globe, ChevronDown } from 'lucide-react'
import { UtilsSettingsProps } from '../../../types'
import SettingsPageLayout from '../../layout/SettingsPageLayout'
import { panelCardClass, selectInputClass, settingsInsetClass } from '../../../styles/aurenTheme'
import { t } from '../../../utils/translator'
import { SUPPORTED_TRADINGVIEW_TIMEZONES } from '../../common/BaseChart'

/**
 * Utils Settings renderer component
 * Allows users to configure timezone and other utility settings
 */
class UtilsSettingsRenderer extends Component<UtilsSettingsProps> {
  timeUpdateInterval: NodeJS.Timeout | null = null

  state = {
    currentTime: new Date(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }

  componentDidMount() {
    const savedTimezone = localStorage.getItem('user_timezone')
    if (savedTimezone) {
      const timezone = savedTimezone === 'UTC' ? 'Etc/UTC' : savedTimezone

      if (SUPPORTED_TRADINGVIEW_TIMEZONES.includes(timezone as (typeof SUPPORTED_TRADINGVIEW_TIMEZONES)[number])) {
        this.setState({ timezone })
        if (timezone !== savedTimezone) {
          localStorage.setItem('user_timezone', timezone)
        }
      } else {
        const defaultTimezone = 'Etc/UTC'
        this.setState({ timezone: defaultTimezone })
        localStorage.setItem('user_timezone', defaultTimezone)
      }
    }

    this.timeUpdateInterval = setInterval(() => {
      this.setState({ currentTime: new Date() })
    }, 1000)
  }

  componentWillUnmount() {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval)
    }
  }

  handleTimezoneChange = (timezone: string) => {
    this.setState({ timezone })
    localStorage.setItem('user_timezone', timezone)
  }

  formatTime = (date: Date, timezone: string) => {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date)
  }

  formatDate = (date: Date, timezone: string) => {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
  }

  formatTimezoneLabel(timezone: string): string {
    const customLabels: Record<string, string> = {
      'Etc/UTC': 'UTC',
      'America/New_York': 'Eastern Time (ET)',
      'America/Chicago': 'Central Time (CT)',
      'America/Denver': 'Mountain Time (MT)',
      'America/Los_Angeles': 'Pacific Time (PT)',
      'America/Phoenix': 'Arizona Time (MST)',
      'America/Anchorage': 'Alaska Time (AKT)',
      'Pacific/Honolulu': 'Hawaii Time (HST)',
      'Europe/London': 'London (GMT/BST)',
      'Europe/Paris': 'Paris (CET/CEST)',
      'Europe/Berlin': 'Berlin (CET/CEST)',
      'Asia/Tokyo': 'Tokyo (JST)',
      'Asia/Shanghai': 'Shanghai (CST)',
      'Asia/Hong_Kong': 'Hong Kong (HKT)',
      'Asia/Dubai': 'Dubai (GST)',
      'Asia/Kolkata': 'Mumbai/New Delhi (IST)',
      'Australia/Sydney': 'Sydney (AEDT/AEST)',
      'Australia/Melbourne': 'Melbourne (AEDT/AEST)',
      'America/Toronto': 'Toronto (ET)',
      'America/Vancouver': 'Vancouver (PT)',
      'America/Sao_Paulo': 'São Paulo (BRT)',
      'America/Mexico_City': 'Mexico City (CST)',
    }

    if (customLabels[timezone]) {
      return customLabels[timezone]
    }

    const parts = timezone.split('/')
    if (parts.length === 2) {
      const region = parts[0].replace(/_/g, ' ')
      const city = parts[1].replace(/_/g, ' ')
      return `${city} (${region})`
    }

    return timezone.replace(/_/g, ' ')
  }

  getTimezones = () => {
    return SUPPORTED_TRADINGVIEW_TIMEZONES.map((tz) => ({
      value: tz,
      label: this.formatTimezoneLabel(tz),
    }))
  }

  render() {
    const { isDark, toggleTheme, navigate, embedded, onBack } = this.props
    const { currentTime, timezone } = this.state

    const textClass = isDark ? 'text-white' : 'text-slate-900'
    const textSecondaryClass = isDark ? 'text-slate-400' : 'text-slate-600'
    const selectClass = selectInputClass(isDark)
    const iconAccent = isDark ? 'text-violet-400' : 'text-violet-600'
    const card = panelCardClass(isDark)
    const inset = settingsInsetClass(isDark)

    return (
      <SettingsPageLayout
        isDark={isDark}
        toggleTheme={toggleTheme}
        navigate={navigate}
        title={t('practice.hub.settings.utilsTitle')}
        subtitle={embedded ? t('practice.hub.settings.utilsEmbeddedDesc') : t('practice.hub.settings.utilsEmbeddedDesc')}
        icon={Globe}
        embedded={embedded}
        onBack={onBack}
      >
        <div className={card}>
          <div className="space-y-4">
            <div className={inset}>
              <div className="flex items-center gap-2 mb-2">
                <Clock className={`w-4 h-4 ${iconAccent}`} />
                <span className={`text-sm font-medium ${textClass}`}>{t('practice.hub.settings.currentTime')}</span>
              </div>
              <div className={`text-2xl sm:text-3xl font-bold tabular-nums ${iconAccent}`}>
                {this.formatTime(currentTime, timezone)}
              </div>
              <div className={`text-sm mt-1 ${textSecondaryClass}`}>
                {this.formatDate(currentTime, timezone)}
              </div>
              <div className={`text-xs mt-1 font-mono ${textSecondaryClass}`}>{timezone}</div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {t('practice.hub.settings.timezoneSelect')}
              </label>
              <div className="relative">
                <select
                  value={timezone}
                  onChange={(e) => this.handleTimezoneChange(e.target.value)}
                  className={`${selectClass} appearance-none pr-10`}
                >
                  {this.getTimezones().map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
                <div
                  className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
              <p className={`text-xs mt-2 ${textSecondaryClass}`}>
                {t('practice.hub.settings.timezoneDesc')}
              </p>
            </div>
          </div>
        </div>
      </SettingsPageLayout>
    )
  }
}

export default UtilsSettingsRenderer

