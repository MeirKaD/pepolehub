# PeopleHub Documentation Index

## Overview

This documentation provides a complete technical reference for the PeopleHub codebase, including all services, utilities, APIs, and architectural components.

---

## Documentation Files

### 1. SERVICES_AND_UTILITIES.md (Primary Reference)
**Size**: 25 KB | **Scope**: Complete technical documentation

Comprehensive mapping of all services and utilities including:

- **Bright Data Integration** (3 modules)
  - MCP Client (connection management)
  - Google Search API (LinkedIn URL discovery)
  - LinkedIn Scraper (profile data extraction)

- **Google Gemini AI Parser**
  - Natural language query parsing
  - Schema validation (Zod)
  - Query type detection

- **Caching Layer**
  - Database-level cache implementation
  - Freshness validation (30 days)
  - Batch optimization

- **Database Layer**
  - Prisma client singleton
  - Connection pooling
  - Logging configuration

- **Third-Party Integrations**
  - Authentication mechanisms
  - API endpoint specifications
  - Rate limiting considerations

- **Shared Logic & Code Consolidation**
  - Identifies duplicated functions
  - Recommendations for refactoring

### 2. ARCHITECTURE.md (Visual Reference)
**Size**: 36 KB | **Scope**: Diagrams and detailed specifications

Visual and textual descriptions of:

- **System Architecture Diagrams**
  - High-level component relationships
  - Data flow visualization
  - Service layer organization

- **API Endpoint Specifications**
  - Complete request/response formats
  - Error handling
  - Query parameters

- **Database Schema**
  - Person model (cached profiles)
  - Search model (query history)
  - Indexes and constraints

- **Performance Metrics**
  - Caching effectiveness
  - Query optimization
  - Rate limiting considerations

- **Security Architecture**
  - Environment variable handling
  - API key management
  - Frontend/backend separation

- **Deployment Architecture**
  - Development vs Production
  - Serverless compatibility
  - Database setup

- **Error Recovery & Resilience**
  - Graceful degradation
  - Retry strategies

### 3. SERVICE_QUICK_REFERENCE.md (Developer Guide)
**Size**: 11 KB | **Scope**: Quick lookup and practical examples

Quick-access reference for:

- **File Organization**
  - Directory structure
  - Service locations

- **Service Import Map**
  - Copy-paste ready imports for each service

- **Function Reference**
  - All public functions with parameters
  - Return types
  - Key features

- **Common Operations**
  - Example code for typical tasks
  - Error handling patterns
  - Performance tips

- **Logging Guide**
  - Log prefixes for each component
  - Example log sequences

- **Testing Services**
  - How to run individual tests

- **Dependency Tree**
  - Service dependencies
  - Third-party integrations

- **Consolidation Recommendations**
  - Code duplication issues
  - Refactoring suggestions

---

## Which Document to Use?

### For Understanding the System
- Start with: **ARCHITECTURE.md**
- Then read: **SERVICES_AND_UTILITIES.md**
- Reference: **SERVICE_QUICK_REFERENCE.md** while coding

### For Quick Lookups
- Function signatures: **SERVICE_QUICK_REFERENCE.md**
- API specifications: **ARCHITECTURE.md**
- Authentication details: **SERVICES_AND_UTILITIES.md**

### For Development
- Copy-paste imports: **SERVICE_QUICK_REFERENCE.md**
- Implementation details: **SERVICES_AND_UTILITIES.md**
- Error handling: **ARCHITECTURE.md**

### For Deployment
- Environment variables: **SERVICE_QUICK_REFERENCE.md** and **SERVICES_AND_UTILITIES.md**
- Connection setup: **ARCHITECTURE.md**
- Security checklist: **ARCHITECTURE.md**

---

## Key Sections by Topic

### Authentication & Authorization
- SERVICES_AND_UTILITIES.md > Authentication & Authorization
- ARCHITECTURE.md > Security Architecture

### Third-Party Integrations
- SERVICES_AND_UTILITIES.md > Third-Party Service Integrations
- ARCHITECTURE.md > Third-Party API Integration Points

### Database & Caching
- SERVICES_AND_UTILITIES.md > Caching Layer
- ARCHITECTURE.md > Database Schema
- SERVICES_AND_UTILITIES.md > Caching Strategy

### API Endpoints
- SERVICES_AND_UTILITIES.md > API Endpoints Architecture
- ARCHITECTURE.md > API Endpoint Specifications
- SERVICE_QUICK_REFERENCE.md > API Endpoint Reference

### Error Handling
- SERVICES_AND_UTILITIES.md > Error Handling Patterns
- ARCHITECTURE.md > Error Recovery & Resilience
- SERVICE_QUICK_REFERENCE.md > Error Handling Patterns

### Performance
- SERVICES_AND_UTILITIES.md > Performance Considerations
- ARCHITECTURE.md > Performance Metrics
- SERVICE_QUICK_REFERENCE.md > Performance Tips

### Data Flow
- ARCHITECTURE.md > Data Flow (Complete Search Pipeline)
- SERVICES_AND_UTILITIES.md > Data Flow Diagram

---

## Quick Navigation

