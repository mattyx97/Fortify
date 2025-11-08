import { db } from '../../utils/db'
import { auth } from '../../utils/auth'
import { phishingCampaign, user } from '../../db/schema'
import { eq } from 'drizzle-orm'

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
        statusMessage: 'ID campagna mancante'
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

    // Verifica esistenza campagna
    const existing = await db.select().from(phishingCampaign).where(eq(phishingCampaign.id, id)).limit(1)
    if (!existing.length) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Campagna non trovata'
      })
    }

    // Controllo permessi (multi-tenant)
    const isAdmin = currentUser[0].role === 'admin'
    const isOwnOrg = currentUser[0].organizationId === existing[0].organizationId

    if (!isAdmin && !isOwnOrg) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Accesso negato: puoi modificare solo le campagne della tua organizzazione'
      })
    }

    // Non permettere modifica di campagne già lanciate (tranne status)
    if (existing[0].status === 'launched' || existing[0].status === 'completed') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Non è possibile modificare campagne già lanciate o completate'
      })
    }

    // Validazione input
    const body = await readBody(event)

    // Costruisci update object
    const updateData: any = {}

    if (body.nome !== undefined) {
      if (typeof body.nome !== 'string' || body.nome.trim().length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Nome non valido'
        })
      }
      updateData.nome = body.nome.trim()
    }

    if (body.descrizione !== undefined) {
      updateData.descrizione = body.descrizione ? body.descrizione.trim() : null
    }

    if (body.campaignType !== undefined) {
      const validTypes = ['password_reset', 'invoice', 'executive_impersonation', 'urgent_request', 'training_invitation', 'security_alert']
      if (!validTypes.includes(body.campaignType)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Tipo di campagna non valido'
        })
      }
      updateData.campaignType = body.campaignType
    }

    if (body.status !== undefined) {
      const validStatuses = ['draft', 'scheduled', 'launched', 'completed']
      if (!validStatuses.includes(body.status)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Status non valido'
        })
      }
      updateData.status = body.status
    }

    // Aggiorna campagna
    const updated = await db.update(phishingCampaign)
      .set(updateData)
      .where(eq(phishingCampaign.id, id))
      .returning()

    return {
      success: true,
      data: updated[0]
    }

  } catch (error) {
    console.error('Errore aggiornamento campagna:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Errore interno del server'
    })
  }
})

