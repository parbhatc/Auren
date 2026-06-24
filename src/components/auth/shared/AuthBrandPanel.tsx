import { BarChart3, Shield, Zap } from 'lucide-react'
import Logo from '../../common/Logo'

const highlights = [
  { icon: BarChart3, label: 'Professional charts & execution' },
  { icon: Zap, label: 'Practice accounts with real market data' },
  { icon: Shield, label: 'Built for disciplined trading' },
]

export function AuthBrandPanel({ isDark }: { isDark: boolean }) {
  return (
    <aside
      className={`hidden lg:flex lg:w-[42%] xl:w-[40%] shrink-0 flex-col justify-between p-10 xl:p-14 relative overflow-hidden ${
        isDark
          ? 'bg-gradient-to-br from-slate-950 via-indigo-950/95 to-violet-950'
          : 'bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-700'
      }`}
    >
      <div
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10">
        <Logo isDark compact />
      </div>

      <div className="relative z-10 space-y-6 max-w-md">
        <div>
          <h1
            className={`text-3xl xl:text-4xl font-bold leading-tight tracking-tight ${
              isDark ? 'text-white' : 'text-white'
            }`}
          >
            Trade with clarity.
            <span className="block text-violet-300/90">Improve with purpose.</span>
          </h1>
          <p className={`mt-4 text-base leading-relaxed ${isDark ? 'text-slate-400' : 'text-indigo-100/90'}`}>
            Auren combines charting, practice evals, and performance stats in one focused workspace.
          </p>
        </div>

        <ul className="space-y-3">
          {highlights.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className={`flex items-center gap-3 text-sm ${isDark ? 'text-slate-300' : 'text-indigo-50/95'}`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  isDark ? 'bg-violet-500/15 text-violet-300' : 'bg-white/15 text-white'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>

      <p className={`relative z-10 text-xs ${isDark ? 'text-slate-500' : 'text-indigo-200/70'}`}>
        © {new Date().getFullYear()} Auren
      </p>
    </aside>
  )
}
