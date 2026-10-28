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
  const responses = await Promise.all(firmIds.map(async (firmType) => {
    try {
      return await getPropFirm(firmType)
    } catch {
      // A missing or unavailable firm must not prevent the others from loading.
      return undefined
    }
  }))

  // Merge in configuration order regardless of which request finishes first.
  // Preserve listed entries when their detail lookup fails and append new firms.
  for (const [index, firmType] of firmIds.entries()) {
    const firmResponse = responses[index]
    if (!firmResponse?.success || !firmResponse.propFirm) continue
    const hydrated = firmResponse.propFirm
    result = result.some((firm) => firm.type === firmType)
      ? result.map((firm) => (firm.type === firmType ? hydrated : firm))
      : [...result, hydrated]
  }

  return result
}
