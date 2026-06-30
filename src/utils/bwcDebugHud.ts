/** BWC mounts `.bwc-debug-hud` on document.body; tear it down when leaving the trade terminal. */

type BwcSdkDebug = { destroyDebugHud?: () => void }

function importBwcSdk(): Promise<BwcSdkDebug> {
  const url = '/chart/sdk.js'
  return (new Function('url', 'return import(url)') as (url: string) => Promise<BwcSdkDebug>)(url)
}

export function releaseBwcDebugHud(): void {
  if (typeof document === 'undefined') return
  void importBwcSdk()
    .then((sdk) => sdk.destroyDebugHud?.())
    .catch(() => {
      document.querySelectorAll('.bwc-debug-hud').forEach((el) => el.remove())
    })
}
