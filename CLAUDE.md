# AI Agent Guide

## Architecture Overview

This starter uses Nuxt 4 with a layered architecture. Every layer has a single responsibility:

```
server/
├── api/              # HTTP layer: validation, auth, route to service
├── services/         # Business logic: domain rules, orchestration, side effects
├── lib/              # Infrastructure setup (setupXXX functions)
│   ├── database/     # Drizzle ORM, schema, migrations
│   ├── better-auth/  # Auth configuration
│   ├── mailer/       # Email templates and transports
│   ├── drive/        # S3-compatible storage
│   ├── stripe/       # Stripe payments
│   ├── ai/           # AI framework (Mastra — agents, tools, workflows)
│   └── logger/       # Logging with Discord notifications
├── plugins/          # Nitro plugins (migrations, auth resolver)
└── utils/            # Server composables (useXXX) + handler definitions
app/
├── composables/
│   ├── better-auth.ts          # useAuth() composable
│   └── queries/                # TanStack Query composables (auto-imported)
├── middleware/                  # Route guards
└── plugins/                    # Vue plugins
shared/
└── utils/
    └── abilities/              # Authorization abilities (shared client/server)
```

### Layer Rules

Each layer only calls downward. Never call upward or sideways.

| Layer | Knows about | Does NOT know about |
|---|---|---|
| `api/` (handlers) | HTTP, validation, auth, services | Database, infrastructure details |
| `services/` | Business rules, `useXXX()` composables | HTTP, request/response, H3 events |
| `lib/` (setup) | External library configuration | Application logic |
| `utils/` (use) | Infrastructure instances | Business logic |

---

## Setup → Use Pattern

Every external library follows this architecture:

1. **Setup function**: `setupXXX()` in `server/lib/xxx/index.ts` — configures and returns the instance
2. **Composable**: `useXXX()` in `server/utils/xxx.ts` — provides the instance with lazy caching

```typescript
// server/lib/database/index.ts
export type IDatabase = ReturnType<typeof setupDatabase>
export function setupDatabase(config: { dbString: string, logger?: boolean }) {
  return drizzle({
    relations,
    client: new Pool({ connectionString: config.dbString }),
    logger: config.logger,
    casing: 'snake_case',
  })
}

// server/utils/database.ts
let _cache: IDatabase
export function useDatabase() {
  return _cache ??= setupDatabase({
    dbString: useRuntimeConfig().DATABASE_URL,
    logger: useRuntimeConfig().DATABASE_LOGGER,
  })
}
```

**Key principle**: Modify `setupXXX()` to customize library configuration. Modify `useXXX()` to change how the service is provided. Follow this same pattern for any new external library. Existing: `useDatabase()`, `useBetterAuth()`, `useMailer()`, `useDrive()`, `useStripe()`, `useAI()`, `useLogger()`.

---

## Services Layer

Services contain all business logic. They sit between API handlers and infrastructure.

### Structure

All services live in `server/services/`. One file per domain entity, named after the entity:

```
server/services/
├── projects.ts       # example: Project CRUD + business rules
├── invites.ts        # example: Invitation logic
├── limits.ts         # example: Subscription limit enforcement
└── billing.ts        # example: Stripe billing operations
```

### Rules

- Services are plain functions grouped by domain entity (one file per entity)
- Services use `useXXX()` composables to access infrastructure
- Services throw `createAppError()` for domain errors (see [Error Handling](#error-handling))
- Services do NOT receive H3 events — they take plain typed parameters
- Database queries live directly in services (Drizzle is already a thin query builder)
- Extract a query into a helper only when duplicated across multiple services
- Every exported service function MUST have a JSDoc comment (`/** */`). The comment is for the caller at the handler, not the reader of the implementation:
  - Line 1: business operation in one sentence (not restating the function name)
  - Side effects (if any): `Sends:`, `Uploads:`, `Calls:` — one per line
  - Business errors: `@throws CODE if condition.`
  - Do NOT restate parameter types or narrate implementation steps

### Example

```typescript
// server/services/invites.ts

/**
 * Invites a user to join an organization.
 * Sends invite email via mailer.
 * @throws INVITE_EXISTS if the email has a pending invite.
 * @throws LIMIT_REACHED if the org's plan member cap is exceeded.
 */
export async function createInvite(params: {
  orgId: string
  email: string
  invitedBy: string
}) {
  const db = useDatabase()

  const existing = await db.query.invites.findFirst({
    where: { orgId: params.orgId, email: params.email },
  })
  if (existing) throw createAppError(409, { code: 'INVITE_EXISTS', message: 'Already invited' })

  await enforceLimit(params.orgId, 'members')

  const invite = await db.insert(schema.invites)
    .values({ orgId: params.orgId, email: params.email, invitedBy: params.invitedBy })
    .returning()

  await useMailer().send('InviteEmail', {
    to: params.email,
    data: { inviteUrl: `https://example.com/invite/${invite[0].id}` },
  })

  return invite[0]
}
```

### Handler → Service Wiring

The handler's job is: **validate → authorize → call service → return**. The handler maps HTTP shape (URL params + body + session) into the service's domain shape. These are almost always different -- that mapping is the handler's job, not duplication.

```typescript
// server/api/organizations/[idOrg]/invites.post.ts
const paramsSchema = z.object({ idOrg: z.string().uuid() })
const bodySchema = z.object({ email: z.string().email() })

