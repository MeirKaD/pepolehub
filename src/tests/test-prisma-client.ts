import { prisma } from '@/lib/prisma';

async function testPrismaClient() {
  console.log('Testing Prisma Client...\n');

  // Check available models
  const models = Object.keys(prisma).filter(
    (k) => !k.startsWith('_') && !k.startsWith('$') && typeof (prisma as unknown as Record<string, unknown>)[k] === 'object'
  );

  console.log('Available models:', models);
  console.log('Has research model?', 'research' in prisma);
  console.log('prisma.research type:', typeof (prisma as unknown as Record<string, unknown>).research);

  if ('research' in prisma) {
    console.log('✅ prisma.research exists');

    // Try to count research records
    try {
      const count = await prisma.research.count();
      console.log('✅ Research records count:', count);
    } catch (error) {
      console.error('❌ Error counting research records:', error);
    }
  } else {
    console.error('❌ prisma.research does NOT exist');
    console.log('\nAvailable properties on prisma:', Object.keys(prisma).slice(0, 20));
  }

  await prisma.$disconnect();
}

testPrismaClient().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
