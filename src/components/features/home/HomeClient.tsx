'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { Navigation } from '@/components/layout';
import { MasonryCard } from '@/components/features/home';
import type { NotionItem } from '@/lib/notion';
import { useMasonryLayout, useScrollSpy } from '@/hooks';
import { ANIMATION, DEFAULTS } from '@/lib/config';

// ============================================================================
// Types
// ============================================================================

interface HomeClientProps {
  items: NotionItem[];
  categories?: string[];
}

// ============================================================================
// Scroll Phase Constants
// ============================================================================

/**
 * 滚动阶段边界
 * 
 * Phase 1 (0 - 0.05): 开头 - Intro 缩小，其它内容淡入
 * Phase 2 (0.05 - 0.90): 水平滚动
 * Phase 3 (0.90 - 1.0): 结尾 - Outro 放大，其它内容淡出
 */
const PHASES = {
  introEnd: 0.05,
  outroStart: 0.90,
} as const;

// ============================================================================
// Custom Hooks
// ============================================================================

function useWindowSize() {
  const [windowWidth, setWindowWidth] = useState<number>(DEFAULTS.windowWidth);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    const timeoutId = setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return { windowWidth };
}

function useSortedItems(items: NotionItem[], categories: string[]) {
  return useMemo(() => {
    if (!items || items.length === 0) return [];

    const categoryIndexMap = new Map<string, number>();
    categories.forEach((cat, idx) => {
      if (cat !== 'All') {
        categoryIndexMap.set(cat, idx);
      }
    });

    return [...items].sort((a, b) => {
      if (a.type === 'intro' && b.type !== 'intro') return -1;
      if (a.type !== 'intro' && b.type === 'intro') return 1;
      if (a.type === 'outro' && b.type !== 'outro') return 1;
      if (a.type !== 'outro' && b.type === 'outro') return -1;

      if (a.type === 'project' && b.type === 'project') {
        const catA = a.category || '';
        const catB = b.category || '';
        const idxA = categoryIndexMap.get(catA) ?? Infinity;
        const idxB = categoryIndexMap.get(catB) ?? Infinity;
        if (idxA !== idxB) return idxA - idxB;

        const sortA = a.sort ?? Infinity;
        const sortB = b.sort ?? Infinity;
        if (sortA !== sortB) return sortA - sortB;

        const yearA = parseInt(a.year || '0', 10) || 0;
        const yearB = parseInt(b.year || '0', 10) || 0;
        return yearB - yearA;
      }

      return 0;
    });
  }, [items, categories]);
}

// ============================================================================
// Main Component
// ============================================================================

export default function HomeClient({
  items,
  categories = [...DEFAULTS.categories],
}: HomeClientProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);

  const sortedItems = useSortedItems(items, categories);
  const { windowWidth } = useWindowSize();

  const { cardPositions, categoryTargetInfo, containerWidth, gridHeight } = useMasonryLayout({
    items: sortedItems,
    windowWidth,
    categories,
  });

  const { scrollYProgress } = useScroll({
    container: scrollContainerRef,
  });

  const maxScroll = containerWidth > windowWidth ? -(containerWidth - windowWidth) : 0;

  // =========================================================================
  // Phase 1: Intro 缩放（开头：大 → 小）
  // =========================================================================
  const introScale = useTransform(
    scrollYProgress,
    [0, PHASES.introEnd],
    [ANIMATION.imageScale, 1]
  );
  const springIntroScale = useSpring(introScale, ANIMATION.scaleSpring);

  // =========================================================================
  // Phase 2: 水平位移
  // =========================================================================
  const x = useTransform(scrollYProgress, (p): number => {
    if (p < PHASES.introEnd) return 0;
    if (p < PHASES.outroStart) {
      const progress = (p - PHASES.introEnd) / (PHASES.outroStart - PHASES.introEnd);
      return progress * maxScroll;
    }
    return maxScroll;
  });
  const springX = useSpring(x, ANIMATION.spring);

  // =========================================================================
  // Phase 3: Outro 缩放（结尾：小 → 大）
  // =========================================================================
  const outroScale = useTransform(scrollYProgress, (p): number => {
    if (p < PHASES.outroStart) return 1;
    const progress = (p - PHASES.outroStart) / (1 - PHASES.outroStart);
    return 1 + progress * (ANIMATION.imageScale - 1);
  });
  const springOutroScale = useSpring(outroScale, ANIMATION.scaleSpring);

  // =========================================================================
  // 内容透明度：开头淡入，结尾淡出（Intro/Outro 除外）
  // =========================================================================
  const contentOpacity = useTransform(scrollYProgress, (p): number => {
    // Phase 1: 淡入
    if (p < PHASES.introEnd) {
      return p / PHASES.introEnd;
    }
    // Phase 2: 完全可见
    if (p < PHASES.outroStart) {
      return 1;
    }
    // Phase 3: 淡出
    return 1 - (p - PHASES.outroStart) / (1 - PHASES.outroStart);
  });
  const springContentOpacity = useSpring(contentOpacity, { stiffness: 300, damping: 30 });

  // =========================================================================
  // Navigation
  // =========================================================================
  const { activeSection, scrollToCategory } = useScrollSpy({
    scrollX: springX,
    categoryTargetInfo,
    categories,
    windowWidth,
    maxScroll,
    scrollContainerRef,
  });

  // =========================================================================
  // Render
  // =========================================================================
  if (!sortedItems || sortedItems.length === 0) {
    return (
      <main className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-stone-100 dark:bg-neutral-700 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No content available</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Please check your Notion database configuration.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      ref={scrollContainerRef}
      className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-stone-100 dark:bg-neutral-700 no-scrollbar"
    >
      <Navigation
        activeSection={activeSection}
        categories={categories}
        onNavClick={scrollToCategory}
      />

      <div className="h-[500vh] no-scrollbar">
        <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
          <motion.div
            className="w-full relative"
            style={{
              x: springX,
              height: gridHeight,
            }}
          >
            <div
              ref={contentRef}
              className="relative h-full"
              style={{
                width: `${containerWidth}px`,
                minWidth: `${containerWidth}px`,
              }}
            >
              {sortedItems.map((item, index) => {
                const position = cardPositions[index];
                if (!position) return null;

                const isIntro = item.type === 'intro';
                const isOutro = item.type === 'outro';

                return (
                  <MasonryCard
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    year={item.year}
                    description={item.description}
                    image={item.image}
                    size={item.size}
                    type={item.type}
                    link={item.link}
                    scrollProgress={springX}
                    cardIndex={index}
                    totalCards={sortedItems.length}
                    cardPosition={position.centerX}
                    absolutePosition={{
                      top: position.top,
                      left: position.left,
                      width: position.width,
                      height: position.height,
                    }}
                    // Intro 独立缩放
                    introScale={isIntro ? springIntroScale : undefined}
                    // Outro 独立缩放
                    outroScale={isOutro ? springOutroScale : undefined}
                    // Project 卡片透明度
                    cardOpacity={!isIntro && !isOutro ? springContentOpacity : undefined}
                  />
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