export default defineAuthEventHandler({
  input: { params: paramsSchema, body: bodySchema },
  async handler(event, { input: { params, body }, identity: { user } }) {
    await authorize(event, manageOrgAbility)
    return createInvite({ orgId: params.idOrg, email: body.email, invitedBy: user.id })
  },
})
```

### Handler Boundaries

Handlers MUST NOT use `useDatabase()` or any `useXXX()` composable. When authorization needs data (e.g. membership), the handler calls a service function to fetch it, then passes it to `authorize()`.

### Authorization vs Business Logic

| Concern | Where | Question |
|---|---|---|
| **Authorization** (ability) | `authorize()` in handler | "Does this user have **permission**?" (role, membership) |
| **Business logic** | Inside the service | "Is this action **possible**?" (limits, quotas, state) |

Business logic checks (subscription limits, quotas, uniqueness) live inside services so they apply regardless of entry point (HTTP, webhook, cron). Throw `createAppError(403, { code: 'LIMIT_REACHED', ... })` when exceeded.

Handler flow: **fetch context via service → authorize → call service → return**.

---

## Environment Variables

All env vars are defined in `nuxt.config.ts` under `runtimeConfig` with Zod validation. Prefixes are stripped automatically by `stripNuxtPrefix()`.

| Type | `.env` prefix | Access |
|---|---|---|
| Private (server-only) | `NUXT_` | `useRuntimeConfig().VARIABLE_NAME` |
| Public (client-accessible) | `NUXT_PUBLIC_` | `useRuntimeConfig().public.VARIABLE_NAME` |

To add a new variable: add to `.env`, add to `nuxt.config.ts` runtimeConfig with Zod validation, access via `useRuntimeConfig()` without prefix.

```typescript
// nuxt.config.ts
runtimeConfig: {
  ...stripNuxtPrefix(
    z.object({
      NUXT_MY_NEW_VAR: z.string(),
    }).parse(process.env),
  ),
  public: stripNuxtPrefix(
    z.object({
      NUXT_PUBLIC_MY_PUBLIC_VAR: z.string(),
    }).parse(process.env),
  ),
}
```

---

## Database (Drizzle ORM + PostgreSQL)

**Drizzle version**: Drizzle ORM **beta** with **Relational Queries v2** and centralized `defineRelations()`.

Reference: [RQB v2 docs](https://orm.drizzle.team/docs/rqb-v2), [Relations v1 → v2 migration](https://orm.drizzle.team/docs/relations-v1-v2)

- **Setup**: `server/lib/database/index.ts`
- **Use**: `server/utils/database.ts` → `useDatabase()`
- **Schema**: `server/lib/database/schema/`
- **Migrations**: `server/lib/database/migrations/`

### Querying

**Always use the Relational Query API** (`db.query.*`) for reads instead of `db.select()`. The query API is more concise, handles joins/relations automatically, and is the preferred way to read data. Fall back to `db.select()` only when the query API cannot express what you need (rare — e.g. complex aggregations, raw SQL expressions).

```typescript
const db = useDatabase()

await db.insert(schema.users).values({ id: '123', name: 'John' })

// CORRECT: use db.query for reads
const users = await db.query.users.findMany({ where: { id: '123' } })

const userWithPosts = await db.query.users.findFirst({
  where: { id: '123' },
  with: { posts: { where: { createdAt: { lt: new Date() } } } },
})

