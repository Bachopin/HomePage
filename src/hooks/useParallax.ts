/**
 * 视差物理引擎 Hook
 * 
 * 职责：
 * 1. 根据图片和卡片的几何关系计算视差方向
 * 2. 根据滚动进度计算视差位移
 * 3. 返回可直接绑定到 motion 组件的样式值
 */

import { useMemo } from 'react';
import type { MotionValue } from 'framer-motion';
import { useTransform, useMotionValue } from 'framer-motion';
import { ANIMATION } from '@/lib/config';

// ============================================================================
// Types
// ============================================================================

export interface ImageSize {
  w: number;
  h: number;
}

export interface CardDimensions {
  width: number;
  height: number;
}

export interface UseParallaxProps {
  /** 滚动进度 motion value (负值表示向左滚动) */
  scrollProgress?: MotionValue<number>;
  /** 图片原始尺寸 */
  imageSize: ImageSize | null;
  /** 卡片尺寸 */
  cardDimensions: CardDimensions;
  /** 卡片中心的绝对 X 坐标 */
  cardCenterX: number;
  /** 视口宽度 */
  viewportWidth: number;
}

export interface ParallaxGeometry {
  /** 最大偏移量 (px) */
  maxOffset: number;
  /** 是否水平移动 */
  isHorizontalMove: boolean;
  /** 初始偏移量 (px) */
  initialOffset: number;
}

export interface ParallaxResult {
  /** X 轴视差位移 */
  x: MotionValue<number>;
  /** Y 轴视差位移 */
  y: MotionValue<number>;
  /** 图片缩放比例 */
  scale: number;
  /** 是否水平移动 */
  isHorizontalMove: boolean;
  /** 几何计算结果 */
  geometry: ParallaxGeometry;
}

// ============================================================================
// Geometry Calculation
// ============================================================================

/**
 * 计算视差几何参数
 * 
 * 算法说明：
 * 1. 比较图片宽高比和卡片宽高比
 * 2. 如果图片更宽（imgRatio > cardRatio），则水平移动
 * 3. 如果图片更高（imgRatio < cardRatio），则垂直移动
 * 4. 计算缩放后图片超出卡片的部分作为可移动范围
 * 5. 应用安全系数防止边缘露白
 */
export function calculateParallaxGeometry(
  imageSize: ImageSize | null,
  cardDimensions: CardDimensions,
  imageScale: number = ANIMATION.imageScale,
  safetyFactor: number = ANIMATION.parallaxSafetyFactor
): ParallaxGeometry {
  // 无图片尺寸时返回零值
  if (!imageSize) {
    return { maxOffset: 0, isHorizontalMove: false, initialOffset: 0 };
  }

  const { width: cardW, height: cardH } = cardDimensions;
  const imgRatio = imageSize.w / imageSize.h;
  const cardRatio = cardW / cardH;

  // 判断移动方向
  const isHorizontalMove = imgRatio > cardRatio;

  let maxOffset = 0;

  if (isHorizontalMove) {
    // 图片填满高度，计算缩放后的宽度
    const renderedImgWidth = cardH * imgRatio * imageScale;
    const totalOverflow = renderedImgWidth - cardW;
    maxOffset = totalOverflow / 2;
  } else if (imgRatio < cardRatio) {
    // 图片填满宽度，计算缩放后的高度
    const renderedImgHeight = (cardW / imgRatio) * imageScale;
    const totalOverflow = renderedImgHeight - cardH;
    maxOffset = totalOverflow / 2;
  } else {
    // 宽高比完全匹配，无需移动
    return { maxOffset: 0, isHorizontalMove: false, initialOffset: 0 };
  }

  // 应用安全系数
  const safeLimit = Math.max(0, maxOffset * safetyFactor);

  return {
    maxOffset: safeLimit,
    isHorizontalMove,
    initialOffset: isHorizontalMove ? safeLimit : -safeLimit, // 水平移动时从右侧开始，垂直移动时从底部开始
  };
}

// ============================================================================
// Parallax Transform
// ============================================================================

/**
 * 计算视差位移
 * 
 * 算法说明：
 * 1. 只有当卡片中心越过视口中心后才开始视差效果
 * 2. 使用卡片宽度作为视差效果的完整范围
 * 3. 水平移动：图片从右侧位置向左移动
 * 4. 垂直移动：图片从底部位置向上移动
 */
function calculateParallaxOffset(
  scrollValue: number,
  cardCenterX: number,
  cardWidth: number,
  viewportCenter: number,
  geometry: ParallaxGeometry
): number {
  const { maxOffset, initialOffset, isHorizontalMove } = geometry;

  // 无滚动或无偏移量时返回初始位置
  if (scrollValue >= 0 || maxOffset === 0) {
    return initialOffset;
  }

  // 计算卡片当前位置
  const cardCurrentX = cardCenterX + scrollValue;

  // 卡片中心未越过视口中心时保持初始位置
  if (cardCurrentX >= viewportCenter) {
    return initialOffset;
  }

  // 计算越过中心的距离
  const distancePastCenter = viewportCenter - cardCurrentX;
  // 使用卡片宽度作为视差范围
  const progress = Math.min(distancePastCenter / cardWidth, 1);

  if (isHorizontalMove) {
    // 水平移动：从 +maxOffset 向左移动到 -maxOffset
    const movement = initialOffset - progress * (2 * maxOffset);
    return Math.max(Math.min(movement, initialOffset), -maxOffset);
  } else {
    // 垂直移动：从 -maxOffset 向上移动到 +maxOffset
    const movement = initialOffset + progress * (2 * maxOffset);
    return Math.min(Math.max(movement, initialOffset), maxOffset);
  }
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 视差效果 Hook
 * 
 * @param props 视差参数
 * @returns 可绑定到 motion 组件的视差值
 */
export function useParallax({
  scrollProgress,
  imageSize,
  cardDimensions,
  cardCenterX,
  viewportWidth,
}: UseParallaxProps): ParallaxResult {
  // 计算几何参数（memoized）
  const geometry = useMemo(
    () => calculateParallaxGeometry(imageSize, cardDimensions),
    [imageSize, cardDimensions]
  );

  // 默认 motion value（无滚动时使用）
  const defaultScrollProgress = useMotionValue(0);
  const scrollMotionValue = scrollProgress || defaultScrollProgress;

  // 视口中心
  const viewportCenter = viewportWidth / 2;

  // X 轴视差（水平移动）
  const parallaxX = useTransform(scrollMotionValue, (latest) => {
    if (!scrollProgress || !geometry.isHorizontalMove) {
      return geometry.initialOffset;
    }
    return calculateParallaxOffset(
      latest,
      cardCenterX,
      cardDimensions.width,
      viewportCenter,
      geometry
    );
  });

  // Y 轴视差（垂直移动）
  const parallaxY = useTransform(scrollMotionValue, (latest) => {
    if (!scrollProgress || geometry.isHorizontalMove) {
      return geometry.initialOffset;
    }
    return calculateParallaxOffset(
      latest,
      cardCenterX,
      cardDimensions.width,
      viewportCenter,
      geometry
    );
  });

  return {
    x: parallaxX,
    y: parallaxY,
    scale: ANIMATION.imageScale,
    isHorizontalMove: geometry.isHorizontalMove,
    geometry,
  };
}
