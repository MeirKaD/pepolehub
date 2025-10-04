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
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 pointer-events-none">
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/60 to-background/80 backdrop-blur-xl pointer-events-none" />

      <div className="relative w-full px-4 sm:px-6 lg:px-8 pointer-events-auto">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center gap-6 -ml-2">
            <Link
              href="/"
              className="pointer-events-auto hover:opacity-80 transition-opacity flex items-center"
            >
              <Image
                src="/logo.png"
                alt="PeopleHub"
                width={280}
                height={60}
                className="h-30 w-auto object-contain"
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
          <div className="flex items-center gap-1 pointer-events-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 pointer-events-auto',
                    'hover:bg-white/10',
                    isActive
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {/* Active indicator - glass pill */}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg border border-blue-500/30 backdrop-blur-sm" />
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
