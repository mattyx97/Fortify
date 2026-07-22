import { Mastra } from '@mastra/core'
import { createPhishingPersonalizer } from './agents'

export type IAI = ReturnType<typeof setupAI>
export function setupAI(config: { geminiApiKey: string }) {
  // Mastra's native `google/*` provider authenticates via GOOGLE_GENERATIVE_AI_API_KEY.
  // Bridge the app's configured Gemini key into it; without a key the model silently
  // falls back to the Vercel AI gateway and every generate() request hangs forever.
  if (config.geminiApiKey && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = config.geminiApiKey
  }

  const phishingPersonalizer = createPhishingPersonalizer()

  return new Mastra({
    agents: { phishingPersonalizer },
    tools: {},
    workflows: {},
  })
}
