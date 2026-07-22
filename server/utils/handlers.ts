import type { IBetterAuthIdentity } from '#server/lib/better-auth'
import type { EventHandlerRequest, H3Event } from 'h3'
import type Stripe from 'stripe'
import type { z } from 'zod'
import { H3Error } from 'h3'

/* ── Handler Wrappers ── */

export function defineZodEventHandler<
  Request extends EventHandlerRequest,
  Response,
  P extends z.Schema | undefined = undefined,
  Q extends z.Schema | undefined = undefined,
  B extends z.Schema | undefined = undefined,
  C extends z.Schema | undefined = undefined,
>(handler: {
  input?: {
    params?: P
    query?: Q
    body?: B
    cookies?: C
  }
  handler: (
    event: H3Event<Request>,
    payload: {
      input: {
        params: P extends z.Schema ? z.infer<P> : never
        query: Q extends z.Schema ? z.infer<Q> : never
        body: B extends z.Schema ? z.infer<B> : never
        cookies: C extends z.Schema ? z.infer<C> : never
      }
    },
  ) => Response | Promise<Response>
}) {
  const { input, handler: h } = handler
  const { params, query, body, cookies } = input || {}
  const fileFields = body ? getFileFieldNames(body) : null

  return defineEventHandler(async (event) => {
    try {
      /* INPUT */
      let parsedParams: any
      let parsedQuery: any
      let parsedBody: any
      let parsedCookies: any

      if (params) {
        const { data, error } = await getValidatedRouterParams(event, params.safeParse)
        if (error) {
          throw createAppError(400, { code: 'VALIDATION_FAILED', message: 'Invalid route parameters', details: flattenZodErrors(error) })
        }
        parsedParams = data
      }
      if (query) {
        const { data, error } = await getValidatedQuery(event, query.safeParse)
        if (error) {
          throw createAppError(400, { code: 'VALIDATION_FAILED', message: 'Invalid query parameters', details: flattenZodErrors(error) })
        }
        parsedQuery = data
      }
      if (body) {
        if (fileFields) {
          const rawBody = await parseMultipartBody(event, fileFields)
          const { data, error } = body.safeParse(rawBody)
          if (error) {
            throw createAppError(400, { code: 'VALIDATION_FAILED', message: 'Invalid request body', details: flattenZodErrors(error) })
          }
          parsedBody = data
        }
        else {
          const { data, error } = await readValidatedBody(event, body.safeParse)
          if (error) {
            throw createAppError(400, { code: 'VALIDATION_FAILED', message: 'Invalid request body', details: flattenZodErrors(error) })
          }
          parsedBody = data
        }
      }
      if (cookies) {
        const { data, error } = cookies.safeParse(parseCookies(event))
        if (error) {
          throw createAppError(400, { code: 'VALIDATION_FAILED', message: 'Invalid cookies', details: flattenZodErrors(error) })
        }
        parsedCookies = data
      }

      return h(event, {
        input: {
          params: parsedParams,
          query: parsedQuery,
          body: parsedBody,
          cookies: parsedCookies,
        },
      })
    }
    catch (err: unknown) {
      if (err instanceof H3Error)
        throw err
      useLogger().error(`[${event.method.toUpperCase()} ${event.path}] ${err}`)
      throw createAppError(500, { code: 'INTERNAL_ERROR', message: 'Internal Server Error' })
    }
  })
}

export function defineAuthEventHandler<
  Request extends EventHandlerRequest,
  Response,
  P extends z.Schema | undefined = undefined,
  Q extends z.Schema | undefined = undefined,
  B extends z.Schema | undefined = undefined,
  C extends z.Schema | undefined = undefined,
