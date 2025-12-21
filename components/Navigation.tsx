'use client';

import Link from 'next/link';

interface NavigationProps {
  activeSection: 'Work' | 'Lab' | 'Life';
}

export default function Navigation({ activeSection }: NavigationProps) {
  const links = [
    { href: '#work', label: 'Work' },
    { href: '#lab', label: 'Lab' },
    { href: '#life', label: 'Life' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-8 py-6 flex items-center">
      {/* Left: Name */}
      <Link href="/" className="text-xl font-medium text-gray-900 dark:text-gray-100">
        Your Name
      </Link>
      
      {/* Center/Right: Menu Links */}
      <nav className="flex gap-8 ml-auto">
        {links.map((link) => {
          const isActive = activeSection === link.label;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                isActive
                  ? 'text-gray-900 dark:text-white'
                  : 'text-neutral-500 dark:text-neutral-500'
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