// WRONG: avoid db.select() when db.query can do the job
const users = await db.select().from(schema.users).where(eq(schema.users.id, '123'))
```

### Schema & Relations

Schema is split into logical files under `server/lib/database/schema/`. To add a new table:

1. Create schema file: `server/lib/database/schema/posts.ts`
2. Import in `server/lib/database/schema/index.ts`: `import * as posts from './posts'`
3. Add to schema export: `export const schema = { ...auth, ...posts }`
4. Add relations in the `defineRelations()` call

```typescript
// server/lib/database/schema/index.ts
import { defineRelations } from 'drizzle-orm'
import * as auth from './auth'
import * as posts from './posts'

export const schema = { ...auth, ...posts }

export const relations = defineRelations(schema, r => ({
  users: {
    sessions: r.many.betterAuthSession(),
    accounts: r.many.betterAuthAccount(),
    posts: r.many.posts(),
  },
  posts: {
    author: r.one.users({
      from: r.posts.authorId,
      to: r.users.id,
    }),
  },
  // ... existing relations
}))
```

### CRITICAL: Index Every Foreign Key Column

**Every column that acts as a foreign key MUST have an index.** Without indexes, relational queries perform full table scans. Reference: [Drizzle Relations v2 Performance](https://orm.drizzle.team/docs/relations-v2#performance)

```typescript
export const posts = pgTable(
  'posts',
  t => ({
    id: t.uuid().primaryKey().default(sql`uuidv7()`),
    title: t.text().notNull(),
    authorId: t.uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  }),
  table => [index().on(table.authorId)],
)
```

Junction tables need three indexes: one per FK column + a composite.

**Rule**: if a column appears in `.references()`, it needs an `index()`. No exceptions.

### Prefer PostgreSQL Enums

Use `pgEnum` instead of `text()` when a column has a fixed set of values. This enforces valid values at the database level.

```typescript
export const roleEnum = pgEnum('role', ['owner', 'admin', 'member'])

export const members = pgTable('members', t => ({
  id: t.uuid().primaryKey().default(sql`uuidv7()`),
  role: roleEnum().notNull().default('member'),
}))
```

### Transactions

Use `db.transaction()` when multiple writes must succeed or fail together. **Always use `tx` (not `db`) for all queries inside the transaction** -- queries using `db` run outside the transaction.

```typescript
return db.transaction(async (tx) => {
  await tx.update(schema.members).set({ role: 'member' }).where(...)
  await tx.update(schema.members).set({ role: 'owner' }).where(...)
})

// WRONG: db.insert runs outside the transaction
await db.transaction(async (tx) => {
  await db.insert(schema.posts).values(post) // BUG: uses db, not tx
  await tx.insert(schema.tags).values(tags)
})
```

### Migrations

| Command | Description |
|---|---|
| `pnpm db:generate` | Generate migrations from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:push` | Push schema directly to DB (dev only) |
| `pnpm db:studio` | Open Drizzle Studio |

Migrations auto-apply on server startup via `server/plugins/00.migrations.ts`.

---

## API Handlers

**Location**: `server/utils/handlers.ts`

Three handler wrappers are provided. All perform error catching, logging, and consistent error responses.

### defineZodEventHandler

For public endpoints. Validates input with Zod schemas.

```typescript
import { z } from 'zod'
const paramsSchema = z.object({ id: z.string().uuid() })
const bodySchema = z.object({ name: z.string().min(1), email: z.string().email() })

export type TUpdateUserBody = z.infer<typeof bodySchema>

export default defineZodEventHandler({
  input: { params: paramsSchema, body: bodySchema },
  async handler(event, { input: { params, body } }) {
    return updateUser({ id: params.id, name: body.name, email: body.email })
  },
})
```

### defineAuthEventHandler

Same as `defineZodEventHandler` but requires authentication. Provides `identity` (session + user).

```typescript
export default defineAuthEventHandler({
  input: { params: paramsSchema },
  async handler(event, { input: { params }, identity: { user } }) {
    await authorize(event, editPostAbility, { userId: params.id })
    return updatePost({ id: params.id, userId: user.id })
  },
})
```

### defineStripeWebhookHandler

Handles Stripe webhooks with automatic signature verification.

```typescript
export default defineStripeWebhookHandler(async (event, stripeEvent) => {
  if (stripeEvent.type === 'checkout.session.completed') { /* ... */ }
  return { received: true }
})
```

### Validation Options

| Option | Source | Example |
|---|---|---|
| `params` | URL params | `/api/users/:id` → `{ id: string }` |
| `query` | Query string | `?limit=10` → `{ limit: number }` |
| `body` | JSON body or multipart | POST/PUT/PATCH body |
| `cookies` | Cookies | Parsed cookies |

