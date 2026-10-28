/**
 * Share only pending reads. Settled values (especially auth/account metadata)
 * are never cached, so refreshes still observe the server's current state.
 */
export function createSingleFlight() {
  const pending = new Map()
  return (key, load) => {
    const existing = pending.get(key)
    if (existing) return existing

    const request = Promise.resolve().then(load)
    pending.set(key, request)
    const clear = () => {
      if (pending.get(key) === request) pending.delete(key)
    }
    request.then(clear, clear)
    return request
  }
}
