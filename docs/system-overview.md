# LuxeRealty — System Overview

> Last updated: 2026-04-03

## What This System Is

LuxeRealty is a dual-interface real estate platform:

1. **Admin Dashboard** (`/admin/*`) — Real estate agents manage listings, contacts, deals, campaigns, tasks, and communications.
2. **Contact Portal** (`/portal/*`) — Clients browse MLS listings, save favourites, run searches, and receive curated listing packages.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL (prod) / SQLite (dev) via Prisma ORM |
| Auth | JWT (`jose`) — separate tokens for admin and portal users |
| Styling | Tailwind CSS (`charcoal-*`, `gold-*` palettes) |
| SMS | Twilio |
| Email | Nodemailer (SMTP out) + IMAP (inbound sync) |
| AI | Anthropic Claude / OpenAI (configurable) |
| MLS Data | Amplify/TREB RESO IDX API |
| Cache / Rate limiting | Redis (optional; falls back to in-memory LRU) |

---

## Authentication

### Admin / Agent (`auth_token` cookie)

- JWT signed with `JWT_SECRET`, expires per `JWT_EXPIRES_IN` (default 7 days)
- `getSession()` reads the cookie and returns `{ id, name, email, role, avatarUrl }`
- Roles: `admin`, `agent`, `viewer`
- Tokens issued before a password change are automatically invalidated
- TOTP two-factor authentication is available per user

### Contact Portal (`contact_token` cookie)

- Separate JWT, expires per `CONTACT_JWT_EXPIRES_IN` (default 30 days)
- Contact must have `accountStatus === 'active'`
- `getContactSession()` reads the cookie
- Contacts are invited via a 72-hour magic link email → they set a password → then log in normally

### API Keys

- For programmatic access: `Authorization: Bearer <api_key>` header
- Keys are bcrypt-hashed; only the first 8 characters (prefix) are shown in the UI
- Accepted on `/api/ai/command`

---

## Route Protection

Middleware (`middleware.ts`) enforces authentication on:

```
/admin/*
/api/contacts/*
/api/deals/*
/api/tasks/*
/api/activities/*
/api/listings/*
/api/blog/*
/api/stages/*
/api/api-keys/*
/api/admin/*
/api/tags/*
/api/uploads/*
```

Portal routes (`/portal/*`, `/api/portal/*`) are protected by the contact JWT.

Public routes (no auth): `/api/search`, `/api/blog` (GET), email tracking pixels, invitation validation.

---

## Rate Limiting

| Pattern | Limit | Window |
|---------|-------|--------|
| `/api/search`, `/api/listings` (GET) | 100 req | 1 min per IP |
| `/api/portal/listings` | 50 req | 1 min per session/IP |
| `/admin/login`, `/api/auth/*` | 10 req | 1 min per IP |
| `/api/auth/forgot-password` | 3 req | 1 hour per email |
| `/api/ai/*` | 10 req | 1 min per IP |
| Public lead capture | 20 req | 1 hour per IP |
| Brute-force login block | 5 attempts | 15 min per IP |

Redis is used when `REDIS_URL` is set; otherwise falls back to an in-memory LRU per process.

---

## Data Sources

### Internal Listings (`Property` / `Listing` models)
Manually managed by agents in the admin dashboard.

### RESO / MLS Listings (`ResoProperty` model)
Synced from the Amplify/TREB IDX API on a cron schedule (`RESO_SYNC_SECRET`). These listings are read-only. Address fields follow RESO naming: `streetNumber`, `streetName`, `streetSuffix`, `unitNumber`. There is **no** `unparsedAddress` field.

### Search (`/api/search`)
Unified endpoint that can query `source=internal`, `source=reso`, or `source=all`.

---

## Email Template Manager

Accessible at `/admin/email-templates`. Provides full CRUD for reusable HTML email templates used in bulk sends, campaigns, and automation steps.

**Features**

- **Template cards** — grid view with category badge, subject preview, and last-updated timestamp
- **Category filters** — `newsletter`, `listing`, `follow_up`, `custom`
- **Create / Edit modal** — Edit tab (name, category, subject, HTML body) and Preview tab (renders the HTML in a sandboxed iframe with sample merge-tag values)
- **HTML import** — upload a local `.html` file directly into the body field; sample templates live in `public/email-templates/`
- **Merge tag picker** — two sections:
  - *Standard tags* — contact and agent `{{placeholder}}` chips
  - *Listing tags* — MLS# input field + four field buttons (`address`, `price`, `image`, `link`) that insert `{{listing:MLSNUMBER:field}}` at the cursor
- **Delete** — inline per-card confirmation before deletion

Templates are stored in the `EmailTemplate` model (fields: `id`, `name`, `subject`, `body`, `category`, `isActive`, `createdAt`, `updatedAt`). Soft-delete is not used; deletion is permanent.

### Merge tag resolution (send time)

All merge tag substitution happens inside `lib/communications/email-service.ts → sendEmail()`, applied to both `subject` and `body`.

