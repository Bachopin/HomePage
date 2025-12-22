import { useState, useCallback, RefObject } from 'react';
import { MotionValue, useMotionValueEvent } from 'framer-motion';
import { SCROLL } from '@/lib/config';

/**
 * Hook 输入参数
 */
export interface UseScrollSpyProps {
  /** 水平滚动位置（motion value，负值表示向左滚动） */
  scrollX: MotionValue<number>;
  /** 每个分类的起始 X 坐标 */
  categoryStartX: Record<string, number>;
  /** 分类列表（包含 'All'） */
  categories: string[];
  /** 视口宽度 */
  windowWidth: number;
  /** 最大滚动距离（负值） */
  maxScroll: number;
  /** 滚动容器引用 */
  scrollContainerRef: RefObject<HTMLElement | null>;
}

/**
 * Hook 返回值
 */
export interface UseScrollSpyResult {
  /** 当前激活的分类 */
  activeSection: string;
  /** 滚动到指定分类的函数 */
  scrollToCategory: (category: string) => void;
}

/**
 * 滚动监听 Hook
 * 
 * 职责：
 * 1. 监听滚动位置变化，计算当前激活的分类
 * 2. 提供滚动到指定分类的函数
 * 
 * 算法说明：
 * - 使用范围判断而非中心点判断
 * - 当前分类 = categoryStartX <= viewportCenterX < nextCategoryStartX
 * - 滚动末尾强制显示最后一个分类
 */
export function useScrollSpy({
  scrollX,
  categoryStartX,
  categories,
  windowWidth,
  maxScroll,
  scrollContainerRef,
}: UseScrollSpyProps): UseScrollSpyResult {
  const [activeSection, setActiveSection] = useState<string>('All');

  // 监听滚动位置变化
  useMotionValueEvent(scrollX, 'change', (latest) => {
    try {
      // 无分类数据时默认 'All'
      if (!categoryStartX || Object.keys(categoryStartX).length === 0) {
        setActiveSection('All');
        return;
      }

      // 滚动起始位置（latest >= 0）显示 'All'
      if (latest >= 0 || isNaN(latest)) {
        setActiveSection('All');
        return;
      }

      // 窗口宽度无效时默认 'All'
      if (!windowWidth || windowWidth <= 0 || isNaN(windowWidth)) {
        setActiveSection('All');
        return;
      }

      // 滚动末尾强制显示最后一个分类
      if (Math.abs(latest - maxScroll) < SCROLL.endThreshold) {
        const orderedCategories = categories.filter(c => c !== 'All');
        if (orderedCategories.length > 0) {
          setActiveSection(orderedCategories[orderedCategories.length - 1]);
          return;
        }
      }

      // 计算视口中心对应的绝对 X 坐标
      const viewportCenter = windowWidth / 2;
      const absoluteXAtViewportCenter = viewportCenter - latest;

      const orderedCategories = categories.filter(c => c !== 'All');
      if (orderedCategories.length === 0) {
        setActiveSection('All');
        return;
      }

      // 范围判断：找到当前激活的分类
      let activeCategory = 'All';

      for (let i = 0; i < orderedCategories.length; i++) {
        const category = orderedCategories[i];
        const categoryStart = categoryStartX[category];

        if (categoryStart === undefined || isNaN(categoryStart)) {
          continue;
        }

        if (i === orderedCategories.length - 1) {
          // 最后一个分类：absoluteX >= categoryStart 即激活
          if (absoluteXAtViewportCenter >= categoryStart) {
            activeCategory = category;
            break;
          }
        } else {
          // 非最后分类：检查是否在当前分类范围内
          const nextCategory = orderedCategories[i + 1];
          const nextCategoryStart = categoryStartX[nextCategory];

          if (nextCategoryStart !== undefined && !isNaN(nextCategoryStart)) {
            if (
              absoluteXAtViewportCenter >= categoryStart &&
              absoluteXAtViewportCenter < nextCategoryStart
            ) {
              activeCategory = category;
              break;
            }
          } else {
            if (absoluteXAtViewportCenter >= categoryStart) {
              activeCategory = category;
            }
          }
        }
      }

      setActiveSection(activeCategory);
    } catch (error) {
      console.error('Error in useScrollSpy:', error);
      setActiveSection('All');
    }
  });

  // 滚动到指定分类
  const scrollToCategory = useCallback(
    (category: string) => {
      try {
        // 滚动到 'All' = 回到顶部
        if (category === 'All') {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          }
          return;
        }

        // 验证数据有效性
        if (!categoryStartX || Object.keys(categoryStartX).length === 0) {
          console.warn('Cannot scroll: missing categoryStartX');
          return;
        }

        if (!windowWidth || windowWidth <= 0 || isNaN(windowWidth)) {
          console.warn('Cannot scroll: invalid windowWidth');
          return;
        }

        const categoryStart = categoryStartX[category.trim()];

        if (categoryStart === undefined || isNaN(categoryStart)) {
          const availableCategories = Object.keys(categoryStartX);
          console.warn(`No start position found for category: "${category}"`);
          console.log('Available categories:', availableCategories);
          return;
        }

        // 计算目标位置：将分类起始位置对齐到视口中心
        const viewportCenter = windowWidth / 2;
        const targetTranslateX = viewportCenter - categoryStart;

        // 限制在有效范围内 [maxScroll, 0]
        const clampedTranslateX = Math.max(Math.min(targetTranslateX, 0), maxScroll);

        // 验证 maxScroll 有效性
        if (maxScroll === 0 || Math.abs(maxScroll) < 0.001 || isNaN(maxScroll)) {
          console.warn('Max scroll is 0 or invalid, cannot scroll. maxScroll:', maxScroll);
          return;
        }

        // 将 translateX 映射到滚动进度 (0.0 到 1.0)
        // 水平滚动发生在进度 horizontalScrollStartProgress 到 1.0 之间
        const normalizedTranslateX = Math.abs(clampedTranslateX / maxScroll);
        const scrollRange = 1.0 - SCROLL.horizontalScrollStartProgress;
        const targetProgress = SCROLL.horizontalScrollStartProgress + normalizedTranslateX * scrollRange;

        if (isNaN(targetProgress) || !isFinite(targetProgress)) {
          console.warn('Invalid progress calculation, cannot scroll.');
          return;
        }

        // 计算目标滚动位置
        if (!scrollContainerRef.current) {
          console.warn('Scroll container ref not available');
          return;
        }

        const containerHeight = scrollContainerRef.current.scrollHeight;
        const targetScrollY = containerHeight * targetProgress;

        if (!isNaN(targetScrollY) && containerHeight > 0) {
          scrollContainerRef.current.scrollTo({
            top: targetScrollY,
            behavior: 'smooth',
          });
        }
      } catch (error) {
        console.error('Error in scrollToCategory:', error);
      }
    },
    [categoryStartX, windowWidth, maxScroll, scrollContainerRef]
  );

  return { activeSection, scrollToCategory };
}
