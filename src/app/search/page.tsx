'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Clock } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { LoadingState } from '@/components/LoadingState';
import ProfileSummaryCard from '@/components/ProfileSummaryCard';
import type { ProfileSummary } from '@/types/linkedin';

interface SearchMetadata {
  cached: boolean;
  timestamp: number | null;
}

const MIN_QUERY_LENGTH = 2;

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q')?.trim() ?? '';

  const [summaries, setSummaries] = useState<ProfileSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<SearchMetadata>({
    cached: false,
    timestamp: null,
  });

  const handleSearch = (newQuery: string) => {
    router.push(`/search?q=${encodeURIComponent(newQuery)}`);
  };

  useEffect(() => {
    if (!query) {
      setSummaries([]);
      setMetadata({ cached: false, timestamp: null });
      setError(null);
      return;
    }

    if (query.length < MIN_QUERY_LENGTH) {
      setSummaries([]);
      setMetadata({ cached: false, timestamp: null });
      setError('Please enter at least 2 characters');
      return;
    }

    const controller = new AbortController();

    const fetchSummaries = async () => {
      setIsLoading(true);
      setError(null);
      setSummaries([]);

      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Search failed');
        }

        setSummaries((data.results as ProfileSummary[]) || []);
        setMetadata({
          cached: Boolean(data.cached),
          timestamp: typeof data.timestamp === 'number' ? data.timestamp : null,
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'An error occurred');
        setSummaries([]);
        setMetadata({ cached: false, timestamp: null });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummaries();

    return () => controller.abort();
  }, [query]);

  return (
    <div className="min-h-screen px-4 py-8 pt-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4">
          <h1 className="text-3xl font-bold">Search Results</h1>
          <SearchBar onSearch={handleSearch} isLoading={isLoading} />
        </div>

        {isLoading && (
          <>
            <div className="relative mb-6 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-background/80 via-background/60 to-background/80 p-6 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <div className="flex-1">
                  <h3 className="mb-1 text-sm font-medium text-foreground">
                    Searching for profiles...
                  </h3>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Depending on the scope of the query, this might take a moment.
                  </p>
                </div>
              </div>
            </div>
            <LoadingState />
          </>
        )}

        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        {!isLoading && !error && summaries.length === 0 && query && (
          <div className="rounded-lg border border-muted bg-muted/30 p-12 text-center">
            <p className="text-lg text-muted-foreground">
              No profiles found for &quot;{query}&quot;
            </p>
          </div>
        )}

        {!isLoading && summaries.length > 0 && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                Showing {summaries.length}{' '}
                {summaries.length === 1 ? 'profile summary' : 'profile summaries'}
              </span>
              <span>
                {metadata.cached ? 'Served from cache' : 'Fresh search'}{' '}
                {metadata.timestamp
                  ? `• Updated ${new Date(metadata.timestamp).toLocaleString()}`
                  : null}
              </span>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {summaries.map((summary) => (
                <ProfileSummaryCard key={summary.linkedinId} summary={summary} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SearchContent />
    </Suspense>
  );
}
