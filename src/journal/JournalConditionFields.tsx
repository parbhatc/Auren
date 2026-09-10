import { Plus, Trash2 } from 'lucide-react'
import {
  parseLiquiditySweeps,
  serializeLiquiditySweeps,
  parsePdaDeliveries,
  serializePdaDeliveries,
  toTimeInputValue,
  fromTimeInputValue,
  type PlaybookCondition,
  type LiquiditySweepRow,
  type PdaDeliveryRow,
} from './journalConditions'

type Props = {
  conditions: PlaybookCondition[]
  responses: Record<string, string | boolean>
  onChange: (responses: Record<string, string | boolean>) => void
  isDark: boolean
  inputClass: string
}

export default function JournalConditionFields({
  conditions,
  responses,
  onChange,
  isDark,
  inputClass,
}: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {conditions.map((condition) => {
        const value = responses[condition.label]
        const setValue = (next: string | boolean) =>
          onChange({ ...responses, [condition.label]: next })
        if (condition.type === 'boolean')
          return (
            <label key={condition.id} className="text-xs text-[#71717A]">
              {condition.label}
              <select
                aria-label={condition.label}
                value={value === true ? 'yes' : value === false ? 'no' : ''}
                onChange={(event) =>
                  setValue(event.target.value === '' ? '' : event.target.value === 'yes')
                }
                className={`${inputClass} mt-1.5 w-full`}
              >
                <option value="">Not reviewed</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          )
        if (condition.type === 'timeframe')
          return (
            <label key={condition.id} className="text-xs text-[#71717A]">
              {condition.label}
              <select
                aria-label={condition.label}
                value={String(value ?? '')}
                onChange={(event) => setValue(event.target.value)}
                className={`${inputClass} mt-1.5 w-full`}
              >
                <option value="">Select timeframe</option>
                {['30s', '1m', '2m', '3m', '5m', '15m', '30m', '1h', '4h', '1D'].map(
                  (timeframe) => (
                    <option key={timeframe}>{timeframe}</option>
                  )
                )}
              </select>
            </label>
          )
        if (condition.type === 'liquidity_sweep') {
          const sweepRows = parseLiquiditySweeps(value)
          const updateSweep = (index: number, patch: Partial<LiquiditySweepRow>) =>
            setValue(
              serializeLiquiditySweeps(
                sweepRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
              )
            )
          const removeSweep = (index: number) =>
            setValue(
              serializeLiquiditySweeps(sweepRows.filter((_, rowIndex) => rowIndex !== index))
            )
          return (
            <fieldset
              key={condition.id}
              className={`rounded-lg border p-3 sm:col-span-2 ${isDark ? 'border-[#3F3F46]' : 'border-[#D4D4D8]'}`}
            >
              <legend className="px-1 text-xs text-[#71717A]">{condition.label}</legend>
              <p className="mb-3 text-[10px] text-[#71717A]">
                Example: 9:10 AM swept 10:00 AM high at $20,322.75
              </p>
              <div className="space-y-3">
                {sweepRows.map((row, index) => (
                  <div
                    key={`${condition.id}-${index}`}
                    className={`grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_1fr_.8fr_1fr_auto] ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}
                  >
                    <label className="text-[10px] text-[#71717A]">
                      Sweep time
                      <input
                        aria-label={`${condition.label} ${index + 1} sweep time`}
                        type="time"
                        value={toTimeInputValue(row.sweepTime)}
                        onChange={(event) =>
                          updateSweep(index, { sweepTime: fromTimeInputValue(event.target.value) })
                        }
                        className={`${inputClass} mt-1 w-full min-w-0 px-2`}
                      />
                    </label>
                    <label className="text-[10px] text-[#71717A]">
                      Reference time
                      <input
                        aria-label={`${condition.label} ${index + 1} reference time`}
                        type="time"
                        value={toTimeInputValue(row.referenceTime)}
                        onChange={(event) =>
                          updateSweep(index, {
                            referenceTime: fromTimeInputValue(event.target.value),
                          })
                        }
                        className={`${inputClass} mt-1 w-full min-w-0 px-2`}
                      />
                    </label>
                    <label className="text-[10px] text-[#71717A]">
                      Level
                      <select
                        aria-label={`${condition.label} ${index + 1} level`}
                        value={row.level}
                        onChange={(event) =>
                          updateSweep(index, { level: event.target.value as 'high' | 'low' })
                        }
                        className={`${inputClass} mt-1 w-full min-w-0 px-2`}
                      >
                        <option value="high">High</option>
                        <option value="low">Low</option>
                      </select>
                    </label>
                    <label className="text-[10px] text-[#71717A]">
                      Price
                      <input
                        aria-label={`${condition.label} ${index + 1} price`}
                        inputMode="decimal"
                        value={row.price}
                        onChange={(event) =>
                          updateSweep(index, { price: event.target.value.replace(/^\$/, '') })
                        }
                        placeholder="20322.75"
                        className={`${inputClass} mt-1 w-full min-w-0 px-2`}
                      />
                    </label>
                    <button
                      type="button"
                      aria-label={`Remove ${condition.label} ${index + 1}`}
                      onClick={() => removeSweep(index)}
                      className={`mt-5 h-9 rounded-lg border px-2 ${isDark ? 'border-[#3F3F46] text-[#A1A1AA]' : 'border-[#D4D4D8] text-[#52525B]'}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <label className="col-span-2 text-[10px] text-[#71717A] sm:col-span-5">
                      Source level
                      <input
                        aria-label={`${condition.label} ${index + 1} source level`}
                        value={row.sourceLabel || ''}
                        onChange={(event) =>
                          updateSweep(index, { sourceLabel: event.target.value })
                        }
                        placeholder="Asia high, London low, 1h swing…"
                        className={`${inputClass} mt-1 w-full`}
                      />
                    </label>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setValue(
                    serializeLiquiditySweeps([
                      ...sweepRows,
                      { sweepTime: '', referenceTime: '', level: 'high', price: '' },
                    ])
                  )
                }
                className={`mt-3 inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-[11px] font-medium ${isDark ? 'border-[#3F3F46] text-[#D4D4D8]' : 'border-[#D4D4D8] text-[#3F3F46]'}`}
              >
                <Plus className="h-3 w-3" />
                Add sweep
              </button>
            </fieldset>
          )
        }
        if (condition.type === 'pda_delivery') {
          const pdaRows = parsePdaDeliveries(value, responses['HTF PDA candles'])
          const updatePda = (index: number, patch: Partial<PdaDeliveryRow>) =>
            setValue(
              serializePdaDeliveries(
                pdaRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
              )
            )
          const removePda = (index: number) =>
            setValue(serializePdaDeliveries(pdaRows.filter((_, rowIndex) => rowIndex !== index)))
          return (
            <fieldset
              key={condition.id}
              className={`rounded-lg border p-3 sm:col-span-2 ${isDark ? 'border-[#3F3F46]' : 'border-[#D4D4D8]'}`}
            >
              <legend className="px-1 text-xs text-[#71717A]">{condition.label}</legend>
              <p className="mb-3 text-[10px] text-[#71717A]">
                Add every PDA tap separately. Three source candles let the chart measure and draw
                each zone.
              </p>
              <div className="space-y-3">
                {pdaRows.map((row, index) => (
                  <div
                    key={`${condition.id}-${index}`}
                    className={`rounded-lg border p-3 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}
                  >
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.2fr_auto]">
                      <label className="text-[10px] text-[#71717A]">
                        Tap time
                        <input
                          aria-label={`${condition.label} ${index + 1} tap time`}
                          type="time"
                          value={toTimeInputValue(row.time)}
                          onChange={(event) =>
                            updatePda(index, { time: fromTimeInputValue(event.target.value) })
                          }
                          className={`${inputClass} mt-1 w-full`}
                        />
                      </label>
                      <label className="text-[10px] text-[#71717A]">
                        Timeframe
                        <select
                          aria-label={`${condition.label} ${index + 1} timeframe`}
                          value={row.timeframe}
                          onChange={(event) => updatePda(index, { timeframe: event.target.value })}
                          className={`${inputClass} mt-1 w-full`}
                        >
                          <option value="">Select timeframe</option>
                          {['1m', '2m', '3m', '5m', '15m', '30m', '1h', '4h', '1D'].map((item) => (
                            <option key={item}>{item}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10px] text-[#71717A]">
                        PDA
                        <select
                          aria-label={`${condition.label} ${index + 1} PDA`}
                          value={row.pda}
                          onChange={(event) => updatePda(index, { pda: event.target.value })}
                          className={`${inputClass} mt-1 w-full`}
                        >
                          <option value="">Select PDA</option>
                          {[
                            'FVG',
                            'Inversion FVG',
                            'Order Block',
                            'Breaker Block',
                            'Mitigation Block',
                            'Rejection Block',
                            'Balanced Price Range',
                            'Liquidity Void',
                            'Opening Gap',
                            'Other PDA',
                          ].map((item) => (
                            <option key={item}>{item}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        aria-label={`Remove ${condition.label} ${index + 1}`}
                        onClick={() => removePda(index)}
                        className={`mt-5 h-9 rounded-lg border px-2 ${isDark ? 'border-[#3F3F46] text-[#A1A1AA]' : 'border-[#D4D4D8] text-[#52525B]'}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[0, 1, 2].map((candleIndex) => (
                        <label key={candleIndex} className="text-[10px] text-[#71717A]">
                          Candle {candleIndex + 1}
                          <input
                            aria-label={`${condition.label} ${index + 1} candle ${candleIndex + 1}`}
                            type="time"
                            value={toTimeInputValue(row.candles[candleIndex] || '')}
                            onChange={(event) => {
                              const candles = [...row.candles]
                              candles[candleIndex] = fromTimeInputValue(event.target.value)
                              updatePda(index, { candles })
                            }}
                            className={`${inputClass} mt-1 w-full min-w-0 px-2`}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setValue(
                    serializePdaDeliveries([
                      ...pdaRows,
                      { time: '', timeframe: '', pda: '', candles: [] },
                    ])
                  )
                }
                className={`mt-3 inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-[11px] font-medium ${isDark ? 'border-[#3F3F46] text-[#D4D4D8]' : 'border-[#D4D4D8] text-[#3F3F46]'}`}
              >
                <Plus className="h-3 w-3" />
                Add PDA tap
              </button>
            </fieldset>
          )
        }
        if (condition.type === 'smt') {
          const [pair = '', timeframe = '', confirmation = ''] = String(value ?? '').split(
            /\s*@\s*/,
            3
          )
          const setSmt = (nextPair: string, nextFrame: string, nextConfirmation: string) =>
            setValue([nextPair, nextFrame, nextConfirmation].join(' @ '))
          return (
            <fieldset
              key={condition.id}
              className="rounded-lg border border-zinc-500/20 p-3 sm:col-span-2"
            >
              <legend className="px-1 text-xs text-[#71717A]">{condition.label}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs text-[#71717A]">
                  Comparison pair
                  <input
                    aria-label={`${condition.label} pair`}
                    value={pair}
                    placeholder="NQ / ES"
                    onChange={(event) => setSmt(event.target.value, timeframe, confirmation)}
                    className={`${inputClass} mt-1 w-full`}
                  />
                </label>
                <label className="text-xs text-[#71717A]">
                  Timeframe
                  <input
                    aria-label={`${condition.label} timeframe`}
                    value={timeframe}
                    placeholder="1m"
                    onChange={(event) => setSmt(pair, event.target.value, confirmation)}
                    className={`${inputClass} mt-1 w-full`}
                  />
                </label>
                <label className="text-xs text-[#71717A]">
                  Confirmation / close
                  <input
                    aria-label={`${condition.label} confirmation`}
                    value={confirmation}
                    placeholder="9:34 AM · divergence confirmed"
                    onChange={(event) => setSmt(pair, timeframe, event.target.value)}
                    className={`${inputClass} mt-1 w-full`}
                  />
                </label>
              </div>
            </fieldset>
          )
        }
        if (condition.type === 'timeframe_time') {
          const [timeframe = '', savedTime = ''] = String(value ?? '').split(/\s*@\s*/, 2)
          const setCombinedValue = (nextTimeframe: string, nextTime: string) =>
            setValue([nextTimeframe, nextTime].join(' @ '))
          return (
            <fieldset
              key={condition.id}
              className={`rounded-lg border p-3 sm:col-span-2 ${isDark ? 'border-[#3F3F46]' : 'border-[#D4D4D8]'}`}
            >
              <legend className="px-1 text-xs text-[#71717A]">{condition.label}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-[11px] text-[#71717A]">
                  Timeframe
                  <select
                    aria-label={`${condition.label} timeframe`}
                    value={timeframe}
                    onChange={(event) => setCombinedValue(event.target.value, savedTime)}
                    className={`${inputClass} mt-1.5 w-full`}
                  >
                    <option value="">Select timeframe</option>
                    {['30s', '1m', '2m', '3m', '5m', '15m', '30m', '1h', '4h', '1D'].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] text-[#71717A]">
                  Time
                  <input
                    aria-label={`${condition.label} time`}
                    type="time"
                    value={toTimeInputValue(savedTime)}
                    onChange={(event) =>
                      setCombinedValue(timeframe, fromTimeInputValue(event.target.value))
                    }
                    className={`${inputClass} mt-1.5 w-full`}
                  />
                </label>
              </div>
            </fieldset>
          )
        }
        if (condition.type === 'time')
          return (
            <label key={condition.id} className="text-xs text-[#71717A] sm:col-span-2">
              {condition.label}
              <textarea
                aria-label={condition.label}
                value={String(value ?? '')}
                onChange={(event) => setValue(event.target.value)}
                rows={3}
                placeholder="9:13 AM — 15m sweep"
                className={`${inputClass} mt-1.5 h-auto w-full resize-y py-2 leading-5`}
              />
            </label>
          )
        return (
          <label key={condition.id} className="text-xs text-[#71717A]">
            {condition.label}
            <input
              aria-label={condition.label}
              type={condition.type === 'number' ? 'number' : 'text'}
              value={String(value ?? '')}
              onChange={(event) => setValue(event.target.value)}
              className={`${inputClass} mt-1.5 w-full`}
            />
          </label>
        )
      })}
    </div>
  )
}
