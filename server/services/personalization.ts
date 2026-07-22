import type { GitHubScrapingData, LinkedInScrapingData, ScrapingData, WebsiteScrapingData } from '#server/lib/database/schema/target'
import { z } from 'zod'

const JSON_OBJECT_RE = /\{[\s\S]*\}/
const WHITESPACE_RE = /\s+/g

const personalizationSchema = z.object({
  subject: z.string().optional(),
  content: z.string(),
  linkText: z.string(),
})

// ============ OSINT DUMP (compact, not pre-interpreted) ============

function truncate(str: string | null | undefined, max: number): string | null {
  if (!str) return null
  const clean = str.replace(WHITESPACE_RE, ' ').trim()
  if (!clean) return null
  return clean.length <= max ? clean : `${clean.slice(0, max).trim()}…`
}

function formatLinkedInData(data: LinkedInScrapingData): string {
  const parts: string[] = []
  if (data.headline) parts.push(`Headline: ${data.headline}`)
  if (data.location) parts.push(`Location: ${data.location}`)

  const bio = truncate(data.bio, 400)
  if (bio) parts.push(`Bio: ${bio}`)

  if (data.experiences?.length) {
    parts.push('Experiences (most recent first):')
    for (const exp of data.experiences.slice(0, 4)) {
      const marker = exp.current ? ' [CURRENT]' : ''
      parts.push(`  - ${exp.title} @ ${exp.company} (${exp.duration})${marker}`)
    }
  }

  if (data.education?.length) {
    parts.push('Education:')
    for (const edu of data.education.slice(0, 3)) {
      parts.push(`  - ${edu.school}${edu.degree ? ` — ${edu.degree}` : ''}`)
    }
  }

  if (data.skills?.length) {
    parts.push(`Skills: ${data.skills.slice(0, 10).join(', ')}`)
  }

  if (data.projects?.length) {
    parts.push('Projects:')
    for (const proj of data.projects.slice(0, 4)) {
      parts.push(`  - ${proj.name}${proj.description ? ` — ${truncate(proj.description, 120)}` : ''}`)
    }
  }

  if (data.certifications?.length) {
    parts.push(`Certifications: ${data.certifications.slice(0, 5).join(', ')}`)
  }

  if (data.activity?.length) {
    parts.push('Recent activity (shared on their feed — topics they follow, NOT their work):')
    for (const act of data.activity.slice(0, 3)) {
      const label = act.type === 'repost' ? `reshared from ${act.originalAuthor || 'unknown'}` : 'own post'
      const content = truncate(act.content, 150)
      if (content) parts.push(`  - [${label}] ${content}`)
    }
  }

  return parts.join('\n')
}

function formatGitHubData(data: GitHubScrapingData): string {
  const parts: string[] = []
  const bio = truncate(data.bio, 300)
  if (bio) parts.push(`Bio: ${bio}`)
  if (data.company) parts.push(`GitHub company field: ${data.company}`)
  if (data.location) parts.push(`Location: ${data.location}`)
  if (data.followers !== null) parts.push(`Followers: ${data.followers}`)

  if (data.repositories?.length) {
    parts.push('Personal GitHub repositories (side projects / hobby code — NOT their job):')
    for (const repo of data.repositories.slice(0, 4)) {
      const lang = repo.language ? ` [${repo.language}]` : ''
      const desc = truncate(repo.description || repo.readmePreview, 120)
      parts.push(`  - ${repo.name}${lang}${desc ? `: ${desc}` : ''}`)
    }
  }

  return parts.join('\n')
}

function formatWebsiteData(entry: WebsiteScrapingData): string {
  const site = entry.data
  const parts: string[] = []
  parts.push(`URL: ${site.finalUrl || site.requestedUrl}`)
  if (site.page.title) parts.push(`Title: ${site.page.title}`)
  if (site.page.metaDescription) parts.push(`Description: ${truncate(site.page.metaDescription, 240)}`)
  if (site.page.sections.about) parts.push(`About: ${truncate(site.page.sections.about, 400)}`)
  if (site.page.sections.projects) parts.push(`Projects: ${truncate(site.page.sections.projects, 300)}`)

  const preview = truncate(site.page.contentPreview, 500)
  if (preview && !site.page.sections.about) parts.push(`Content preview: ${preview}`)

  if (site.page.headings?.length) {
    const headings = site.page.headings.slice(0, 6).map(h => h.text).filter(Boolean)
    if (headings.length) parts.push(`Headings: ${headings.join(' | ')}`)
  }

  const techs = site.technologies.detected?.slice(0, 8) || []
  if (techs.length) parts.push(`Detected technologies: ${techs.join(', ')}`)
  if (site.technologies.metaGenerator) parts.push(`Meta generator: ${site.technologies.metaGenerator}`)

  if (site.links.emails?.length) parts.push(`Emails on site: ${site.links.emails.slice(0, 5).join(', ')}`)
  if (site.links.github?.length) parts.push(`GitHub links: ${site.links.github.slice(0, 3).join(', ')}`)
  if (site.links.linkedin?.length) parts.push(`LinkedIn links: ${site.links.linkedin.slice(0, 3).join(', ')}`)

  return parts.join('\n')
}

