import { Component } from 'react'
import { Shield, Plus, AlertCircle } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { t } from '../../../utils/translator'
import { RolesManagerProps } from '../../../types'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import ConfirmDialog from '../../common/ConfirmDialog'
import Modal from '../../common/Modal'
import RoleForm from '../roles/RoleForm'
import RoleCard from '../roles/RoleCard'
import { AdminEmbeddedBody, AdminToolbar, adminPrimaryButtonClass } from '../AdminFormPrimitives'
import { AdminEmbeddedShell } from '../../trading/Practice/hub/AdminEmbeddedShell'

/**
 * Roles Manager renderer component
 * Main component for managing roles and permissions
 */
class Renderer extends Component<RolesManagerProps> {
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
      embedded,
    } = this.props

    if (!user.isAdmin) {
      if (embedded) {
        return (
          <AdminEmbeddedShell>
            <ErrorMessage message={error || t('roles.adminRequired')} isDark={isDark} />
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

    const createButton = (
      <button
        type="button"
        onClick={onCreateRole}
        className={`flex items-center justify-center gap-2 text-sm w-full sm:w-auto shrink-0 ${
          embedded ? adminPrimaryButtonClass() : `px-4 py-2 rounded-lg transition-all ${colors.button.primary}`
        }`}
      >
        <Plus className="w-4 h-4" />
        <span>{t('roles.createButton')}</span>
      </button>
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
          title={t('roles.deleteTitle')}
          message={t('roles.deleteConfirm')}
          confirmText={t('roles.deleteButton')}
          cancelText={t('common.cancel')}
          onConfirm={onDeleteConfirm}
          onCancel={onDeleteCancel}
          variant="danger"
          isDark={isDark}
        />

        <Modal
          isOpen={isCreating || !!editingRole}
          title={isCreating ? t('roles.createRole') : t('roles.editRole')}
          onClose={onCancel}
          size="md"
          isDark={isDark}
        >
          <RoleForm
            embedded={embedded}
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
      </>
    )

    const roleList = (
      <div className={embedded ? 'space-y-3' : 'space-y-4'}>
        {roles.map((role) => (
            <RoleCard
              key={role.id}
              embedded={embedded}
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
    )

    const body = embedded ? (
      <AdminEmbeddedBody>
        <AdminToolbar isDark={isDark} hint={t('roles.subtitle')} action={createButton} />
        {alerts}
        {modals}
        {roleList}
      </AdminEmbeddedBody>
    ) : (
      <>
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('roles.subtitle')}
            </p>
          </div>
          {createButton}
        </div>
        {alerts}
        {modals}
        {roleList}
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
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <Shield className={`w-6 h-6 sm:w-8 sm:h-8 ${colors.icon.primary}`} />
              <h1 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('roles.title')}
              </h1>
            </div>
          </div>
          {body}
        </main>
      </div>
    )
  }
}

export default Renderer

