/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.pine?raw' {
  const content: string
  export default content
}

declare module '/chart/sdk.js' {
  export function bootChart(options?: Record<string, unknown>): Promise<Record<string, unknown>>
  export function registerIndicator(def: unknown): void
  export function registerTradeContextActions(handlers: Record<string, unknown>): void
  export function clearChartContextActions(): void
}

declare module '/testing/js/indicators/fvg/FvgIndicator.js' {
  const FvgIndicator: unknown
  export default FvgIndicator
}

declare module '/testing/js/indicators/levels/LevelsIndicator.js' {
  const LevelsIndicator: unknown
  export default LevelsIndicator
}

declare module '/testing/js/indicators/inputPanels.js' {
  export function registerTestingInputPanels(): void
}

