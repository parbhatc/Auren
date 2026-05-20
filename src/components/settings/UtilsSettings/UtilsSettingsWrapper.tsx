import { useTheme } from '../../../hooks/useTheme'
import { useNavigate } from 'react-router-dom'
import UtilsSettingsRenderer from './UtilsSettingsRenderer'

/**
 * Utils Settings wrapper component
 * Provides theme context to UtilsSettingsRenderer
 */
type UtilsSettingsWrapperProps = {
  embedded?: boolean
  onBack?: () => void
}

const UtilsSettingsWrapper = ({ embedded, onBack }: UtilsSettingsWrapperProps = {}) => {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()

  return (
    <UtilsSettingsRenderer
      isDark={isDark}
      toggleTheme={toggleTheme}
      navigate={navigate}
      embedded={embedded}
      onBack={onBack}
    />
  )
}

export default UtilsSettingsWrapper

