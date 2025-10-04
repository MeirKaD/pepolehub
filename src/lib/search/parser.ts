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
  countryCode?: string | null;
  keywords: string[];
  googleQuery: string;
}

/**
 * Zod schema for structured LLM output
 */
const SearchQuerySchema = z.object({
  count: z.number().min(1).max(50).describe('Number of profiles to find (1-50)'),
  role: z.string().describe('Job title or role (e.g., "Software Engineer", "Product Manager")'),
  location: z.string().optional().describe('Location or region (e.g., "San Francisco", "Remote", "Israel"). Can also be a company name if no geographic location is specified.'),
  countryCode: z.string().length(2).optional().nullable().describe('2-letter ISO country code (e.g., "US", "IL", "GB", "DE"). Extract from location ONLY if it is a geographic location. Return null if location is a company name.'),
  keywords: z.array(z.string()).describe('Additional keywords or qualifications (e.g., ["Python", "startup", "AI", "MiniMax"])'),
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
2. Identify the job role/title (be flexible - if the query mentions a company like "MiniMax", "Google", etc., treat it as part of the search context)
3. Extract location if mentioned - this can be:
   - A geographic location (city, country, region): "Israel", "San Francisco", "London"
   - A company name: "Google", "MiniMax", "Microsoft"
   - If it's a company, set location to the company name and countryCode to null
4. Convert location to 2-letter ISO country code ONLY if it's a geographic location:
   - Geographic: Israel → IL, United States → US, UK → GB, Germany → DE, France → FR, Spain → ES, Italy → IT, Canada → CA, Australia → AU, India → IN, Japan → JP
   - Company: "MiniMax" → countryCode = null, "Google" → countryCode = null
5. Identify any additional keywords or skills (technologies, companies, expertise)
6. Create a Google search query using this format:
   site:linkedin.com/in "Job Title" "Location/Company" keywords

IMPORTANT FLEXIBILITY RULES:
- Be VERY flexible with query interpretation
- If a query mentions a company (e.g., "works in MiniMax", "at Google"), treat the company as location/context
- Don't fail on unusual queries - adapt and extract what you can
- The goal is to find relevant LinkedIn profiles, so prioritize creating a working search over strict schema adherence

Examples:
- Input: "5 AI Engineers in Israel with Python experience"
  Output: role="AI Engineer", location="Israel", countryCode="IL", keywords=["Python"]
  googleQuery: site:linkedin.com/in "AI Engineer" "Israel" Python

- Input: "10 Product Managers in San Francisco"
  Output: role="Product Manager", location="San Francisco", countryCode="US", keywords=[]
  googleQuery: site:linkedin.com/in "Product Manager" "San Francisco"

- Input: "Software engineers that works in minimax"
  Output: role="Software Engineer", location="MiniMax", countryCode=null, keywords=["MiniMax"]
  googleQuery: site:linkedin.com/in "Software Engineer" MiniMax

- Input: "Java developers at Google"
  Output: role="Java Developer", location="Google", countryCode=null, keywords=["Java", "Google"]
  googleQuery: site:linkedin.com/in "Java Developer" Google

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
