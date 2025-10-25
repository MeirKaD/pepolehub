# PeopleHub - Complete Services & Utilities Mapping

## Executive Summary

PeopleHub is a LinkedIn people search engine powered by AI and real-time data scraping. The architecture consists of:

1. **Three-tier search pipeline**: Natural language → AI parsing → Google search → LinkedIn scraping
2. **Smart caching layer**: 30-day profile caching with database persistence
3. **Third-party integrations**: Bright Data (scraping), Google Gemini (AI parsing), Supabase (database)
4. **RESTful API endpoints**: Search, profiles, image proxy
5. **Frontend**: Next.js with 3D animations and expandable profile cards

---

## SERVICE ARCHITECTURE

### 1. BRIGHT DATA INTEGRATION

#### 1.1 Bright Data Client (Connection Management)
**File**: `/src/lib/brightdata/client.ts`

**Purpose**: Manages MCP (Model Context Protocol) client initialization and pooling

**Key Functions**:
- `getBrightDataClient()` - Get or create singleton MCP client with connection pooling
  - Environment variable: `BRIGHTDATA_API_TOKEN`
  - Creates StreamableHTTPClientTransport with authenticated URL
  - Returns cached instance to avoid multiple connections
  
- `getBrightDataTools()` - Retrieve available tools from Bright Data MCP server
  
- `closeBrightDataClient()` - Clean up MCP client connection for resource cleanup

**Authentication**: Bearer token via `BRIGHTDATA_API_TOKEN` environment variable

**Implementation Details**:
- Singleton pattern for connection pooling
- StreamableHTTPClientTransport for real-time data
- Lazy initialization (only creates when first requested)

---

#### 1.2 Bright Data Google Search API
**File**: `/src/lib/brightdata/search.ts`

**Purpose**: Execute Google searches and extract LinkedIn profile URLs

**Key Functions**:

1. `searchGoogle(query: string, page?: number, countryCode?: string)`
   - Executes Google search via Bright Data API
   - Parameters:
     - `query`: Google search query (e.g., 'site:linkedin.com/in "AI Engineer" "Israel"')
     - `page`: 0-indexed page number for pagination
     - `countryCode`: Optional 2-letter ISO code (IL, US, GB, etc.) for geolocation
   - Returns: `GoogleSearchResponse` with organic results, images, related queries
   - Uses zone: `BRIGHTDATA_UNLOCKER_ZONE` (default: "unblocker")
   - Response format: JSON via `brd_json=1` parameter

2. `extractLinkedInUrls(results: GoogleSearchResponse)`
   - Filters search results to only valid LinkedIn profile URLs
   - Validates URLs match pattern: `/in/username`
   - Normalizes URLs (removes query params, ensures consistent format)
   - Returns: Array of clean LinkedIn URLs

3. `findLinkedInProfiles(query: string, maxResults?: number, countryCode?: string)`
   - High-level function combining search + extract
   - Limits results to requested count
   - Returns: Array of LinkedIn profile URLs ready for scraping

**Helper Functions**:
- `buildGoogleSearchUrl()` - Constructs search URL with geolocation support
- `getApiHeaders()` - Prepares authentication headers
- `isValidLinkedInProfileUrl()` - Validates LinkedIn URL format
- `normalizeLinkedInUrl()` - Removes query params and hash fragments

**API Details**:
- Endpoint: `https://api.brightdata.com/request` (POST)
- Headers: Bearer token + Content-Type: application/json
- Payload: `{ url, zone, format: "raw" }`

---

#### 1.3 Bright Data LinkedIn Scraping API
**File**: `/src/lib/brightdata/linkedin.ts`

**Purpose**: Fetch complete LinkedIn profile data using Bright Data's dataset API

**Key Functions**:

1. `fetchLinkedInProfile(url: string)`
   - Scrapes a single LinkedIn profile
   - Triggers async job → polls for completion → transforms data
   - Validates profile availability (checks for private/hidden warnings)
   - Returns: `ProfileData` (database-ready format)
   - Timeout: 600 seconds (10 minutes) with 1-second polling intervals

2. `fetchLinkedInProfiles(urls: string[])`
   - Batch scraping operation for multiple profiles
   - Single API call triggers scrape for all URLs
   - Optimized for bulk operations
   - Returns: Array of `ProfileData` objects

**Implementation Details**:

**Job Trigger**:
- Endpoint: `https://api.brightdata.com/datasets/v3/trigger` (POST)
- Dataset ID: `gd_l1viktl72bvl7bjuj0` (LinkedIn profiles)
- Payload: Array of `{ url }` objects

