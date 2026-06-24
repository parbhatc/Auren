import type { ReactNode } from 'react'

/** Content-only shell when admin tools are embedded in the practice hub. */
export function AdminEmbeddedShell({ children }: { children: ReactNode }) {
  return <div className="w-full animate-fade-in">{children}</div>
}
