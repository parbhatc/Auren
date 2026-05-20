import { panelCardClass } from '../../../../styles/aurenTheme'

export default function HubSettingsSkeleton({ isDark, rows = 2 }: { isDark: boolean; rows?: number }) {
  const card = panelCardClass(isDark)
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`${card} h-28 sm:h-32`}>
          <div className={`h-4 w-1/3 rounded-lg mb-3 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
          <div className={`h-3 w-2/3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
        </div>
      ))}
    </div>
  )
}
