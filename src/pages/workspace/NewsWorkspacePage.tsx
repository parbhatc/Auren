import { lazy, Suspense } from 'react'
import { useTheme } from '../../hooks/useTheme'
import { WorkspaceShell, PageHeading, Surface } from '../../components/layout/WorkspacePrimitives'

const EconomicNewsView = lazy(() =>
  import('../../components/trading/shared/news/EconomicNewsView').then((module) => ({
    default: module.EconomicNewsView,
  }))
)

export default function NewsWorkspacePage() {
  const { isDark } = useTheme()
  return (
    <WorkspaceShell>
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        <PageHeading
          eyebrow="Economic news"
          title="USD economic schedule"
          description="Filter low, medium, and high-impact releases. High-impact events use a restrained amber treatment for fast risk recognition."
        />
        <Surface className="overflow-hidden p-2 sm:p-4">
          <Suspense fallback={<p role="status">Loading news…</p>}>
            <EconomicNewsView isDark={isDark} />
          </Suspense>
        </Surface>
      </main>
    </WorkspaceShell>
  )
}
