import type { RefObject } from 'react';
import { useState, useCallback } from 'react';
import type { MotionValue } from 'framer-motion';
import { useMotionValueEvent } from 'framer-motion';
import { SCROLL } from '@/lib/config';

/**
 * Hook 输入参数
 */
export interface UseScrollSpyProps {
  /** 水平滚动位置（motion value，负值表示向左滚动） */
  scrollX: MotionValue<number>;
  /** 每个分类的目标卡片信息 */
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
 * 滚动监听 Hook - 简单直接的实现
 * 
 * 逻辑：
 * 1. 滚动监听：当目标卡片的左边缘经过屏幕中线时，切换到该分类
 * 2. 点击导航：跳转到让目标卡片居中的位置
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

  // 监听滚动位置变化
  useMotionValueEvent(scrollX, 'change', (currentX) => {
    // currentX 是负值，表示内容向左移动了多少
    // 屏幕中线在视口中的位置是 windowWidth / 2
    // 屏幕中线对应的内容绝对位置 = windowWidth / 2 - currentX
    
    if (!categoryTargetInfo || Object.keys(categoryTargetInfo).length === 0) {
      setActiveSection('All');
      return;
    }

    if (currentX >= 0) {
      setActiveSection('All');
      return;
    }

    const screenCenterAbsoluteX = windowWidth / 2 - currentX;

    // 按分类顺序遍历，找到最后一个左边缘已经越过屏幕中线的分类
    let newActiveSection = 'All';
    
    for (const category of categories) {
      if (category === 'All') continue;
      
      const info = categoryTargetInfo[category];
      if (!info) continue;
      
      // 当卡片左边缘 <= 屏幕中线的绝对位置时，说明卡片左边缘已经越过中线
      if (info.left <= screenCenterAbsoluteX) {
        newActiveSection = category;
      }
    }

    setActiveSection(newActiveSection);
  });

  // 滚动到指定分类
  const scrollToCategory = useCallback(
    (category: string) => {
      if (category === 'All') {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const info = categoryTargetInfo[category];
      if (!info) return;

      // 目标：让卡片中心对齐屏幕中心
      // 需要的 translateX = 屏幕中心 - 卡片中心
      const targetTranslateX = windowWidth / 2 - info.centerX;
      
      // 限制在有效范围内
      const clampedX = Math.max(Math.min(targetTranslateX, 0), maxScroll);

      if (maxScroll === 0) return;

      // 将 translateX 转换为滚动进度
      // translateX 从 0 变到 maxScroll，对应进度从 horizontalScrollStartProgress 到 1
      const ratio = clampedX / maxScroll; // 0 到 1
      const scrollProgress = SCROLL.horizontalScrollStartProgress + ratio * (1 - SCROLL.horizontalScrollStartProgress);

      const container = scrollContainerRef.current;
      if (!container) return;

      const targetScrollY = container.scrollHeight * scrollProgress;
      container.scrollTo({ top: targetScrollY, behavior: 'smooth' });
    },
    [categoryTargetInfo, windowWidth, maxScroll, scrollContainerRef]
  );

  return { activeSection, scrollToCategory };
}
