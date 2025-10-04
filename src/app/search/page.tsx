'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { PersonCard } from '@/components/PersonCard';
import { LoadingState } from '@/components/LoadingState';
import { Loader2, Clock } from 'lucide-react';
import type { ProfileData } from '@/types/linkedin';

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';

  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = (newQuery: string) => {
    router.push(`/search?q=${encodeURIComponent(newQuery)}`);
  };

  useEffect(() => {
    if (!query) return;

    const fetchProfiles = async () => {
      setIsLoading(true);
      setError(null);
      setProfiles([]); // Clear on new search

      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Search failed');
        }

        setProfiles(data.profiles || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfiles();
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
            {/* Loading Info Card */}
            <div className="mb-6 relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-background/80 via-background/60 to-background/80 backdrop-blur-xl p-6">
              <div className="flex items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-foreground mb-1">Searching for profiles...</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    According to the number of people searched, this operation might take a few minutes
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

        {!isLoading && !error && profiles.length === 0 && query && (
          <div className="rounded-lg border border-muted bg-muted/30 p-12 text-center">
            <p className="text-lg text-muted-foreground">
              No profiles found for &quot;{query}&quot;
            </p>
          </div>
        )}

        {!isLoading && !error && profiles.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
              <PersonCard key={profile.linkedinId} profile={profile} />
            ))}
          </div>
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
