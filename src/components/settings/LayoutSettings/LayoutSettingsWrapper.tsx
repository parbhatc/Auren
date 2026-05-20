/**
 * Layout Settings Wrapper Component
 */
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../../hooks/useTheme'
import LayoutSettingsRenderer from './LayoutSettingsRenderer'

export default function LayoutSettingsWrapper() {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()

  return (
    <LayoutSettingsRenderer
      isDark={isDark}
      toggleTheme={toggleTheme}
      navigate={navigate}
    />
  )
}

