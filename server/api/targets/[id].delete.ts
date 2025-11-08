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
        statusMessage: 'Accesso negato: puoi eliminare solo i target della tua organizzazione'
      })
    }

    // Soft delete: imposta isActive a false
    const deleted = await db.update(employeeTarget)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(employeeTarget.id, id))
      .returning()

    return {
      success: true,
      data: deleted[0]
    }

  } catch (error) {
    console.error('Errore eliminazione target:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Errore interno del server'
    })
  }
})