1. **`renderTemplate()`** — replaces `{{variable}}` tokens using a `mergeVars` map built from the contact record and agent profile `siteSettings` (with env var fallbacks for `agentName`, `agentEmail`, `agentPhone`).
2. **`resolveListingTags()`** — replaces `{{listing:MLSNUMBER:field}}` tokens. Scans for all unique MLS numbers, batches two DB queries (internal `Property` + `ResoProperty`), then substitutes `address`, `price`, `image`, or `link`. Internal listings take precedence over RESO when both share a MLS#. Unrecognised MLS numbers are left unchanged.

### Agent Profile settings

The `/admin/settings` → **Agent Profile** card stores the following keys in `siteSettings`:

| Key | Merge tag |
|-----|-----------|
| `agent_name` | `{{agentName}}` |
| `agent_email` | `{{agentEmail}}` |
| `agent_phone` | `{{agentPhone}}` |
| `agent_designation` | `{{agentDesignation}}` |
| `agent_brokerage` | `{{agentBrokerage}}` |
| `office_address` | `{{officeAddress}}` |
| `agent_bio` | `{{agentBio}}` |
| `agent_image` | `{{agentImage}}` |

Values pre-populate from `AGENT_NAME` / `AGENT_EMAIL` / `AGENT_PHONE` env vars when no DB entry exists. Agent photo can be uploaded via `/api/uploads` or entered as a URL directly.

---

## Background Jobs

The `JobQueue` model backs an in-process automation runner (enabled via `ENABLE_AUTOMATION_RUNNER=true`). Job types:

- `send_email_job` — send a queued email
- `send_sms_job` — send a queued SMS
- `execute_campaign_step` — advance a contact through a drip sequence
- `evaluate_rules` — run automation rule conditions

The runner polls every `AUTOMATION_INTERVAL_MS` ms (default 60 000).

---

## AI Integration

Three modes are supported (configured per-feature):

| Provider | Purpose |
|----------|---------|
| Anthropic Claude | General AI tasks, content generation |
| OpenAI | Alternative LLM backend |
| Ollama (local) | Listing description generation (`OLLAMA_BASE_URL`) |

AI command endpoint: `POST /api/ai/command` (API key auth).

---

## Key Environment Variables

```bash
# Database
DATABASE_URL=

# Auth
JWT_SECRET=                    # min 32 chars
JWT_EXPIRES_IN=7d
CONTACT_JWT_EXPIRES_IN=30d
FORCE_SECURE_COOKIES=true      # set in prod
INTERNAL_SECRET=               # for /api/internal/* endpoints

# Email
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
IMAP_HOST=
IMAP_PORT=
IMAP_USER=
IMAP_PASS=

# SMS
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
TWILIO_WEBHOOK_URL=

# MLS
AMPRE_IDX_TOKEN=
AMPRE_DLA_TOKEN=
AMPRE_VOX_TOKEN=
AMPRE_API_BASE_URL=            # dev only (mock RESO server)
AMPRE_OFFICE_KEY=              # brokerage filter
RESO_SYNC_SECRET=              # cron auth

# AI
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OLLAMA_BASE_URL=               # e.g. http://localhost:11434

# App
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_GOOGLE_MAPS_KEY=
AGENT_NAME=
AGENT_EMAIL=
AGENT_PHONE=

# Automation
ENABLE_AUTOMATION_RUNNER=true
AUTOMATION_INTERVAL_MS=60000
AUTOMATION_PROCESS_SECRET=
PURGE_CRON_SECRET=

# Optional
REDIS_URL=
ZEROBOUNCE_API_KEY=
```

---

## Directory Structure (key paths)

```
src/
  app/
    api/                      ← All API route handlers
    admin/
      email-templates/        ← Email template manager page
      ...                     ← Other admin dashboard pages
    portal/                   ← Contact portal pages
  lib/
    auth.ts                   ← getSession(), getContactSession()
    jwt.ts                    ← JWT sign/verify
    prisma.ts                 ← Prisma client singleton
  components/
    ui/                       ← Button, Input, Textarea
    layout/                   ← Card
    crm/
      EmailTemplateManager.tsx ← Template CRUD UI
      MergeTagPicker.tsx       ← Merge tag insertion helper
      ...
public/
  email-templates/            ← Sample .html files importable via the UI
prisma/
  schema.prisma               ← Database schema (40+ models)
middleware.ts                 ← Auth enforcement & rate limiting
```

---

## Standard API Conventions

- **Auth errors** → `401 { "error": "Unauthorized" }`
- **Validation errors** → `400` with Zod error array
- **Not found** → `404 { "error": "Not found" }`
- **Rate limit** → `429 { "error": "Too many requests" }`
- **Pagination** → `?page=1&pageSize=20`, response: `{ data: [], total, page }`
- **Dynamic route params** are a Promise in Next.js 16 — always `const { id } = await params`
