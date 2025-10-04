import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ProfileData, Experience, Education, Language } from '@/types/linkedin';

const CACHE_FRESHNESS_DAYS = 30;

/**
 * Extract LinkedIn ID from URL
 * Example: https://www.linkedin.com/in/meir-kadosh-7bb5b7224 -> meir-kadosh-7bb5b7224
 */
function extractLinkedInId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    // LinkedIn URLs are like: /in/username or /in/username/
    if (pathParts[0] === 'in' && pathParts[1]) {
      return pathParts[1];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get a cached profile from the database
 * Returns null if profile doesn't exist or is stale (older than 30 days)
 *
 * @param linkedinUrl - LinkedIn profile URL (any region variant)
 * @returns Cached profile data or null
 */
export async function getCachedProfile(
  linkedinUrl: string
): Promise<ProfileData | null> {
  try {
    // Extract LinkedIn ID from URL to handle regional variants
    const linkedinId = extractLinkedInId(linkedinUrl);

    if (!linkedinId) {
      console.log(`[Cache] Invalid LinkedIn URL: ${linkedinUrl}`);
      return null;
    }

    const profile = await prisma.person.findUnique({
      where: { linkedinId },
    });

    if (!profile) {
      console.log(`[Cache] Miss for ${linkedinId}`);
      return null;
    }

    // Check if profile is fresh (< 30 days old)
    const daysSinceUpdate = Math.floor(
      (Date.now() - profile.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceUpdate >= CACHE_FRESHNESS_DAYS) {
      console.log(
        `[Cache] Profile for ${linkedinId} is stale (${daysSinceUpdate} days old)`
      );
      return null;
    }

    console.log(`[Cache] Hit for ${linkedinId} (${daysSinceUpdate} days old)`);

    // Transform Prisma model to ProfileData format
    return {
      linkedinUrl: profile.linkedinUrl,
      linkedinId: profile.linkedinId,
      linkedinNumId: profile.linkedinNumId || undefined,
      firstName: profile.firstName,
      lastName: profile.lastName,
      fullName: profile.fullName,
      headline: profile.headline || undefined,
      about: profile.about || undefined,
      location: profile.location || undefined,
      city: profile.city || undefined,
      countryCode: profile.countryCode || undefined,
      profilePicUrl: profile.profilePicUrl || undefined,
      bannerImage: profile.bannerImage || undefined,
      defaultAvatar: profile.defaultAvatar || undefined,
      currentCompany: profile.currentCompany || undefined,
      currentCompanyId: profile.currentCompanyId || undefined,
      experience: profile.experience as unknown as Experience[] | undefined,
      education: profile.education as unknown as Education[] | undefined,
      languages: profile.languages as unknown as Language[] | undefined,
      connections: profile.connections || undefined,
      followers: profile.followers || undefined,
      memorializedAccount: profile.memorializedAccount || undefined,
    };
  } catch (error) {
    console.error('[Cache] Error fetching cached profile:', error);
    return null;
  }
}

/**
 * Get multiple cached profiles from the database in a single query
 * Returns only fresh profiles (< 30 days old)
 *
 * @param linkedinUrls - Array of LinkedIn profile URLs
 * @returns Object mapping linkedinId to ProfileData (only cached/fresh profiles)
 */
export async function getCachedProfiles(
  linkedinUrls: string[]
): Promise<Record<string, ProfileData>> {
  try {
    // Extract LinkedIn IDs from URLs
    const linkedinIds = linkedinUrls
      .map(url => extractLinkedInId(url))
      .filter((id): id is string => id !== null);

    if (linkedinIds.length === 0) {
      return {};
    }

    // Batch fetch all profiles
    const profiles = await prisma.person.findMany({
      where: {
        linkedinId: { in: linkedinIds },
      },
    });

    const result: Record<string, ProfileData> = {};
    const now = Date.now();

    for (const profile of profiles) {
      // Check freshness
      const daysSinceUpdate = Math.floor(
        (now - profile.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceUpdate < CACHE_FRESHNESS_DAYS) {
        result[profile.linkedinId] = {
          linkedinUrl: profile.linkedinUrl,
          linkedinId: profile.linkedinId,
          linkedinNumId: profile.linkedinNumId || undefined,
          firstName: profile.firstName,
          lastName: profile.lastName,
          fullName: profile.fullName,
          headline: profile.headline || undefined,
          about: profile.about || undefined,
          location: profile.location || undefined,
          city: profile.city || undefined,
          countryCode: profile.countryCode || undefined,
          profilePicUrl: profile.profilePicUrl || undefined,
          bannerImage: profile.bannerImage || undefined,
          defaultAvatar: profile.defaultAvatar || undefined,
          currentCompany: profile.currentCompany || undefined,
          currentCompanyId: profile.currentCompanyId || undefined,
          experience: profile.experience as unknown as Experience[] | undefined,
          education: profile.education as unknown as Education[] | undefined,
          languages: profile.languages as unknown as Language[] | undefined,
          connections: profile.connections || undefined,
          followers: profile.followers || undefined,
          memorializedAccount: profile.memorializedAccount || undefined,
        };
        console.log(`[Cache] Batch hit for ${profile.linkedinId} (${daysSinceUpdate} days old)`);
      } else {
        console.log(`[Cache] Batch skip stale ${profile.linkedinId} (${daysSinceUpdate} days old)`);
      }
    }

    console.log(`[Cache] Batch query: ${linkedinIds.length} requested, ${Object.keys(result).length} cached`);
    return result;
  } catch (error) {
    console.error('[Cache] Error fetching cached profiles:', error);
    return {};
  }
}

/**
 * Save or update a profile in the database
 * Updates lastViewed and increments searchCount on existing profiles
 *
 * @param data - Profile data to save
 * @returns Saved profile data
 */
export async function saveProfile(data: ProfileData): Promise<ProfileData> {
  try {
    const saved = await prisma.person.upsert({
      where: { linkedinId: data.linkedinId },
      update: {
        // Update all fields (including linkedinUrl in case region changed)
        linkedinUrl: data.linkedinUrl,
        linkedinNumId: data.linkedinNumId,
        firstName: data.firstName,
        lastName: data.lastName,
        fullName: data.fullName,
        headline: data.headline,
        about: data.about,
        location: data.location,
        city: data.city,
        countryCode: data.countryCode,
        profilePicUrl: data.profilePicUrl,
        bannerImage: data.bannerImage,
        defaultAvatar: data.defaultAvatar,
        currentCompany: data.currentCompany,
        currentCompanyId: data.currentCompanyId,
        experience: (data.experience ?? undefined) as Prisma.InputJsonValue | undefined,
        education: (data.education ?? undefined) as Prisma.InputJsonValue | undefined,
        languages: (data.languages ?? undefined) as Prisma.InputJsonValue | undefined,
        connections: data.connections,
        followers: data.followers,
        memorializedAccount: data.memorializedAccount,
        // Increment search count and update lastViewed
        searchCount: { increment: 1 },
        lastViewed: new Date(),
      },
      create: {
        linkedinUrl: data.linkedinUrl,
        linkedinId: data.linkedinId,
        linkedinNumId: data.linkedinNumId,
        firstName: data.firstName,
        lastName: data.lastName,
        fullName: data.fullName,
        headline: data.headline,
        about: data.about,
        location: data.location,
        city: data.city,
        countryCode: data.countryCode,
        profilePicUrl: data.profilePicUrl,
        bannerImage: data.bannerImage,
        defaultAvatar: data.defaultAvatar ?? false,
        currentCompany: data.currentCompany,
        currentCompanyId: data.currentCompanyId,
        experience: (data.experience ?? undefined) as Prisma.InputJsonValue | undefined,
        education: (data.education ?? undefined) as Prisma.InputJsonValue | undefined,
        languages: (data.languages ?? undefined) as Prisma.InputJsonValue | undefined,
        connections: data.connections,
        followers: data.followers,
        memorializedAccount: data.memorializedAccount ?? false,
      },
    });

    console.log(
      `[Cache] Saved profile for ${data.linkedinId} (searchCount: ${saved.searchCount})`
    );

    return data;
  } catch (error) {
    console.error('[Cache] Error saving profile:', error);
    throw new Error(
      `Failed to save profile to cache: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}
