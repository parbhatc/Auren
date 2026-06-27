import { Component } from 'react'
import { Save } from 'lucide-react'
import { getThemeColors } from '../../constants/theme'
import Modal from '../common/Modal'
import ErrorMessage from '../common/ErrorMessage'
import { ResetSessionModalProps, ResetSessionModalState } from '../../types/backtester'
import { t } from '../../utils/translator'

class ResetSessionModal extends Component<ResetSessionModalProps, ResetSessionModalState> {
  constructor(props: ResetSessionModalProps) {
    super(props)
    this.state = {
      name: '',
      startDate: '',
      startTime: '',
      balance: 50000,
    }
  }

  componentDidUpdate(prevProps: ResetSessionModalProps) {
    if (this.props.isOpen && !prevProps.isOpen && this.props.session) {
      const session = this.props.session
      this.setState({
        name: session.name,
        startDate: session.startDate,
        startTime: session.startTime || '',
        balance: (session as any).initialBalance || 50000,
      })
    }
  }

  handleSubmit = () => {
    if (!this.props.session) return

    const updatedSession: any = {
      ...this.props.session,
      name: this.state.name.trim(),
      startDate: this.state.startDate,
      startTime: this.state.startTime,
      results: undefined,
      resetBalance: true,
      initialBalance: this.state.balance,
    }

    this.props.onReset(updatedSession)
  }

  render() {
    const { isOpen, isDark, onClose, error } = this.props
    const { name, startDate, startTime, balance } = this.state
    const colors = getThemeColors(isDark)

    if (!this.props.session) return null

    return (
      <Modal
        isOpen={isOpen}
        title={t('backtester.resetSession', {}, 'Reset Session')}
        onClose={onClose}
        size="md"
        isDark={isDark}
      >
        <div className="space-y-4">
          {error && <ErrorMessage message={error} isDark={isDark} />}

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {t('backtester.sessionName', {}, 'Session Name')} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => this.setState({ name: e.target.value })}
              className={`w-full px-4 py-2 rounded-lg border ${
                isDark
                  ? 'bg-slate-900 border-slate-600 text-slate-100'
                  : 'bg-slate-50 border-slate-300 text-slate-900'
              } focus:outline-none focus:ring-2 ${colors.focus.ring}`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {t('backtester.startDate', {}, 'Start Date')} *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => this.setState({ startDate: e.target.value })}
              className={`w-full px-4 py-2 rounded-lg border ${
                isDark
                  ? 'bg-slate-900 border-slate-600 text-slate-100'
                  : 'bg-slate-50 border-slate-300 text-slate-900'
              } focus:outline-none focus:ring-2 ${colors.focus.ring}`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {t('backtester.startTime', {}, 'Start Time')} *
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => this.setState({ startTime: e.target.value })}
              className={`w-full px-4 py-2 rounded-lg border ${
                isDark
                  ? 'bg-slate-900 border-slate-600 text-slate-100'
                  : 'bg-slate-50 border-slate-300 text-slate-900'
              } focus:outline-none focus:ring-2 ${colors.focus.ring}`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {t('backtester.balance', {}, 'Balance')} *
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              value={balance}
              onChange={(e) => this.setState({ balance: parseFloat(e.target.value) || 50000 })}
              className={`w-full px-4 py-2 rounded-lg border ${
                isDark
                  ? 'bg-slate-900 border-slate-600 text-slate-100'
                  : 'bg-slate-50 border-slate-300 text-slate-900'
              } focus:outline-none focus:ring-2 ${colors.focus.ring}`}
            />
          </div>

          <div className="flex items-center gap-4 pt-4">
            <button
              onClick={this.handleSubmit}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${colors.button.primary}`}
            >
              <Save className="w-4 h-4" />
              {t('backtester.reset', {}, 'Reset')}
            </button>
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg transition-all ${
                isDark
                  ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </Modal>
    )
  }
}

export default ResetSessionModal