function formatScrapingData(data: ScrapingData): string {
  if (data.platform === 'linkedin') return `[LinkedIn]\n${formatLinkedInData(data)}`
  if (data.platform === 'github') return `[GitHub]\n${formatGitHubData(data)}`
  if (data.platform === 'website') return `[Website]\n${formatWebsiteData(data)}`
  return ''
}

// ============ PROMPT BUILDERS (one per channel) ============

interface PromptContext {
  templateName: string
  templateContent: string
  target: {
    firstName: string
    lastName: string
    email: string
    jobTitle?: string | null
    department?: string | null
  }
  orgName: string
  osintText: string
  hasLandingPage: boolean
}

function commonTargetBlock(ctx: PromptContext): string {
  const now = new Date()
  const todayIso = now.toISOString().slice(0, 10)
  const todayHuman = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return `# CURRENT DATE
Today is ${todayHuman} (${todayIso}).

# TARGET
Full name: ${ctx.target.firstName} ${ctx.target.lastName}
Email: ${ctx.target.email}
Job title (from HR data): ${ctx.target.jobTitle || '(unknown)'}
Department: ${ctx.target.department || '(unknown)'}
Organization (the attacker is impersonating somebody inside this company): ${ctx.orgName}

# OSINT (public info scraped about this person — raw data, YOU must interpret it)
${ctx.osintText || '(no OSINT data available)'}`
}

/** Rules for reading OSINT — shared across channels. */
const OSINT_INTERPRETATION_RULES = `# HOW TO READ THE OSINT
Think of OSINT as noisy evidence. Before writing anything, mentally answer:

1. **What is the target's CURRENT job?** Look for the most recent role (marked [CURRENT] if present, or the first in the experiences list). This — together with their company and department — is the SUBJECT of the message. Past jobs are just history.

2. **What does their company actually do?** Infer the industry from the employer name, headline, bio, and job title. The vendors/systems/tools a realistic email would reference depend on this.

3. **What is NOT their job?**
   - Personal GitHub repos, side projects, open-source contributions → hobby code. They tell you the target is comfortable with X language/framework. They are NOT the target's employer or business.
   - Reshared posts / reactions → topics they find interesting. Not what they work on.
   - Items from LinkedIn suggestions, "people you may know", sidebar, etc. → noise. Ignore.

4. **Use OSINT to pick details, not topics.** The OSINT tells you which vendor names, tool names, and tech stacks feel authentic to this person. It does NOT tell you what the email is about — the SCENARIO does.

   Examples of correct usage:
   - Target is a software engineer with TypeScript/React side projects → a password-reset pretext can reference "GitHub org access" or "npm registry" (tools this person knows).
   - Target is a CEO of a marketing agency → an invoice pretext can reference "Google Ads invoice" or "HubSpot subscription" (plausible vendors).
   - Target works in DevOps → a CEO-fraud pretext can reference "urgent AWS reserved instance approval" (plausible in their daily work).

   Examples of WRONG usage:
   - Writing "the invoice for your GitHub repo X" — repos don't have invoices, this is absurd.
   - Making the email about a reshared post — that's not their work.
   - Referencing a past employer as if it was the current one.

5. **If OSINT is weak or empty**, default to generic-but-realistic details for the target's role + company. Invent plausible vendor/amount/date combos that would make sense.`

function buildEmailPrompt(ctx: PromptContext): string {
  const linkSection = ctx.hasLandingPage
    ? `# CALL TO ACTION
This email has a landing page the target should click through to.
- Do NOT write <a> tags, href attributes, <button> elements, raw URLs, or phrases like "click here" / "this link".
- End the body with a natural lead-in sentence (e.g. "Please proceed using the button below.").
- Put the button label in "linkText" (2-5 words, action verb, e.g. "Review invoice", "Reset password").`
    : `# CALL TO ACTION
This email has NO button and NO clickable link.
- Do NOT write <a>, <button>, URLs, "click here", "click the button", "follow this link", or any CTA-style phrase.
- Write a self-contained informational message. It must read naturally WITHOUT asking the reader to click anywhere.
- If the scenario usually has a CTA (e.g. "reset your password"), rephrase it as a statement or reference to another channel (e.g. "our IT team will contact you directly within 24 hours to complete the procedure").
- Set "linkText" to an empty string "".`

  return `# SCENARIO
${ctx.templateName}

# TEMPLATE
The user wrote the message below. You MUST resolve every {{ ... }} block. The surrounding text reflects their intent: respect its meaning and structure, but you can polish phrasing, register, and concrete details. If the template has NO {{ ... }} blocks, treat it as a generic skeleton and rewrite freely to fit the target.

${ctx.templateContent}

${commonTargetBlock(ctx)}

${OSINT_INTERPRETATION_RULES}

# YOUR TASK
Produce a phishing email that would realistically land in this person's inbox.

Rules:
1. Anchor the email on the target's CURRENT role + employer (see OSINT rule 1).
2. When you must invent (free-form blocks or skeleton mode), pick concrete, plausible details — amount, date, reference number, vendor name, system name — grounded in what this role would actually handle. Generic invented content = failure.
3. Match the scenario's urgency and the tone a real internal/vendor email would use.
4. Format the body as HTML: paragraphs in <p>, line breaks as <br/>. Do NOT use <a>, <button>, href, or URLs.
5. Language: respond in the same language as the template content.

${linkSection}

# OUTPUT FORMAT
Respond with ONLY a valid JSON object (no markdown fences, no explanation):
{
  "subject": "the email subject line",
  "content": "the HTML body (paragraphs wrapped in <p>, line breaks as <br/>)",
  "linkText": "${ctx.hasLandingPage ? 'the CTA button label (2-5 words)' : ''}"
}`
}

