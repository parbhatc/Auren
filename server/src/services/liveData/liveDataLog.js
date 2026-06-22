const PREFIX = '[Live Data]'

export function logLiveDataConnected(label) {
  console.log(`${PREFIX} ${label} Connected.`)
}

export function logLiveDataDisconnected(label) {
  console.log(`${PREFIX} ${label} Disconnected.`)
}

export function logLiveDataInfo(message) {
  console.log(`${PREFIX} ${message}`)
}

export function logLiveDataWarn(message) {
  console.warn(`${PREFIX} ${message}`)
}

export function logLiveDataError(provider, message) {
  console.error(`${PREFIX} ${provider} ${message}`)
}
