import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { authLinkClass } from './authTheme'

export function AuthBackLink({
  to,
  label,
  isDark,
}: {
  to: string
  label: string
  isDark: boolean
}) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:underline ${authLinkClass(isDark)}`}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Link>
  )
}
