/** PineScript-style input definitions for `defineIndicator`. */

export type PineInputDef = {
  id: string
  name: string
  type: 'bool' | 'integer' | 'float' | 'color' | 'text'
  defval: unknown
  min?: number
  max?: number
  step?: number
  options?: string[]
  group?: string
  inline?: string
}

function slugId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

type InputOpts = {
  id?: string
  min?: number
  max?: number
  step?: number
  group?: string
  inline?: string
  options?: string[]
}

function base(name: string, opts?: InputOpts): Pick<PineInputDef, 'id' | 'name' | 'group' | 'inline'> {
  return {
    id: opts?.id ?? slugId(name),
    name,
    group: opts?.group,
    inline: opts?.inline,
  }
}

/** PineScript-style input builders — use inside `defineIndicator({ inputs: [...] })`. */
export const input = {
  bool(name: string, defval: boolean, opts?: InputOpts): PineInputDef {
    return { ...base(name, opts), type: 'bool', defval }
  },

  int(name: string, defval: number, opts?: InputOpts): PineInputDef {
    return { ...base(name, opts), type: 'integer', defval, min: opts?.min, max: opts?.max }
  },

  float(name: string, defval: number, opts?: InputOpts): PineInputDef {
    return {
      ...base(name, opts),
      type: 'float',
      defval,
      min: opts?.min,
      max: opts?.max,
      step: opts?.step,
    }
  },

  color(name: string, defval: string, opts?: InputOpts): PineInputDef {
    return { ...base(name, opts), type: 'color', defval }
  },

  string(name: string, defval: string, opts?: InputOpts): PineInputDef {
    return { ...base(name, opts), type: 'text', defval, options: opts?.options }
  },
}
