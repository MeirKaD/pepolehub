/**
 * Sanity test for the research graph scaffolding.
 * Run with: npx tsx src/tests/test-graph-structure.ts
 */

import { createResearchGraphBuilder } from '@/lib/research/graph';

async function testGraphStructure() {
  const { graph, nodes } = createResearchGraphBuilder();

  console.log('Registered nodes:', Object.keys(nodes));
  console.log('Graph object created:', Boolean(graph));
}

testGraphStructure().catch((error) => {
  console.error('❌ Graph structure test failed:', error);
  process.exit(1);
});