**Polling**:
- Endpoint: `https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}?format=json` (GET)
- Status states: `running` | `building` | `ready` | `failed`
- Max polling attempts: 600 (10 minutes)
- Interval: 1 second
- Detects private/hidden profiles via `warning` or `warning_code` fields

**Data Transformation**:
- Maps Bright Data response fields to `ProfileData` interface
- Field mapping examples:
  - `first_name` → `firstName`
  - `last_name` → `lastName`
  - `position` → `headline`
  - `avatar` → `profilePicUrl`
  - `banner_image` → `bannerImage`
  - JSON arrays: `experience`, `education`, `languages`

**Error Handling**:
- Throws for API failures (non-2xx responses)
- Throws for missing snapshot ID
- Throws for timeout (600 attempts exceeded)
- Throws for private/hidden profiles

---

### 2. GOOGLE GEMINI AI QUERY PARSING

**File**: `/src/lib/search/parser.ts`

**Purpose**: Transform natural language search queries into structured, optimized Google search strings

**Key Function**: `parseSearchQuery(query: string)`

**LLM Configuration**:
- Model: Google Gemini 2.0 Flash (`gemini-2.0-flash-exp`)
- API Key: `GOOGLE_GENERATIVE_AI_API_KEY`
- Framework: Vercel AI SDK (`generateObject`)
- Schema Validation: Zod

**Input/Output**:

**Parsed Search Query Output**:
```typescript
interface ParsedSearchQuery {
  count: number;           // 1-50 profiles to find
  role: string | null;     // Job title (null for individual searches)
  location?: string | null; // Geographic location or company name
  countryCode?: string;    // 2-letter ISO code (only if location is geographic)
  keywords: string[];      // Additional qualifications/skills
  googleQuery: string;     // Optimized Google search query
}
```

**Query Type Detection**:

1. **Job/Role Searches** (e.g., "5 AI Engineers in Israel")
   - Extracts: count, role, location, keywords
   - Sets countryCode from geographic location
   - Generates: `site:linkedin.com/in "AI Engineer" "Israel" Python`

2. **Individual Name Searches** (e.g., "John Doe", "Elon Musk")
   - Sets: count=1, role=null, location=null, countryCode=null
   - Adds person's name to keywords
   - Generates: `site:linkedin.com/in "John Doe"`

**Zod Schema Validation**:
- `count`: number (1-50) - number of profiles to find
- `role`: string | null - job title or role
- `location`: string | null - geographic or company location
- `countryCode`: string (2 letters) | null - ISO country code
- `keywords`: string[] - additional qualifications
- `googleQuery`: string - optimized Google search query

**Prompt Engineering**:
- Handles flexible query interpretation
- Defaults to 10 results if count not specified
- Prioritizes working search over strict schema adherence
- Distinguishes company names from geographic locations
- Returns country code only for actual geographic locations

**Error Handling**:
- Throws if API key not set
- Throws for API errors with descriptive messages
- Logs parsed results for debugging

---

### 3. CACHING LAYER (Database-Level Cache)

**File**: `/src/lib/cache/index.ts`

**Purpose**: Implement intelligent profile caching with freshness validation

**Cache Configuration**:
- Freshness window: 30 days
- Storage: Supabase PostgreSQL via Prisma
- Lookup key: LinkedIn ID (username)

**Key Functions**:

1. `getCachedProfile(url: string)`
   - Single profile lookup
   - Validates freshness (< 30 days old)
   - Returns: `ProfileData | null`
   - Handles URL normalization (regional variants)

2. `getCachedProfiles(urls: string[])`
   - Batch profile lookup (single DB query)
   - Filters to only fresh profiles
   - Returns: `Record<linkedinId, ProfileData>` mapping
   - Logs cache hit/miss statistics

3. `saveProfile(data: ProfileData)`
   - Upsert operation (insert or update)
   - Increments `searchCount` on updates
   - Updates `lastViewed` timestamp
   - Transforms nested JSON (experience, education, languages)
   - Returns: Saved profile data

**Caching Strategy**:

**Cache Hit Logic**:
```
1. Extract LinkedIn ID from URL
2. Query database for person record
3. If found, check age: (now - updatedAt) / (1000 * 60 * 60 * 24)
4. If age < 30 days → cache hit
5. If age >= 30 days → cache miss (stale)
```

