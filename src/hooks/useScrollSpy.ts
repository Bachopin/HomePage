import type { RefObject } from 'react';
import { useState, useCallback } from 'react';
import type { MotionValue } from 'framer-motion';
import { useMotionValueEvent } from 'framer-motion';

/**
 * Hook 输入参数
 */
export interface UseScrollSpyProps {
  /** 水平滚动位置（motion value，负值表示向左滚动） */
  scrollX: MotionValue<number>;
  /** 每个分类的目标卡片信息：left=左边缘, centerX=中心 */
  categoryTargetInfo: Record<string, { left: number; centerX: number }>;
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
 * 简单逻辑：
 * 1. 点击导航 → 滚动到让目标卡片居中的位置
 * 2. 滚动时 → 检测目标卡片左边缘是否过了屏幕中线
 */
export function useScrollSpy({
  scrollX,
  categoryTargetInfo,
  categories,
  windowWidth,
  maxScroll,
  scrollContainerRef,
}: UseScrollSpyProps): UseScrollSpyResult {
  const [activeSection, setActiveSection] = useState<string>('All');

  // 监听滚动：检测哪个分类的目标卡片左边缘已经过了屏幕中线
  useMotionValueEvent(scrollX, 'change', (currentX) => {
    if (!categoryTargetInfo || Object.keys(categoryTargetInfo).length === 0) {
      setActiveSection('All');
      return;
    }

    // currentX <= 0，是内容的水平偏移量
    // 屏幕中线对应的内容坐标 = windowWidth/2 - currentX
    const screenCenterInContent = windowWidth / 2 - currentX;

    let active = 'All';
    for (const category of categories) {
      if (category === 'All') continue;
      const info = categoryTargetInfo[category];
      if (!info) continue;
      
      // 卡片左边缘 <= 屏幕中线位置 → 这个分类激活
      if (info.left <= screenCenterInContent) {
        active = category;
      }
    }
    setActiveSection(active);
  });

  // 点击导航：直接滚动到让目标卡片居中
  const scrollToCategory = useCallback(
    (category: string) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      if (category === 'All') {
        container.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const info = categoryTargetInfo[category];
      if (!info) return;
      if (maxScroll === 0) return;

      // 要让卡片中心对齐屏幕中心
      // 需要的 translateX = windowWidth/2 - cardCenterX
      const targetX = windowWidth / 2 - info.centerX;
      // 限制范围 [maxScroll, 0]
      const clampedX = Math.max(Math.min(targetX, 0), maxScroll);

      // translateX 和 scrollY 的关系：
      // scrollY = 0 → translateX = 0
      // scrollY = scrollHeight → translateX = maxScroll
      // 所以 scrollY = scrollHeight * (translateX / maxScroll)
      // 但要考虑前 5% 是缩放阶段，水平滚动从 5% 开始
      // 实际水平滚动范围是 scrollHeight 的 95%
      
      const scrollHeight = container.scrollHeight;
      const viewportHeight = container.clientHeight;
      const scrollableHeight = scrollHeight - viewportHeight;
      
      // translateX 从 0 到 maxScroll 对应 scrollY 从 5% 到 100%
      // ratio = clampedX / maxScroll (0 到 1)
      const ratio = clampedX / maxScroll;
      // 对应的滚动进度 = 0.05 + ratio * 0.95
      const scrollProgress = 0.05 + ratio * 0.95;
      const targetScrollY = scrollableHeight * scrollProgress;

      container.scrollTo({ top: targetScrollY, behavior: 'smooth' });
    },
    [categoryTargetInfo, windowWidth, maxScroll, scrollContainerRef]
  );

  return { activeSection, scrollToCategory };
}