>(
  handler: {
    input?: {
      params?: P
      query?: Q
      body?: B
      cookies?: C
    }
    handler: (
      event: H3Event<Request>,
      payload: {
        input: {
          params: P extends z.Schema ? z.infer<P> : never
          query: Q extends z.Schema ? z.infer<Q> : never
          body: B extends z.Schema ? z.infer<B> : never
          cookies: C extends z.Schema ? z.infer<C> : never
        }
        identity: IBetterAuthIdentity
      },
    ) => Response | Promise<Response>
  },
) {
  const { input, handler: h } = handler
  const { params, query, body, cookies } = input || {}
  const fileFields = body ? getFileFieldNames(body) : null

  return defineEventHandler(async (event) => {
    try {
      /* INPUT */
      let parsedParams: any
      let parsedQuery: any
      let parsedBody: any
      let parsedCookies: any

      if (params) {
        const { data, error } = await getValidatedRouterParams(event, params.safeParse)
        if (error) {
          throw createAppError(400, { code: 'VALIDATION_FAILED', message: 'Invalid route parameters', details: flattenZodErrors(error) })
        }
        parsedParams = data
      }
      if (query) {
        const { data, error } = await getValidatedQuery(event, query.safeParse)
        if (error) {
          throw createAppError(400, { code: 'VALIDATION_FAILED', message: 'Invalid query parameters', details: flattenZodErrors(error) })
        }
        parsedQuery = data
      }
      if (body) {
        if (fileFields) {
          const rawBody = await parseMultipartBody(event, fileFields)
          const { data, error } = body.safeParse(rawBody)
          if (error) {
            throw createAppError(400, { code: 'VALIDATION_FAILED', message: 'Invalid request body', details: flattenZodErrors(error) })
          }
          parsedBody = data
        }
        else {
          const { data, error } = await readValidatedBody(event, body.safeParse)
          if (error) {
            throw createAppError(400, { code: 'VALIDATION_FAILED', message: 'Invalid request body', details: flattenZodErrors(error) })
          }
          parsedBody = data
        }
      }
      if (cookies) {
        const { data, error } = cookies.safeParse(parseCookies(event))
        if (error) {
          throw createAppError(400, { code: 'VALIDATION_FAILED', message: 'Invalid cookies', details: flattenZodErrors(error) })
        }
        parsedCookies = data
      }

      /* AUTH */
      const session = await useBetterAuth().api.getSession({
        headers: event.headers,
      })
      if (!session) {
        useLogger().debug('No session found')
        throw createAppError(401, { code: 'UNAUTHORIZED', message: 'Authentication required' })
      }
      event.context.$user = session.user

      return h(event, {
        input: {
          params: parsedParams,
          query: parsedQuery,
          body: parsedBody,
          cookies: parsedCookies,
        },
        identity: session,
      })
    }
    catch (err: unknown) {
      if (err instanceof H3Error)
        throw err
      useLogger().error(`[${event.method.toUpperCase()} ${event.path}] ${err}`)
      throw createAppError(500, { code: 'INTERNAL_ERROR', message: 'Internal Server Error' })
    }
  })
}

export function defineStripeWebhookHandler<Request extends EventHandlerRequest, Response>(
  handler: (event: H3Event<Request>, stripeEvent: Stripe.Event) => Response | Promise<Response>,
) {
  return defineEventHandler(async (event) => {
    const logger = useLogger()
    const config = useRuntimeConfig()
    const stripe = useStripe()

    try {
      const sig = getHeader(event, 'stripe-signature')
      if (!sig) {
        logger.error('No stripe signature found')
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          data: 'No stripe signature found',
        })
      }

      const rawBody = await readRawBody(event)
      if (!rawBody) {
        logger.error('No raw body found')
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          data: 'No raw body found',
        })
      }

      let stripeEvent: Stripe.Event
      try {
        stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, config.STRIPE_WEBHOOK_SECRET_KEY)
      }
      catch (err) {
        logger.error('Error verifying stripe webhook', err)
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          data: 'Error verifying stripe webhook',
        })
      }

      return await handler(event, stripeEvent)
    }
    catch (err: unknown) {
      if (err instanceof H3Error)
        throw err
      logger.fatal(`[${event.method.toUpperCase()} ${event.path}] ${err}`)
      throw createError({
        statusCode: 500,
        statusMessage: 'Internal Server Error',
      })
    }
  })
}

/* ── Multipart Helpers ── */

/**
 * Unwraps optional/nullable wrappers to get the inner schema type.
 */
function unwrapSchema(schema: z.ZodType): z.ZodType {
  const type = (schema as any).def?.type
  if (type === 'optional' || type === 'nullable') {
    return unwrapSchema((schema as any).def.innerType)
  }
  return schema
}

/**
 * Returns field names that use z.file() in a z.object() body schema.
 * Returns null if no file fields are found (regular JSON mode).
 */
function getFileFieldNames(schema: z.ZodType): string[] | null {
  if ((schema as any).def?.type !== 'object')
    return null
  const shape = (schema as any).def.shape as Record<string, z.ZodType> | undefined
  if (!shape)
    return null

  const fileFields: string[] = []
  for (const [key, field] of Object.entries(shape)) {
    const unwrapped = unwrapSchema(field)
    if ((unwrapped as any).def?.type === 'file') {
      fileFields.push(key)
    }
  }
  return fileFields.length > 0 ? fileFields : null
}

/**
 * Reads multipart form data and builds a raw object with File instances
 * for file fields and strings for text fields. The returned object is
 * then validated by the body Zod schema (z.file() handles mime/size).
 */
async function parseMultipartBody(
  event: H3Event,
  fileFieldNames: string[],
): Promise<Record<string, any>> {
  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    throw createAppError(400, { code: 'VALIDATION_FAILED', message: 'Expected multipart form data' })
  }

  const result: Record<string, any> = {}
  for (const part of parts) {
    if (!part.name)
      continue

    if (fileFieldNames.includes(part.name) && part.type) {
      result[part.name] = new File([part.data as BlobPart], part.filename || 'unknown', { type: part.type })
    }
    else {
      result[part.name] = part.data.toString('utf-8')
    }
  }

  return result
}
