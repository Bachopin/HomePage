import type { RefObject } from 'react';
import { useState, useCallback, useRef } from 'react';
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

// 滚动阶段边界（需要和 HomeClient 中的 PHASES 保持一致）
const PHASES = {
  introEnd: 0.12,      // 水平滚动开始
  outroStart: 0.88,    // 水平滚动结束
} as const;

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
  // 防止频繁更新
  const lastActiveRef = useRef<string>('All');

  // 监听滚动：检测哪个分类的目标卡片左边缘已经过了屏幕中线
  useMotionValueEvent(scrollX, 'change', (currentX) => {
    // 防御：无效数据
    if (typeof currentX !== 'number' || isNaN(currentX)) {
      return;
    }

    // 防御：无分类数据
    if (!categoryTargetInfo || typeof categoryTargetInfo !== 'object') {
      if (lastActiveRef.current !== 'All') {
        lastActiveRef.current = 'All';
        setActiveSection('All');
      }
      return;
    }

    // 防御：无效窗口宽度
    if (!windowWidth || windowWidth <= 0) {
      return;
    }

    // 屏幕中线对应的内容坐标
    // currentX 是负值或0，表示内容向左移动了多少
    const screenCenterInContent = windowWidth / 2 - currentX;

    // 防御：计算结果无效
    if (isNaN(screenCenterInContent)) {
      return;
    }

    // 遍历分类，找到最后一个左边缘已过中线的
    let active = 'All';
    
    for (const category of categories) {
      // 跳过 All
      if (category === 'All') continue;
      
      const info = categoryTargetInfo[category];
      // 防御：该分类无目标卡片信息
      if (!info || typeof info.left !== 'number' || isNaN(info.left)) {
        continue;
      }
      
      // 卡片左边缘 <= 屏幕中线位置 → 这个分类激活
      if (info.left <= screenCenterInContent) {
        active = category;
      }
    }

    // 只在变化时更新，避免不必要的渲染
    if (lastActiveRef.current !== active) {
      lastActiveRef.current = active;
      setActiveSection(active);
    }
  });

  // 点击导航：直接滚动到让目标卡片居中
  const scrollToCategory = useCallback(
    (category: string) => {
      // 防御：无效参数
      if (typeof category !== 'string') return;

      const container = scrollContainerRef.current;
      // 防御：容器不存在
      if (!container) return;

      // All = 回到顶部
      if (category === 'All') {
        container.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // 防御：无分类数据
      if (!categoryTargetInfo || typeof categoryTargetInfo !== 'object') return;

      const info = categoryTargetInfo[category];
      // 防御：该分类无目标卡片
      if (!info || typeof info.centerX !== 'number' || isNaN(info.centerX)) return;

      // 防御：无效窗口宽度
      if (!windowWidth || windowWidth <= 0) return;

      // 防御：无滚动空间（内容比视口窄）
      if (maxScroll === 0 || maxScroll > 0) return;

      // 计算目标 translateX：让卡片中心对齐屏幕中心
      const targetX = windowWidth / 2 - info.centerX;
      
      // 限制范围 [maxScroll, 0]
      const clampedX = Math.max(Math.min(targetX, 0), maxScroll);

      // 获取滚动容器尺寸
      const scrollHeight = container.scrollHeight;
      const viewportHeight = container.clientHeight;
      const scrollableHeight = scrollHeight - viewportHeight;

      // 防御：无法滚动
      if (scrollableHeight <= 0) return;

      // translateX 从 0 到 maxScroll 对应滚动进度从 introEnd 到 outroStart
      // ratio = clampedX / maxScroll (0 到 1，因为两者都是负数或0)
      const ratio = clampedX / maxScroll;
      
      // 防御：ratio 计算异常
      if (isNaN(ratio) || !isFinite(ratio)) return;

      // 对应的滚动进度：introEnd + ratio * (outroStart - introEnd)
      const scrollProgress = PHASES.introEnd + ratio * (PHASES.outroStart - PHASES.introEnd);
      const targetScrollY = scrollableHeight * scrollProgress;

      // 防御：目标位置无效
      if (isNaN(targetScrollY) || targetScrollY < 0) return;

      container.scrollTo({ top: targetScrollY, behavior: 'smooth' });
    },
    [categoryTargetInfo, windowWidth, maxScroll, scrollContainerRef]
  );

  return { activeSection, scrollToCategory };
}
