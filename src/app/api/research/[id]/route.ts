import { NextRequest, NextResponse } from 'next/server';
import { getResearchById } from '@/lib/cache/research-cache';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/research/[id]
 * Get research status and report by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const { id } = params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Research ID is required' },
        { status: 400 }
      );
    }

    console.log('[Research API] Fetching research:', id);

    const research = await getResearchById(id);

    if (!research) {
      return NextResponse.json(
        { success: false, error: 'Research not found' },
        { status: 404 }
      );
    }

    // Return different data based on status
    const response: any = {
      success: true,
      id: research.id,
      status: research.status,
      personName: research.personName,
      linkedinUrl: research.linkedinUrl,
      createdAt: research.createdAt,
      updatedAt: research.updatedAt,
    };

    // Include report and sources only if completed
    if (research.status === 'completed') {
      response.report = research.report;
      response.sources = research.sources;
    }

    // Include error message if failed
    if (research.status === 'failed' && research.errorMessage) {
      response.errorMessage = research.errorMessage;
    }

    // Include metadata if available
    if (research.metadata) {
      response.metadata = research.metadata;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Research API] Error fetching research:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch research',
      },
      { status: 500 }
    );
  }
}
