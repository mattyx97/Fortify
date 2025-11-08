# Fortify Platform - Setup Guide

## Overview
Fortify è una piattaforma di simulazione phishing basata su AI per training aziendale sulla sicurezza informatica. Utilizza scraping LinkedIn tramite Puppeteer e generazione messaggi personalizzati con Nebius AI (Llama 70B).

## Prerequisiti
- Node.js 18+ 
- PostgreSQL 14+
- pnpm 10+
- Account Nebius AI (per API Llama 70B)

## Installazione

### 1. Clona e installa dipendenze
```bash
cd /Users/mattiaguariglia/Desktop/Università/Fortify
pnpm install
```

### 2. Configura variabili d'ambiente
Crea un file `.env` nella root del progetto:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/fortify

# Better Auth
BETTER_AUTH_SECRET=your-secret-key-here-change-in-production
BETTER_AUTH_URL=http://localhost:3000

# Nebius AI (Llama 70B)
NEBIUS_API_KEY=your-nebius-api-key-here

# App Configuration
NODE_ENV=development
PORT=3000
```

**Importante:** 
- Cambia `BETTER_AUTH_SECRET` con una stringa random sicura
- Ottieni `NEBIUS_API_KEY` da https://studio.nebius.ai/

### 3. Setup Database

#### Crea database PostgreSQL:
```bash
createdb fortify
```

#### Genera e applica migrazioni Drizzle:
```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### 4. Avvia l'applicazione
```bash
# Development
pnpm dev

# Production build
pnpm build
pnpm preview
```

## Struttura Database

### Tabelle Principali

**organization** - Aziende clienti
- id, nome, email, isActive, createdAt, updatedAt

**user** - Utenti (Better Auth)
- id, name, email, role (admin/company_admin/analyst)
- organizationId (FK), isActive

**employee_target** - Dipendenti da testare
- id, organizationId (FK), nome, email, posizione, dipartimento

**social_profile** - Profili social
- id, targetId (FK), platform, profileUrl, scrapingStatus

**scraping_history** - Storico scraping (versioning)
- id, socialProfileId (FK), rawData (JSONB), version, scrapedAt

**phishing_campaign** - Campagne di test
- id, organizationId (FK), nome, status, campaignType, createdById

**campaign_target** - Target per campagna
- id, campaignId (FK), targetId (FK), personalizedMessage, sentAt, clickedAt

**interaction_log** - Tracking interazioni
- id, campaignTargetId (FK), type, data (JSONB), timestamp

## API Endpoints

### Organizations (Admin only)
- `POST /api/organizations` - Crea organizzazione
- `GET /api/organizations` - Lista organizzazioni
- `GET /api/organizations/:id` - Dettaglio organizzazione
- `PATCH /api/organizations/:id` - Aggiorna organizzazione

### Employee Targets
- `POST /api/targets` - Crea target
- `GET /api/targets` - Lista target (filtrato per org)
- `GET /api/targets/:id` - Dettaglio target
- `PATCH /api/targets/:id` - Aggiorna target
- `DELETE /api/targets/:id` - Elimina target (soft delete)

### Scraping LinkedIn
- `POST /api/scraping/linkedin` - Avvia scraping profilo
  ```json
  {
    "targetId": "uuid",
    "profileUrl": "https://linkedin.com/in/..."
  }
  ```
- `GET /api/scraping/history/:targetId` - Storico scraping
- `GET /api/profiles/:profileId/latest` - Dati più recenti

### Campaigns
- `POST /api/campaigns` - Crea campagna con AI
  ```json
  {
    "nome": "Test Q1 2025",
    "targetIds": ["uuid1", "uuid2"],
    "campaignType": "password_reset",
    "descrizione": "Test awareness dipendenti"
  }
  ```
- `GET /api/campaigns` - Lista campagne
- `GET /api/campaigns/:id` - Dettaglio campagna con target
- `PATCH /api/campaigns/:id` - Aggiorna campagna
- `POST /api/campaigns/:id/launch` - Lancia campagna

## Tipi di Campagna

- `password_reset` - Simulazione reset password
- `invoice` - Fattura falsa (AWS, Microsoft, etc)
- `executive_impersonation` - CEO fraud
- `urgent_request` - Richiesta urgente
- `training_invitation` - Invito training
- `security_alert` - Alert sicurezza

## Ruoli Utente

### admin (Super Admin)
- Accesso completo a tutte le organizzazioni
- Gestione organizzazioni
- Visualizza tutte le campagne

### company_admin (Admin Azienda)
- Gestisce target della propria organizzazione
- Crea e lancia campagne
- Visualizza report

