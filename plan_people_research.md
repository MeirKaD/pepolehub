# People Research Feature - Implementation Plan

## Overview
This plan outlines the implementation of a comprehensive AI-powered person research feature using LangGraph JS. The feature will replace the current "View Details" button with a "Research Person" button that triggers a multi-agent system to collect, analyze, and synthesize information about a person from multiple sources in parallel.

## Architecture Overview

```
User clicks "Research Person"
         ↓
    [Research Page with Loading UI]
         ↓
    [LangGraph Workflow Starts]
         ↓
    ┌────────────────┐
    │  START NODE    │
    │ Extract Person │
    │   LinkedIn URL │
    └────────┬───────┘
             ↓
    ┌────────┴────────┐
    │                 │
    ↓                 ↓
[LinkedIn Fetch]  [Search Engine Query Generation]
    │                 │
    │                 ↓
    │         [Google Search via Bright Data]
    │                 │
    │                 ↓
    │         [Send API - Parallel Web Scraping]
    │         (scrape_batch on search results)
    │                 │
    ↓                 ↓
[LinkedIn      [Web Scrape Results]
 Complete]            │
    │                 ↓
    │         [Send API - Parallel Summarization]
    │         (LLM summarizes each scraped page)
    │                 │
    └────────┬────────┘
             ↓
    [Aggregation Node]
    Collect all data:
    - LinkedIn profile
    - Web summaries
             ↓
    [Writer Node]
    Generate comprehensive
    research report using LLM
             ↓
    [END - Save & Display Report]
```

## Tech Stack
- **LangGraph JS** v1.0+ - Graph orchestration with parallel execution
- **@ai-sdk/google** - Google Gemini for LLM operations
- **Bright Data MCP** - LinkedIn scraping & Google search
- **Next.js API Routes** - Backend endpoints
- **Redis** - Caching research results
- **PostgreSQL (Prisma)** - Persistent storage of research reports
- **React + Framer Motion** - Frontend with loading animations
- **Server-Sent Events (SSE)** - Real-time streaming of progress updates

---

## Tasks Breakdown

### Phase 1: Backend Infrastructure

#### Task 1.1: Install LangGraph Dependencies
- [X] Install @langchain/langgraph
- [X] Install @langchain/core
- [X] Install @langchain/community (if needed for utilities)
- [X] Update package.json with correct versions
- [X] Verify installation with simple test

**Files to modify:**
- `package.json`

**Test:** Create and run `src/tests/test-langgraph-install.ts`

---

#### Task 1.2: Create Research State Schema
- [x] Create `src/lib/research/types.ts`
- [x] Define TypeScript interfaces for:
  - `ResearchState` (LangGraph state)
  - `ResearchInput` (user input)
  - `ResearchOutput` (final report)
  - `LinkedInData` (from Bright Data)
  - `SearchResult` (from Google Search)
  - `ScrapedContent` (from scrape_batch)
  - `WebSummary` (LLM-generated summary)
- [x] Define LangGraph Annotation with proper reducers
- [x] Add state validation schemas using Zod

**Files to create:**
- `src/lib/research/types.ts`

**Test:** Create and run `src/tests/test-research-types.ts` to validate type definitions

---

#### Task 1.3: Create Bright Data Research Client
- [x] Create `src/lib/brightdata/research.ts`
- [x] Implement `searchGoogleForPerson(personName: string, linkedinUrl: string)` function
  - Uses search_engine tool via MCP
  - Generates search query using LLM (Gemini)
  - Returns top 10-15 relevant URLs (excluding LinkedIn)
- [x] Implement `scrapeUrls(urls: string[])` function
  - Uses scrape_batch tool via MCP
  - Handles batch scraping with error handling
  - Returns raw HTML/text content
- [x] Add proper error handling and retry logic
- [x] Add content size validation (warn if >50KB per page)

**Files to create:**
- `src/lib/brightdata/research.ts`

**Dependencies:**
- Uses existing `src/lib/brightdata/client.ts`

**Test:** Create and run `src/tests/test-brightdata-research.ts`
- Test Google search for a known person
- Test scrape_batch on 3-5 URLs
- Verify error handling

---

#### Task 1.4: Create LLM Service for Research
- [x] Create `src/lib/research/llm-service.ts`
- [x] Implement `generateSearchQuery(personName: string, linkedinUrl: string, context: string)` function
  - Uses Gemini to create optimized Google search query
  - Returns search query string
