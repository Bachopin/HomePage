/**
 * 无限循环滚动 Hook
 * 
 * 滚动阶段：
 * Phase 1 (0% - 5%): Intro 缩放 - Intro 从全屏缩小，Project 卡片逐渐显现
 * Phase 2 (5% - 85%): 水平滚动 - 正常的横向瀑布流滚动
 * Phase 3 (85% - 92%): Outro 放大 - Outro 到达屏幕中心后开始放大
 * Phase 4 (92% - 96%): 停留 - Outro 全屏状态保持
 * Phase 5 (96% - 100%): 循环重置 - 滚动回顶部，无缝切换
 */

import { useCallback, useRef, useEffect } from 'react';
import type { RefObject } from 'react';
import type { MotionValue } from 'framer-motion';
import { useTransform, useMotionValue } from 'framer-motion';

// ============================================================================
// Types
// ============================================================================

export interface UseInfiniteScrollProps {
  scrollYProgress: MotionValue<number>;
  containerWidth: number;
  windowWidth: number;
  scrollContainerRef: RefObject<HTMLElement | null>;
}

export interface UseInfiniteScrollResult {
  /** 水平位移 */
  x: MotionValue<number>;
  /** Intro 卡片缩放 */
  introScale: MotionValue<number>;
  /** Outro 卡片缩放 */
  outroScale: MotionValue<number>;
  /** 非 Intro/Outro 卡片的整体缩放 */
  contentScale: MotionValue<number>;
  /** 非 Intro/Outro 卡片的透明度 */
  contentOpacity: MotionValue<number>;
  /** 当前阶段 (1-5) */
  phase: MotionValue<number>;
}

// ============================================================================
// Constants
// ============================================================================

// 阶段边界点
const PHASE_BOUNDARIES = {
  introScaleEnd: 0.05,      // Phase 1 结束：Intro 缩放完成
  horizontalEnd: 0.85,      // Phase 2 结束：水平滚动完成
  outroScaleEnd: 0.92,      // Phase 3 结束：Outro 放大完成
  pauseEnd: 0.96,           // Phase 4 结束：停留完成
  // Phase 5: 0.96 - 1.0    // 循环重置
} as const;

// 缩放范围
const SCALE = {
  full: 1.6,    // 全屏状态的缩放值（相对于正常尺寸）
  normal: 1,    // 正常状态
} as const;

// ============================================================================
// Main Hook
// ============================================================================

export function useInfiniteScroll({
  scrollYProgress,
  containerWidth,
  windowWidth,
  scrollContainerRef,
}: UseInfiniteScrollProps): UseInfiniteScrollResult {
  const isResettingRef = useRef(false);
  const lastProgressRef = useRef(0);

  // 最大水平滚动距离
  const maxScroll = containerWidth > windowWidth ? -(containerWidth - windowWidth) : 0;

  // -------------------------------------------------------------------------
  // Phase 计算
  // -------------------------------------------------------------------------
  const phase = useTransform(scrollYProgress, (progress): number => {
    if (progress < PHASE_BOUNDARIES.introScaleEnd) return 1;
    if (progress < PHASE_BOUNDARIES.horizontalEnd) return 2;
    if (progress < PHASE_BOUNDARIES.outroScaleEnd) return 3;
    if (progress < PHASE_BOUNDARIES.pauseEnd) return 4;
    return 5;
  });

  // -------------------------------------------------------------------------
  // Intro 缩放：Phase 1 时从 full 缩小到 normal
  // -------------------------------------------------------------------------
  const introScale = useTransform(
    scrollYProgress,
    [0, PHASE_BOUNDARIES.introScaleEnd],
    [SCALE.full as number, SCALE.normal as number]
  );

  // -------------------------------------------------------------------------
  // Content 缩放和透明度：Phase 1 时逐渐显现
  // -------------------------------------------------------------------------
  const contentScale = useTransform(
    scrollYProgress,
    [0, PHASE_BOUNDARIES.introScaleEnd],
    [0.8, SCALE.normal as number]
  );

  const contentOpacity = useTransform(
    scrollYProgress,
    [0, PHASE_BOUNDARIES.introScaleEnd * 0.5, PHASE_BOUNDARIES.introScaleEnd],
    [0, 0.5, 1]
  );

  // -------------------------------------------------------------------------
  // 水平位移：Phase 2 时从 0 滚动到 maxScroll
  // -------------------------------------------------------------------------
  const x = useTransform(scrollYProgress, (progress): number => {
    // Phase 1: 不滚动
    if (progress < PHASE_BOUNDARIES.introScaleEnd) return 0;
    
    // Phase 2: 水平滚动
    if (progress < PHASE_BOUNDARIES.horizontalEnd) {
      const phaseProgress = (progress - PHASE_BOUNDARIES.introScaleEnd) / 
                           (PHASE_BOUNDARIES.horizontalEnd - PHASE_BOUNDARIES.introScaleEnd);
      return phaseProgress * maxScroll;
    }
    
    // Phase 3-5: 保持在最右边
    return maxScroll;
  });

  // -------------------------------------------------------------------------
  // Outro 缩放：Phase 3 时从 normal 放大到 full
  // -------------------------------------------------------------------------
  const outroScale = useTransform(scrollYProgress, (progress): number => {
    // Phase 1-2: 正常大小
    if (progress < PHASE_BOUNDARIES.horizontalEnd) return SCALE.normal;
    
    // Phase 3: 放大
    if (progress < PHASE_BOUNDARIES.outroScaleEnd) {
      const phaseProgress = (progress - PHASE_BOUNDARIES.horizontalEnd) / 
                           (PHASE_BOUNDARIES.outroScaleEnd - PHASE_BOUNDARIES.horizontalEnd);
      return SCALE.normal + phaseProgress * (SCALE.full - SCALE.normal);
    }
    
    // Phase 4: 保持全屏
    if (progress < PHASE_BOUNDARIES.pauseEnd) return SCALE.full;
    
    // Phase 5: 缩小回正常（为循环准备）
    const phaseProgress = (progress - PHASE_BOUNDARIES.pauseEnd) / 
                         (1 - PHASE_BOUNDARIES.pauseEnd);
    return SCALE.full - phaseProgress * (SCALE.full - SCALE.normal);
  });

  // -------------------------------------------------------------------------
  // 循环重置逻辑
  // -------------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (progress) => {
      // 检测是否到达末尾需要重置
      if (progress >= 0.99 && !isResettingRef.current && lastProgressRef.current < 0.99) {
        isResettingRef.current = true;
        
        // 延迟重置，让动画完成
        setTimeout(() => {
          const container = scrollContainerRef.current;
          if (container) {
            // 瞬间跳回顶部
            container.scrollTo({ top: 0, behavior: 'auto' });
          }
          
          // 短暂延迟后允许下一次重置
          setTimeout(() => {
            isResettingRef.current = false;
          }, 100);
        }, 200);
      }
      
      lastProgressRef.current = progress;
    });

    return () => unsubscribe();
  }, [scrollYProgress, scrollContainerRef]);

  return {
    x,
    introScale,
    outroScale,
    contentScale,
    contentOpacity,
    phase,
  };
}

// 导出常量供其他组件使用
export { PHASE_BOUNDARIES, SCALE };
