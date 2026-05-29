/** Turn Rithmic rp_code payloads like "13, permission denied" into user-facing text. */
export function formatRithmicLoginMessage(message?: string | null): string {
  const raw = String(message ?? '').trim()
  if (!raw) return ''

  const codeThenText = raw.match(/^\d+\s*,\s*(.+)$/i)
  if (codeThenText?.[1]) {
    return capitalizeSentence(codeThenText[1].trim())
  }

  return capitalizeSentence(raw)
}

function capitalizeSentence(text: string): string {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}
