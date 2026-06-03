/** Turn Rithmic rp_code payloads like "13, permission denied" into user-facing text. */
export function formatRithmicFailureMessage(rp_code) {
  const parts = Array.isArray(rp_code)
    ? rp_code.filter(Boolean).map((p) => String(p).trim())
    : [String(rp_code ?? '').trim()].filter(Boolean)

  if (parts.length >= 2) {
    return parts.slice(1).join(', ')
  }

  const joined = parts.join(', ')
  const match = joined.match(/^\d+\s*,\s*(.+)$/i)
  if (match?.[1]) {
    return match[1].trim()
  }

  return joined || null
}
