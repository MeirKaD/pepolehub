import { NextRequest } from 'next/server';
import { getResearchById } from '@/lib/cache/research-cache';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/research/[id]/stream
 * Server-Sent Events (SSE) endpoint for real-time research progress
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const { id } = params;

  if (!id || typeof id !== 'string') {
    return new Response('Research ID is required', { status: 400 });
  }

  console.log('[Research Stream] Starting stream for research:', id);

  // Check if research exists
  const research = await getResearchById(id);
  if (!research) {
    return new Response('Research not found', { status: 404 });
  }

  // If already completed or failed, return the result immediately
  if (research.status === 'completed' || research.status === 'failed') {
    console.log('[Research Stream] Research already finished:', research.status);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send final status
        const data = {
          type: research.status === 'completed' ? 'completed' : 'failed',
          status: research.status,
          personName: research.personName,
          report: research.status === 'completed' ? research.report : undefined,
          sources: research.status === 'completed' ? research.sources : undefined,
          errorMessage: research.status === 'failed' ? research.errorMessage : undefined,
          createdAt: research.createdAt,
          updatedAt: research.updatedAt,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  // For pending/processing research, we'll poll the database and stream updates
  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      console.log('[Research Stream] Starting real-time stream for:', id);

      // Send initial status
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: 'status',
            status: research.status,
            message: 'Monitoring research progress...',
            personName: research.personName,
          })}\n\n`
        )
      );

      let lastStatus = research.status;
      let pollCount = 0;
      const maxPolls = 120; // 10 minutes (5 seconds * 120)

      // Poll database every 5 seconds for status updates
      intervalId = setInterval(async () => {
        try {
          pollCount++;

          const updated = await getResearchById(id);
          if (!updated) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'error',
                  message: 'Research record not found',
                })}\n\n`
              )
            );
            if (intervalId) clearInterval(intervalId);
            controller.close();
            return;
          }

          // Send status update if changed
          if (updated.status !== lastStatus) {
            console.log('[Research Stream] Status changed:', lastStatus, '->', updated.status);
            lastStatus = updated.status;

            const statusMessage = getStatusMessage(updated.status);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'status',
                  status: updated.status,
                  message: statusMessage,
                  personName: updated.personName,
                })}\n\n`
              )
            );
          }

          // Send metadata updates if available
          if (updated.metadata && typeof updated.metadata === 'object') {
            const metadata = updated.metadata as Record<string, unknown>;
            if (metadata.step) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'progress',
                    step: metadata.step,
                    progress: metadata.progress || 0,
                  })}\n\n`
                )
              );
            }
          }

          // If completed, send final result and close
          if (updated.status === 'completed') {
            console.log('[Research Stream] Research completed');
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'completed',
                  status: 'completed',
                  personName: updated.personName,
                  report: updated.report,
                  sources: updated.sources,
                  createdAt: updated.createdAt,
                  updatedAt: updated.updatedAt,
                })}\n\n`
              )
            );
            if (intervalId) clearInterval(intervalId);
            controller.close();
            return;
          }

          // If failed, send error and close
          if (updated.status === 'failed') {
            console.log('[Research Stream] Research failed');
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'failed',
                  status: 'failed',
                  errorMessage: updated.errorMessage || 'Research failed',
                })}\n\n`
              )
            );
            if (intervalId) clearInterval(intervalId);
            controller.close();
            return;
          }

          // Timeout after max polls
          if (pollCount >= maxPolls) {
            console.log('[Research Stream] Timeout reached');
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'timeout',
                  message: 'Research is taking longer than expected. Please check back later.',
                })}\n\n`
              )
            );
            if (intervalId) clearInterval(intervalId);
            controller.close();
          }
        } catch (error) {
          console.error('[Research Stream] Polling error:', error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                message: error instanceof Error ? error.message : 'Streaming error',
              })}\n\n`
            )
          );
          if (intervalId) clearInterval(intervalId);
          controller.close();
        }
      }, 5000); // Poll every 5 seconds

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        console.log('[Research Stream] Client disconnected');
        if (intervalId) clearInterval(intervalId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

function getStatusMessage(status: string): string {
  switch (status) {
    case 'pending':
      return 'Research queued and waiting to start...';
    case 'processing':
      return 'Research in progress...';
    case 'completed':
      return 'Research completed successfully!';
    case 'failed':
      return 'Research failed.';
    default:
      return 'Unknown status';
  }
}
