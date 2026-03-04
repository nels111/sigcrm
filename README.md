# SigCRM — Signature Cleans CRM & Operations Platform

Internal CRM and operations management platform for **Signature Cleans**, a commercial cleaning company. Built with Next.js 14 (App Router), Prisma ORM, PostgreSQL, and Tailwind CSS with shadcn/ui components.

**Repo:** `https://github.com/nels111/sigcrm.git`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14.2 (App Router, `"use client"` pages) |
| Language | TypeScript |
| Database | PostgreSQL via Prisma ORM 5.22 |
| Auth | NextAuth.js 4 (JWT strategy, credentials provider) |
| UI | Tailwind CSS 3.4 + shadcn/ui (Radix primitives) |
| Icons | lucide-react |
| PDF Generation | @react-pdf/renderer |
| Email | nodemailer + imapflow (IMAP polling) |
| Drag & Drop | @hello-pangea/dnd (pipeline kanban) |
| Forms | react-hook-form + zod validation |
| Cron | node-cron (quote follow-ups, cadence engine) |

---

## Project Structure

```
sigcrm/
├── prisma/
│   ├── schema.prisma          # Full database schema (all models, enums, relations)
│   └── seed.ts                # Database seeder
├── src/
│   ├── app/
│   │   ├── (auth)/login/      # Login page
│   │   ├── (dashboard)/       # All authenticated pages (layout with sidebar + topbar)
│   │   │   ├── dashboard/page.tsx    # MAIN DASHBOARD (role-based tabs)
│   │   │   ├── accounts/             # Account management
│   │   │   ├── audits/               # Quality audits (new + list)
│   │   │   ├── calendar/             # Calendar events
│   │   │   ├── contacts/             # Contact management
│   │   │   ├── contracts/            # Contract management + cells view
│   │   │   ├── deals/                # Deal detail pages
│   │   │   ├── documents/            # Document management
│   │   │   ├── emails/               # Email inbox/outbox
│   │   │   ├── issues/               # Issue tracking
│   │   │   ├── leads/                # Lead management
│   │   │   ├── marketing/            # Campaign management
│   │   │   ├── notifications/        # Notification center
│   │   │   ├── pipeline/             # Kanban deal pipeline
│   │   │   ├── quotes/               # Quote builder + list
│   │   │   ├── reports/              # Business reports
│   │   │   ├── subcontractors/       # Subcontractor management
│   │   │   └── tasks/                # Task management
│   │   ├── api/                      # API routes (all REST, Next.js route handlers)
│   │   │   ├── dashboard/route.ts    # Dashboard aggregation endpoint
│   │   │   ├── accounts/             # CRUD
│   │   │   ├── activities/           # Activity logging
│   │   │   ├── audits/               # Audit CRUD
│   │   │   ├── auth/[...nextauth]/   # NextAuth handler
│   │   │   ├── cadence/stats/        # Cadence statistics
│   │   │   ├── calendar/             # Calendar CRUD + upcoming + ICS + invites
│   │   │   ├── campaigns/            # Campaign CRUD + send
│   │   │   ├── contacts/             # CRUD
│   │   │   ├── contracts/            # CRUD + cells
│   │   │   ├── cron/                 # Cron endpoints (cadence, quote follow-up)
│   │   │   ├── deals/                # CRUD + stage change + pipeline + forecast
│   │   │   ├── documents/            # CRUD + generate + download
│   │   │   ├── email-templates/      # Email template CRUD
│   │   │   ├── emails/               # Email CRUD
│   │   │   ├── feedback/             # Client feedback (token-based)
│   │   │   ├── fireflies/            # Fireflies.ai transcript integration
│   │   │   ├── issues/               # Issue CRUD
│   │   │   ├── leads/                # CRUD + convert + bulk + capture
│   │   │   ├── notifications/        # Notification CRUD + unread count
│   │   │   ├── quotes/               # CRUD + PDF generation
│   │   │   ├── reports/              # Multiple report endpoints
│   │   │   ├── subcontractors/       # CRUD
│   │   │   ├── tasks/                # CRUD
│   │   │   ├── users/                # User listing
│   │   │   └── webhooks/calendly/    # Calendly webhook
│   │   ├── feedback/[token]/         # Public feedback form
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Root redirect
│   ├── components/
│   │   ├── ui/                       # shadcn/ui primitives (button, card, dialog, etc.)
│   │   ├── shared/                   # Shared components (activity timeline, create task dialog, voice capture)
│   │   ├── sidebar.tsx               # Main navigation sidebar
│   │   ├── top-bar.tsx               # Top bar with search + notifications
│   │   ├── providers.tsx             # NextAuth SessionProvider wrapper
│   │   ├── quick-capture.tsx         # FAB for quick lead/note capture
│   │   └── [module]/                 # Module-specific client components
│   ├── hooks/
│   │   └── use-toast.ts              # Toast notification hook
│   ├── lib/
│   │   ├── prisma.ts                 # Prisma client singleton
│   │   ├── auth.ts                   # NextAuth config (JWT + credentials)
│   │   ├── auth-utils.ts             # Auth helper utilities
│   │   ├── utils.ts                  # cn() utility (clsx + tailwind-merge)
│   │   ├── cadence-engine.ts         # Automated email cadence logic
│   │   ├── cron-jobs.ts              # Scheduled cron tasks
│   │   ├── email.ts                  # Email sending (nodemailer)
│   │   ├── health-score.ts           # Contract health scoring algorithm
│   │   ├── imap-poller.ts            # IMAP inbox polling
│   │   ├── mobilisation.ts           # Contract mobilisation workflow
│   │   ├── notification-email.ts     # Notification email sending
│   │   ├── quote-calculator.ts       # Quote pricing calculations
│   │   ├── quote-follow-up.ts        # Quote follow-up automation
│   │   ├── quote-pdf.tsx             # PDF quote generation (react-pdf)
│   │   ├── scope-of-works.ts         # Scope of works generation
│   │   ├── weekly-scorecard.ts       # Weekly scorecard generation
│   │   └── document-templates/       # PDF document templates
│   └── types/
│       ├── next-auth.d.ts            # NextAuth type augmentation
│       └── speech-recognition.d.ts   # Web Speech API types
├── public/                           # Static assets (logo, etc.)
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── next.config.mjs
├── vercel.json
└── render.yaml                       # Render.com deployment config
```

