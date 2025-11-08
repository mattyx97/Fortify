import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Carica le variabili d'ambiente
dotenv.config();

// Database URL
const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres';

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './drizzle',
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
