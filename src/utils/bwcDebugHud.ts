/** BWC mounts `.bwc-debug-hud` on document.body; tear it down when leaving the trade terminal. */

let destroyLoadedHud: (() => void) | null = null

/** Register cleanup only after a chart owner has actually loaded the SDK. */
export function registerBwcDebugHudCleanup(destroy: () => void): void {
  destroyLoadedHud = destroy
}

export function releaseBwcDebugHud(): void {
  if (typeof document === 'undefined') return
  // Initial route restoration also runs on pages that have never had a chart.
  // Cleanup must not download/evaluate the chart graph to remove an absent HUD.
  try { destroyLoadedHud?.() } catch { /* Remove orphaned markup below. */ }
  document.querySelectorAll('.bwc-debug-hud').forEach((el) => el.remove())
}