---

## Database Schema (Prisma)

**Schema file:** `prisma/schema.prisma`

### Models

| Model | Table | Description |
|-------|-------|-------------|
| `User` | `users` | System users. Roles: `admin`, `sales`, `operations` |
| `Account` | `accounts` | Client companies (soft-delete via `deletedAt`) |
| `Contact` | `contacts` | People at accounts |
| `Lead` | `leads` | Prospects before conversion. Has cadence tracking fields |
| `Deal` | `deals` | Sales opportunities with pipeline stages |
| `Quote` | `quotes` | Pricing quotes with full cost breakdown |
| `Contract` | `contracts` | Active cleaning contracts with financials, health, staffing, audit tracking |
| `Subcontractor` | `subcontractors` | Cleaning subcontractors with compliance fields |
| `CalendarEvent` | `calendar_events` | Meetings, site visits, audits, calls |
| `Task` | `tasks` | Assignable tasks linked to any entity |
| `Activity` | `activities` | Activity log (calls, emails, visits, stage changes) |
| `Email` | `emails` | Email records (inbound/outbound) with threading |
| `EmailTemplate` | `email_templates` | Reusable email templates for cadences/campaigns |
| `Campaign` | `campaigns` | Marketing email campaigns |
| `Audit` | `audits` | Quality audit records with scoring |
| `Issue` | `issues` | Operational issues with SLA tracking |
| `Document` | `documents` | Generated documents (PDFs, site packs) |
| `Notification` | `notifications` | User notifications |
| `ClientFeedback` | `client_feedbacks` | Token-based client feedback forms |

### Key Enums

- **UserRole**: `admin`, `sales`, `operations`
- **DealStage**: `NewLead` -> `Contacted` -> `SiteSurveyBooked` -> `SurveyComplete` -> `QuoteSent` -> `Negotiation` -> `ClosedWon*` / `ClosedLost*`
- **ContractStatus**: `mobilising`, `active`, `on_hold`, `notice_given`, `terminated`, `archived`
- **HealthStatus**: `GREEN`, `AMBER`, `RED`
- **StaffingStatus**: `Stable`, `Risk`, `Critical`
- **IssueStatus**: `open`, `in_progress`, `resolved`, `closed`
- **IssueSeverity**: `critical`, `high`, `medium`, `low`
- **CadenceStatus**: `NotStarted`, `ActiveInCadence`, `PausedMeeting`, `PausedReplied`, etc.

### Key Relationships

