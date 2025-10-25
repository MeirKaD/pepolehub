import 'dotenv/config';
import redis from '../lib/redis/client';
import { deleteCache } from '../lib/redis/cache';
import {
  batchCacheProfiles,
  batchGetCachedProfiles,
  cacheFullProfile,
  cacheProfileSummary,
  getCachedFullProfile,
  getCachedProfileSummary,
  getProfileFullCacheKey,
  getProfileSummaryCacheKey,
} from '../lib/redis/profile-cache';
import type { ProfileData, ProfileSummary } from '@/types/linkedin';

const mockSummary: ProfileSummary = {
  linkedinUrl: 'https://www.linkedin.com/in/sample-profile/',
  linkedinId: 'sample-profile',
  title: 'Sample Person - Staff Engineer | LinkedIn',
  snippet: 'Location: San Francisco · Staff Engineer at Sample Corp',
  name: 'Sample Person',
  headline: 'Staff Engineer at Sample Corp',
  location: 'San Francisco, California, United States',
};

const mockFullProfile: ProfileData = {
  linkedinUrl: mockSummary.linkedinUrl,
  linkedinId: mockSummary.linkedinId,
  firstName: 'Sample',
  lastName: 'Person',
  fullName: 'Sample Person',
  headline: mockSummary.headline,
  about: 'Building scalable systems.',
  location: mockSummary.location,
  city: 'San Francisco',
  countryCode: 'US',
  profilePicUrl: 'https://example.com/profile.jpg',
  bannerImage: 'https://example.com/banner.jpg',
  defaultAvatar: false,
  currentCompany: 'Sample Corp',
  currentCompanyId: 'sample-corp-id',
  experience: [],
  education: [],
  languages: [],
  connections: 500,
  followers: 1000,
  memorializedAccount: false,
};

async function cleanup() {
  await deleteCache(getProfileSummaryCacheKey(mockSummary.linkedinId));
  await deleteCache(getProfileFullCacheKey(mockFullProfile.linkedinId));
}

async function testProfileCache() {
  console.log('Testing profile cache layer...\n');

  await cleanup();

  console.log('Caching profile summary...');
  await cacheProfileSummary(mockSummary);
  const cachedSummary = await getCachedProfileSummary(mockSummary.linkedinId);
  console.log('Summary cache hit:', Boolean(cachedSummary));
  if (cachedSummary) {
    console.log('Summary headline:', cachedSummary.headline);
  }

  console.log('\nCaching full profile...');
  await cacheFullProfile(mockFullProfile);
  const cachedFull = await getCachedFullProfile(mockFullProfile.linkedinId);
  console.log('Full profile cache hit:', Boolean(cachedFull));
  if (cachedFull) {
    console.log('Full profile source:', cachedFull.source);
    console.log('Full profile cachedAt:', cachedFull.cachedAt);
  }

  console.log('\nBatch caching profiles...');
  await batchCacheProfiles([mockFullProfile]);
  const batchLoaded = await batchGetCachedProfiles([mockFullProfile.linkedinId]);
  console.log('Batch cached IDs:', Object.keys(batchLoaded));

  await cleanup();
}

testProfileCache()
  .catch((error) => {
    console.error('[Profile Cache Test] Encountered error:', error);
  })
  .finally(async () => {
    await redis.quit();
  });
