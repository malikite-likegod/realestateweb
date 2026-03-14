# Real Estate Platform Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready luxury real estate platform combining a marketing website, CRM, IDX integration, AI automation, and advanced property search.

**Architecture:** Next.js App Router monorepo with route groups separating public and admin surfaces; Prisma ORM with dual SQLite/MySQL support; JWT auth; modular services layer for IDX, search, and AI.

**Tech Stack:** Next.js 15, TypeScript, TailwindCSS, Prisma, Framer Motion, Lucide, bcrypt, jose (JWT)

---

## Chunk 1: Foundation

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `postcss.config.js`

- [ ] Initialize project with all dependencies defined in package.json
- [ ] Create next.config.ts with image domains and experimental settings
- [ ] Create tailwind.config.ts with custom theme (charcoal, gold, serif fonts)
- [ ] Create .env.example with all required variables
- [ ] Commit: `git init && git add . && git commit -m "chore: scaffold project"`

### Task 2: Prisma schema

**Files:**
- Create: `prisma/schema.prisma`

- [ ] Write full schema with all 30+ models
- [ ] Commit: `git add prisma && git commit -m "feat: prisma schema"`

### Task 3: Types

**Files:**
- Create: `types/index.ts`
- Create: `types/crm.ts`
- Create: `types/real-estate.ts`
- Create: `types/ai.ts`

- [ ] Write all shared TypeScript types
- [ ] Commit

### Task 4: Lib utilities

**Files:**
- Create: `lib/prisma.ts`
- Create: `lib/auth.ts`
- Create: `lib/jwt.ts`
- Create: `lib/utils.ts`
- Create: `lib/constants.ts`

- [ ] Prisma singleton client with env-based provider
- [ ] Auth helpers (hash, verify)
- [ ] JWT sign/verify with jose
- [ ] cn() utility, shared constants
- [ ] Commit

---

## Chunk 2: Setup Wizard + Auth

### Task 5: Setup wizard script

**Files:**
- Create: `scripts/setup.ts`

- [ ] CLI prompts: DB mode, MySQL creds if prod, admin account
- [ ] Write .env file
- [ ] Run prisma migrate
- [ ] Insert hashed admin user
- [ ] Commit

### Task 6: Auth API routes

**Files:**
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `app/api/auth/me/route.ts`
- Create: `middleware.ts`

