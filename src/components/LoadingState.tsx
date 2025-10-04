import { Skeleton } from '@/components/ui/skeleton';

export function LoadingState() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-background/80 via-background/60 to-background/80 backdrop-blur-xl">
          <div className="p-6 pb-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-16 w-16 rounded-full bg-white/20" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32 bg-white/20" />
                <Skeleton className="h-3 w-full bg-white/20" />
                <Skeleton className="h-3 w-3/4 bg-white/20" />
              </div>
            </div>
          </div>
          <div className="px-6 pb-6 space-y-3">
            <Skeleton className="h-4 w-40 bg-white/20" />
            <Skeleton className="h-4 w-36 bg-white/20" />
            <Skeleton className="h-4 w-32 bg-white/20" />
          </div>
        </div>
      ))}
    </div>
  );
}
