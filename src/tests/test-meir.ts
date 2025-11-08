import 'dotenv/config';
import { createResearchGraph } from '@/lib/research/graph';

async function run() {
  const graph = createResearchGraph();

  console.log('🧪 Running full research flow for Meir Kadosh...');

  const initialState = {
    personName: 'Meir Kadosh',
    linkedinUrl: 'https://www.linkedin.com/in/meir-kadosh-7bb5b7224',
    linkedinData: null,
    searchQuery: null,
    searchResults: [],
    scrapedContents: [],
    webSummaries: [],
    finalReport: null,
    errors: [],
    status: 'Initialized from test harness',
  };

  const result = await graph.invoke(initialState, {
    configurable: {
      thread_id: 'test-thread-meir',
    },
  });

  console.log('\n✅ Research run complete. Aggregated state:\n');
  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error('❌ Research run failed:', error);
  process.exit(1);
});