- `Account` has many: `Contact`, `Deal`, `Contract`, `Activity`, `Email`, `Task`, `Issue`
- `Contract` has many: `Audit`, `Issue`, `Task`, `Activity`, `CalendarEvent`, `Document`, `ClientFeedback`
- `Contract` belongs to: `Deal`, `Account`, `Quote`, `Subcontractor`
- `Contract` has health fields: `healthStatus` (GREEN/AMBER/RED), `staffingStatus` (Stable/Risk/Critical), `latestAuditScore`, `nextAuditDate`, `daysSinceLastContact`, `complaintCount`
- `Issue` has SLA fields: `slaResponseTarget`, `slaResolutionTarget`, `slaBreached`, `reportedAt`, `firstResponseAt`, `resolvedAt`
- `Subcontractor` has compliance fields: `insuranceExpiry`, `dbsExpiry`, `dbsChecked`, `subcontractorAgreementSigned`
- `Email` has: `direction` (inbound/outbound), `fromAddress`, `toAddress`, `subject`, `receivedAt`, `sentAt`

---

## Authentication & Roles

**Auth:** NextAuth.js with JWT strategy and credentials provider.

**Config:** `src/lib/auth.ts`

**Roles:**
- `admin` — Nelson (operations focus). Default dashboard tab: "Nels's View"
- `sales` — Nick (sales focus). Default dashboard tab: "Nick's View"
- `operations` — operations staff. Default tab: "Unified"

**Session shape:**
```typescript
session.user = {
  id: string;      // UUID
  email: string;
  name: string;
  role: string;    // "admin" | "sales" | "operations"
}
```

**Dashboard tab logic** (in `dashboard/page.tsx`):
```typescript
const defaultTab = userRole === "sales" ? "nicks" : userRole === "admin" ? "nels" : "unified";
```

---

## Dashboard Architecture

**API endpoint:** `GET /api/dashboard` (`src/app/api/dashboard/route.ts`)

**Page:** `src/app/(dashboard)/dashboard/page.tsx`

### Current API Response Shape

```typescript
{
  data: {
    pipeline: {
      value: number;              // Total active pipeline value
      weightedForecast: number;   // Probability-weighted forecast
      dealsClosingThisMonth: number;
      activeDealCount: number;
    };
    operations: {
      activeContracts: number;
      weeklyHours: number;        // Sum of all active contract hours
      monthlyRevenue: number;     // Sum of all active contract revenue
      overdueAudits: number;      // Contracts past nextAuditDate
      belowTargetMargin: number;  // Contracts with grossMarginPercent < 35%
    };
    leads: {
      inCadence: number;          // Leads with cadenceStatus = "ActiveInCadence"
      quotesAwaiting: number;     // Quotes with status = "sent"
    };
    tasks: {
      today: TaskItem[];          // Up to 8 tasks due today
      overdueCount: number;       // Tasks past due date
    };
    recentActivity: ActivityItem[];    // Last 8 activities
    upcomingMeetings: MeetingItem[];   // Next 5 scheduled events
    staleDeals: StaleDealItem[];       // Deals with no activity 14+ days (limit 5)
    winLoss: {
      won: number;
      lost: number;
      winRate: number;            // Percentage
    };
  }
}
```

### Current Dashboard Tabs

**Nick's View** (sales tab value: `"nicks"`):
1. Tasks + Meetings (top, side by side)
2. 4 sales KPI cards (Pipeline Value, Deals Closing, Quotes Awaiting, Active Cadence)
3. 4 financial KPI cards (Monthly Revenue, Win Rate, Weekly Hours, Below Target Margin)
4. Activity + Stale Deals (bottom)

**Nelson's View** (ops tab value: `"nels"`):
1. 4 ops KPI cards (Weekly Hours, Active Contracts, Monthly Revenue, Overdue Audits)
2. Tasks + Activity (middle)
3. Meetings + Stale Deals (bottom)

**Unified View** (tab value: `"unified"`):
1. 4 KPI cards (Weekly Hours, Monthly Revenue, Pipeline Value, Active Cadence)
2. Tasks + Activity
3. Meetings + Stale Deals

### Dashboard Components (all inline in page.tsx)

- `KpiCard` — Reusable KPI card with icon, value, subtitle, optional trend/progress bar. Uses `accentStyles` map (emerald, amber, blue, red).
- `TasksSection` — Shows today's tasks with priority badges + linked entity links
- `ActivitySection` — Recent activity feed with type-specific icons
- `MeetingsSection` — Upcoming meetings with date/time and contact info
- `StaleDealsSection` — Deals with no activity 14+ days, links to deal detail
- `DashboardSkeleton` — Loading skeleton placeholder

