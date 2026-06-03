import { connect, init } from 'rithmic-api'
import {
  InfraType,
  RequestLogin,
  RequestLoginInfo,
  RequestTimeBarReplay,
  ResponseTimeBarReplay,
  ReplayDirection,
  ReplayTimeOrder,
  resolveHistoryQuery,
  normalizeBar,
  splitHistoryForForming,
} from 'rithmic-api'

const WEB_APP = {
  template_version: '2.0',
  app_name: 'Rithmic Trader Pro - Web',
  app_version: '2.8.0.0',
}

function userMsg(symbol, exchange) {
  return `${symbol}.${exchange}`
}

async function loginPlant(client, credentials, infraType) {
  const login = await client.exchange(
    new RequestLogin({
      user: credentials.user,
      password: credentials.password,
      system_name: credentials.systemName,
      infra_type: infraType,
      user_msg: ['new'],
      ...WEB_APP,
    }),
  )
  if (!login.ok) {
    throw new Error(`${client.label} login failed: ${login.rp_code?.join(', ')}`)
  }
  await client.exchange(new RequestLoginInfo(login.unique_user_id))
  return login
}

/**
 * Replay OHLC bars using only the history plant (no ticker login).
 * Avoids fighting the live MDS ticker session for the same user.
 */
export async function replayHistoryBars({
  connect: connectOpts,
  symbol,
  exchange,
  timeoutMs = 120_000,
  include_forming = false,
  ...queryOpts
}) {
  await init()

  const uri = connectOpts.uri
  if (!uri) {
    throw new Error('Rithmic gateway URI is required for history replay')
  }

  const credentials = {
    user: connectOpts.user,
    password: connectOpts.password,
    systemName: connectOpts.systemName,
  }

  const history = await connect({ uri, label: 'history-replay', log: false })
  try {
    await loginPlant(history, credentials, InfraType.HISTORY_PLANT)

    const q = resolveHistoryQuery(queryOpts)
    const msg = userMsg(symbol, exchange)

    const replayRange = async (start_index, finish_index) => {
      history.send(
        new RequestTimeBarReplay({
          symbol,
          exchange,
          user_msg: [msg],
          bar_type: q.barType,
          bar_type_period: q.barTypePeriod,
          start_index,
          finish_index,
          direction: ReplayDirection.LAST,
          time_order: ReplayTimeOrder.FORWARDS,
        }),
      )

      const out = []
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        const packet = await history.receive()
        if (!(packet instanceof ResponseTimeBarReplay)) continue

        const marker = Number(packet.marker ?? 0)
        const isBar =
          marker !== 0 && (packet.open_price != null || packet.close_price != null)

        if (isBar) out.push(normalizeBar(packet, { defaultPeriod: q.periodSeconds }))
        if (packet.rp_code?.[0] === '0' && !isBar) break
      }
      return out
    }

    let bars = await replayRange(q.start_index, q.finish_index)

    const targetCount = q.countback == null ? null : q.countback + 1

    if (targetCount != null && bars.length > 0 && bars.length < targetCount) {
      let loops = 0
      while (bars.length < targetCount && loops < 8) {
        loops++
        const firstMarker = Number(bars[0]?.marker ?? q.start_index)
        const needed = targetCount - bars.length
        const span = Math.max(needed * q.periodSeconds * 2, q.periodSeconds * 120)
        const extraStart = Math.floor(firstMarker - span)
        const extraEnd = Math.floor(firstMarker - q.periodSeconds)
        if (extraEnd <= extraStart) break

        const older = await replayRange(extraStart, extraEnd)
        if (!older.length) break

        const seen = new Set(bars.map((b) => Number(b.marker)))
        const uniqueOlder = older.filter((b) => !seen.has(Number(b.marker)))
        if (!uniqueOlder.length) break

        bars = [...uniqueOlder, ...bars]
      }

      if (bars.length > targetCount) {
        bars = bars.slice(-targetCount)
      }
    }

    if (!include_forming && bars.length) {
      const { closed } = splitHistoryForForming(bars, q.periodSeconds)
      bars = closed
    }

    return bars
  } finally {
    history.close()
  }
}
