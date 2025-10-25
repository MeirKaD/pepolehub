# PeopleHub - Complete Project Documentation

**Version:** 0.1.0
**Repository:** /Users/meirk/Desktop/programming/pepolehub
**Status:** Active Development
**Last Updated:** 2025-10-25

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Architecture & Data Flow](#architecture--data-flow)
5. [Database Schema](#database-schema)
6. [Backend API Routes](#backend-api-routes)
7. [Frontend Routes & Pages](#frontend-routes--pages)
8. [Core Services & Libraries](#core-services--libraries)
9. [State Management](#state-management)
10. [Component Reference](#component-reference)
11. [Environment Variables](#environment-variables)
12. [Development & Deployment](#development--deployment)
13. [File Reference Map](#file-reference-map)

---

## Project Overview

**PeopleHub** is an open-source LinkedIn people search engine powered by AI and real-time data scraping. It enables users to search for professionals using natural language queries (e.g., "10 AI Engineers in Israel") and retrieves detailed LinkedIn profiles through Bright Data's scraping API.

### Key Features
- AI-powered natural language query parsing (Google Gemini 2.0 Flash)
- Real-time LinkedIn profile scraping via Bright Data
- Intelligent 30-day caching system to reduce API costs
- Beautiful 3D UI with React Three Fiber animations
- Cursor-based pagination with auto-refresh
- Image proxy to avoid ad blocker issues

### How It Works
1. User enters natural language query (e.g., "5 AI Engineers in Israel")
2. Gemini AI parses query into structured search parameters
3. Bright Data searches Google for LinkedIn URLs
4. System checks database cache for existing profiles (30-day freshness)
5. Fetches missing profiles from Bright Data LinkedIn scraper
6. Saves profiles to PostgreSQL database
7. Returns combined cached + fresh results to user

---

## Technology Stack

### Frontend
- **Framework:** Next.js 15.5.4 (App Router)
- **Language:** TypeScript 5
- **UI Library:** React 19.1.0
- **Styling:** Tailwind CSS 4 (@tailwindcss/postcss)
- **Component Library:** shadcn/ui (Radix UI primitives)
- **Icons:** Lucide React 0.469.0
- **3D Graphics:**
  - React Three Fiber 9.3.0
  - @react-three/drei 10.7.6
  - three.js 0.180.0
- **Utilities:**
  - clsx 2.1.1
  - tailwind-merge 2.6.0
  - date-fns 4.1.0

### Backend
- **Runtime:** Node.js 18+
- **Database:** PostgreSQL (Supabase)
- **ORM:** Prisma 6.5.0
- **Validation:** Zod 3.25.76
- **HTTP Client:** Native Fetch API

### AI & External Services
- **AI Model:** Google Gemini 2.0 Flash (@ai-sdk/google 2.0.17)
- **AI SDK:** Vercel ai 5.0.60
- **Data Scraping:** Bright Data API (Google Search + LinkedIn)

### Development Tools
- **Linting:** ESLint 9 (next/core-web-vitals)
- **Formatting:** Prettier 3.4.2
- **Type Checking:** TypeScript strict mode
- **Build System:** Next.js built-in
- **Testing:** TSX 4.20.6

---

## Project Structure

```
pepolehub/
├── prisma/
│   └── schema.prisma              # Database schema (Person & Search models)
│
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── api/                   # API routes
│   │   │   ├── search/
│   │   │   │   └── route.ts       # POST /api/search - Main search endpoint
│   │   │   ├── profiles/
│   │   │   │   └── recent/
│   │   │   │       └── route.ts   # GET /api/profiles/recent - Cached profiles
│   │   │   └── proxy-image/
│   │   │       └── route.ts       # GET /api/proxy-image - Image proxy
│   │   ├── layout.tsx             # Root layout with navigation
│   │   ├── page.tsx               # Homepage (/)
│   │   ├── search/
│   │   │   └── page.tsx           # Search results page (/search?q=...)
│   │   ├── previous/
│   │   │   └── page.tsx           # Previous searches (/previous)
│   │   └── globals.css            # Global Tailwind styles
│   │
│   ├── components/                # React components
│   │   ├── ui/                    # shadcn/ui components (11 files)
│   │   │   ├── avatar.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── collapsible.tsx
│   │   │   ├── input.tsx
│   │   │   ├── navigation-menu.tsx
│   │   │   ├── separator.tsx
│   │   │   └── skeleton.tsx
│   │   ├── FloatingOrbs.tsx       # 3D magnifying glass animations
│   │   ├── Navigation.tsx         # Top navigation bar
│   │   ├── PersonCard.tsx         # Expandable profile card
│   │   ├── SearchBar.tsx          # Search input component
│   │   └── LoadingState.tsx       # Skeleton loader
│   │
│   ├── lib/                       # Core business logic
│   │   ├── brightdata/            # Bright Data API integration
│   │   │   ├── client.ts          # HTTP client (52 lines)
│   │   │   ├── linkedin.ts        # LinkedIn profile scraper (220 lines)
│   │   │   └── search.ts          # Google search API (193 lines)
│   │   ├── cache/
│   │   │   └── index.ts           # Database caching layer (251 lines)
│   │   ├── search/
│   │   │   └── parser.ts          # AI query parsing (Gemini)
│   │   ├── prisma.ts              # Prisma client singleton
│   │   └── utils.ts               # Utility functions
│   │
│   ├── types/
│   │   └── linkedin.ts            # TypeScript interfaces (148 lines)
│   │
│   └── tests/                     # Test scripts
│       ├── test-parser.ts
│       ├── test-search-flow.ts
│       ├── test-cache.ts
│       ├── test-linkedin.ts
│       └── test-recent-api.ts
│
├── public/                        # Static assets
│   ├── logo.png
│   └── *.svg (icons)
│
├── Configuration Files
│   ├── package.json               # Dependencies and scripts
│   ├── tsconfig.json              # TypeScript configuration
│   ├── next.config.ts             # Next.js configuration
│   ├── postcss.config.mjs         # PostCSS configuration
│   ├── eslint.config.mjs          # ESLint configuration
│   ├── components.json            # shadcn/ui configuration
│   ├── .env.example               # Environment variables template
│   └── .gitignore                 # Git ignore rules
```

---

## Architecture & Data Flow

### Complete Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER INPUT: Natural Language                │
│                 "10 AI Engineers in San Francisco"              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND: SearchBar Component                                  │
│  - Validates input (2-100 characters)                           │
│  - Submits query                                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  ROUTING: Next.js Navigation                                    │
│  - router.push('/search?q=10+AI+Engineers+in+San+Francisco')    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND: Search Results Page                                  │
│  - Detects query parameter change                               │
│  - Triggers POST /api/search                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  API: POST /api/search                                          │
│  File: src/app/api/search/route.ts                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: AI Query Parsing                                       │
│  File: src/lib/search/parser.ts                                 │
│  Function: parseSearchQuery(query)                              │
│                                                                  │
│  Input: "10 AI Engineers in San Francisco"                      │
│  AI Model: Google Gemini 2.0 Flash                              │
│  Output: {                                                       │
│    count: 10,                                                    │
│    role: "AI Engineer",                                          │
│    location: "San Francisco",                                    │
│    countryCode: "US",                                            │
│    keywords: [],                                                 │
│    googleQuery: 'site:linkedin.com/in "AI Engineer" "San Francisco"' │
│  }                                                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Find LinkedIn URLs                                     │
│  File: src/lib/brightdata/search.ts                             │
│  Function: findLinkedInProfiles(googleQuery, count, countryCode)│
│                                                                  │
│  - POST to Bright Data Google Search API                        │
│  - Geolocation filtering (gl=US)                                │
│  - Extract LinkedIn profile URLs                                │
│  Output: ["linkedin.com/in/user1", "linkedin.com/in/user2", ...]│
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Check Cache                                            │
│  File: src/lib/cache/index.ts                                   │
│  Function: getCachedProfiles(linkedinUrls)                      │
│                                                                  │
│  - Extract LinkedIn IDs from URLs                               │
│  - Batch query database: prisma.person.findMany()               │
│  - Filter by freshness (< 30 days old)                          │
│  Output: { "user1": ProfileData, "user2": ProfileData, ... }    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Separate Cached vs Uncached                            │
│                                                                  │
│  Cached (fresh): 7 profiles                                     │
│  Uncached (need fetching): 3 profiles                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: Fetch Missing Profiles                                 │
│  File: src/lib/brightdata/linkedin.ts                           │
│  Function: fetchLinkedInProfiles(uncachedUrls)                  │
│                                                                  │
│  - POST to Bright Data LinkedIn API (trigger scrape job)        │
│  - Dataset ID: gd_l1viktl72bvl7bjuj0                            │
│  - Poll for results (max 600s, 1s interval)                     │
│  - Transform response to ProfileData format                     │
│  Output: [ProfileData, ProfileData, ProfileData]                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: Save to Cache                                          │
│  File: src/lib/cache/index.ts                                   │
│  Function: saveProfile(profileData)                             │
│                                                                  │
│  For each fetched profile:                                      │
│  - prisma.person.upsert()                                       │
│  - Increment searchCount                                        │
│  - Update lastViewed timestamp                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 7: Return Combined Results                                │
│                                                                  │
│  Response: {                                                     │
│    success: true,                                                │
│    count: 10,                                                    │
│    profiles: [...7 cached + ...3 newly fetched],                │
│    cached: 7,                                                    │
│    fetched: 3                                                    │
│  }                                                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND: Display Results                                      │
│  - setProfiles(data.profiles)                                   │
│  - Render grid of PersonCard components                         │
│  - Each card: Avatar, name, headline, location, company         │
│  - Expandable details: experience, education, languages         │
└─────────────────────────────────────────────────────────────────┘
```

### Caching Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    CACHE DECISION TREE                        │
└──────────────────────────┬───────────────────────────────────┘
                           │
                    Profile Request
                           │
                ┌──────────┴──────────┐
                │                     │
          Exists in DB?           Not in DB
                │                     │
        ┌───────┴────────┐            │
        │                │            │
   < 30 days      >= 30 days          │
   (FRESH)         (STALE)            │
        │                │            │
        │                └────────────┤
        │                             │
   CACHE HIT                    CACHE MISS
   Return cached                     │
   profile                           │
        │                    Fetch from Bright Data
        │                             │
        │                    Save to database
        │                             │
        └─────────────┬───────────────┘
                      │
               Return profile
```

**Cache Configuration:**
- **Freshness TTL:** 30 days (`CACHE_FRESHNESS_DAYS = 30`)
- **Storage:** PostgreSQL (Supabase)
- **Invalidation:** Time-based only (no manual invalidation)
- **Update Strategy:** On cache hit, increment `searchCount` and update `lastViewed`

---

## Database Schema

**Location:** `/Users/meirk/Desktop/programming/pepolehub/prisma/schema.prisma`

### Person Model

**Table Name:** `people`
**Purpose:** Cache LinkedIn profile data

```prisma
model Person {
  // Primary Identifiers
  id                String   @id @default(cuid())
  linkedinUrl       String   @unique
  linkedinId        String   @unique        // e.g., "katcook1"
  linkedinNumId     String?                 // Numeric ID

  // Basic Information
  firstName         String
  lastName          String
  fullName          String   @db.Text
  headline          String?  @db.Text       // Job title/tagline
  about             String?  @db.Text       // Biography

  // Location Data
  location          String?                 // "San Francisco Bay Area"
  city              String?                 // "San Francisco"
  countryCode       String?                 // "US"

  // Profile Media
  profilePicUrl     String?
  bannerImage       String?
  defaultAvatar     Boolean  @default(false)

  // Current Employment
  currentCompany    String?                 // Company name
  currentCompanyId  String?                 // LinkedIn company ID

  // Rich Data (JSON Arrays)
  experience        Json?                   // Experience[]
  education         Json?                   // Education[]
  languages         Json?                   // Language[]

  // Social Metrics
  connections       Int?
  followers         Int?

  // Metadata
  searchCount       Int      @default(0)    // How many times searched
  lastViewed        DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt     // Auto-updated by Prisma
  memorializedAccount Boolean @default(false)

  // Performance Indexes
  @@index([fullName])
  @@index([firstName, lastName])
  @@index([lastViewed])
  @@index([linkedinId])
  @@index([currentCompany])
  @@index([location])
  @@index([updatedAt])
  @@map("people")
}
```

### Search Model

**Table Name:** `searches`
**Purpose:** Log search history (currently not actively used in UI)

```prisma
model Search {
  id          String   @id @default(cuid())
  query       String   @db.Text            // Original search query
  results     Json                         // Array of person IDs
  resultCount Int                          // Number of results
  createdAt   DateTime @default(now())

  @@index([query])
  @@map("searches")
}
```

### JSON Field Structures

#### Experience[] Structure
```typescript
interface Experience {
  company: string;                    // "OpenAI"
  company_logo_url?: string;          // Company logo URL
  description_html: string | null;    // HTML formatted description
  duration?: string;                  // "2 years 3 months"
  subtitle?: string;                  // Additional role info
  title: string;                      // "Senior Engineer"
}
```

#### Education[] Structure
```typescript
interface Education {
  description: string | null;         // Degree details
  description_html: string | null;    // HTML formatted
  end_year?: string;                  // "2020"
  institute_logo_url: string | null;  // School logo
  start_year?: string;                // "2016"
  title?: string;                     // "Bachelor of Science"
  url?: string;                       // School website
}
```

#### Language[] Structure
```typescript
interface Language {
  subtitle: string;                   // "Professional working proficiency"
  title: string;                      // "Spanish"
}
```

### Database Operations Summary

| Operation | Function | File | Query Type |
|-----------|----------|------|-----------|
| Get single cached profile | `getCachedProfile()` | src/lib/cache/index.ts:44 | SELECT WHERE linkedinId |
| Get multiple cached profiles | `getCachedProfiles()` | src/lib/cache/index.ts:119 | SELECT WHERE linkedinId IN (...) |
| Save/update profile | `saveProfile()` | src/lib/cache/index.ts:182 | UPSERT |
| Get recent profiles | `/api/profiles/recent` | src/app/api/profiles/recent/route.ts:74 | SELECT ORDER BY updatedAt |
| Count total profiles | `/api/profiles/recent` | src/app/api/profiles/recent/route.ts:71 | COUNT(*) |

---

## Backend API Routes

### 1. POST /api/search

**File:** `src/app/api/search/route.ts`
**Purpose:** Main search endpoint for finding LinkedIn profiles

#### Request
```typescript
POST /api/search
Content-Type: application/json

{
  "query": string  // 2-100 characters
}
```

#### Response
```typescript
{
  "success": boolean,
  "count": number,           // Total profiles returned
  "profiles": ProfileData[], // Array of profiles
  "cached": number,          // Number from cache
  "fetched": number          // Number newly fetched
}
```

#### Processing Steps
1. **Validate Query** - Check length (2-100 chars)
2. **Parse Query** - Use Gemini AI to extract structured data
3. **Search Google** - Find LinkedIn URLs via Bright Data
4. **Check Cache** - Batch lookup in database
5. **Fetch Missing** - Get uncached profiles from Bright Data
6. **Save Profiles** - Upsert to database
7. **Return Results** - Combined cached + fresh

#### Error Responses
- `400` - Invalid query (missing, too short/long)
- `500` - Server error (parsing, API, database failures)

#### Dependencies
- `src/lib/search/parser.ts` - AI query parsing
- `src/lib/brightdata/search.ts` - Google search
- `src/lib/brightdata/linkedin.ts` - Profile fetching
- `src/lib/cache/index.ts` - Database operations

---

### 2. GET /api/profiles/recent

**File:** `src/app/api/profiles/recent/route.ts`
**Purpose:** Fetch recently cached profiles with pagination

#### Request
```typescript
GET /api/profiles/recent?limit=50&before=2024-01-15T10:00:00.000Z&after=2024-01-14T10:00:00.000Z
```

#### Query Parameters
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | number | 50 | 100 | Results per page |
| `before` | ISO timestamp | - | - | Get profiles updated before this time |
| `after` | ISO timestamp | - | - | Get profiles updated after this time |

#### Response
```typescript
Headers:
  X-Total-Count: 1234  // Total cached profiles in database

Body:
{
  "success": boolean,
  "count": number,               // Profiles in this response
  "profiles": ProfileData[]      // Includes updatedAt field
}
```

#### Use Cases
- **Initial Load:** `?limit=50` (newest 50 profiles)
- **Load More (Pagination):** `?limit=50&before=2024-01-15T10:00:00.000Z`
- **Auto-Refresh:** `?after=2024-01-15T10:00:00.000Z` (get newer profiles)

#### Sorting
- Primary: `updatedAt DESC` (newest first)
- Indexed for performance

---

### 3. GET /api/proxy-image

**File:** `src/app/api/proxy-image/route.ts`
**Purpose:** Proxy LinkedIn images to avoid CORS and ad blocker issues

#### Request
```typescript
GET /api/proxy-image?url=https://media.licdn.com/dms/image/...
```

#### Response
- **Content-Type:** Preserved from upstream (typically image/jpeg, image/png)
- **Cache-Control:** `public, max-age=86400` (24 hours)
- **Body:** Binary image data

#### Features
- User-Agent spoofing to bypass bot detection
- 24-hour client-side caching
- CORS-friendly
- Error handling for missing/invalid URLs

#### Error Responses
- `400` - Missing `url` parameter
- `404` - Upstream image not found
- `500` - Fetch failure

---

## Frontend Routes & Pages

### Route Overview

| Route | File | Purpose | Type |
|-------|------|---------|------|
| `/` | src/app/page.tsx | Landing page | Static |
| `/search` | src/app/search/page.tsx | Search results | Dynamic (query param) |
| `/previous` | src/app/previous/page.tsx | Cached profiles | Client-side |
| `/api/search` | src/app/api/search/route.ts | Search API | Server API |
| `/api/profiles/recent` | src/app/api/profiles/recent/route.ts | Recent profiles API | Server API |
| `/api/proxy-image` | src/app/api/proxy-image/route.ts | Image proxy | Server API |

---

### 1. Homepage (`/`)

**File:** `src/app/page.tsx`
**Type:** Client Component

#### Features
- Hero section with animated gradient heading
- 3D floating magnifying glass animations (React Three Fiber)
- Search bar for entering queries
- Search tips panel

#### Components Used
- `FloatingOrbs` - 3D background animation
- `SearchBar` - Input with search submission

#### User Flow
1. User enters search query
2. SearchBar validates input
3. Redirects to `/search?q={query}`

---

### 2. Search Results Page (`/search`)

**File:** `src/app/search/page.tsx`
**Type:** Client Component
**Dynamic Parameter:** `?q={query}`

#### Features
- Displays grid of profile cards
- Loading states with skeleton loaders
- Error handling and empty states
- Responsive grid layout

#### State Management
```typescript
const [profiles, setProfiles] = useState<ProfileData[]>([]);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

#### Data Flow
1. Extract `q` parameter from URL
2. Trigger `POST /api/search` with query
3. Display loading state
4. Render results in grid layout
5. Handle errors gracefully

#### Components Used
- `SearchBar` - For refining search
- `PersonCard` - Profile display (grid)
- `LoadingState` - Skeleton loader

#### Layout
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3 columns

---

### 3. Previous Searches Page (`/previous`)

**File:** `src/app/previous/page.tsx`
**Type:** Client Component

#### Features
- Displays all cached profiles from database
- Cursor-based pagination ("Load More")
- Auto-refresh every 30 seconds
- Total count display

#### State Management
```typescript
const [profiles, setProfiles] = useState<ProfileWithTimestamp[]>([]);
const [isLoading, setIsLoading] = useState(false);
const [isLoadingMore, setIsLoadingMore] = useState(false);
const [isRefreshing, setIsRefreshing] = useState(false);
const [error, setError] = useState<string | null>(null);
const [totalCount, setTotalCount] = useState(0);
const [hasMore, setHasMore] = useState(true);
```

#### Data Flow

**Initial Load:**
```typescript
GET /api/profiles/recent?limit=50
```

**Load More (Pagination):**
```typescript
GET /api/profiles/recent?limit=50&before={oldestTimestamp}
// Appends older profiles to existing list
```

**Auto-Refresh (Every 30s):**
```typescript
GET /api/profiles/recent?after={newestTimestamp}
// Prepends newer profiles to existing list
```

#### Components Used
- `PersonCard` - Profile cards in grid
- `LoadingState` - Skeleton loader
- `Button` - Load More and Refresh buttons

---

### 4. Root Layout

**File:** `src/app/layout.tsx`
**Type:** Server Component

#### Features
- Global navigation bar (persistent across pages)
- Google fonts (Playfair Display, Geist Mono)
- Global CSS injection
- Metadata configuration

#### Components Used
- `Navigation` - Top navbar with glassmorphism effect

---

## Core Services & Libraries

### 1. AI Query Parser

**File:** `src/lib/search/parser.ts`
**Purpose:** Parse natural language queries using Google Gemini AI

#### Function: `parseSearchQuery(query: string)`

**Input Example:**
```typescript
"10 AI Engineers in San Francisco"
```

**Output Example:**
```typescript
{
  count: 10,
  role: "AI Engineer",
  location: "San Francisco",
  countryCode: "US",
  keywords: [],
  googleQuery: 'site:linkedin.com/in "AI Engineer" "San Francisco"'
}
```

**AI Model:** `gemini-2.0-flash-exp`

#### Features
- Extracts structured data from natural language
- Handles both job searches and individual name searches
- Generates optimized Google search queries
- Uses Zod schema for validation
- Fallback handling if AI fails

#### Dependencies
- `@ai-sdk/google` - Gemini API client
- `ai` - Vercel AI SDK
- `zod` - Schema validation

---

### 2. Bright Data Google Search

**File:** `src/lib/brightdata/search.ts`
**Purpose:** Search Google for LinkedIn profile URLs

#### Function: `findLinkedInProfiles(query, maxResults, countryCode)`

**Input:**
- `query`: Google search query string
- `maxResults`: Max number of results (default: 10)
- `countryCode`: ISO country code for geolocation (e.g., "US", "IL")

**Output:**
```typescript
["linkedin.com/in/user1", "linkedin.com/in/user2", ...]
```

#### Features
- Geolocation-aware search (`gl` parameter)
- Filters for `site:linkedin.com/in`
- Extracts and validates LinkedIn URLs
- Handles pagination if needed

#### API Endpoint
```typescript
POST https://api.brightdata.com/request
Authorization: Bearer {BRIGHTDATA_API_TOKEN}

Body: {
  zone: "unblocker",
  url: "https://www.google.com/search?q=...",
  format: "raw"
}
```

---

### 3. Bright Data LinkedIn Scraper

**File:** `src/lib/brightdata/linkedin.ts`
**Purpose:** Fetch detailed LinkedIn profile data

#### Function: `fetchLinkedInProfiles(urls: string[])`

**Input:**
```typescript
["https://linkedin.com/in/user1", "https://linkedin.com/in/user2"]
```

**Output:**
```typescript
[
  {
    linkedinUrl: "...",
    firstName: "John",
    lastName: "Doe",
    // ... full ProfileData object
  },
  // ...
]
```

#### Features
- Batch profile fetching
- Asynchronous job polling (1s interval, 600s max)
- Data transformation from Bright Data format to ProfileData
- Handles URL normalization (region variants)

#### API Flow
1. **Trigger Scrape Job:**
```typescript
POST https://api.brightdata.com/datasets/v3/trigger
Body: {
  dataset_id: "gd_l1viktl72bvl7bjuj0",
  include_errors: true,
  url: ["https://linkedin.com/in/user1", ...]
}
```

2. **Poll for Results:**
```typescript
GET https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}
// Poll every 1 second until status === "ready"
```

3. **Download Results:**
```typescript
GET https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}/download
```

#### Timeout Configuration
- **Max Polling Time:** 600 seconds (10 minutes)
- **Polling Interval:** 1 second
- **Max Attempts:** 600

---

### 4. Cache Layer

**File:** `src/lib/cache/index.ts`
**Purpose:** Database caching with 30-day freshness

#### Configuration
```typescript
const CACHE_FRESHNESS_DAYS = 30;
```

#### Functions

##### `getCachedProfile(linkedinUrl: string): Promise<ProfileData | null>`
- **Purpose:** Fetch single profile from cache
- **Returns:** Profile if exists and fresh, otherwise null
- **Query:** `SELECT WHERE linkedinId = ?`

##### `getCachedProfiles(linkedinUrls: string[]): Promise<Record<string, ProfileData>>`
- **Purpose:** Batch fetch multiple profiles
- **Returns:** Object mapping `linkedinId → ProfileData`
- **Query:** `SELECT WHERE linkedinId IN (...)`
- **Optimization:** Single database query for multiple profiles

##### `saveProfile(data: ProfileData): Promise<ProfileData>`
- **Purpose:** Create or update profile in database
- **Operation:** `UPSERT`
- **On Update:**
  - Increments `searchCount`
  - Updates `lastViewed` timestamp
  - Updates all profile fields
- **On Create:**
  - Sets `searchCount = 0`
  - Sets default timestamps

#### Cache Hit Logic
```typescript
function isFresh(updatedAt: Date): boolean {
  const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceUpdate < CACHE_FRESHNESS_DAYS;
}
```

---

### 5. Prisma Client

**File:** `src/lib/prisma.ts`
**Purpose:** Singleton Prisma client instance

#### Implementation
```typescript
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

#### Features
- Single instance across entire application
- Development: Logs all queries for debugging
- Production: Logs errors only
- Prevents "client already connected" errors

---

### 6. Utility Functions

**File:** `src/lib/utils.ts`

#### `cn(...inputs: ClassValue[]): string`
- **Purpose:** Merge Tailwind CSS classes
- **Uses:** `clsx` + `tailwind-merge`
- **Example:**
```typescript
cn("px-4 py-2", isActive && "bg-blue-500", className)
// Result: "px-4 py-2 bg-blue-500 custom-class"
```

---

## State Management

### Philosophy
- **Minimal Approach:** No global state management library (Redux, Zustand)
- **Local Component State:** React `useState` for UI state
- **Database as Source of Truth:** PostgreSQL via Prisma
- **URL-Based State:** Search queries in URL parameters

### State Locations

#### Search Results Page
**File:** `src/app/search/page.tsx`

```typescript
const [profiles, setProfiles] = useState<ProfileData[]>([]);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**Triggers:**
- URL query parameter change
- Fetches from `/api/search`

---

#### Previous Searches Page
**File:** `src/app/previous/page.tsx`

```typescript
const [profiles, setProfiles] = useState<ProfileWithTimestamp[]>([]);
const [isLoading, setIsLoading] = useState(false);
const [isLoadingMore, setIsLoadingMore] = useState(false);
const [isRefreshing, setIsRefreshing] = useState(false);
const [error, setError] = useState<string | null>(null);
const [totalCount, setTotalCount] = useState(0);
const [hasMore, setHasMore] = useState(true);
```

**Auto-Refresh:**
```typescript
useEffect(() => {
  if (!profiles.length) return;
  const interval = setInterval(() => {
    refreshNew(); // Fetch profiles with after={newestTimestamp}
  }, 30000); // 30 seconds
  return () => clearInterval(interval);
}, [profiles.length, refreshNew]);
```

---

#### Component State
**PersonCard:** `isOpen` (collapsible state)
**SearchBar:** `query` (input value)
**FloatingOrbs:** `groupRef` (Three.js mesh reference)

---

### Data Flow Patterns

#### Pattern 1: URL-Driven State
```typescript
// User searches → URL updates → Component re-renders → Fetch data
router.push('/search?q=AI+Engineers')
↓
const searchParams = useSearchParams();
const query = searchParams.get('q');
↓
useEffect(() => { fetchProfiles(); }, [query]);
```

#### Pattern 2: Pagination with Timestamps
```typescript
// Cursor-based pagination using updatedAt timestamps
const oldestTimestamp = profiles[profiles.length - 1].updatedAt;
await fetch(`/api/profiles/recent?before=${oldestTimestamp}`);
// Append to existing profiles
setProfiles(prev => [...prev, ...newProfiles]);
```

#### Pattern 3: Auto-Refresh
```typescript
// Periodic polling for new data
const newestTimestamp = profiles[0]?.updatedAt;
await fetch(`/api/profiles/recent?after=${newestTimestamp}`);
// Prepend to existing profiles
setProfiles(prev => [...newProfiles, ...prev]);
```

---

## Component Reference

### UI Components (shadcn/ui)

**Location:** `src/components/ui/`

| Component | File | Purpose |
|-----------|------|---------|
| Avatar | avatar.tsx | Profile pictures with fallback |
| Badge | badge.tsx | Tags and labels |
| Button | button.tsx | Buttons with variants |
| Card | card.tsx | Card containers |
| Collapsible | collapsible.tsx | Expandable sections |
| Input | input.tsx | Text inputs |
| NavigationMenu | navigation-menu.tsx | Menu components |
| Separator | separator.tsx | Divider lines |
| Skeleton | skeleton.tsx | Loading placeholders |

---

### Custom Components

#### FloatingOrbs
**File:** `src/components/FloatingOrbs.tsx`
**Purpose:** 3D animated magnifying glass background

**Features:**
- Uses React Three Fiber
- Animated rotation and floating
- Magnifying glass models
- Only on homepage

**Dependencies:**
- `@react-three/fiber`
- `@react-three/drei`
- `three`

---

#### Navigation
**File:** `src/components/Navigation.tsx`
**Purpose:** Top navigation bar

**Features:**
- Glassmorphism effect
- Active page indicator
- Logo with home link
- "Powered by Bright Data" attribution
- Responsive (icons on mobile, text on desktop)

**Navigation Items:**
1. Home (`/`) - Home icon
2. Previous Searches (`/previous`) - History icon

---

#### SearchBar
**File:** `src/components/SearchBar.tsx`
**Purpose:** Search input component

**Props:**
```typescript
{
  onSearch: (query: string) => void;
  isLoading?: boolean;
}
```

**Features:**
- Controlled input
- Submit on Enter or button click
- Disabled during loading
- Search icon button

---

#### PersonCard
**File:** `src/components/PersonCard.tsx`
**Purpose:** Expandable profile card

**Props:**
```typescript
{
  profile: ProfileData;
}
```

**Features:**
- Avatar with fallback initials
- Name, headline, location
- Current company display
- Expandable details section with:
  - Full biography
  - Experience list with company logos
  - Education history
  - Languages
  - Connection count
- LinkedIn profile link (opens in new tab)
- Image proxy for avatars

**State:**
```typescript
const [isOpen, setIsOpen] = useState(false);
```

---

#### LoadingState
**File:** `src/components/LoadingState.tsx`
**Purpose:** Skeleton loader grid

**Features:**
- Grid matching PersonCard layout
- Skeleton placeholders for:
  - Avatar
  - Text lines
  - Badges
- Responsive grid (1-3 columns)

---

## Environment Variables

**Template:** `.env.example`

### Required Variables

```env
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://user:password@host:port/database?pgbouncer=true&connection_limit=1"

# Bright Data API
BRIGHTDATA_API_TOKEN="your_api_token_here"
BRIGHTDATA_UNLOCKER_ZONE="unblocker"  # Optional, defaults to "unblocker"

# Google Generative AI (Gemini)
GOOGLE_GENERATIVE_AI_API_KEY="your_gemini_api_key_here"

# Application URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Optional Variables

```env
# Supabase (for client-side requests - not currently used)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_anon_key"

# Analytics (not implemented)
NEXT_PUBLIC_POSTHOG_KEY=""
```

### Security Notes
- All API keys are server-side only (not prefixed with `NEXT_PUBLIC_`)
- Never commit `.env` file to git
- Use `.env.local` for local development
- Production variables set in Vercel dashboard

---

## Development & Deployment

### NPM Scripts

```json
{
  "dev": "next dev",                  // Start dev server (localhost:3000)
  "build": "next build",              // Production build
  "start": "next start",              // Start production server
  "lint": "eslint .",                 // Run ESLint
  "db:push": "prisma db push",        // Sync schema to database
  "db:studio": "prisma studio",       // Open Prisma visual editor
  "db:seed": "tsx prisma/seed.ts",    // Run seed script (if exists)
  "db:generate": "prisma generate"    // Generate Prisma Client
}
```

### Development Workflow

1. **Clone Repository**
```bash
git clone <repository-url>
cd pepolehub
```

2. **Install Dependencies**
```bash
npm install
```

3. **Setup Environment**
```bash
cp .env.example .env.local
# Edit .env.local with your API keys
```

4. **Setup Database**
```bash
npm run db:push        # Push schema to Supabase
npm run db:generate    # Generate Prisma Client
```

5. **Start Development Server**
```bash
npm run dev
# Open http://localhost:3000
```

6. **Run Tests**
```bash
npx tsx src/tests/test-parser.ts       # Test AI parser
npx tsx src/tests/test-search-flow.ts  # Test complete flow
npx tsx src/tests/test-cache.ts        # Test caching
```

### Build for Production

```bash
npm run build
npm start
```

### Deployment (Vercel)

1. **Connect Repository** to Vercel
2. **Set Environment Variables** in Vercel dashboard
3. **Deploy** - Automatic on push to main branch

**Build Configuration:**
- Framework: Next.js
- Node Version: 18.x
- Build Command: `next build`
- Output Directory: `.next`

---

## File Reference Map

### Quick Reference: Where to Find/Edit Specific Functionality

#### "I want to modify search functionality"
```
Query Parsing:     src/lib/search/parser.ts
Google Search:     src/lib/brightdata/search.ts
LinkedIn Scraping: src/lib/brightdata/linkedin.ts
Search API:        src/app/api/search/route.ts
Search UI:         src/app/search/page.tsx
```

#### "I want to change caching behavior"
```
Cache Logic:       src/lib/cache/index.ts
Cache TTL:         src/lib/cache/index.ts (CACHE_FRESHNESS_DAYS)
Database Schema:   prisma/schema.prisma
Recent Profiles:   src/app/api/profiles/recent/route.ts
```

#### "I want to modify UI components"
```
Homepage:          src/app/page.tsx
Search Results:    src/app/search/page.tsx
Previous Searches: src/app/previous/page.tsx
Navigation:        src/components/Navigation.tsx
Profile Cards:     src/components/PersonCard.tsx
Search Bar:        src/components/SearchBar.tsx
3D Animation:      src/components/FloatingOrbs.tsx
UI Primitives:     src/components/ui/*
```

#### "I want to add/modify API endpoints"
```
API Routes:        src/app/api/*/route.ts
Type Definitions:  src/types/linkedin.ts
Validation:        Inline Zod schemas in route handlers
```

#### "I want to change database schema"
```
Schema Definition: prisma/schema.prisma
After Changes:     npm run db:push
Generate Client:   npm run db:generate
```

#### "I want to configure external services"
```
Bright Data:       src/lib/brightdata/client.ts
Gemini AI:         src/lib/search/parser.ts
Environment:       .env.local (create from .env.example)
```

#### "I want to modify styling"
```
Global Styles:     src/app/globals.css
Tailwind Config:   Uses @tailwindcss/postcss v4
Component Styles:  Inline Tailwind classes in components
Color Scheme:      components.json (shadcn/ui config)
```

---

## Key Design Decisions

### Why 30-Day Cache?
- Balances data freshness with API cost reduction
- LinkedIn profiles don't change frequently
- Reduces load on Bright Data API
- Can be adjusted via `CACHE_FRESHNESS_DAYS` constant

### Why No Global State Management?
- Simple application with limited shared state
- Database serves as source of truth
- URL parameters handle navigation state
- Avoids unnecessary complexity

### Why Bright Data?
- Reliable LinkedIn scraping at scale
- Handles CAPTCHA and anti-bot measures
- Provides both Google Search and LinkedIn APIs
- Better than building custom scrapers

### Why Gemini AI for Parsing?
- Excellent at understanding natural language
- Fast response times (Flash model)
- Structured output with Zod validation
- Reduces need for complex regex patterns

### Why PostgreSQL + Prisma?
- Type-safe database queries
- Excellent developer experience
- Supabase provides managed hosting
- Easy schema migrations

### Why Next.js App Router?
- Server components for better performance
- Built-in API routes
- File-based routing
- Excellent TypeScript support

---

## Common Tasks Reference

### Add a New Database Field

1. Edit `prisma/schema.prisma`:
```prisma
model Person {
  // ... existing fields
  newField String?  // Add new field
}
```

2. Push to database:
```bash
npm run db:push
```

3. Update TypeScript types in `src/types/linkedin.ts`

4. Update cache operations in `src/lib/cache/index.ts`

---

### Add a New API Endpoint

1. Create route file:
```bash
src/app/api/my-endpoint/route.ts
```

2. Implement handler:
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Implementation
  return NextResponse.json({ success: true });
}
```

---

### Add a New Page

1. Create page file:
```bash
src/app/my-page/page.tsx
```

2. Implement component:
```typescript
export default function MyPage() {
  return <div>My Page Content</div>;
}
```

3. Add navigation link in `src/components/Navigation.tsx`

---

### Modify AI Parsing Logic

**File:** `src/lib/search/parser.ts`

1. Update Zod schema:
```typescript
const searchQuerySchema = z.object({
  // Modify fields
});
```

2. Update AI prompt:
```typescript
const { object } = await generateObject({
  model: google('gemini-2.0-flash-exp'),
  schema: searchQuerySchema,
  prompt: `Your updated prompt here`,
});
```

---

### Change Cache Freshness

**File:** `src/lib/cache/index.ts`

```typescript
const CACHE_FRESHNESS_DAYS = 30; // Change this value
```

---

## Testing

### Test Files Location
```
src/tests/
├── test-parser.ts         # AI query parsing
├── test-search-flow.ts    # End-to-end search
├── test-cache.ts          # Database caching
├── test-linkedin.ts       # LinkedIn API
└── test-recent-api.ts     # Recent profiles API
```

### Running Tests

```bash
# Individual tests
npx tsx src/tests/test-parser.ts
npx tsx src/tests/test-search-flow.ts
npx tsx src/tests/test-cache.ts
npx tsx src/tests/test-linkedin.ts
npx tsx src/tests/test-recent-api.ts

# All tests (manual)
npx tsx src/tests/test-*.ts
```

---

## Performance Considerations

### Database Indexes
- **Indexed Fields:** fullName, firstName+lastName, lastViewed, linkedinId, currentCompany, location, updatedAt
- **Query Optimization:** Batch operations preferred over individual queries
- **Connection Pooling:** Configured via Supabase

### API Rate Limiting
- **Bright Data:** No explicit limits in code (managed by plan)
- **Gemini AI:** No explicit limits (managed by API key quota)
- **Recommendation:** Add rate limiting middleware for production

### Caching Strategy
- **30-Day TTL:** Reduces API calls by ~70-90% (estimated)
- **Batch Cache Checks:** Single query for multiple profiles
- **Image Proxy:** 24-hour browser cache reduces bandwidth

### Frontend Performance
- **Server Components:** Used where possible for better performance
- **Lazy Loading:** Images loaded on-demand
- **Skeleton Loaders:** Perceived performance improvement
- **3D Graphics:** Limited to homepage only

---

## Security Considerations

### API Key Security
- All keys server-side only
- Never exposed to frontend
- Environment variables in Vercel (not in code)

### Data Privacy
- No personal data stored beyond LinkedIn public profiles
- GDPR consideration: Profiles are public information
- No user authentication/tracking (yet)

### CORS & CSP
- Image proxy prevents CORS issues
- Next.js default CSP settings
- No inline scripts

### SQL Injection
- Prisma ORM prevents SQL injection
- All queries parameterized
- No raw SQL queries

---

## Known Issues & Limitations

### Current Limitations
1. **No Authentication** - All endpoints are public
2. **No Rate Limiting** - Vulnerable to abuse
3. **No Analytics** - PostHog installed but not implemented
4. **Search Model Unused** - Logs created but not displayed in UI
5. **No Error Retry Logic** - API failures don't auto-retry
6. **Fixed Cache TTL** - No manual cache invalidation

### Future Enhancements
- [ ] Add user authentication (NextAuth.js)
- [ ] Implement rate limiting (Upstash Redis)
- [ ] Analytics dashboard with search history
- [ ] Manual cache refresh button
- [ ] Export profiles to CSV/JSON
- [ ] Advanced filters (location, company, years of experience)
- [ ] Save searches functionality
- [ ] Email alerts for new matching profiles

---

## Git Workflow

**Current Branch:** `main`
**Main Branch:** `main`

**Recent Commits:**
```
caeb9f8 - add individual pepole search (latest)
f621cc9 - fix parser
7d517c1 - fix build errors
7fa661d - ui improvements
669084c - initial commit
```

**Modified Files (Uncommitted):**
```
M .env.example
```

---

## Support & Resources

### Documentation
- **Next.js:** https://nextjs.org/docs
- **Prisma:** https://www.prisma.io/docs
- **Bright Data:** https://docs.brightdata.com
- **Gemini AI:** https://ai.google.dev/docs
- **shadcn/ui:** https://ui.shadcn.com

### External Services
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Bright Data Dashboard:** https://brightdata.com/cp
- **Google AI Studio:** https://aistudio.google.com

---

## Appendix: Complete File Tree

```
/Users/meirk/Desktop/programming/pepolehub/
├── .env.example
├── .gitignore
├── components.json
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── PROJECT.MD (this file)
├── tsconfig.json
│
├── prisma/
│   └── schema.prisma
│
├── public/
│   ├── file.svg
│   ├── globe.svg
│   ├── logo.png
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
│
└── src/
    ├── app/
    │   ├── api/
    │   │   ├── proxy-image/
    │   │   │   └── route.ts
    │   │   ├── profiles/
    │   │   │   └── recent/
    │   │   │       └── route.ts
    │   │   └── search/
    │   │       └── route.ts
    │   ├── previous/
    │   │   └── page.tsx
    │   ├── search/
    │   │   └── page.tsx
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    │
    ├── components/
    │   ├── ui/
    │   │   ├── avatar.tsx
    │   │   ├── badge.tsx
    │   │   ├── button.tsx
    │   │   ├── card.tsx
    │   │   ├── collapsible.tsx
    │   │   ├── input.tsx
    │   │   ├── navigation-menu.tsx
    │   │   ├── separator.tsx
    │   │   └── skeleton.tsx
    │   ├── FloatingOrbs.tsx
    │   ├── LoadingState.tsx
    │   ├── Navigation.tsx
    │   ├── PersonCard.tsx
    │   └── SearchBar.tsx
    │
    ├── lib/
    │   ├── brightdata/
    │   │   ├── client.ts
    │   │   ├── linkedin.ts
    │   │   └── search.ts
    │   ├── cache/
    │   │   └── index.ts
    │   ├── search/
    │   │   └── parser.ts
    │   ├── prisma.ts
    │   └── utils.ts
    │
    ├── tests/
    │   ├── test-cache.ts
    │   ├── test-linkedin.ts
    │   ├── test-parser.ts
    │   ├── test-recent-api.ts
    │   └── test-search-flow.ts
    │
    └── types/
        └── linkedin.ts
```

---

**End of Documentation**

This PROJECT.MD file provides a complete map of the PeopleHub codebase. Use this as your reference for understanding the architecture, making changes, and implementing new features. Every file, function, and data flow has been documented with its exact location and purpose.

For any new task, refer to the relevant section above to understand:
1. **Where** the code is located
2. **How** it works with other parts of the system
3. **What** dependencies and data flows are involved
4. **Why** design decisions were made

Happy coding! 🚀
