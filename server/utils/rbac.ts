import { db } from './db'
import { user } from '../db/schema'
import { eq } from 'drizzle-orm'
import type { Session } from 'better-auth'

// Tipi di ruoli
export type UserRole = 'admin' | 'company_admin' | 'analyst'

// Interfaccia per dati utente estesi
export interface ExtendedUser {
  id: string
  name: string
  email: string
  role: UserRole
  organizationId: string | null
  isActive: boolean
}

/**
 * Recupera utente corrente dal database
 */
export async function getCurrentUser(userId: string): Promise<ExtendedUser | null> {
  try {
    const users = await db.select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      isActive: user.isActive,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

    if (!users.length) {
      return null
    }

    return users[0] as ExtendedUser
  } catch (error) {
    console.error('Errore recupero utente:', error)
    return null
  }
}

/**
 * Verifica se l'utente ha uno dei ruoli specificati
 */
export function hasRole(userRole: string, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole as UserRole)
}

/**
 * Verifica se l'utente ha accesso a una risorsa dell'organizzazione
 */
export function hasOrganizationAccess(
  userOrgId: string | null,
  resourceOrgId: string,
  userRole: string
): boolean {
  // Admin ha sempre accesso
  if (userRole === 'admin') {
    return true
  }

  // Altri ruoli devono appartenere alla stessa organizzazione
  return userOrgId === resourceOrgId
}

/**
 * Verifica se l'utente è admin
 */
export function isAdmin(userRole: string): boolean {
  return userRole === 'admin'
}

/**
 * Verifica se l'utente è company admin o superiore
 */
export function isCompanyAdminOrAbove(userRole: string): boolean {
  return userRole === 'admin' || userRole === 'company_admin'
}

/**
 * Helper per creare errori HTTP personalizzati
 */
export function createAuthError(statusCode: number, message: string) {
  return createError({
    statusCode,
    statusMessage: message
  })
}

/**
 * Middleware: richiede autenticazione
 */
export async function requireAuth(session: any): Promise<ExtendedUser> {
  if (!session) {
    throw createAuthError(401, 'Non autorizzato')
  }

  const currentUser = await getCurrentUser(session.user.id)
  
  if (!currentUser) {
    throw createAuthError(404, 'Utente non trovato')
  }

  if (!currentUser.isActive) {
    throw createAuthError(403, 'Account disattivato')
  }

  return currentUser
}

/**
 * Middleware: richiede ruoli specifici
 */
export function requireRole(currentUser: ExtendedUser, allowedRoles: UserRole[]): void {
  if (!hasRole(currentUser.role, allowedRoles)) {
    throw createAuthError(
      403,
      `Accesso negato: ruolo richiesto ${allowedRoles.join(' o ')}`
    )
  }
}

/**
 * Middleware: richiede accesso all'organizzazione
 */
export function requireOrganizationAccess(
  currentUser: ExtendedUser,
  resourceOrgId: string
): void {
  if (!hasOrganizationAccess(currentUser.organizationId, resourceOrgId, currentUser.role)) {
    throw createAuthError(
      403,
      'Accesso negato: puoi accedere solo alle risorse della tua organizzazione'
    )
  }
}

/**
 * Middleware: richiede che l'utente abbia un'organizzazione
 */
export function requireOrganization(currentUser: ExtendedUser): void {
  if (!currentUser.organizationId && currentUser.role !== 'admin') {
    throw createAuthError(
      403,
      'Utente non associato a nessuna organizzazione'
    )
  }
}

/**
 * Helper: ottieni organization ID dell'utente o quello fornito (per admin)
 */
export function getEffectiveOrganizationId(
  currentUser: ExtendedUser,
  requestedOrgId?: string
): string {
  // Admin può specificare organizationId diversa
  if (currentUser.role === 'admin' && requestedOrgId) {
    return requestedOrgId
  }

  // Altri usano la propria organizzazione
  if (!currentUser.organizationId) {
    throw createAuthError(400, 'Organization ID mancante')
  }

  return currentUser.organizationId
}

/**
 * Helper per validazione permessi completa
 * Combina auth + role + org access
 */
export async function validatePermissions(
  session: any,
  options: {
    requireRoles?: UserRole[]
    requireOrg?: boolean
    resourceOrgId?: string
  }
): Promise<ExtendedUser> {
  // 1. Verifica autenticazione
  const currentUser = await requireAuth(session)

  // 2. Verifica ruolo se specificato
  if (options.requireRoles) {
    requireRole(currentUser, options.requireRoles)
  }

  // 3. Verifica organizzazione se richiesto
  if (options.requireOrg) {
    requireOrganization(currentUser)
  }

  // 4. Verifica accesso alla risorsa specifica se fornito orgId
  if (options.resourceOrgId) {
    requireOrganizationAccess(currentUser, options.resourceOrgId)
  }

  return currentUser
}

/**
 * Helper per log audit (per future implementazioni)
 */
export async function logAudit(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata?: any
): Promise<void> {
  // TODO: Implementare audit logging in futuro
  console.log('AUDIT:', {
    userId,
    action,
    resourceType,
    resourceId,
    metadata,
    timestamp: new Date().toISOString()
  })
}