- [x] Implement `summarizeWebContent(url: string, content: string, personName: string)` function
  - Uses Gemini to extract relevant information about the person
  - Handles large content (chunking if needed)
  - Returns structured summary (max 500 words)
  - Returns null if person not mentioned in content
- [x] Implement `generateResearchReport(data: ResearchData)` function
  - Combines LinkedIn profile + web summaries
  - Generates comprehensive markdown report
  - Includes sections: Summary, Professional Background, Online Presence, Key Insights, Sources
- [x] Add token counting and cost tracking
- [x] Add streaming support for report generation

**Files to create:**
- `src/lib/research/llm-service.ts`

**Test:** Create and run `src/tests/test-llm-service.ts`
- Test search query generation
- Test web content summarization with sample HTML
- Test report generation with mock data
- Verify token usage is reasonable

---

### Phase 2: LangGraph Workflow Implementation

#### Task 2.1: Create Research Graph Structure
- [x] Create `src/lib/research/graph.ts`
- [x] Define StateAnnotation with Annotation.Root:
  ```typescript
  const ResearchStateAnnotation = Annotation.Root({
    personName: Annotation<string>,
    linkedinUrl: Annotation<string>,
    linkedinData: Annotation<LinkedInProfile | null>,
    searchQuery: Annotation<string | null>,
    searchResults: Annotation<SearchResult[]>,
    scrapedContents: Annotation<ScrapedContent[]>({
      reducer: (state, update) => [...state, ...update],
    }),
    webSummaries: Annotation<WebSummary[]>({
      reducer: (state, update) => [...state, ...update],
    }),
    finalReport: Annotation<string | null>,
    errors: Annotation<string[]>({
      reducer: (state, update) => [...state, ...update],
    }),
    status: Annotation<string>,
  })
  ```
- [x] Set up basic StateGraph structure
- [x] Export graph builder function

**Files to create:**
- `src/lib/research/graph.ts`

**Test:** Create and run `src/tests/test-graph-structure.ts` to validate state structure

---

#### Task 2.2: Implement Start Node
- [x] In `src/lib/research/graph.ts`, create `startNode` function
- [x] Validate input (personName, linkedinUrl)
- [x] Update status to "Initializing research..."
- [x] Return updated state

**Test:** Add to `src/tests/test-graph-nodes.ts`

---

