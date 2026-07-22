import type { IBulkGate } from '#server/lib/bulkgate'
import { setupBulkGate } from '#server/lib/bulkgate'

let _cache: IBulkGate | null = null

/** True when the BulkGate credentials are configured (SMS can be really sent). */
export function isBulkGateConfigured(): boolean {
  const cfg = useRuntimeConfig() as unknown as Record<string, string | undefined>
  return !!(cfg.BULKGATE_APPLICATION_ID && cfg.BULKGATE_APPLICATION_TOKEN)
}

/**
 * Returns the BulkGate SMS client. Throws if the credentials are missing.
 * Use isBulkGateConfigured() first when a fallback (e.g. console simulation) is desired.
 */
export function useBulkGate() {
  if (_cache)
    return _cache

  const cfg = useRuntimeConfig() as unknown as Record<string, string | undefined>
  const applicationId = cfg.BULKGATE_APPLICATION_ID
  const applicationToken = cfg.BULKGATE_APPLICATION_TOKEN

  if (!applicationId || !applicationToken) {
    throw createAppError(503, {
      code: 'BULKGATE_NOT_CONFIGURED',
      message: 'SMS channel requires NUXT_BULKGATE_APPLICATION_ID and NUXT_BULKGATE_APPLICATION_TOKEN.',
    })
  }

  _cache = setupBulkGate({ applicationId, applicationToken })
  return _cache
}
