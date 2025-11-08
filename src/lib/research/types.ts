import { Annotation } from '@langchain/langgraph';
import { z } from 'zod';
import type { ProfileData } from '@/types/linkedin';

/**
 * Canonical LinkedIn profile shape reused by the research workflow.
 */
export type LinkedInData = ProfileData;

export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  rank: number;
  source: string;
  countryCode?: string | null;
}

export interface ScrapedContent {
  url: string;
  status?: number;
  contentType?: string;
  content: string;
  bytes: number;
  fetchedAt: number;
  error?: string;
  metadata?: {
    source?: string;
    rank?: number;
    title?: string;
  };
}

export interface WebSummary {
  url: string;
  summary: string;
  keyPoints: string[];
  mentionsPerson: boolean;
  confidence?: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  source?: string;
  rawExcerpt?: string;
}

export interface ResearchInput {
  personName: string;
  linkedinUrl: string;
  context?: string;
  forceRefresh?: boolean;
}

export interface ResearchOutput {
  personName: string;
  linkedinUrl: string;
  report: string;
  sources: string[];
  generatedAt: number;
}

export interface ResearchState {
  personName: string;
  linkedinUrl: string;
  linkedinData: LinkedInData | null;
  searchQuery: string | null;
  searchResults: SearchResult[];
  scrapedContents: ScrapedContent[];
  webSummaries: WebSummary[];
  finalReport: string | null;
  errors: string[];
  status: string;
}

export interface ResearchDataSummary {
  personName: string;
  linkedinUrl: string;
  linkedinData: LinkedInData | null;
  webSummaries: WebSummary[];
  searchResults: SearchResult[];
}

export interface ResearchDataBundle {
  personName: string;
  linkedinUrl: string;
  linkedinData: LinkedInData | null;
  webSummaries: WebSummary[];
  searchResults?: SearchResult[];
  metadata?: Record<string, unknown>;
}

export const LinkedInDataSchema = z.object({
  linkedinUrl: z.string().url(),
  linkedinId: z.string(),
  linkedinNumId: z.string().optional(),
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
  headline: z.string().optional(),
  about: z.string().optional(),
  location: z.string().optional(),
  city: z.string().optional(),
  countryCode: z.string().optional(),
  profilePicUrl: z.string().url().optional(),
  bannerImage: z.string().url().optional(),
  defaultAvatar: z.boolean().optional(),
  currentCompany: z.string().optional(),
  currentCompanyId: z.string().optional(),
  experience: z.array(z.any()).optional(),
  education: z.array(z.any()).optional(),
  languages: z.array(z.any()).optional(),
  connections: z.number().int().nonnegative().optional(),
  followers: z.number().int().nonnegative().optional(),
  memorializedAccount: z.boolean().optional(),
});

export const SearchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string().optional(),
  rank: z.number().int().positive(),
  source: z.string().default('google'),
  countryCode: z.string().length(2).optional().nullable(),
});

export const ScrapedContentSchema = z.object({
  url: z.string().url(),
  status: z.number().int().optional(),
  contentType: z.string().optional(),
  content: z.string(),
  bytes: z.number().int().nonnegative(),
  fetchedAt: z.number().int(),
  error: z.string().optional(),
  metadata: z
    .object({
      source: z.string().optional(),
      rank: z.number().int().optional(),
      title: z.string().optional(),
    })
    .optional(),
});

export const WebSummarySchema = z.object({
  url: z.string().url(),
  summary: z.string(),
  keyPoints: z.array(z.string()).default([]),
  mentionsPerson: z.boolean(),
  confidence: z.number().min(0).max(1).optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  source: z.string().optional(),
  rawExcerpt: z.string().optional(),
});

export const ResearchInputSchema = z.object({
  personName: z.string().min(2),
  linkedinUrl: z.string().url(),
  context: z.string().max(4000).optional(),
  forceRefresh: z.boolean().optional().default(false),
});

export const ResearchOutputSchema = z.object({
  personName: z.string(),
  linkedinUrl: z.string().url(),
  report: z.string(),
  sources: z.array(z.string().url()).default([]),
  generatedAt: z.number().int(),
});

export const ResearchStateSchema = z.object({
  personName: z.string(),
  linkedinUrl: z.string().url(),
  linkedinData: LinkedInDataSchema.nullable(),
  searchQuery: z.string().nullable(),
  searchResults: z.array(SearchResultSchema).default([]),
  scrapedContents: z.array(ScrapedContentSchema).default([]),
  webSummaries: z.array(WebSummarySchema).default([]),
  finalReport: z.string().nullable(),
  errors: z.array(z.string()).default([]),
  status: z.string(),
});

export const ResearchStateAnnotation = Annotation.Root({
  personName: Annotation<string>(),
  linkedinUrl: Annotation<string>(),
  linkedinData: Annotation<LinkedInData | null>(),
  searchQuery: Annotation<string | null>(),
  searchResults: Annotation<SearchResult[]>({
    reducer: (_state, update) => update,
    default: () => [],
  }),
  scrapedContents: Annotation<ScrapedContent[], ScrapedContent | ScrapedContent[]>({
    reducer: (state, update) => (Array.isArray(update) ? [...state, ...update] : [...state, update]),
    default: () => [],
  }),
  webSummaries: Annotation<WebSummary[], WebSummary | WebSummary[]>({
    reducer: (state, update) => (Array.isArray(update) ? [...state, ...update] : [...state, update]),
    default: () => [],
  }),
  finalReport: Annotation<string | null>(),
  errors: Annotation<string[], string | string[]>({
    default: () => [],
    reducer: (state, update) => (Array.isArray(update) ? [...state, ...update] : [...state, update]),
  }),
  status: Annotation<string, string>({
    default: () => 'idle',
    reducer: (_state, update) => update,
  }),
});

export type ResearchInputPayload = z.infer<typeof ResearchInputSchema>;
export type ResearchOutputPayload = z.infer<typeof ResearchOutputSchema>;
export type ResearchStatePayload = z.infer<typeof ResearchStateSchema>;
