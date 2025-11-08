import { db } from '../../utils/db'
import { auth } from '../../utils/auth'
import { organization, user, employeeTarget } from '../../db/schema'
import { eq, and, count } from 'drizzle-orm'

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
        statusMessage: 'ID organizzazione mancante'
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

    // Controllo permessi
    const isAdmin = currentUser[0].role === 'admin'
    const isOwnOrg = currentUser[0].organizationId === id

    if (!isAdmin && !isOwnOrg) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Accesso negato: puoi visualizzare solo la tua organizzazione'
      })
    }

    // Recupera organizzazione
    const org = await db.select().from(organization).where(eq(organization.id, id)).limit(1)

    if (!org.length) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Organizzazione non trovata'
      })
    }

    // Conta dipendenti target
    const targetCount = await db.select({ count: count() })
      .from(employeeTarget)
      .where(and(
        eq(employeeTarget.organizationId, id),
        eq(employeeTarget.isActive, true)
      ))

    return {
      success: true,
      data: {
        ...org[0],
        targetCount: targetCount[0]?.count || 0
      }
    }

  } catch (error) {
    console.error('Errore recupero organizzazione:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Errore interno del server'
    })
  }
})

