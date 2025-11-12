'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ResearchReportProps {
  report: string;
  sources: Array<{ url: string; summary: string }>;
  personName: string;
}

export function ResearchReport({ report, sources }: ResearchReportProps) {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(true);

  // Strip markdown code fence wrapper if it exists (only the wrapping backticks, not content)
  const cleanedReport = report.trim().replace(/^```markdown\n/, '').replace(/\n```$/, '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanedReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Report Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Research Report</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Report
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="prose prose-lg max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {cleanedReport}
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* Sources Card */}
      {sources && sources.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Sources</CardTitle>
                <Badge variant="secondary">{sources.length}</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSources(!showSources)}
              >
                {showSources ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Hide
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Show
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {showSources && (
            <CardContent>
              <div className="space-y-4">
                {sources.map((source, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline font-medium text-sm flex items-center gap-1 mb-2 break-all"
                        >
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          {new URL(source.url).hostname}
                        </a>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {source.summary}
                        </p>
                      </div>
                      <Badge variant="outline" className="flex-shrink-0">
                        {index + 1}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Disclaimer */}
      <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200">
        <CardContent className="pt-6">
          <p className="text-xs text-yellow-700 dark:text-yellow-400">
            <strong>Disclaimer:</strong> This research report is AI-generated based on publicly
            available information. Please verify important details independently. Information may be
            outdated or incomplete.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
