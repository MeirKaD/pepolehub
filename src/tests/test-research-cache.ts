import 'dotenv/config';
import {
  createResearchRecord,
  getCachedResearch,
  saveResearchReport,
  updateResearchStatus,
  markResearchFailed,
  getResearchById,
  listRecentResearch,
  invalidateResearchCache,
} from '@/lib/cache/research-cache';
import { prisma } from '@/lib/prisma';

async function testResearchCache() {
  console.log('🧪 Testing Research Cache Layer...\n');

  const testLinkedInUrl = 'https://www.linkedin.com/in/cache-test-user';
  const testPersonName = 'Cache Test User';

  try {
    // Test 1: Create research record
    console.log('1️⃣ Creating research record...');
    const research = await createResearchRecord(testLinkedInUrl, testPersonName);
    console.log('✅ Created:', research.id);
    console.log('   Status:', research.status);
    console.log('   Person:', research.personName);

    // Test 2: Get research by ID
    console.log('\n2️⃣ Getting research by ID...');
    const fetched = await getResearchById(research.id);
    console.log('✅ Fetched:', fetched?.id === research.id ? 'YES' : 'NO');
    console.log('   Status:', fetched?.status);

    // Test 3: Update research status
    console.log('\n3️⃣ Updating research status to processing...');
    await updateResearchStatus(research.id, 'processing', {
      step: 'fetching-linkedin',
      progress: 0.25,
    });
    const afterStatusUpdate = await getResearchById(research.id);
    console.log('✅ Status updated to:', afterStatusUpdate?.status);
    console.log('   Metadata:', JSON.stringify(afterStatusUpdate?.metadata, null, 2));

    // Test 4: Save research report
    console.log('\n4️⃣ Saving research report...');
    const mockReport = `# Research Report: ${testPersonName}

## Summary
This is a test research report generated for cache testing purposes.

## Professional Background
- Software Engineer at Test Company
- 5+ years of experience

## Sources
See below for all sources used in this research.
`;

    const mockSources = [
      {
        url: 'https://example.com/article1',
        summary: 'Article discussing the professional achievements of the person.',
      },
      {
        url: 'https://example.com/interview',
        summary: 'Interview transcript covering career highlights.',
      },
    ];

    const completed = await saveResearchReport(
      research.id,
      mockReport,
      mockSources,
      {
        totalDuration: 120000,
        nodesExecuted: 8,
      }
    );

    console.log('✅ Report saved:', completed.id);
    console.log('   Status:', completed.status);
    console.log('   Sources count:', completed.sources.length);
    console.log('   Report length:', completed.report.length, 'chars');
    console.log('   Cached in:', completed.source);

    // Test 5: Get cached research (should hit cache)
    console.log('\n5️⃣ Getting cached research (should hit Redis or Postgres)...');
    const cached = await getCachedResearch(testLinkedInUrl);
    console.log('✅ Cache hit:', cached ? 'YES' : 'NO');
    console.log('   Source:', cached?.source);
    console.log('   Report matches:', cached?.report === mockReport ? 'YES' : 'NO');

    // Test 6: Invalidate cache
    console.log('\n6️⃣ Invalidating cache...');
    await invalidateResearchCache(testLinkedInUrl);
    console.log('✅ Cache invalidated');

    // Test 7: Get cached research again (should hit Postgres only)
    console.log('\n7️⃣ Getting cached research after invalidation...');
    const cachedAfterInvalidation = await getCachedResearch(testLinkedInUrl);
    console.log('✅ Cache hit:', cachedAfterInvalidation ? 'YES' : 'NO');
    console.log('   Source:', cachedAfterInvalidation?.source);

    // Test 8: Create another research and mark as failed
    console.log('\n8️⃣ Testing failed research...');
    const failedResearch = await createResearchRecord(
      'https://www.linkedin.com/in/failed-test',
      'Failed Test User'
    );
    await updateResearchStatus(failedResearch.id, 'processing');
    await markResearchFailed(
      failedResearch.id,
      'Test error: LinkedIn profile not found',
      { errorCode: 'PROFILE_NOT_FOUND' }
    );
    const failedFetched = await getResearchById(failedResearch.id);
    console.log('✅ Failed research status:', failedFetched?.status);
    console.log('   Error message:', failedFetched?.errorMessage);

    // Test 9: List recent research
    console.log('\n9️⃣ Listing recent research...');
    const recent = await listRecentResearch(5, 0);
    console.log('✅ Found', recent.length, 'research records');
    recent.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.personName} - ${r.status}`);
    });

    // Test 10: List only completed research
    console.log('\n🔟 Listing only completed research...');
    const completedOnly = await listRecentResearch(5, 0, 'completed');
    console.log('✅ Found', completedOnly.length, 'completed research records');

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await prisma.research.deleteMany({
      where: {
        OR: [
          { id: research.id },
          { id: failedResearch.id },
        ],
      },
    });
    console.log('✅ Test data cleaned up');

    console.log('\n✨ All cache tests passed!');
  } catch (error) {
    console.error('\n❌ Cache test failed:', error);
    // Cleanup on error
    try {
      await prisma.research.deleteMany({
        where: {
          linkedinUrl: {
            in: [testLinkedInUrl, 'https://www.linkedin.com/in/failed-test'],
          },
        },
      });
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testResearchCache().catch((error) => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
