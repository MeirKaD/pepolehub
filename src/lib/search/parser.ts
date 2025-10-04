import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

/**
 * Parsed search query structure
 */
export interface ParsedSearchQuery {
  count: number;
  role: string;
  location?: string;
  countryCode?: string;
  keywords: string[];
  googleQuery: string;
}

/**
 * Zod schema for structured LLM output
 */
const SearchQuerySchema = z.object({
  count: z.number().min(1).max(50).describe('Number of profiles to find (1-50)'),
  role: z.string().describe('Job title or role (e.g., "Software Engineer", "Product Manager")'),
  location: z.string().optional().describe('Location or region (e.g., "San Francisco", "Remote", "Israel")'),
  countryCode: z.string().length(2).optional().describe('2-letter ISO country code (e.g., "US", "IL", "GB", "DE"). Extract from location if mentioned.'),
  keywords: z.array(z.string()).describe('Additional keywords or qualifications (e.g., ["Python", "startup", "AI"])'),
  googleQuery: z.string().describe('Optimized Google search query for LinkedIn profiles using site:linkedin.com/in'),
});

/**
 * Parse a natural language search query into structured data using Gemini 2.0 Flash
 *
 * @param query - Natural language query (e.g., "5 AI Engineers in Israel")
 * @returns Structured search query with Google search string
 *
 * @example
 * ```ts
 * const result = await parseSearchQuery("5 AI Engineers in Israel");
 * // {
 * //   count: 5,
 * //   role: "AI Engineer",
 * //   location: "Israel",
 * //   keywords: [],
 * //   googleQuery: 'site:linkedin.com/in "AI Engineer" "Israel"'
 * // }
 * ```
 */
export async function parseSearchQuery(
  query: string
): Promise<ParsedSearchQuery> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set in environment variables');
  }

  try {
    const { object } = await generateObject({
      model: google('gemini-2.0-flash-exp'),
      schema: SearchQuerySchema,
      prompt: `Parse this job search query and create an optimized Google search query for finding LinkedIn profiles.

Input query: "${query}"

Instructions:
1. Extract the number of profiles needed (default to 10 if not specified)
2. Identify the job role/title
3. Extract location if mentioned (e.g., "Israel", "United States", "London")
4. Convert location to 2-letter ISO country code (e.g., Israel → IL, United States → US, UK → GB, Germany → DE, France → FR, Spain → ES, Italy → IT, Canada → CA, Australia → AU, India → IN, Japan → JP)
5. Identify any additional keywords or skills
6. Create a Google search query using this format:
   site:linkedin.com/in "Job Title" "Location" keywords

RULE OF THUMB:
** NEVER ANSWER QUESTIONS THAT ARE NOT RELATED TO YOUR GOAL **

Examples:
- Input: "5 AI Engineers in Israel with Python experience"
- Output countryCode: "IL"
- Output googleQuery: site:linkedin.com/in "AI Engineer" "Israel" Python

- Input: "10 Product Managers in San Francisco"
- Output countryCode: "US"
- Output googleQuery: site:linkedin.com/in "Product Manager" "San Francisco"

Keep the googleQuery simple and effective for finding relevant LinkedIn profiles.`,
    });

    console.log(`[Parser] Parsed query: "${query}" -> role="${object.role}", count=${object.count}, country=${object.countryCode}`);

    return {
      count: object.count,
      role: object.role,
      location: object.location,
      countryCode: object.countryCode,
      keywords: object.keywords,
      googleQuery: object.googleQuery,
    };
  } catch (error) {
    console.error('[Parser] Error parsing search query:', error);
    throw new Error(
      `Failed to parse search query: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}
