import { Component } from 'react'
import { Users, ArrowLeft, Edit, Trash2, Shield, AlertCircle, Save, Plus, Search, ChevronDown } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { t } from '../../../utils/translator'
import { UserManagerProps } from '../../../types'
import ThemeToggle from '../../common/ThemeToggle'
import Logo from '../../common/Logo'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import ConfirmDialog from '../../common/ConfirmDialog'
import Modal from '../../common/Modal'

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
    } = this.props

    if (!user.isAdmin) {
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

    return (
      <div
        className={`min-h-screen transition-all duration-700 ease-in-out ${
          isDark
            ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
            : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
        }`}
      >
        {/* Header */}
        <header
          className={`border-b ${
            isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white/80'
          } backdrop-blur-sm sticky top-0 z-50`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <Logo isDark={isDark} compact={true} onClick={() => navigate(ROUTES.HOME)} />
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(ROUTES.HOME)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                    isDark
                      ? 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 border border-slate-700'
                      : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-200'
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">{t('common.back')}</span>
                </button>
                <ThemeToggle isDark={isDark} onToggle={toggleTheme} fixed={false} />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <Users className={`w-6 h-6 sm:w-8 sm:h-8 ${colors.icon.primary}`} />
                  <h1 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {t('users.title')}
                  </h1>
                </div>
                <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {t('users.subtitle')} ({users.length} {t('users.total')}, {filteredUsers.length}{' '}
                  {t('users.filtered')})
                </p>
              </div>
              <button
                onClick={onCreateClick}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 text-sm sm:text-base ${colors.button.primary} w-full sm:w-auto justify-center`}
              >
                <Plus className="w-4 h-4" />
                <span>{t('users.createButton')}</span>
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search
                className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t('users.searchPlaceholder')}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-slate-900 border-slate-600 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                } focus:outline-none focus:ring-2 ${colors.focus.ring}`}
              />
            </div>
          </div>

          <ErrorMessage message={error} isDark={isDark} className="mb-4" />
          <SuccessMessage message={success} isDark={isDark} className="mb-4" />

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

          {/* Create User Modal */}
          <Modal isOpen={isCreating} title={t('users.createUser')} onClose={onCreateCancel} size="md" isDark={isDark}>
            <div className="space-y-4">
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                >
                  {t('users.name')} *
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => onCreateFormChange('name', e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark
                      ? 'bg-slate-900 border-slate-600 text-slate-100'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  } focus:outline-none focus:ring-2 ${colors.focus.ring}`}
                />
              </div>

              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                >
                  {t('users.username')} *
                </label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) => onCreateFormChange('username', e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark
                      ? 'bg-slate-900 border-slate-600 text-slate-100'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  } focus:outline-none focus:ring-2 ${colors.focus.ring}`}
                />
              </div>

              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                >
                  {t('users.email')} *
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => onCreateFormChange('email', e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark
                      ? 'bg-slate-900 border-slate-600 text-slate-100'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  } focus:outline-none focus:ring-2 ${colors.focus.ring}`}
                />
              </div>

              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                >
                  {t('users.password')} *
                </label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => onCreateFormChange('password', e.target.value)}
                  placeholder={t('users.passwordPlaceholder')}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark
                      ? 'bg-slate-900 border-slate-600 text-slate-100'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  } focus:outline-none focus:ring-2 ${colors.focus.ring}`}
                />
              </div>

              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                >
                  {t('users.role')}
                </label>
                <div className="relative">
                  <select
                    value={createForm.role}
                    onChange={(e) => onCreateFormChange('role', e.target.value)}
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg border appearance-none cursor-pointer transition-all duration-200 ${
                      isDark
                        ? 'bg-slate-800/90 border-slate-600 text-slate-100 hover:border-slate-500 hover:bg-slate-800'
                        : 'bg-white border-slate-300 text-slate-900 hover:border-slate-400 hover:bg-slate-50'
                    } focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm`}
                    style={{
                      paddingRight: '2.5rem',
                      backgroundImage: 'none'
                    }}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <div className={`absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={onCreate}
                  disabled={saving}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${colors.button.primary} disabled:opacity-50`}
                >
                  <Save className="w-4 h-4" />
                  {saving ? t('users.saving') : t('users.createButton')}
                </button>
                <button
                  onClick={onCreateCancel}
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

          {/* Edit User Modal */}
          <Modal
            isOpen={!!editingUser}
            title={`${t('users.editUser')}: ${editingUser?.username || ''}`}
            onClose={onCancel}
            size="md"
            isDark={isDark}
          >
            <div className="space-y-4">
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                >
                  {t('users.name')}
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => onEditFormChange('name', e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark
                      ? 'bg-slate-900 border-slate-600 text-slate-100'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  } focus:outline-none focus:ring-2 ${colors.focus.ring}`}
                />
              </div>

              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                >
                  {t('users.email')}
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => onEditFormChange('email', e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark
                      ? 'bg-slate-900 border-slate-600 text-slate-100'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  } focus:outline-none focus:ring-2 ${colors.focus.ring}`}
                />
              </div>

              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                >
                  {t('users.role')}
                </label>
                <div className="relative">
                  <select
                    value={editForm.role}
                    onChange={(e) => onEditFormChange('role', e.target.value)}
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg border appearance-none cursor-pointer transition-all duration-200 ${
                      isDark
                        ? 'bg-slate-800/90 border-slate-600 text-slate-100 hover:border-slate-500 hover:bg-slate-800'
                        : 'bg-white border-slate-300 text-slate-900 hover:border-slate-400 hover:bg-slate-50'
                    } focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm`}
                    style={{
                      paddingRight: '2.5rem',
                      backgroundImage: 'none'
                    }}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <div className={`absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
              </div>

              {editingUser && showPasswordReset === editingUser.id && (
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                  >
                    {t('users.newPassword')}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => onNewPasswordChange(e.target.value)}
                    placeholder={t('users.passwordPlaceholder')}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDark
                        ? 'bg-slate-900 border-slate-600 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    } focus:outline-none focus:ring-2 ${colors.focus.ring}`}
                  />
                  <button
                    onClick={() => editingUser && onResetPassword(editingUser.id)}
                    disabled={saving}
                    className={`mt-2 px-4 py-2 rounded-lg transition-all ${colors.button.primary} disabled:opacity-50`}
                  >
                    {t('users.resetPassword')}
                  </button>
                </div>
              )}

              <div className="flex items-center gap-4">
                <button
                  onClick={onSave}
                  disabled={saving}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${colors.button.primary} disabled:opacity-50`}
                >
                  <Save className="w-4 h-4" />
                  {saving ? t('users.saving') : t('users.save')}
                </button>
                {editingUser && showPasswordReset !== editingUser.id && (
                  <button
                    onClick={() => editingUser && onShowPasswordReset(editingUser.id)}
                    className={`px-4 py-2 rounded-lg transition-all ${colors.button.warning}`}
                  >
                    {t('users.resetPassword')}
                  </button>
                )}
                <button
                  onClick={onCancel}
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

          {/* Users List */}
          <div className="space-y-4">
            {filteredUsers.length === 0 ? (
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
            ) : (
              filteredUsers.map((userItem) => (
                <div
                  key={userItem.id}
                  className={`rounded-xl sm:rounded-2xl shadow-lg border p-4 sm:p-6 ${
                    isDark
                      ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
                      : 'bg-white/90 border-slate-200 backdrop-blur-sm'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3 mb-2">
                        <h3 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} truncate`}>
                          {userItem.name || userItem.username}
                        </h3>
                        {userItem.email_verified && (
                          <Shield className={`w-4 h-4 flex-shrink-0 ${colors.icon.primary}`} />
                        )}
                      </div>
                      <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} truncate`}>
                        {t('users.username')}: {userItem.username}
                      </p>
                      <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} truncate`}>
                        {t('users.email')}: {userItem.email}
                      </p>
                      <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {t('users.role')}: {userItem.role}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
                      <button
                        onClick={() => onEdit(userItem)}
                        className={`p-2 rounded-lg transition-all ${colors.button.primary}`}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteClick(userItem.id)}
                        disabled={userItem.id === user?.id}
                        className={`p-2 rounded-lg transition-all ${colors.button.danger} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    )
  }
}

export default Renderer

