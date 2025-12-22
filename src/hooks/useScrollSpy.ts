import type { RefObject } from 'react';
import { useState, useCallback } from 'react';
import type { MotionValue } from 'framer-motion';
import { useMotionValueEvent } from 'framer-motion';
import { SCROLL, getLayoutConfig } from '@/lib/config';

/**
 * Hook 输入参数
 */
export interface UseScrollSpyProps {
  /** 水平滚动位置（motion value，负值表示向左滚动） */
  scrollX: MotionValue<number>;
  /** 每个分类的目标 X 坐标（用于导航跳转和检测激活状态） */
  categoryTargetX: Record<string, number>;
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
 * - 基于每个分类中 Sort 值最低且不为空的卡片位置进行检测
 * - 当该卡片的左边经过屏幕中线时，切换到对应分类
 * - 点击导航时，跳转到该卡片居中的位置
 */
export function useScrollSpy({
  scrollX,
  categoryTargetX,
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
      if (!categoryTargetX || Object.keys(categoryTargetX).length === 0) {
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

      // 计算屏幕中心线对应的绝对 X 坐标
      const screenCenterX = windowWidth / 2;
      const absoluteXAtCenter = screenCenterX - latest; // latest 是负值，所以减去它

      // 获取有效分类列表（排除 'All'）
      const orderedCategories = categories.filter(c => c !== 'All');
      if (orderedCategories.length === 0) {
        setActiveSection('All');
        return;
      }

      // 找到目标卡片左边缘已经越过屏幕中心的最后一个分类
      let activeCategory = 'All';

      for (const category of orderedCategories) {
        const targetX = categoryTargetX[category];
        
        if (targetX === undefined || isNaN(targetX)) {
          continue;
        }

        // 计算目标卡片的左边缘位置
        // 使用布局配置获取准确的卡片宽度
        const layout = getLayoutConfig(windowWidth);
        const cardHalfWidth = layout.columnWidth / 2; // 假设大多数卡片是1x1，使用单列宽度的一半
        const cardLeftEdge = targetX - cardHalfWidth;
        
        if (absoluteXAtCenter >= cardLeftEdge) {
          activeCategory = category;
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
        if (!categoryTargetX || Object.keys(categoryTargetX).length === 0) {
          console.warn('Cannot scroll: missing categoryTargetX');
          return;
        }

        if (!windowWidth || windowWidth <= 0 || isNaN(windowWidth)) {
          console.warn('Cannot scroll: invalid windowWidth');
          return;
        }

        const targetX = categoryTargetX[category.trim()];

        if (targetX === undefined || isNaN(targetX)) {
          console.warn(`No target position found for category: "${category}"`);
          return;
        }

        // 计算目标位置：将目标卡片居中
        const screenCenter = windowWidth / 2;
        const targetTranslateX = screenCenter - targetX;

        // 限制在有效范围内 [maxScroll, 0]
        const clampedTranslateX = Math.max(Math.min(targetTranslateX, 0), maxScroll);

        // 验证 maxScroll 有效性
        if (maxScroll === 0 || Math.abs(maxScroll) < 1 || isNaN(maxScroll)) {
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
    [categoryTargetX, windowWidth, maxScroll, scrollContainerRef]
  );

  return { activeSection, scrollToCategory };
}
