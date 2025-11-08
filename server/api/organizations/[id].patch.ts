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
        statusMessage: 'Accesso negato: solo gli admin possono modificare organizzazioni'
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

    // Validazione input
    const body = await readBody(event)

    // Verifica esistenza organizzazione
    const existing = await db.select().from(organization).where(eq(organization.id, id)).limit(1)
    if (!existing.length) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Organizzazione non trovata'
      })
    }

    // Costruisci update object
    const updateData: any = {
      updatedAt: new Date(),
    }

    if (body.nome !== undefined) {
      if (typeof body.nome !== 'string' || body.nome.trim().length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Nome organizzazione non valido'
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

      // Verifica duplicati email (escludendo organizzazione corrente)
      const duplicate = await db.select()
        .from(organization)
        .where(eq(organization.email, body.email.toLowerCase().trim()))
        .limit(1)

      if (duplicate.length > 0 && duplicate[0].id !== id) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Email già utilizzata da altra organizzazione'
        })
      }

      updateData.email = body.email.toLowerCase().trim()
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

    // Aggiorna organizzazione
    const updated = await db.update(organization)
      .set(updateData)
      .where(eq(organization.id, id))
      .returning()

    return {
      success: true,
      data: updated[0]
    }

  } catch (error) {
    console.error('Errore aggiornamento organizzazione:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Errore interno del server'
    })
  }
})

