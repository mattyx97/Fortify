import { db } from '../../utils/db'
import { auth } from '../../utils/auth'
import { employeeTarget, user, socialProfile } from '../../db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'

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

    // Verifica organizzazione
    if (!currentUser[0].organizationId && currentUser[0].role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Utente non associato a nessuna organizzazione'
      })
    }

    // Query parameters
    const query = getQuery(event)
    const includeInactive = query.includeInactive === 'true'

    // Costruisci query base
    let targetsQuery = db.select({
      id: employeeTarget.id,
      nome: employeeTarget.nome,
      email: employeeTarget.email,
      posizione: employeeTarget.posizione,
      dipartimento: employeeTarget.dipartimento,
      isActive: employeeTarget.isActive,
      organizationId: employeeTarget.organizationId,
      createdAt: employeeTarget.createdAt,
      updatedAt: employeeTarget.updatedAt,
    })
    .from(employeeTarget)

    // Filtro per organizzazione (multi-tenant)
    const isAdmin = currentUser[0].role === 'admin'
    
    if (isAdmin) {
      // Admin vede tutti i target di tutte le organizzazioni
      if (!includeInactive) {
        targetsQuery = targetsQuery.where(eq(employeeTarget.isActive, true))
      }
    } else {
      // Altri vedono solo target della propria organizzazione
      const conditions = [eq(employeeTarget.organizationId, currentUser[0].organizationId!)]
      if (!includeInactive) {
        conditions.push(eq(employeeTarget.isActive, true))
      }
      targetsQuery = targetsQuery.where(and(...conditions))
    }

    const targets = await targetsQuery.orderBy(desc(employeeTarget.createdAt))

    // Aggiungi info sui social profile
    const targetsWithProfiles = await Promise.all(
      targets.map(async (target) => {
        const profiles = await db.select({
          id: socialProfile.id,
          platform: socialProfile.platform,
          profileUrl: socialProfile.profileUrl,
          scrapingStatus: socialProfile.scrapingStatus,
          lastScrapedAt: socialProfile.lastScrapedAt,
        })
        .from(socialProfile)
        .where(eq(socialProfile.targetId, target.id))

        return {
          ...target,
          socialProfiles: profiles
        }
      })
    )

    return {
      success: true,
      targets: targetsWithProfiles
    }

  } catch (error) {
    console.error('Errore recupero target:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Errore interno del server'
    })
  }
})

