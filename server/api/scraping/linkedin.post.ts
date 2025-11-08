import { db } from '../../utils/db'
import { auth } from '../../utils/auth'
import { employeeTarget, user, socialProfile, scrapingHistory } from '../../db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { scrapeLinkedInProfile } from '../../utils/scraper/linkedin'

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

    // Validazione input
    const body = await readBody(event)

    if (!body.targetId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Target ID obbligatorio'
      })
    }

    if (!body.profileUrl || !body.profileUrl.includes('linkedin.com')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'URL LinkedIn valido obbligatorio'
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

    // Verifica esistenza target
    const target = await db.select().from(employeeTarget).where(eq(employeeTarget.id, body.targetId)).limit(1)
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
        statusMessage: 'Accesso negato: puoi eseguire scraping solo per target della tua organizzazione'
      })
    }

    // Verifica o crea social profile
    let profile = await db.select()
      .from(socialProfile)
      .where(and(
        eq(socialProfile.targetId, body.targetId),
        eq(socialProfile.platform, 'linkedin')
      ))
      .limit(1)

    if (!profile.length) {
      // Crea nuovo profile
      const newProfile = await db.insert(socialProfile).values({
        targetId: body.targetId,
        platform: 'linkedin',
        profileUrl: body.profileUrl.trim(),
        scrapingStatus: 'in_progress',
      }).returning()
      profile = newProfile
    } else {
      // Aggiorna profile esistente
      await db.update(socialProfile)
        .set({
          profileUrl: body.profileUrl.trim(),
          scrapingStatus: 'in_progress',
          updatedAt: new Date(),
        })
        .where(eq(socialProfile.id, profile[0].id))
    }

    // Avvia scraping asincrono
    const scrapingResult = await scrapeLinkedInProfile(body.profileUrl.trim(), {
      headless: true,
      timeout: 45000,
    })

    if (!scrapingResult.success) {
      // Aggiorna status a failed
      await db.update(socialProfile)
        .set({
          scrapingStatus: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(socialProfile.id, profile[0].id))

      throw createError({
        statusCode: 500,
        statusMessage: `Scraping fallito: ${scrapingResult.error}`
      })
    }

    // Calcola versione
    const existingHistory = await db.select()
      .from(scrapingHistory)
      .where(eq(scrapingHistory.socialProfileId, profile[0].id))
      .orderBy(desc(scrapingHistory.version))
      .limit(1)

    const nextVersion = existingHistory.length > 0 ? existingHistory[0].version + 1 : 1

    // Salva dati in history
    const historyEntry = await db.insert(scrapingHistory).values({
      socialProfileId: profile[0].id,
      rawData: scrapingResult.data as any,
      version: nextVersion,
    }).returning()

    // Aggiorna social profile status
    await db.update(socialProfile)
      .set({
        scrapingStatus: 'completed',
        lastScrapedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(socialProfile.id, profile[0].id))

    return {
      success: true,
      data: {
        profileId: profile[0].id,
        version: nextVersion,
        scrapedData: scrapingResult.data,
        scrapedAt: historyEntry[0].scrapedAt
      }
    }

  } catch (error) {
    console.error('Errore scraping LinkedIn:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Errore interno del server'
    })
  }
})

