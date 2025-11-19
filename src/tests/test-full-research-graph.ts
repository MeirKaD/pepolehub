import 'dotenv/config';
import { createResearchGraph, drawResearchGraphMermaid } from '@/lib/research/graph';

async function run() {
  console.log('🧪 Compiling research graph...');
  const graph = createResearchGraph();
  await graph.getGraphAsync();

  console.log('\n🧾 Mermaid preview:');
  const mermaid = await drawResearchGraphMermaid();
  console.log(mermaid);

  console.log('\n✅ Research graph compile test complete.');
}

run().catch((error) => {
  console.error('❌ Research graph compile test failed:', error);
  process.exit(1);
});
