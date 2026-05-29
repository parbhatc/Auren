import type { PropFirm } from '../types/props'
import { PRACTICE_PROP_FIRM_CONFIGS } from '../constants/practicePropFirms'

type GetPropFirm = (type: string) => Promise<{ success: boolean; propFirm?: PropFirm }>

/** Merge full credential payloads and ensure every configured practice firm exists in the list. */
export async function hydratePropFirmsList(
  propFirmsList: PropFirm[],
  getPropFirm: GetPropFirm
): Promise<PropFirm[]> {
  let result = [...propFirmsList]
  const firmIds = PRACTICE_PROP_FIRM_CONFIGS.map((c) => c.id)

  for (const firmType of firmIds) {
    const listed = result.find((f) => f.type === firmType)
    if (!listed) continue
    try {
      const firmResponse = await getPropFirm(firmType)
      if (firmResponse.success && firmResponse.propFirm) {
        result = result.map((f) => (f.type === firmType ? firmResponse.propFirm! : f))
      }
    } catch {
      /* keep list entry without credentials */
    }
  }

  for (const firmType of firmIds) {
    if (result.some((f) => f.type === firmType)) continue
    try {
      const firmResponse = await getPropFirm(firmType)
      if (firmResponse.success && firmResponse.propFirm) {
        result = [...result, firmResponse.propFirm]
      }
    } catch {
      /* firm not configured yet */
    }
  }

  return result
}
