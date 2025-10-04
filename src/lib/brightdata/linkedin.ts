import {
  BrightDataLinkedInResponse,
  ProfileData,
  transformBrightDataProfile,
} from '@/types/linkedin';

const BRIGHTDATA_API_URL = 'https://api.brightdata.com/datasets/v3';
const LINKEDIN_DATASET_ID = 'gd_l1viktl72bvl7bjuj0';
const MAX_POLLING_ATTEMPTS = 600; // 600 seconds = 10 minutes
const POLLING_INTERVAL_MS = 1000; // 1 second

interface TriggerResponse {
  snapshot_id: string;
}

interface SnapshotStatusResponse {
  status: 'running' | 'building' | 'ready' | 'failed';
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
 * Trigger a LinkedIn profile scrape job
 */
async function triggerLinkedInScrape(
  urls: string[]
): Promise<string> {
  const triggerUrl = `${BRIGHTDATA_API_URL}/trigger`;
  const params = new URLSearchParams({
    dataset_id: LINKEDIN_DATASET_ID,
    include_errors: 'true',
  });

  const payload = urls.map(url => ({ url }));

  const response = await fetch(`${triggerUrl}?${params}`, {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to trigger LinkedIn scrape: ${response.status} ${response.statusText}`
    );
  }

  const data: TriggerResponse = await response.json();

  if (!data.snapshot_id) {
    throw new Error('No snapshot ID returned from Bright Data API');
  }

  console.log(`[LinkedIn Scraper] Triggered job with snapshot ID: ${data.snapshot_id}`);
  return data.snapshot_id;
}

/**
 * Poll for snapshot data until ready
 */
async function pollForSnapshot(
  snapshotId: string
): Promise<BrightDataLinkedInResponse[]> {
  let attempts = 0;

  while (attempts < MAX_POLLING_ATTEMPTS) {
    try {
      const snapshotUrl = `${BRIGHTDATA_API_URL}/snapshot/${snapshotId}`;
      const params = new URLSearchParams({ format: 'json' });

      const response = await fetch(`${snapshotUrl}?${params}`, {
        method: 'GET',
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        console.error(
          `[LinkedIn Scraper] Polling error: ${response.status} ${response.statusText}`
        );
        attempts++;
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
        continue;
      }

      const data = await response.json();

      // Check if response is a status object (still processing)
      if (!Array.isArray(data) && typeof data === 'object' && 'status' in data) {
        const statusData = data as SnapshotStatusResponse;
        if (['running', 'building'].includes(statusData.status)) {
          console.log(
            `[LinkedIn Scraper] Snapshot not ready, polling again (attempt ${attempts + 1}/${MAX_POLLING_ATTEMPTS})`
          );
          attempts++;
          await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
          continue;
        }
      }

      // Snapshot is ready - data should be an array of profiles
      console.log(
        `[LinkedIn Scraper] Snapshot data received after ${attempts + 1} attempts`
      );

      // At this point, data must be the profiles array
      if (!Array.isArray(data)) {
        throw new Error('Unexpected response format from Bright Data API');
      }

      return data as BrightDataLinkedInResponse[];
    } catch (error) {
      console.error(
        `[LinkedIn Scraper] Polling error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      attempts++;
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
    }
  }

  throw new Error(
    `Timeout after ${MAX_POLLING_ATTEMPTS} seconds waiting for LinkedIn data`
  );
}

/**
 * Fetch a LinkedIn profile using Bright Data API (no AI, direct API call)
 * @param linkedinUrl - Full LinkedIn profile URL (e.g., "https://linkedin.com/in/username")
 * @returns Transformed profile data ready for database storage
 */
export async function fetchLinkedInProfile(
  linkedinUrl: string
): Promise<ProfileData> {
  try {
    // Trigger the scrape job
    const snapshotId = await triggerLinkedInScrape([linkedinUrl]);

    // Poll for results
    const profiles = await pollForSnapshot(snapshotId);

    if (!profiles || profiles.length === 0) {
      throw new Error('No profile data returned from Bright Data');
    }

    const rawProfile = profiles[0] as BrightDataLinkedInResponse & { warning?: string; warning_code?: string };

    // Check for warnings (private/hidden profiles)
    if (rawProfile.warning || rawProfile.warning_code) {
      console.log(`[LinkedIn Scraper] Profile unavailable: ${rawProfile.warning || 'Private or hidden'}`);
      throw new Error(`Profile is private or unavailable: ${rawProfile.warning || rawProfile.warning_code}`);
    }

    // Transform the first profile to our database format
    const profileData = transformBrightDataProfile(profiles[0]);

    return profileData;
  } catch (error) {
    console.error('Error fetching LinkedIn profile:', error);
    throw new Error(
      `Failed to fetch LinkedIn profile from ${linkedinUrl}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Fetch multiple LinkedIn profiles in a single request (batch operation)
 * @param linkedinUrls - Array of LinkedIn profile URLs
 * @returns Array of transformed profile data
 */
export async function fetchLinkedInProfiles(
  linkedinUrls: string[]
): Promise<ProfileData[]> {
  try {
    // Trigger the scrape job for all URLs
    const snapshotId = await triggerLinkedInScrape(linkedinUrls);

    // Poll for results
    const profiles = await pollForSnapshot(snapshotId);

    // Transform all profiles to our database format
    return profiles.map(profile => transformBrightDataProfile(profile));
  } catch (error) {
    console.error('Error fetching LinkedIn profiles:', error);
    throw new Error(
      `Failed to fetch LinkedIn profiles: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Validate if a URL is a valid LinkedIn profile URL
 */
export function isValidLinkedInUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'linkedin.com' ||
      parsed.hostname === 'www.linkedin.com' ||
      parsed.hostname.endsWith('.linkedin.com')
    ) && parsed.pathname.startsWith('/in/');
  } catch {
    return false;
  }
}
