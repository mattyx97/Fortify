import { db } from '../../utils/db'
import { auth } from '../../utils/auth'
import { employeeTarget, user, socialProfile, scrapingHistory } from '../../db/schema'
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

    // Validazione parametro ID
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID target mancante'
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

    // Recupera target
    const target = await db.select().from(employeeTarget).where(eq(employeeTarget.id, id)).limit(1)

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
        statusMessage: 'Accesso negato: puoi visualizzare solo i target della tua organizzazione'
      })
    }

    // Recupera social profiles
    const profiles = await db.select()
      .from(socialProfile)
      .where(eq(socialProfile.targetId, id))

    // Per ogni profile, recupera ultimo scraping
    const profilesWithLatestScraping = await Promise.all(
      profiles.map(async (profile) => {
        const latestScraping = await db.select()
          .from(scrapingHistory)
          .where(eq(scrapingHistory.socialProfileId, profile.id))
          .orderBy(desc(scrapingHistory.version))
          .limit(1)

        return {
          ...profile,
          latestData: latestScraping[0] || null
        }
      })
    )

    return {
      success: true,
      data: {
        ...target[0],
        socialProfiles: profilesWithLatestScraping
      }
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

