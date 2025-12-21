'use client';

import Link from 'next/link';

interface NavigationProps {
  activeSection: 'work' | 'lab' | 'life';
}

export default function Navigation({ activeSection }: NavigationProps) {
  const links = [
    { href: '#work', label: 'Work', id: 'work' as const },
    { href: '#lab', label: 'Lab', id: 'lab' as const },
    { href: '#life', label: 'Life', id: 'life' as const },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-12 py-6">
      <div className="relative flex items-center justify-center">
        {/* Logo - Absolutely positioned to the left */}
        <Link href="/" className="absolute left-12 text-xl font-medium text-black dark:text-white">
          Your Name
        </Link>
        
        {/* Nav Links - Centered */}
        <nav className="flex gap-8">
          {links.map((link) => {
            const isActive = activeSection === link.id;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm transition-colors ${
                  isActive
                    ? 'text-black dark:text-white'
                    : 'text-neutral-400 dark:text-neutral-600'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