### File Uploads (z.file())

Use Zod 4's `z.file()` directly in the `body` schema. The handler auto-detects file fields and switches to `multipart/form-data` parsing. Detection happens once at handler definition time.

#### Server

```typescript
const bodySchema = z.object({
  name: z.string().min(1),
  maxMembers: z.coerce.number().int().positive(),
  cover: z.file().mime(['image/png', 'image/jpeg', 'image/webp']).max(5 * 1024 * 1024),
})

export type TCreateProjectBody = z.infer<typeof bodySchema>

export default defineAuthEventHandler({
  input: { body: bodySchema },
  async handler(event, { input: { body }, identity: { user } }) {
    return createProject({ name: body.name, maxMembers: body.maxMembers, cover: body.cover, userId: user.id })
  },
})
```

**Rules**:
- Always add `.max()` to `z.file()` to prevent unbounded uploads
- Non-string fields **must** use `z.coerce` (e.g. `z.coerce.number()`) because multipart form data sends everything as strings. This only applies to body schemas with `z.file()` fields -- regular JSON bodies parse types correctly without `.coerce`
- Use `file.name` to get the original filename from the client (useful for extracting extensions)
- `Buffer.from(await file.arrayBuffer())` creates a view, not a copy -- safe to use for `disk.put()`

Optional file fields: `z.file().mime([...]).max(...).optional()`

#### Frontend mutation

The mutation accepts a plain typed object. Convert to `FormData` inside `mutationFn`:

```typescript
import type { TCreateProjectBody } from '#server/api/projects.post'

export function useProjectMutations() {
  const queryClient = useQueryClient()

  const createProject = useMutation({
    mutationFn: (data: { body: TCreateProjectBody }) => {
      const formData = new FormData()
      formData.append('name', data.body.name)
      formData.append('maxMembers', String(data.body.maxMembers))
      formData.append('cover', data.body.cover)
      return $fetch('/api/projects', { method: 'POST', body: formData })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  return { createProject }
}
```

#### Service

```typescript
export async function createProject(params: { name: string, maxMembers: number, cover: File, userId: string }) {
  const disk = useDrive().use()
  const key = `projects/${crypto.randomUUID()}.${params.cover.type.split('/')[1]}`
  const buffer = Buffer.from(await params.cover.arrayBuffer())
  await disk.put(key, buffer, { contentType: params.cover.type })
}
```

### Sharing Types with Client

Export Zod-inferred types from handler files, import in frontend:

```typescript
import type { TUpdateUserBody } from '#server/api/users/[id].patch'
```

---

## Error Handling

**Location**: `server/utils/errors.ts`

All errors follow a consistent shape: `{ code, message, details? }`.

```typescript
interface AppErrorData {
  code: string                          // Machine-readable (SCREAMING_SNAKE_CASE)
  message: string                       // Human-readable for UI display
  details?: Record<string, string>      // Extra context (field errors, limits, IDs)
}
```

Use `createAppError()` instead of `createError()` everywhere:

```typescript
throw createAppError(409, { code: 'INVITE_EXISTS', message: 'Already invited' })
throw createAppError(404, { code: 'NOT_FOUND', message: 'Project not found' })
```

`flattenZodErrors(error)` converts ZodError to flat `Record<string, string>` for `details`. Used internally by handlers.

**Rules**: `code` is for programmatic logic (switch/conditionals), `message` is for user-facing display, `details` is optional extra context. Use SCREAMING_SNAKE_CASE for codes.

### Handler Error Codes

| Code | Status | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Zod validation fails |
| `UNAUTHORIZED` | 401 | No session found |
| `INTERNAL_ERROR` | 500 | Unhandled exception |

### Client-Side

With TanStack Query mutations (use `mutateAsync` + try/catch):

```typescript
try {
  const result = await createInvite.mutateAsync({
    idOrg: route.params.id,
    body: { email: 'user@example.com' },
  })
  toast.success('Invite sent!')
} catch (err) {
  const { code, message, details } = err.data

  if (code === 'LIMIT_REACHED') showUpgradeModal()
  else if (code === 'INVITE_EXISTS') toast.warning(message)
  else toast.error(message)
}
```

---

## Better Auth

