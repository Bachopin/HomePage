'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import Navigation from '@/components/Navigation';
import MasonryCard from '@/components/MasonryCard';
import { NotionItem } from '@/lib/notion';
import { useMasonryLayout } from '@/hooks/useMasonryLayout';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import { ANIMATION, SCROLL, DEFAULTS } from '@/lib/config';

// ============================================================================
// Types
// ============================================================================

interface HomeClientProps {
  items: NotionItem[];
  categories?: string[];
}

// ============================================================================
// Custom Hooks
// ============================================================================

/**
 * 窗口尺寸监听 Hook
 */
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

/**
 * 排序 Items Hook（处理 intro/outro 优先级）
 */
function useSortedItems(items: NotionItem[], categories: string[]) {
  return useMemo(() => {
    if (!items || items.length === 0) return [];

    // 创建分类索引映射
    const categoryIndexMap = new Map<string, number>();
    categories.forEach((cat, idx) => {
      if (cat !== 'All') {
        categoryIndexMap.set(cat, idx);
      }
    });

    return [...items].sort((a, b) => {
      // intro 始终在最前
      if (a.type === 'intro' && b.type !== 'intro') return -1;
      if (a.type !== 'intro' && b.type === 'intro') return 1;
      // outro 始终在最后
      if (a.type === 'outro' && b.type !== 'outro') return 1;
      if (a.type !== 'outro' && b.type === 'outro') return -1;

      // 两个都是 project
      if (a.type === 'project' && b.type === 'project') {
        const catA = a.category || '';
        const catB = b.category || '';

        // 主排序：分类索引
        const idxA = categoryIndexMap.get(catA) ?? Infinity;
        const idxB = categoryIndexMap.get(catB) ?? Infinity;
        if (idxA !== idxB) return idxA - idxB;

        // 次排序：sort 字段
        const sortA = a.sort ?? Infinity;
        const sortB = b.sort ?? Infinity;
        if (sortA !== sortB) return sortA - sortB;

        // 三级排序：年份（降序）
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
  // Refs
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);

  // -------------------------------------------------------------------------
  // Step 1: Data - 排序 items
  // -------------------------------------------------------------------------
  const sortedItems = useSortedItems(items, categories);

  // -------------------------------------------------------------------------
  // Step 2: Layout - 计算卡片位置
  // -------------------------------------------------------------------------
  const { windowWidth } = useWindowSize();

  const { cardPositions, categoryStartX, containerWidth, gridHeight } = useMasonryLayout({
    items: sortedItems,
    windowWidth,
    categories,
  });

  // -------------------------------------------------------------------------
  // Step 3: Scroll Animation - 滚动变换
  // -------------------------------------------------------------------------
  const { scrollYProgress } = useScroll({
    container: scrollContainerRef,
  });

  // 缩放变换：scrollYProgress [0, scaleEndProgress] -> scale [imageScale, 1]
  const scale = useTransform(
    scrollYProgress,
    [0, SCROLL.scaleEndProgress],
    [ANIMATION.imageScale, 1]
  );
  const springScale = useSpring(scale, ANIMATION.scaleSpring);

  // 水平位移变换
  const maxScroll = containerWidth > windowWidth ? -(containerWidth - windowWidth) : 0;

  const x = useTransform(scrollYProgress, (latest) => {
    if (latest < SCROLL.horizontalScrollStartProgress) return 0;
    if (latest >= 1.0) return maxScroll;
    
    const progress = (latest - SCROLL.horizontalScrollStartProgress) / 
                     (1.0 - SCROLL.horizontalScrollStartProgress);
    return progress * maxScroll;
  });
  const springX = useSpring(x, ANIMATION.spring);

  // -------------------------------------------------------------------------
  // Step 4: Interaction - 滚动监听与导航
  // -------------------------------------------------------------------------
  const { activeSection, scrollToCategory } = useScrollSpy({
    scrollX: springX,
    categoryStartX,
    categories,
    windowWidth,
    maxScroll,
    scrollContainerRef,
  });

  // -------------------------------------------------------------------------
  // Step 5: Render
  // -------------------------------------------------------------------------

  // 空状态
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
      {/* Navigation */}
      <Navigation
        activeSection={activeSection}
        categories={categories}
        onNavClick={scrollToCategory}
      />

      {/* Scrollable Content Container */}
      <div className="h-[400vh] no-scrollbar">
        {/* Fixed Viewport Container */}
        <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
          <motion.div
            className="w-full relative"
            style={{
              scale: springScale,
              x: springX,
              height: gridHeight,
            }}
          >
            {/* Absolute Positioned Container */}
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
