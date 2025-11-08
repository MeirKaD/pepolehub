import { Send, StateGraph, MemorySaver, START, END } from '@langchain/langgraph';
import { fetchLinkedInProfile } from '@/lib/brightdata/linkedin';
import type { ProfileData } from '@/types/linkedin';
import { searchGoogleForPerson, scrapeUrls, type PersonSearchOptions, type ScrapeOptions } from '@/lib/brightdata/research';
import { generateSearchQuery, summarizeWebContent, generateResearchReport } from './llm-service';
import type { SearchQueryResult, SummarizeResult, ResearchReportResult } from './llm-service';
import { ResearchStateAnnotation } from './types';
import type { ResearchDataBundle, SearchResult, ScrapedContent, ResearchState, WebSummary } from './types';

export type ResearchGraphState = typeof ResearchStateAnnotation.State;
export type ResearchGraphUpdate = typeof ResearchStateAnnotation.Update;
export type ResearchNodeHandler = (
  state: ResearchGraphState,
) =>
  | Partial<ResearchGraphUpdate>
  | Promise<Partial<ResearchGraphUpdate>>
  | Send[];

export const ResearchNodeNames = {
  START: 'start',
  FETCH_LINKEDIN: 'fetchLinkedIn',
  GENERATE_SEARCH_QUERY: 'generateSearchQuery',
  EXECUTE_SEARCH: 'executeSearch',
  SCRAPE_WEB_PAGE: 'scrapeWebPage',
  SUMMARIZE_CONTENT: 'summarizeContent',
  AGGREGATE_DATA: 'aggregateData',
  WRITE_REPORT: 'writeReport',
} as const;

export type ResearchNodeName =
  (typeof ResearchNodeNames)[keyof typeof ResearchNodeNames];

export const startNode: ResearchNodeHandler = async (state) => {
  const personName = (state.personName ?? '').trim();
  if (!personName) {
    throw new Error('personName is required to start research');
  }

  const linkedinUrl = (state.linkedinUrl ?? '').trim();
  if (!linkedinUrl) {
    throw new Error('linkedinUrl is required to start research');
  }

  return {
    personName,
    linkedinUrl,
    status: 'Initializing research...',
  };
};

type FetchLinkedInProfileFn = (url: string) => Promise<ProfileData>;

type GenerateSearchQueryFn = (
  personName: string,
  linkedinUrl: string,
  context?: string,
) => Promise<SearchQueryResult>;

type SearchPersonFn = (
  personName: string,
  linkedinUrl: string,
  options?: PersonSearchOptions,
) => Promise<SearchResult[]>;

type ScrapeUrlsFn = (urls: string[], options?: ScrapeOptions) => Promise<ScrapedContent[]>;
type SummarizeContentFn = (
  url: string,
  content: string,
  personName: string,
) => Promise<SummarizeResult | null>;
type GenerateReportFn = (bundle: ResearchDataBundle) => Promise<ResearchReportResult>;

