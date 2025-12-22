import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="h-[100dvh] w-full bg-stone-100 dark:bg-neutral-700 flex items-center justify-center">
      <div className="text-center px-8">
        {/* 404 Number */}
        <h1 className="text-[120px] md:text-[180px] font-bold leading-none text-neutral-200 dark:text-neutral-600 select-none">
          404
        </h1>
        
        {/* Message */}
        <div className="-mt-8 md:-mt-12">
          <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
            Page Not Found
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-8 max-w-md mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          
          {/* Back Home Button */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
