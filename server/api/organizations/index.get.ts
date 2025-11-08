import { db } from '../../utils/db'
import { auth } from '../../utils/auth'
import { organization, user } from '../../db/schema'
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

    // Verifica ruolo admin
    const currentUser = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
    if (!currentUser.length || currentUser[0].role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Accesso negato: solo gli admin possono visualizzare tutte le organizzazioni'
      })
    }

    // Lista tutte le organizzazioni
    const organizations = await db.select({
      id: organization.id,
      nome: organization.nome,
      email: organization.email,
      isActive: organization.isActive,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    })
    .from(organization)
    .orderBy(desc(organization.createdAt))

    return {
      success: true,
      organizations
    }

  } catch (error) {
    console.error('Errore recupero organizzazioni:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Errore interno del server'
    })
  }
})

