'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { CachedProfile } from '@/types/linkedin';
import {
  Building2,
  GraduationCap,
  Languages,
  Users,
  MapPin,
  Briefcase,
  BookOpen,
  Clock,
} from 'lucide-react';

interface ProfileDetailsProps {
  profile: CachedProfile;
}

function getInitials(profile: CachedProfile): string {
  const first = profile.firstName?.[0] ?? '';
  const last = profile.lastName?.[0] ?? '';
  const fallback = profile.fullName?.[0] ?? '';
  return (first + last || fallback).toUpperCase();
}

function proxiedImageUrl(url?: string | null, defaultAvatar?: boolean) {
  if (!url || defaultAvatar) {
    return undefined;
  }
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

export default function ProfileDetails({ profile }: ProfileDetailsProps) {
  const avatarUrl = proxiedImageUrl(profile.profilePicUrl, profile.defaultAvatar);
  const initials = getInitials(profile);

  return (
    <div className="space-y-6 text-sm text-muted-foreground">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar className="h-16 w-16 flex-shrink-0">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={profile.fullName} />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <div>
            <h3 className="text-base font-semibold text-foreground">{profile.fullName}</h3>
            {profile.headline && <p className="text-sm">{profile.headline}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground/80">
            {profile.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {profile.location}
              </span>
            )}
            {profile.currentCompany && (
              <span className="inline-flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                {profile.currentCompany}
              </span>
            )}
            <Badge variant="outline" className="border-dashed px-2 py-0 text-[11px]">
              {profile.source.toUpperCase()}
            </Badge>
            {profile.cachedAt && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Cached {new Date(profile.cachedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {profile.about && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-foreground">
            <BookOpen className="h-4 w-4" />
            <h4 className="text-sm font-semibold">About</h4>
          </div>
          <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{profile.about}</p>
        </div>
      )}

      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        {(profile.connections !== undefined || profile.followers !== undefined) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-foreground">
              <Users className="h-4 w-4" />
              <h4 className="text-sm font-semibold">Network</h4>
            </div>
            <div className="space-y-1 text-muted-foreground">
              {profile.connections !== undefined && (
                <p>{profile.connections.toLocaleString()} connections</p>
              )}
              {profile.followers !== undefined && (
                <p>{profile.followers.toLocaleString()} followers</p>
              )}
            </div>
          </div>
        )}

        {profile.currentCompany && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-foreground">
              <Building2 className="h-4 w-4" />
              <h4 className="text-sm font-semibold">Current Company</h4>
            </div>
            <p>{profile.currentCompany}</p>
          </div>
        )}
      </div>

      {profile.experience && profile.experience.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-foreground">
            <Briefcase className="h-4 w-4" />
            <h4 className="text-sm font-semibold">Experience</h4>
          </div>
          <div className="space-y-3">
            {profile.experience.slice(0, 3).map((exp, idx) => (
              <div key={`${exp.company}-${idx}`} className="space-y-1">
                <p className="font-medium text-foreground">{exp.title}</p>
                <p>{exp.company}</p>
                {exp.duration && <p className="text-xs uppercase text-muted-foreground">{exp.duration}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {profile.education && profile.education.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-foreground">
            <GraduationCap className="h-4 w-4" />
            <h4 className="text-sm font-semibold">Education</h4>
          </div>
          <div className="space-y-3">
            {profile.education.slice(0, 3).map((edu, idx) => (
              <div key={`${edu.title}-${idx}`} className="space-y-1">
                {edu.title && <p className="font-medium text-foreground">{edu.title}</p>}
                {edu.description && (
                  <p className="text-xs text-muted-foreground">{edu.description}</p>
                )}
                {(edu.start_year || edu.end_year) && (
                  <p className="text-xs uppercase text-muted-foreground">
                    {edu.start_year} - {edu.end_year ?? 'Present'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {profile.languages && profile.languages.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-foreground">
            <Languages className="h-4 w-4" />
            <h4 className="text-sm font-semibold">Languages</h4>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {profile.languages.map((language, idx) => (
              <Badge key={`${language.title}-${idx}`} variant="outline" className="text-xs">
                {language.title}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
