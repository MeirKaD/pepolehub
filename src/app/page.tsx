'use client';
import { useRouter } from 'next/navigation';
import { SearchBar } from '@/components/SearchBar';
import { FloatingOrbs } from '@/components/FloatingOrbs';

export default function Home() {
  const router = useRouter();
  
  const handleSearch = (query: string) => {
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };
  
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden pt-16">
      <style>{`
        @keyframes gradient-shift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        
        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        .animated-gradient {
          background: linear-gradient(
            120deg,
            #0EA5E9,
            #3B82F6,
            #2563EB,
            #4F46E5,
            #6366F1,
            #0EA5E9
          );
          background-size: 300% 300%;
          animation: gradient-shift 30s ease infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          position: relative;
        }
        
        .shimmer-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(152, 153, 228, 0.8) 50%,
            transparent 100%
          );
          background-size: 1000px 100%;
          animation: shimmer 60s infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          pointer-events: none;
        }
        
        .text-shadow-deep {
          filter: drop-shadow(0 4px 5px rgba(163, 162, 243, 0.3))
                  drop-shadow(0 0 40px rgba(156, 39, 176, 0.2));
        }
        
        .floating {
          animation: float 6s ease-in-out infinite;
        }
        
        .letter-spacing-tight {
          letter-spacing: -0.02em;
        }
      `}</style>
      
      <FloatingOrbs />
      
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <div className="floating">
            <h1 className="relative text-2xl font-light tracking-tight sm:text-6xl md:text-7xl lg:text-8xl letter-spacing-tight text-shadow-deep">
              <span className="animated-gradient inline-block">
                <i>Find</i> LinkedIn Professionals
              </span>
              <span className="shimmer-overlay">
                <i>Find</i> LinkedIn Professionals
              </span>
            </h1>
          </div>
          
          <p className="mt-8 text-lg text-muted-foreground">
            Search for professionals by role, location, and more. Powered by AI and real-time data.
          </p>
          
          <div className="mt-10 flex justify-center">
            <SearchBar onSearch={handleSearch} />
          </div>

          {/* Tips Section */}
          <div className="mt-8 mx-auto max-w-2xl">
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-background/80 via-background/60 to-background/80 backdrop-blur-xl p-6">
              <div className="relative z-10">
                <h3 className="text-sm font-medium text-foreground mb-3">💡 Search Tips</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span><strong>Default:</strong> If you don&apos;t specify a number, we&apos;ll search for 10 people</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span><strong>Best practice:</strong> Include a city for better results (e.g., &quot;2 Software Engineers in Miami&quot;)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span><strong>Add expertise:</strong> Mention specific skills or technologies (e.g., &quot;Java developers in Austin&quot;)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}