# TKO - Tournament Knockout Organiser

## Overview

TKO is a full-stack web application for creating and managing darts tournaments. It supports multiple tournament formats (Round Robin, Knockout, Double Elimination, Multi-Stage), per-stage match formats (Best of 3/5/7/9/11 legs), and includes features like public spectator mode via shareable links, CSV/XLSX export, user account management, and Legacy Tournament mode for entering past results. The app is designed to be iPad-friendly with a clean, touch-responsive admin UI. Brand assets: icon logo (`attached_assets/Untitled-1-02_1771177331378.png`) and full TKO wordmark (`attached_assets/Untitled-1-03_1771177331378.png`). White variants for dark backgrounds: icon (`attached_assets/TKO_White-02_1771177730966.png`) and wordmark (`attached_assets/TKO_White-03_1771177730967.png`).

Public league sharing: Leagues have auto-generated `shareToken` fields. Public league page at `/public/league/:shareToken` shows standings with promotion/relegation zones, clickable players opening match history dialogs with per-match stats (3-dart avg, checkout %, 180s, tons, highest finish/visit). Supports `?embed=true` query param for embeddable iframes. Admin league detail page has "Share Public Page" button with public link, embed code snippet, and QR code.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Monorepo Structure
The project is a single-workspace monorepo with three main directories:
- `client/` — React frontend (Vite-based SPA)
- `server/` — Express backend (Node.js + TypeScript)
- `shared/` — Shared types, schemas, and API contract definitions used by both client and server

### Frontend Architecture
- **Framework**: React + TypeScript + Vite
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: TanStack React Query for server state, local React state for UI
- **UI Components**: shadcn/ui component library (new-york style) built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming, custom fonts (Outfit for display, Plus Jakarta Sans for body)
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`
- **Key Pages**: Dashboard (tournament list), Create Tournament, Tournament Detail, Account Settings, Auth (login/signup), Public Spectator View, Board View (spectator per-board), Scorer Tablet (paired scorer device), Leagues (league standings across tournaments)
- **Protected Routes**: Implemented via a `ProtectedRoute` wrapper that checks auth state and redirects to login

### Backend Architecture
- **Framework**: Express 5 on Node.js with TypeScript
- **Entry Point**: `server/index.ts` creates HTTP server, registers routes, sets up middleware
- **Dev Server**: Vite dev server middleware is injected for HMR during development (`server/vite.ts`)
- **Production**: Client is built to `dist/public/`, server is bundled with esbuild to `dist/index.cjs`
- **Build Script**: `script/build.ts` handles both Vite client build and esbuild server bundling

### Authentication & Sessions
- **Strategy**: Passport.js with Local Strategy (email/password)
- **Password Hashing**: Node.js native `crypto.scrypt` with random salt (not bcrypt/argon2)
- **Sessions**: `express-session` with `connect-pg-simple` (PostgreSQL-backed persistent sessions in `user_sessions` table)
- **Cookie Config**: httpOnly cookies, 1-week expiry, secure in production
- **Auth Routes**: POST `/api/auth/signup`, POST `/api/auth/login`, POST `/api/auth/logout`, GET `/api/auth/me`
- **Signup**: Requires full name, email, password + password confirmation. Returns a one-time randomized recovery key (hashed in DB, shown once to user)
- **Password Reset**: Supports two verification methods — memorable word or recovery key. Both are hashed and compared server-side. Rate-limited to 5 attempts per 15 minutes.
- **Profile Completion**: After signup, users are redirected to a mandatory profile completion page requiring date of birth and memorable word. Phone and billing address are optional. Enforced via `ProtectedRoute` in `App.tsx`.
- **Recovery Key**: Generated as 24-char hex split into 6 groups of 4, e.g. `ABCD-EF01-2345-6789-ABCD-EF01`. Stored as hashed (stripped hyphens, lowercased). Users can use it on the password reset page.

### API Design
- **Contract-First**: API contracts defined in `shared/routes.ts` using Zod schemas — both client and server reference the same contract for type safety and validation
- **RESTful Endpoints**: Standard CRUD for tournaments, players, matches, groups, match notes
- **Ownership Enforcement**: Users can only access their own tournaments; public spectator links are read-only

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in `shared/schema.ts` using Drizzle's `pgTable` definitions with Zod schema generation via `drizzle-zod`
- **Migration**: Uses `drizzle-kit push` command (`npm run db:push`) to sync schema to database
- **Connection**: PostgreSQL via `DATABASE_URL` environment variable, using `pg` Pool
- **Tables**: `users`, `tournaments`, `players`, `groups`, `group_memberships`, `matches` (includes `scorerId` for auto-assigned scorers), `match_notes`, `board_sessions`, `leagues`
- **Key Relationships**: Users own tournaments (cascade delete), tournaments contain players/groups/matches, groups have memberships linking to players, leagues own tournaments (1-to-many, set null on delete)

### Data Model Highlights
- Tournaments store structural settings as JSONB (group count, match format, points system)
- Tournaments have optional share functionality with `shareEnabled` flag and `shareToken` for public spectator access
- Tournament types: `ROUND_ROBIN`, `KNOCKOUT`, `DOUBLE_ELIMINATION`, `MULTI_STAGE`
- Tournament statuses: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`
- Matches track scores for both players, status, round/group info
- Board sessions store pairing tokens and access tokens for scorer tablet pairing

### Real-Time (WebSocket)
- **Socket.IO** server attached to httpServer in `server/socket.ts`
- Room-based architecture: `tournament:{id}`, `board:{tournamentId}:{boardNumber}`, `public:{shareToken}`
- Events: `match:updated`, `tournament:updated`, `board:status` (online/offline)
- Board pairing flow: admin creates session → QR code with pairing token → tablet scans → server validates token, sets httpOnly cookie → redirects to scorer page
- Scorer tablets authenticate via `boardAccessToken` cookie, validated by `isBoardAuthenticated` middleware

### Storage Layer
- `server/storage.ts` defines an `IStorage` interface abstracting all data operations
- Current implementation uses Drizzle ORM queries against PostgreSQL
- Session store uses `connect-pg-simple` for PostgreSQL-backed persistent sessions

## External Dependencies

### Database
- **PostgreSQL** — Primary data store, connected via `DATABASE_URL` environment variable
- **Drizzle ORM** — Type-safe query builder and schema management
- **drizzle-kit** — Database migration/push tooling

### Authentication
- **Passport.js** + **passport-local** — Authentication middleware
- **express-session** — Session management
- **connect-pg-simple** — PostgreSQL-backed session store for persistent sessions
- **helmet** — Secure HTTP headers middleware
- **express-rate-limit** — Rate limiting for auth endpoints

### Frontend Libraries
- **@tanstack/react-query** — Server state management and caching
- **wouter** — Client-side routing
- **shadcn/ui** (Radix UI primitives) — Full component library (dialog, tabs, select, toast, etc.)
- **Tailwind CSS** — Utility-first styling
- **date-fns** — Date formatting
- **recharts** — Chart/statistics visualization
- **lucide-react** — Icon library
- **zod** — Runtime validation (shared between client and server)
- **react-hook-form** + **@hookform/resolvers** — Form management
- **socket.io-client** — Real-time WebSocket client
- **qrcode.react** — QR code generation for board pairing

### Build Tools
- **Vite** — Frontend dev server and bundler
- **esbuild** — Server-side bundling for production
- **TypeScript** — Type checking across the entire codebase
- **tsx** — TypeScript execution for development server

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal** — Error overlay in development
- **@replit/vite-plugin-cartographer** — Replit dev tooling
- **@replit/vite-plugin-dev-banner** — Development environment indicator