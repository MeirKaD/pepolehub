import { google } from '@ai-sdk/google';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import type { ProfileData } from '@/types/linkedin';
import type { ResearchDataBundle, SearchResult, WebSummary } from './types';

const MODEL_NAME = 'gemini-2.0-flash';
const DEFAULT_MAX_SUMMARY_WORDS = 500;
const DEFAULT_CHUNK_SIZE = 6000;

export type QuerySource = 'llm';

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
}

export interface SearchQueryResult {
  query: string;
  rationale?: string;
  source: QuerySource;
  usage: LLMUsage;
}

export interface SummarizeOptions {
  maxWords?: number;
  chunkSize?: number;
}

export interface SummarizeResult extends WebSummary {
  usage: LLMUsage;
}

export interface ResearchReportOptions {
  onChunk?: (chunk: string) => void;
  includeRawData?: boolean;
}

export interface ResearchReportResult {
  report: string;
  sources: string[];
  usage: LLMUsage;
  source: QuerySource;
}

const SearchQuerySchema = z.object({
  googleQuery: z.string().max(320),
  rationale: z.string().optional(),
});

const SummarySchema = z.object({
  summary: z.string(),
  mentionsPerson: z.boolean(),
  keyPoints: z.array(z.string()).default([]),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const ReportSchema = z.object({
  markdown: z.string(),
  sources: z.array(z.string()).default([]),
});

export async function generateSearchQuery(
  personName: string,
  linkedinUrl: string,
  context?: string,
): Promise<SearchQueryResult> {
  if (!hasGeminiKey()) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is required for search query generation.');
  }

  try {
    const prompt = buildSearchPrompt(personName, linkedinUrl, context);
    const { object, usage } = await generateObject({
      model: google(MODEL_NAME),
      schema: SearchQuerySchema,
      prompt,
    });

    const query = object.googleQuery.trim();
    if (!query) {
      throw new Error('Gemini returned an empty search query.');
    }
    return {
      query,
      rationale: object.rationale,
      source: 'llm',
      usage: mapUsage(usage),
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Failed to generate search query: ${error.message}`
        : 'Failed to generate search query via Gemini.',
    );
  }
}

export async function summarizeWebContent(
  url: string,
  content: string,
  personName: string,
  options: SummarizeOptions = {},
): Promise<SummarizeResult | null> {
  const cleaned = sanitizeContent(content);
  if (!cleaned) {
    return null;
  }

  if (!hasGeminiKey()) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is required for summarization.');
  }

  const maxWords = options.maxWords ?? DEFAULT_MAX_SUMMARY_WORDS;
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunks = chunkText(cleaned, chunkSize);
  const collected: z.infer<typeof SummarySchema>[] = [];
  let usage = emptyUsage();

  for (const chunk of chunks) {
    const prompt = buildSummaryPrompt(personName, url, chunk, maxWords);
    try {
      const { object, usage: chunkUsage } = await generateObject({
        model: google(MODEL_NAME),
        schema: SummarySchema,
        prompt,
      });
      addUsage(usage, mapUsage(chunkUsage));
      collected.push(object);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `Failed to summarize content via Gemini: ${error.message}`
          : 'Failed to summarize content via Gemini.',
      );
    }
  }

  if (collected.length === 0) {
    throw new Error('Gemini did not return any summary data.');
  }

  const mergedSummary = mergeSummaries(collected, maxWords);
  return {
    url,
    summary: mergedSummary.summary,
    keyPoints: mergedSummary.keyPoints,
    mentionsPerson: mergedSummary.mentionsPerson,
    sentiment: mergedSummary.sentiment ?? 'neutral',
    confidence: mergedSummary.confidence ?? 0.7,
    usage,
  };
}

export async function generateResearchReport(
  data: ResearchDataBundle,
  options: ResearchReportOptions = {},
): Promise<ResearchReportResult> {
  if (!data.personName || !data.linkedinUrl) {
    throw new Error('personName and linkedinUrl are required');
  }

  const sanitizedData = buildReportContext(data, options.includeRawData ?? false);

  if (!hasGeminiKey()) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is required for research report generation.');
  }

  try {
    const prompt = buildReportPrompt(sanitizedData);
    const { text, usage } = await generateText({
      model: google(MODEL_NAME),
      prompt,
      temperature: 0.4,
    });

    const report = text.trim();
    streamChunks(report, options.onChunk);
    return {
      report,
      sources: sanitizedData.sources,
      source: 'llm',
      usage: mapUsage(usage),
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Failed to generate research report: ${error.message}`
        : 'Failed to generate research report via Gemini.',
    );
  }
}

function buildSearchPrompt(personName: string, linkedinUrl: string, context?: string) {
  return `Create an optimized Google search query to research a professional.

Person: ${personName}
LinkedIn: ${linkedinUrl}
Focus: ${context ?? 'General professional research'}

Guidelines:
- Use quotes around the person's full name.
- Keep the query simple and clean - typically just the quoted name.
- Do NOT add generic keywords like "cloud", "AI", "leadership", "strategy" unless they explicitly appear in the Focus/context provided above.
- Only include role or company keywords if they are mentioned in the Focus.
- Exclude LinkedIn (-site:linkedin.com).
- Keep the query concise (under 200 characters).
- The goal is to find any authoritative content mentioning this person.

Return JSON with googleQuery and optional rationale.`;
}

function buildSummaryPrompt(personName: string, url: string, chunk: string, maxWords: number) {
  return `You are an expert research assistant. Summarize the following content about ${personName}.
URL: ${url}

Content:
"""
${chunk}
"""

Instructions:
- Provide a concise paragraph (max ${maxWords} words).
- Capture concrete achievements, roles, initiatives, and quotes.
- Identify at least 2 key points as bullet-friendly phrases.
- Indicate if the person is explicitly mentioned.
- Estimate sentiment (positive/neutral/negative) and confidence 0-1.`;
}

function mergeSummaries(summaries: z.infer<typeof SummarySchema>[], maxWords: number) {
  const combinedSummary = summaries
    .map((s) => s.summary)
    .join(' ')
    .split(/\s+/)
    .slice(0, maxWords)
    .join(' ');

  const keyPoints = Array.from(new Set(summaries.flatMap((s) => s.keyPoints || []))).slice(0, 10);
  const mentionsPerson = summaries.some((s) => s.mentionsPerson);
  const confidence =
    summaries.reduce((acc, s) => acc + (s.confidence ?? 0.6), 0) / summaries.length;
  const sentiment = summaries.find((s) => s.sentiment)?.sentiment;

  return {
    summary: combinedSummary.trim(),
    keyPoints,
    mentionsPerson,
    confidence,
    sentiment,
  };
}

function deriveKeyPoints(text: string): string[] {
  const sentences = text.split(/(?<=\.)\s+/).slice(0, 3);
  return sentences
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function sanitizeContent(content: string): string {
  return content
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function chunkText(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

function buildReportContext(data: ResearchDataBundle, includeRawData: boolean) {
  const sanitizedSummaries = data.webSummaries.slice(0, 10).map((summary) => ({
    url: summary.url,
    summary: summary.summary,
    keyPoints: summary.keyPoints.slice(0, 5),
  }));

  const linkedInSnapshot = data.linkedinData
    ? {
        fullName: data.linkedinData.fullName,
        headline: data.linkedinData.headline,
        currentCompany: data.linkedinData.currentCompany,
        location: data.linkedinData.location,
        about: truncate(data.linkedinData.about, 700),
        experience: data.linkedinData.experience?.slice(0, 3),
        education: data.linkedinData.education?.slice(0, 2),
      }
    : null;

  const sources = sanitizedSummaries.map((s) => s.url);

  return {
    personName: data.personName,
    linkedinUrl: data.linkedinUrl,
    linkedinData: linkedInSnapshot,
    summaries: sanitizedSummaries,
    searchResults: data.searchResults?.slice(0, 10),
    sources,
    metadata: includeRawData ? data.metadata : undefined,
  };
}

function buildReportPrompt(context: ReturnType<typeof buildReportContext>) {
  return `You are an analyst producing a professional research report.
Use the structured data below to write a cohesive markdown document.

Data:
${JSON.stringify(context, null, 2)}

Requirements:
1. Begin with a concise executive summary (3-4 sentences).
2. Include sections for Professional Background, Strategic Focus, Public Presence, and Notable Insights.
3. Incorporate quotes or paraphrased evidence from the summaries when possible.
4. End with a Sources section listing the provided URLs.
5. Use bullet points when enumerating achievements.
6. Keep the tone objective and informative.`;
}

function truncate(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return value;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
}

function hasGeminiKey(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}

function emptyUsage(): LLMUsage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function mapUsage(
  usage:
    | {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        reasoningTokens?: number;
      }
    | undefined,
): LLMUsage {
  if (!usage) {
    return emptyUsage();
  }
  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
    reasoningTokens: usage.reasoningTokens,
  };
}

function addUsage(target: LLMUsage, addition: LLMUsage | undefined) {
  if (!addition) return;
  target.inputTokens += addition.inputTokens ?? 0;
  target.outputTokens += addition.outputTokens ?? 0;
  target.totalTokens += addition.totalTokens ?? 0;
}

function streamChunks(report: string, onChunk?: (chunk: string) => void) {
  if (!onChunk) return;
  const chunks = report.split(/\n{2,}/);
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (trimmed) {
      onChunk(trimmed);
    }
  }
}