export function createScrapeWebPageNode(
  scrapeFn: ScrapeUrlsFn = scrapeUrls,
): ResearchNodeHandler {
  return async (state) => {
    const payload = state as unknown as { url?: string; metadata?: Partial<ScrapedContent> };
    const url = payload.url ?? state.searchResults?.[0]?.url;

    if (!url) {
      return {
        status: 'Scraping skipped',
        errors: ['No URL provided for scraping'],
      };
    }

    try {
      const results = await scrapeFn([url]);
      if (!results.length) {
        return {
          status: 'Scraping produced no content',
          errors: [`No content returned for ${url}`],
        };
      }

      const content = {
        ...results[0],
        metadata: {
          ...payload.metadata,
          ...(results[0].metadata ?? {}),
        },
      };

      return {
        scrapedContents: content,
        status: `Scraped ${url}`,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown scraping error';
      return {
        status: 'Scraping failed',
        errors: [`Scrape error: ${message}`],
      };
    }
  };
}

export function createFetchLinkedInNode(
  fetchProfile: FetchLinkedInProfileFn = fetchLinkedInProfile,
): ResearchNodeHandler {
  return async (state) => {
    const linkedinUrl = state.linkedinUrl?.trim();
    if (!linkedinUrl) {
      return {
        status: 'LinkedIn URL missing',
        errors: ['Cannot fetch LinkedIn profile: linkedinUrl is missing'],
      };
    }

    try {
      const profile = await fetchProfile(linkedinUrl);
      return {
        linkedinData: profile,
        status: 'Fetching LinkedIn profile...',
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown LinkedIn fetch error';
      return {
        status: 'LinkedIn profile unavailable',
        errors: [`LinkedIn fetch error: ${message}`],
      };
    }
  };
}

export const fetchLinkedInNode = createFetchLinkedInNode();

export function createGenerateSearchQueryNode(
  generateQuery: GenerateSearchQueryFn = generateSearchQuery,
): ResearchNodeHandler {
  return async (state) => {
    const personName = state.personName?.trim();
    const linkedinUrl = state.linkedinUrl?.trim();

    if (!personName || !linkedinUrl) {
      return {
        status: 'Search query unavailable',
        errors: ['Cannot generate search query: missing personName or linkedinUrl'],
      };
    }

    try {
      const result = await generateQuery(personName, linkedinUrl);
      return {
        searchQuery: result.query,
        status: 'Generating search query...',
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown search query error';
      return {
        status: 'Search query unavailable',
        errors: [`Search query error: ${message}`],
      };
    }
  };
}

export const generateSearchQueryNode = createGenerateSearchQueryNode();

export function createExecuteSearchNode(
  searchPeople: SearchPersonFn = searchGoogleForPerson,
): ResearchNodeHandler {
  return async (state) => {
    const personName = state.personName?.trim();
    const linkedinUrl = state.linkedinUrl?.trim();

    if (!personName || !linkedinUrl) {
      return {
        status: 'Web search unavailable',
        errors: ['Cannot execute search: missing personName or linkedinUrl'],
      };
    }

    const options: PersonSearchOptions = {
      maxResults: MAX_SEARCH_RESULTS,
    };

    if (state.searchQuery?.trim()) {
      options.query = state.searchQuery.trim();
    } else if (state.linkedinData?.headline) {
      options.context = state.linkedinData.headline;
    }

    try {
      const results = await searchPeople(personName, linkedinUrl, options);
      const filtered = filterSearchResults(results, MAX_SEARCH_RESULTS);
      return {
        searchResults: filtered,
        status: 'Searching the web...',
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown search error';
      return {
        status: 'Web search unavailable',
        errors: [`Web search error: ${message}`],
      };
    }
  };
}

export const executeSearchNode = createExecuteSearchNode();

export function createSummarizeContentNode(
  summarizeFn: SummarizeContentFn = summarizeWebContent,
): ResearchNodeHandler {
  return async (state) => {
    const payload = state as ResearchGraphState & { scrapedContent?: ScrapedContent };
    const target = payload.scrapedContent ?? state.scrapedContents?.[0];

    if (!target) {
      return {
        status: 'Summary skipped',
        errors: ['No scraped content provided for summarization'],
      };
    }

    const content = target.content?.trim();
    if (!content) {
      return {
        status: 'Summary skipped',
        errors: [`Scraped content for ${target.url} is empty`],
      };
    }

    const personName = state.personName?.trim();
    if (!personName) {
      return {
        status: 'Summary skipped',
        errors: ['Cannot summarize without personName'],
      };
    }

    try {
      const summary = await summarizeFn(target.url, content, personName);
      if (!summary) {
        return {
          status: `No relevant summary for ${target.url}`,
        };
      }

      const normalized: WebSummary = {
        url: summary.url || target.url,
        summary: summary.summary,
        keyPoints: summary.keyPoints,
        mentionsPerson: summary.mentionsPerson,
        sentiment: summary.sentiment,
        confidence: summary.confidence,
        source: summary.source ?? target.metadata?.source,
        rawExcerpt: summary.rawExcerpt,
      };

      return {
        webSummaries: normalized,
        status: `Summarized ${normalized.url}`,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown summarization error';
      return {
        status: 'Summary failed',
        errors: [`Summary error: ${message}`],
      };
    }
  };
}

export const summarizeContentNode = createSummarizeContentNode();

export const aggregateDataNode: ResearchNodeHandler = async (state) => {
  const summaries = (state.webSummaries ?? []).filter(
    (summary): summary is WebSummary => Boolean(summary?.summary?.trim()),
  );

  if (!state.linkedinData && summaries.length < 1) {
    return {
      status: 'Insufficient research data',
      errors: ['Need LinkedIn data or at least one web summary before aggregation'],
    };
  }

  if (summaries.length >= 1) {
    const deduped = dedupeSummaries(summaries);
    return {
      webSummaries: deduped,
      status: 'Aggregation complete',
    };
  }

  return {
    status: 'Aggregation complete (LinkedIn only)',
  };
};

export function createWriteReportNode(
  generateReport: GenerateReportFn = generateResearchReport,
): ResearchNodeHandler {
  return async (state) => {
    const personName = state.personName?.trim();
    const linkedinUrl = state.linkedinUrl?.trim();

    if (!personName || !linkedinUrl) {
      return {
        status: 'Report unavailable',
        errors: ['Cannot write report without personName and linkedinUrl'],
      };
    }

    if (!state.linkedinData && !hasUsableWebSummaries(state)) {
      return {
        status: 'Report unavailable',
        errors: ['Insufficient data to generate report'],
      };
    }

    try {
      const bundle = buildResearchBundle(state);
      const result = await generateReport(bundle);
      return {
        finalReport: result.report,
        status: 'Report ready',
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown report generation error';
      return {
        status: 'Report generation failed',
        errors: [`Report error: ${message}`],
      };
    }
  };
}

export const writeReportNode = createWriteReportNode();

export const defaultNodeHandlers: Record<ResearchNodeName, ResearchNodeHandler> =
  {
    [ResearchNodeNames.START]: startNode,
    [ResearchNodeNames.FETCH_LINKEDIN]: fetchLinkedInNode,
    [ResearchNodeNames.GENERATE_SEARCH_QUERY]: generateSearchQueryNode,
    [ResearchNodeNames.EXECUTE_SEARCH]: executeSearchNode,
    [ResearchNodeNames.SCRAPE_WEB_PAGE]: createScrapeWebPageNode(),
    [ResearchNodeNames.SUMMARIZE_CONTENT]: summarizeContentNode,
    [ResearchNodeNames.AGGREGATE_DATA]: aggregateDataNode,
    [ResearchNodeNames.WRITE_REPORT]: writeReportNode,
  };

export type GraphOverrides = Partial<Record<ResearchNodeName, ResearchNodeHandler>>;

export function createResearchGraphBuilder(overrides: GraphOverrides = {}) {
  const graph = new StateGraph(ResearchStateAnnotation, {
    nodes: Object.values(ResearchNodeNames) as ResearchNodeName[],
  });
  const nodes: Record<ResearchNodeName, ResearchNodeHandler> = {
    ...defaultNodeHandlers,
    ...overrides,
  };

  (Object.values(ResearchNodeNames) as ResearchNodeName[]).forEach((name) => {
    graph.addNode(name, nodes[name]);
  });

  graph
    .addEdge(START, ResearchNodeNames.START)
    .addEdge(ResearchNodeNames.START, ResearchNodeNames.FETCH_LINKEDIN)
    .addEdge(ResearchNodeNames.START, ResearchNodeNames.GENERATE_SEARCH_QUERY)
    .addEdge(ResearchNodeNames.FETCH_LINKEDIN, ResearchNodeNames.AGGREGATE_DATA)
    .addEdge(ResearchNodeNames.GENERATE_SEARCH_QUERY, ResearchNodeNames.EXECUTE_SEARCH)
    .addConditionalEdges(ResearchNodeNames.EXECUTE_SEARCH, routeToScraping)
    .addConditionalEdges(ResearchNodeNames.SCRAPE_WEB_PAGE, routeToSummarization)
    .addEdge(ResearchNodeNames.SUMMARIZE_CONTENT, ResearchNodeNames.AGGREGATE_DATA)
    .addEdge(ResearchNodeNames.AGGREGATE_DATA, ResearchNodeNames.WRITE_REPORT)
    .addEdge(ResearchNodeNames.WRITE_REPORT, END);

  return { graph, nodes };
}

export function createResearchGraph(
  overrides: GraphOverrides = {},
  checkpointer: MemorySaver = new MemorySaver(),
) {
  const { graph } = createResearchGraphBuilder(overrides);
  return graph.compile({ checkpointer });
}

export async function drawResearchGraphMermaid(overrides: GraphOverrides = {}) {
  const compiled = createResearchGraph(overrides);
  const drawable = await compiled.getGraphAsync();
  return drawable.drawMermaid();
}

export async function drawResearchGraphPng(overrides: GraphOverrides = {}) {
  const compiled = createResearchGraph(overrides);
  const drawable = await compiled.getGraphAsync();
  const png = await drawable.drawMermaidPng();
  return new Uint8Array(await png.arrayBuffer());
}

function filterSearchResults(
  results: SearchResult[],
  maxResults: number,
): SearchResult[] {
  const filtered: SearchResult[] = [];

  for (const result of results) {
    if (!result?.url) continue;

    try {
      const hostname = new URL(result.url).hostname.toLowerCase();
      const normalizedHost = hostname.startsWith('www.') ? hostname.slice(4) : hostname;
      if (EXCLUDED_DOMAINS.has(hostname) || EXCLUDED_DOMAINS.has(normalizedHost)) {
        continue;
      }
    } catch {
      continue;
    }

    filtered.push(result);
    if (filtered.length >= maxResults) {
      break;
    }
  }

  return filtered;
}

export function routeToScraping(state: ResearchGraphState): Send[] {
  if (!state.searchResults?.length) {
    return [];
  }

  return state.searchResults.map((result) => {
    const metadata = {
      source: result.source,
      rank: result.rank,
      title: result.title,
    };

    return new Send(ResearchNodeNames.SCRAPE_WEB_PAGE, {
      ...state,
      url: result.url,
      metadata,
    });
  });
}

export function routeToSummarization(state: ResearchGraphState): Send[] {
  if (!state.scrapedContents?.length) {
    return [];
  }

  return state.scrapedContents.map((content) =>
    new Send(ResearchNodeNames.SUMMARIZE_CONTENT, {
      ...state,
      scrapedContent: content,
    }),
  );
}

function dedupeSummaries(summaries: WebSummary[]): WebSummary[] {
  const seen = new Map<string, WebSummary>();

  for (const summary of summaries) {
    if (!summary?.url) continue;
    const key = summary.url.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, summary);
    }
  }

  return Array.from(seen.values());
}

function buildResearchBundle(state: ResearchGraphState): ResearchDataBundle {
  return {
    personName: state.personName,
    linkedinUrl: state.linkedinUrl,
    linkedinData: state.linkedinData,
    webSummaries: state.webSummaries ?? [],
    searchResults: state.searchResults ?? [],
    metadata: {
      status: state.status,
      errors: state.errors,
    },
  };
}
const MAX_SEARCH_RESULTS = 15;
const EXCLUDED_DOMAINS = new Set([
  'linkedin.com',
  'www.linkedin.com',
  'linktr.ee',
  'facebook.com',
  'www.facebook.com',
  'twitter.com',
  'www.twitter.com',
  'x.com',
  'www.x.com',
  'instagram.com',
  'www.instagram.com',
  'tiktok.com',
  'www.tiktok.com',
  'pinterest.com',
  'www.pinterest.com',
  'crunchbase.com',
  'www.crunchbase.com',
]);
function hasUsableWebSummaries(state: ResearchGraphState): boolean {
  return (state.webSummaries ?? []).filter((summary) => summary?.summary?.trim()).length >= 1;
}