**Metadata Tracking**:
- `searchCount`: Incremented each time profile is viewed/saved
- `lastViewed`: Updated timestamp for recent profiles
- `updatedAt`: Track when profile data was last refreshed

**Helper Function**:
- `extractLinkedInId(url)` - Parses LinkedIn ID from any region variant

---

### 4. PRISMA DATABASE LAYER

**File**: `/src/lib/prisma.ts`

**Purpose**: Singleton Prisma Client with connection pooling and logging

**Key Export**:
- `prisma` - Shared PrismaClient instance

**Features**:
- Singleton pattern (one instance per app)
- Connection pooling via Supabase
- Development logging: `['query', 'error', 'warn']`
- Production logging: `['error']` only

**Environment Variable**:
- `DATABASE_URL`: Supabase PostgreSQL connection string (must use Connection Pooling for serverless)

**Logging Configuration**:
- Development: Logs all queries for debugging
- Production: Logs only errors for performance

---

### 5. UTILITY HELPERS

**File**: `/src/lib/utils.ts`

**Purpose**: Common utility functions for styling and component composition

**Key Functions**:

1. `cn(...inputs: ClassValue[])`
   - Merges Tailwind CSS and clsx classes intelligently
   - Prevents style conflicts using `tailwind-merge`
   - Used throughout UI components for conditional styling
   - Example: `cn("px-4", disabled && "opacity-50")`

**Dependencies**:
- `clsx`: Conditional class name builder
- `tailwind-merge`: Tailwind CSS class conflict resolver

---

## API ENDPOINTS ARCHITECTURE

### 1. POST /api/search

**File**: `/src/app/api/search/route.ts`

**Purpose**: Main search pipeline endpoint

**Request Body**:
```json
{
  "query": "5 AI Engineers in Israel"
}
```

**Validation**:
- Query: 2-100 characters
- Non-empty string check

**Processing Pipeline**:

```
1. Parse Query → Get ParsedSearchQuery (count, role, location, countryCode, googleQuery)
2. Find LinkedIn URLs → Use findLinkedInProfiles() with optimized google query
3. Batch Cache Check → getCachedProfiles() for all found URLs
4. Separate Results → Split into cached vs uncached URLs
5. Batch Fetch New → fetchLinkedInProfiles() for uncached URLs
6. Save New Profiles → saveProfile() for each fetched profile
7. Combine Results → Return all profiles (cached + newly fetched)
```

**Response**:
```json
{
  "success": true,
  "count": 5,
  "profiles": [ProfileData, ...],
  "cached": 3,
  "fetched": 2
}
```

**Error Handling**:
- Returns 400 for invalid query
- Returns 500 for search failures
- Partial success: returns cached profiles even if fetch fails

**Performance Optimization**:
- Batch database queries
- Reuses cached data to avoid redundant API calls
- Logs cache hit/miss statistics

---

### 2. GET /api/profiles/recent

**File**: `/src/app/api/profiles/recent/route.ts`

**Purpose**: Fetch recently viewed/updated profiles with pagination support

**Query Parameters**:
- `limit`: Number of profiles (default: 50, max: 100)
- `before`: ISO timestamp - profiles updated before this time
- `after`: ISO timestamp - profiles updated after this time

**Response Headers**:
- `X-Total-Count`: Total number of cached profiles in database

**Response**:
```json
{
  "success": true,
  "count": 25,
  "profiles": [
    {
      ...ProfileData,
      "updatedAt": "2025-10-25T20:40:00.000Z"
    }
  ]
}
```

**Database Query**:
- Sorts by `updatedAt DESC` (newest first)
- Supports timestamp-based pagination
- Supports auto-refresh filtering (fetch new profiles since last check)

---

### 3. GET /api/proxy-image

**File**: `/src/app/api/proxy-image/route.ts`

**Purpose**: Proxy external images (LinkedIn avatars) with CORS bypass and caching

**Query Parameters**:
- `url`: Image URL to proxy (required)

**Features**:
- CORS bypass: Direct fetch from server-side
- User-Agent spoofing: Prevents LinkedIn request blocking
- Response caching: 24-hour cache-control header
- Content-Type preservation: Maintains original image format
- Error handling: Returns appropriate HTTP status codes

**Response**:
- Content-Type: Original image type (jpeg, png, etc.)
- Cache-Control: `public, max-age=86400` (24 hours)
- Body: Raw image binary data

---

## TYPE DEFINITIONS

**File**: `/src/types/linkedin.ts`

