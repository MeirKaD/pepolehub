import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Experience, Education, Language } from '@/types/linkedin';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * GET /api/profiles/recent
 *
 * Fetches recently cached profiles sorted by updatedAt (newest first)
 *
 * Query params:
 * - limit: number of profiles to return (default: 50, max: 100)
 * - before: ISO timestamp - only return profiles updated before this time (for pagination)
 * - after: ISO timestamp - only return profiles updated after this time (for auto-refresh)
 *
 * Response headers:
 * - X-Total-Count: total number of cached profiles in database
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse limit parameter
    const limitParam = searchParams.get('limit');
    const limit = limitParam
      ? Math.min(parseInt(limitParam, 10), MAX_LIMIT)
      : DEFAULT_LIMIT;

    if (isNaN(limit) || limit < 1) {
      return NextResponse.json(
        { success: false, error: 'Invalid limit parameter' },
        { status: 400 }
      );
    }

    // Parse timestamp filters for pagination and auto-refresh
    const before = searchParams.get('before');
    const after = searchParams.get('after');

    // Build where clause for timestamp filtering
    const whereClause: { updatedAt?: { lt?: Date; gt?: Date } } = {};

    if (before) {
      const beforeDate = new Date(before);
      if (isNaN(beforeDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid before timestamp' },
          { status: 400 }
        );
      }
      whereClause.updatedAt = { lt: beforeDate };
    }

    if (after) {
      const afterDate = new Date(after);
      if (isNaN(afterDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid after timestamp' },
          { status: 400 }
        );
      }
      whereClause.updatedAt = {
        ...(whereClause.updatedAt || {}),
        gt: afterDate
      };
    }

    // Get total count for header
    const totalCount = await prisma.person.count();

    // Fetch profiles sorted by updatedAt descending
    const profiles = await prisma.person.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
    });

    // Transform to ProfileData format with updatedAt timestamp
    const transformedProfiles = profiles.map(profile => ({
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
      updatedAt: profile.updatedAt.toISOString(), // Include timestamp for client tracking
    }));

    return NextResponse.json(
      {
        success: true,
        count: transformedProfiles.length,
        profiles: transformedProfiles,
      },
      {
        headers: {
          'X-Total-Count': totalCount.toString(),
        },
      }
    );
  } catch (error) {
    console.error('[API] Error fetching recent profiles:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch recent profiles',
      },
      { status: 500 }
    );
  }
}
