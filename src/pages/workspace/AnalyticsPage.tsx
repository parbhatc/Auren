import { lazy, Suspense, useEffect, useState } from 'react'
import { Blocks, BookOpenCheck, Check, Clock3, Plus, Trash2 } from 'lucide-react'
import { journalAPI, type JournalBuildingBlockRecord } from '../../api/journal.api'
import { useDisplayUnit } from '../../contexts/DisplayUnitContext'
import { useTheme } from '../../hooks/useTheme'
import { useActivePracticeData } from '../../hooks/useActivePracticeData'
import { WorkspaceShell, PageHeading, Surface } from '../../components/layout/WorkspacePrimitives'
import {
  conditionTypeLabel,
  BUILDING_BLOCK_DEFINITIONS,
  playbookFromRecord,
  type Playbook,
  type PlaybookCondition,
} from '../../journal/journalConditions'

const JournalAnalyticsPanel = lazy(() => import('../../journal/JournalAnalyticsPanel'))

export default function AnalyticsPage() {
  const { isDark } = useTheme()
  const { account, stats } = useActivePracticeData()
  const { format } = useDisplayUnit()
  // Unowned legacy localStorage data must never migrate into another signed-in user.
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [customBlocks, setCustomBlocks] = useState<JournalBuildingBlockRecord[]>([])
  const [playbookError, setPlaybookError] = useState('')
  const [builderTab, setBuilderTab] = useState<'playbooks' | 'blocks'>('playbooks')
  const [draft, setDraft] = useState('')
  const [blockNameDraft, setBlockNameDraft] = useState('')
  const [blockDescriptionDraft, setBlockDescriptionDraft] = useState('')
  const [blockTypeDraft, setBlockTypeDraft] = useState<PlaybookCondition['type']>('liquidity_sweep')
  const [playbookBlockDrafts, setPlaybookBlockDrafts] = useState<Record<string, string>>({})
  const [playbookDescriptionDrafts, setPlaybookDescriptionDrafts] = useState<Record<string, string>>({})
  const [playbookRulesDrafts, setPlaybookRulesDrafts] = useState<Record<string, string>>({})
  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      journalAPI.listStrategies(controller.signal),
      journalAPI.listBuildingBlocks(controller.signal),
    ])
      .then(([records, blocks]) => {
        if (!controller.signal.aborted) {
          setPlaybooks(records.map(playbookFromRecord))
          setPlaybookDescriptionDrafts(Object.fromEntries(records.map((record) => [record.id, record.description || ''])))
          setPlaybookRulesDrafts(Object.fromEntries(records.map((record) => {
            let rules: unknown = record.invalidation_rules
            try { if (typeof rules === 'string') rules = JSON.parse(rules) } catch { rules = [] }
            return [record.id, Array.isArray(rules) ? rules.join('\n') : '']
          })))
          setCustomBlocks(blocks)
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted && error?.name !== 'AbortError')
          setPlaybookError(
            'Playbooks could not be loaded. Refresh to retry; saved playbooks have not changed.'
          )
      })
    return () => controller.abort()
  }, [])
  const runPlaybookChange = async (action: () => Promise<void>) => {
    setPlaybookError('')
    try {
      await action()
    } catch {
      setPlaybookError('The playbook change could not be saved. Please try again.')
    }
  }
  const addPlaybook = async () => {
    const name = draft.trim()
    if (!name || playbooks.some((item) => item.name.toLowerCase() === name.toLowerCase())) return
    const created = await journalAPI.createStrategy(name, [])
    setPlaybooks((items) => [...items, { id: created.id, name, description: '', rules: [], conditions: [] }])
    setDraft('')
  }
  const addCondition = async (playbookId: string) => {
    const selection = playbookBlockDrafts[playbookId] || 'preset:liquidity_sweep'
    const [source, value] = selection.split(':', 2)
    const customBlock = source === 'custom' ? customBlocks.find((block) => block.id === value) : null
    const preset = source === 'preset'
      ? BUILDING_BLOCK_DEFINITIONS.find((block) => block.type === value)
      : null
    const type = (customBlock?.type || preset?.type) as PlaybookCondition['type'] | undefined
    const condition = customBlock?.name || preset?.label
    const playbook = playbooks.find((item) => item.id === playbookId)
    if (
      !playbook ||
      !type ||
      !condition ||
      playbook.conditions.some((entry) => entry.label.toLowerCase() === condition.toLowerCase())
    )
      return
    const newCondition: PlaybookCondition = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `block-${Date.now()}`,
      label: condition,
      type,
    }
    const conditions = [...playbook.conditions, newCondition]
    await journalAPI.updateStrategy(playbook.id, playbook.name, conditions, playbook.description, playbook.rules)
    setPlaybooks((items) =>
      items.map((item) => (item.id === playbookId ? { ...item, conditions } : item))
    )
  }
  const addCustomBlock = async () => {
    const name = blockNameDraft.trim()
    if (!name || customBlocks.some((block) => block.name.toLowerCase() === name.toLowerCase())) return
    const created = await journalAPI.createBuildingBlock(
      name,
      blockTypeDraft,
      blockDescriptionDraft.trim()
    )
    setCustomBlocks((blocks) => [...blocks, created])
    setBlockNameDraft('')
    setBlockDescriptionDraft('')
  }
  const deleteCustomBlock = async (block: JournalBuildingBlockRecord) => {
    await journalAPI.deleteBuildingBlock(block.id)
    setCustomBlocks((blocks) => blocks.filter((item) => item.id !== block.id))
  }
  const removeCondition = async (playbook: Playbook, condition: PlaybookCondition) => {
    const conditions = playbook.conditions.filter((entry) => entry.id !== condition.id)
    await journalAPI.updateStrategy(playbook.id, playbook.name, conditions, playbook.description, playbook.rules)
    setPlaybooks((items) =>
      items.map((item) => (item.id === playbook.id ? { ...item, conditions } : item))
    )
  }
  const deletePlaybook = async (playbook: Playbook) => {
    await journalAPI.deleteStrategy(playbook.id)
    setPlaybooks((items) => items.filter((item) => item.id !== playbook.id))
  }
  const savePlaybookDefinition = async (playbook: Playbook) => {
    const description = (playbookDescriptionDrafts[playbook.id] ?? playbook.description).trim()
    const rules = (playbookRulesDrafts[playbook.id] ?? playbook.rules.join('\n'))
      .split('\n')
      .map((rule) => rule.trim())
      .filter(Boolean)
    await journalAPI.updateStrategy(playbook.id, playbook.name, playbook.conditions, description, rules)
    setPlaybooks((items) => items.map((item) => item.id === playbook.id ? { ...item, description, rules } : item))
  }
  const trades = stats.trades ?? []
  const hourly = Array.from({ length: 8 }, (_, index) => {
    const hour = index + 8
    const group = trades.filter((trade) => new Date(trade.entryTime).getHours() === hour)
    return {
      hour,
      value: group.length
        ? (group.filter((trade) => trade.pnl > 0).length / group.length) * 100
        : 0,
    }
  })

  return (
    <WorkspaceShell>
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
        <PageHeading
          eyebrow="Analytics and playbooks"
          title="Turn execution into a repeatable process"
          description="Compare setups, quantify behavioral mistakes, and find the time windows where your process performs best."
        />
        {playbookError && (
          <p role="alert" className="mb-4 text-sm text-red-500">
            {playbookError}
          </p>
        )}
        <div className={`mb-4 flex w-full gap-1 rounded-xl border p-1 sm:w-fit ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#F4F4F5]'}`} role="tablist" aria-label="Playbook tools">
          {([
            ['playbooks', 'Playbooks', BookOpenCheck],
            ['blocks', 'Building blocks', Blocks],
          ] as const).map(([value, label, Icon]) => {
            const selected = builderTab === value
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setBuilderTab(value)}
                className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition sm:flex-none ${selected ? isDark ? 'bg-[#27272A] text-[#FAFAFA] shadow-sm' : 'bg-white text-[#09090B] shadow-sm' : 'text-[#71717A] hover:text-[#A1A1AA]'}`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {value === 'playbooks' && playbooks.length > 0 && (
                  <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] text-blue-500">{playbooks.length}</span>
                )}
                {value === 'blocks' && customBlocks.length > 0 && (
                  <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] text-blue-500">{customBlocks.length}</span>
                )}
              </button>
            )
          })}
        </div>
        <div className="grid gap-4">
          {builderTab === 'blocks' ? (
          <Surface className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className={`rounded-lg p-2 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                <Blocks className="h-4 w-4 text-blue-500" />
              </span>
              <div>
                <h2 className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>
                  Building block library
                </h2>
                <p className="mt-1 text-xs text-[#71717A]">
                  Create reusable concepts here, then combine them into any playbook below.
                </p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#71717A]">
                Block formats
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {BUILDING_BLOCK_DEFINITIONS.map((block) => (
                  <div key={block.type} className={`rounded-lg border p-3 ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}>
                    <p className={`text-xs font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{block.label}</p>
                    <p className="mt-1 text-[11px] leading-4 text-[#71717A]">{block.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className={`mt-4 rounded-lg border p-3 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}>
              <p className={`text-xs font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>
                Create a custom block
              </p>
              <form
                className="mt-3 grid gap-2 lg:grid-cols-[minmax(10rem,1fr)_10rem_minmax(12rem,1.4fr)_auto]"
                onSubmit={(event) => {
                  event.preventDefault()
                  void runPlaybookChange(addCustomBlock)
                }}
              >
                <input
                  aria-label="Custom building block name"
                  value={blockNameDraft}
                  onChange={(event) => setBlockNameDraft(event.target.value)}
                  placeholder="Name, e.g. IFVG"
                  className={`h-11 min-w-0 rounded-lg border px-3 text-sm outline-none focus:border-blue-500 ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`}
                />
                <select
                  aria-label="Custom building block format"
                  value={blockTypeDraft}
                  onChange={(event) => setBlockTypeDraft(event.target.value as PlaybookCondition['type'])}
                  className={`h-11 rounded-lg border px-3 text-xs outline-none focus:border-blue-500 ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`}
                >
                  {BUILDING_BLOCK_DEFINITIONS.map((block) => (
                    <option key={block.type} value={block.type}>{block.label} format</option>
                  ))}
                </select>
                <input
                  aria-label="Custom building block description"
                  value={blockDescriptionDraft}
                  onChange={(event) => setBlockDescriptionDraft(event.target.value)}
                  placeholder="What evidence belongs in this block?"
                  className={`h-11 min-w-0 rounded-lg border px-3 text-sm outline-none focus:border-blue-500 ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`}
                />
                <button type="submit" disabled={!blockNameDraft.trim()} className={`${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'} inline-flex h-11 items-center justify-center gap-1 rounded-lg px-4 text-xs font-semibold disabled:opacity-50`}>
                  <Plus className="h-3.5 w-3.5" /> Create block
                </button>
              </form>
            </div>
            {customBlocks.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#71717A]">Your custom blocks</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {customBlocks.map((block) => (
                    <div key={block.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${isDark ? 'border-[#3F3F46] bg-[#18181B]' : 'border-[#D4D4D8] bg-white'}`}>
                      <div>
                        <p className={`text-xs font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{block.name}</p>
                        <p className="text-[10px] text-[#71717A]">{conditionTypeLabel(block.type as PlaybookCondition['type'])}{block.description ? ` · ${block.description}` : ''}</p>
                      </div>
                      <button type="button" onClick={() => void runPlaybookChange(() => deleteCustomBlock(block))} aria-label={`Delete custom building block ${block.name}`} className={`rounded p-1 ${isDark ? 'text-[#71717A] hover:text-red-400' : 'text-[#A1A1AA] hover:text-red-600'}`}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Surface>
          ) : (
          <Surface className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2
                  className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}
                >
                  Playbook builder
                </h2>
                <p className="mt-1 text-xs text-[#71717A]">
                  Build each playbook from blocks such as Sweep, PDA delivery, IFVG, and SMT.
                </p>
              </div>
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  void runPlaybookChange(addPlaybook)
                }}
              >
                <input
                  aria-label="New playbook name"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="New playbook name"
                  className={`h-11 min-w-0 flex-1 appearance-none rounded-lg border px-3 text-base outline-none focus:border-blue-500 sm:h-9 sm:w-56 sm:text-sm ${isDark ? 'border-[#27272A] bg-[#18181B] text-[#FAFAFA]' : 'border-[#E4E4E7] bg-white text-[#09090B]'}`}
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className={`${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'} inline-flex h-11 items-center gap-1 rounded-lg px-3 text-xs font-semibold disabled:opacity-50 sm:h-9`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </form>
            </div>
            <div className={`mt-4 rounded-lg border px-3 py-2 text-xs ${isDark ? 'border-blue-500/20 bg-blue-500/5 text-[#A1A1AA]' : 'border-blue-200 bg-blue-50 text-[#52525B]'}`}>
              A building block groups its own evidence. For example, one Sweep block can contain a
              1m sweep, 15m sweep, 1h sweep, Asia sweep, or London sweep.
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {playbooks.map((playbook) => (
                <article
                  key={playbook.id}
                  className={`rounded-lg border p-4 ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3
                        className={
                          isDark
                            ? 'text-sm font-semibold text-[#FAFAFA]'
                            : 'text-sm font-semibold text-[#09090B]'
                        }
                      >
                        {playbook.name}
                      </h3>
                      <p className="mt-1 text-xs text-[#71717A]">
                        {playbook.conditions.length} building{' '}
                        {playbook.conditions.length === 1 ? 'block' : 'blocks'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpenCheck className="h-4 w-4 text-blue-500" />
                      <button
                        type="button"
                        onClick={() => void runPlaybookChange(() => deletePlaybook(playbook))}
                        aria-label={`Delete ${playbook.name}`}
                        className={`rounded-md p-1.5 ${isDark ? 'text-[#71717A] hover:bg-red-500/10 hover:text-red-400' : 'text-[#A1A1AA] hover:bg-red-50 hover:text-red-600'}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <label className="grid gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#71717A]">
                      Description
                      <textarea
                        aria-label={`Description for ${playbook.name}`}
                        rows={3}
                        value={playbookDescriptionDrafts[playbook.id] ?? playbook.description}
                        onChange={(event) => setPlaybookDescriptionDrafts((items) => ({ ...items, [playbook.id]: event.target.value }))}
                        placeholder="What must happen, and why does this setup work?"
                        className={`resize-y rounded-lg border px-3 py-2 text-xs font-normal normal-case tracking-normal outline-none focus:border-blue-500 ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`}
                      />
                    </label>
                    <label className="grid gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#71717A]">
                      Defined rules · one per line
                      <textarea
                        aria-label={`Rules for ${playbook.name}`}
                        rows={5}
                        value={playbookRulesDrafts[playbook.id] ?? playbook.rules.join('\n')}
                        onChange={(event) => setPlaybookRulesDrafts((items) => ({ ...items, [playbook.id]: event.target.value }))}
                        placeholder="Write one required or invalidation rule per line."
                        className={`resize-y rounded-lg border px-3 py-2 text-xs font-normal normal-case tracking-normal outline-none focus:border-blue-500 ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void runPlaybookChange(() => savePlaybookDefinition(playbook))}
                      className={`h-9 justify-self-start rounded-lg px-3 text-xs font-semibold ${isDark ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'}`}
                    >
                      Save description & rules
                    </button>
                  </div>
                  {playbook.conditions.length ? (
                    <ul className="mt-4 space-y-2">
                      {playbook.conditions.map((condition) => (
                        <li
                          key={condition.id}
                          className={`flex items-center gap-2 text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}
                        >
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-emerald-500/30 bg-emerald-500/10">
                            <Check className="h-2.5 w-2.5 text-emerald-500" />
                          </span>
                          <span className="min-w-0 flex-1">{condition.label}</span>
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${isDark ? 'border-[#3F3F46] text-[#71717A]' : 'border-[#E4E4E7] text-[#71717A]'}`}
                          >
                            {conditionTypeLabel(condition.type)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              void runPlaybookChange(() => removeCondition(playbook, condition))
                            }
                            aria-label={`Remove building block ${condition.label}`}
                            className={`rounded p-1 ${isDark ? 'text-[#71717A] hover:text-red-400' : 'text-[#A1A1AA] hover:text-red-600'}`}
                          >
                            <Trash2 className="h-3 w-3" strokeWidth={1.75} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-xs text-[#71717A]">
                      Add the first building block in this playbook.
                    </p>
                  )}
                  <form
                    className="mt-4 flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void runPlaybookChange(() => addCondition(playbook.id))
                    }}
                  >
                    <select
                      aria-label={`Building block for ${playbook.name}`}
                      value={playbookBlockDrafts[playbook.id] || 'preset:liquidity_sweep'}
                      onChange={(event) =>
                        setPlaybookBlockDrafts((items) => ({
                          ...items,
                          [playbook.id]: event.target.value,
                        }))
                      }
                      className={`h-11 min-w-0 flex-1 appearance-none rounded-lg border px-3 text-xs outline-none focus:border-blue-500 sm:h-9 ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`}
                    >
                      <optgroup label="Block formats">
                        {BUILDING_BLOCK_DEFINITIONS.map((block) => (
                          <option key={block.type} value={`preset:${block.type}`}>{block.label}</option>
                        ))}
                      </optgroup>
                      {customBlocks.length > 0 && (
                        <optgroup label="Your custom blocks">
                          {customBlocks.map((block) => (
                            <option key={block.id} value={`custom:${block.id}`}>{block.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <button
                      type="submit"
                      className={`h-11 rounded-lg px-3 text-xs font-semibold disabled:opacity-50 sm:h-9 ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}
                    >
                      Add to playbook
                    </button>
                  </form>
                </article>
              ))}
            </div>
          </Surface>
          )}
        </div>
        <Suspense fallback={<p role="status">Loading analytics…</p>}>
          <JournalAnalyticsPanel />
        </Suspense>
        <div className="mt-4">
          <Surface className="p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-blue-500" />
              <h2
                className={
                  isDark
                    ? 'text-sm font-semibold text-[#FAFAFA]'
                    : 'text-sm font-semibold text-[#09090B]'
                }
              >
                Performance by time of day
              </h2>
            </div>
            <div className="mt-6 flex h-40 items-end gap-2">
              {hourly.map((item) => (
                <div key={item.hour} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t bg-blue-500"
                    style={{ height: `${Math.max(3, item.value)}%` }}
                  />
                  <span className="text-[10px] text-[#71717A]">{item.hour}:00</span>
                </div>
              ))}
            </div>
          </Surface>
        </div>
      </main>
    </WorkspaceShell>
  )
}
