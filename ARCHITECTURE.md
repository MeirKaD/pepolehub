# PeopleHub - Architecture & Component Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 15)                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Home Page (3D Animations)  │  Search Results  │  Previous   │   │
│  │  FloatingOrbs Component      │  PersonCard      │  Searches   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
              ┌─────▼─────┐  ┌────▼────┐  ┌─────▼──────┐
              │  Search   │  │ Recent  │  │Image Proxy │
              │  API      │  │Profiles │  │  API       │
              │  POST     │  │  GET    │  │  GET       │
              └─────┬─────┘  └────┬────┘  └─────┬──────┘
                    │             │             │
        ┌───────────┴─────┬───────┴─┐         │
        │                 │         │         │
   ┌────▼─────┐    ┌─────▼──┐  ┌──▼────┐    │
   │  Query   │    │ Cache  │  │Prisma │    │
   │  Parser  │    │ Check  │  │Client │────┤
   │ (Gemini) │    └────────┘  └───────┘    │
   └────┬─────┘                             │
        │                                   │
   ┌────▼──────────────────────────────┐   │
   │  Bright Data Google Search API    │   │
   │  searchGoogle() / findLinkedIn()   │   │
   └────┬──────────────────────────────┘   │
        │                                   │
   ┌────▼──────────────────────────────┐   │
   │  Bright Data LinkedIn Scraper      │   │
   │  fetchLinkedInProfiles()           │   │
   └────┬──────────────────────────────┘   │
        │                                   │
        │         ┌──────────────────┐     │
        └────────►│  Supabase        │◄────┘
                  │  PostgreSQL DB   │
                  └──────────────────┘
```

---

## Service Layer Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Service Layer                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Bright Data Integration Layer                             │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │                                                            │ │
│  │  ┌──────────────┐    ┌──────────────┐   ┌──────────────┐ │ │
│  │  │  MCP Client  │    │Google Search │   │LinkedIn      │ │ │
│  │  │  (client.ts) │    │(search.ts)   │   │Scraper       │ │ │
│  │  │              │    │              │   │(linkedin.ts) │ │ │
│  │  │- Singleton   │    │- searchGoogle│   │              │ │ │
│  │  │- Connection  │    │- extractURLs │   │- Trigger Job │ │ │
│  │  │  Pooling     │    │- Geolocation │   │- Poll Status │ │ │
│  │  │- Auth        │    │- URL Cleanup │   │- Transform   │ │ │
│  │  └──────────────┘    └──────────────┘   └──────────────┘ │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  AI Query Parser Layer                                     │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │                                                            │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │  Query Parser (parser.ts)                          │  │ │
│  │  │                                                    │  │ │
│  │  │  - parseSearchQuery(query: string)                │  │ │
│  │  │  - Gemini 2.0 Flash model                         │  │ │
│  │  │  - Zod schema validation                          │  │ │
│  │  │  - Job/Individual detection                       │  │ │
│  │  │  - Geolocation extraction                         │  │ │
│  │  │  - Google query generation                        │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Caching Layer                                             │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  Database Cache (cache/index.ts)                    │ │ │
│  │  │                                                      │ │ │
│  │  │  - getCachedProfile(url)                            │ │ │
│  │  │  - getCachedProfiles(urls[])       [Batch Optimized]│ │ │
│  │  │  - saveProfile(data)               [Upsert]        │ │ │
│  │  │  - Freshness validation (30 days)                  │ │ │
│  │  │  - LinkedIn ID extraction                          │ │ │
│  │  │  - Metadata tracking (searchCount, lastViewed)     │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Database Layer                                            │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │                                                            │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │  Prisma Client (prisma.ts)                        │  │ │
│  │  │                                                    │  │ │
│  │  │  - Singleton instance                             │  │ │
│  │  │  - Connection pooling                             │  │ │
│  │  │  - Query logging (dev) / error logging (prod)    │  │ │
│  │  │  - Supabase PostgreSQL connection                │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Utilities Layer                                           │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │                                                            │ │
│  │  ┌──────────────────────┐        ┌─────────────────────┐ │ │
│  │  │  cn() - Tailwind CSS │        │  Shared Functions   │ │ │
│  │  │  class merging       │        │  (Consolidation     │ │ │
│  │  └──────────────────────┘        │   Recommended)      │ │ │
│  │                                  │                     │ │ │
│  │                                  │  - extractLinkedInId│ │ │
│  │                                  │  - validateURL      │ │ │
│  │                                  │  - normalizeURL     │ │ │
│  │                                  │  - getApiHeaders    │ │ │
│  │                                  │  - transformProfile │ │ │
│  │                                  └─────────────────────┘ │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Complete Search Pipeline

```
User Query: "5 AI Engineers in Israel"
    │
    ▼
