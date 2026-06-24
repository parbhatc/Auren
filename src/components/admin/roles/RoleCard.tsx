import { Component } from 'react'
import { Edit, Trash2, Users } from 'lucide-react'
import { t } from '../../../utils/translator'
import { getThemeColors } from '../../../constants/theme'
import {
  adminBadgeClass,
  adminDividerClass,
  adminGhostButtonClass,
  adminIconButtonClass,
  adminInsetListItemClass,
  adminListCardClass,
  adminSectionHintClass,
} from '../../../styles/aurenTheme'
import { RoleCardProps } from '../../../types'

class RoleCard extends Component<RoleCardProps> {
  render() {
    const { role, isExpanded, users, onEdit, onDelete, onToggleExpand, isDark, embedded } = this.props
    const colors = getThemeColors(isDark)

    const cardClass = embedded
      ? adminListCardClass(isDark)
      : `rounded-xl sm:rounded-2xl shadow-lg border p-4 sm:p-6 ${
          isDark
            ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
            : 'bg-white/90 border-slate-200 backdrop-blur-sm'
        }`

    return (
      <div className={cardClass}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
          <div className="flex-1 min-w-0">
            <h3
              className={`font-semibold tracking-tight ${
                embedded ? 'text-base' : 'text-lg sm:text-xl font-bold'
              } ${isDark ? 'text-white' : 'text-slate-900'}`}
            >
              {role.name}
            </h3>
            <p className={`text-xs mt-0.5 ${embedded ? adminSectionHintClass(isDark) : isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('roles.id')}: {role.id}
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
            <button
              type="button"
              onClick={onToggleExpand}
              className={
                embedded
                  ? adminGhostButtonClass(isDark)
                  : `flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-xs sm:text-sm ${
                      isDark
                        ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                    }`
              }
            >
              <Users className="w-4 h-4" />
              <span className={embedded ? '' : 'hidden sm:inline'}>{t('roles.users')}</span>
            </button>
            <button
              type="button"
              onClick={onEdit}
              className={embedded ? adminIconButtonClass(isDark, 'amber') : `p-2 rounded-lg transition-all ${
                isDark
                  ? 'bg-blue-950/50 text-blue-300 hover:bg-blue-950/70 border border-blue-800/50'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className={embedded ? adminIconButtonClass(isDark, 'danger') : `p-2 rounded-lg transition-all ${colors.button.danger}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mb-1">
          <p className={`text-xs font-medium mb-2 uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            {t('roles.permissions')} ({role.permissions.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {role.permissions.map((permission) => (
              <span
                key={permission}
                className={embedded ? adminBadgeClass(isDark) : `px-3 py-1 rounded-full text-xs font-medium ${colors.badge.primary}`}
              >
                {permission}
              </span>
            ))}
          </div>
        </div>

        {isExpanded && (
          <div className={`mt-4 pt-4 border-t ${embedded ? adminDividerClass(isDark) : isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <p className={`text-xs font-medium mb-2 uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              {t('roles.usersWithRole')} ({users.length})
            </p>
            {users.length > 0 ? (
              <div className="space-y-2">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className={embedded ? adminInsetListItemClass(isDark) : `p-3 rounded-lg ${isDark ? 'bg-slate-700/50' : 'bg-slate-100'}`}
                  >
                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {user.name} ({user.username})
                    </p>
                    <p className={`text-xs mt-0.5 ${adminSectionHintClass(isDark)}`}>{user.email}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-sm ${adminSectionHintClass(isDark)}`}>{t('roles.noUsers')}</p>
            )}
          </div>
        )}
      </div>
    )
  }
}

export default RoleCard
