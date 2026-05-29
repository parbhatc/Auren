/** True when env var is "1" or "true". */
export function rithmicEnvFlag(name) {
  const v = process.env[name]
  return v === '1' || v === 'true'
}

/** Options passed to rithmic-api `connect()`. */
export function rithmicConnectOptions(label, opts = {}) {
  return {
    label: String(label || 'Rithmic'),
    log: Boolean(opts.log),
    ...(opts.uri ? { uri: opts.uri } : {}),
    ...(opts.timeoutMs != null ? { timeoutMs: opts.timeoutMs } : {}),
  }
}
