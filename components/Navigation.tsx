'use client';

import Link from 'next/link';

export default function Navigation() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-8 py-6 flex justify-between items-center bg-stone-100/80 dark:bg-neutral-700/80 backdrop-blur-sm">
      <Link href="/" className="text-xl font-medium text-gray-900 dark:text-gray-100">
        Your Name
      </Link>
      <nav className="flex gap-8">
        <Link href="#work" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
          Work
        </Link>
        <Link href="#lab" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
          Lab
        </Link>
        <Link href="#life" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
          Life
        </Link>
      </nav>
    </header>
  );
}
