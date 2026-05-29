import { Client } from 'rithmic-api'
import { buildPacketTraceEntry } from './rithmicPacketDebug.js'

let installed = false

/**
 * Optional global Rithmic packet logging on every Client (history, MDS, accounts).
 * Off by default — enable with RITHMIC_WIRE_DEBUG=1 in server/.env.
 *
 * /accounts session summaries use RITHMIC_ACCOUNTS_LOG (see rithmicPacketDebug.js).
 */
export async function installRithmicWireDebug() {
  if (installed) return
  installed = true

  if (process.env.RITHMIC_WIRE_DEBUG !== '1') return

  const originalSend = Client.prototype.send
  const originalReceive = Client.prototype.receive

  Client.prototype.send = function send(packet) {
    const result = originalSend.call(this, packet)
    if (!this.log) {
      try {
        const entry = buildPacketTraceEntry(packet, 'send')
        const hint = entry.summary ? ` — ${entry.summary}` : ''
        console.log(`[${this.label}] send ${entry.message} (${entry.template_id})${hint}`)
      } catch {
        /* ignore */
      }
    }
    return result
  }

  Client.prototype.receive = async function receive() {
    const packet = await originalReceive.call(this)
    if (!this.log) {
      try {
        const entry = buildPacketTraceEntry(packet, 'recv')
        const hint = entry.summary ? ` — ${entry.summary}` : ''
        console.log(`[${this.label}] recv ${entry.message} (${entry.template_id})${hint}`)
      } catch {
        /* ignore */
      }
    }
    return packet
  }

  console.log('[rithmic] wire debug enabled (RITHMIC_WIRE_DEBUG=1)')
}
