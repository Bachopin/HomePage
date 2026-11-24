'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { Navigation } from '@/components/layout';
import { MasonryCard } from '@/components/features/home';
import type { NotionItem } from '@/lib/notion';
import { useMasonryLayout, useScrollSpy, useProgressiveImagePreloader } from '@/hooks';
import { ANIMATION, DEFAULTS, SCROLL } from '@/lib/config';

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

function useWindowSize() {
  const [windowWidth, setWindowWidth] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setWindowWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { windowWidth: windowWidth ?? DEFAULTS.windowWidth, isReady: windowWidth !== null };
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
        return (parseInt(b.quotes || '0', 10) || 0) - (parseInt(a.quotes || '0', 10) || 0);
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
  const scrollContainerRef = useRef<HTMLElement>(null);
  const isJumpingRef = useRef(false);

  const sortedItems = useSortedItems(items, categories);
  const { windowWidth, isReady } = useWindowSize();

  // 预加载关键图片（渐进式策略）
  const criticalImageUrls = useMemo(() => {
    return sortedItems
      .filter(item => item.image && item.image.trim() !== '')
      .slice(0, 6)
      .map(item => item.image);
  }, [sortedItems]);

  // 预加载图片（结果用于后台优化，不阻塞渲染）
  useProgressiveImagePreloader(
    criticalImageUrls,
    {
      viewportWidth: windowWidth,
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      enableOptimization: true,
    }
  );

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
  // 动画值 - 使用滚动进度驱动，弹簧提供平滑过渡
  // =========================================================================
  
  // Intro 缩放：停留 → 缩小
  const introScaleRaw = useTransform(scrollYProgress, (p: number) => {
    if (p < SCROLL.introPauseEnd) return ANIMATION.imageScale;
    if (p < SCROLL.introEnd) {
      const progress = (p - SCROLL.introPauseEnd) / (SCROLL.introEnd - SCROLL.introPauseEnd);
      return ANIMATION.imageScale - progress * (ANIMATION.imageScale - 1);
    }
    return 1;
  });
  const introScale = useSpring(introScaleRaw, ANIMATION.scrollScaleSpring);

  // Outro 缩放：放大 → 停留
  const outroScaleRaw = useTransform(scrollYProgress, (p: number) => {
    if (p < SCROLL.outroStart) return 1;
    if (p < SCROLL.outroPauseStart) {
      const progress = (p - SCROLL.outroStart) / (SCROLL.outroPauseStart - SCROLL.outroStart);
      return 1 + progress * (ANIMATION.imageScale - 1);
    }
    return ANIMATION.imageScale;
  });
  const outroScale = useSpring(outroScaleRaw, ANIMATION.scrollScaleSpring);

  // 水平位移
  const x = useTransform(scrollYProgress, (p): number => {
    // 确保 maxScroll 已经计算好（containerWidth > 0）
    // 初始加载时 scrollYProgress 可能有微小的非零值，强制返回 0
    if (containerWidth === 0 || p < 0.001) return 0;
    if (p < SCROLL.introEnd) return 0;
    if (p < SCROLL.outroStart) {
      return ((p - SCROLL.introEnd) / (SCROLL.outroStart - SCROLL.introEnd)) * maxScroll;
    }
    return maxScroll;
  });
  const springX = useSpring(x, ANIMATION.scrollPositionSpring);

  // 内容透明度（与缩放动画同步）
  const contentOpacityRaw = useTransform(scrollYProgress, (p: number): number => {
    if (p < SCROLL.introPauseEnd) return 0;
    
    if (p < SCROLL.introEnd) {
      const totalDuration = SCROLL.introEnd - SCROLL.introPauseEnd;
      const delayedStart = SCROLL.introPauseEnd + totalDuration * SCROLL.contentFadeDelayRatio;
      if (p < delayedStart) return 0;
      const progress = (p - delayedStart) / (SCROLL.introEnd - delayedStart);
      return Math.pow(progress, SCROLL.contentFadeEasePower);
    }
    
    if (p < SCROLL.outroStart) return 1;
    
    if (p < SCROLL.outroPauseStart) {
      const totalDuration = SCROLL.outroPauseStart - SCROLL.outroStart;
      const earlyEnd = SCROLL.outroStart + totalDuration * SCROLL.contentFadeEarlyEndRatio;
      if (p > earlyEnd) return 0;
      const progress = (p - SCROLL.outroStart) / (earlyEnd - SCROLL.outroStart);
      return 1 - Math.pow(progress, SCROLL.contentFadeEasePower);
    }
    
    return 0;
  });
  const contentOpacity = useSpring(contentOpacityRaw, ANIMATION.scrollScaleSpring);

  // =========================================================================
  // 无缝循环：停留 + 累积动量 + 瞬间跳转
  // =========================================================================
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
        pauseStartTimeRef.current = null;
        isPauseCompleteRef.current = false;
        accumulatedDeltaRef.current = 0;
        return;
      }

      e.preventDefault();
      const now = Date.now();

      if (!isPauseCompleteRef.current) {
        if (!pauseStartTimeRef.current) {
          pauseStartTimeRef.current = now;
          return;
        }
        
        if (now - pauseStartTimeRef.current >= SCROLL.loopPauseMs) {
          isPauseCompleteRef.current = true;
          accumulatedDeltaRef.current = 0;
        }
        return;
      }

      accumulatedDeltaRef.current += Math.abs(e.deltaY);

      if (accumulatedDeltaRef.current >= SCROLL.loopMomentumThreshold) {
        isJumpingRef.current = true;
        
        pauseStartTimeRef.current = null;
        isPauseCompleteRef.current = false;
        accumulatedDeltaRef.current = 0;

        if (atTop) {
          springX.jump(maxScroll);
          introScale.jump(1);
          outroScale.jump(ANIMATION.imageScale);
          container.scrollTop = maxScrollTop;
        } else {
          springX.jump(0);
          introScale.jump(ANIMATION.imageScale);
          outroScale.jump(1);
          container.scrollTop = 0;
        }

        requestAnimationFrame(() => {
          isJumpingRef.current = false;
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [springX, maxScroll, introScale, outroScale]);

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
      className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-stone-100 dark:bg-neutral-700 no-scrollbar overscroll-none"
      style={{
        visibility: isReady ? 'visible' : 'hidden',
      }}
    >
      <Navigation
        activeSection={activeSection}
        categories={categories}
        onNavClick={scrollToCategory}
      />

      <div className="h-[500vh] no-scrollbar">
        <div className="sticky top-0 h-[100dvh] flex items-center justify-center overflow-hidden">
          <motion.div
            className="w-full relative"
            style={{
              x: springX,
              height: gridHeight,
            }}
          >
            <div
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
                    quotes={item.quotes}
                    description={item.description}
                    image={item.image}
                    size={item.size}
                    type={item.type}
                    link={item.link}
                    scrollProgress={springX}
                    scrollYProgress={isIntro ? scrollYProgress : undefined}
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
