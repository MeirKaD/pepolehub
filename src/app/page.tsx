"use client";

import { useRouter } from "next/navigation";
import { SearchBar } from "@/components/SearchBar";
import { AuroraBackground } from "@/components/ui/shadcn-io/aurora-background";

export default function Home() {
  const router = useRouter();

  const handleSearch = (query: string) => {
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <AuroraBackground>
      <div className="mx-auto max-w-4xl text-center px-4">
        <div className="floating">
          <h1 className="relative text-2xl font-light tracking-tight sm:text-6xl md:text-7xl lg:text-8xl letter-spacing-tight text-shadow-deep">
            <span className="animated-gradient inline-block">
              <i>Find</i> <br/> Professionals
            </span>
          </h1>
        </div>

        <p className="mt-8 text-lg ">
          Search for professionals by role, location, and more. Powered by AI and real-time data.
        </p>

        <div className="mt-10 flex justify-center">
          <SearchBar onSearch={handleSearch} />
        </div>

        <div className="mt-8 mx-auto max-w-2xl">
          <div className="backdrop-blur-md backdrop-opacity-80 bg-white/5 border border-white/10 rounded-lg shadow-md p-6">
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
    </AuroraBackground>
  );
}
