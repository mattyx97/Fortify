import { db } from '../../utils/db'
import { auth } from '../../utils/auth'
import { organization, user } from '../../db/schema'
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

    // Verifica ruolo admin
    const currentUser = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
    if (!currentUser.length || currentUser[0].role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Accesso negato: solo gli admin possono creare organizzazioni'
      })
    }

    // Validazione input
    const body = await readBody(event)
    
    if (!body.nome || typeof body.nome !== 'string' || body.nome.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Nome organizzazione obbligatorio'
      })
    }

    if (!body.email || typeof body.email !== 'string' || !body.email.includes('@')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email valida obbligatoria'
      })
    }

    // Verifica duplicati email
    const existing = await db.select()
      .from(organization)
      .where(eq(organization.email, body.email.toLowerCase().trim()))
      .limit(1)

    if (existing.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Organizzazione con questa email già esistente'
      })
    }

    // Crea organizzazione
    const newOrg = await db.insert(organization).values({
      nome: body.nome.trim(),
      email: body.email.toLowerCase().trim(),
      isActive: body.isActive !== undefined ? body.isActive : true,
    }).returning()

    return {
      success: true,
      data: newOrg[0]
    }

  } catch (error) {
    console.error('Errore creazione organizzazione:', error)
    
    // Se è già un errore HTTP, rilancia
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Errore interno del server'
    })
  }
})

