import { lazy, Suspense } from 'react'
import { useTheme } from '../../hooks/useTheme'
import {
  WorkspaceShell,
  PageHeading,
  Surface,
} from '../../components/layout/WorkspacePrimitives'

const EconomicNewsView = lazy(() =>
  import('../../components/trading/shared/news/EconomicNewsView').then(
    (module) => ({
      default: module.EconomicNewsView,
    })
  )
)

export default function NewsWorkspacePage() {
  const { isDark } = useTheme()
  return (
    <WorkspaceShell>
      <main className="mx-auto max-w-[1400px] px-4 py-7 sm:px-7 sm:py-9 xl:px-9">
        <PageHeading
          eyebrow="Market context"
          title="Economic calendar"
          description="Plan your session around upcoming USD releases and the events that move the market."
        />
        <Surface className="overflow-hidden p-3 sm:p-5">
          <Suspense fallback={<p role="status">Loading news…</p>}>
            <EconomicNewsView isDark={isDark} />
          </Suspense>
        </Surface>
      </main>
    </WorkspaceShell>
  )
}
