import type { Playbook, PlaybookCondition } from './journalConditions'

const sweep: PlaybookCondition = {
  id: 'liquidity-sweep',
  label: 'Liquidity sweep',
  type: 'liquidity_sweep',
}
const pda: PlaybookCondition = { id: 'htf-pda', label: 'HTF PDA delivery', type: 'pda_delivery' }
const ifvg: PlaybookCondition = { id: 'ifvg', label: 'IFVG', type: 'timeframe_time' }
const smt: PlaybookCondition = { id: 'smt', label: 'SMT', type: 'smt' }
const targets: PlaybookCondition = { id: 'clear-targets', label: 'Clear targets', type: 'boolean' }
const targetDetail: PlaybookCondition = {
  id: 'target-detail',
  label: 'Target level / reason',
  type: 'text',
}

// Reusable blank checklists based on the user's recap structure, never sample trades.
export const JOURNAL_TEMPLATES: Playbook[] = [
  {
    id: 'template-session-ifvg',
    name: 'London / Asia sweep + IFVG',
    conditions: [sweep, ifvg, targets, targetDetail],
  },
  {
    id: 'template-htf-ifvg',
    name: 'Sweep + HTF FVG + IFVG',
    conditions: [sweep, pda, ifvg, targets, targetDetail],
  },
  {
    id: 'template-smt-ifvg',
    name: 'Liquidity sweep + HTF FVG + SMT + IFVG',
    conditions: [sweep, pda, smt, ifvg, targets, targetDetail],
  },
  {
    id: 'template-retest',
    name: 'Sweep + HTF FVG + IFVG + SMT + FVG retest',
    conditions: [
      sweep,
      pda,
      ifvg,
      smt,
      { id: 'retest', label: 'FVG retest', type: 'timeframe_time' },
      targets,
      targetDetail,
    ],
  },
]
