import { useTheme } from '../../../hooks/useTheme'
import { useNavigate } from 'react-router-dom'
import Renderer from './Renderer'

/**
 * Utils Settings wrapper component
 * Provides theme context to UtilsSettingsRenderer
 */
type UtilsSettingsWrapperProps = {
  embedded?: boolean
  onBack?: () => void
}

const Wrapper = ({ embedded, onBack }: UtilsSettingsWrapperProps = {}) => {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()

  return (
    <Renderer
      isDark={isDark}
      toggleTheme={toggleTheme}
      navigate={navigate}
      embedded={embedded}
      onBack={onBack}
    />
  )
}

export default Wrapper

