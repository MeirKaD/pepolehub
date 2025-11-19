import { createResearchGraph } from './graph';
import {
  updateResearchStatus,
  saveResearchReport,
  markResearchFailed,
} from '@/lib/cache/research-cache';
import type { ResearchState } from './types';

/**
 * Run the research graph asynchronously
 * This function is called after creating a research record
 * It executes the LangGraph workflow and updates the database
 */
export async function runResearchGraph(
  researchId: string,
  linkedinUrl: string,
  personName: string
): Promise<void> {
  console.log(`[Research Runner] Starting research for: ${personName} (${researchId})`);

  try {
    // Update status to 'processing'
    await updateResearchStatus(researchId, 'processing', {
      startedAt: new Date().toISOString(),
    });

    // Create and compile the graph
    const compiledGraph = createResearchGraph();

    // Initial state
    const initialState: Partial<ResearchState> = {
      personName,
      linkedinUrl,
      status: 'Initializing research...',
    };

    console.log(`[Research Runner] Executing graph for research ${researchId}...`);

    // Execute the graph with thread_id config for checkpointing
    const result = await compiledGraph.invoke(initialState, {
      configurable: {
        thread_id: researchId,
      },
    });

    console.log(`[Research Runner] Graph execution completed for ${researchId}`);
    console.log(`[Research Runner] Result keys:`, Object.keys(result));
    console.log(`[Research Runner] Status:`, result.status);
    console.log(`[Research Runner] Errors:`, result.errors);
    console.log(`[Research Runner] Has finalReport:`, !!result.finalReport);
    console.log(`[Research Runner] Has linkedinData:`, !!result.linkedinData);
    console.log(`[Research Runner] Web summaries count:`, result.webSummaries?.length ?? 0);

    // Check if we have a final report
    if (!result.finalReport) {
      const errorDetails = {
        status: result.status,
        errors: result.errors,
        hasLinkedIn: !!result.linkedinData,
        webSummariesCount: result.webSummaries?.length ?? 0,
      };
      console.error(`[Research Runner] No report generated. Details:`, errorDetails);
      throw new Error(`Graph execution completed but no report was generated. Status: ${result.status}, Errors: ${JSON.stringify(result.errors)}`);
    }

    // Extract sources from web summaries
    const sources = (result.webSummaries || []).map((summary: { url: string; summary: string }) => ({
      url: summary.url,
      summary: summary.summary,
    }));

    // Save the completed research report
    await saveResearchReport(
      researchId,
      result.finalReport,
      sources,
      {
        executionTime: Date.now(),
        linkedinDataAvailable: !!result.linkedinData,
        webSummariesCount: result.webSummaries?.length || 0,
        searchResultsCount: result.searchResults?.length || 0,
        errors: result.errors || [],
      }
    );

    console.log(`[Research Runner] Research ${researchId} completed successfully`);
  } catch (error) {
    console.error(`[Research Runner] Error in research ${researchId}:`, error);

    // Mark research as failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    await markResearchFailed(researchId, errorMessage, {
      failedAt: new Date().toISOString(),
      error: error instanceof Error ? error.stack : String(error),
    });

    console.log(`[Research Runner] Research ${researchId} marked as failed`);
  }
}
