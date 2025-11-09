import { Buffer } from 'node:buffer';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getBrightDataClient } from './client';
import type { ScrapedContent, SearchResult } from '@/lib/research/types';

const SEARCH_TOOL_NAME = 'search_engine';
const SCRAPE_TOOL_NAME = 'scrape_batch';
const DEFAULT_MAX_RESULTS = 15;
const DEFAULT_CONTENT_WARN_BYTES = 50 * 1024; // 50KB

type UnknownRecord = Record<string, unknown>;

type ToolContent =
  | {
      type: 'text';
      text: string;
    }
  | {
    type: 'image';
    data: string;
    mimeType: string;
  }
  | {
    type: 'resource';
    resource: {
      text?: string;
      blob?: string;
      mimeType?: string;
      uri?: string;
    };
  }
  | {
    type: string;
    [key: string]: unknown;
  };

type ToolCallResponse = {
  content?: ToolContent[];
  toolResult?: unknown;
  isError?: boolean;
};

type QuerySource = 'manual' | 'llm' | 'fallback';

interface OptimizedQuery {
  query: string;
  source: QuerySource;
}


export interface PersonSearchOptions {
  /**
   * Optional pre-generated search query.
   * When omitted we fall back to a deterministic heuristic until the LLM service is wired in.
   */
  query?: string;
  /**
   * Additional context (e.g., role, company) that can inform the heuristic query.
   */
  context?: string;
  /**
   * Limit on returned search results (after filtering). Defaults to 15.
   */
  maxResults?: number;
  /**
   * Optional country hint to bias Google geolocation.
   */
  countryCode?: string | null;
}

export interface ScrapeOptions {
  /**
   * Soft limit before logging a warning about large payloads. Defaults to 50KB.
   */
  warnBytes?: number;
}

/**
 * Runs the Bright Data `search_engine` MCP tool to discover non-LinkedIn URLs about a person.
 */
export async function searchGoogleForPerson(
  personName: string,
  linkedinUrl: string,
  options: PersonSearchOptions = {},
): Promise<SearchResult[]> {
  if (!personName?.trim()) {
    throw new Error('personName is required');
  }

  if (!linkedinUrl?.trim()) {
    throw new Error('linkedinUrl is required');
  }

  const maxResults = Math.max(1, Math.min(options.maxResults ?? DEFAULT_MAX_RESULTS, 25));
  const queryInfo = options.query?.trim()
    ? { query: options.query.trim(), source: 'manual' as QuerySource }
    : await buildOptimizedPersonQuery(personName, linkedinUrl, options.context);

  console.log('[Bright Data Research] Executing Google search:', {
    personName,
    source: queryInfo.source,
    query: queryInfo.query,
    countryCode: options.countryCode ?? null,
  });

  const toolResponse = await callBrightDataTool(SEARCH_TOOL_NAME, {
    query: queryInfo.query,
    ...(options.countryCode ? { country: options.countryCode } : {}),
  });

  const payload = extractToolPayload(toolResponse, SEARCH_TOOL_NAME);
  const payloadSnapshot = summarizePayload(payload);
  console.log('[Bright Data Research] Bright Data raw search payload snapshot:', payloadSnapshot);
  const entries = extractArrayLike(payload);

  const deduped = new Map<string, SearchResult>();
  let rankCounter = 1;

  for (const entry of entries) {
    if (!isPlainObject(entry)) continue;
    const normalized = normalizeSearchResult(entry, rankCounter);
    if (!normalized) continue;
    rankCounter += 1;
    if (isLinkedInUrl(normalized.url)) {
      continue;
    }
    const urlKey = normalized.url.toLowerCase();
    if (!deduped.has(urlKey)) {
      deduped.set(urlKey, normalized);
    }
    if (deduped.size >= maxResults) {
      break;
    }
  }

  if (entries.length === 0) {
    console.warn('[Bright Data Research] Bright Data returned zero search results.', payloadSnapshot);
  }

  const results = Array.from(deduped.values());
  console.log('[Bright Data Research] Search results summary:', {
    requested: maxResults,
    returned: results.length,
  });
  return results;
}

