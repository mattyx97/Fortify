import { db } from '../../utils/db'
import { auth } from '../../utils/auth'
import { employeeTarget, user, socialProfile } from '../../db/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    // Autenticazione
    const session = await auth.api.getSession({ headers: event.headers })
    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Non autorizzato'
      })
    }

    // Ottieni utente corrente
    const currentUser = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
    if (!currentUser.length) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Utente non trovato'
      })
    }

    // Verifica che l'utente abbia un'organizzazione
    if (!currentUser[0].organizationId && currentUser[0].role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Utente non associato a nessuna organizzazione'
      })
    }

    // Validazione input
    const body = await readBody(event)

    if (!body.nome || typeof body.nome !== 'string' || body.nome.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Nome dipendente obbligatorio'
      })
    }

    if (!body.email || typeof body.email !== 'string' || !body.email.includes('@')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email valida obbligatoria'
      })
    }

    // Determina organizationId
    let targetOrgId = currentUser[0].organizationId
    
    // Se admin e viene passato organizationId, usa quello
    if (currentUser[0].role === 'admin' && body.organizationId) {
      targetOrgId = body.organizationId
    }

    if (!targetOrgId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Organization ID mancante'
      })
    }

    // Verifica duplicati email nell'organizzazione
    const existing = await db.select()
      .from(employeeTarget)
      .where(and(
        eq(employeeTarget.email, body.email.toLowerCase().trim()),
        eq(employeeTarget.organizationId, targetOrgId)
      ))
      .limit(1)

    if (existing.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Target con questa email già esistente nell\'organizzazione'
      })
    }

    // Crea target
    const newTarget = await db.insert(employeeTarget).values({
      organizationId: targetOrgId,
      nome: body.nome.trim(),
      email: body.email.toLowerCase().trim(),
      posizione: body.posizione?.trim() || null,
      dipartimento: body.dipartimento?.trim() || null,
      isActive: body.isActive !== undefined ? body.isActive : true,
    }).returning()

    // Se viene fornito LinkedIn URL, crea social profile
    if (body.linkedinUrl && typeof body.linkedinUrl === 'string' && body.linkedinUrl.includes('linkedin.com')) {
      await db.insert(socialProfile).values({
        targetId: newTarget[0].id,
        platform: 'linkedin',
        profileUrl: body.linkedinUrl.trim(),
        scrapingStatus: 'pending',
      })
    }

    return {
      success: true,
      data: newTarget[0]
    }

  } catch (error) {
    console.error('Errore creazione target:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Errore interno del server'
    })
  }
})

