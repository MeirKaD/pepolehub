import 'dotenv/config';
import { prisma } from '@/lib/prisma';

async function testResearchSchema() {
  console.log('🧪 Testing Research Schema...\n');

  try {
    // Test 1: Create a research record
    console.log('1️⃣ Creating test research record...');
    const testResearch = await prisma.research.create({
      data: {
        linkedinUrl: 'https://www.linkedin.com/in/test-user-123',
        personName: 'Test User',
        report: '# Test Report\n\nThis is a test research report.',
        sources: [
          { url: 'https://example.com/article1', summary: 'Article about Test User' },
          { url: 'https://example.com/article2', summary: 'Interview with Test User' },
        ],
        metadata: {
          testRun: true,
          startedAt: new Date().toISOString(),
        },
        status: 'completed',
      },
    });
    console.log('✅ Created research:', testResearch.id);
    console.log('   Person:', testResearch.personName);
    console.log('   Status:', testResearch.status);
    console.log('   Sources:', (testResearch.sources as Array<unknown>).length);

    // Test 2: Update research status
    console.log('\n2️⃣ Updating research status...');
    const updated = await prisma.research.update({
      where: { id: testResearch.id },
      data: {
        status: 'processing',
        metadata: {
          testRun: true,
          processingAt: new Date().toISOString(),
        },
      },
    });
    console.log('✅ Updated status to:', updated.status);

    // Test 3: Query research by LinkedIn URL
    console.log('\n3️⃣ Querying research by LinkedIn URL...');
    const found = await prisma.research.findFirst({
      where: {
        linkedinUrl: 'https://www.linkedin.com/in/test-user-123',
      },
    });
    console.log('✅ Found research:', found?.id === testResearch.id ? 'YES' : 'NO');

    // Test 4: Query research by status
    console.log('\n4️⃣ Querying research by status...');
    const processing = await prisma.research.findMany({
      where: {
        status: 'processing',
      },
    });
    console.log('✅ Found', processing.length, 'processing research records');

    // Test 5: Test Person-Research relation
    console.log('\n5️⃣ Testing Person-Research relation...');

    // Create a test person
    const testPerson = await prisma.person.upsert({
      where: { linkedinId: 'test-relation-user' },
      update: {},
      create: {
        linkedinUrl: 'https://www.linkedin.com/in/test-relation-user',
        linkedinId: 'test-relation-user',
        firstName: 'Relation',
        lastName: 'Test',
        fullName: 'Relation Test',
        headline: 'Test User for Relations',
      },
    });

    // Create research linked to person
    const linkedResearch = await prisma.research.create({
      data: {
        personId: testPerson.id,
        linkedinUrl: testPerson.linkedinUrl,
        personName: testPerson.fullName,
        report: 'Test report with person relation',
        sources: [],
        status: 'completed',
      },
    });

    // Query person with researches
    const personWithResearches = await prisma.person.findUnique({
      where: { id: testPerson.id },
      include: { researches: true },
    });

    console.log('✅ Person has', personWithResearches?.researches.length, 'research records');
    console.log('   Research ID:', personWithResearches?.researches[0]?.id);

    // Test 6: List recent research
    console.log('\n6️⃣ Listing recent research...');
    const recent = await prisma.research.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    console.log('✅ Found', recent.length, 'recent research records');
    recent.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.personName} - ${r.status}`);
    });

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await prisma.research.deleteMany({
      where: {
        OR: [
          { id: testResearch.id },
          { id: linkedResearch.id },
        ],
      },
    });
    await prisma.person.delete({
      where: { id: testPerson.id },
    });
    console.log('✅ Test data cleaned up');

    console.log('\n✨ All schema tests passed!');
  } catch (error) {
    console.error('\n❌ Schema test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testResearchSchema().catch((error) => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
