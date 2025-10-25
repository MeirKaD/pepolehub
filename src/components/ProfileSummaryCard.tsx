'use client';

import { useCallback, useState } from 'react';
import type { CachedProfile, ProfileSummary } from '@/types/linkedin';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import ProfileDetails from '@/components/ProfileDetails';

interface ProfileSummaryCardProps {
  summary: ProfileSummary;
}

export default function ProfileSummaryCard({ summary }: ProfileSummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullProfile, setFullProfile] = useState<CachedProfile | null>(null);

  const handleExpand = useCallback(async () => {
    if (!isExpanded && !fullProfile) {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/profile/${encodeURIComponent(summary.linkedinId)}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load profile');
        }

        setFullProfile(data.profile as CachedProfile);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    }

    setIsExpanded((prev) => !prev);
  }, [fullProfile, isExpanded, summary.linkedinId]);

  const displayTitle = summary.name || summary.title;

  return (
    <Card className="transition-shadow hover:shadow-lg">
      <CardHeader>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold leading-tight line-clamp-2 text-foreground">
            {displayTitle}
          </h3>
          {summary.headline && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {summary.headline}
            </p>
          )}
          {summary.location && (
            <Badge variant="secondary" className="w-fit">
              {summary.location}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 text-sm text-muted-foreground">
        {summary.snippet && (
          <p className="line-clamp-4 leading-relaxed">{summary.snippet}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={handleExpand} disabled={isLoading}>
            {isLoading ? (
              'Loading...'
            ) : isExpanded ? (
              <>
                <ChevronUp className="mr-1 h-4 w-4" />
                Hide details
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 h-4 w-4" />
                View details
              </>
            )}
          </Button>

          <Button size="sm" variant="outline" asChild>
            <a
              href={summary.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open LinkedIn
            </a>
          </Button>
        </div>

        {isExpanded && (
          <div className="border-t pt-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!error && !fullProfile && isLoading && (
              <p className="text-sm text-muted-foreground">Loading profile details...</p>
            )}
            {fullProfile && <ProfileDetails profile={fullProfile} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
