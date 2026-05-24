import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../../hooks/useTheme'
import { ROUTES } from '../../../constants/routes'
import { authAPI } from '../../../api/auth.api'
import { permissionAPI } from '../../../api/permissions.api'
import { getThemeColors } from '../../../constants/theme'
import type { Role } from '../../../api/permissions.api'
import Loading from '../../common/Loading'
import Renderer from './Renderer'
import { UserData } from '../../../types/user'
import { t } from '../../../utils/translator'

/**
 * Roles Manager wrapper component
 * Uses hooks and passes props to renderer component
 */
const Wrapper = () => {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const colors = getThemeColors(isDark)
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<Role[]>([])
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([])
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newRole, setNewRole] = useState({ id: '', name: '', permissions: [] as string[] })
  const [saving, setSaving] = useState(false)
  const [usersByRole, setUsersByRole] = useState<Record<string, any[]>>({})
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; roleId: string | null }>({
    isOpen: false,
    roleId: null,
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

        if (!userResponse.user.isAdmin) {
          setError(t('roles.accessDenied'))
          return
        }

        await loadData()
      } catch (err: any) {
        if (err?.response?.status === 403) {
          setError(t('roles.accessDenied'))
        } else if (err?.response?.status === 401) {
          localStorage.removeItem('token')
          navigate(ROUTES.LOGIN)
        } else {
          setError(err?.response?.data?.message || t('roles.loadError'))
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [navigate])

  const loadData = async () => {
    try {
      const [rolesResponse, permissionsResponse] = await Promise.all([
        permissionAPI.getRoles(),
        permissionAPI.getAvailablePermissions(),
      ])
      setRoles(rolesResponse.roles)
      setAvailablePermissions(permissionsResponse.permissions)
    } catch (err: any) {
      setError(err?.response?.data?.message || t('roles.loadError'))
    }
  }

  const loadUsersForRole = async (roleId: string) => {
    if (usersByRole[roleId]) return

    try {
      const response = await permissionAPI.getUsersByRole(roleId)
      setUsersByRole(prev => ({ ...prev, [roleId]: response.users }))
    } catch (err: any) {
      console.error('Failed to load users for role:', err)
    }
  }

  const toggleRoleExpanded = (roleId: string) => {
    const newExpanded = new Set(expandedRoles)
    if (newExpanded.has(roleId)) {
      newExpanded.delete(roleId)
    } else {
      newExpanded.add(roleId)
      loadUsersForRole(roleId)
    }
    setExpandedRoles(newExpanded)
  }

  const handleCreateRole = () => {
    setIsCreating(true)
    setEditingRole(null)
    setNewRole({ id: '', name: '', permissions: [] })
    setError('')
    setSuccess('')
  }

  const handleEditRole = (role: Role) => {
    setEditingRole(role)
    setIsCreating(false)
    setNewRole({ id: role.id, name: role.name, permissions: [...role.permissions] })
    setError('')
    setSuccess('')
  }

  const handleCancel = () => {
    setIsCreating(false)
    setEditingRole(null)
    setNewRole({ id: '', name: '', permissions: [] })
    setError('')
    setSuccess('')
  }

  const handleRoleChange = (field: 'id' | 'name', value: string) => {
    setNewRole({ ...newRole, [field]: value })
  }

  const togglePermission = (permission: string) => {
    if (newRole.permissions.includes(permission)) {
      setNewRole({
        ...newRole,
        permissions: newRole.permissions.filter(p => p !== permission),
      })
    } else {
      setNewRole({
        ...newRole,
        permissions: [...newRole.permissions, permission],
      })
    }
  }

  const handleSave = async () => {
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      if (!newRole.id || !newRole.name) {
        setError(t('roles.requiredFields'))
        setSaving(false)
        return
      }

      if (isCreating) {
        await permissionAPI.createRole(newRole)
        setSuccess(t('roles.createSuccess'))
      } else if (editingRole) {
        await permissionAPI.updateRole(editingRole.id, {
          name: newRole.name,
          permissions: newRole.permissions,
        })
        setSuccess(t('roles.updateSuccess'))
      }

      await loadData()
      handleCancel()
    } catch (err: any) {
      setError(err?.response?.data?.message || t('roles.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = (roleId: string) => {
    setDeleteConfirm({ isOpen: true, roleId })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.roleId) return

    setError('')
    setSuccess('')
    setSaving(true)
    setDeleteConfirm({ isOpen: false, roleId: null })

    try {
      await permissionAPI.deleteRole(deleteConfirm.roleId)
      setSuccess(t('roles.deleteSuccess'))
      await loadData()
    } catch (err: any) {
      setError(err?.response?.data?.message || t('roles.deleteError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, roleId: null })
  }

  if (loading || !user) {
    return <Loading />
  }

  return (
    <Renderer
      isDark={isDark}
      toggleTheme={toggleTheme}
      user={user}
      colors={colors}
      navigate={navigate}
      roles={roles}
      availablePermissions={availablePermissions}
      error={error}
      success={success}
      editingRole={editingRole}
      isCreating={isCreating}
      newRole={newRole}
      saving={saving}
      usersByRole={usersByRole}
      expandedRoles={expandedRoles}
      deleteConfirm={deleteConfirm}
      onLoadUsersForRole={loadUsersForRole}
      onToggleRoleExpanded={toggleRoleExpanded}
      onCreateRole={handleCreateRole}
      onEditRole={handleEditRole}
      onCancel={handleCancel}
      onRoleChange={handleRoleChange}
      onTogglePermission={togglePermission}
      onSave={handleSave}
      onDeleteClick={handleDeleteClick}
      onDeleteConfirm={handleDeleteConfirm}
      onDeleteCancel={handleDeleteCancel}
    />
  )
}

export default Wrapper

