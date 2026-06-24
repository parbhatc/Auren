import { Component } from 'react'
import { Users, Edit, Trash2, Shield, AlertCircle, Save, Plus, Search, ChevronDown } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { t } from '../../../utils/translator'
import { UserManagerProps } from '../../../types'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import ConfirmDialog from '../../common/ConfirmDialog'
import Modal from '../../common/Modal'
import {
  AdminEmbeddedBody,
  AdminListEmpty,
  AdminToolbar,
  adminPrimaryButtonClass,
} from '../AdminFormPrimitives'
import { AdminEmbeddedShell } from '../../trading/Practice/hub/AdminEmbeddedShell'
import {
  adminGhostButtonClass,
  adminIconButtonClass,
  adminInputClass,
  adminListCardClass,
  adminSearchInputClass,
  adminSectionHintClass,
  fieldLabelClass,
} from '../../../styles/aurenTheme'

/**
 * User Manager renderer component
 * Main component for managing users (admin only)
 */
class Renderer extends Component<UserManagerProps> {
  render() {
    const {
      isDark,
      toggleTheme,
      user,
      colors,
      navigate,
      users,
      roles,
      error,
      success,
      editingUser,
      editForm,
      saving,
      showPasswordReset,
      newPassword,
      deleteConfirm,
      isCreating,
      createForm,
      searchQuery,
      filteredUsers,
      onEditFormChange,
      onCreateFormChange,
      onSearchChange,
      onCreateClick,
      onCreateCancel,
      onCreate,
      onEdit,
      onCancel,
      onSave,
      onDeleteClick,
      onDeleteConfirm,
      onDeleteCancel,
      onResetPassword,
      onShowPasswordReset,
      onNewPasswordChange,
      embedded,
    } = this.props

    if (!user.isAdmin) {
      if (embedded) {
        return (
          <AdminEmbeddedShell>
            <ErrorMessage message={error || t('users.adminRequired')} isDark={isDark} />
          </AdminEmbeddedShell>
        )
      }
      return (
        <div
          className={`min-h-screen flex items-center justify-center transition-all duration-700 ease-in-out ${
            isDark
              ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
              : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
          }`}
        >
          <div
            className={`rounded-2xl shadow-2xl border p-8 max-w-md ${
              isDark
                ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
                : 'bg-white/90 border-slate-200 backdrop-blur-sm'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('users.accessDenied')}
              </h2>
            </div>
            <p className={`mb-6 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {t('users.adminRequired')}
            </p>
            <button
              onClick={() => navigate(ROUTES.HOME)}
              className={`w-full px-4 py-2 rounded-lg transition-all duration-300 ${colors.button.primary}`}
            >
              {t('notFound.goHome')}
            </button>
          </div>
        </div>
      )
    }

    const labelClass = embedded
      ? fieldLabelClass(isDark)
      : `block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`

    const inputClass = embedded
      ? `${adminInputClass(isDark)} mt-1.5`
      : `w-full px-4 py-2 rounded-lg border ${
          isDark
            ? 'bg-slate-900 border-slate-600 text-slate-100'
            : 'bg-slate-50 border-slate-300 text-slate-900'
        } focus:outline-none focus:ring-2 ${colors.focus.ring}`

    const selectClass = embedded
      ? `${adminInputClass(isDark)} mt-1.5 appearance-none cursor-pointer`
      : `w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg border appearance-none cursor-pointer transition-all duration-200 ${
          isDark
            ? 'bg-slate-800/90 border-slate-600 text-slate-100 hover:border-slate-500 hover:bg-slate-800'
            : 'bg-white border-slate-300 text-slate-900 hover:border-slate-400 hover:bg-slate-50'
        } focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm`

    const primaryBtnClass = embedded
      ? adminPrimaryButtonClass()
      : `flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${colors.button.primary} disabled:opacity-50`

    const ghostBtnClass = embedded
      ? adminGhostButtonClass(isDark)
      : `px-4 py-2 rounded-lg transition-all ${
          isDark
            ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
        }`

    const createButton = (
      <button type="button" onClick={onCreateClick} className={`${primaryBtnClass} w-full sm:w-auto justify-center shrink-0`}>
        <Plus className="w-4 h-4" />
        <span>{t('users.createButton')}</span>
      </button>
    )

    const toolbar = embedded ? (
      <AdminToolbar
        isDark={isDark}
        hint={`${t('users.subtitle')} · ${users.length} ${t('users.total')}, ${filteredUsers.length} ${t('users.filtered')}`}
        action={createButton}
      />
    ) : (
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {t('users.subtitle')} ({users.length} {t('users.total')}, {filteredUsers.length} {t('users.filtered')})
        </p>
        {createButton}
      </div>
    )

    const searchBar = (
      <div className="relative mb-4">
        <Search
          className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
            isDark ? 'text-slate-500' : 'text-slate-400'
          }`}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('users.searchPlaceholder')}
          className={embedded ? adminSearchInputClass(isDark) : `w-full pl-10 pr-4 py-2 rounded-lg border ${
            isDark
              ? 'bg-slate-900 border-slate-600 text-slate-100'
              : 'bg-slate-50 border-slate-300 text-slate-900'
          } focus:outline-none focus:ring-2 ${colors.focus.ring}`}
        />
      </div>
    )

    const alerts = (error || success) && (
      <div className="space-y-3 mb-4">
        <ErrorMessage message={error} isDark={isDark} />
        <SuccessMessage message={success} isDark={isDark} />
      </div>
    )

    const modals = (
      <>
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          title={t('users.deleteTitle')}
          message={t('users.deleteConfirm')}
          confirmText={t('users.deleteButton')}
          cancelText={t('common.cancel')}
          onConfirm={onDeleteConfirm}
          onCancel={onDeleteCancel}
          variant="danger"
          isDark={isDark}
        />

        <Modal isOpen={isCreating} title={t('users.createUser')} onClose={onCreateCancel} size="md" isDark={isDark}>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>{t('users.name')} *</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => onCreateFormChange('name', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t('users.username')} *</label>
              <input
                type="text"
                value={createForm.username}
                onChange={(e) => onCreateFormChange('username', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t('users.email')} *</label>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => onCreateFormChange('email', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t('users.password')} *</label>
              <input
                type="password"
                value={createForm.password}
                onChange={(e) => onCreateFormChange('password', e.target.value)}
                placeholder={t('users.passwordPlaceholder')}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t('users.role')}</label>
              <div className="relative mt-1.5">
                <select
                  value={createForm.role}
                  onChange={(e) => onCreateFormChange('role', e.target.value)}
                  className={selectClass}
                  style={{ paddingRight: '2.5rem', backgroundImage: 'none' }}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <div
                  className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button type="button" onClick={onCreate} disabled={saving} className={primaryBtnClass}>
                <Save className="w-4 h-4" />
                {saving ? t('users.saving') : t('users.createButton')}
              </button>
              <button type="button" onClick={onCreateCancel} className={ghostBtnClass}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={!!editingUser}
          title={`${t('users.editUser')}: ${editingUser?.username || ''}`}
          onClose={onCancel}
          size="md"
          isDark={isDark}
        >
          <div className="space-y-4">
            <div>
              <label className={labelClass}>{t('users.name')}</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => onEditFormChange('name', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t('users.email')}</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => onEditFormChange('email', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t('users.role')}</label>
              <div className="relative mt-1.5">
                <select
                  value={editForm.role}
                  onChange={(e) => onEditFormChange('role', e.target.value)}
                  className={selectClass}
                  style={{ paddingRight: '2.5rem', backgroundImage: 'none' }}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <div
                  className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {editingUser && showPasswordReset === editingUser.id && (
              <div>
                <label className={labelClass}>{t('users.newPassword')}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => onNewPasswordChange(e.target.value)}
                  placeholder={t('users.passwordPlaceholder')}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => editingUser && onResetPassword(editingUser.id)}
                  disabled={saving}
                  className={`mt-3 ${primaryBtnClass}`}
                >
                  {t('users.resetPassword')}
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button type="button" onClick={onSave} disabled={saving} className={primaryBtnClass}>
                <Save className="w-4 h-4" />
                {saving ? t('users.saving') : t('users.save')}
              </button>
              {editingUser && showPasswordReset !== editingUser.id && (
                <button
                  type="button"
                  onClick={() => editingUser && onShowPasswordReset(editingUser.id)}
                  className={ghostBtnClass}
                >
                  {t('users.resetPassword')}
                </button>
              )}
              <button type="button" onClick={onCancel} className={ghostBtnClass}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </Modal>
      </>
    )

    const userList = (
      <div className={embedded ? 'space-y-3' : 'space-y-4'}>
        {filteredUsers.length === 0 ? (
          embedded ? (
            <AdminListEmpty isDark={isDark}>
              {searchQuery ? t('users.noResults') : t('users.noUsers')}
            </AdminListEmpty>
          ) : (
            <div
              className={`rounded-2xl shadow-lg border p-8 text-center ${
                isDark
                  ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
                  : 'bg-white/90 border-slate-200 backdrop-blur-sm'
              }`}
            >
              <p className={`text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {searchQuery ? t('users.noResults') : t('users.noUsers')}
              </p>
            </div>
          )
        ) : (
          filteredUsers.map((userItem) => (
            <div
              key={userItem.id}
              className={
                embedded
                  ? adminListCardClass(isDark)
                  : `rounded-xl sm:rounded-2xl shadow-lg border p-4 sm:p-6 ${
                      isDark
                        ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
                        : 'bg-white/90 border-slate-200 backdrop-blur-sm'
                    }`
              }
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3
                      className={`font-semibold tracking-tight truncate ${
                        embedded ? 'text-base' : 'text-lg sm:text-xl font-bold'
                      } ${isDark ? 'text-white' : 'text-slate-900'}`}
                    >
                      {userItem.name || userItem.username}
                    </h3>
                    {userItem.email_verified && (
                      <Shield
                        className={`w-3.5 h-3.5 shrink-0 ${
                          embedded ? 'text-amber-400' : colors.icon.primary
                        }`}
                        aria-label="Verified"
                      />
                    )}
                  </div>
                  <p className={`text-xs truncate ${embedded ? adminSectionHintClass(isDark) : isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {userItem.username} · {userItem.email}
                  </p>
                  <p className={`text-xs mt-0.5 ${embedded ? adminSectionHintClass(isDark) : isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {t('users.role')}: {userItem.role}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => onEdit(userItem)}
                    className={
                      embedded
                        ? adminIconButtonClass(isDark, 'amber')
                        : `p-2 rounded-lg transition-all ${colors.button.primary}`
                    }
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteClick(userItem.id)}
                    disabled={userItem.id === user?.id}
                    className={
                      embedded
                        ? `${adminIconButtonClass(isDark, 'danger')} disabled:opacity-50 disabled:cursor-not-allowed`
                        : `p-2 rounded-lg transition-all ${colors.button.danger} disabled:opacity-50 disabled:cursor-not-allowed`
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    )

    const body = embedded ? (
      <AdminEmbeddedBody>
        {toolbar}
        {searchBar}
        {alerts}
        {modals}
        {userList}
      </AdminEmbeddedBody>
    ) : (
      <>
        {toolbar}
        {searchBar}
        {alerts}
        {modals}
        {userList}
      </>
    )

    if (embedded) {
      return <AdminEmbeddedShell>{body}</AdminEmbeddedShell>
    }

    return (
      <div
        className={`min-h-screen transition-all duration-700 ease-in-out ${
          isDark
            ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
            : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
        }`}
      >
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="mb-6 flex items-center gap-2 sm:gap-3">
            <Users className={`w-6 h-6 sm:w-8 sm:h-8 ${colors.icon.primary}`} />
            <h1 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('users.title')}
            </h1>
          </div>
          {body}
        </main>
      </div>
    )
  }
}

export default Renderer

