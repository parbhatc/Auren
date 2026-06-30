export type BwcReplayState = {
  active: boolean
  selectedBarIndex: number | null
  currentBarIndex: number | null
  selectedBarTime: number | null
  currentBarTime: number | null
  selectingBar: boolean
  playing: boolean
  speed: number
  stepInterval: string
  autoSelectInterval: boolean
}

export type BwcReplayApi = {
  getState: () => BwcReplayState | null
  isActive: () => boolean
  subscribe: (fn: (state: BwcReplayState) => void) => () => void
  enter: () => void
  exit: () => void
  toggle: () => void
  toggleSelectBar: () => void
  play: () => void
  pause: () => void
  stepForward: () => void
  jumpToEnd: () => void
  setSpeed: (speed: number) => void
  setStepInterval: (stepInterval: string) => void
  setAutoSelectInterval: (on: boolean) => void
  setReplayPosition?: (pos: {
    selectedBarIndex: number
    currentBarIndex: number
    selectedBarTime: number
    currentBarTime: number
  }) => void
  getMaxBarIndex: () => number | null
  hasForwardBars: () => boolean
  getCursorBarIndex: () => number | null
}
