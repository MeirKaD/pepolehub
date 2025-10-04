'use client';

import { useEffect, useState, useCallback } from 'react';
import { PersonCard } from '@/components/PersonCard';
import { LoadingState } from '@/components/LoadingState';
import { Button } from '@/components/ui/button';
import { History, RefreshCw } from 'lucide-react';
import type { ProfileData } from '@/types/linkedin';

interface ProfileWithTimestamp extends ProfileData {
  updatedAt: string;
}

export default function PreviousSearchesPage() {
  const [profiles, setProfiles] = useState<ProfileWithTimestamp[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Fetch initial profiles
  const fetchProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/profiles/recent?limit=50');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch profiles');
      }

      setProfiles(data.profiles || []);
      setTotalCount(parseInt(response.headers.get('X-Total-Count') || '0', 10));
      setHasMore(data.profiles.length >= 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load more (older profiles)
  const loadMore = useCallback(async () => {
    if (!profiles.length || isLoadingMore) return;

    setIsLoadingMore(true);
    setError(null);

    try {
      const oldestTimestamp = profiles[profiles.length - 1].updatedAt;
      const response = await fetch(
        `/api/profiles/recent?limit=50&before=${encodeURIComponent(oldestTimestamp)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load more profiles');
      }

      if (data.profiles.length > 0) {
        setProfiles((prev) => [...prev, ...data.profiles]);
        setHasMore(data.profiles.length >= 50);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingMore(false);
    }
  }, [profiles, isLoadingMore]);

  // Auto-refresh (check for newer profiles)
  const refreshNew = useCallback(async () => {
    if (!profiles.length || isRefreshing) return;

    setIsRefreshing(true);

    try {
      const newestTimestamp = profiles[0].updatedAt;
      const response = await fetch(
        `/api/profiles/recent?limit=50&after=${encodeURIComponent(newestTimestamp)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh profiles');
      }

      if (data.profiles.length > 0) {
        setProfiles((prev) => [...data.profiles, ...prev]);
        setTotalCount(parseInt(response.headers.get('X-Total-Count') || '0', 10));
      }
    } catch (err) {
      console.error('Auto-refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [profiles, isRefreshing]);

  // Initial load
  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!profiles.length) return;

    const interval = setInterval(() => {
      refreshNew();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [profiles.length, refreshNew]);

  return (
    <div className="min-h-screen px-4 py-8 pt-24">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <History className="h-8 w-8" />
              Previous Searches
            </h1>
            <p className="mt-2 text-muted-foreground">
              {totalCount > 0 ? `${totalCount} cached profiles` : 'No cached profiles yet'}
            </p>
          </div>
          {profiles.length > 0 && (
            <Button
              onClick={refreshNew}
              disabled={isRefreshing}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>

        {/* Loading State */}
        {isLoading && <LoadingState />}

        {/* Error State */}
        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && profiles.length === 0 && (
          <div className="rounded-lg border border-muted bg-muted/30 p-12 text-center">
            <History className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Previous Searches</h3>
            <p className="text-muted-foreground">
              Search for profiles to see them cached here
            </p>
          </div>
        )}

        {/* Profiles Grid */}
        {!isLoading && !error && profiles.length > 0 && (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {profiles.map((profile) => (
                <PersonCard key={profile.linkedinId} profile={profile} />
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <Button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  variant="outline"
                  size="lg"
                  className="gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading more...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}

            {/* End of list indicator */}
            {!hasMore && profiles.length > 0 && (
              <p className="mt-8 text-center text-sm text-muted-foreground">
                No more profiles to load
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
