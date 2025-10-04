'use client';

import { useState } from 'react';
import { MapPin, Briefcase, Users, ExternalLink, ChevronDown, GraduationCap, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import type { ProfileData } from '@/types/linkedin';

interface PersonCardProps {
  profile: ProfileData;
}

export function PersonCard({ profile }: PersonCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const initials = `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.toUpperCase();

  // Proxy LinkedIn images to avoid ad blocker issues
  const avatarUrl = profile.defaultAvatar || !profile.profilePicUrl
    ? undefined
    : `/api/proxy-image?url=${encodeURIComponent(profile.profilePicUrl)}`;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on the expand button
    if ((e.target as HTMLElement).closest('[data-collapsible-trigger]')) {
      return;
    }
    if (profile.linkedinUrl) {
      window.open(profile.linkedinUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div onClick={handleCardClick} className="cursor-pointer">
          <CardHeader className="pb-4">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 flex-shrink-0">
                {avatarUrl && (
                  <AvatarImage
                    src={avatarUrl}
                    alt={profile.fullName}
                  />
                )}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-semibold leading-none truncate">{profile.fullName}</h3>
                    <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  </div>
                  <CollapsibleTrigger data-collapsible-trigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="flex-shrink-0 p-1 hover:bg-accent rounded transition-colors"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </CollapsibleTrigger>
                </div>
                {profile.headline && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {profile.headline}
                  </p>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {profile.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{profile.location}</span>
              </div>
            )}
            {profile.currentCompany && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Briefcase className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{profile.currentCompany}</span>
              </div>
            )}
            {profile.connections !== undefined && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 flex-shrink-0" />
                <span>{profile.connections.toLocaleString()} connections</span>
              </div>
            )}
            {profile.languages && profile.languages.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {profile.languages.slice(0, 3).map((lang, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {lang.title}
                  </Badge>
                ))}
                {profile.languages.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{profile.languages.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </div>

        <CollapsibleContent>
          <Separator />
          <CardContent className="pt-4 space-y-4">
            {/* About Section */}
            {profile.about && (
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  About
                </h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {profile.about}
                </p>
              </div>
            )}

            {/* Experience Section */}
            {profile.experience && profile.experience.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Experience
                </h4>
                <div className="space-y-3">
                  {profile.experience.slice(0, 3).map((exp, idx) => (
                    <div key={idx} className="text-sm space-y-1">
                      <p className="font-medium">{exp.title}</p>
                      <p className="text-muted-foreground">{exp.company}</p>
                      {exp.duration && (
                        <p className="text-xs text-muted-foreground">{exp.duration}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education Section */}
            {profile.education && profile.education.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Education
                </h4>
                <div className="space-y-3">
                  {profile.education.slice(0, 2).map((edu, idx) => (
                    <div key={idx} className="text-sm space-y-1">
                      {edu.title && <p className="font-medium">{edu.title}</p>}
                      {edu.start_year && edu.end_year && (
                        <p className="text-xs text-muted-foreground">
                          {edu.start_year} - {edu.end_year}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Languages */}
            {profile.languages && profile.languages.length > 3 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">All Languages</h4>
                <div className="flex flex-wrap gap-1">
                  {profile.languages.map((lang, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {lang.title}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
