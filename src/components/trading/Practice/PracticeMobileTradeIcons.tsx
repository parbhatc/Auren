/** Compact trade pad — pop out to draggable widget. */
export function FloatingTradePadIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      width="16"
      height="16"
      className={className}
      aria-hidden
    >
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M7.5 4.5h1M4.5 7.5v1M11.5 7.5v1M7.5 11.5h1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <rect x="2" y="9" width="12" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}
