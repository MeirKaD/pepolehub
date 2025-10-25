# PeopleHub - Service Quick Reference

## File Organization

```
src/
├── lib/
│   ├── brightdata/          # Bright Data API integration
│   │   ├── client.ts        # MCP client initialization
│   │   ├── search.ts        # Google search API
│   │   └── linkedin.ts      # LinkedIn scraping API
│   ├── search/
│   │   └── parser.ts        # Gemini query parsing
│   ├── cache/
│   │   └── index.ts         # Database caching layer
│   ├── prisma.ts            # Prisma singleton
│   └── utils.ts             # Tailwind CSS utilities
├── types/
│   └── linkedin.ts          # Type definitions
└── app/api/
    ├── search/route.ts      # Main search endpoint
    ├── profiles/recent/route.ts  # Recent profiles API
    └── proxy-image/route.ts # Image proxy
```

---

## Service Import Map

### To use Bright Data Google Search:
```typescript
import { findLinkedInProfiles } from '@/lib/brightdata/search';

const urls = await findLinkedInProfiles(googleQuery, count, countryCode);
```

### To use Bright Data LinkedIn Scraper:
```typescript
import { fetchLinkedInProfiles } from '@/lib/brightdata/linkedin';

const profiles = await fetchLinkedInProfiles(linkedinUrls);
```

### To use Query Parser:
```typescript
import { parseSearchQuery } from '@/lib/search/parser';

const parsed = await parseSearchQuery("5 AI Engineers in Israel");
```

### To use Cache:
```typescript
import { getCachedProfiles, saveProfile } from '@/lib/cache';

const cached = await getCachedProfiles(urls);
await saveProfile(profileData);
```

### To use Database:
```typescript
import { prisma } from '@/lib/prisma';

await prisma.person.findMany();
```

---

## Function Reference

### Bright Data Search Service

#### `searchGoogle(query, page?, countryCode?)`
- **Location**: `lib/brightdata/search.ts`
- **Purpose**: Execute Google search via Bright Data API
- **Parameters**:
  - `query` (string): Google search query
  - `page` (number): Page number (default: 0)
  - `countryCode` (string): ISO country code (IL, US, etc.)
- **Returns**: `GoogleSearchResponse`
- **Key Features**: Geolocation support, JSON responses

#### `findLinkedInProfiles(query, maxResults?, countryCode?)`
- **Location**: `lib/brightdata/search.ts`
- **Purpose**: Find LinkedIn profile URLs via Google
- **Parameters**:
  - `query` (string): Google search query
  - `maxResults` (number): Max URLs to return (default: 10)
  - `countryCode` (string): ISO country code
- **Returns**: `string[]` (LinkedIn URLs)
- **Key Features**: URL validation, normalization

#### `extractLinkedInUrls(results)`
- **Location**: `lib/brightdata/search.ts`
- **Purpose**: Extract and validate LinkedIn URLs from search results
- **Parameters**: `GoogleSearchResponse`
- **Returns**: `string[]` (clean URLs)

---

### Bright Data LinkedIn Scraper Service

#### `fetchLinkedInProfile(url)`
- **Location**: `lib/brightdata/linkedin.ts`
- **Purpose**: Fetch single LinkedIn profile
- **Parameters**: `url` (string): LinkedIn profile URL
- **Returns**: `ProfileData`
- **Timeout**: 10 minutes (600 seconds)
- **Key Features**: Job trigger, polling, transformation

#### `fetchLinkedInProfiles(urls)`
- **Location**: `lib/brightdata/linkedin.ts`
- **Purpose**: Batch fetch multiple LinkedIn profiles
- **Parameters**: `urls` (string[]): Array of LinkedIn URLs
- **Returns**: `ProfileData[]`
- **Key Features**: Single API call for batch operation, optimized

---

### Query Parser Service

