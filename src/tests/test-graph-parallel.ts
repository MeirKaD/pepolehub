/**
 * Tests for parallel routing helpers (routeToScraping).
 * Run with: npx tsx src/tests/test-graph-parallel.ts
 */

import assert from 'node:assert/strict';
import { routeToScraping, routeToSummarization, ResearchNodeNames, type ResearchGraphState } from '@/lib/research/graph';
import type { SearchResult, ScrapedContent } from '@/lib/research/types';
import { Send } from '@langchain/langgraph';

function createState(overrides: Partial<ResearchGraphState> = {}): ResearchGraphState {
  return {
    personName: 'Test Person',
    linkedinUrl: 'https://www.linkedin.com/in/test',
    linkedinData: null,
    searchQuery: null,
    searchResults: [],
    scrapedContents: [],
    webSummaries: [],
    finalReport: null,
    errors: [],
    status: '',
    ...overrides,
  };
}

function createSearchResult(url: string, source: string, rank: number): SearchResult {
  return {
    title: `Result ${rank}`,
    url,
    snippet: 'snippet',
    rank,
    source,
  };
}

function createScrapedContent(url: string): ScrapedContent {
  return {
    url,
    content: 'mock content',
    bytes: 64,
    fetchedAt: Date.now(),
  };
}

async function run() {
  await testRouteToScrapingProducesSends();
  await testRouteToScrapingEmpty();
  await testRouteToSummarizationProducesSends();
  await testRouteToSummarizationEmpty();
  console.log('\n🎯 Parallel routing tests completed.');
}

run().catch((error) => {
  console.error('❌ Parallel routing tests failed:', error);
  process.exit(1);
});

async function testRouteToScrapingProducesSends() {
  const state = createState({
    searchResults: [
      createSearchResult('https://example.com/a', 'example.com', 1),
      createSearchResult('https://example.com/b', 'example.com', 2),
    ],
  });

  const sends = routeToScraping(state);
  assert.equal(sends.length, 2);
  sends.forEach((send, idx) => {
    assert.ok(send instanceof Send);
    assert.equal(send.node, ResearchNodeNames.SCRAPE_WEB_PAGE);
    assert.equal((send.args as ResearchGraphState & { url: string }).url, state.searchResults[idx].url);
  });
  console.log('✅ routeToScraping emits Send commands for each result.');
}

async function testRouteToScrapingEmpty() {
  const state = createState();
  const sends = routeToScraping(state);
  assert.equal(sends.length, 0);
  console.log('✅ routeToScraping returns empty array when there are no search results.');
}

async function testRouteToSummarizationProducesSends() {
  const state = createState({
    scrapedContents: [
      createScrapedContent('https://example.com/a'),
      createScrapedContent('https://example.com/b'),
    ],
  });

  const sends = routeToSummarization(state);
  assert.equal(sends.length, 2);
  sends.forEach((send, idx) => {
    assert.ok(send instanceof Send);
    assert.equal(send.node, ResearchNodeNames.SUMMARIZE_CONTENT);
    const args = send.args as ResearchGraphState & { scrapedContent: ScrapedContent };
    assert.equal(args.scrapedContent?.url, state.scrapedContents[idx].url);
  });
  console.log('✅ routeToSummarization emits Send commands for each scraped page.');
}

async function testRouteToSummarizationEmpty() {
  const state = createState();
  const sends = routeToSummarization(state);
  assert.equal(sends.length, 0);
  console.log('✅ routeToSummarization returns empty array when there are no scraped contents.');
}