/**
 * Scrapes multiple URLs via Bright Data `scrape_batch`.
 */
export async function scrapeUrls(
  urls: string[],
  options: ScrapeOptions = {},
): Promise<ScrapedContent[]> {
  const uniqueUrls = Array.from(
    new Map(
      urls
        .map((url) => [normalizeUrlKey(url), url] as const)
        .filter(([, url]) => Boolean(url)),
    ).values(),
  );

  if (uniqueUrls.length === 0) {
    throw new Error('At least one valid URL is required to scrape');
  }

  const warnBytes = options.warnBytes ?? DEFAULT_CONTENT_WARN_BYTES;
  console.log('[Bright Data Research] Scrape job starting:', {
    totalRequested: urls.length,
    uniqueUrls: uniqueUrls.length,
    warnBytes,
  });

  const toolResponse = await callBrightDataTool(SCRAPE_TOOL_NAME, {
    urls: uniqueUrls,
    requests: uniqueUrls.map((url) => ({ url })),
  });

  const payload = extractToolPayload(toolResponse, SCRAPE_TOOL_NAME);
  const payloadSnapshot = summarizePayload(payload);
  console.log('[Bright Data Research] Bright Data raw scrape payload snapshot:', payloadSnapshot);
  const entries = extractArrayLike(payload);
  const orderIndex = new Map(uniqueUrls.map((url, idx) => [normalizeUrlKey(url), idx]));

  const normalizedResults: ScrapedContent[] = [];

  for (const entry of entries) {
    if (!isPlainObject(entry)) continue;
    const normalized = normalizeScrapeResult(entry, warnBytes);
    if (!normalized) continue;
    normalizedResults.push(normalized);
  }

  const sorted = normalizedResults.sort((a, b) => {
    const aIdx = orderIndex.get(normalizeUrlKey(a.url)) ?? Number.MAX_SAFE_INTEGER;
    const bIdx = orderIndex.get(normalizeUrlKey(b.url)) ?? Number.MAX_SAFE_INTEGER;
    return aIdx - bIdx;
  });

  console.log('[Bright Data Research] Scrape job completed:', {
    requested: uniqueUrls.length,
    scraped: sorted.length,
  });
  return sorted;
}

const PersonQuerySchema = z.object({
  googleQuery: z
    .string()
    .max(320)
    .describe('Complete Google query string optimized for researching the person'),
  rationale: z.string().optional(),
});

async function buildOptimizedPersonQuery(personName: string, linkedinUrl: string, context?: string): Promise<OptimizedQuery> {
  const fallbackQuery = buildFallbackPersonQuery(personName, context, linkedinUrl);
  const fallback: OptimizedQuery = { query: fallbackQuery, source: 'fallback' };

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.log('[Bright Data Research] GOOGLE_GENERATIVE_AI_API_KEY not set, using fallback query.');
    return fallback;
  }

  try {
    const { object } = await generateObject({
      model: google('gemini-2.0-flash-exp'),
      schema: PersonQuerySchema,
      prompt: buildQueryPrompt(personName, linkedinUrl, context),
    });

    if (object?.googleQuery?.trim()) {
      return {
        query: object.googleQuery.trim(),
        source: 'llm',
      };
    }
  } catch (error) {
    console.error('[Bright Data Research] Failed to generate LLM query, falling back:', error);
  }

  return fallback;
}

function buildQueryPrompt(personName: string, linkedinUrl: string, context?: string): string {
  return `Create an optimized Google search query to research the following person.

Name: ${personName}
LinkedIn: ${linkedinUrl}
Context / Focus: ${context ?? 'General professional background'}

Goals:
1. Create a simple, focused query that will find authoritative content about this person.
2. Use ONLY the person's name in quotes - do NOT add generic keywords unless they appear in the provided context.
3. Explicitly exclude LinkedIn (-site:linkedin.com).
4. Keep the query minimal and clean - typically just the quoted name and exclusions.
5. If context is provided with specific role/company, you MAY include those exact terms, but do NOT invent or assume topics like "cloud", "AI", "leadership", "strategy" etc.
6. Keep the final query concise (< 200 characters) and simple.

Example for "John Smith" with no context: "John Smith" -site:linkedin.com
Example for "Jane Doe" with context "CEO at Acme Corp": "Jane Doe" "Acme" -site:linkedin.com

Return ONLY the final Google query string (no explanation).`;
}

