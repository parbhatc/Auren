function toPlain(obj) {
  return JSON.parse(
    JSON.stringify(obj, (_, value) => {
      if (value && typeof value === 'object' && typeof value.toNumber === 'function') {
        return value.toNumber()
      }
      return value
    })
  )
}

/** Compact one-line server console trace (no per-packet JSON spam). */
export function isRithmicPacketLogEnabled() {
  return process.env.RITHMIC_ACCOUNTS_LOG === '1'
}

/** Also print full packet bodies to the server console. */
export function isRithmicPacketVerboseLogEnabled() {
  return process.env.RITHMIC_ACCOUNTS_LOG_VERBOSE === '1'
}

/** Include packet trace in GET /api/rithmic/accounts JSON (not extra console output). */
export function isRithmicAccountsDebugResponseEnabled(queryDebug) {
  if (queryDebug === '1' || queryDebug === 'true') return true
  return process.env.RITHMIC_ACCOUNTS_DEBUG === '1'
}

function packetSummary(message, body) {
  if (message === 'ResponseLogin') {
    return `rp_code=${JSON.stringify(body.rp_code)} fcm=${body.fcm_id} ib=${body.ib_id}`
  }
  if (message === 'ResponseAccountRmsInfo') {
    return `account_id=${body.account_id} name=${body.account_name}`
  }
  if (message === 'ResponseAccountList' && body.account_id) {
    return `account_id=${body.account_id}`
  }
  if (body.rp_code) return `rp_code=${JSON.stringify(body.rp_code)}`
  if (body.rq_handler_rp_code) return `rq_handler_rp_code=${JSON.stringify(body.rq_handler_rp_code)}`
  return ''
}

export function buildPacketTraceEntry(packet, direction = 'recv') {
  const message = packet?.constructor?.MESSAGE_NAME ?? 'Unknown'
  const template_id = packet?.template_id ?? null
  let body = {}
  try {
    body =
      typeof packet?.toObject === 'function'
        ? toPlain(packet.toObject())
        : toPlain(packet ?? {})
  } catch {
    body = { _error: 'could not serialize packet' }
  }

  return {
    direction,
    message,
    template_id,
    summary: packetSummary(message, body),
    body,
  }
}

export function countPacketsByType(trace) {
  const counts = {}
  for (const entry of trace) {
    const key = `${entry.message}:${entry.template_id}`
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}

/** Single grouped console block per /accounts request. */
export function printRithmicAccountsSession({ uri, trace, outcome, extra }) {
  if (!isRithmicPacketLogEnabled() || !trace?.length) return

  const counts = countPacketsByType(trace)
  console.log('\n[rithmic-accounts] ─── session trace ───')
  if (uri) console.log(`gateway: ${uri}`)
  if (outcome) console.log(`outcome: ${outcome}`)
  if (extra) console.log(extra)

  for (const entry of trace) {
    const hint = entry.summary ? ` — ${entry.summary}` : ''
    console.log(
      `  ${entry.direction.padEnd(4)} ${entry.message} (${entry.template_id})${hint}`
    )
  }

  console.log('[rithmic-accounts] counts:', counts)

  if (isRithmicPacketVerboseLogEnabled()) {
    console.log('[rithmic-accounts] --- verbose bodies ---')
    for (const entry of trace) {
      console.log(`// ${entry.direction} ${entry.message} (${entry.template_id})`)
      console.log(JSON.stringify(entry.body, null, 2))
    }
  }

  console.log('[rithmic-accounts] ─────────────────────\n')
}