### analyst (Analista)
- Visualizza campagne e report
- Non può creare/modificare

## Workflow Tipico

### 1. Setup Organizzazione (Admin)
```bash
POST /api/organizations
{
  "nome": "Acme Corp",
  "email": "admin@acmecorp.com"
}
```

### 2. Aggiungi Dipendenti Target
```bash
POST /api/targets
{
  "nome": "Mario Rossi",
  "email": "mario.rossi@acmecorp.com",
  "posizione": "Senior Developer",
  "dipartimento": "Engineering",
  "linkedinUrl": "https://linkedin.com/in/mariorossi"
}
```

### 3. Scraping Profilo LinkedIn
```bash
POST /api/scraping/linkedin
{
  "targetId": "target-uuid",
  "profileUrl": "https://linkedin.com/in/mariorossi"
}
```

### 4. Crea Campagna con AI
```bash
POST /api/campaigns
{
  "nome": "Phishing Awareness Q1",
  "targetIds": ["target-uuid-1", "target-uuid-2"],
  "campaignType": "password_reset"
}
```
L'AI genererà automaticamente messaggi personalizzati per ogni target.

### 5. Lancia Campagna
```bash
POST /api/campaigns/:id/launch
```

### 6. Monitora Risultati
```bash
GET /api/campaigns/:id
```

## Security & Multi-Tenancy

- **Isolamento Organizzazioni**: Ogni azienda vede solo i propri dati
- **RBAC**: Controllo accessi basato su ruoli
- **Soft Delete**: I target eliminati mantengono lo storico
- **Versioning**: Storico completo di tutti gli scraping

## Scraping LinkedIn

### Configurazione Puppeteer
- Headless mode di default
- Stealth plugin per evitare detection
- Rate limiting automatico
- Retry logic su errori

### Dati Estratti
- Nome completo, headline, posizione
- Azienda attuale
- Bio/About
- Esperienze lavorative (ultime 3)
- Competenze (top 10)
- Formazione
- Post recenti (ultimi 5)

### Limitazioni
- Solo profili pubblici
- LinkedIn può bloccare scraping intensivo
- Usa rate limiting appropriato

## AI Integration (Nebius)

### Modello
- **meta-llama/Llama-3.3-70B-Instruct**
- Endpoint: https://api.studio.nebius.ai/v1/

### Funzionalità
1. **Generazione Messaggi Personalizzati**
   - Analizza profilo target
   - Personalizza per ruolo/azienda
   - Tono professionale credibile

2. **Analisi Rischio Profilo**
   - Score 0-100
   - Fattori di rischio
   - Raccomandazioni training

## Development

### Struttura Progetto
```
Fortify/
├── server/
│   ├── api/           # API endpoints
│   │   ├── organizations/
│   │   ├── targets/
│   │   ├── scraping/
│   │   ├── campaigns/
│   │   └── profiles/
│   ├── db/
│   │   └── schema.ts  # Database schema
│   └── utils/
│       ├── auth.ts    # Better Auth config
│       ├── db.ts      # Drizzle config
│       ├── rbac.ts    # RBAC helpers
│       ├── scraper/   # LinkedIn scraper
│       └── ai/        # Nebius AI integration
├── app/               # Nuxt app (UI - da implementare)
└── drizzle.config.ts  # Drizzle Kit config
```

### Testing API
Usa Postman/Insomnia/curl:

```bash
# Login (Better Auth)
POST http://localhost:3000/api/auth/sign-in/email
{
  "email": "admin@example.com",
  "password": "password"
}

# Usa session cookie per chiamate autenticate
```

## Troubleshooting

### Error: NEBIUS_API_KEY non configurata
- Assicurati di aver impostato `NEBIUS_API_KEY` nel file `.env`
- Ottieni API key da https://studio.nebius.ai/

### Scraping LinkedIn fallisce
- LinkedIn blocca scraping aggressivo
- Usa rate limiting appropriato
- Considera pause tra richieste
- Verifica che profilo sia pubblico

### Database connection error
- Verifica che PostgreSQL sia avviato
- Controlla `DATABASE_URL` nel `.env`
- Assicurati che il database esista

## Prossimi Sviluppi

### Fase Successiva - UI con NuxtUI
- Dashboard organizzazioni
- Gestione target
- Creazione campagne
- Visualizzazione report e statistiche
- Grafici interattivi

### Future Features
- Email invio reale (SendGrid/AWS SES)
- SMS phishing (Twilio)
- Template personalizzati
- Report PDF
- Webhook notifiche
- Multi-language support

## License
Privato - Uso interno università

## Support
Per domande o problemi, contatta il team di sviluppo.

