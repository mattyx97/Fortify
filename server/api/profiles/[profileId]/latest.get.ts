import { db } from '../../../utils/db'
import { auth } from '../../../utils/auth'
import { socialProfile, scrapingHistory, employeeTarget, user } from '../../../db/schema'
import { eq, desc } from 'drizzle-orm'

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

    // Validazione parametro
    const profileId = getRouterParam(event, 'profileId')
    if (!profileId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Profile ID mancante'
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

    // Recupera profile
    const profile = await db.select().from(socialProfile).where(eq(socialProfile.id, profileId)).limit(1)
    if (!profile.length) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Profilo social non trovato'
      })
    }

    // Verifica target e permessi
    const target = await db.select().from(employeeTarget).where(eq(employeeTarget.id, profile[0].targetId)).limit(1)
    if (!target.length) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Target non trovato'
      })
    }

    // Controllo permessi (multi-tenant)
    const isAdmin = currentUser[0].role === 'admin'
    const isOwnOrg = currentUser[0].organizationId === target[0].organizationId

    if (!isAdmin && !isOwnOrg) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Accesso negato'
      })
    }

    // Recupera ultimo scraping
    const latestScraping = await db.select()
      .from(scrapingHistory)
      .where(eq(scrapingHistory.socialProfileId, profileId))
      .orderBy(desc(scrapingHistory.version))
      .limit(1)

    if (!latestScraping.length) {
      return {
        success: true,
        data: null,
        message: 'Nessun dato di scraping disponibile'
      }
    }

    return {
      success: true,
      data: {
        profile: profile[0],
        scraping: latestScraping[0]
      }
    }

  } catch (error) {
    console.error('Errore recupero dati profilo:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Errore interno del server'
    })
  }
})

