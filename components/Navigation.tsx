'use client';

import Link from 'next/link';

interface NavigationProps {
  activeSection: string;
  categories?: string[];
  onNavClick?: (category: string) => void;
}

export default function Navigation({ 
  activeSection, 
  categories = ['All', 'Work', 'Lab', 'Life'],
  onNavClick 
}: NavigationProps) {
  const handleClick = (category: string, e: React.MouseEvent) => {
    if (onNavClick) {
      e.preventDefault();
      onNavClick(category);
    }
  };

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
              <button
                key={category}
                onClick={(e) => handleClick(category, e)}
                className={`text-sm transition-colors cursor-pointer ${
                  isActive
                    ? 'text-black dark:text-white'
                    : 'text-neutral-400 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-400'
                }`}
              >
                {category}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