### Helper Functions (in page.tsx)

- `formatCurrency(value)` — GBP formatting (no decimals)
- `timeAgo(dateStr)` — Relative time (e.g., "5m ago", "2h ago")
- `formatTime(dateStr)` — HH:MM format
- `formatDate(dateStr)` — "Mon 4 Mar" format
- `getLinkedEntity(item)` — Returns `{label, href}` for the first linked entity (deal > account > lead > contract)
- `ACTIVITY_ICONS` — Maps activity types to lucide icons
- `PRIORITY_COLORS` — Maps priority levels to Tailwind classes

---

## Pending Feature: Enhanced Nelson's Dashboard

### What Needs to Be Done

Nelson's dashboard ("Nels's View") needs to be enhanced to match Nick's feature parity with ops-specific content. Two files need modification:

### 1. API Changes (`src/app/api/dashboard/route.ts`)

Add these new Prisma queries to the existing `Promise.all` block:

| Query | Prisma Call | Purpose |
|-------|------------|---------|
| Open issues | `prisma.issue.count({ where: { status: { in: ["open", "in_progress"] } } })` | KPI card |
| SLA breaches | `prisma.issue.count({ where: { slaBreached: true, status: { notIn: ["closed"] } } })` | KPI card |
| Contracts at risk | `prisma.contract.count({ where: { healthStatus: "RED", status: "active" } })` | KPI card |
| Avg audit score | `prisma.audit.aggregate({ _avg: { overallScore: true }, where: { auditDate: { gte: threeMonthsAgo } } })` | KPI card |
| Compliance alerts | Count subcontractors where `insuranceExpiry < 30 days` OR `dbsExpiry < 30 days` OR `!subcontractorAgreementSigned` | KPI card |
| Staffing risks | `prisma.contract.count({ where: { staffingStatus: { in: ["Risk", "Critical"] }, status: "active" } })` | KPI card |
| Recent emails | `prisma.email.findMany({ orderBy: { receivedAt: "desc" }, take: 5, select: { id, direction, fromAddress, toAddress, subject, receivedAt, sentAt } })` | Email widget |
| Contracts needing attention | Contracts where `healthStatus: "RED"` OR `nextAuditDate < now` OR `staffingStatus in ["Risk","Critical"]` with account info | At-risk widget |

Add new response fields to the JSON return:
```typescript
ops: {
  openIssues: number;
  slaBreaches: number;
  contractsAtRisk: number;
  avgAuditScore: number;
  complianceAlerts: number;
  staffingRisks: number;
},
recentEmails: EmailItem[],
contractsNeedingAttention: ContractAlertItem[]
```

### 2. Frontend Changes (`src/app/(dashboard)/dashboard/page.tsx`)

**Extend the `DashboardData` interface** with:
```typescript
ops: {
  openIssues: number;
  slaBreaches: number;
  contractsAtRisk: number;
  avgAuditScore: number;
  complianceAlerts: number;
  staffingRisks: number;
};
recentEmails: Array<{
  id: string;
  direction: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  receivedAt: string | null;
  sentAt: string | null;
}>;
contractsNeedingAttention: Array<{
  id: string;
  contractName: string;
  healthStatus: string;
  account: { id: string; name: string } | null;
  reason: string;
}>;
```

**Add 3 new inline components** (following existing pattern — all components live in page.tsx):

1. **`RecentEmailsSection`** — Shows last 5 emails with sender/recipient, subject (truncated), time ago. Mail icon per row. "View all" links to `/emails`.

2. **`ContractsAtRiskSection`** — Shows contracts with RED health or overdue audits. Each row: contract name, account name, health badge (RED/AMBER), reason text. Links to `/contracts/[id]`.

3. **`OpsQuickActions`** — Quick link cards to key ops pages (Issues, Audits, Subcontractors, Contracts) with count badges showing open issues, overdue audits, compliance alerts.

**Restructure the `<TabsContent value="nels">` layout:**

```
Row 1: Tasks + Meetings at TOP (matching Nick's layout)
Row 2: 8 KPI cards in 2 rows of 4:
  - Weekly Hours, Active Contracts, Monthly Revenue, Overdue Audits
  - Open Issues, SLA Breaches, Contracts at Risk, Compliance Alerts
Row 3: Recent Emails + Contracts at Risk
Row 4: Activity + Quick Actions
```

