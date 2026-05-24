export type PineMetaInput = {
  id: string
  type: 'bool' | 'integer' | 'int' | 'float' | 'color' | 'text'
  name: string
  defval: unknown
  min?: number
  max?: number
  step?: number
  options?: string[]
  group?: string
}

export type PineMetaPlot = {
  type: string
  visible?: boolean
  color?: string
}

export type PineScriptMeta = {
  id: string
  title: string
  description?: string
  overlay?: boolean
  plot?: PineMetaPlot
  inputs?: PineMetaInput[]
}