#### `parseSearchQuery(query)`
- **Location**: `lib/search/parser.ts`
- **Purpose**: Parse natural language query into structured data
- **Parameters**: `query` (string): Natural language search
- **Returns**: `ParsedSearchQuery`
- **Output Fields**:
  - `count` (number): Profiles to find
  - `role` (string|null): Job title
  - `location` (string|null): Geographic location or company
  - `countryCode` (string|null): ISO country code
  - `keywords` (string[]): Additional qualifications
  - `googleQuery` (string): Optimized Google search query
- **Key Features**: Gemini 2.0 Flash, Zod validation, flexible interpretation

---

### Cache Service

#### `getCachedProfile(url)`
- **Location**: `lib/cache/index.ts`
- **Purpose**: Get single profile from cache
- **Parameters**: `url` (string): LinkedIn URL
- **Returns**: `ProfileData|null`
- **Validation**: Checks 30-day freshness

#### `getCachedProfiles(urls)`
- **Location**: `lib/cache/index.ts`
- **Purpose**: Batch get cached profiles
- **Parameters**: `urls` (string[]): Array of URLs
- **Returns**: `Record<linkedinId, ProfileData>`
- **Optimization**: Single DB query for all URLs

#### `saveProfile(data)`
- **Location**: `lib/cache/index.ts`
- **Purpose**: Save or update profile in database
- **Parameters**: `data` (ProfileData): Profile to save
- **Returns**: `ProfileData`
- **Key Features**: Upsert operation, increments searchCount, updates timestamps

---

### Database Service

#### `prisma`
- **Location**: `lib/prisma.ts`
- **Purpose**: Prisma Client singleton
- **Features**: Connection pooling, logging configured
- **Usage**: `prisma.person.findMany()`, `prisma.person.upsert()`

---

## API Endpoint Reference

### POST /api/search

**Full Pipeline Overview**:
```
Request → Validate → Parse → Search Google → Cache Check → 
Fetch New → Save → Respond
```

**Example Request**:
```javascript
const response = await fetch('/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: '5 AI Engineers in Israel' })
});
```

**Response Fields**:
- `success` (boolean)
- `count` (number): Total profiles returned
- `cached` (number): From database
- `fetched` (number): Newly scraped
- `profiles` (ProfileData[]): Array of profiles

---

### GET /api/profiles/recent

**Parameters**:
- `limit`: 1-100 (default: 50)
- `before`: ISO timestamp for pagination
- `after`: ISO timestamp for auto-refresh

**Example**:
```javascript
const response = await fetch('/api/profiles/recent?limit=25&before=2025-10-25T20:00:00Z');
```

**Response Headers**:
- `X-Total-Count`: Total cached profiles count

---

### GET /api/proxy-image

**Parameters**:
- `url`: Image URL to proxy

**Example**:
```javascript
const response = await fetch(`/api/proxy-image?url=${encodeURIComponent(imageUrl)}`);
```

**Features**:
- CORS bypass
- User-Agent spoofing
- 24-hour caching

---

## Environment Variables Required

```bash
# Bright Data
BRIGHTDATA_API_TOKEN=<token>
BRIGHTDATA_UNLOCKER_ZONE=unblocker

# Google Gemini
GOOGLE_GENERATIVE_AI_API_KEY=<key>

# Database
DATABASE_URL=<connection_string>

# Supabase (optional client-side)
NEXT_PUBLIC_SUPABASE_URL=<url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
```

---

## Common Operations

### Searching for Profiles

```typescript
import { parseSearchQuery } from '@/lib/search/parser';
import { findLinkedInProfiles } from '@/lib/brightdata/search';
import { getCachedProfiles, saveProfile } from '@/lib/cache';
import { fetchLinkedInProfiles } from '@/lib/brightdata/linkedin';

// 1. Parse query
const parsed = await parseSearchQuery("5 AI Engineers in Israel");

// 2. Find URLs
const urls = await findLinkedInProfiles(parsed.googleQuery, parsed.count, parsed.countryCode);

// 3. Check cache
const cached = await getCachedProfiles(urls);

// 4. Fetch uncached
const uncached = urls.filter(url => !cached[extractId(url)]);
const fetched = await fetchLinkedInProfiles(uncached);

// 5. Save new ones
for (const profile of fetched) {
  await saveProfile(profile);
}

// 6. Combine
const all = [...Object.values(cached), ...fetched];
```