/**
 * Lightweight heuristic fallback in case LLM query generation is unavailable.
 */
function buildFallbackPersonQuery(personName: string, context?: string, linkedinUrl?: string): string {
  const normalizedName = personName.trim();
  const aliasTerm = normalizedName.split(' ').length > 1 ? normalizedName.split(' ')[1] : normalizedName;
  const nameGroup = `("${normalizedName}"${aliasTerm ? ` OR "${aliasTerm}"` : ''})`;

  const terms = [nameGroup];

  if (context?.trim()) {
    const contextTokens = context
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => `"${token}"`)
      .join(' OR ');
    terms.push(`(${contextTokens || `"${context.trim()}"`})`);
  }

  const modifiers = [
    'after:2018',
  ];

  const excludeDomains = [
    '-site:linkedin.com',
    '-site:www.linkedin.com',
    '-site:linkedin.com/in',
    '-site:facebook.com',
    '-site:instagram.com',
    '-site:x.com',
    '-site:twitter.com',
    '-site:crunchbase.com',
    '-site:slideshare.net',
  ];

  if (linkedinUrl) {
    try {
      const host = new URL(linkedinUrl).hostname.replace(/^www\./, '');
      excludeDomains.push(`-site:${host}`);
    } catch {
      // ignore parsing issues
    }
  }

  const dedupedExcludes = Array.from(new Set(excludeDomains));

  return [...terms, ...modifiers, ...dedupedExcludes].join(' ').replace(/\s+/g, ' ').trim();
}

async function callBrightDataTool(toolName: string, args: Record<string, unknown>): Promise<ToolCallResponse> {
  const client = await getBrightDataClient();
  const clientWithCall = client as unknown as {
    callTool?: (params: { name: string; args: Record<string, unknown> }) => Promise<ToolCallResponse>;
    tools: typeof client.tools;
  };

  if (typeof clientWithCall.callTool === 'function') {
    console.log('[Bright Data Research] Invoking Bright Data tool via callTool:', { toolName });
    const response = await clientWithCall.callTool({ name: toolName, args });
    console.log('[Bright Data Research] Tool response received:', {
      toolName,
      hasContent: Boolean(response?.content?.length),
      hasToolResult: 'toolResult' in (response ?? {}),
    });
    return response;
  }

  throw new Error('Bright Data MCP client does not support direct tool calls.');
}

function extractToolPayload(result: ToolCallResponse, toolName: string): unknown {
  if (!result) {
    throw new Error(`Tool "${toolName}" did not return a result`);
  }

  if ((result as { isError?: boolean }).isError) {
    throw new Error(`Tool "${toolName}" reported an error`);
  }

  if ('toolResult' in result && result.toolResult !== undefined) {
    const payload = result.toolResult;
    if (typeof payload === 'string') {
      return tryParseJson(payload) ?? payload;
    }
    return payload;
  }

  const content = result.content ?? [];
  for (const part of content) {
    if (part.type === 'text' && typeof part.text === 'string') {
      const parsed = tryParseJson(part.text);
      if (parsed !== null) {
        return parsed;
      }
    }

    if (part.type === 'resource') {
      const resourcePart = part as Extract<ToolContent, { type: 'resource' }>;
      const resource = resourcePart.resource;
      if (resource?.text) {
        const parsed = tryParseJson(resource.text);
        if (parsed !== null) {
          return parsed;
        }
      }
      if (resource?.blob) {
        const decoded = decodeBase64(resource.blob);
        if (decoded) {
          const parsed = tryParseJson(decoded);
          if (parsed !== null) {
            return parsed;
          }
        }
      }
    }
  }

  throw new Error(`Unable to extract payload from tool "${toolName}" response`);
}

