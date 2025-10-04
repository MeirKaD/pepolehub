/**
 * Bright Data Google Search API
 * Direct API calls to search Google and extract LinkedIn URLs
 */

const BRIGHTDATA_API_URL = 'https://api.brightdata.com/request';

interface GoogleSearchResult {
  title: string;
  link: string;
  snippet?: string;
}

interface GoogleSearchResponse {
  organic?: GoogleSearchResult[];
  images?: unknown[];
  pagination?: {
    current_page?: number;
  };
  related?: string[];
  ai_overview?: unknown;
}

/**
 * Get Bright Data API headers
 */
function getApiHeaders() {
  const apiToken = process.env.BRIGHTDATA_API_TOKEN;
  if (!apiToken) {
    throw new Error('BRIGHTDATA_API_TOKEN is not set in environment variables');
  }

  return {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Build Google search URL with JSON response format and geolocation
 */
function buildGoogleSearchUrl(query: string, page: number = 0, countryCode?: string): string {
  const encodedQuery = encodeURIComponent(query);
  const start = page * 10;
  let url = `https://www.google.com/search?q=${encodedQuery}&start=${start}&brd_json=1`;

  // Add geolocation if provided
  if (countryCode) {
    url += `&gl=${countryCode.toUpperCase()}`;
  }

  return url;
}

/**
 * Execute Google search via Bright Data API
 * @param query - Google search query (e.g., 'site:linkedin.com/in "AI Engineer" "Israel"')
 * @param page - Page number (0-indexed)
 * @param countryCode - Optional 2-letter ISO country code for geolocation (e.g., "IL", "US")
 * @returns Google search results in JSON format
 */
export async function searchGoogle(
  query: string,
  page: number = 0,
  countryCode?: string
): Promise<GoogleSearchResponse> {
  const unlockerZone = process.env.BRIGHTDATA_UNLOCKER_ZONE || 'unblocker';
  const searchUrl = buildGoogleSearchUrl(query, page, countryCode);

  try {
    const response = await fetch(BRIGHTDATA_API_URL, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        url: searchUrl,
        zone: unlockerZone,
        format: 'raw',
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Google search failed: ${response.status} ${response.statusText}`
      );
    }

    const textData = await response.text();
    const searchData: GoogleSearchResponse = JSON.parse(textData);

    console.log(
      `[Google Search] Found ${searchData.organic?.length || 0} organic results for query: "${query}"`
    );

    return searchData;
  } catch (error) {
    console.error('[Google Search] Error:', error);
    throw new Error(
      `Failed to search Google: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Extract and validate LinkedIn profile URLs from search results
 * @param searchResults - Google search response
 * @returns Array of clean LinkedIn profile URLs
 */
export function extractLinkedInUrls(
  searchResults: GoogleSearchResponse
): string[] {
  if (!searchResults.organic || searchResults.organic.length === 0) {
    return [];
  }

  const linkedInUrls: string[] = [];

  for (const result of searchResults.organic) {
    const url = result.link;

    // Validate that it's a LinkedIn profile URL
    if (isValidLinkedInProfileUrl(url)) {
      // Normalize the URL (remove query params, ensure consistent format)
      const cleanUrl = normalizeLinkedInUrl(url);
      linkedInUrls.push(cleanUrl);
    }
  }

  console.log(
    `[LinkedIn URLs] Extracted ${linkedInUrls.length} LinkedIn profile URLs`
  );

  return linkedInUrls;
}

/**
 * Validate if a URL is a LinkedIn profile URL
 */
function isValidLinkedInProfileUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === 'linkedin.com' ||
        parsed.hostname === 'www.linkedin.com' ||
        parsed.hostname.endsWith('.linkedin.com')) &&
      parsed.pathname.startsWith('/in/')
    );
  } catch {
    return false;
  }
}

/**
 * Normalize LinkedIn URL (remove query params, ensure clean format)
 */
function normalizeLinkedInUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Return clean URL without query params or hash
    return `https://www.linkedin.com${parsed.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Search Google for LinkedIn profiles and extract URLs
 * @param query - Google search query
 * @param maxResults - Maximum number of URLs to return
 * @param countryCode - Optional 2-letter ISO country code for geolocation
 * @returns Array of LinkedIn profile URLs
 */
export async function findLinkedInProfiles(
  query: string,
  maxResults: number = 10,
  countryCode?: string
): Promise<string[]> {
  try {
    const searchResults = await searchGoogle(query, 0, countryCode);
    const linkedInUrls = extractLinkedInUrls(searchResults);

    // Limit to requested number of results
    return linkedInUrls.slice(0, maxResults);
  } catch (error) {
    console.error('[Find LinkedIn Profiles] Error:', error);
    throw new Error(
      `Failed to find LinkedIn profiles: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}
