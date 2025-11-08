import { db } from '../../utils/db'
import { auth } from '../../utils/auth'
import { employeeTarget, user } from '../../db/schema'
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

    // Verifica esistenza target
    const existing = await db.select().from(employeeTarget).where(eq(employeeTarget.id, id)).limit(1)
    if (!existing.length) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Target non trovato'
      })
    }

    // Controllo permessi (multi-tenant)
    const isAdmin = currentUser[0].role === 'admin'
    const isOwnOrg = currentUser[0].organizationId === existing[0].organizationId

    if (!isAdmin && !isOwnOrg) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Accesso negato: puoi modificare solo i target della tua organizzazione'
      })
    }

    // Validazione input
    const body = await readBody(event)

    // Costruisci update object
    const updateData: any = {
      updatedAt: new Date(),
    }

    if (body.nome !== undefined) {
      if (typeof body.nome !== 'string' || body.nome.trim().length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Nome non valido'
        })
      }
      updateData.nome = body.nome.trim()
    }

    if (body.email !== undefined) {
      if (typeof body.email !== 'string' || !body.email.includes('@')) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Email non valida'
        })
      }
      updateData.email = body.email.toLowerCase().trim()
    }

    if (body.posizione !== undefined) {
      updateData.posizione = body.posizione ? body.posizione.trim() : null
    }

    if (body.dipartimento !== undefined) {
      updateData.dipartimento = body.dipartimento ? body.dipartimento.trim() : null
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') {
        throw createError({
          statusCode: 400,
          statusMessage: 'isActive deve essere boolean'
        })
      }
      updateData.isActive = body.isActive
    }

    // Aggiorna target
    const updated = await db.update(employeeTarget)
      .set(updateData)
      .where(eq(employeeTarget.id, id))
      .returning()

    return {
      success: true,
      data: updated[0]
    }

  } catch (error) {
    console.error('Errore aggiornamento target:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Errore interno del server'
    })
  }
})