Reference: [Better Auth docs](https://www.better-auth.com/docs)

- **Setup**: `server/lib/better-auth/index.ts`
- **Use**: `server/utils/better-auth.ts` → `useBetterAuth()`
- **Routes**: `server/api/auth/[...all].ts` — forwards all `/api/auth/*` to Better Auth
- **Types**: `import type { IBetterAuthIdentity, IBetterAuthSession, IBetterAuthUser } from '#server/lib/better-auth'`
- **IDs**: Configured with `generateId: 'uuid'` — all auth tables use UUIDs (v7 via `uuidv7()` DB default)

**Do not create endpoints under `/api/auth/` manually.**

### Client: useAuth

**File**: `app/composables/better-auth.ts`

```typescript
const { session, user, loggedIn, signIn, signUp, signOut, fetchSession, client } = useAuth()

await signIn.email({ email, password })
await signOut({ redirectTo: '/login' })
```

---

## Auth Middleware

**File**: `app/middleware/auth.global.ts`

Global middleware that protects routes using glob patterns. Protected route + not logged in → redirect to login. Guest route + logged in → redirect to dashboard.

```typescript
const AUTH_ROUTES = {
  PROTECTED: { routes: ['/dashboard/*', '/profile', '/settings/*'], redirectTo: '/login' },
  GUEST: { routes: ['/login', '/register'], redirectTo: '/dashboard' },
}
```

---

## Authorization

Reference: [nuxt-authorization](https://github.com/barbapapazes/nuxt-authorization)

**Location**: `shared/utils/abilities/` (shared between client and server)

```typescript
export const editPostAbility = defineAbility((user: IBetterAuthUser, post: { userId: string }) => {
  if (user.id === post.userId) return true
  return deny({ statusCode: 403, message: 'You are not allowed to edit this post' })
})
```

Allow guest access with `{ allowGuest: true }`: `defineAbility({ allowGuest: true }, (user: IBetterAuthUser | null) => true)`

Abilities check roles/permissions only. They do NOT check subscription limits, quotas, or domain state — see [Authorization vs Business Logic](#authorization-vs-business-logic) in the Services section for the full boundary rules.

**Server**: `await authorize(event, editPostAbility, post)` — throws on denial. Boolean checks: `await allows(event, ability, args)` / `await denies(event, ability, args)`.

**Client**: `<Can :ability="editPostAbility" :args="[post]"><button>Edit</button></Can>`

```typescript
export default defineAuthEventHandler({
  async handler(event, { input: { params, body }, identity: { user } }) {
    await authorize(event, createProjectAbility) // 1. Authorization: "Is this user allowed?"
    return createProject({ ... })                // 2. Limits: enforced inside the service
  },
})
```

---

## Mailer

Reference: [Nodemailer docs](https://nodemailer.com), [nuxt-email-renderer](https://github.com/Dave136/nuxt-email-renderer)

- **Setup**: `server/lib/mailer/index.ts`
- **Use**: `server/utils/mailer.ts` → `useMailer()`
- **Templates**: `server/lib/mailer/templates/` (Vue components with email-optimized `E*` elements)

```typescript
// Send with default transport
await useMailer().send('WelcomeEmail', {
  to: 'user@example.com',
  data: { userName: 'John', confirmationUrl: 'https://...' },
})

// Use a specific transport
await useMailer().use('ses').send('WelcomeEmail', { to, data })
```

**Important**: Every template must be exported from `server/lib/mailer/templates/index.ts` barrel file. Add new transports in `server/lib/mailer/index.ts` under the `transports` config.

---

## Drive (S3-Compatible Storage)

Reference: [FlyDrive docs](https://flydrive.dev/docs/introduction)

- **Setup**: `server/lib/drive/index.ts`
- **Use**: `server/utils/drive.ts` → `useDrive()`

Unlike other composables, Drive requires `.use()` to get a disk instance:

```typescript
const disk = useDrive().use()
await disk.put('path/to/file.txt', buffer)
const signedUrl = await disk.getSignedUrl('path/to/file.txt', { expiresIn: 3600 })
```

---

## Stripe (Payments)

Reference: [Stripe Node.js SDK](https://docs.stripe.com/libraries/node)

- **Setup**: `server/lib/stripe/index.ts`
- **Use**: `server/utils/stripe.ts` → `useStripe()`

Use `defineStripeWebhookHandler` for webhooks (see [API Handlers](#definestripewebhookhandler)).

---

## AI (Mastra)

**IMPORTANT**: Before modifying anything in `server/lib/ai/`, always fetch and read the latest Mastra documentation to ensure correct API usage, parameter names, and configuration options.

- **Setup**: `server/lib/ai/index.ts` → `setupAI(config)`
- **Use**: `server/utils/ai.ts` → `useAI()`
- **Structure**: `server/lib/ai/{agents,tools,workflows}/` — barrel-export from `index.ts`, register in `setupAI()`
- **Dev**: Mastra Studio embedded in Nuxt DevTools (also `pnpm ai:studio` for standalone)

### Agents & Tools

Factory functions that receive config — no `process.env`. Pass API keys via `OpenAICompatibleConfig`:

```typescript
// server/lib/ai/agents/my-agent.ts
export function createMyAgent(config: { apiKey: string }) {
  return new Agent({
    id: 'my-agent',
    model: { id: 'openai/gpt-4o', apiKey: config.apiKey },
    tools: { myTool },
  })
}
```

### Streaming & Memory

```typescript
// With memory: pass thread + resource to persist conversation
const result = await agent.stream('Hello', {
  memory: { thread: threadId, resource: resourceId },
})
```

Memory is per-agent. `storage` (PostgresStore) goes on the global Mastra instance. Before adding memory, **read the Mastra Memory docs** to choose the right options for the use case:
- **lastMessages** — recent message window size
- **semanticRecall** — vector retrieval of relevant past messages
- **workingMemory** — structured state persisted across conversations
- **observationalMemory** — auto-observes and remembers user facts

Each has trade-offs (latency, tokens, storage). Don't enable everything — configure precisely for the use case.

### Rules

- **Prefer `agent.stream()`** — over `agent.generate()`
- **Tools are thin wrappers** — business logic stays in `server/services/`
- **`structuredOutput`** — pass a Zod schema for typed responses
- **Workflows** for multi-step operations — type-safe steps, suspend/resume

---

## Logger

Reference: [Consola](https://github.com/unjs/consola)

- **Setup**: `server/lib/logger/index.ts`
- **Use**: `server/utils/logger.ts` → `useLogger()`

Levels: `debug`, `info`, `warn`, `error`, `fatal`. Dev = verbose, Prod = info+. `fatal()` sends Discord notification when `LOGGER_DISCORD_WEBHOOK_URL` is set.

---

## Frontend: Nuxt UI

The UI is built with **@nuxt/ui v4** (125+ accessible Vue components, Tailwind CSS theming). LLM-optimized documentation: https://ui.nuxt.com/llms.txt

---

## Frontend: TanStack Query

Reference: [TanStack Query Vue docs](https://tanstack.com/query/latest/docs/framework/vue/overview)

### Queries (Read)

**Location**: `app/composables/queries/` (auto-imported)

```typescript
export function useOrgInvitesQuery(idOrg: MaybeRef<string>, opts?: { enabled: MaybeRef<boolean> }) {
  const headers = useRequestHeaders() // passes cookies for SSR
  const q = useQuery({
    queryKey: ['organizations', idOrg, 'invites'],
    queryFn: () => $fetch(`/api/organizations/${toValue(idOrg)}/invites`, { headers }),
    ...opts,
  })
  onServerPrefetch(q.suspense) // SSR pre-fetching
  return q
}
```

### Mutations (Write)

```typescript
export function useOrgInvitesMutations() {
  const queryClient = useQueryClient()

  const createInvite = useMutation({
    mutationFn: (data: { idOrg: string, body: ICreateInviteBody }) =>
      $fetch(`/api/organizations/${data.idOrg}/invites`, { method: 'POST', body: data }),
    onSettled: (data, error, { idOrg }) =>
      queryClient.invalidateQueries({ queryKey: ['organizations', idOrg, 'invites'] }),
  })

  return { createInvite }
}
```

Group mutations by domain entity. Query keys must match for invalidation.

---

## Quick Reference

### Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start Docker infra + Nuxt dev server |
| `pnpm build` | Production build (requires `.env`) |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:push` | Push schema directly (dev only) |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm ai:studio` | Open Mastra Studio (localhost:4111) |
| `pnpm infra:dev-up` | Start Docker containers only |
| `pnpm infra:dev-down` | Stop Docker containers |
| `pnpm infra:dev-reset` | Remove containers, volumes, and local images |

### Docker

```bash
docker build -t app .
docker run -p 3000:3000 --env-file .env app
```

### Local Development

```bash
pnpm infra:dev-up   # postgres:5432, rustfs:9000/9001, maildev:1080/1025
pnpm dev
```

Migrations are applied automatically on server startup.
