import { Component } from 'react'
import { Shield, ArrowLeft, Plus, AlertCircle } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { t } from '../../../utils/translator'
import { RolesManagerProps } from '../../../types'
import ThemeToggle from '../../common/ThemeToggle'
import Logo from '../../common/Logo'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import ConfirmDialog from '../../common/ConfirmDialog'
import Modal from '../../common/Modal'
import RoleForm from '../roles/RoleForm'
import RoleCard from '../roles/RoleCard'

/**
 * Roles Manager renderer component
 * Main component for managing roles and permissions
 */
class RolesManagerRenderer extends Component<RolesManagerProps> {
  render() {
    const {
      isDark,
      toggleTheme,
      user,
      colors,
      navigate,
      roles,
      availablePermissions,
      error,
      success,
      editingRole,
      isCreating,
      newRole,
      saving,
      usersByRole,
      expandedRoles,
      deleteConfirm,
      onLoadUsersForRole,
      onToggleRoleExpanded,
      onCreateRole,
      onEditRole,
      onCancel,
      onRoleChange,
      onTogglePermission,
      onSave,
      onDeleteClick,
      onDeleteConfirm,
      onDeleteCancel,
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
                {t('roles.accessDenied')}
              </h2>
            </div>
            <p className={`mb-6 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {t('roles.adminRequired')}
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <Shield className={`w-6 h-6 sm:w-8 sm:h-8 ${colors.icon.primary}`} />
                <h1 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t('roles.title')}
                </h1>
              </div>
              <button
                onClick={onCreateRole}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 text-sm sm:text-base ${colors.button.primary} w-full sm:w-auto justify-center`}
              >
                <Plus className="w-4 h-4" />
                <span>{t('roles.createButton')}</span>
              </button>
            </div>
            <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('roles.subtitle')}
            </p>
          </div>

          <ErrorMessage message={error} isDark={isDark} className="mb-4" />
          <SuccessMessage message={success} isDark={isDark} className="mb-4" />

          <ConfirmDialog
            isOpen={deleteConfirm.isOpen}
            title={t('roles.deleteTitle')}
            message={t('roles.deleteConfirm')}
            confirmText={t('roles.deleteButton')}
            cancelText={t('common.cancel')}
            onConfirm={onDeleteConfirm}
            onCancel={onDeleteCancel}
            variant="danger"
            isDark={isDark}
          />

          {/* Create/Edit Role Modal */}
          <Modal
            isOpen={isCreating || !!editingRole}
            title={isCreating ? t('roles.createRole') : t('roles.editRole')}
            onClose={onCancel}
            size="md"
            isDark={isDark}
          >
            <RoleForm
              isCreating={isCreating}
              editingRole={editingRole}
              newRole={newRole}
              availablePermissions={availablePermissions}
              saving={saving}
              onCancel={onCancel}
              onSave={onSave}
              onRoleChange={onRoleChange}
              onTogglePermission={onTogglePermission}
              isDark={isDark}
            />
          </Modal>

          {/* Roles List */}
          <div className="space-y-4">
            {roles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                isExpanded={expandedRoles.has(role.id)}
                users={usersByRole[role.id] || []}
                onEdit={() => onEditRole(role)}
                onDelete={() => onDeleteClick(role.id)}
                onToggleExpand={() => {
                  onToggleRoleExpanded(role.id)
                  if (!expandedRoles.has(role.id)) {
                    onLoadUsersForRole(role.id)
                  }
                }}
                isDark={isDark}
              />
            ))}
          </div>
        </main>
      </div>
    )
  }
}

export default RolesManagerRenderer

