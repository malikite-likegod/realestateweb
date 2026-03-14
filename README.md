# LuxeRealty — Production Real Estate Platform

A full-stack luxury real estate platform with CRM, IDX integration, AI automation, and advanced property search.

## Tech Stack

- **Frontend:** Next.js 15, TypeScript, TailwindCSS, Framer Motion, Lucide
- **Backend:** Next.js API Routes, Prisma ORM
- **Auth:** bcryptjs + JWT (jose)
- **Charts:** Recharts
- **Drag & Drop:** @dnd-kit
- **AI:** Claude (Anthropic) or OpenAI — configurable

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Run the setup wizard

```bash
npm run setup
```

The wizard will:
- Ask for database mode (SQLite for dev, MySQL/MariaDB for prod)
- Create your `.env` file
- Run Prisma migrations
- Create your admin account

### 3. Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — public marketing site
Open [http://localhost:3000/admin/login](http://localhost:3000/admin/login) — CRM login

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `DB_PROVIDER` | `sqlite` or `mysql` |
| `DATABASE_URL` | SQLite file path or MySQL connection string |
| `JWT_SECRET` | Long random string (32+ chars) |
| `ANTHROPIC_API_KEY` | For AI features (optional) |
| `OPENAI_API_KEY` | Fallback AI provider (optional) |
| `IDX_API_KEY` | TREB IDX Broker API key |
| `OPENCLAW_WEBHOOK_SECRET` | Webhook HMAC secret |

---

## Database

### Development (SQLite)
```bash
npm run db:push      # push schema without migrations
npm run db:studio    # open Prisma Studio
```

### Production (MySQL)
```bash
npm run db:migrate   # run migrations
npm run db:generate  # regenerate client
```

---

## API Reference

### Public
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/search` | Property search (IDX + manual) |
| `POST` | `/api/contacts` | Lead capture |
| `GET` | `/api/blog` | Blog posts |
| `GET` | `/api/blog/:slug` | Single post |
| `POST` | `/api/behavior` | Track behavior events |

### Protected (JWT cookie)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/logout` | Logout |
| `GET` | `/api/contacts` | List contacts |
| `POST` | `/api/contacts` | Create contact |
| `GET/PATCH/DELETE` | `/api/contacts/:id` | Manage contact |
| `GET/POST` | `/api/deals` | Pipeline deals |
| `GET/PATCH/DELETE` | `/api/deals/:id` | Manage deal |
| `GET/POST` | `/api/tasks` | Tasks |
| `GET/POST` | `/api/listings` | Listings |
| `GET/POST` | `/api/blog` | Blog CMS |
| `POST` | `/api/ai/jobs` | Queue AI jobs |
| `POST` | `/api/idx/sync` | Sync IDX listings |

### OpenClaw AI (API Key: Bearer token)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/ai/command` | Execute AI command |
| `GET` | `/api/ai/analyze` | Read CRM analytics |

#### AI Commands
```json
{ "command": "create_task", "data": { "title": "Follow up with John", "contactId": "..." } }
{ "command": "log_activity", "data": { "type": "call", "subject": "Discovery call", "contactId": "..." } }
{ "command": "update_lead_score", "data": { "contactId": "...", "delta": 10, "reason": "Viewed 3 listings" } }
{ "command": "create_contact", "data": { "firstName": "Jane", "lastName": "Smith", "email": "..." } }
{ "command": "create_note", "data": { "body": "Client interested in Forest Hill", "contactId": "..." } }
{ "command": "generate_listing_description", "data": { "propertyDetails": "4 bed, 3 bath detached in Rosedale..." } }
```

### IDX Sync (Cron)
```bash
curl -X POST http://localhost:3000/api/idx/sync \
  -H "x-cron-secret: YOUR_SYNC_SECRET"
```

---

## Project Structure

```
/app
  /(public)          # Marketing website
  /(admin)           # CRM dashboard
  /api               # API routes
/components
  /ui                # Core UI components (Button, Input, Modal…)
  /layout            # Layout primitives (HeroSection, Container…)
  /navigation        # Navbar, Sidebar, Footer…
  /forms             # Lead capture, inquiry, valuation forms
  /real-estate       # PropertyCard, Gallery, Testimonials…
  /crm               # DealPipeline, ContactTable, ActivityTimeline…
  /analytics         # Charts, StatsCards
  /dashboard         # DashboardLayout, Widgets
/services
  /idx               # IDX sync, parser, client
  /search            # Search engine + filters
  /ai                # AI client, commands, jobs, webhooks, lead scoring
/lib                 # Prisma, auth, JWT, utils, constants
/types               # TypeScript types
/scripts             # Setup wizard
/prisma              # Schema
```

---

## CRM Features

- **Contacts** — Full contact profiles, tags, lead scoring, activity timeline
- **Deals Pipeline** — Drag & drop Kanban with @dnd-kit
- **Tasks** — Priority, due dates, assignees
- **Activities** — Calls, emails, meetings, notes, showings
- **Blog CMS** — Write, publish, manage posts
- **Analytics** — Traffic, lead sources, conversion charts
- **Automation** — Sequence builder for lead nurturing
- **AI Jobs** — Blog generation, listing descriptions, market analysis

---

## AI Integration (OpenClaw)

Set `OPENCLAW_WEBHOOK_SECRET` and optionally `OPENCLAW_WEBHOOK_URLS` (comma-separated) to receive webhooks on:
- `new_lead` — contact captured
- `deal_stage_changed` — pipeline movement
- `showing_scheduled` — showing booked
- `new_listing` — listing published

Use the `/api/ai/command` endpoint with `Authorization: Bearer YOUR_API_KEY` to control the CRM programmatically.
