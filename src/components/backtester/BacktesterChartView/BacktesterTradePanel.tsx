import { Minus, Plus } from 'lucide-react'

import {

  PRACTICE_CONTRACT_QTY_PRESET_CHIP_LIMIT,

  PRACTICE_CONTRACT_QTY_PRESETS,

} from '../../../constants/practice'

import { getTradePanelSettings } from '../../../constants/tradePanelSettings'

import { DomActionButtons } from '../../trading/shared/pad/DomActionButtons'

import { practiceTradePanelClass } from '../../trading/Practice/practiceTradeTheme'

import type { TradePanelProps } from '../../../types/tradePanel'



/** Standalone trade panel — separate from replay controls. */

export default function BacktesterTradePanel({

  props,

  isDark,

  maxQty = 15,

}: {

  props: TradePanelProps

  isDark: boolean

  maxQty?: number

}) {

  const panelUi = getTradePanelSettings()

  const qty = Number(props.quantity) || 1

  const heading = isDark ? 'text-white' : 'text-slate-900'

  const sectionBorder = isDark ? 'border-slate-700' : 'border-slate-200'



  return (

    <section

      className={`shrink-0 flex flex-col overflow-hidden ${practiceTradePanelClass(isDark)}`}

      aria-label="Trade controls"

    >

      <div className={`px-3 py-2 border-b ${sectionBorder} shrink-0`}>

        <h3 className={`text-sm font-bold ${heading}`}>Trade</h3>

      </div>

      <div className="p-3 space-y-2">

        <fieldset disabled={!props.marketDataLive} className="m-0 min-w-0 space-y-2 border-0 p-0 disabled:opacity-90">

          <div className="flex h-9 items-center gap-1">

            <div className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-teal-500/50 px-1">

              <button type="button" onClick={() => props.onQuantityChange(-1)} className="p-1">

                <Minus className="w-3.5 h-3.5 text-[#7d8590]" />

              </button>

              <input

                type="text"

                inputMode="numeric"

                value={props.quantity}

                onChange={(e) => props.onQuantityInputChange(e.target.value)}

                onBlur={props.onQuantityBlur}

                className="no-spinner w-8 bg-transparent text-center text-sm font-semibold tabular-nums text-[#e6edf3] outline-none"

              />

              <span className="text-xs text-[#7d8590]">lots</span>

              <button type="button" onClick={() => props.onQuantityChange(1)} className="p-1">

                <Plus className="w-3.5 h-3.5 text-[#7d8590]" />

              </button>

            </div>

            {PRACTICE_CONTRACT_QTY_PRESETS.filter((p) => p <= maxQty)

              .slice(0, PRACTICE_CONTRACT_QTY_PRESET_CHIP_LIMIT)

              .map((p) => (

                <button

                  key={p}

                  type="button"

                  onClick={() => props.onQuantityUpdate(p)}

                  className={`h-9 w-8 rounded-lg border text-sm font-semibold ${

                    qty === p ? 'border-teal-500 text-teal-400' : 'border-[#475569] text-[#7d8590]'

                  }`}

                >

                  {p}

                </button>

              ))}

          </div>

          <DomActionButtons props={props} ui={panelUi} />

        </fieldset>

      </div>

    </section>

  )

}


