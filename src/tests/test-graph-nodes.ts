/**
 * Node-level tests for the research graph.
 * Run with: npx tsx src/tests/test-graph-nodes.ts
 */

import assert from 'node:assert/strict';
import { Send } from '@langchain/langgraph';
import {
  startNode,
  createFetchLinkedInNode,
  createGenerateSearchQueryNode,
  createExecuteSearchNode,
  createScrapeWebPageNode,
  createSummarizeContentNode,
  createWriteReportNode,
  aggregateDataNode,
  type ResearchGraphState,
  type ResearchGraphUpdate,
} from '@/lib/research/graph';
import type { ProfileData } from '@/types/linkedin';
import type { SearchQueryResult, SummarizeResult, ResearchReportResult } from '@/lib/research/llm-service';
import type { SearchResult } from '@/lib/research/types';

function createState(
  overrides: Partial<ResearchGraphState> = {},
): ResearchGraphState {
  return {
    personName: '',
    linkedinUrl: '',
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

function expectStateUpdate(
  update: Partial<ResearchGraphUpdate> | Send[],
): asserts update is Partial<ResearchGraphUpdate> {
  assert.ok(!Array.isArray(update), 'Expected state update, received Send commands');
}

async function testStartNodeSuccess() {
  const state = createState({
    personName: '  Ada Lovelace ',
    linkedinUrl: ' https://www.linkedin.com/in/ada-lovelace ',
  });
  const update = await startNode(state);
  expectStateUpdate(update);
  assert.equal(update.personName, 'Ada Lovelace');
  assert.equal(update.linkedinUrl, 'https://www.linkedin.com/in/ada-lovelace');
  assert.equal(update.status, 'Initializing research...');
  console.log('✅ startNode trims inputs and updates status.');
}

async function testStartNodeValidation() {
  const state = createState({
    personName: '   ',
    linkedinUrl: 'https://linkedin.com/in/test',
  });
  let threw = false;
  try {
    await startNode(state);
  } catch {
    threw = true;
    console.log('✅ startNode rejects when personName is missing.');
  }
  assert.ok(threw, 'startNode should throw when personName is empty');
}

async function run() {
  await testStartNodeSuccess();
  await testStartNodeValidation();
  await testFetchLinkedInNodeSuccess();
  await testFetchLinkedInNodeError();
  await testGenerateSearchQueryNodeSuccess();
  await testGenerateSearchQueryNodeError();
  await testExecuteSearchNodeSuccess();
  await testExecuteSearchNodeError();
  await testScrapeWebPageNodeSuccess();
  await testScrapeWebPageNodeError();
  await testSummarizeContentNodeSuccess();
  await testSummarizeContentNodeError();
  await testAggregateDataNodeWithSummaries();
  await testAggregateDataNodeLinkedInOnly();
  await testAggregateDataNodeInsufficient();
  await testWriteReportNodeSuccess();
  await testWriteReportNodeError();
  console.log('\n🎉 Node tests completed.');
}

run().catch((error) => {
  console.error('❌ Node tests failed:', error);
  process.exit(1);
});

async function testFetchLinkedInNodeSuccess() {
  const mockProfile: ProfileData = {
    linkedinUrl: 'https://linkedin.com/in/test',
    linkedinId: 'test',
    firstName: 'Test',
    lastName: 'User',
    fullName: 'Test User',
  };

  const node = createFetchLinkedInNode(async () => mockProfile);
  const state = createState({
    linkedinUrl: mockProfile.linkedinUrl,
  });

  const update = await node(state);
  expectStateUpdate(update);
  assert.equal(update.linkedinData, mockProfile);
  assert.equal(update.status, 'Fetching LinkedIn profile...');
  console.log('✅ fetchLinkedInNode stores LinkedIn data when fetch succeeds.');
}

async function testFetchLinkedInNodeError() {
  const node = createFetchLinkedInNode(async () => {
    throw new Error('API failure');
  });

  const state = createState({
    linkedinUrl: 'https://linkedin.com/in/error-case',
  });

  const update = await node(state);
  expectStateUpdate(update);
  assert.equal(update.status, 'LinkedIn profile unavailable');
  assert.ok(update.errors && update.errors.length > 0);
  console.log('✅ fetchLinkedInNode captures errors without throwing.');
}

async function testGenerateSearchQueryNodeSuccess() {
  const mockResult: SearchQueryResult = {
    query: '"Ada Lovelace" interview -site:linkedin.com',
    rationale: 'Focus on interviews and exclude LinkedIn',
    source: 'llm',
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
  };

  const node = createGenerateSearchQueryNode(async () => mockResult);
  const state = createState({
    personName: 'Ada Lovelace',
    linkedinUrl: 'https://linkedin.com/in/ada-lovelace',
  });

  const update = await node(state);
  expectStateUpdate(update);
  assert.equal(update.searchQuery, mockResult.query);
  assert.equal(update.status, 'Generating search query...');
  console.log('✅ generateSearchQueryNode stores query when generation succeeds.');
}

async function testGenerateSearchQueryNodeError() {
  const node = createGenerateSearchQueryNode(async () => {
    throw new Error('Rate limited');
  });

  const state = createState({
    personName: 'Ada Lovelace',
    linkedinUrl: 'https://linkedin.com/in/ada-lovelace',
  });

  const update = await node(state);
  expectStateUpdate(update);
  assert.equal(update.status, 'Search query unavailable');
  assert.ok(update.errors && update.errors.length > 0);
  console.log('✅ generateSearchQueryNode captures errors and updates status.');
}

async function testExecuteSearchNodeSuccess() {
  const mockResults: SearchResult[] = [
    {
      title: 'Ada Lovelace Biography',
      url: 'https://example.com/ada',
      snippet: 'A detailed biography.',
      rank: 1,
      source: 'example.com',
    },
    {
      title: 'Ada Lovelace Profile',
      url: 'https://www.linkedin.com/in/ada',
      snippet: 'LinkedIn profile',
      rank: 2,
      source: 'linkedin.com',
    },
  ];

  const node = createExecuteSearchNode(async () => mockResults);
  const state = createState({
    personName: 'Ada Lovelace',
    linkedinUrl: 'https://linkedin.com/in/ada',
    searchQuery: '"Ada Lovelace"',
  });

  const update = await node(state);
  expectStateUpdate(update);
  assert.equal(update.status, 'Searching the web...');
  assert.equal(update.searchResults?.length, 1);
  assert.equal(update.searchResults?.[0].url, 'https://example.com/ada');
  console.log('✅ executeSearchNode filters results and updates state.');
}

async function testExecuteSearchNodeError() {
  const node = createExecuteSearchNode(async () => {
    throw new Error('Bright Data unavailable');
  });

  const state = createState({
    personName: 'Ada Lovelace',
    linkedinUrl: 'https://linkedin.com/in/ada',
    searchQuery: '"Ada Lovelace"',
  });

  const update = await node(state);
  expectStateUpdate(update);
  assert.equal(update.status, 'Web search unavailable');
  assert.ok(update.errors && update.errors.length > 0);
  console.log('✅ executeSearchNode logs errors without throwing.');
}

async function testScrapeWebPageNodeSuccess() {
  const node = createScrapeWebPageNode(async () => [
    {
      url: 'https://example.com/detail',
      content: '<html>content</html>',
      bytes: 128,
      fetchedAt: Date.now(),
    },
  ]);

  const state = createState({
    searchResults: [
      {
        title: 'Example',
        url: 'https://example.com/detail',
        snippet: 'snippet',
        rank: 1,
        source: 'example.com',
      },
    ],
  });

  const update = await node(state);
  expectStateUpdate(update);
  assert.equal(update.status, 'Scraped https://example.com/detail');
  const scraped = Array.isArray(update.scrapedContents)
    ? update.scrapedContents[0]
    : update.scrapedContents;
  assert.equal(scraped?.url, 'https://example.com/detail');
  console.log('✅ scrapeWebPageNode adds scraped content to state.');
}

async function testScrapeWebPageNodeError() {
  const node = createScrapeWebPageNode(async () => {
    throw new Error('Scrape failed');
  });

  const state = createState({
    searchResults: [
      {
        title: 'Example',
        url: 'https://example.com/detail',
        snippet: 'snippet',
        rank: 1,
        source: 'example.com',
      },
    ],
  });

  const update = await node(state);
  expectStateUpdate(update);
  assert.equal(update.status, 'Scraping failed');
  assert.ok(update.errors && update.errors.length > 0);
  console.log('✅ scrapeWebPageNode records scraping errors.');
}

async function testSummarizeContentNodeSuccess() {
  const mockSummary: SummarizeResult = {
    url: 'https://example.com/detail',
    summary: 'Ada Lovelace pioneered algorithms for the Analytical Engine.',
    keyPoints: ['Worked with Charles Babbage'],
    mentionsPerson: true,
    sentiment: 'positive',
    confidence: 0.82,
    usage: { inputTokens: 120, outputTokens: 40, totalTokens: 160 },
  };

  const node = createSummarizeContentNode(async () => mockSummary);
  const state = createState({
    personName: 'Ada Lovelace',
    scrapedContents: [
      {
        url: 'https://example.com/detail',
        content: 'Ada Lovelace collaborated with Charles Babbage to design algorithms.',
        bytes: 128,
        fetchedAt: Date.now(),
      },
    ],
  });

  const update = await node(state);
  expectStateUpdate(update);
  assert.equal(update.status, 'Summarized https://example.com/detail');
  const summary = Array.isArray(update.webSummaries)
    ? update.webSummaries[0]
    : update.webSummaries;
  assert.equal(summary?.summary, mockSummary.summary);
  console.log('✅ summarizeContentNode stores web summary when LLM succeeds.');
}

async function testSummarizeContentNodeError() {
  const node = createSummarizeContentNode(async () => {
    throw new Error('LLM unavailable');
  });

  const state = createState({
    personName: 'Ada Lovelace',
    scrapedContents: [
      {
        url: 'https://example.com/detail',
        content: 'Sample content',
        bytes: 64,
        fetchedAt: Date.now(),
      },
    ],
  });

  const update = await node(state);
  expectStateUpdate(update);
  assert.equal(update.status, 'Summary failed');
  assert.ok(update.errors && update.errors.length > 0);
  console.log('✅ summarizeContentNode captures LLM errors gracefully.');
}

async function testAggregateDataNodeWithSummaries() {
  const state = createState({
    webSummaries: [
      {
        url: 'https://example.com/a',
        summary: 'Example summary A',
        keyPoints: ['A'],
        mentionsPerson: true,
      },
      {
        url: 'https://example.com/a',
        summary: 'Duplicate summary A',
        keyPoints: ['B'],
        mentionsPerson: true,
      },
    ],
  });

  const update = await aggregateDataNode(state);
  expectStateUpdate(update);
  assert.equal(update.status, 'Aggregation complete');
  const summaries = Array.isArray(update.webSummaries)
    ? update.webSummaries
    : update.webSummaries
    ? [update.webSummaries]
    : [];
  assert.equal(summaries.length, 1, 'Duplicate summaries should dedupe');
  console.log('✅ aggregateDataNode dedupes summaries and marks aggregation complete.');
}

async function testAggregateDataNodeLinkedInOnly() {
  const state = createState({
    linkedinData: {
      linkedinUrl: 'https://linkedin.com/in/test',
      linkedinId: 'test',
      firstName: 'Test',
      lastName: 'User',
      fullName: 'Test User',
    },
    webSummaries: [],
  });

  const update = await aggregateDataNode(state);
  expectStateUpdate(update);
  assert.equal(update.status, 'Aggregation complete (LinkedIn only)');
  console.log('✅ aggregateDataNode allows LinkedIn-only data.');
}

async function testAggregateDataNodeInsufficient() {
  const state = createState({
    webSummaries: [],
  });

  const update = await aggregateDataNode(state);
  expectStateUpdate(update);
  assert.equal(update.status, 'Insufficient research data');
  assert.ok(update.errors && update.errors.length > 0);
  console.log('✅ aggregateDataNode reports insufficient data when needed.');
}

async function testWriteReportNodeSuccess() {
  const mockReport: ResearchReportResult = {
    report: '# Report\nDetails',
    sources: ['https://example.com/a'],
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    source: 'llm',
  };

  const node = createWriteReportNode(async () => mockReport);
  const state = createState({
    personName: 'Ada Lovelace',
    linkedinUrl: 'https://linkedin.com/in/ada',
    webSummaries: [
      {
        url: 'https://example.com/a',
        summary: 'Summary',
        keyPoints: ['Point'],
        mentionsPerson: true,
      },
    ],
  });

  const update = await node(state);
  expectStateUpdate(update);
  assert.equal(update.finalReport, mockReport.report);
  assert.equal(update.status, 'Report ready');
  console.log('✅ createWriteReportNode stores final report when generation succeeds.');
}

async function testWriteReportNodeError() {
  const node = createWriteReportNode(async () => {
    throw new Error('Report failure');
  });

  const state = createState({
    personName: 'Ada Lovelace',
    linkedinUrl: 'https://linkedin.com/in/ada',
    webSummaries: [
      {
        url: 'https://example.com/a',
        summary: 'Summary',
        keyPoints: ['Point'],
        mentionsPerson: true,
      },
    ],
  });

  const update = await node(state);
  expectStateUpdate(update);
  assert.equal(update.status, 'Report generation failed');
  assert.ok(update.errors && update.errors.length > 0);
  console.log('✅ createWriteReportNode captures generation errors.');
}
