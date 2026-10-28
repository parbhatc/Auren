type AuthEvent = { kind: 'token-change' } | { kind: 'unauthorized' | 'verify-current'; token: string }
const listeners = new Set<(event: AuthEvent) => void>()

export function publishAuthEvent(event: AuthEvent) {
  for (const listener of listeners) listener(event)
}

export function subscribeAuthEvents(listener: (event: AuthEvent) => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
