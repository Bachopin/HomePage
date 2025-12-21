'use client';

import Link from 'next/link';

interface NavigationProps {
  activeSection: string;
  categories?: string[];
}

export default function Navigation({ activeSection, categories = ['All', 'Work', 'Lab', 'Life'] }: NavigationProps) {
  return (
    <header className="fixed top-8 left-0 right-0 z-50 px-16 py-6">
      <div className="relative flex items-center justify-center">
        {/* Logo - Absolutely positioned to the left */}
        <Link href="/" className="absolute left-16 text-xl font-medium text-black dark:text-white">
          Your Name
        </Link>
        
        {/* Nav Links - Centered, Dynamic Categories */}
        <nav className="flex gap-8">
          {categories.map((category) => {
            const isActive = activeSection.toLowerCase() === category.toLowerCase();
            return (
              <Link
                key={category}
                href={`#${category.toLowerCase()}`}
                className={`text-sm transition-colors ${
                  isActive
                    ? 'text-black dark:text-white'
                    : 'text-neutral-400 dark:text-neutral-600'
                }`}
              >
                {category}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
