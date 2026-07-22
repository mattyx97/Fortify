# Fortify

Piattaforma di simulazione phishing e social engineering per security assessment autorizzati.

Fortify permette alle organizzazioni di testare la resilienza dei propri dipendenti agli attacchi di ingegneria sociale attraverso campagne di phishing simulate su email e SMS. Raccoglie intelligence tramite scraping dei profili social (LinkedIn, GitHub) per creare attacchi personalizzati e traccia le interazioni degli utenti (apertura email, click su link, invio credenziali) per identificare le vulnerabilita e migliorare la security awareness.

## Funzionalita principali

- **Gestione target** -- anagrafica dipendenti con profili social collegati (LinkedIn, GitHub, Twitter, Facebook, Instagram)
- **Scraping automatico** -- raccolta dati pubblici dai profili LinkedIn (esperienze, competenze, attivita recenti) e GitHub (bio, repository) tramite Puppeteer
- **Template campagne** -- template predefiniti per scenari comuni (reset password, fattura urgente, richiesta CEO, verifica SMS)
- **Campagne phishing** -- creazione e invio di campagne multi-canale (email, SMS) con landing page personalizzate
- **Tracking interazioni** -- monitoraggio apertura email, click link, invio form, credential harvesting con metadata (IP, user agent)
- **Multi-tenant** -- organizzazioni con ruoli (company_admin, analyst) e gestione membri

## Prerequisiti

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) (per Postgres, S3, mail server)

## Setup

### 1. Installa le dipendenze

```bash
pnpm install
```

### 2. Configura le variabili d'ambiente

```bash
cp .env.example .env
```

Modifica `.env` con i tuoi valori. I default funzionano gia per lo sviluppo locale con Docker.

### 3. Genera i cookie LinkedIn

Lo scraping dei profili LinkedIn richiede cookie di sessione autenticati. Genera il file `.cookies.json` con:

```bash
pnpm exec tsx scripts/grab-cookies.ts
```

Si apre un browser -- fai login su LinkedIn manualmente. Una volta sul feed, i cookie vengono salvati automaticamente in `.cookies.json` e puoi chiudere il browser.

> I cookie scadono periodicamente. Se lo scraping smette di funzionare, riesegui lo script.

### 4. Avvia l'applicazione

```bash
pnpm dev
```

Questo comando avvia i container Docker (Postgres, S3, mail server) e il dev server Nuxt. Le migrazioni del database vengono applicate automaticamente all'avvio.

| Servizio | URL |
|---|---|
| App | http://localhost:3000 |
| Mail UI | http://localhost:1080 |
| S3 Console | http://localhost:9001 |
| Drizzle Studio | Nuxt DevTools (integrato) |

## Comandi utili

| Comando | Descrizione |
|---|---|
| `pnpm dev` | Avvia infra Docker + dev server |
| `pnpm build` | Build di produzione |
| `pnpm db:generate` | Genera migrazioni da cambiamenti allo schema |
| `pnpm db:migrate` | Applica migrazioni |
| `pnpm db:push` | Push schema diretto al DB (solo dev) |
| `pnpm db:studio` | Apri Drizzle Studio |
| `pnpm infra:dev-up` | Avvia solo i container Docker |
| `pnpm infra:dev-down` | Ferma i container Docker |
| `pnpm infra:dev-reset` | Rimuovi container, volumi e immagini locali |

## Stack

**Backend**: Nuxt 4, Nitro, Drizzle ORM, PostgreSQL, Better Auth, Nodemailer, Stripe, Mastra (AI), Puppeteer (scraping)

**Frontend**: Vue 3, Nuxt UI, TanStack Query, Tailwind CSS

**Infra dev**: Docker Compose (Postgres, RustFS/S3, MailDev)

## Architettura

```
server/
├── api/              # HTTP handlers (validazione, auth, routing ai servizi)
├── services/         # Business logic
├── lib/              # Setup infrastruttura (database, auth, mailer, scraper, campaign...)
├── tasks/            # Task schedulati (scraping automatico)
└── utils/            # Composable server, handler definitions
app/
├── composables/      # Auth, query TanStack Query
├── pages/            # Pagine (dashboard, target, campagne, template)
└── middleware/        # Route guards
shared/
└── utils/abilities/  # Regole di autorizzazione (client + server)
```

Documentazione tecnica completa in [CLAUDE.md](./CLAUDE.md).

## Licenza

MIT
