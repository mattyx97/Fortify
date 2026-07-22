import type {
  BetterAuthClientOptions,
  InferSessionFromClient,
  InferUserFromClient,
} from 'better-auth/client'
import type { RouteLocationRaw } from 'vue-router'
import { createAuthClient } from 'better-auth/vue'

let cachedClient: ReturnType<typeof setupBetterAuthClient> | null = null

export function useAuth() {
  const client = cachedClient ??= setupBetterAuthClient({
    baseURL: useRuntimeConfig().public.BETTER_AUTH_BASE_URL,
  })

  const session = useState<InferSessionFromClient<BetterAuthClientOptions> | null>('auth:session', () => null)
  const user = useState<InferUserFromClient<BetterAuthClientOptions> | null>('auth:user', () => null)
  const sessionFetching = useState('auth:sessionFetching', () => false)

  const fetchSession = async () => {
    if (sessionFetching.value) {
      return
    }
    sessionFetching.value = true
    const { data } = await client.getSession({
      fetchOptions: {
        headers: useRequestHeaders(),
      },
    })
    session.value = data?.session || null
    user.value = data?.user || null
    sessionFetching.value = false
    return data
  }

  if (import.meta.client) {
    client.$store.listen('$sessionSignal', async (signal) => {
      if (!signal)
        return
      await fetchSession()
    })
  }

  return {
    session,
    user,
    loggedIn: computed(() => !!session.value),
    signIn: client.signIn,
    signUp: client.signUp,
    async signOut({ redirectTo }: { redirectTo?: RouteLocationRaw } = {}) {
      const res = await client.signOut()
      session.value = null
      user.value = null
      if (redirectTo) {
        await navigateTo(redirectTo)
      }
      return res
    },
    fetchSession,
    client,
  }
}

function setupBetterAuthClient(config: {
  baseURL: string
}) {
  return createAuthClient({
    plugins: [],
    fetchOptions: {
      headers: useRequestHeaders(),
    },
    baseURL: config.baseURL,
  })
}