function extractArrayLike(payload: unknown): UnknownRecord[] {
  if (Array.isArray(payload)) {
    return payload as UnknownRecord[];
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const record = payload as UnknownRecord;

  // Bright Data MCP Google search response exposes `organic`
  if (Array.isArray(record.organic)) {
    return record.organic as UnknownRecord[];
  }

  const candidateKeys = [
    'results',
    'data',
    'items',
    'entries',
    'value',
    'organic_results',
    'searchResults',
  ];

  for (const key of candidateKeys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value as UnknownRecord[];
    }
    if (value && typeof value === 'object') {
      const nested = value as UnknownRecord;
      if (Array.isArray(nested.results)) {
        return nested.results as UnknownRecord[];
      }
      if (Array.isArray(nested.organic)) {
        return nested.organic as UnknownRecord[];
      }
    }
  }

  return [];
}

function normalizeSearchResult(entry: UnknownRecord, fallbackRank: number): SearchResult | null {
  const url = sanitizeUrl(
    firstString(entry, ['url', 'link', 'href', 'resultUrl', 'page_url', 'resolved_url']),
  );
  if (!url) return null;

  const title = firstString(entry, ['title', 'name', 'heading']) ?? url;
  const snippet = firstString(entry, ['snippet', 'description', 'summary', 'text']);
  const source =
    firstString(entry, ['source', 'domain', 'site']) ?? new URL(url).hostname.replace(/^www\./, '');

  const rank =
    coerceNumber(entry['rank']) ??
    coerceNumber(entry['position']) ??
    fallbackRank;

  const countryCode = firstString(entry, ['countryCode', 'country_code', 'gl']);

  return {
    title,
    url,
    snippet,
    rank,
    source,
    countryCode: countryCode ?? undefined,
  };
}

function normalizeScrapeResult(entry: UnknownRecord, warnBytes: number): ScrapedContent | null {
  const url = sanitizeUrl(firstString(entry, ['url', 'pageUrl', 'source_url', 'target_url']));
  if (!url) return null;

  let content =
    firstString(entry, ['content', 'html', 'body', 'text', 'raw']) ??
    decodeBase64(firstString(entry, ['content_base64', 'body_base64']) ?? '');

  if (!content) {
    content = '';
  }

  const bytes =
    coerceNumber(entry['bytes']) ??
    Buffer.byteLength(content, 'utf8');

  const status =
    coerceNumber(entry['status']) ??
    coerceNumber(entry['status_code']) ??
    undefined;

  const headers = isPlainObject(entry['headers']) ? (entry['headers'] as UnknownRecord) : undefined;
  const headerContentType = headers
    ? firstString(headers, ['content-type', 'Content-Type'])
    : undefined;

  const contentType =
    firstString(entry, ['contentType', 'content_type']) ?? headerContentType;

  const error = firstString(entry, ['error', 'errorMessage', 'message']);

  if (bytes > warnBytes) {
    console.warn(
      `[Bright Data] Scraped content for ${url} is ${bytes} bytes (> ${warnBytes}). Consider chunking before LLM calls.`,
    );
  }

  return {
    url,
    status,
    contentType,
    content,
    bytes,
    fetchedAt: Date.now(),
    error: error ?? undefined,
  };
}

function sanitizeUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeUrlKey(value: string | undefined | null): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString().toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}

function isLinkedInUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com');
  } catch {
    return false;
  }
}

function firstString(record: UnknownRecord | undefined, keys: string[]): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function isPlainObject(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function decodeBase64(data: string | undefined): string | undefined {
  if (!data) return undefined;
  try {
    return Buffer.from(data, 'base64').toString('utf8');
  } catch {
    return undefined;
  }
}

function summarizePayload(payload: unknown, maxLength = 800): string {
  try {
    if (payload === undefined || payload === null) {
      return '[payload=null]';
    }
    const serialized =
      typeof payload === 'string'
        ? payload
        : JSON.stringify(
            payload,
            (_key, value) => {
              if (typeof value === 'string' && value.length > 200) {
                return `${value.slice(0, 200)}…`;
              }
              return value;
            },
            2,
          );
    return serialized.length > maxLength ? `${serialized.slice(0, maxLength)}…` : serialized;
  } catch {
    return '[payload=unserializable]';
  }
}
