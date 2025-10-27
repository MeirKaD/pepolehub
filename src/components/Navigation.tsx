'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, History } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    name: 'Home',
    href: '/',
    icon: Home,
  },
  {
    name: 'Previous Searches',
    href: '/previous',
    icon: History,
  },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-7xl">
        <div className="relative flex h-20 items-center justify-between rounded-2xl border border-white/20 bg-white/10 px-4 sm:px-6 lg:px-8 shadow-[0_12px_35px_-20px_rgba(15,23,42,0.75)] backdrop-blur-2xl backdrop-saturate-150">
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-white/25 via-white/10 to-white/25 opacity-80" />

          {/* Logo */}
          <div className="relative flex items-center gap-6 -ml-2">
            <Link
              href="/"
              className="pointer-events-auto hover:opacity-80 transition-opacity flex items-center"
            >
              <Image
                src="/logo.png"
                alt="PeopleHub"
                width={210}
                height={60}
                className="h-15 w-auto object-contain"
                priority
              />
            </Link>

            {/*  Bright Data */}
            <a
              href="https://brightdata.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors pointer-events-auto"
            >
              <span className="hidden md:inline">Powered by</span>
              <Image
                src="https://idsai.net.technion.ac.il/files/2022/01/Logo-600.png"
                alt="Bright Data"
                width={80}
                height={16}
                className="opacity-70 hover:opacity-100 transition-opacity"
              />
            </a>
          </div>

          {/* Navigation Items */}
          <div className="relative flex items-center gap-1 pointer-events-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 pointer-events-auto',
                    'hover:bg-white/20',
                    isActive
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {/* Active indicator - glass pill */}
                  {isActive && (
                    <div className="absolute inset-0 rounded-lg border border-white/40 bg-white/20 backdrop-blur-xl" />
                  )}

                  <Icon className="h-4 w-4 relative z-10" />
                  <span className="relative z-10 hidden sm:inline">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
