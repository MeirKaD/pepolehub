/**
 * Test script for the research LLM service helpers.
 * Run with: npx tsx src/tests/test-llm-service.ts
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import { generateSearchQuery, summarizeWebContent, generateResearchReport } from '@/lib/research/llm-service';
import type { ResearchDataBundle } from '@/lib/research/types';

const SAMPLE_PERSON = {
  name: 'Ada Lovelace',
  linkedin: 'https://www.linkedin.com/in/ada-lovelace',
};

const SAMPLE_CONTENT = `Ada Lovelace is widely regarded as the world’s first computer programmer for her notes on Charles Babbage's Analytical Engine.
She collaborated with Babbage in London and documented methods that predicted the concept of software decades before modern computers existed.`;

async function run() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    console.warn('⚠️  GOOGLE_GENERATIVE_AI_API_KEY not set. Running error-handling tests only.\n');
    await runErrorHarness();
    console.log('\n✅ Error handling confirmed.');
    return;
  }

  console.log('🧪 Testing research LLM service (live Gemini calls)\n');

  try {
    const searchResult = await generateSearchQuery(SAMPLE_PERSON.name, SAMPLE_PERSON.linkedin, 'pioneer programmer');
    assert.ok(searchResult.query.includes('Ada'), 'Search query should reference the person');
    console.log('✅ Search query:', searchResult.query);

    const summaryResult = await summarizeWebContent('https://example.com/ada', SAMPLE_CONTENT, SAMPLE_PERSON.name);
    assert.ok(summaryResult, 'Summary result should not be null');
    console.log('✅ Summary snippet:', summaryResult?.summary.slice(0, 120), '...');

    const researchData: ResearchDataBundle = {
      personName: SAMPLE_PERSON.name,
      linkedinUrl: SAMPLE_PERSON.linkedin,
      linkedinData: null,
      webSummaries: summaryResult ? [summaryResult] : [],
      searchResults: [],
    };

    const reportResult = await generateResearchReport(researchData);
    assert.ok(reportResult.report.includes('Ada'), 'Report should include the subject name');
    console.log('✅ Report generated with length:', reportResult.report.length);

    console.log('\n🎉 Live Gemini tests completed successfully.');

    await runErrorHarness();
    console.log('\n✅ Error handling confirmed.');
  } catch (error) {
    console.error('❌ Live Gemini test failed:', error);
    process.exit(1);
  }
}

run();

async function runErrorHarness() {
  const originalKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  try {
    await expectRejection(
      () => generateSearchQuery(SAMPLE_PERSON.name, SAMPLE_PERSON.linkedin),
      'generateSearchQuery',
    );
    await expectRejection(
      () => summarizeWebContent('https://example.com/ada', SAMPLE_CONTENT, SAMPLE_PERSON.name),
      'summarizeWebContent',
    );
    const data: ResearchDataBundle = {
      personName: SAMPLE_PERSON.name,
      linkedinUrl: SAMPLE_PERSON.linkedin,
      linkedinData: null,
      webSummaries: [],
      searchResults: [],
    };
    await expectRejection(() => generateResearchReport(data), 'generateResearchReport');
  } finally {
    if (originalKey) {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalKey;
    }
  }
}

async function expectRejection(fn: () => Promise<unknown>, label: string) {
  let rejected = false;
  try {
    await fn();
  } catch {
    rejected = true;
    console.log(`✅ ${label} rejected as expected (missing API key).`);
  }
  assert.ok(rejected, `${label} should reject when API key is missing`);
}