**Do NOT modify** Nick's View (`<TabsContent value="nicks">`) or Unified View (`<TabsContent value="unified">`).

### Lucide Icons for New KPIs

Use these existing imports or add new ones:
- Open Issues: `AlertTriangle` (already imported)
- SLA Breaches: `ShieldCheck` (already imported) or `AlertTriangle`
- Contracts at Risk: `Briefcase` (already imported) with red accent
- Compliance Alerts: `ClipboardCheck` (already imported)
- Staffing Risks: `Users` (already imported)

---

## API Routes Reference

All routes are in `src/app/api/`. Every route uses Next.js Route Handlers (`export async function GET/POST/PUT/PATCH/DELETE`).

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/dashboard` | GET | Aggregated dashboard data |
| `/api/accounts` | GET, POST | Account CRUD |
| `/api/accounts/[id]` | GET, PUT, DELETE | Single account |
| `/api/activities` | GET, POST | Activity log |
| `/api/audits` | GET, POST | Audit CRUD |
| `/api/audits/[id]` | GET, PUT | Single audit |
| `/api/calendar` | GET, POST | Calendar events |
| `/api/calendar/upcoming` | GET | Next upcoming events |
| `/api/campaigns` | GET, POST | Campaign CRUD |
| `/api/contacts` | GET, POST | Contact CRUD |
| `/api/contracts` | GET, POST | Contract CRUD |
| `/api/contracts/cells` | GET | Contract cell view |
| `/api/deals` | GET, POST | Deal CRUD |
| `/api/deals/pipeline` | GET | Pipeline data |
| `/api/deals/forecast` | GET | Revenue forecast |
| `/api/deals/[id]/stage` | PATCH | Stage change |
| `/api/documents` | GET, POST | Document CRUD |
| `/api/documents/generate` | POST | Generate document |
| `/api/emails` | GET, POST | Email CRUD |
| `/api/email-templates` | GET, POST | Template CRUD |
| `/api/issues` | GET, POST | Issue CRUD |
| `/api/leads` | GET, POST | Lead CRUD |
| `/api/leads/[id]/convert` | POST | Convert lead to deal |
| `/api/leads/bulk` | POST | Bulk lead import |
| `/api/leads/capture` | POST | Quick capture |
| `/api/notifications` | GET | User notifications |
| `/api/quotes` | GET, POST | Quote CRUD |
| `/api/quotes/[id]/pdf` | GET | Generate quote PDF |
| `/api/reports/*` | GET | Various report endpoints |
| `/api/subcontractors` | GET, POST | Subcontractor CRUD |
| `/api/tasks` | GET, POST | Task CRUD |

---

## UI Component Library

Uses **shadcn/ui** components in `src/components/ui/`. These are copy-pasted Radix UI primitives styled with Tailwind:

`avatar`, `badge`, `button`, `calendar`, `card`, `checkbox`, `command`, `dialog`, `dropdown-menu`, `form`, `input`, `label`, `popover`, `scroll-area`, `select`, `separator`, `sheet`, `switch`, `table`, `tabs`, `textarea`, `toast`, `toaster`, `tooltip`

**Import pattern:**
```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
```

---

## Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed

# Start dev server
npm run dev

# Open Prisma Studio
npm run db:studio

# Build for production
npm run build
```

**Environment variables** needed in `.env`:
```
DATABASE_URL=postgresql://user:password@host:5432/sigcrm
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
```

---

## Key Patterns & Conventions

1. **All dashboard components are inline** in `page.tsx` — no separate component files for dashboard widgets.
2. **Client components** use `"use client"` directive at top of file.
3. **Data fetching** in dashboard uses `useEffect` + `fetch()` to client-side load from API routes.
4. **Prisma singleton** at `src/lib/prisma.ts` — always import from `@/lib/prisma`.
5. **Soft deletes** — Most models have `deletedAt` field; queries filter with `deletedAt: null`.
6. **UUID primary keys** — All models use `@default(uuid()) @db.Uuid`.
7. **Column mapping** — Prisma fields are camelCase, DB columns are snake_case via `@map()`.
8. **API responses** wrapped in `{ data: ... }` or `{ error: ... }`.
9. **No separate state management** — React useState + useEffect, no Redux/Zustand.
10. **Tailwind + cn()** — All styling via Tailwind classes composed with `cn()` from `@/lib/utils`.