### Getting Recent Profiles

```typescript
import { prisma } from '@/lib/prisma';

const profiles = await prisma.person.findMany({
  orderBy: { updatedAt: 'desc' },
  take: 50
});
```

### Checking Cache Status

```typescript
import { getCachedProfiles } from '@/lib/cache';

const urls = ["https://linkedin.com/in/john-doe", ...];
const cached = await getCachedProfiles(urls);

console.log(`Found ${Object.keys(cached).length} cached profiles`);
console.log(`Need to fetch ${urls.length - Object.keys(cached).length} new ones`);
```

---

## Error Handling Patterns

### Try-Catch Pattern

```typescript
try {
  const profiles = await fetchLinkedInProfiles(urls);
  return profiles;
} catch (error) {
  console.error('Fetch error:', error);
  // Return cached data as fallback
  return await getCachedProfiles(urls);
}
```

### Validation Pattern

```typescript
if (!query || query.length < 2) {
  return { error: 'Invalid query', status: 400 };
}

const parsed = await parseSearchQuery(query);
if (!parsed.googleQuery) {
  return { error: 'Failed to parse query', status: 500 };
}
```

---

## Performance Tips

1. **Batch Operations**: Always use `getCachedProfiles()` for multiple URLs, not `getCachedProfile()` one at a time
2. **Reuse Parsed Queries**: Cache parsed query results if repeating searches
3. **Image Proxy Caching**: 24-hour CDN cache automatically applied
4. **Database Indexes**: Lookups on linkedinId, fullName, location optimized
5. **LinkedIn Scraping**: Takes 10+ minutes per job; leverage cache heavily

---

## Logging Guide

Look for these prefixes in console:

```
[Parser]           - Query parsing results
[Google Search]    - Search API calls
[LinkedIn URLs]    - URL extraction
[LinkedIn Scraper] - Profile scraping
[Cache]            - Cache hits/misses
[Search API]       - API endpoint logic
```

Example log sequence:
```
[Parser] Parsed query: "5 AI Engineers" -> role="AI Engineer", count=5
[Google Search] Found 15 organic results
[LinkedIn URLs] Extracted 5 LinkedIn profile URLs
[Cache] Batch query: 5 requested, 3 cached
[LinkedIn Scraper] Triggered job with snapshot ID: snap_123
[Cache] Saved profile for john-doe (searchCount: 2)
```

---

## Testing Services

Run individual test files:

```bash
npx tsx src/tests/test-parser.ts          # Test Gemini parsing
npx tsx src/tests/test-search-flow.ts     # Test full pipeline
npx tsx src/tests/test-cache.ts           # Test caching
npx tsx src/tests/test-linkedin.ts        # Test scraping
npx tsx src/tests/test-recent-api.ts      # Test API endpoint
```

---

## Dependency Tree

```
Search API Route
├── Parser (Gemini)
│   └── Google Generative AI
├── Bright Data Search
│   └── Bright Data API
├── Cache Service
│   ├── Prisma Client
│   │   └── Supabase PostgreSQL
│   └── LinkedIn ID extractor
└── Bright Data LinkedIn Scraper
    └── Bright Data API
```

---

## Consolidation Recommendations

Duplicated code that should be consolidated:

1. **LinkedIn ID Extraction** (2 locations)
   - Current: `cache/index.ts`, `app/api/search/route.ts`
   - Move to: `lib/utils.ts`

2. **LinkedIn URL Validation** (2 functions)
   - Current: `isValidLinkedInProfileUrl()`, `isValidLinkedInUrl()`
   - Move to: `lib/utils.ts`

3. **API Headers** (2 locations)
   - Current: `brightdata/search.ts`, `brightdata/linkedin.ts`
   - Move to: `lib/brightdata/utils.ts`

4. **Profile Transformation** (duplicate logic)
   - Current: In API routes
   - Move to: `cache/index.ts`

