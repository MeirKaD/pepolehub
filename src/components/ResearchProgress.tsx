'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, Search, Globe, FileText, Brain } from 'lucide-react';

interface ResearchProgressProps {
  researchId: string;
  initialData: {
    personName: string;
    status: string;
  };
}

interface ProgressStep {
  id: string;
  label: string;
  icon: typeof Loader2;
  status: 'pending' | 'active' | 'completed';
}

interface StreamEvent {
  type: 'status' | 'progress' | 'completed' | 'failed' | 'timeout' | 'error';
  status?: string;
  message?: string;
  personName?: string;
  step?: string;
  progress?: number;
  report?: string;
  sources?: Array<{ url: string; summary: string }>;
  errorMessage?: string;
}

export function ResearchProgress({ researchId, initialData }: ResearchProgressProps) {
  const [currentStep, setCurrentStep] = useState<string>('initializing');
  const [statusMessage, setStatusMessage] = useState('Starting research...');
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const steps: ProgressStep[] = [
    { id: 'initializing', label: 'Initializing research', icon: Loader2, status: 'active' },
    { id: 'fetching-linkedin', label: 'Fetching LinkedIn profile', icon: Search, status: 'pending' },
    { id: 'searching-web', label: 'Searching the web', icon: Globe, status: 'pending' },
    { id: 'scraping', label: 'Scraping web pages', icon: FileText, status: 'pending' },
    { id: 'analyzing', label: 'Analyzing content', icon: Brain, status: 'pending' },
    { id: 'generating-report', label: 'Generating report', icon: FileText, status: 'pending' },
  ];

  const [stepStatuses, setStepStatuses] = useState<Record<string, 'pending' | 'active' | 'completed'>>(
    steps.reduce((acc, step, idx) => ({
      ...acc,
      [step.id]: idx === 0 ? 'active' : 'pending',
    }), {})
  );

  useEffect(() => {
    // Connect to SSE stream
    const eventSource = new EventSource(`/api/research/${researchId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data: StreamEvent = JSON.parse(event.data);
        console.log('[ResearchProgress] SSE event:', data);

        switch (data.type) {
          case 'status':
            setStatusMessage(data.message || 'Processing...');
            break;

          case 'progress':
            if (data.step) {
              setCurrentStep(data.step);
              // Update step statuses
              setStepStatuses((prev) => {
                const newStatuses = { ...prev };
                // Mark all previous steps as completed
                let foundCurrent = false;
                for (const step of steps) {
                  if (step.id === data.step) {
                    newStatuses[step.id] = 'active';
                    foundCurrent = true;
                  } else if (!foundCurrent) {
                    newStatuses[step.id] = 'completed';
                  }
                }
                return newStatuses;
              });
            }
            if (data.progress !== undefined) {
              setProgress(data.progress * 100);
            }
            break;

          case 'completed':
            setIsCompleted(true);
            setStatusMessage('Research completed!');
            setProgress(100);
            // Mark all steps as completed
            setStepStatuses((prev) =>
              Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: 'completed' }), {})
            );
            eventSource.close();
            // Reload the page to show the report
            setTimeout(() => {
              window.location.reload();
            }, 1500);
            break;

          case 'failed':
            setIsFailed(true);
            setErrorMessage(data.errorMessage || 'Research failed');
            setStatusMessage('Research failed');
            eventSource.close();
            break;

          case 'timeout':
            setStatusMessage(data.message || 'Research is taking longer than expected');
            eventSource.close();
            break;

          case 'error':
            setIsFailed(true);
            setErrorMessage(data.message || 'An error occurred');
            eventSource.close();
            break;
        }
      } catch (error) {
        console.error('[ResearchProgress] Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[ResearchProgress] SSE error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [researchId]);

  return (
    <div className="space-y-6">
      {/* Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {!isCompleted && !isFailed && (
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            )}
            {isCompleted && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            {isFailed && <CheckCircle2 className="h-5 w-5 text-red-600" />}
            {isCompleted ? 'Research Complete' : isFailed ? 'Research Failed' : 'Research in Progress'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Message */}
          <div className="text-center">
            <p className="text-lg text-muted-foreground">{statusMessage}</p>
            {progress > 0 && (
              <p className="text-sm text-muted-foreground mt-1">{Math.round(progress)}% complete</p>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Error Message */}
          {isFailed && errorMessage && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm">{errorMessage}</p>
            </div>
          )}

          {/* Steps List */}
          <div className="space-y-3">
            {steps.map((step) => {
              const status = stepStatuses[step.id] || 'pending';
              const Icon = step.icon;

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    status === 'completed'
                      ? 'bg-green-50 dark:bg-green-950/20'
                      : status === 'active'
                      ? 'bg-blue-50 dark:bg-blue-950/20'
                      : 'bg-gray-50 dark:bg-gray-800/20'
                  }`}
                >
                  <div
                    className={`flex-shrink-0 ${
                      status === 'completed'
                        ? 'text-green-600'
                        : status === 'active'
                        ? 'text-blue-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : status === 'active' ? (
                      <Icon className="h-5 w-5 animate-spin" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      status === 'completed'
                        ? 'text-green-700 dark:text-green-400'
                        : status === 'active'
                        ? 'text-blue-700 dark:text-blue-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-700 dark:text-blue-400">
            This research process typically takes 1-3 minutes. The system is gathering information
            from LinkedIn and multiple web sources to create a comprehensive report.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
