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
// Constants
// ============================================================================

const PHASES = {
  // 停留区间：0 - 0.06 时 Intro 保持最大（约3秒停留）
  introPauseEnd: 0.06,
  // 缩放区间：0.06 - 0.12 时 Intro 从大变小
  introEnd: 0.12,
  // 水平滚动：0.12 - 0.88
  outroStart: 0.88,
  // 停留区间：0.94 - 1.0 时 Outro 保持最大（约3秒停留）
  outroPauseStart: 0.94,
} as const;

// ============================================================================
// Custom Hooks
// ============================================================================

function useWindowSize() {
  const [windowWidth, setWindowWidth] = useState<number>(DEFAULTS.windowWidth);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setWindowWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { windowWidth };
}

function useSortedItems(items: NotionItem[], categories: string[]) {
  return useMemo(() => {
    if (!items || items.length === 0) return [];

    const categoryIndexMap = new Map<string, number>();
    categories.forEach((cat, idx) => {
      if (cat !== 'All') categoryIndexMap.set(cat, idx);
    });

    return [...items].sort((a, b) => {
      if (a.type === 'intro' && b.type !== 'intro') return -1;
      if (a.type !== 'intro' && b.type === 'intro') return 1;
      if (a.type === 'outro' && b.type !== 'outro') return 1;
      if (a.type !== 'outro' && b.type === 'outro') return -1;

      if (a.type === 'project' && b.type === 'project') {
        const idxA = categoryIndexMap.get(a.category || '') ?? Infinity;
        const idxB = categoryIndexMap.get(b.category || '') ?? Infinity;
        if (idxA !== idxB) return idxA - idxB;
        if ((a.sort ?? Infinity) !== (b.sort ?? Infinity)) return (a.sort ?? Infinity) - (b.sort ?? Infinity);
        return (parseInt(b.year || '0', 10) || 0) - (parseInt(a.year || '0', 10) || 0);
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
  const isJumpingRef = useRef(false);

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
  // 动画值 - 不用弹簧，直接跟随，跳转无感
  // =========================================================================
  
  // Intro 缩放：停留 → 缩小（加弹簧让它有粘滞感）
  const introScaleRaw = useTransform(scrollYProgress, (p): number => {
    if (p < PHASES.introPauseEnd) return ANIMATION.imageScale;
    if (p < PHASES.introEnd) {
      const progress = (p - PHASES.introPauseEnd) / (PHASES.introEnd - PHASES.introPauseEnd);
      return ANIMATION.imageScale - progress * (ANIMATION.imageScale - 1);
    }
    return 1;
  });
  const introScale = useSpring(introScaleRaw, { stiffness: 60, damping: 15 });

  // Outro 缩放：放大 → 停留（加弹簧让它有粘滞感）
  const outroScaleRaw = useTransform(scrollYProgress, (p): number => {
    if (p < PHASES.outroStart) return 1;
    if (p < PHASES.outroPauseStart) {
      const progress = (p - PHASES.outroStart) / (PHASES.outroPauseStart - PHASES.outroStart);
      return 1 + progress * (ANIMATION.imageScale - 1);
    }
    return ANIMATION.imageScale;
  });
  const outroScale = useSpring(outroScaleRaw, { stiffness: 60, damping: 15 });

  // 水平位移
  const x = useTransform(scrollYProgress, (p): number => {
    if (p < PHASES.introEnd) return 0;
    if (p < PHASES.outroStart) {
      return ((p - PHASES.introEnd) / (PHASES.outroStart - PHASES.introEnd)) * maxScroll;
    }
    return maxScroll;
  });
  const springX = useSpring(x, { stiffness: 400, damping: 40 });

  // 内容透明度
  const contentOpacity = useTransform(scrollYProgress, (p): number => {
    // 停留区间：完全透明
    if (p < PHASES.introPauseEnd) return 0;
    // 淡入
    if (p < PHASES.introEnd) {
      return (p - PHASES.introPauseEnd) / (PHASES.introEnd - PHASES.introPauseEnd);
    }
    // 正常可见
    if (p < PHASES.outroStart) return 1;
    // 淡出
    if (p < PHASES.outroPauseStart) {
      return 1 - (p - PHASES.outroStart) / (PHASES.outroPauseStart - PHASES.outroStart);
    }
    // 停留区间：完全透明
    return 0;
  });

  // =========================================================================
  // 无缝循环：停留 + 累积动量 + 瞬间跳转
  // =========================================================================
  const PAUSE_DURATION = 1000; // 停留时间（毫秒）
  const MOMENTUM_THRESHOLD = 600; // 动量阈值
  
  const pauseStartTimeRef = useRef<number | null>(null);
  const isPauseCompleteRef = useRef(false);
  const accumulatedDeltaRef = useRef(0);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (isJumpingRef.current) return;

      const scrollTop = container.scrollTop;
      const maxScrollTop = container.scrollHeight - container.clientHeight;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop >= maxScrollTop - 1;
      const isOverscrolling = (atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0);

      if (!isOverscrolling) {
        // 离开边界，重置所有状态
        pauseStartTimeRef.current = null;
        isPauseCompleteRef.current = false;
        accumulatedDeltaRef.current = 0;
        return;
      }

      e.preventDefault();
      const now = Date.now();

      // 阶段1：停留计时
      if (!isPauseCompleteRef.current) {
        if (!pauseStartTimeRef.current) {
          pauseStartTimeRef.current = now;
          return;
        }
        
        if (now - pauseStartTimeRef.current >= PAUSE_DURATION) {
          isPauseCompleteRef.current = true;
          accumulatedDeltaRef.current = 0;
        }
        return;
      }

      // 阶段2：累积动量
      accumulatedDeltaRef.current += Math.abs(e.deltaY);

      if (accumulatedDeltaRef.current >= MOMENTUM_THRESHOLD) {
        isJumpingRef.current = true;
        
        // 重置状态
        pauseStartTimeRef.current = null;
        isPauseCompleteRef.current = false;
        accumulatedDeltaRef.current = 0;

        if (atTop) {
          // 跳到底部（Outro 最大状态）
          springX.jump(maxScroll);
          introScale.jump(1); // Intro 变小
          outroScale.jump(ANIMATION.imageScale); // Outro 最大
          container.scrollTop = maxScrollTop;
        } else {
          // 跳到顶部（Intro 最大状态）
          springX.jump(0);
          introScale.jump(ANIMATION.imageScale); // Intro 最大
          outroScale.jump(1); // Outro 变小
          container.scrollTop = 0;
        }

        requestAnimationFrame(() => {
          isJumpingRef.current = false;
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [springX, maxScroll]);

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
                    introScale={isIntro ? introScale : undefined}
                    outroScale={isOutro ? outroScale : undefined}
                    cardOpacity={!isIntro && !isOutro ? contentOpacity : undefined}
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