**Purpose**: Define data structures matching Bright Data LinkedIn API response

### Key Types:

1. **BrightDataLinkedInResponse** (Raw API response)
   - Basic info: `id`, `name`, `first_name`, `last_name`
   - Location: `city`, `country_code`, `location`
   - Professional: `position`, `current_company`, `experience[]`, `education[]`
   - Media: `avatar`, `banner_image`, `default_avatar`
   - Social: `followers`, `connections`, `recommendations_count`
   - Rich data: `activity[]`, `honors_and_awards[]`, `languages[]`
   - Identifiers: `linkedin_id` (username), `linkedin_num_id` (numeric ID)

2. **ProfileData** (Database-stored format)
   - Simplified version of BrightDataLinkedInResponse
   - All optional fields except: linkedinUrl, linkedinId, firstName, lastName, fullName
   - Matches Prisma schema exactly

3. **Supporting Types**:
   - `Experience`: Job position with company, title, duration, description
   - `Education`: School/university with institute, title, dates
   - `Language`: Language with proficiency level
   - `CurrentCompany`: Current employer with ID, name, location
   - `Activity`: LinkedIn activity feed item
   - `HonorAward`: Award/recognition with date and publication

4. **Helper Function**:
   - `transformBrightDataProfile(data)` - Converts raw API response to ProfileData

---

## DATA FLOW DIAGRAM

```
User Input (Natural Language Query)
           ↓
[Search API Endpoint]
           ↓
Parse Query (Google Gemini 2.0 Flash)
           ↓
        Parsed Query (count, role, location, countryCode, googleQuery)
           ↓
Find LinkedIn URLs (Bright Data Google Search API)
           ↓
        LinkedIn URLs Array
           ↓
Batch Cache Check (Database lookup)
           ↓
    ┌─────┴─────┐
    ↓           ↓
Cached      Uncached
Profiles    URLs
    ↓           ↓
    └─────┬─────┘
          ↓
[Skip if all cached]
          ↓
Batch Fetch Profiles (Bright Data LinkedIn API)
          ↓
Trigger Job → Poll for Completion → Parse Response
          ↓
Transform to ProfileData
          ↓
Save to Database (Upsert with searchCount increment)
          ↓
Combine Cached + Fetched Results
          ↓
Return to Client
          ↓
Frontend Displays Expandable Profile Cards
```

---

## AUTHENTICATION & AUTHORIZATION

### API Keys Required:

1. **Bright Data API Token**
   - Environment variable: `BRIGHTDATA_API_TOKEN`
   - Usage: Bearer token in all Bright Data API requests
   - Scopes: Google search, LinkedIn scraping via dataset API
   - Used in: `search.ts`, `linkedin.ts`, `client.ts`

2. **Google Gemini API Key**
   - Environment variable: `GOOGLE_GENERATIVE_AI_API_KEY`
   - Usage: Query parsing via Gemini 2.0 Flash model
   - Used in: `parser.ts`

3. **Database Connection (Supabase)**
   - Environment variable: `DATABASE_URL`
   - Connection string with credentials
   - Must use Connection Pooling for serverless functions
   - Used in: `prisma.ts`

### Authentication Strategy:

- **No user authentication**: App is public/open-source
- **Server-side API keys**: All keys stored on backend, never exposed to frontend
- **API key validation**: Checked at module initialization time
- **Error handling**: Descriptive errors if keys missing

### Security Considerations:

- API keys loaded from environment variables only
- No hardcoded credentials (except in `.env.example`)
- Bright Data API token in Authorization header (Bearer scheme)
- Database connections use connection pooling for security
- Image proxy validates URL parameter

---

## THIRD-PARTY SERVICE INTEGRATIONS

### 1. Bright Data (Multi-Service)

**Services Used**:
- Google Search API (via proxy)
- LinkedIn Scraping Dataset (gd_l1viktl72bvl7bjuj0)
- MCP (Model Context Protocol) server

**Endpoints**:
- `https://api.brightdata.com/request` - Google search proxy
- `https://api.brightdata.com/datasets/v3/trigger` - Start scrape job
- `https://api.brightdata.com/datasets/v3/snapshot/{id}` - Get results
- `https://mcp.brightdata.com/mcp` - MCP server (with auth token)

**Features Enabled**:
- Geolocation-aware search (via `gl` parameter)
- JSON response format (brd_json=1)
- Unlocker zone for bypassing restrictions
- Batch operations support
- Async job polling

---

