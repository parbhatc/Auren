import type { ReactNode } from 'react'
import { SettingsStatusPill } from '../../components/settings/SettingsFormPrimitives'

export type BasePropFirmProps = {
  isDark: boolean
  connectedAs?: string | null
  children: ReactNode
}

/** Layout shell for a single provider connect form (status + fields). */
export default function BasePropFirm({ isDark, connectedAs, children }: BasePropFirmProps) {
  return (
    <div className="space-y-3 pt-1">
      {connectedAs ? (
        <SettingsStatusPill isDark={isDark} tone="success">
          {connectedAs}
        </SettingsStatusPill>
      ) : null}
      {children}
    </div>
  )
}
