import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../../hooks/useTheme'
import { ROUTES } from '../../../constants/routes'
import { authAPI } from '../../../api/auth.api'
import { backtesterAPI } from '../../../api/backtester.api'
import { getThemeColors } from '../../../constants/theme'
import {
  fieldLabelClass,
  ghostButtonClass,
  primaryButtonClass,
  settingsInputClass,
} from '../../../styles/aurenTheme'
import { t } from '../../../utils/translator'
import Loading from '../../common/Loading'
import ErrorMessage from '../../common/ErrorMessage'
import BacktesterSessionsList from './BacktesterSessionsList'
import ResetSessionModal from '../ResetSessionModal'
import Modal from '../../common/Modal'
import { BacktestSession, NewSessionData } from '../../../types/backtester'
import { DEFAULT_BACKTESTER_SYMBOL } from '../../../backtester/constants'
import { UserData } from '../../../types/user'

/**
 * Replay sessions — standalone `/backtester` or embedded on hub `/?mode=replay`.
 */
const BacktesterSessionsListWrapper = ({
  embedded = false,
  isDark: isDarkProp,
}: {
  embedded?: boolean
  isDark?: boolean
}) => {
  const { isDark: themeDark, toggleTheme } = useTheme()
  const isDark = embedded && isDarkProp !== undefined ? isDarkProp : themeDark
  const navigate = useNavigate()
  const colors = getThemeColors(isDark)
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<BacktestSession[]>([])
  const [showNewSessionForm, setShowNewSessionForm] = useState(false)
  const [availableSymbols, setAvailableSymbols] = useState<string[]>([])
  const [symbolsError, setSymbolsError] = useState<string>('')
  const [createError, setCreateError] = useState<string>('')
  const [newSession, setNewSession] = useState<NewSessionData>({
    name: '',
    date: '',
    startTime: '',
    balance: 50000,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          navigate(ROUTES.LOGIN)
          return
        }

        const userResponse = await authAPI.validateToken(token)
        setUser(userResponse.user)

        // Fetch available symbols
        try {
          const symbolsResponse = await backtesterAPI.getAvailableSymbols()
          setAvailableSymbols(symbolsResponse.symbols)
          if (symbolsResponse.count === 0) {
            setSymbolsError(t('backtester.noSymbolsAvailable'))
          }
        } catch (err: any) {
          setSymbolsError(t('backtester.failedToLoadSymbols'))
        }

        // Load sessions from database
        const sessionsResponse = await backtesterAPI.getSessions()
        if (sessionsResponse.success) {
          setSessions(sessionsResponse.sessions)
        }
      } catch (err: any) {
        if (err?.response?.status === 401) {
          localStorage.removeItem('token')
          navigate(ROUTES.LOGIN)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [navigate])

  const handleCreateSession = async () => {
    setCreateError('')

    // Validate fields
    if (!newSession.name || !newSession.name.trim()) {
      setCreateError(t('backtester.errors.nameRequired'))
      return
    }

    if (!newSession.date) {
      setCreateError(t('backtester.errors.dateRequired'))
      return
    }

    if (!newSession.startTime) {
      setCreateError(t('backtester.errors.startTimeRequired'))
      return
    }

    if (availableSymbols.length === 0) {
      setCreateError(t('backtester.errors.noSymbolsAvailable'))
      return
    }

    const session: any = {
      id: `session-${Date.now()}`,
      name: newSession.name.trim(),
      symbol: DEFAULT_BACKTESTER_SYMBOL,
      timeframe: '1m',
      startDate: newSession.date,
      startTime: newSession.startTime,
      initialBalance: newSession.balance || 50000,
      currentBalance: newSession.balance || 50000,
      createdAt: new Date().toISOString(),
    }

    try {
      await backtesterAPI.createSession(session)
      setSessions([...sessions, session])
      setShowNewSessionForm(false)
      setCreateError('')
      setNewSession({
        name: '',
        date: '',
        startTime: '',
        balance: 50000,
      })
    } catch (err: any) {
      setCreateError(t('backtester.errors.failedToCreateSession'))
    }
  }

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [resetSessionId, setResetSessionId] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [editSessionId, setEditSessionId] = useState<string | null>(null)
  const [editStartDate, setEditStartDate] = useState<string>('')
  const [editStartTime, setEditStartTime] = useState<string>('')
  const [editError, setEditError] = useState<string>('')

  const handleDeleteClick = (sessionId: string) => {
    setDeleteConfirmId(sessionId)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return
    
    try {
      await backtesterAPI.deleteSession(deleteConfirmId)
      setSessions(sessions.filter((s) => s.id !== deleteConfirmId))
      setDeleteConfirmId(null)
    } catch (err: any) {
      console.error('Failed to delete session:', err)
      setDeleteConfirmId(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteConfirmId(null)
  }

  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [pendingResetSession, setPendingResetSession] = useState<BacktestSession | null>(null)

  const handleResetClick = (sessionId: string) => {
    setResetSessionId(sessionId)
    setResetError(null)
  }

  const handleResetConfirm = (updatedSession: BacktestSession) => {
    // Close the reset modal and show confirmation dialog
    setResetSessionId(null)
    setPendingResetSession(updatedSession)
    setShowResetConfirm(true)
  }

  const handleResetFinalConfirm = async () => {
    if (!pendingResetSession) return

    try {
      await backtesterAPI.updateSession(pendingResetSession)
      setSessions(sessions.map((s) => (s.id === pendingResetSession.id ? pendingResetSession : s)))
      setResetSessionId(null)
      setResetError(null)
      setShowResetConfirm(false)
      setPendingResetSession(null)
    } catch (err: any) {
      console.error('Failed to reset session:', err)
      setResetError(err.response?.data?.message || err.message || 'Failed to reset session')
      setShowResetConfirm(false)
      setPendingResetSession(null)
    }
  }

  const handleResetFinalCancel = () => {
    setShowResetConfirm(false)
    setPendingResetSession(null)
  }

  const handleResetCancel = () => {
    setResetSessionId(null)
    setResetError(null)
  }

  const handleEditSession = (sessionId: string) => {
    const s = sessions.find((x) => x.id === sessionId) || null
    if (!s) return
    setEditSessionId(sessionId)
    setEditStartDate(s.startDate || '')
    setEditStartTime(s.startTime || '')
    setEditError('')
  }

  const handleEditCancel = () => {
    setEditSessionId(null)
    setEditStartDate('')
    setEditStartTime('')
    setEditError('')
  }

  const handleEditSave = async () => {
    if (!editSessionId) return
    const s = sessions.find((x) => x.id === editSessionId) || null
    if (!s) return

    if (!editStartDate) {
      setEditError(t('backtester.errors.dateRequired', {}, 'Date is required'))
      return
    }
    if (!editStartTime) {
      setEditError(t('backtester.errors.startTimeRequired', {}, 'Start time is required'))
      return
    }

    try {
      const updated: BacktestSession = {
        ...s,
        startDate: editStartDate,
        startTime: editStartTime,
      }
      // Only updating date/time (does NOT reset trades)
      await backtesterAPI.updateSession(updated)
      setSessions(sessions.map((x) => (x.id === updated.id ? updated : x)))
      handleEditCancel()
    } catch (err: any) {
      setEditError(err?.response?.data?.message || err?.message || 'Failed to update session')
    }
  }

  const handlePlaySession = (_sessionId: string) => {
    // This is called before navigation - can be used for any setup
  }

  if (loading || !user) {
    if (embedded) {
      return (
        <div className="flex justify-center py-16">
          <RefreshCw className={`w-8 h-8 animate-spin ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
        </div>
      )
    }
    return <Loading isDark={isDark} />
  }

  return (
    <>
      <BacktesterSessionsList
        embedded={embedded}
        isDark={isDark}
        toggleTheme={toggleTheme}
        navigate={navigate}
        colors={colors}
        showAdmin={Boolean(user.isAdmin)}
        sessions={sessions}
        showNewSessionForm={showNewSessionForm}
        availableSymbols={availableSymbols}
        symbolsError={symbolsError}
        createError={createError}
        newSession={newSession}
        onDeleteSession={handleDeleteClick}
        onResetSession={handleResetClick}
        onPlaySession={handlePlaySession}
        onEditSession={handleEditSession}
        onCreateClick={() => {
          if (availableSymbols.length === 0) {
            setSymbolsError(t('backtester.noSymbolsAvailable'))
            return
          }
          setShowNewSessionForm(true)
        }}
        onCloseNewSessionForm={() => {
          setShowNewSessionForm(false)
          setCreateError('')
        }}
        onSessionChange={(session) => {
          setNewSession(session)
          setCreateError('')
        }}
        onCreateSession={handleCreateSession}
        onSymbolsError={setSymbolsError}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmId !== null}
        title={t('backtester.deleteSession', {}, 'Delete Session')}
        onClose={handleDeleteCancel}
        size="md"
        isDark={isDark}
      >
        <div className="space-y-4">
          <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
            {t('backtester.deleteConfirm', {}, 'Are you sure you want to delete this session? This action cannot be undone.')}
          </p>
          <div className="flex items-center gap-4 pt-4">
            <button
              onClick={handleDeleteConfirm}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white`}
            >
              {t('common.delete')}
            </button>
            <button type="button" onClick={handleDeleteCancel} className={ghostButtonClass(isDark)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reset Session Modal */}
      <ResetSessionModal
        isOpen={resetSessionId !== null}
        isDark={isDark}
        session={resetSessionId ? sessions.find((s) => s.id === resetSessionId) || null : null}
        availableSymbols={availableSymbols}
        onClose={handleResetCancel}
        onReset={handleResetConfirm}
        error={resetError}
      />

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetConfirm}
        title={t('backtester.resetConfirmTitle', {}, 'Confirm Reset')}
        onClose={handleResetFinalCancel}
        size="md"
        isDark={isDark}
      >
        <div className="space-y-4">
          <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
            {t('backtester.resetConfirmMessage', {}, 'Are you sure you want to reset this session? All trades and results will be deleted. This action cannot be undone.')}
          </p>
          <div className="flex items-center gap-4 pt-4">
            <button
              onClick={handleResetFinalConfirm}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                isDark
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}
            >
              {t('backtester.reset', {}, 'Reset')}
            </button>
            <button
              onClick={handleResetFinalCancel}
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

      {/* Edit Session Date/Time Modal */}
      <Modal
        isOpen={editSessionId !== null}
        title={t('backtester.editSession', {}, 'Edit Session')}
        onClose={handleEditCancel}
        size="md"
        isDark={isDark}
      >
        <div className="space-y-4">
          <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
            {t('backtester.editSessionHint', {}, 'Edit the session start date and start time. This does not reset trades.')}
          </p>

          {editError && (
            <ErrorMessage message={editError} isDark={isDark} />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={fieldLabelClass(isDark)}>
                {t('backtester.startDate', {}, 'Start Date')}
              </label>
              <input
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                className={settingsInputClass(isDark)}
              />
            </div>
            <div>
              <label className={fieldLabelClass(isDark)}>
                {t('backtester.startTime', {}, 'Start Time')}
              </label>
              <input
                type="time"
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
                className={settingsInputClass(isDark)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={handleEditSave} className={`flex-1 ${primaryButtonClass()}`}>
              {t('common.save', {}, 'Save')}
            </button>
            <button type="button" onClick={handleEditCancel} className={`flex-1 ${ghostButtonClass(isDark)}`}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default BacktesterSessionsListWrapper

