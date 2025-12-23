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
    images: [
      {
        url: `${METADATA.siteUrl}${METADATA.ogImage}`,
        width: 1200,
        height: 630,
        alt: METADATA.title,
      },
    ],
  },
  twitter: {
    card: METADATA.twitter.card as 'summary_large_image',
    title: METADATA.title,
    description: METADATA.description,
    images: [`${METADATA.siteUrl}${METADATA.ogImage}`],
  },
  alternates: {
    canonical: METADATA.siteUrl,
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
              请检查 Notion 数据库配置，确保有标记为 &ldquo;Live&rdquo; 状态的项目。
            </p>
          </div>
        </div>
      );
    }

    // 4. Render
    return (
      <ErrorBoundary>
        {/* JSON-LD 结构化数据 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Person',
              name: METADATA.author,
              url: METADATA.siteUrl,
              description: METADATA.description,
              jobTitle: 'Developer & Product Designer',
              knowsAbout: [
                'Web Development',
                'Product Design',
                'React',
                'Next.js',
                'TypeScript',
                'JavaScript',
                'UI/UX Design',
              ],
              sameAs: [METADATA.siteUrl],
            }),
          }}
        />
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
            请检查 Notion 数据库配置，确保有标记为 &ldquo;Live&rdquo; 状态的项目。
          </p>
        </div>
      </div>
    );
  }
}