#### Task 2.3: Implement LinkedIn Fetch Node
- [x] In `src/lib/research/graph.ts`, create `fetchLinkedInNode` function
- [x] Update status to "Fetching LinkedIn profile..."
- [x] Call existing LinkedIn fetch helper from `src/lib/brightdata/linkedin.ts`
- [x] Handle errors gracefully (add to errors array, but don't fail)
- [x] Return state with linkedinData populated

**Test:** Add to `src/tests/test-graph-nodes.ts` with real LinkedIn URL

---

#### Task 2.4: Implement Search Query Generation Node
- [x] In `src/lib/research/graph.ts`, create `generateSearchQueryNode` function
- [x] Update status to "Generating search query..."
- [x] Use LLM service to generate optimized query
- [x] Include person name, exclude LinkedIn domain
- [x] Return state with searchQuery populated

**Test:** Add to `src/tests/test-graph-nodes.ts`

---

#### Task 2.5: Implement Google Search Node
- [x] In `src/lib/research/graph.ts`, create `executeSearchNode` function
- [x] Update status to "Searching the web..."
- [x] Call Bright Data search function
- [x] Filter results (top 10-15, exclude social media aggregators)
- [x] Return state with searchResults populated

**Test:** Add to `src/tests/test-graph-nodes.ts`

---

#### Task 2.6: Implement Parallel Web Scraping (Map-Reduce)
- [x] In `src/lib/research/graph.ts`, create `scrapeWebPageNode` function
  - Takes single URL from state
  - Scrapes content using Bright Data scrape_batch (batch of 1)
  - Validates content size
  - Returns ScrapedContent object
- [x] Create `routeToScraping` conditional edge function
  - Uses Send API to create parallel scraping tasks
  - Returns array of Send objects, one per search result
  ```typescript
  const routeToScraping = (state: ResearchState) => {
    return state.searchResults.map(result =>
      new Send("scrapeWebPage", { url: result.url })
    );
  };
  ```
- [x] Connect nodes with conditional edges (will be wired in Task 2.10)

**Test:** Add to `src/tests/test-graph-parallel.ts`

---

#### Task 2.7: Implement Parallel Summarization (Map-Reduce)
- [x] In `src/lib/research/graph.ts`, create `summarizeContentNode` function
  - Takes single ScrapedContent from state
  - Uses LLM to summarize
  - Handles large content (split if >100KB)
  - Returns WebSummary object (or null if not relevant)
- [x] Create `routeToSummarization` conditional edge function
  - Uses Send API to create parallel summarization tasks
  - Returns array of Send objects, one per scraped content
- [x] Connect nodes with conditional edges (to be wired in Task 2.10)

**Test:** Add to `src/tests/test-graph-parallel.ts`

---

#### Task 2.8: Implement Aggregation Node
- [x] In `src/lib/research/graph.ts`, create `aggregateDataNode` function
- [x] Update status to "Aggregating research data..."
- [x] Wait for all parallel tasks to complete (handled by LangGraph)
- [x] Filter out null summaries
- [x] Validate we have enough data (at least LinkedIn OR 2+ web summaries)
- [x] Return state ready for report generation

**Test:** Add to `src/tests/test-graph-nodes.ts`

---

#### Task 2.9: Implement Writer Node
- [x] In `src/lib/research/graph.ts`, create `writeReportNode` function
- [x] Update status to "Writing research report..."
- [x] Call LLM service `generateResearchReport()`
- [x] Generate comprehensive markdown report
- [x] Include all sources with links
- [x] Return state with finalReport populated

**Test:** Add to `src/tests/test-graph-nodes.ts`

---

- [x] In `src/lib/research/graph.ts`, create `createResearchGraph()` function
- [x] Build StateGraph with all nodes:
  ```typescript
  const graph = new StateGraph(ResearchStateAnnotation)
    .addNode("start", startNode)
    .addNode("fetchLinkedIn", fetchLinkedInNode)
    .addNode("generateSearchQuery", generateSearchQueryNode)
    .addNode("executeSearch", executeSearchNode)
    .addNode("scrapeWebPage", scrapeWebPageNode)
    .addNode("summarizeContent", summarizeContentNode)
    .addNode("aggregateData", aggregateDataNode)
    .addNode("writeReport", writeReportNode)
    .addEdge("__start__", "start")
    .addEdge("start", "fetchLinkedIn")
    .addEdge("start", "generateSearchQuery")
    .addEdge("fetchLinkedIn", "aggregateData")
    .addEdge("generateSearchQuery", "executeSearch")
-    .addConditionalEdges("executeSearch", routeToScraping)
-    .addConditionalEdges("scrapeWebPage", routeToSummarization)
-    .addEdge("summarizeContent", "aggregateData")
-    .addEdge("aggregateData", "writeReport")
-    .addEdge("writeReport", "__end__")
-    .compile({ checkpointer: new MemorySaver() });
  ```
- [x] Export compiled graph
- [x] Add graph visualization helper (optional but recommended)

-**Test:** Create and run `src/tests/test-full-research-graph.ts`
- Test with a real person (e.g., "Satya Nadella")
- Verify parallel execution
- Verify all nodes execute
- Verify final report quality

---

### Phase 3: Database & Caching

#### Task 3.1: Create Research Database Schema
- [ ] Update `prisma/schema.prisma`
- [ ] Add `Research` model:
  ```prisma
  model Research {
    id              String   @id @default(cuid())
    personId        String?  // Foreign key to Person model
    person          Person?  @relation(fields: [personId], references: [id])
    linkedinUrl     String
    personName      String
    report          String   @db.Text // Markdown report
    sources         Json     // Array of source URLs and summaries
    metadata        Json?    // Graph execution metadata
    status          String   // 'pending' | 'processing' | 'completed' | 'failed'
    errorMessage    String?
    createdAt       DateTime @default(now())
    updatedAt       DateTime @updatedAt

    @@index([personId])
    @@index([linkedinUrl])
    @@index([status])
    @@index([createdAt])
  }
  ```
- [ ] Update Person model to add relation:
  ```prisma
  model Person {
    // ... existing fields
    researches      Research[]
  }
  ```
- [ ] Run `npm run db:push` to apply schema changes

**Files to modify:**
- `prisma/schema.prisma`

**Test:** Create and run `src/tests/test-research-schema.ts`

---

#### Task 3.2: Create Research Cache Layer
- [ ] Create `src/lib/cache/research-cache.ts`
- [ ] Implement `getCachedResearch(linkedinUrl: string)` function
  - Check PostgreSQL first
  - Check Redis if not in DB
  - Return null if not found or expired
- [ ] Implement `cacheResearch(research: ResearchOutput)` function
  - Save to PostgreSQL
  - Cache summary in Redis (24hr TTL)
- [ ] Implement `updateResearchStatus(id: string, status: string)` function
- [ ] Add cache invalidation logic

**Files to create:**
- `src/lib/cache/research-cache.ts`

**Test:** Create and run `src/tests/test-research-cache.ts`

---

### Phase 4: API Endpoints

#### Task 4.1: Create Research Initiation Endpoint
- [ ] Create `src/app/api/research/route.ts`
- [ ] Implement POST endpoint `/api/research`
- [ ] Request body: `{ linkedinUrl: string, personName?: string }`
- [ ] Validation:
  - Check if LinkedIn URL is valid
  - Check if research already exists (return cached if fresh)
  - Extract person name from cached profile if not provided
- [ ] Create research record in database with status 'pending'
- [ ] Trigger async graph execution (don't wait for completion)
- [ ] Return research ID and status immediately
- [ ] Response: `{ researchId: string, status: 'pending' }`

**Files to create:**
- `src/app/api/research/route.ts`

**Test:** Create and run `src/tests/test-research-api-initiate.ts`

---

#### Task 4.2: Create Research Status Endpoint
- [ ] Create `src/app/api/research/[id]/route.ts`
- [ ] Implement GET endpoint `/api/research/[id]`
- [ ] Query database for research by ID
- [ ] Return research status and report (if completed)
- [ ] Response:
  ```typescript
  {
    id: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    personName: string,
    linkedinUrl: string,
    report?: string,
    sources?: Array<{url: string, summary: string}>,
    errorMessage?: string,
    createdAt: string,
    updatedAt: string
  }
  ```

**Files to create:**
- `src/app/api/research/[id]/route.ts`

**Test:** Create and run `src/tests/test-research-api-status.ts`

---

#### Task 4.3: Create Research Streaming Endpoint (SSE)
- [ ] Create `src/app/api/research/[id]/stream/route.ts`
- [ ] Implement GET endpoint `/api/research/[id]/stream`
- [ ] Set up Server-Sent Events (SSE)
- [ ] Stream graph execution updates in real-time
- [ ] Send status updates as each node completes:
  ```json
  data: {"type": "status", "message": "Fetching LinkedIn profile...", "node": "fetchLinkedIn"}
  data: {"type": "status", "message": "Searching the web...", "node": "executeSearch"}
  data: {"type": "progress", "completed": 3, "total": 8}
  data: {"type": "result", "report": "...", "status": "completed"}
  ```
- [ ] Handle client disconnection
- [ ] Close stream when graph completes or errors

**Files to create:**
- `src/app/api/research/[id]/stream/route.ts`

**Test:** Create and run `src/tests/test-research-api-stream.ts`

---

#### Task 4.4: Create Research List Endpoint
- [ ] Create `src/app/api/research/list/route.ts`
- [ ] Implement GET endpoint `/api/research/list`
- [ ] Query params: `?limit=20&offset=0&status=completed`
- [ ] Return paginated list of research reports
- [ ] Include person info and summary
- [ ] Sort by createdAt DESC

**Files to create:**
- `src/app/api/research/list/route.ts`

**Test:** Create and run `src/tests/test-research-api-list.ts`

---

### Phase 5: Frontend Implementation

#### Task 5.1: Create Research Loading Page
- [ ] Create `src/app/research/[id]/page.tsx`
- [ ] Implement loading UI with:
  - Person name and LinkedIn avatar
  - Progress indicator showing current node
  - List of completed steps with checkmarks
  - Animated progress bar
  - Real-time status messages from SSE
- [ ] Connect to `/api/research/[id]/stream` endpoint
- [ ] Use Framer Motion for smooth animations
- [ ] Handle different states: pending, processing, completed, failed

**Files to create:**
- `src/app/research/[id]/page.tsx`
- `src/components/ResearchProgress.tsx`

**Test:** Manual testing with real research execution

---

#### Task 5.2: Create Research Report Display Component
- [ ] Create `src/components/ResearchReport.tsx`
- [ ] Implement markdown rendering (use react-markdown)
- [ ] Add syntax highlighting for code blocks (if any)
- [ ] Add collapsible sections
- [ ] Add "Copy to clipboard" button
- [ ] Add "Download as PDF" button (optional)
- [ ] Add source citations with hover tooltips
- [ ] Responsive design

**Files to create:**
- `src/components/ResearchReport.tsx`

**Dependencies:**
- Install `react-markdown` and `remark-gfm`

**Test:** Manual testing with sample markdown reports

---

#### Task 5.3: Update Search Results Page
- [ ] Modify `src/app/search/page.tsx`
- [ ] Replace "View Details" button with "Research Person" button
- [ ] On click:
  - Call `/api/research` POST endpoint
  - Get research ID
  - Navigate to `/research/[id]` page
- [ ] Add loading state while initiating research
- [ ] Show error if research initiation fails

**Files to modify:**
- `src/app/search/page.tsx`
- `src/components/ProfileSummaryCard.tsx` (if button is there)

**Test:** Manual end-to-end testing

---

#### Task 5.4: Create Research History Page
- [ ] Create `src/app/research/page.tsx`
- [ ] Display list of all research reports
- [ ] Filter by status (All, Completed, Failed)
- [ ] Search by person name
- [ ] Pagination
- [ ] Click to view full report
- [ ] Add to navigation menu

**Files to create:**
- `src/app/research/page.tsx`
- `src/components/ResearchList.tsx`
- `src/components/ResearchCard.tsx`

**Files to modify:**
- `src/components/Navigation.tsx` (add Research link)

**Test:** Manual testing with multiple research reports

---

### Phase 6: Optimization & Polish

#### Task 6.1: Add Request Deduplication
- [ ] In `src/lib/research/graph.ts`, add request deduplication
- [ ] If same person is being researched, return existing research ID
- [ ] Use Redis to track in-progress research
- [ ] Prevent duplicate API calls

**Test:** Create and run `src/tests/test-research-dedup.ts`

---

#### Task 6.2: Add Error Handling & Retry Logic
- [ ] In graph nodes, add comprehensive error handling
- [ ] Retry failed Bright Data API calls (max 3 attempts)
- [ ] Gracefully degrade if LinkedIn fetch fails
- [ ] Continue with web search if some scrapes fail
- [ ] Log all errors to database

**Test:** Create and run `src/tests/test-research-error-handling.ts`
- Test with invalid LinkedIn URL
- Test with network failures
- Test with API rate limits

---

#### Task 6.3: Add Rate Limiting
- [ ] Create `src/lib/research/rate-limiter.ts`
- [ ] Implement rate limiting for research endpoint:
  - Max 5 research requests per user per hour
  - Max 100 research requests per day globally
- [ ] Use Redis for rate limit tracking
- [ ] Return 429 error with retry-after header

**Files to create:**
- `src/lib/research/rate-limiter.ts`

**Test:** Create and run `src/tests/test-rate-limiter.ts`

---

#### Task 6.4: Add Cost Tracking & Monitoring
- [ ] Create `src/lib/research/cost-tracker.ts`
- [ ] Track costs for:
  - LLM token usage (Gemini)
  - Bright Data API calls (search + scrape)
- [ ] Store cost metadata in research record
- [ ] Add admin endpoint to view total costs
- [ ] Set up alerts if costs exceed thresholds

**Files to create:**
- `src/lib/research/cost-tracker.ts`
- `src/app/api/admin/research-costs/route.ts`

**Test:** Create and run `src/tests/test-cost-tracking.ts`

---

#### Task 6.5: Optimize LLM Context Windows
- [ ] Implement content chunking for large web pages
- [ ] Add intelligent content extraction (remove boilerplate)
- [ ] Limit scraped content to 50KB per page max
- [ ] Summarize long LinkedIn profiles before feeding to writer
- [ ] Add token counting before each LLM call
- [ ] Warn if approaching context limits

**Test:** Create and run `src/tests/test-context-optimization.ts`
- Test with very large web pages (>200KB)
- Verify token counts stay within limits

---

#### Task 6.6: Add Graph Execution Timeout
- [ ] Set maximum execution time: 5 minutes
- [ ] If graph doesn't complete in time, mark as failed
- [ ] Save partial results if available
- [ ] Allow manual retry

**Test:** Create and run `src/tests/test-graph-timeout.ts`

---

### Phase 7: Testing & Documentation

#### Task 7.1: Create Comprehensive Integration Test
- [ ] Create `src/tests/test-research-integration.ts`
- [ ] Test full flow end-to-end:
  1. Initiate research via API
  2. Poll status endpoint
  3. Verify graph execution
  4. Verify report generation
  5. Verify caching
  6. Verify second request returns cached result
- [ ] Test with 3 different people
- [ ] Verify parallel execution works correctly
- [ ] Measure total execution time

**Files to create:**
- `src/tests/test-research-integration.ts`

**Test:** Run this test to validate entire feature

---

#### Task 7.2: Create Performance Benchmarks
- [ ] Create `src/tests/benchmark-research.ts`
- [ ] Measure:
  - Average graph execution time
  - Parallel vs sequential scraping time difference
  - LLM call latencies
  - Database query performance
  - Cache hit rate
- [ ] Generate performance report

**Files to create:**
- `src/tests/benchmark-research.ts`

**Test:** Run benchmark and analyze results

---

#### Task 7.3: Update API Documentation
- [ ] Create `docs/api/research.md`
- [ ] Document all research endpoints:
  - POST /api/research
  - GET /api/research/[id]
  - GET /api/research/[id]/stream
  - GET /api/research/list
- [ ] Include request/response examples
- [ ] Document error codes
- [ ] Document rate limits

**Files to create:**
- `docs/api/research.md`

---

#### Task 7.4: Update README
- [ ] Update main `README.md`
- [ ] Add "Person Research" feature section
- [ ] Add architecture diagram
- [ ] Add usage examples
- [ ] Add environment variables needed:
  - `GOOGLE_GENERATIVE_AI_API_KEY`
  - `BRIGHTDATA_API_TOKEN`
  - Existing Redis/Database vars
- [ ] Add troubleshooting section

**Files to modify:**
- `README.md`

---

#### Task 7.5: Create Developer Guide
- [ ] Create `docs/research-feature-guide.md`
- [ ] Explain LangGraph architecture
- [ ] Explain parallel execution with Send API
- [ ] Explain state management
- [ ] Provide code examples for extending the graph
- [ ] Document how to add new nodes
- [ ] Document how to modify prompts

**Files to create:**
- `docs/research-feature-guide.md`

---

## Test Files Summary

All tests should use real API keys and execute actual flows:

1. `src/tests/test-langgraph-install.ts` - Verify LangGraph installation
2. `src/tests/test-research-types.ts` - Validate type definitions
3. `src/tests/test-brightdata-research.ts` - Test Bright Data integration
4. `src/tests/test-llm-service.ts` - Test LLM functions
5. `src/tests/test-graph-structure.ts` - Test graph state structure
6. `src/tests/test-graph-nodes.ts` - Test individual nodes
7. `src/tests/test-graph-parallel.ts` - Test parallel execution
8. `src/tests/test-full-research-graph.ts` - Test complete graph
9. `src/tests/test-research-schema.ts` - Test database schema
10. `src/tests/test-research-cache.ts` - Test caching layer
11. `src/tests/test-research-api-initiate.ts` - Test research initiation
12. `src/tests/test-research-api-status.ts` - Test status endpoint
13. `src/tests/test-research-api-stream.ts` - Test SSE streaming
14. `src/tests/test-research-api-list.ts` - Test list endpoint
15. `src/tests/test-research-dedup.ts` - Test deduplication
16. `src/tests/test-research-error-handling.ts` - Test error handling
17. `src/tests/test-rate-limiter.ts` - Test rate limiting
18. `src/tests/test-cost-tracking.ts` - Test cost tracking
19. `src/tests/test-context-optimization.ts` - Test context window optimization
20. `src/tests/test-graph-timeout.ts` - Test timeout handling
21. `src/tests/test-research-integration.ts` - Full integration test
22. `src/tests/benchmark-research.ts` - Performance benchmarks

---

## Environment Variables Required

Add to `.env`:

```env
# Existing variables
DATABASE_URL=...
REDIS_HOST=...
REDIS_PORT=...
REDIS_PASSWORD=...
BRIGHTDATA_API_TOKEN=...
GOOGLE_GENERATIVE_AI_API_KEY=...

# New variables (optional)
RESEARCH_MAX_SCRAPE_PAGES=15
RESEARCH_TIMEOUT_MS=300000
RESEARCH_RATE_LIMIT_PER_HOUR=5
RESEARCH_ENABLE_COST_TRACKING=true
```

---

## Success Criteria

- [ ] User can click "Research Person" button on search results
- [ ] Loading page shows real-time progress of multi-agent system
- [ ] Graph executes LinkedIn fetch and web searches in parallel
- [ ] Web scraping and summarization happen in parallel (map-reduce)
- [ ] Final report is comprehensive, well-formatted, and accurate
- [ ] Research is cached and subsequent requests return immediately
- [ ] All tests pass with real API calls
- [ ] Average execution time < 2 minutes for full research
- [ ] No context window errors with large web pages
- [ ] Cost per research report < $0.50

---

## Estimated Timeline

- **Phase 1:** Backend Infrastructure - 1 day
- **Phase 2:** LangGraph Workflow - 2-3 days
- **Phase 3:** Database & Caching - 0.5 day
- **Phase 4:** API Endpoints - 1 day
- **Phase 5:** Frontend Implementation - 1.5 days
- **Phase 6:** Optimization & Polish - 1 day
- **Phase 7:** Testing & Documentation - 1 day

**Total:** ~8-9 days

---

## Notes

- Use Gemini 2.0 Flash for all LLM operations (fast + cheap)
- Monitor token usage carefully to avoid excessive costs
- Implement graceful degradation: if LinkedIn fails, continue with web search
- Cache aggressively: same person research should return in <500ms
- Use streaming for better UX during long operations
- Consider adding human-in-the-loop for query refinement (future enhancement)
- Consider adding source credibility scoring (future enhancement)

---

## LangGraph Key Concepts Used

1. **StateGraph** - Core graph structure with typed state
2. **Annotation.Root** - Define state schema with reducers
3. **Send API** - Dynamic parallel execution (map-reduce pattern)
4. **Conditional Edges** - Route to multiple nodes dynamically
5. **MemorySaver** - Checkpointing for debugging and resumption
6. **Streaming** - Real-time progress updates via streamEvents()

---

## Dependencies to Install

```bash
npm install @langchain/langgraph @langchain/core @langchain/community
npm install react-markdown remark-gfm
npm install date-fns # for date formatting in reports
```

---

## Architecture Decisions

### Why LangGraph JS?
- Built-in parallelization with Send API
- State management with checkpointing
- Streaming support for real-time updates
- Error handling and retry mechanisms
- Clear graph visualization for debugging

### Why Parallel Execution?
- LinkedIn fetch can take 30-120 seconds
- Web scraping can take 10-30 seconds per page
- By running in parallel, we reduce total time from ~5 minutes to ~2 minutes
- Map-reduce pattern allows us to process unlimited web pages efficiently

### Why LLM for Everything?
- Flexible query generation based on person context
- Intelligent content extraction (not just regex)
- High-quality summarization that filters noise
- Coherent report writing that synthesizes multiple sources
- Handles edge cases better than rule-based systems

### Why Streaming?
- Better UX - user sees progress in real-time
- Can display partial results
- User knows system is working (not stuck)
- Can cancel if taking too long

---

## Future Enhancements (Not in This Plan)

1. **Multi-modal research** - Include images, videos from web
2. **Citation verification** - Verify facts across multiple sources
3. **Sentiment analysis** - Analyze how person is portrayed online
4. **Competitive analysis** - Compare person to peers in their field
5. **Historical tracking** - Track changes in person's online presence over time
6. **Email report delivery** - Send completed report via email
7. **Bulk research** - Research multiple people in one request
8. **Custom research templates** - Allow users to customize report format

---

## Completion Checklist

After ALL tasks are complete, verify:

- [ ] All 22 tests pass
- [ ] Research can be initiated from search page
- [ ] Loading page shows real-time progress
- [ ] Final report is displayed correctly
- [ ] Reports are cached properly
- [ ] Rate limiting works
- [ ] Error handling is robust
- [ ] Documentation is complete
- [ ] Code is well-commented
- [ ] No console errors in browser
- [ ] No memory leaks during graph execution
- [ ] Performance benchmarks meet targets

---

**End of Plan**