### 2. Google Gemini (Generative AI)

**Model**: Google Gemini 2.0 Flash (fastest Gemini model)

**Features**:
- Structured output with Zod schema
- Natural language understanding for query parsing
- Low latency (ideal for user-facing endpoints)

**Integration**: Via Vercel AI SDK (`ai` package)

---

### 3. Supabase (PostgreSQL Database)

**Features Used**:
- PostgreSQL database
- Connection pooling (for serverless)
- SSL connections
- 30-day profile caching

**Prisma Models**:
- `Person`: Cached LinkedIn profiles
- `Search`: Search query history (optional)

---

## SHARED LOGIC & REUSABLE FUNCTIONS

### 1. LinkedIn ID Extraction

Duplicated in two locations (should be consolidated):

**Location 1**: `/src/lib/cache/index.ts`
```typescript
function extractLinkedInId(url: string): string | null
```

**Location 2**: `/src/app/api/search/route.ts`
```typescript
function extractLinkedInId(url: string): string | null
```

**Recommendation**: Move to `/src/lib/utils.ts` and export as utility

---

### 2. LinkedIn URL Validation

**Location 1**: `/src/lib/brightdata/search.ts`
```typescript
function isValidLinkedInProfileUrl(url: string): boolean
```

**Location 2**: `/src/lib/brightdata/linkedin.ts`
```typescript
export function isValidLinkedInUrl(url: string): boolean
```

**Recommendation**: Consolidate into single utility function

---

### 3. URL Normalization

**Location**: `/src/lib/brightdata/search.ts`
```typescript
function normalizeLinkedInUrl(url: string): string
```

Removes query parameters and fragments from LinkedIn URLs.

---

### 4. API Header Construction

Duplicated in two Bright Data modules:

**Location 1**: `/src/lib/brightdata/search.ts`
```typescript
function getApiHeaders(): { Authorization: string; 'Content-Type': string }
```

**Location 2**: `/src/lib/brightdata/linkedin.ts`
```typescript
function getApiHeaders(): { Authorization: string; 'Content-Type': string }
```

**Recommendation**: Create `/src/lib/brightdata/utils.ts` with shared header builder

---

### 5. Batch Profile Transformation

**Location**: `/src/app/api/profiles/recent/route.ts`

Maps Prisma Person model to ProfileData:
```typescript
const transformedProfiles = profiles.map(profile => ({...}))
```

**Recommendation**: Extract to reusable function in `cache/index.ts`

---

## CACHING STRATEGY

### How Caching Works:

1. **Database-Level Cache**: Profiles stored in `Person` table
2. **Freshness Check**: Age calculated as `(now - updatedAt) / (1000 * 60 * 60 * 24)`
3. **Stale Data**: If age >= 30 days, cache considered stale
4. **Batch Efficiency**: Single query fetches multiple profiles
5. **Metadata**: Tracks `searchCount` and `lastViewed` for analytics

### Cache Workflow:

```
New Search Request
        ↓
Extract LinkedIn IDs from URLs
        ↓
Query database: WHERE linkedinId IN (ids)
        ↓
For each result:
  - Calculate age = (now - updatedAt) days
  - If age < 30 → include in cached results
  - If age >= 30 → skip (stale)
        ↓
Return cached profiles + URLs needing refresh
```

### Invalidation:

- **Automatic**: 30-day freshness window
- **Manual**: None implemented
- **Partial**: Only stale profiles are refreshed

---

## LOGGING & DEBUGGING

### Log Prefixes by Component:

- `[Parser]` - Query parsing (parser.ts)
- `[LinkedIn Scraper]` - Profile scraping (linkedin.ts)
- `[Google Search]` - Google search (search.ts)
- `[LinkedIn URLs]` - URL extraction (search.ts)
- `[Cache]` - Caching operations (cache/index.ts)
- `[Search API]` - API endpoint (route.ts)
- `[API]` - Recent profiles API (recent/route.ts)

### Log Levels:

- **console.log**: Info (parsing results, cache hits, job triggers)
- **console.error**: Errors with full context

### Example Log Output:
```
[Parser] Parsed query: "5 AI Engineers in Israel" -> role="AI Engineer", count=5, country=IL
[Google Search] Found 15 organic results for query: "site:linkedin.com/in "AI Engineer" "Israel""
[LinkedIn URLs] Extracted 5 LinkedIn profile URLs
[Cache] Batch query: 5 requested, 3 cached
[LinkedIn Scraper] Triggered job with snapshot ID: snap_12345
[LinkedIn Scraper] Snapshot data received after 42 attempts
[Search API] Fetching 2 uncached profiles in batch
[Cache] Saved profile for meir-kadosh-7bb5b7224 (searchCount: 1)
```