- [ ] POST /api/auth/login → verify creds, return JWT cookie
- [ ] POST /api/auth/logout → clear cookie
- [ ] GET /api/auth/me → return current user
- [ ] middleware.ts: protect /admin/* routes
- [ ] Commit

---

## Chunk 3: UI Component Library

### Task 7: Core UI components

**Files:**
- Create: `components/ui/Button.tsx`
- Create: `components/ui/Input.tsx`
- Create: `components/ui/Select.tsx`
- Create: `components/ui/Textarea.tsx`
- Create: `components/ui/Checkbox.tsx`
- Create: `components/ui/Badge.tsx`
- Create: `components/ui/Avatar.tsx`
- Create: `components/ui/Spinner.tsx`
- Create: `components/ui/Divider.tsx`
- Create: `components/ui/Modal.tsx`
- Create: `components/ui/Toast.tsx`
- Create: `components/ui/Tabs.tsx`
- Create: `components/ui/Accordion.tsx`
- Create: `components/ui/Tooltip.tsx`
- Create: `components/ui/Dropdown.tsx`
- Create: `components/ui/Switch.tsx`
- Create: `components/ui/Radio.tsx`
- Create: `components/ui/Breadcrumb.tsx`
- Create: `components/ui/index.ts`

- [ ] Build each component with Tailwind + Lucide + Framer Motion where appropriate
- [ ] Export all from index.ts
- [ ] Commit

---

## Chunk 4: Layout + Navigation Components

### Task 8: Layout components

**Files:**
- Create: `components/layout/Container.tsx`
- Create: `components/layout/Grid.tsx`
- Create: `components/layout/Section.tsx`
- Create: `components/layout/HeroSection.tsx`
- Create: `components/layout/FeatureGrid.tsx`
- Create: `components/layout/SplitSection.tsx`
- Create: `components/layout/ContentBlock.tsx`
- Create: `components/layout/Card.tsx`
- Create: `components/layout/PageHeader.tsx`
- Create: `components/layout/index.ts`

### Task 9: Navigation components

**Files:**
- Create: `components/navigation/Navbar.tsx`
- Create: `components/navigation/Sidebar.tsx`
- Create: `components/navigation/MobileMenu.tsx`
- Create: `components/navigation/Footer.tsx`
- Create: `components/navigation/MegaMenu.tsx`
- Create: `components/navigation/SearchBar.tsx`
- Create: `components/navigation/UserMenu.tsx`
- Create: `components/navigation/index.ts`

- [ ] Navbar: transparent → solid on scroll, Framer Motion
- [ ] Sidebar: collapsible, used in CRM admin layout
- [ ] Footer: links, newsletter, socials
- [ ] Commit

---

## Chunk 5: Form + Real Estate Components

### Task 10: Form components

**Files:**
- Create: `components/forms/LeadCaptureForm.tsx`
- Create: `components/forms/ContactForm.tsx`
- Create: `components/forms/PropertyInquiryForm.tsx`
- Create: `components/forms/HomeValuationForm.tsx`
- Create: `components/forms/NewsletterSignupForm.tsx`
- Create: `components/forms/index.ts`

### Task 11: Real estate components

**Files:**
- Create: `components/real-estate/PropertyCard.tsx`
- Create: `components/real-estate/PropertyGrid.tsx`
- Create: `components/real-estate/PropertyGallery.tsx`
- Create: `components/real-estate/ListingCard.tsx`
- Create: `components/real-estate/ListingMap.tsx`
- Create: `components/real-estate/NeighborhoodCard.tsx`
- Create: `components/real-estate/CommunityGrid.tsx`
- Create: `components/real-estate/AgentProfileCard.tsx`
- Create: `components/real-estate/TestimonialCarousel.tsx`
- Create: `components/real-estate/index.ts`

- [ ] PropertyCard: image, price, beds/baths, address, Framer hover
- [ ] PropertyGallery: lightbox-style image viewer
- [ ] ListingMap: placeholder for Mapbox/Google Maps integration
- [ ] TestimonialCarousel: auto-scroll with Framer Motion
- [ ] Commit

---

## Chunk 6: CRM + Analytics Components

### Task 12: CRM components

**Files:**
- Create: `components/crm/ContactTable.tsx`
- Create: `components/crm/ContactCard.tsx`
- Create: `components/crm/DealPipeline.tsx`
- Create: `components/crm/DealStageColumn.tsx`
- Create: `components/crm/ActivityTimeline.tsx`
- Create: `components/crm/ActivityItem.tsx`
- Create: `components/crm/TaskList.tsx`
- Create: `components/crm/TaskCard.tsx`
- Create: `components/crm/NotesPanel.tsx`
- Create: `components/crm/index.ts`

- [ ] DealPipeline: drag-and-drop columns using @dnd-kit
- [ ] ActivityTimeline: vertical timeline with icons per activity type
- [ ] Commit

### Task 13: Analytics + Dashboard components

**Files:**
- Create: `components/analytics/StatsCard.tsx`
- Create: `components/analytics/AnalyticsChart.tsx`
- Create: `components/analytics/TrafficChart.tsx`
- Create: `components/analytics/LeadSourceChart.tsx`
- Create: `components/analytics/ConversionChart.tsx`
- Create: `components/analytics/ActivityFeed.tsx`
- Create: `components/analytics/index.ts`
- Create: `components/dashboard/DashboardLayout.tsx`
- Create: `components/dashboard/SidebarNavigation.tsx`
- Create: `components/dashboard/Topbar.tsx`
- Create: `components/dashboard/RecentLeadsWidget.tsx`
- Create: `components/dashboard/RecentActivitiesWidget.tsx`
- Create: `components/dashboard/TasksWidget.tsx`
- Create: `components/dashboard/index.ts`

- [ ] Charts use recharts
- [ ] DashboardLayout wraps all admin pages
- [ ] Commit

---

## Chunk 7: Services

### Task 14: IDX service

**Files:**
- Create: `services/idx/client.ts`
- Create: `services/idx/sync.ts`
- Create: `services/idx/parser.ts`
- Create: `services/idx/types.ts`

- [ ] client.ts: HTTP client for TREB IDX feed
- [ ] parser.ts: normalize IDX response → idx_properties shape
- [ ] sync.ts: upsert active, mark inactive as removed
- [ ] Commit

### Task 15: Search engine

**Files:**
- Create: `services/search/engine.ts`
- Create: `services/search/indexer.ts`
- Create: `services/search/filters.ts`
- Create: `services/search/types.ts`

- [ ] engine.ts: Prisma query builder from filter params
- [ ] filters.ts: price, beds, baths, type, keyword, radius
- [ ] Log queries to property_search_logs
- [ ] Commit

### Task 16: AI services

**Files:**
- Create: `services/ai/client.ts`
- Create: `services/ai/jobs.ts`
- Create: `services/ai/commands.ts`
- Create: `services/ai/webhooks.ts`
- Create: `services/ai/lead-scoring.ts`
- Create: `services/ai/types.ts`

- [ ] client.ts: OpenAI/Claude API wrapper
- [ ] commands.ts: command bus (create_task, log_activity, etc.)
- [ ] jobs.ts: enqueue/process ai_jobs
- [ ] webhooks.ts: send events to registered webhooks
- [ ] lead-scoring.ts: score from behavior_events
- [ ] Commit

---

## Chunk 8: API Routes

### Task 17: CRM API routes

**Files:**
- Create: `app/api/contacts/route.ts`
- Create: `app/api/contacts/[id]/route.ts`
- Create: `app/api/deals/route.ts`
- Create: `app/api/deals/[id]/route.ts`
- Create: `app/api/tasks/route.ts`
- Create: `app/api/tasks/[id]/route.ts`
- Create: `app/api/activities/route.ts`
- Create: `app/api/activities/[id]/route.ts`
- Create: `app/api/notes/route.ts`
- Create: `app/api/stages/route.ts`

### Task 18: Listings + Blog API routes

**Files:**
- Create: `app/api/listings/route.ts`
- Create: `app/api/listings/[id]/route.ts`
- Create: `app/api/blog/route.ts`
- Create: `app/api/blog/[slug]/route.ts`
- Create: `app/api/search/route.ts`

### Task 19: AI API routes

**Files:**
- Create: `app/api/ai/command/route.ts`
- Create: `app/api/ai/jobs/route.ts`
- Create: `app/api/ai/jobs/[id]/route.ts`
- Create: `app/api/ai/webhooks/route.ts`
- Create: `app/api/ai/analyze/route.ts`

### Task 20: IDX + misc API routes

**Files:**
- Create: `app/api/idx/sync/route.ts`
- Create: `app/api/lead-score/route.ts`
- Create: `app/api/behavior/route.ts`
- Create: `app/api/api-keys/route.ts`

- [ ] All routes: validate JWT or API key, Prisma CRUD
- [ ] AI command route: validate, log to ai_command_logs, dispatch
- [ ] Commit all API routes

---

## Chunk 9: Public Marketing Pages

### Task 21: App shell + root layout

**Files:**
- Create: `app/layout.tsx`
- Create: `app/(public)/layout.tsx`
- Create: `app/(public)/page.tsx` (Home)
- Create: `app/globals.css`

### Task 22: Public pages

**Files:**
- Create: `app/(public)/buying/page.tsx`
- Create: `app/(public)/selling/page.tsx`
- Create: `app/(public)/listings/page.tsx`
- Create: `app/(public)/listings/[id]/page.tsx`
- Create: `app/(public)/communities/page.tsx`
- Create: `app/(public)/communities/[slug]/page.tsx`
- Create: `app/(public)/blog/page.tsx`
- Create: `app/(public)/blog/[slug]/page.tsx`
- Create: `app/(public)/relocation/page.tsx`
- Create: `app/(public)/contact/page.tsx`

- [ ] Home: Hero, FeaturedListings, AgentIntro, NeighborhoodHighlights, BlogPreview, LeadCapture
- [ ] Listings: search bar + PropertyGrid + map toggle
- [ ] Blog: static generation with generateStaticParams
- [ ] Commit

---

## Chunk 10: CRM Dashboard Pages

### Task 23: Admin layout + login

**Files:**
- Create: `app/(admin)/layout.tsx`
- Create: `app/(admin)/login/page.tsx`
- Create: `app/(admin)/dashboard/page.tsx`

### Task 24: CRM pages

**Files:**
- Create: `app/(admin)/contacts/page.tsx`
- Create: `app/(admin)/contacts/[id]/page.tsx`
- Create: `app/(admin)/deals/page.tsx`
- Create: `app/(admin)/tasks/page.tsx`
- Create: `app/(admin)/activities/page.tsx`
- Create: `app/(admin)/listings/page.tsx`
- Create: `app/(admin)/listings/new/page.tsx`
- Create: `app/(admin)/listings/[id]/page.tsx`
- Create: `app/(admin)/blog/page.tsx`
- Create: `app/(admin)/blog/new/page.tsx`
- Create: `app/(admin)/blog/[id]/page.tsx`
- Create: `app/(admin)/analytics/page.tsx`
- Create: `app/(admin)/automation/page.tsx`
- Create: `app/(admin)/settings/page.tsx`

- [ ] Deals: DealPipeline drag-and-drop
- [ ] Analytics: recharts line/bar/pie charts
- [ ] Automation: sequence builder UI
- [ ] Commit all admin pages

---

## Run Instructions

```bash
npm install
npm run setup    # runs scripts/setup.ts via ts-node
npm run dev
```
