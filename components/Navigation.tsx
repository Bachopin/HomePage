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
    <header className="fixed top-0 left-0 right-0 z-50 px-8 py-6 flex items-center">
      {/* Left: Name */}
      <Link href="/" className="text-xl font-medium text-black dark:text-white">
        Your Name
      </Link>
      
      {/* Right: Menu Links */}
      <nav className="flex gap-8 ml-auto">
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
    </header>
  );
}
