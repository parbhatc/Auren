import { Component } from 'react'
import Checkbox from '../../common/Checkbox'
import SubmitButton from '../../common/SubmitButton'
import { t } from '../../../utils/translator'
import { getThemeColors } from '../../../constants/theme'
import { RoleFormProps } from '../../../types'

/**
 * Role Form Component
 * Handles creating and editing roles
 */
class RoleForm extends Component<RoleFormProps> {
  render() {
    const {
      isCreating,
      editingRole,
      newRole,
      availablePermissions,
      saving,
      onCancel,
      onSave,
      onRoleChange,
      onTogglePermission,
      isDark,
    } = this.props
    const colors = getThemeColors(isDark)

    return (
      <div className="space-y-4">
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            {t('roles.roleId')}
          </label>
          <input
            type="text"
            value={newRole.id}
            onChange={(e) => onRoleChange('id', e.target.value)}
            disabled={!!editingRole}
            className={`w-full px-4 py-2 rounded-lg border ${
              isDark
                ? 'bg-slate-900 border-slate-600 text-slate-100 disabled:opacity-50'
                : 'bg-slate-50 border-slate-300 text-slate-900 disabled:opacity-50'
            } focus:outline-none focus:ring-2 ${colors.focus.ring}`}
            placeholder={t('roles.roleIdPlaceholder')}
          />
        </div>

        <div>
          <label
            className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            {t('roles.roleName')}
          </label>
          <input
            type="text"
            value={newRole.name}
            onChange={(e) => onRoleChange('name', e.target.value)}
            className={`w-full px-4 py-2 rounded-lg border ${
              isDark
                ? 'bg-slate-900 border-slate-600 text-slate-100'
                : 'bg-slate-50 border-slate-300 text-slate-900'
            } focus:outline-none focus:ring-2 ${colors.focus.ring}`}
            placeholder={t('roles.roleNamePlaceholder')}
          />
        </div>

        <div>
          <label
            className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            {t('roles.permissions')}
          </label>
          <div
            className={`max-h-64 overflow-y-auto p-4 rounded-lg border ${
              isDark
                ? 'bg-slate-900 border-slate-600'
                : 'bg-slate-50 border-slate-300'
            }`}
          >
            {availablePermissions.length === 0 ? (
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('roles.noPermissions')}
              </p>
            ) : (
              <div className="space-y-2">
                {availablePermissions.map((permission) => (
                  <div
                    key={permission}
                    className={`p-2 rounded transition-colors ${
                      isDark
                        ? 'hover:bg-slate-700/50'
                        : 'hover:bg-slate-200/50'
                    }`}
                  >
                    <Checkbox
                      checked={newRole.permissions.includes(permission)}
                      onChange={() => onTogglePermission(permission)}
                      label={permission}
                      size="md"
                      isDark={isDark}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSave(); }} className="flex items-center gap-4">
          <SubmitButton loading={saving}>
            {saving ? t('roles.saving') : isCreating ? t('roles.createButton') : t('roles.saveButton')}
          </SubmitButton>
          <button
            type="button"
            onClick={onCancel}
            className={`px-4 py-2 rounded-lg transition-all ${
              isDark
                ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            {t('common.cancel')}
          </button>
        </form>
      </div>
    )
  }
}

export default RoleForm
