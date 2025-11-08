<div align="center">

# 🛡️ Fortify

### Piattaforma AI per Simulazioni Phishing e Security Awareness Training

[![Nuxt](https://img.shields.io/badge/Nuxt-4.2.1-00DC82?style=for-the-badge&logo=nuxt.js&logoColor=white)](https://nuxt.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)

*Sistema avanzato per testare la resilienza dei dipendenti contro attacchi di social engineering*

[Caratteristiche](#-caratteristiche-principali) •
[Installazione](#-installazione-rapida) •
[Documentazione](#-documentazione) •
[Architettura](#-architettura)

</div>

---

## 📋 Indice

- [Panoramica](#-panoramica)
- [Caratteristiche Principali](#-caratteristiche-principali)
- [Stack Tecnologico](#-stack-tecnologico)
- [Installazione Rapida](#-installazione-rapida)
- [Configurazione](#-configurazione)
- [Utilizzo](#-utilizzo)
- [Architettura](#-architettura)
- [API Reference](#-api-reference)
- [Workflow](#-workflow-completo)
- [Sicurezza](#-sicurezza--privacy)
- [Roadmap](#-roadmap)
- [Contribuire](#-contribuire)
- [Licenza](#-licenza)

---

## 🎯 Panoramica

**Fortify** è una piattaforma enterprise per simulare attacchi di phishing e smishing in ambiente controllato, con l'obiettivo di aumentare la consapevolezza sulla sicurezza informatica dei dipendenti aziendali.

### 💡 Il Problema

- **91%** delle violazioni di sicurezza iniziano con un'email di phishing
- Le aziende perdono **milioni** ogni anno per attacchi di social engineering
- I training tradizionali sono **poco efficaci** e non personalizzati

### ✨ La Soluzione

Fortify utilizza **AI avanzata** (Llama 70B) e **OSINT** (scraping LinkedIn) per:

1. 🔍 **Analizzare** profili pubblici dei dipendenti
2. 🤖 **Generare** messaggi phishing ultra-personalizzati
3. 📊 **Misurare** la vulnerabilità reale del personale
4. 📈 **Fornire** training mirato basato sui risultati

---

## 🚀 Caratteristiche Principali

### 🎭 AI-Powered Personalization

- **6 tipi di campagne** predefinite (password reset, CEO fraud, invoice, ecc.)
- Messaggi personalizzati usando **Nebius AI (Llama 3.3 70B)**
- Analisi del tono e linguaggio per massima credibilità
- Adattamento automatico al ruolo e seniority del target

### 🔍 OSINT Intelligence

- **Scraping automatico LinkedIn** con Puppeteer + Stealth
- Estrazione dati: esperienze, competenze, post recenti
- **Versioning completo** con storico modifiche profilo
- Rate limiting intelligente per evitare detection

### 🏢 Multi-Tenancy Enterprise

- Isolamento completo tra organizzazioni
- **3 ruoli**: Admin, Company Admin, Analyst
- Permessi granulari con RBAC
- Dashboard dedicata per ogni azienda

### 📊 Analytics & Reporting

- Tracking in tempo reale: email sent, clicked, submitted
- **Metriche avanzate**: Click-through rate, Submission rate
- Heatmap vulnerabilità per dipartimento
- Report PDF esportabili (coming soon)

### 🔐 Security & Compliance

- Soft delete con retention completa
- Audit logging di tutte le operazioni
- Encryption at rest per dati sensibili
- GDPR compliant (solo dati pubblici)

---

## 🛠 Stack Tecnologico

### Frontend (Coming Soon)
- **Nuxt 4** - Framework Vue full-stack
- **NuxtUI** - Design system Apple-style
- **Tailwind CSS** - Styling utility-first

### Backend
- **Nuxt Server API** - API RESTful serverless
- **Better Auth** - Sistema di autenticazione moderno
- **Drizzle ORM** - Type-safe database toolkit
- **PostgreSQL** - Database relazionale

### AI & Scraping
- **Nebius AI** - Llama 3.3 70B Instruct
- **Puppeteer** - Browser automation
- **Puppeteer Extra Stealth** - Anti-detection

### DevOps
- **pnpm** - Package manager veloce
- **Drizzle Kit** - Database migrations
- **TypeScript** - Type safety end-to-end

---

## ⚡ Installazione Rapida

### Prerequisiti

```bash
node >= 18.x
pnpm >= 10.x
postgresql >= 14.x
```

### Setup

```bash
# 1. Clona il repository
git clone <repository-url>
cd Fortify

# 2. Installa dipendenze
pnpm install

# 3. Configura environment
cp .env.example .env
# Modifica .env con le tue credenziali

# 4. Setup database
pnpm db:generate
pnpm db:migrate

# 5. Crea utente admin
pnpm setup:admin

# 6. Avvia server di sviluppo
pnpm dev
```

Apri [http://localhost:3000](http://localhost:3000) 🎉

---

## ⚙️ Configurazione

### Variabili d'Ambiente

Crea un file `.env` nella root:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/fortify

# Better Auth
BETTER_AUTH_SECRET=your-super-secret-key-min-32-chars
BETTER_AUTH_URL=http://localhost:3000

# Nebius AI
NEBIUS_API_KEY=your-nebius-api-key

# App
NODE_ENV=development
PORT=3000
```

### Ottenere Nebius API Key

1. Vai su [studio.nebius.ai](https://studio.nebius.ai/)
2. Crea un account
3. Naviga in API Keys
4. Genera nuova chiave per Llama 3.3 70B
5. Copia la chiave nel file `.env`

---

## 📖 Utilizzo

### 1. Crea Organizzazione (Admin)

```bash
POST /api/organizations
Content-Type: application/json

{
  "nome": "Acme Corporation",
  "email": "admin@acmecorp.com"
}
```

### 2. Aggiungi Target Dipendenti

```bash
POST /api/targets
Content-Type: application/json

{
  "nome": "Mario Rossi",
  "email": "mario.rossi@acmecorp.com",
  "posizione": "Senior Developer",
  "dipartimento": "Engineering",
  "linkedinUrl": "https://linkedin.com/in/mariorossi"
}
```

### 3. Scraping Profilo

```bash
POST /api/scraping/linkedin
Content-Type: application/json

{
  "targetId": "uuid-del-target",
  "profileUrl": "https://linkedin.com/in/mariorossi"
}
```

### 4. Crea Campagna

```bash
POST /api/campaigns
Content-Type: application/json

{
  "nome": "Q1 2025 Security Awareness",
  "targetIds": ["uuid1", "uuid2", "uuid3"],
  "campaignType": "password_reset",
  "descrizione": "Test baseline awareness team"
}
```

L'AI genererà automaticamente messaggi personalizzati per ogni target!

### 5. Lancia Campagna

```bash
POST /api/campaigns/{campaignId}/launch
```

### 6. Monitora Risultati

```bash
GET /api/campaigns/{campaignId}
```

---

## 🏗 Architettura

### Database Schema

```
organization ─┬─> user (role, organizationId)
              ├─> employee_target
              └─> phishing_campaign ─> campaign_target ─> interaction_log

employee_target ─> social_profile ─> scraping_history (versioning)
```

### API Structure

```
server/
├── api/
│   ├── organizations/    # CRUD organizzazioni (admin)
│   ├── targets/          # CRUD target dipendenti
│   ├── scraping/         # LinkedIn scraping
│   ├── profiles/         # Social profiles data
│   └── campaigns/        # Campagne phishing
├── db/
│   └── schema.ts         # Drizzle schema
└── utils/
    ├── auth.ts           # Better Auth config
    ├── db.ts             # Database client
    ├── rbac.ts           # Access control
    ├── scraper/          # Puppeteer scrapers
    │   ├── base.ts       # Base classes
    │   └── linkedin.ts   # LinkedIn scraper
    └── ai/
        └── nebius.ts     # AI integration
```

### Data Flow

```mermaid
graph LR
    A[Company Admin] --> B[Create Target]
    B --> C[LinkedIn Scraping]
    C --> D[Scraping History DB]
    D --> E[Create Campaign]
    E --> F[Nebius AI]
    F --> G[Personalized Messages]
    G --> H[Launch Campaign]
    H --> I[Track Interactions]
    I --> J[Analytics Dashboard]
```

---

## 🔌 API Reference

### Organizations

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/organizations` | POST | Admin | Crea organizzazione |
| `/api/organizations` | GET | Admin | Lista organizzazioni |
| `/api/organizations/:id` | GET | Admin/Own | Dettaglio org |
| `/api/organizations/:id` | PATCH | Admin | Aggiorna org |

### Targets

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/targets` | POST | Company Admin | Crea target |
| `/api/targets` | GET | Company Admin | Lista targets |
| `/api/targets/:id` | GET | Company Admin | Dettaglio target |
| `/api/targets/:id` | PATCH | Company Admin | Aggiorna target |
| `/api/targets/:id` | DELETE | Company Admin | Elimina target (soft) |

### Scraping

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/scraping/linkedin` | POST | Company Admin | Avvia scraping |
| `/api/scraping/history/:targetId` | GET | Company Admin | Storico scraping |
| `/api/profiles/:profileId/latest` | GET | Company Admin | Dati più recenti |

### Campaigns

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/campaigns` | POST | Company Admin | Crea campagna |
| `/api/campaigns` | GET | Company Admin | Lista campagne |
| `/api/campaigns/:id` | GET | Company Admin | Dettaglio campagna |
| `/api/campaigns/:id` | PATCH | Company Admin | Aggiorna campagna |
| `/api/campaigns/:id/launch` | POST | Company Admin | Lancia campagna |

---

## 🎬 Workflow Completo

### Scenario: Test Phishing per Team Engineering

```bash
# 1. Login come Company Admin
POST /api/auth/sign-in/email
{"email": "admin@acme.com", "password": "****"}

# 2. Aggiungi 5 developer come target
POST /api/targets × 5
# Include LinkedIn URL per ognuno

# 3. Scraping automatico profili
POST /api/scraping/linkedin × 5
# Attendi completamento (30-60s per profilo)

# 4. Crea campagna "Password Reset"
POST /api/campaigns
{
  "nome": "Engineering Team - Password Test",
  "targetIds": ["dev1", "dev2", "dev3", "dev4", "dev5"],
  "campaignType": "password_reset"
}
# AI genera 5 messaggi personalizzati

# 5. Review messaggi (opzionale)
GET /api/campaigns/{id}
# Verifica messaggi generati

# 6. Lancia campagna
POST /api/campaigns/{id}/launch
# Simula invio immediate email

# 7. Monitora risultati real-time
GET /api/campaigns/{id}
# Vedi chi ha cliccato, chi ha inserito credenziali

# 8. Analizza metriche
# Click rate: 60% (3/5)
# Submit rate: 40% (2/5)
# → 2 developer necessitano training urgente!
```

---

## 🔒 Sicurezza & Privacy

### Conformità GDPR

✅ Solo dati **pubblicamente disponibili** (LinkedIn)  
✅ **No password** o credenziali reali salvate  
✅ **Soft delete** con retention policy  
✅ **Consenso** dell'azienda cliente (contratto)  
✅ **Anonimizzazione** opzionale risultati  

### Best Practices

- Usa **HTTPS** in produzione
- Ruota **BETTER_AUTH_SECRET** regolarmente
- **Rate limiting** su API pubbliche
- **Backup** database giornaliero
- **Audit logging** di operazioni sensibili

### Etica

Fortify è uno strumento **educativo**. Utilizzo consentito **solo**:

- ✅ Con consenso esplicito organizzazione
- ✅ Per scopi di training e awareness
- ✅ In ambienti controllati e autorizzati
- ❌ **NON** per attacchi reali o illegali

---

## 🗺 Roadmap

### ✅ Fase 1 - Backend (Completato)
- [x] Database schema completo
- [x] API RESTful complete
- [x] LinkedIn scraper con Puppeteer
- [x] Integrazione Nebius AI
- [x] Sistema campagne
- [x] Multi-tenancy + RBAC

### 🚧 Fase 2 - Frontend (Q1 2025)
- [ ] Dashboard admin con NuxtUI
- [ ] Gestione organizzazioni UI
- [ ] Target management interface
- [ ] Campaign builder wizard
- [ ] Real-time analytics charts
- [ ] Report generator PDF

### 🔮 Fase 3 - Advanced Features (Q2 2025)
- [ ] Email invio reale (SendGrid/AWS SES)
- [ ] SMS phishing (Twilio)
- [ ] Template editor personalizzati
- [ ] Machine learning risk scoring
- [ ] Webhook notifications
- [ ] API pubblica per integrazioni

### 🌐 Fase 4 - Enterprise (Q3 2025)
- [ ] White-label solution
- [ ] Multi-language support
- [ ] SSO integration (SAML, OAuth)
- [ ] Advanced reporting (BI tools)
- [ ] Mobile app (React Native)
- [ ] Compliance certifications

---

## 🤝 Contribuire

Contributi benvenuti! Per favore:

1. Fai fork del repository
2. Crea un branch: `git checkout -b feature/amazing-feature`
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Apri una Pull Request

### Coding Standards

- ✅ TypeScript strict mode
- ✅ ESLint + Prettier
- ✅ Conventional Commits
- ✅ Test coverage > 80% (future)

---

## 📄 Licenza

Questo progetto è sviluppato per scopi **educativi e di ricerca** nell'ambito universitario.

**© 2025 Università - Progetto Fortify**

---

## 📞 Supporto

Per domande, bug o feature request:

- 📧 Email: [email del team]
- 💬 Discord: [link server]
- 🐛 Issues: [GitHub Issues]

---

## 🙏 Ringraziamenti

- **Nuxt Team** - Framework incredibile
- **Nebius AI** - Llama 70B access
- **Drizzle Team** - Best ORM ever
- **Better Auth** - Modern auth solution
- **Puppeteer Team** - Automation magic

---

<div align="center">

### ⭐ Se Fortify ti è utile, lascia una stella!

**Costruito con ❤️ per rendere il web più sicuro**

[⬆️ Torna su](#-fortify)

</div>