### Service Files
- Bright Data Google Search: `/src/lib/brightdata/search.ts`
- Bright Data LinkedIn Scraper: `/src/lib/brightdata/linkedin.ts`
- Bright Data MCP Client: `/src/lib/brightdata/client.ts`
- Query Parser: `/src/lib/search/parser.ts`
- Cache Service: `/src/lib/cache/index.ts`
- Database Client: `/src/lib/prisma.ts`
- Utilities: `/src/lib/utils.ts`

### API Routes
- Search: `/src/app/api/search/route.ts`
- Recent Profiles: `/src/app/api/profiles/recent/route.ts`
- Image Proxy: `/src/app/api/proxy-image/route.ts`

### Type Definitions
- LinkedIn Types: `/src/types/linkedin.ts`

---

## Key Concepts

### Three-Tier Search Pipeline
1. **Natural Language Parsing** (Gemini AI)
2. **LinkedIn URL Discovery** (Google Search via Bright Data)
3. **Profile Data Extraction** (LinkedIn Scraper via Bright Data)

### Smart Caching
- **Storage**: Supabase PostgreSQL
- **Freshness**: 30 days
- **Lookup Key**: LinkedIn ID (username)
- **Batch Optimization**: Single query for multiple profiles

### Authentication
- **Bright Data**: Bearer token (`BRIGHTDATA_API_TOKEN`)
- **Gemini**: API key (`GOOGLE_GENERATIVE_AI_API_KEY`)
- **Database**: Connection string with credentials (`DATABASE_URL`)

### Response Times
- Cached search: ~2.5 seconds
- New search: ~120+ seconds (10-minute timeout for scraping)
- Cache hit rate: ~98% for repeated searches

---

## Code Examples

### Import Services
```typescript
// Query Parser
import { parseSearchQuery } from '@/lib/search/parser';

// Bright Data Search
import { findLinkedInProfiles } from '@/lib/brightdata/search';

// Bright Data Scraper
import { fetchLinkedInProfiles } from '@/lib/brightdata/linkedin';

// Cache
import { getCachedProfiles, saveProfile } from '@/lib/cache';

// Database
import { prisma } from '@/lib/prisma';
```

### Common Patterns
1. **Parse Query**: `parseSearchQuery(userInput)`
2. **Find URLs**: `findLinkedInProfiles(query, count, countryCode)`
3. **Check Cache**: `getCachedProfiles(urls)`
4. **Fetch New**: `fetchLinkedInProfiles(uncachedUrls)`
5. **Save Results**: `saveProfile(profileData)`

---

## Environment Setup

### Required Variables
```
BRIGHTDATA_API_TOKEN
GOOGLE_GENERATIVE_AI_API_KEY
DATABASE_URL
```

### Optional Variables
```
BRIGHTDATA_UNLOCKER_ZONE (defaults to "unblocker")
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## Testing

### Test Files
- `src/tests/test-parser.ts` - Query parsing
- `src/tests/test-search-flow.ts` - Full pipeline
- `src/tests/test-cache.ts` - Caching layer
- `src/tests/test-linkedin.ts` - LinkedIn scraping
- `src/tests/test-recent-api.ts` - Recent profiles API

### Running Tests
```bash
npx tsx src/tests/test-parser.ts
npx tsx src/tests/test-search-flow.ts
```

---

## Performance Checklist

- [ ] Use batch operations for multiple profiles
- [ ] Leverage cache (30-day freshness)
- [ ] Connection pooling enabled for Supabase
- [ ] Image proxy caching (24 hours)
- [ ] Database indexes optimized
- [ ] API rate limits monitored

---

## Security Checklist

- [ ] All API keys stored in environment variables
- [ ] No hardcoded credentials (except .env.example)
- [ ] Bearer token used for Bright Data API
- [ ] Database uses connection pooling
- [ ] CORS not needed (server-to-server)
- [ ] No API keys exposed to frontend

---

## Deployment Checklist

- [ ] DATABASE_URL uses Connection Pooling
- [ ] All API keys set in production
- [ ] Error logging configured
- [ ] Cache expiration tested
- [ ] Image proxy CORS tested
- [ ] Rate limits verified

---

## Glossary

- **MCP**: Model Context Protocol (Bright Data format)
- **Snapshot**: Async job result from Bright Data
- **Zone**: Bright Data proxy zone (unblocker, etc.)
- **LinkedIn ID**: Username (e.g., "meir-kadosh-7bb5b7224")
- **LinkedIn Num ID**: Numeric identifier
- **Geolocation**: Country-specific search (via `gl` parameter)
- **Freshness**: Profile age validation (30 days)
- **Cache Hit**: Profile found in database and fresh
- **Cache Miss**: Profile not found or stale (>30 days)

---

## Document History

| Document | Size | Created | Purpose |
|----------|------|---------|---------|
| SERVICES_AND_UTILITIES.md | 25 KB | 2025-10-25 | Complete service reference |
| ARCHITECTURE.md | 36 KB | 2025-10-25 | Visual diagrams and specs |
| SERVICE_QUICK_REFERENCE.md | 11 KB | 2025-10-25 | Quick lookup guide |
| DOCUMENTATION_INDEX.md | This file | 2025-10-25 | Navigation and overview |

---

## Contact & Updates

For questions or updates to this documentation:
1. Check the relevant service file in `src/lib/`
2. Review test files in `src/tests/`
3. Consult git log for recent changes
4. Read inline code comments for implementation details