┌─────────────────────────────────────────┐
│ POST /api/search                        │
│ Input Validation (2-100 chars)          │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ parseSearchQuery() [Gemini]             │
│ - Detects: Job search (not individual)  │
│ - Extracts: count=5                     │
│ - Extracts: role="AI Engineer"          │
│ - Extracts: location="Israel"           │
│ - Sets: countryCode="IL"                │
│ - Generates: googleQuery=                │
│   'site:linkedin.com/in "AI Engineer"   │
│    "Israel"'                            │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ findLinkedInProfiles() [Bright Data]    │
│ 1. searchGoogle(query, page=0, IL)      │
│    - Calls Bright Data API              │
│    - Gets ~10-15 organic results        │
│ 2. extractLinkedInUrls()                │
│    - Validates URL format (/in/)        │
│    - Normalizes URLs                    │
│    - Returns 5 LinkedIn URLs            │
└────────────┬────────────────────────────┘
             │
             ▼ [5 LinkedIn URLs]
┌─────────────────────────────────────────┐
│ getCachedProfiles() [Database]          │
│ 1. Extract LinkedIn IDs from URLs       │
│ 2. Batch query: WHERE linkedinId IN (...│
│ 3. Check freshness for each:            │
│    - age = (now - updatedAt) / (ms/day) │
│    - age < 30 days → include            │
│    - age >= 30 days → skip              │
│ Returns: 3 cached profiles              │
└────────────┬────────────────────────────┘
             │
             ├─ Cached: 3 profiles ──┐
             │                       │
             ├─ Uncached: 2 URLs ─┐  │
             │                    │  │
             ▼                    │  │
┌──────────────────────────────┐  │  │
│fetchLinkedInProfiles()       │  │  │
│[Bright Data LinkedIn Scraper]│  │  │
│ 1. triggerLinkedInScrape()   │  │  │
│    - POST to dataset API      │  │  │
│    - Gets snapshot ID         │  │  │
│ 2. pollForSnapshot()          │  │  │
│    - GET snapshot status      │  │  │
│    - Waits up to 10 minutes   │  │  │
│    - Retries every 1 second   │  │  │
│ 3. Transform to ProfileData   │  │  │
│    Returns: 2 profiles        │  │  │
│                               │  │  │
│ ┌─────────────────────────┐  │  │  │
│ │ Bright Data API         │  │  │  │
│ │ Endpoints Used:         │  │  │  │
│ │ - /datasets/v3/trigger  │  │  │  │
│ │ - /datasets/v3/snapshot │  │  │  │
│ └─────────────────────────┘  │  │  │
└──────────────┬───────────────┘  │  │
               │                  │  │
               ▼ [2 profiles]      │  │
┌──────────────────────────────┐  │  │
│ saveProfile() x2             │  │  │
│ For each fetched profile:    │  │  │
│ - Upsert into database       │  │  │
│ - Increment searchCount      │  │  │
│ - Update lastViewed          │  │  │
│ - Transform nested JSON      │  │  │
└──────────────┬───────────────┘  │  │
               │                  │  │
               ▼                  ◄──┤
┌──────────────────────────────┐  ◄──┘
│ Combine Results              │
│ - Cached: 3 profiles         │
│ - Fetched: 2 profiles        │
│ - Total: 5 profiles          │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Response to Client           │
│ {                            │
│   success: true,             │
│   count: 5,                  │
│   profiles: [...],           │
│   cached: 3,                 │
│   fetched: 2                 │
│ }                            │
└──────────────┬───────────────┘
               │
               ▼
     Frontend Renders
     PersonCard Components
```

---

## Database Schema (Prisma)

```
┌──────────────────────────────────────────────────────────────┐
│                    Person Model                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ PRIMARY KEY:                                                │
│ ├─ id (CUID)                                                │
│                                                              │
│ UNIQUE CONSTRAINTS:                                         │
│ ├─ linkedinUrl (URL variants must be deduplicated)         │
│ └─ linkedinId (LinkedIn username)                          │
│                                                              │
│ BASIC INFO:                                                │
│ ├─ firstName (required)                                     │
│ ├─ lastName (required)                                      │
│ ├─ fullName (required, indexed)                            │
│ ├─ headline (optional, Text)                               │
│ └─ about (optional, Text)                                  │
│                                                              │
│ IDENTIFIERS:                                               │
│ ├─ linkedinNumId (numeric ID)                              │
│ └─ linkedinId (username, indexed)                          │
│                                                              │
│ LOCATION:                                                  │
│ ├─ location (general, indexed)                             │
│ ├─ city                                                     │
│ └─ countryCode (ISO 2-letter)                              │
│                                                              │
│ MEDIA:                                                     │
│ ├─ profilePicUrl (avatar)                                  │
│ ├─ bannerImage (header)                                    │
│ └─ defaultAvatar (boolean flag)                            │
│                                                              │
│ CURRENT ROLE:                                              │
│ ├─ currentCompany (company name)                           │
│ └─ currentCompanyId (LinkedIn company ID)                  │
│                                                              │
│ RICH DATA (JSON):                                          │
│ ├─ experience (Experience[] - jobs)                        │
│ ├─ education (Education[] - schools)                       │
│ └─ languages (Language[] - spoken languages)               │
│                                                              │
│ SOCIAL METRICS:                                            │
│ ├─ connections (follower count)                            │
│ └─ followers (follower count)                              │
│                                                              │
│ ANALYTICS:                                                 │
│ ├─ searchCount (incremented each fetch, indexed)          │
│ └─ lastViewed (timestamp, indexed)                         │
│                                                              │
│ METADATA:                                                  │
│ ├─ createdAt (timestamp)                                   │
│ ├─ updatedAt (timestamp, indexed)                          │
│ └─ memorializedAccount (boolean flag)                      │
│                                                              │
│ INDEXES:                                                   │
│ ├─ fullName                                                │
│ ├─ (firstName, lastName)                                   │
│ ├─ lastViewed                                              │
│ ├─ linkedinId (unique)                                     │
│ ├─ currentCompany                                          │
│ ├─ location                                                │
│ └─ updatedAt                                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────┐
│                   Search Model (Optional)                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ PRIMARY KEY:                                                │
│ ├─ id (CUID)                                                │
│                                                              │
│ DATA:                                                       │
│ ├─ query (Text - the search string, indexed)              │
│ ├─ results (JSON - array of person IDs)                    │
│ ├─ resultCount (number of results)                         │
│                                                              │
│ METADATA:                                                  │
│ └─ createdAt (timestamp)                                   │
│                                                              │
│ INDEXES:                                                   │
│ └─ query (for finding search history)                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## API Endpoint Specifications

### 1. POST /api/search

```
Request:
  Content-Type: application/json
  Body: {
    query: "5 AI Engineers in Israel"  // 2-100 characters
  }

Response: 200 OK
  {
    "success": true,
    "count": 5,
    "cached": 3,           // From database cache
    "fetched": 2,          // Newly scraped
    "profiles": [
      {
        "linkedinUrl": "https://www.linkedin.com/in/...",
        "linkedinId": "meir-kadosh-7bb5b7224",
        "linkedinNumId": "123456789",
        "firstName": "Meir",
        "lastName": "Kadosh",
        "fullName": "Meir Kadosh",
        "headline": "AI Engineer at TechCorp",
        "about": "...",
        "location": "Israel",
        "city": "Tel Aviv",
        "countryCode": "IL",
        "profilePicUrl": "https://...",
        "bannerImage": "https://...",
        "defaultAvatar": false,
        "currentCompany": "TechCorp",
        "currentCompanyId": "12345",
        "experience": [{
          "company": "TechCorp",
          "title": "AI Engineer",
          "duration": "2 years",
          "description_html": "..."
        }],
        "education": [{
          "title": "B.S. Computer Science",
          "institute_logo_url": "https://...",
          "start_year": "2015",
          "end_year": "2019"
        }],
        "languages": [{
          "title": "Hebrew",
          "subtitle": "Native"
        }],
        "connections": 500,
        "followers": 150,
        "memorializedAccount": false
      },
      ...
    ]
  }

Error Responses:
  400 Bad Request: Invalid query (< 2 or > 100 chars)
  500 Internal Server Error: Search failed
```

### 2. GET /api/profiles/recent

```
Request:
  Query Parameters:
    ?limit=50        // 1-100, default 50
    ?before=<ISO>    // Pagination: profiles before timestamp
    ?after=<ISO>     // Auto-refresh: profiles after timestamp

Response: 200 OK
  Headers:
    X-Total-Count: 250  // Total cached profiles in database
  
  Body: {
    "success": true,
    "count": 25,
    "profiles": [
      {
        ...ProfileData,
        "updatedAt": "2025-10-25T20:40:00.000Z"
      },
      ...
    ]
  }

Error Responses:
  400 Bad Request: Invalid limit or timestamp
  500 Internal Server Error: Database error
```

### 3. GET /api/proxy-image

```
Request:
  Query Parameters:
    ?url=https://media.licdn.com/...  // Image URL to proxy

Response: 200 OK
  Content-Type: image/jpeg (or original type)
  Cache-Control: public, max-age=86400
  Body: Binary image data

Error Responses:
  400 Bad Request: Missing URL parameter
  404 Not Found: Image not found
  500 Internal Server Error: Fetch failed
```

---

## Third-Party API Integration Points

### Bright Data API

```
1. Google Search (search.ts)
   ├─ Method: POST
   ├─ URL: https://api.brightdata.com/request
   ├─ Auth: Bearer <token>
   ├─ Payload: {
   │   "url": "https://www.google.com/search?q=...&brd_json=1&gl=IL",
   │   "zone": "unblocker",
   │   "format": "raw"
   │ }
   └─ Response: {
       "organic": [{ title, link, snippet }],
       "images": [...],
       "pagination": { current_page },
       "related": [...]
     }

2. LinkedIn Trigger (linkedin.ts)
   ├─ Method: POST
   ├─ URL: https://api.brightdata.com/datasets/v3/trigger
   ├─ Auth: Bearer <token>
   ├─ Params: dataset_id=gd_l1viktl72bvl7bjuj0&include_errors=true
   ├─ Payload: [{ url: "https://linkedin.com/in/..." }]
   └─ Response: { snapshot_id: "snap_..." }

3. LinkedIn Poll (linkedin.ts)
   ├─ Method: GET
   ├─ URL: https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}
   ├─ Auth: Bearer <token>
   ├─ Params: format=json
   ├─ Polling: Every 1 second, max 600 attempts (10 minutes)
   └─ Response: [
       {
         "id": "...",
         "name": "Meir Kadosh",
         "first_name": "Meir",
         "last_name": "Kadosh",
         "position": "AI Engineer",
         "avatar": "https://...",
         "experience": [...],
         "education": [...],
         ...
       }
     ]

4. MCP Server (client.ts)
   ├─ Method: HTTP + MCP Protocol
   ├─ URL: https://mcp.brightdata.com/mcp?token=<token>&pro=1
   ├─ Transport: StreamableHTTPClientTransport
   └─ Features: Tool discovery, async operations
```

### Google Gemini API

```
Query Parsing (parser.ts)
├─ Model: gemini-2.0-flash-exp
├─ Framework: Vercel AI SDK (generateObject)
├─ Auth: GOOGLE_GENERATIVE_AI_API_KEY
├─ Input: Natural language query
├─ Schema: Zod validation
└─ Output: {
    count: 5,
    role: "AI Engineer",
    location: "Israel",
    countryCode: "IL",
    keywords: ["Python"],
    googleQuery: 'site:linkedin.com/in "AI Engineer" "Israel"'
  }
```

### Supabase PostgreSQL

```
Connection (prisma.ts)
├─ Provider: PostgreSQL
├─ URL: Connection Pooling endpoint
├─ Auth: User credentials in connection string
├─ SSL: Required
├─ Models: Person, Search
└─ Features:
    - 8 indexes for query optimization
    - JSON fields for rich data
    - Timestamps for cache invalidation
```

---

## Performance Metrics

### Caching Effectiveness

```
Scenario: Searching for "5 AI Engineers in Israel" twice

First Search:
├─ Parse query: ~500ms (Gemini API)
├─ Google search: ~2s (Bright Data)
├─ Cache check: ~50ms (DB query)
├─ Fetch 5 profiles: ~120s (10-minute timeout, ~24s per profile)
└─ Total: ~120 seconds (bottleneck: LinkedIn scraping)

Second Search (Same Query):
├─ Parse query: ~500ms
├─ Google search: ~2s
├─ Cache check: ~50ms (All 5 found in cache)
└─ Total: ~2.5 seconds (No need to fetch!)
└─ Savings: 117.5 seconds (98.9% reduction!)
```

### Database Query Optimization

```
getCachedProfiles() Performance:
├─ Batch Query: O(n) where n = number of URLs
├─ Index: linkedinId (unique, indexed)
├─ Single SQL query: SELECT * FROM people WHERE linkedinId IN (...)
├─ Freshness check: O(n) in-memory calculation
└─ Time for 100 profiles: ~10-50ms (depending on DB load)
```

### Rate Limiting Considerations

```
Bright Data:
├─ Google search: Per-account quotas (varies by plan)
├─ LinkedIn scraping: Per-account quotas (varies by plan)
└─ Recommendation: Implement client-side rate limiting

Gemini:
├─ Requests per minute: Depends on tier
└─ Recommendation: Cache parsed queries when possible

Supabase:
├─ Connection pooling: Supports ~100 concurrent connections
├─ Query rate: Unlimited
└─ No external rate limiting issues
```

---

## Error Recovery & Resilience

### Graceful Degradation

```
Scenario: LinkedIn scraping fails for 2 out of 5 profiles

Result:
├─ Return 3 cached profiles immediately
├─ Attempt to fetch 2 uncached profiles
├─ If fetch fails: Catch error, log it
├─ Return: 3 profiles (partial success)
├─ Response: 200 OK with reduced count
└─ User Experience: Gets results instead of blank page
```

### Retry Strategy

```
LinkedIn Polling (10+ minute timeout):
├─ Initial attempt: Trigger job
├─ Polling loop:
│  ├─ Check status every 1 second
│  ├─ Max 600 attempts (10 minutes)
│  ├─ On error: Retry same attempt
│  └─ On timeout: Throw error
└─ Recovery: Return cached data if available
```

---

## Security Architecture

```
┌─────────────────────────────────────────┐
│     Environment Variables (Server)      │
├─────────────────────────────────────────┤
│                                         │
│ BRIGHTDATA_API_TOKEN                   │
│ GOOGLE_GENERATIVE_AI_API_KEY            │
│ DATABASE_URL (with credentials)         │
│ BRIGHTDATA_UNLOCKER_ZONE                │
│                                         │
│ NOT EXPOSED TO FRONTEND                │
│ (Next.js hides these by default)        │
│                                         │
└─────────────────────────────────────────┘
         │
         │ Loaded via process.env
         │
         ▼
┌─────────────────────────────────────────┐
│      API Route Handlers (Server)        │
├─────────────────────────────────────────┤
│                                         │
│ /api/search                             │
│ /api/profiles/recent                    │
│ /api/proxy-image                        │
│                                         │
│ All keys validated at handler start    │
│ Error thrown if key missing            │
│                                         │
└─────────────────────────────────────────┘
         │
         │ Auth headers added
         │
         ▼
┌─────────────────────────────────────────┐
│    Third-Party APIs (External)          │
├─────────────────────────────────────────┤
│                                         │
│ Bright Data: Bearer token in header    │
│ Gemini: API key in SDK config          │
│ Supabase: Connection string only       │
│                                         │
│ No keys ever sent to frontend          │
│ No CORS issues (server → server)       │
│                                         │
└─────────────────────────────────────────┘
         │
         │ Only public data returned
         │
         ▼
┌─────────────────────────────────────────┐
│      Frontend (Client-Side)             │
├─────────────────────────────────────────┤
│                                         │
│ React Components                        │
│ Only receives ProfileData               │
│ No API keys, no sensitive info          │
│                                         │
└─────────────────────────────────────────┘
```

---

## Deployment Architecture

```
Development (npm run dev):
├─ Next.js dev server on localhost:3000
├─ Hot reload enabled
├─ Full logging (queries + errors)
└─ Connected to: Supabase (shared DB)

Production (Vercel, AWS Lambda, etc.):
├─ Serverless functions: /api/* endpoints
├─ Static export: Homepage, search results
├─ Environment variables: Set per deployment
├─ Connection pooling: Required for serverless
├─ Logging: Errors only (performance)
└─ Connected to: Supabase (shared DB)

Database (Supabase PostgreSQL):
├─ Shared by dev + production
├─ Connection pooling: Required
├─ Backups: Automatic
└─ Schema: Managed by Prisma migrations
```

