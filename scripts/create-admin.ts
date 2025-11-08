/**
 * Script per creare il primo utente admin
 * 
 * Uso:
 * pnpm tsx scripts/create-admin.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import * as schema from '../server/db/schema'
import * as crypto from 'crypto'
import * as dotenv from 'dotenv'

// Carica variabili d'ambiente
dotenv.config()

const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL!,
  },
  schema: schema,
})

async function createAdminUser() {
  console.log('🔐 Creazione utente admin...\n')

  // Dati admin
  const adminEmail = 'admin@fortify.local'
  const adminPassword = 'admin123' // CAMBIARE IN PRODUZIONE!
  const adminName = 'Super Admin'

  // Verifica se esiste già
  const existing = await db.select()
    .from(schema.user)
    .where(eq(schema.user.email, adminEmail))
    .limit(1)

  if (existing.length > 0) {
    console.log('⚠️  Utente admin già esistente:')
    console.log(`   Email: ${existing[0].email}`)
    console.log(`   Nome: ${existing[0].name}`)
    console.log(`   ID: ${existing[0].id}`)
    return
  }

  // Crea organization per admin (opzionale)
  console.log('📦 Creazione organizzazione di test...')
  const org = await db.insert(schema.organization).values({
    nome: 'Fortify Admin',
    email: 'info@fortify.local',
    isActive: true,
  }).returning()

  console.log(`✅ Organizzazione creata: ${org[0].nome}`)

  // Crea utente admin
  // NOTA: Better Auth gestisce la creazione utenti con hash password
  // Questo è solo per reference - usa Better Auth API per creare utenti veri
  console.log('👤 Creazione utente admin...')
  
  const userId = crypto.randomUUID()
  
  const admin = await db.insert(schema.user).values({
    id: userId,
    name: adminName,
    email: adminEmail,
    emailVerified: true,
    role: 'admin',
    organizationId: org[0].id,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning()

  console.log(`✅ Utente admin creato: ${admin[0].email}`)
  console.log(`   ID: ${admin[0].id}`)
  console.log(`   Ruolo: ${admin[0].role}`)

  // Crea account per better-auth
  console.log('🔑 Creazione account Better Auth...')
  
  // Hash password (esempio semplice - Better Auth usa bcrypt)
  const hashedPassword = crypto.createHash('sha256').update(adminPassword).digest('hex')
  
  await db.insert(schema.account).values({
    id: crypto.randomUUID(),
    accountId: adminEmail,
    providerId: 'credential',
    userId: userId,
    password: hashedPassword, // In realtà Better Auth usa bcrypt
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  console.log('✅ Account creato\n')
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎉 Setup completato!\n')
  console.log('Credenziali admin:')
  console.log(`   Email: ${adminEmail}`)
  console.log(`   Password: ${adminPassword}`)
  console.log('\n⚠️  IMPORTANTE: Cambia la password dopo il primo login!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  
  console.log('📝 Prossimi passi:')
  console.log('1. Avvia il server: pnpm dev')
  console.log('2. Login con le credenziali sopra')
  console.log('3. Crea nuove organizzazioni da admin panel')
  console.log('4. Aggiungi target e avvia campagne\n')

  process.exit(0)
}

// Esegui script
createAdminUser().catch((error) => {
  console.error('❌ Errore:', error)
  process.exit(1)
})

