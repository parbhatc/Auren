export type AurenToastKind =
  | 'success'
  | 'error'
  | 'info'
  | 'warning'
  | 'lockout'
  | 'buy'
  | 'sell'
  | 'pending'

export type MdsConnectionToastKind =
  | 'connecting'
  | 'reconnecting'
  | 'connected'
  | 'disconnected'
  | 'limit'

/** Order fill / pending toasts — subset of {@link AurenToastKind}. */
export type OrderToastKind = Extract<AurenToastKind, 'buy' | 'sell' | 'pending'>
