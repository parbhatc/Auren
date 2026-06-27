import { Component } from 'react'
import BacktesterNav, { type BacktesterTab } from './shared/BacktesterNav'

/** @deprecated Use BacktesterNav with activeTab instead */
class BacktesterHeader extends Component<{
  isDark: boolean
  toggleTheme: () => void
  navigate: (path: string) => void
  activeTab?: BacktesterTab
  showAdmin?: boolean
}> {
  render() {
    const { isDark, toggleTheme, navigate, activeTab = 'sessions', showAdmin = false } = this.props
    return (
      <BacktesterNav
        isDark={isDark}
        toggleTheme={toggleTheme}
        navigate={navigate}
        activeTab={activeTab}
        showAdmin={showAdmin}
      />
    )
  }
}

export default BacktesterHeader
