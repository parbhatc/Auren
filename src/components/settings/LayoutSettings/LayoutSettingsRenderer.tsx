import { Component } from 'react'
import EditLayoutPage from './EditLayoutPage'
import { LayoutSettingsProps } from '../../../types/tradingLayout'

/**
 * Layout Settings renderer component
 * Uses EditLayoutPage for full layout editing functionality
 */
class LayoutSettingsRenderer extends Component<LayoutSettingsProps> {
  render() {
    return <EditLayoutPage />
  }
}

export default LayoutSettingsRenderer
