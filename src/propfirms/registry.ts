/**
 * Runtime prop firm adapters (chart, MDS, trade handlers).
 * Add new firms to `propFirmRegistry` in services/propfirms.
 */
export {
  propFirmRegistry,
  getPropFirmById,
  getAllPropFirms,
} from '../services/propfirms'

export type { PropFirmBase } from '../services/propfirms/PropFirmBase'
