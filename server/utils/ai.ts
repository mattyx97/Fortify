import type { IAI } from '../lib/ai'
import { setupAI } from '../lib/ai'

let _cache: IAI
export function useAI() {
  return _cache ??= setupAI({
    geminiApiKey: useRuntimeConfig().AI_GEMINI_API_KEY,
  })
}