function buildSmsPrompt(ctx: PromptContext): string {
  return `# SCENARIO
${ctx.templateName}

# TEMPLATE
The user wrote the message below. You MUST resolve every {{ ... }} block. The surrounding text reflects their intent: respect its meaning, but you can polish phrasing and adjust details to fit. If there are no {{ ... }} blocks, treat it as a generic skeleton and rewrite freely.

${ctx.templateContent}

${commonTargetBlock(ctx)}

${OSINT_INTERPRETATION_RULES}

# YOUR TASK
Produce a short phishing SMS (≤160 characters) that this person would plausibly receive.

Rules:
1. Anchor on the target's CURRENT role + employer. Past jobs and personal projects are NOT the subject.
2. Short and urgent — create time pressure (expired, verification, security alert).
3. When you invent, include one specific detail (reference code, amount, vendor name) — never stay generic.
4. DO NOT write any URL. The system appends the tracking link automatically. End with a short lead-in like "Verify here:" or "Details:" (without writing the URL).
5. Plain text only — no HTML tags.
6. Language: match the template language.

# OUTPUT FORMAT
Respond with ONLY a valid JSON object (no markdown fences, no explanation):
{
  "subject": "",
  "content": "the SMS body text (plain, no URLs, ≤160 chars)",
  "linkText": "short lead-in label like 'Verify', 'Check' (2-3 words)"
}`
}

// ============ MAIN ENTRY POINT ============

/**
 * Personalizes a phishing simulation message for a specific target using AI.
 * Calls: AI provider (OpenRouter/Groq) via Mastra agent.
 */
export async function personalizeForTarget(params: {
  templateName: string
  templateContent: string
  channel: 'email' | 'sms'
  hasLandingPage: boolean
  target: {
    firstName: string
    lastName: string
    email: string
    jobTitle?: string | null
    department?: string | null
  }
  orgName: string
  scrapingData: ScrapingData[]
}) {
  const ai = useAI()
  const agent = ai.getAgent('phishingPersonalizer')

  const osintText = params.scrapingData.length
    ? params.scrapingData.map(formatScrapingData).filter(Boolean).join('\n\n')
    : ''

  const ctx: PromptContext = {
    templateName: params.templateName,
    templateContent: params.templateContent,
    target: params.target,
    orgName: params.orgName,
    osintText,
    hasLandingPage: params.hasLandingPage,
  }

  const prompt = params.channel === 'sms' ? buildSmsPrompt(ctx) : buildEmailPrompt(ctx)

  let response: Awaited<ReturnType<typeof agent.generate>>
  try {
    // Hard timeout so a stalled provider request fails loudly instead of hanging the
    // whole campaign launch indefinitely (which would surface as an empty dashboard).
    response = await Promise.race([
      agent.generate(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI request timed out after 90s')), 90_000),
      ),
    ])
  }
  catch (err) {
    const e = err as Error & { responseBody?: string, cause?: unknown }
    const logger = useLogger()
    logger.error('[personalization] AI provider error:', {
      message: e.message,
      responseBody: e.responseBody,
      cause: e.cause,
    })
    throw new Error(`AI provider error: ${e.message}${e.responseBody ? ` — ${e.responseBody}` : ''}`)
  }
  const text = response.text.trim()

  // Extract JSON from the response (handle possible markdown fences or extra text)
  const jsonMatch = text.match(JSON_OBJECT_RE)
  if (!jsonMatch) {
    throw new Error(`AI response did not contain valid JSON: ${text.substring(0, 200)}`)
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return personalizationSchema.parse(parsed)
  }
  catch (err) {
    throw new Error(`Failed to parse AI response: ${(err as Error).message}\nResponse: ${text.substring(0, 200)}`)
  }
}
