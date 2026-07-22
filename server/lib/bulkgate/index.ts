/**
 * BulkGate SMS gateway (Simple Transactional HTTP API).
 * Docs: https://help.bulkgate.com/docs/en/http-simple-transactional.html
 */

const BULKGATE_ENDPOINT = 'https://portal.bulkgate.com/api/1.0/simple/transactional'

const NON_DIGIT_RE = /\D/g

// Italian accents (à è ì ò ù …) fall outside 7-bit GSM, so they need the Unicode
// encoding — otherwise BulkGate would garble them.
function hasNonAscii(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 127)
      return true
  }
  return false
}

export interface BulkGateConfig {
  applicationId: string
  applicationToken: string
}

export interface SendSmsResult {
  status: string
  smsId: string
  number: string
}

export type IBulkGate = ReturnType<typeof setupBulkGate>

export function setupBulkGate(config: BulkGateConfig) {
  return {
    /**
     * Sends a single transactional SMS.
     * @throws Error if the recipient number is empty or BulkGate rejects the request.
     */
    async sendSms(params: { to: string, text: string, unicode?: boolean }): Promise<SendSmsResult> {
      // BulkGate wants the number in international format, digits only (no '+').
      const number = params.to.replace(NON_DIGIT_RE, '')
      if (!number)
        throw new Error('BulkGate: recipient phone number is empty')

      const body: Record<string, string> = {
        application_id: config.applicationId,
        application_token: config.applicationToken,
        number,
        text: params.text,
        unicode: (params.unicode ?? hasNonAscii(params.text)) ? 'true' : 'false',
        // Always send from BulkGate's shared system numbers.
        sender_id: 'gSystem',
      }

      const res = await fetch(BULKGATE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json().catch(() => null) as
        | { data?: { status?: string, sms_id?: string, number?: string }, type?: string, code?: number, error?: string }
        | null

      if (!res.ok || !json?.data || json.error) {
        throw new Error(`BulkGate error: ${json?.error || res.statusText} (code ${json?.code ?? res.status})`)
      }

      return {
        status: json.data.status ?? 'unknown',
        smsId: json.data.sms_id ?? '',
        number: json.data.number ?? number,
      }
    },
  }
}
