import { ResearchInputSchema, ResearchOutputSchema, ResearchStateSchema, SearchResultSchema, ScrapedContentSchema, WebSummarySchema } from '@/lib/research/types';

function logResult(label: string, success: boolean) {
  console.log(`${label}: ${success ? '✅ PASS' : '❌ FAIL'}`);
}

async function testResearchTypes() {
  console.log('🧪 Validating research schema definitions');

  const sampleInput = {
    personName: 'Ada Lovelace',
    linkedinUrl: 'https://www.linkedin.com/in/ada-lovelace',
    context: 'Focus on mathematical contributions',
  };
  const inputResult = ResearchInputSchema.safeParse(sampleInput);
  logResult('ResearchInputSchema.safeParse', inputResult.success);

  const searchResult = SearchResultSchema.parse({
    title: 'Ada Lovelace - Pioneer',
    url: 'https://example.com/article',
    snippet: 'Ada Lovelace was an English mathematician…',
    rank: 1,
    source: 'google',
    countryCode: 'US',
  });

  const scraped = ScrapedContentSchema.parse({
    url: searchResult.url,
    content: '<html><body>Example</body></html>',
    contentType: 'text/html',
    bytes: 1280,
    fetchedAt: Date.now(),
    status: 200,
  });

  const summary = WebSummarySchema.parse({
    url: searchResult.url,
    summary: 'Ada Lovelace collaborated with Charles Babbage.',
    keyPoints: ['Analytical Engine notes', 'First algorithm'],
    mentionsPerson: true,
    confidence: 0.92,
    sentiment: 'positive',
    source: 'example.com',
  });

  const stateResult = ResearchStateSchema.safeParse({
    personName: sampleInput.personName,
    linkedinUrl: sampleInput.linkedinUrl,
    linkedinData: null,
    searchQuery: '"Ada Lovelace" news',
    searchResults: [searchResult],
    scrapedContents: [scraped],
    webSummaries: [summary],
    finalReport: null,
    errors: [],
    status: 'collecting',
  });
  logResult('ResearchStateSchema.safeParse', stateResult.success);

  const outputResult = ResearchOutputSchema.safeParse({
    personName: sampleInput.personName,
    linkedinUrl: sampleInput.linkedinUrl,
    report: '# Ada Lovelace\n- Mathematician',
    sources: [searchResult.url],
    generatedAt: Date.now(),
  });
  logResult('ResearchOutputSchema.safeParse', outputResult.success);

  console.log('\nSample parsed state:', JSON.stringify(stateResult.success ? stateResult.data : null, null, 2));
}

testResearchTypes().catch((error) => {
  console.error('[test-research-types] Error:', error);
  process.exit(1);
});
