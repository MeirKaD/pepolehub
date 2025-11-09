'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  FileText,
  Search,
  Globe,
  Brain,
  Clock
} from 'lucide-react';
import { ResearchProgress } from '@/components/ResearchProgress';
import { ResearchReport } from '@/components/ResearchReport';

interface PageProps {
  params: Promise<{ id: string }>;
}

type ResearchStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface ResearchData {
  id: string;
  status: ResearchStatus;
  personName: string;
  linkedinUrl: string;
  report?: string;
  sources?: Array<{ url: string; summary: string }>;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ResearchPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();

  const [research, setResearch] = useState<ResearchData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch initial research data
    const fetchResearch = async () => {
      try {
        const response = await fetch(`/api/research/${id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load research');
        }

        setResearch(data);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load research');
        setIsLoading(false);
      }
    };

    fetchResearch();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Loading research...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !research) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                Error Loading Research
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {error || 'Research not found'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{research.personName}</h1>
              <a
                href={research.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                LinkedIn Profile
                <Globe className="h-3 w-3" />
              </a>
            </div>
            <StatusBadge status={research.status} />
          </div>
        </div>

        {/* Content based on status */}
        {research.status === 'pending' || research.status === 'processing' ? (
          <ResearchProgress researchId={id} initialData={research} />
        ) : research.status === 'completed' && research.report ? (
          <ResearchReport
            report={research.report}
            sources={research.sources || []}
            personName={research.personName}
          />
        ) : research.status === 'failed' ? (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                Research Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {research.errorMessage || 'An unknown error occurred during research'}
              </p>
              <Button
                onClick={() => window.location.reload()}
                className="mt-4"
                variant="outline"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Metadata */}
        <div className="mt-8 text-xs text-muted-foreground text-center space-x-4">
          <span>Created: {new Date(research.createdAt).toLocaleString()}</span>
          <span>Updated: {new Date(research.updatedAt).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ResearchStatus }) {
  const config = {
    pending: {
      label: 'Pending',
      icon: Clock,
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    },
    processing: {
      label: 'Processing',
      icon: Loader2,
      className: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    completed: {
      label: 'Completed',
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-800 border-green-200',
    },
    failed: {
      label: 'Failed',
      icon: XCircle,
      className: 'bg-red-100 text-red-800 border-red-200',
    },
  }[status];

  const Icon = config.icon;

  return (
    <Badge variant="outline" className={config.className}>
      <Icon className={`mr-1 h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  );
}
