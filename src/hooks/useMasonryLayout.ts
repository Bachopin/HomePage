/**
 * 瀑布流布局计算 Hook
 * 
 * 基于中心横线的布局逻辑：
 * 1. 屏幕中心有一条隐形横线
 * 2. Intro 卡片 (2x2) 居中于横线，其边长/2 = 基准距离
 * 3. 1行高卡片：上边缘或下边缘距离横线 = 基准距离 + gap/2
 * 4. 2行高卡片：横线穿过卡片中心
 * 5. 排列顺序：Intro → Projects（按分类+Sort）→ Outro
 */

import { useMemo } from 'react';
import type { NotionItem } from '@/lib/notion';
import {
  getLayoutConfig,
  getCardPixelDimensions,
} from '@/lib/config';
import type { CardSize, LayoutConfig } from '@/lib/config';

// ============================================================================
// Types
// ============================================================================

export interface CardPosition {
  top: number;
  left: number;
  width: number;
  height: number;
  centerX: number;
}

export interface MasonryLayoutResult {
  cardPositions: CardPosition[];
  containerWidth: number;
  categoryTargetInfo: Record<string, { left: number; centerX: number }>;
  gridHeight: number;
}

export interface UseMasonryLayoutProps {
  items: NotionItem[];
  windowWidth: number;
  categories: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 获取安全的卡片尺寸
 */
function getSafeCardSize(size: string | undefined): CardSize {
  if (size && ['1x1', '1x2', '2x1', '2x2'].includes(size)) {
    return size as CardSize;
  }
  return '1x1';
}

/**
 * 计算卡片的垂直位置（top）
 * 
 * 基于中心横线的逻辑：
 * - 2行高卡片：横线穿过中心，top = centerLineY - height/2
 * - 1行高卡片：放在上方或下方
 *   - 上方：bottom = centerLineY - gap/2，所以 top = centerLineY - gap/2 - height
 *   - 下方：top = centerLineY + gap/2
 */
function calculateCardTop(
  rows: number,
  height: number,
  centerLineY: number,
  gap: number,
  placeAbove: boolean
): number {
  if (rows === 2) {
    // 2行高：横线穿过中心
    return centerLineY - height / 2;
  } else {
    // 1行高：上方或下方
    if (placeAbove) {
      return centerLineY - gap / 2 - height;
    } else {
      return centerLineY + gap / 2;
    }
  }
}

// ============================================================================
// Main Hook
// ============================================================================

export function useMasonryLayout({
  items,
  windowWidth,
}: UseMasonryLayoutProps): MasonryLayoutResult {
  return useMemo(() => {
    const positions: CardPosition[] = [];
    const categoryTargetInfo: Record<string, { left: number; centerX: number }> = {};

    // 防御：无效窗口宽度
    const safeWindowWidth = windowWidth > 0 ? windowWidth : 1920;
    const layout = getLayoutConfig(safeWindowWidth);
    const { gap } = layout;

    // 空数据早返回
    if (!items || !Array.isArray(items) || items.length === 0) {
      return {
        cardPositions: positions,
        categoryTargetInfo,
        containerWidth: 0,
        gridHeight: 0,
      };
    }

    // 计算 Intro 卡片尺寸（2x2），确定基准距离
    const introDims = getCardPixelDimensions('2x2', layout);
    const baseDistance = introDims.height / 2; // 基准距离 = 2x2卡片边长的一半
    
    // 中心横线的 Y 坐标（相对于容器顶部）
    // 容器高度 = 2x2卡片高度（因为最大就是2行）
    const gridHeight = introDims.height;
    const centerLineY = gridHeight / 2;

    // 当前 X 位置（从左到右排列）
    let currentX = 0;
    
    // Intro 卡片居中显示，左边距 = (屏幕宽度 - 卡片宽度) / 2
    const introPaddingLeft = (safeWindowWidth - introDims.width) / 2;
    currentX = introPaddingLeft;

    // 用于追踪上一列的占用情况，决定1行高卡片放上还是下
    let lastColumnTopUsed = false;
    let lastColumnBottomUsed = false;

    // 记录每个分类中 Sort 最小的卡片
    const categoryBestCard: Record<string, { sort: number; left: number; centerX: number }> = {};

    // 遍历所有卡片
    items.forEach((item, index) => {
      if (!item) return;

      const size = getSafeCardSize(item.size);
      const dims = getCardPixelDimensions(size, layout);
      const { rows, cols, width, height } = dims;

      let left: number;
      let top: number;

      if (item.type === 'intro') {
        // Intro：居中于屏幕中心
        left = introPaddingLeft;
        top = centerLineY - height / 2;
        currentX = left + width + gap;
        lastColumnTopUsed = true;
        lastColumnBottomUsed = true;
      } else if (item.type === 'outro') {
        // Outro：也是 2x2，居中
        left = currentX;
        top = centerLineY - height / 2;
        // Outro 后面不需要继续了
      } else {
        // Project 卡片
        if (rows === 2) {
          // 2行高卡片：占满整列，横线穿过中心
          left = currentX;
          top = calculateCardTop(rows, height, centerLineY, gap, false);
          currentX = left + width + gap;
          lastColumnTopUsed = true;
          lastColumnBottomUsed = true;
        } else {
          // 1行高卡片：需要决定放上还是下
          if (!lastColumnTopUsed) {
            // 上方空闲，放上方
            left = currentX;
            top = calculateCardTop(rows, height, centerLineY, gap, true);
            lastColumnTopUsed = true;
            
            // 如果是2列宽，下方也被占用
            if (cols === 2) {
              lastColumnBottomUsed = true;
              currentX = left + width + gap;
            }
          } else if (!lastColumnBottomUsed) {
            // 下方空闲，放下方
            left = currentX;
            top = calculateCardTop(rows, height, centerLineY, gap, false);
            lastColumnBottomUsed = true;
            
            // 如果是2列宽，上方也被占用
            if (cols === 2) {
              lastColumnTopUsed = true;
              currentX = left + width + gap;
            }
          } else {
            // 当前列已满，移到下一列
            currentX = currentX; // 已经在上一个卡片处理时移动了
            left = currentX;
            top = calculateCardTop(rows, height, centerLineY, gap, true);
            lastColumnTopUsed = true;
            lastColumnBottomUsed = false;
            
            if (cols === 2) {
              lastColumnBottomUsed = true;
              currentX = left + width + gap;
            }
          }
          
          // 如果上下都用了，移动到下一列
          if (lastColumnTopUsed && lastColumnBottomUsed) {
            currentX = left + width + gap;
            lastColumnTopUsed = false;
            lastColumnBottomUsed = false;
          }
        }

        // 记录分类目标卡片
        if (item.category && typeof item.category === 'string') {
          const category = item.category.trim();
          if (category) {
            const sort = item.sort;
            if (typeof sort === 'number' && !isNaN(sort) && isFinite(sort) && sort > 0) {
              const current = categoryBestCard[category];
              if (!current || sort < current.sort) {
                categoryBestCard[category] = {
                  sort,
                  left,
                  centerX: left + width / 2,
                };
              }
            }
          }
        }
      }

      positions[index] = {
        top,
        left,
        width,
        height,
        centerX: left + width / 2,
      };
    });

    // 设置分类目标信息
    Object.keys(categoryBestCard).forEach(category => {
      const best = categoryBestCard[category];
      categoryTargetInfo[category] = {
        left: best.left,
        centerX: best.centerX,
      };
    });

    // 计算容器总宽度
    let containerWidth = 0;
    positions.forEach(pos => {
      if (pos) {
        const rightEdge = pos.left + pos.width;
        if (rightEdge > containerWidth) {
          containerWidth = rightEdge;
        }
      }
    });
    
    // 加上右边距（让 Outro 能居中）
    const outroPaddingRight = (safeWindowWidth - introDims.width) / 2;
    containerWidth += outroPaddingRight;

    return {
      cardPositions: positions,
      categoryTargetInfo,
      containerWidth,
      gridHeight,
    };
  }, [items, windowWidth]);
}