---

## ENVIRONMENT CONFIGURATION

### Required Variables:

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# Supabase (optional for client-side)
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."

# APIs
BRIGHTDATA_API_TOKEN="2dceb1aa..."
GOOGLE_GENERATIVE_AI_API_KEY="AIzaSy..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
BRIGHTDATA_UNLOCKER_ZONE="unblocker"  # Optional, defaults to "unblocker"
```

### Optional Variables:

```bash
# Analytics
NEXT_PUBLIC_POSTHOG_KEY=""
```

---

## PERFORMANCE CONSIDERATIONS

### Optimization Strategies:

1. **Batch Caching**: Single DB query for multiple profiles
2. **Connection Pooling**: Reuses Supabase connections
3. **Async Job Polling**: Non-blocking profile scraping
4. **Image Caching**: 24-hour CDN cache on proxied images
5. **Singleton Pattern**: Single MCP client instance
6. **Query Optimization**: Indexed lookups on linkedinId, fullName, location

### Database Indexes:

```sql
CREATE INDEX idx_full_name ON people(fullName);
CREATE INDEX idx_first_last ON people(firstName, lastName);
CREATE INDEX idx_last_viewed ON people(lastViewed);
CREATE INDEX idx_linkedin_id ON people(linkedinId);
CREATE INDEX idx_current_company ON people(currentCompany);
CREATE INDEX idx_location ON people(location);
CREATE INDEX idx_updated_at ON people(updatedAt);
```

### Bottlenecks:

1. **LinkedIn Scraping**: 10+ minute timeout per job (Bright Data limitation)
2. **API Rate Limits**: Bright Data API quotas
3. **Network latency**: Cross-service API calls

---

## ERROR HANDLING PATTERNS

### Error Strategy:

1. **Validation First**: Input validation at API endpoint
2. **Try-Catch Blocks**: Wraps all async operations
3. **Descriptive Messages**: Explains what failed and why
4. **Partial Success**: Returns cached data even if fetch fails
5. **Error Propagation**: Throws with context for upstream handling

### Common Error Scenarios:

| Scenario | Handler | Response |
|----------|---------|----------|
| Missing API key | Throws immediately | 500 - "API key not set" |
| Invalid query | Validates in route | 400 - "Query validation" |
| Bright Data API error | Catches and logs | 500 - "Search failed" |
| Profile fetch fails | Returns cached only | 200 - Partial results |
| Database error | Catches and logs | 500 - "Cache error" |
| Invalid LinkedIn URL | Skips in validation | Filtered from results |
| Timeout (10 min) | Throws error | No data returned |

---

## TESTING INFRASTRUCTURE

Test files available in `/src/tests/`:

1. `test-parser.ts` - Query parsing with Gemini
2. `test-search-flow.ts` - Full search → Google → LinkedIn flow
3. `test-cache.ts` - Caching layer operations
4. `test-recent-api.ts` - Recent profiles API endpoint
5. `test-linkedin.ts` - LinkedIn scraping functions

Run tests:
```bash
npx tsx src/tests/test-parser.ts
npx tsx src/tests/test-search-flow.ts
```

---

## DEPLOYMENT CONSIDERATIONS

### Serverless Compatibility:

- Uses Supabase connection pooling (not direct TCP)
- All API routes are stateless
- No persistent connections needed
- Environment variables configured per deployment

### Production Checklist:

- [ ] Database URL uses Connection Pooling
- [ ] All API keys set in production environment
- [ ] CORS headers configured if needed
- [ ] Rate limiting implemented (optional)
- [ ] Error logging configured
- [ ] Cache expiration tested
- [ ] Image proxy CORS tested
- [ ] Gemini API rate limits verified

---

## GLOSSARY

- **MCP**: Model Context Protocol (Bright Data integration format)
- **Snapshot**: Async job result from Bright Data API
- **Zone**: Bright Data proxy zone (unblocker, proxy server, etc.)
- **LinkedIn ID**: Username portion of LinkedIn URL (e.g., "meir-kadosh-7bb5b7224")
- **LinkedIn Num ID**: Numeric LinkedIn identifier
- **Bright Data**: Third-party web scraping/proxy service
- **Geolocation**: Country-specific search results (via `gl` parameter)

