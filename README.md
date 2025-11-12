<div align="center">

# 🛡️ Fortify

### AI-Powered Phishing Simulation & Security Awareness Training Platform

[![Nuxt](https://img.shields.io/badge/Nuxt-4.2.1-00DC82?style=for-the-badge&logo=nuxt.js&logoColor=white)](https://nuxt.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)

*Advanced system to test employee resilience against social engineering attacks*

[Features](#-key-features) •
[Installation](#-quick-start) •
[Documentation](#-documentation) •
[Architecture](#-architecture)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Configuration](#️-configuration)
- [Usage](#-usage)
- [Architecture](#-architecture)
- [API Reference](#-api-reference)
- [Workflow](#-complete-workflow)
- [Security](#-security--privacy)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)
- [Authors](#-authors)

---

## 🎯 Overview

**Fortify** is an enterprise platform for simulating phishing and smishing attacks in a controlled environment, designed to increase cybersecurity awareness among corporate employees.

### 💡 The Problem

- **91%** of security breaches start with a phishing email
- Companies lose **millions** annually to social engineering attacks
- Traditional training is **ineffective** and not personalized

### ✨ The Solution

Fortify uses **advanced AI** (Llama 70B) and **OSINT** (LinkedIn scraping) to:

1. 🔍 **Analyze** public employee profiles
2. 🤖 **Generate** ultra-personalized phishing messages
3. 📊 **Measure** real staff vulnerability
4. 📈 **Provide** targeted training based on results

---

## 🚀 Key Features

### 🎭 AI-Powered Personalization

- **6 pre-built campaign types** (password reset, CEO fraud, invoice, etc.)
- Personalized messages using **Nebius AI (Llama 3.3 70B)**
- Tone and language analysis for maximum credibility
- Automatic adaptation to target's role and seniority

### 🔍 OSINT Intelligence

- **Automated LinkedIn scraping** with Puppeteer + Stealth
- Data extraction: experiences, skills, recent posts
- **Complete versioning** with profile change history
- Intelligent rate limiting to avoid detection

### 🏢 Enterprise Multi-Tenancy

- Complete isolation between organizations
- **3 roles**: Admin, Company Admin, Analyst
- Granular permissions with RBAC
- Dedicated dashboard for each company

### 📊 Analytics & Reporting

- Real-time tracking: email sent, clicked, submitted
- **Advanced metrics**: Click-through rate, Submission rate
- Vulnerability heatmap by department
- Exportable PDF reports (coming soon)

### 🔐 Security & Compliance

- Soft delete with full retention
- Audit logging of all operations
- Encryption at rest for sensitive data
- GDPR compliant (public data only)

---

## 🛠 Tech Stack

### Frontend (Coming Soon)
- **Nuxt 4** - Full-stack Vue framework
- **NuxtUI** - Apple-style design system
- **Tailwind CSS** - Utility-first styling

### Backend
- **Nuxt Server API** - Serverless RESTful API
- **Better Auth** - Modern authentication system
- **Drizzle ORM** - Type-safe database toolkit
- **PostgreSQL** - Relational database

### AI & Scraping
- **Nebius AI** - Llama 3.3 70B Instruct
- **Puppeteer** - Browser automation
- **Puppeteer Extra Stealth** - Anti-detection

### DevOps
- **pnpm** - Fast package manager
- **Drizzle Kit** - Database migrations
- **TypeScript** - End-to-end type safety

---

## ⚡ Quick Start

### Prerequisites

```bash
node >= 18.x
pnpm >= 10.x
postgresql >= 14.x
```

### Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd Fortify

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 4. Setup database
pnpm db:generate
pnpm db:migrate

# 5. Create admin user
pnpm setup:admin

# 6. Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root:

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

### Getting Nebius API Key

1. Go to [studio.nebius.ai](https://studio.nebius.ai/)
2. Create an account
3. Navigate to API Keys
4. Generate new key for Llama 3.3 70B
5. Copy the key to your `.env` file

---

## 📖 Usage

### 1. Create Organization (Admin)

```bash
POST /api/organizations
Content-Type: application/json

{
  "nome": "Acme Corporation",
  "email": "admin@acmecorp.com"
}
```

### 2. Add Employee Targets

```bash
POST /api/targets
Content-Type: application/json

{
  "nome": "John Doe",
  "email": "john.doe@acmecorp.com",
  "posizione": "Senior Developer",
  "dipartimento": "Engineering",
  "linkedinUrl": "https://linkedin.com/in/johndoe"
}
```

### 3. Profile Scraping

```bash
POST /api/scraping/linkedin
Content-Type: application/json

{
  "targetId": "target-uuid",
  "profileUrl": "https://linkedin.com/in/johndoe"
}
```

### 4. Create Campaign

```bash
POST /api/campaigns
Content-Type: application/json

{
  "nome": "Q1 2025 Security Awareness",
  "targetIds": ["uuid1", "uuid2", "uuid3"],
  "campaignType": "password_reset",
  "descrizione": "Baseline awareness test for engineering team"
}
```

AI will automatically generate personalized messages for each target!

### 5. Launch Campaign

```bash
POST /api/campaigns/{campaignId}/launch
```

### 6. Monitor Results

```bash
GET /api/campaigns/{campaignId}
```

---

## 🏗 Architecture

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
│   ├── organizations/    # Organization CRUD (admin)
│   ├── targets/          # Employee targets CRUD
│   ├── scraping/         # LinkedIn scraping
│   ├── profiles/         # Social profiles data
│   └── campaigns/        # Phishing campaigns
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
| `/api/organizations` | POST | Admin | Create organization |
| `/api/organizations` | GET | Admin | List organizations |
| `/api/organizations/:id` | GET | Admin/Own | Organization details |
| `/api/organizations/:id` | PATCH | Admin | Update organization |

### Targets

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/targets` | POST | Company Admin | Create target |
| `/api/targets` | GET | Company Admin | List targets |
| `/api/targets/:id` | GET | Company Admin | Target details |
| `/api/targets/:id` | PATCH | Company Admin | Update target |
| `/api/targets/:id` | DELETE | Company Admin | Delete target (soft) |

### Scraping

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/scraping/linkedin` | POST | Company Admin | Start scraping |
| `/api/scraping/history/:targetId` | GET | Company Admin | Scraping history |
| `/api/profiles/:profileId/latest` | GET | Company Admin | Latest data |

### Campaigns

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/campaigns` | POST | Company Admin | Create campaign |
| `/api/campaigns` | GET | Company Admin | List campaigns |
| `/api/campaigns/:id` | GET | Company Admin | Campaign details |
| `/api/campaigns/:id` | PATCH | Company Admin | Update campaign |
| `/api/campaigns/:id/launch` | POST | Company Admin | Launch campaign |

---

## 🎬 Complete Workflow

### Scenario: Phishing Test for Engineering Team

```bash
# 1. Login as Company Admin
POST /api/auth/sign-in/email
{"email": "admin@acme.com", "password": "****"}

# 2. Add 5 developers as targets
POST /api/targets × 5
# Include LinkedIn URL for each

# 3. Automatic profile scraping
POST /api/scraping/linkedin × 5
# Wait for completion (30-60s per profile)

# 4. Create "Password Reset" campaign
POST /api/campaigns
{
  "nome": "Engineering Team - Password Test",
  "targetIds": ["dev1", "dev2", "dev3", "dev4", "dev5"],
  "campaignType": "password_reset"
}
# AI generates 5 personalized messages

# 5. Review messages (optional)
GET /api/campaigns/{id}
# Verify generated messages

# 6. Launch campaign
POST /api/campaigns/{id}/launch
# Simulate immediate email sending

# 7. Monitor real-time results
GET /api/campaigns/{id}
# See who clicked, who submitted credentials

# 8. Analyze metrics
# Click rate: 60% (3/5)
# Submit rate: 40% (2/5)
# → 2 developers need urgent training!
```

---

## 🔒 Security & Privacy

### GDPR Compliance

✅ Only **publicly available** data (LinkedIn)  
✅ **No passwords** or real credentials saved  
✅ **Soft delete** with retention policy  
✅ Client company **consent** (contract)  
✅ Optional results **anonymization**  

### Best Practices

- Use **HTTPS** in production
- Rotate **BETTER_AUTH_SECRET** regularly
- **Rate limiting** on public APIs
- Daily **database backups**
- **Audit logging** for sensitive operations

### Ethics

Fortify is an **educational** tool. Authorized use **only**:

- ✅ With explicit organization consent
- ✅ For training and awareness purposes
- ✅ In controlled and authorized environments
- ❌ **NOT** for real or illegal attacks

---

## 🗺 Roadmap

### ✅ Phase 1 - Backend (Completed)
- [x] Complete database schema
- [x] Full RESTful API
- [x] LinkedIn scraper with Puppeteer
- [x] Nebius AI integration
- [x] Campaign system
- [x] Multi-tenancy + RBAC

### 🚧 Phase 2 - Frontend (Q1 2025)
- [ ] Admin dashboard with NuxtUI
- [ ] Organization management UI
- [ ] Target management interface
- [ ] Campaign builder wizard
- [ ] Real-time analytics charts
- [ ] PDF report generator

### 🔮 Phase 3 - Advanced Features (Q2 2025)
- [ ] Real email sending (SendGrid/AWS SES)
- [ ] SMS phishing (Twilio)
- [ ] Custom template editor
- [ ] Machine learning risk scoring
- [ ] Webhook notifications
- [ ] Public API for integrations



---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a branch: `git checkout -b feature/amazing-feature`
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Coding Standards

- ✅ TypeScript strict mode
- ✅ ESLint + Prettier
- ✅ Conventional Commits
- ✅ Test coverage > 80% (future)

---

## 📄 License

This project is developed for **educational and research** purposes within the university context.

**© 2025 University - Fortify Project**

---

## 👥 Authors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/mattyx97">
        <img src="https://github.com/mattyx97.png" width="100px;" alt="Mattia Guariglia"/><br />
        <sub><b>Mattia Guariglia</b></sub>
      </a><br />
      <sub>@mattyx97</sub><br />
      💻 🎨 📖
    </td>
    <td align="center">
      <a href="https://github.com/cerella17">
        <img src="https://github.com/cerella17.png" width="100px;" alt="Giuseppe Cerella"/><br />
        <sub><b>Giuseppe Cerella</b></sub>
      </a><br />
      <sub>@cerella17</sub><br />
      💻 🔬 📊
    </td>
  </tr>
</table>

*💻 Code · 🎨 Design · 📖 Documentation · 🔬 Research · 📊 Data Analysis*

---

## 📞 Support

For questions, bugs, or feature requests:

- 📧 Email: [team email]
- 💬 Discord: [server link]
- 🐛 Issues: [GitHub Issues]

---

## 🙏 Acknowledgments

- **Nuxt Team** - Amazing framework
- **Nebius AI** - Llama 70B access
- **Drizzle Team** - Best ORM ever
- **Better Auth** - Modern auth solution
- **Puppeteer Team** - Automation magic

---

<div align="center">

### ⭐ If Fortify is useful to you, give it a star!

**Built with ❤️ to make the web safer**

[⬆️ Back to top](#-fortify)

</div>
