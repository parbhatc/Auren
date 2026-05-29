/** Shared props for market-data provider connect panels. */
export interface PropFirmConnectCallbacks {
  isDark: boolean
  onRefresh: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
}
