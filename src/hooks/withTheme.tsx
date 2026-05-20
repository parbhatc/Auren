import { Component, ComponentType } from 'react'

/**
 * Higher-Order Component to inject theme props into class components
 * Note: This is a placeholder - HOCs can't use hooks directly
 * Consider using a render prop or context pattern instead
 */
export function withTheme<P extends object>(
  WrappedComponent: ComponentType<P & { isDark: boolean; toggleTheme: () => void }>
) {
  return class WithTheme extends Component<P> {
    render() {
      // This implementation doesn't work with hooks
      // The component should be refactored to use ThemeProvider context instead
      const themeProps = { isDark: false, toggleTheme: () => {} }
      return <WrappedComponent {...this.props} {...themeProps} />
    }
  }
}

