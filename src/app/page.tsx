import type { Metadata } from 'next';
import { getDatabaseItems, getCategoryOrder } from '@/lib/notion';
import { processHomePageItems } from '@/lib/transformers';
import { METADATA } from '@/lib/config';
import { HomeClient } from '@/components/features/home';
import { ErrorBoundary } from '@/components/ui';

// ============================================================================
// SEO Metadata
// ============================================================================

export const metadata: Metadata = {
  title: METADATA.title,
  description: METADATA.description,
  keywords: METADATA.keywords,
  authors: [{ name: METADATA.author }],
  openGraph: {
    title: METADATA.title,
    description: METADATA.description,
    type: METADATA.openGraph.type as 'website',
    locale: METADATA.openGraph.locale,
    siteName: METADATA.openGraph.siteName,
    url: METADATA.siteUrl,
  },
  twitter: {
    card: METADATA.twitter.card as 'summary_large_image',
    title: METADATA.title,
    description: METADATA.description,
  },
  metadataBase: new URL(METADATA.siteUrl),
};

// ============================================================================
// ISR Configuration
// ============================================================================

// Incremental Static Regeneration - revalidate every 36 seconds
export const revalidate = 36;

// ============================================================================
// Page Component
// ============================================================================

export default async function Home() {
  try {
    // 1. Fetch raw data
    const [rawData, categoryOrder] = await Promise.all([
      getDatabaseItems(),
      getCategoryOrder(),
    ]);

    console.log('[Home] Retrieved categoryOrder from Notion:', categoryOrder);

    // 2. Transform data (filtering, sorting, sandwich order)
    const { items, categories } = processHomePageItems({ rawData, categoryOrder });

    // 3. Handle empty state
    if (items.length === 0) {
      return (
        <div className="bg-stone-100 dark:bg-neutral-700 min-h-screen flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold mb-4 text-neutral-900 dark:text-neutral-100">
              暂无内容
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mb-2">
              当前没有可显示的内容。
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-500">
              请检查 Notion 数据库配置，确保有标记为 "Live" 状态的项目。
            </p>
          </div>
        </div>
      );
    }

    // 4. Render
    return (
      <ErrorBoundary>
        <HomeClient items={items} categories={categories} />
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('Error fetching Notion data:', error);

    return (
      <div className="bg-stone-100 dark:bg-neutral-700 min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4 text-neutral-900 dark:text-neutral-100">
            暂无内容
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-2">
            当前没有可显示的内容。
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-500">
            请检查 Notion 数据库配置，确保有标记为 "Live" 状态的项目。
          </p>
        </div>
      </div>
    );
  }
}
