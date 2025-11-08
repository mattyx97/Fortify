// Migrazione standalone per produzione
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as dotenv from 'dotenv';

// Carica variabili d'ambiente
dotenv.config();

// Ottieni DATABASE_URL dall'ambiente
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL non definito nelle variabili d\'ambiente');
  process.exit(1);
}

// Crea una connessione al database
const client = postgres(DATABASE_URL);
const db = drizzle(client);

// Funzione per eseguire le migrazioni
async function runMigrations() {
  console.log('🔄 Avvio migrazione database...');
  
  try {
    // Esegui le migrazioni
    await migrate(db, { migrationsFolder: 'drizzle' });
    
    console.log('✅ Migrazione completata con successo');
    // Chiudi la connessione
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    // Chiudi la connessione anche in caso di errore
    await client.end();
    process.exit(1);
  }
}

// Esegui le migrazioni
runMigrations(); 