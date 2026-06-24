import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../../hooks/useTheme'
import { ROUTES } from '../../../constants/routes'
import { authAPI } from '../../../api/auth.api'
import { usersAPI } from '../../../api/users.api'
import { permissionAPI } from '../../../api/permissions.api'
import type { User } from '../../../api/users.api'
import type { Role } from '../../../api/permissions.api'
import { getThemeColors } from '../../../constants/theme'
import Loading from '../../common/Loading'
import HubSettingsSkeleton from '../../trading/Practice/hub/HubSettingsSkeleton'
import Renderer from './Renderer'
import { UserData } from '../../../types/user'
import { t } from '../../../utils/translator'

/**
 * User Manager wrapper component
 * Uses hooks and passes props to renderer component
 */
const Wrapper = ({ embedded, onBack }: { embedded?: boolean; onBack?: () => void } = {}) => {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const colors = getThemeColors(isDark)
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '' })
  const [saving, setSaving] = useState(false)
  const [showPasswordReset, setShowPasswordReset] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; userId: string | null }>({
    isOpen: false,
    userId: null,
  })
  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', username: '', email: '', password: '', role: '' })
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])

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
          setError(t('users.accessDenied'))
          return
        }

        await loadData()
      } catch (err: any) {
        if (err?.response?.status === 403) {
          setError(t('users.accessDenied'))
        } else if (err?.response?.status === 401) {
          localStorage.removeItem('token')
          navigate(ROUTES.LOGIN)
        } else {
          setError(err?.response?.data?.message || t('users.loadError'))
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [navigate])

  const loadData = async () => {
    try {
      const [usersResponse, rolesResponse] = await Promise.all([
        usersAPI.getAllUsers(),
        permissionAPI.getRoles(),
      ])
      setUsers(usersResponse.users)
      setRoles(rolesResponse.roles)
      setFilteredUsers(usersResponse.users)
    } catch (err: any) {
      setError(err?.response?.data?.message || t('users.loadError'))
    }
  }

  // Filter users based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
    )
    setFilteredUsers(filtered)
  }, [searchQuery, users])

  const handleCreateClick = () => {
    setIsCreating(true)
    setEditingUser(null)
    setCreateForm({ name: '', username: '', email: '', password: '', role: roles[0]?.id || '' })
    setError('')
    setSuccess('')
  }

  const handleCreateCancel = () => {
    setIsCreating(false)
    setCreateForm({ name: '', username: '', email: '', password: '', role: '' })
    setError('')
    setSuccess('')
  }

  const handleCreate = async () => {
    if (!createForm.name || !createForm.username || !createForm.email || !createForm.password) {
      setError(t('users.requiredFields'))
      return
    }

    setError('')
    setSuccess('')
    setSaving(true)

    try {
      await usersAPI.createUser(createForm)
      setSuccess(t('users.createSuccess'))
      await loadData()
      handleCreateCancel()
    } catch (err: any) {
      setError(err?.response?.data?.message || t('users.createError'))
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (userToEdit: User) => {
    setEditingUser(userToEdit)
    setEditForm({
      name: userToEdit.name,
      email: userToEdit.email,
      role: userToEdit.role,
    })
    setError('')
    setSuccess('')
    setShowPasswordReset(null)
  }

  const handleCancel = () => {
    setEditingUser(null)
    setIsCreating(false)
    setEditForm({ name: '', email: '', role: '' })
    setError('')
    setSuccess('')
    setShowPasswordReset(null)
    setNewPassword('')
  }

  const handleSave = async () => {
    if (!editingUser) return

    setError('')
    setSuccess('')
    setSaving(true)

    try {
      await usersAPI.updateUser(editingUser.id, editForm)
      setSuccess(t('users.updateSuccess'))
      await loadData()
      handleCancel()
    } catch (err: any) {
      setError(err?.response?.data?.message || t('users.updateError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = (userId: string) => {
    setDeleteConfirm({ isOpen: true, userId })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.userId) return

    setError('')
    setSuccess('')
    setSaving(true)
    setDeleteConfirm({ isOpen: false, userId: null })

    try {
      await usersAPI.deleteUser(deleteConfirm.userId)
      setSuccess(t('users.deleteSuccess'))
      await loadData()
    } catch (err: any) {
      setError(err?.response?.data?.message || t('users.deleteError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, userId: null })
  }

  const handleResetPassword = async (userId: string) => {
    if (!newPassword || newPassword.length < 6) {
      setError(t('users.passwordTooShort'))
      return
    }

    setError('')
    setSuccess('')
    setSaving(true)

    try {
      await usersAPI.resetUserPassword(userId, { newPassword })
      setSuccess(t('users.passwordResetSuccess'))
      setShowPasswordReset(null)
      setNewPassword('')
    } catch (err: any) {
      setError(err?.response?.data?.message || t('users.passwordResetError'))
    } finally {
      setSaving(false)
    }
  }

  const handleEditFormChange = (field: string, value: string) => {
    setEditForm({ ...editForm, [field]: value })
  }

  const handleCreateFormChange = (field: string, value: string) => {
    setCreateForm({ ...createForm, [field]: value })
  }

  if (loading || !user) {
    return embedded ? <HubSettingsSkeleton isDark={isDark} rows={3} /> : <Loading />
  }

  return (
    <Renderer
      isDark={isDark}
      toggleTheme={toggleTheme}
      user={user}
      colors={colors}
      navigate={navigate}
      users={users}
      roles={roles}
      error={error}
      success={success}
      editingUser={editingUser}
      editForm={editForm}
      saving={saving}
      showPasswordReset={showPasswordReset}
      newPassword={newPassword}
      deleteConfirm={deleteConfirm}
      isCreating={isCreating}
      createForm={createForm}
      searchQuery={searchQuery}
      filteredUsers={filteredUsers}
      onEditFormChange={handleEditFormChange}
      onCreateFormChange={handleCreateFormChange}
      onSearchChange={setSearchQuery}
      onCreateClick={handleCreateClick}
      onCreateCancel={handleCreateCancel}
      onCreate={handleCreate}
      onEdit={handleEdit}
      onCancel={handleCancel}
      onSave={handleSave}
      onDeleteClick={handleDeleteClick}
      onDeleteConfirm={handleDeleteConfirm}
      onDeleteCancel={handleDeleteCancel}
      onResetPassword={handleResetPassword}
      onShowPasswordReset={setShowPasswordReset}
      onNewPasswordChange={setNewPassword}
      embedded={embedded}
    />
  )
}

export default Wrapper

