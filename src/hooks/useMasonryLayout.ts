/**
 * 瀑布流布局计算 Hook
 * 
 * 职责：
 * 1. 计算每张卡片的绝对位置（top, left, width, height）
 * 2. 计算容器总宽度
 * 3. 记录每个分类的起始 X 坐标
 * 4. 计算网格高度
 * 
 * 所有布局常量从 lib/config.ts 引入，禁止硬编码
 */

import { useMemo } from 'react';
import type { NotionItem } from '@/lib/notion';
import {
  getLayoutConfig,
  getCardPixelDimensions,
  GRID,
} from '@/lib/config';
import type { CardSize, LayoutConfig, CardPixelDimensions } from '@/lib/config';

// ============================================================================
// Types
// ============================================================================

/**
 * 卡片位置信息
 */
export interface CardPosition {
  top: number;
  left: number;
  width: number;
  height: number;
  centerX: number;
}

/**
 * 布局计算结果
 */
export interface MasonryLayoutResult {
  /** 每张卡片的绝对位置 */
  cardPositions: CardPosition[];
  /** 容器总宽度 */
  containerWidth: number;
  /** 每个分类的目标卡片信息（left: 左边缘, centerX: 中心） */
  categoryTargetInfo: Record<string, { left: number; centerX: number }>;
  /** 网格高度（两行 + 间距） */
  gridHeight: number;
}

/**
 * Hook 输入参数
 */
export interface UseMasonryLayoutProps {
  items: NotionItem[];
  windowWidth: number;
  categories: string[];
}

// ============================================================================
// Grid Occupancy Manager
// ============================================================================

/**
 * 网格占用管理器
 * 
 * 管理二维网格的占用状态，支持查找可用位置和标记占用
 */
class GridOccupancyManager {
  private occupied: boolean[][];
  private maxColumn: number = -1;
  private maxRows: number;

  constructor(maxRows: number) {
    this.maxRows = maxRows;
    this.occupied = [];
    for (let i = 0; i < maxRows; i++) {
      this.occupied.push([]);
    }
  }

  /**
   * 检查指定位置是否可以放置卡片
   */
  canFit(startRow: number, startCol: number, rows: number, cols: number): boolean {
    if (startRow + rows > this.maxRows) return false;

    for (let r = startRow; r < startRow + rows; r++) {
      for (let c = startCol; c < startCol + cols; c++) {
        if (this.occupied[r][c] === true) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * 标记单元格为已占用
   */
  markOccupied(startRow: number, startCol: number, rows: number, cols: number): void {
    for (let r = startRow; r < startRow + rows; r++) {
      for (let c = startCol; c < startCol + cols; c++) {
        this.occupied[r][c] = true;
      }
    }
    this.maxColumn = Math.max(this.maxColumn, startCol + cols - 1);
  }

  /**
   * 查找第一个可用位置
   */
  findFirstAvailablePosition(
    rows: number,
    cols: number
  ): { row: number; col: number } {
    for (let col = 0; col <= Math.max(this.maxColumn + 1, 0); col++) {
      for (let row = 0; row <= this.maxRows - rows; row++) {
        if (this.canFit(row, col, rows, cols)) {
          return { row, col };
        }
      }
    }
    // 如果没找到，放在最右边新列
    return { row: 0, col: this.maxColumn + 1 };
  }

  getMaxColumn(): number {
    return this.maxColumn;
  }
}

// ============================================================================
// Layout Calculation Helpers
// ============================================================================

/**
 * 计算非对称内边距
 * 
 * 首尾卡片居中显示，确保视觉平衡
 */
function calculateAsymmetricPadding(
  windowWidth: number,
  firstItemDims: CardPixelDimensions,
  lastItemDims: CardPixelDimensions,
  minPadding: number
): { paddingLeft: number; paddingRight: number } {
  const paddingLeft = Math.max(0, (windowWidth - firstItemDims.width) / 2);
  const paddingRight = Math.max(minPadding, (windowWidth - lastItemDims.width) / 2);
  
  return { paddingLeft, paddingRight };
}

/**
 * 计算卡片绝对位置
 */
function calculateCardPosition(
  startRow: number,
  startCol: number,
  dims: CardPixelDimensions,
  paddingLeft: number,
  layout: LayoutConfig
): CardPosition {
  const { columnWidth, rowHeight, gap } = layout;
  
  const left = paddingLeft + startCol * (columnWidth + gap);
  const top = startRow * (rowHeight + gap);
  const centerX = left + dims.width / 2;

  return {
    top,
    left,
    width: dims.width,
    height: dims.height,
    centerX,
  };
}

/**
 * 计算容器总宽度
 */
function calculateContainerWidth(
  positions: CardPosition[],
  paddingRight: number
): number {
  let maxContentRightEdge = 0;
  
  positions.forEach(pos => {
    if (pos) {
      const rightEdge = pos.left + pos.width;
      if (rightEdge > maxContentRightEdge) {
        maxContentRightEdge = rightEdge;
      }
    }
  });
  
  return maxContentRightEdge + paddingRight;
}

/**
 * 计算网格高度
 */
function calculateGridHeight(layout: LayoutConfig): number {
  const { rowHeight, gap } = layout;
  return rowHeight * GRID.rows + gap;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * 瀑布流布局计算 Hook
 */
export function useMasonryLayout({
  items,
  windowWidth,
}: UseMasonryLayoutProps): MasonryLayoutResult {
  return useMemo(() => {
    const positions: CardPosition[] = [];
    // 每个分类的目标卡片信息：{ left: 左边缘, centerX: 中心 }
    const categoryTargetInfo: Record<string, { left: number; centerX: number }> = {};

    // 防御：无效窗口宽度
    const safeWindowWidth = windowWidth > 0 ? windowWidth : 1920;
    
    // 获取响应式布局配置
    const layout = getLayoutConfig(safeWindowWidth);

    // 空数据早返回
    if (!items || !Array.isArray(items) || items.length === 0) {
      return {
        cardPositions: positions,
        categoryTargetInfo,
        containerWidth: 0,
        gridHeight: calculateGridHeight(layout),
      };
    }

    // 计算首尾卡片尺寸（带防御）
    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    const firstSize = (firstItem?.size && ['1x1', '1x2', '2x1', '2x2'].includes(firstItem.size)) 
      ? firstItem.size as CardSize 
      : '1x1';
    const lastSize = (lastItem?.size && ['1x1', '1x2', '2x1', '2x2'].includes(lastItem.size)) 
      ? lastItem.size as CardSize 
      : '1x1';
    
    const firstDims = getCardPixelDimensions(firstSize, layout);
    const lastDims = getCardPixelDimensions(lastSize, layout);

    // 计算非对称内边距
    const { paddingLeft, paddingRight } = calculateAsymmetricPadding(
      windowWidth,
      firstDims,
      lastDims,
      layout.minPadding
    );

    // 网格占用管理器
    const gridManager = new GridOccupancyManager(GRID.rows);

    // 记录每个分类中 Sort 值最小的卡片（Sort 必须存在且 > 0）
    const categoryBestCard: Record<string, { sort: number; left: number; centerX: number }> = {};

    // 放置每张卡片
    items.forEach((item, index) => {
      // 防御：无效 item
      if (!item) return;
      
      // 防御：无效 size，使用默认值
      const size = (item.size && ['1x1', '1x2', '2x1', '2x2'].includes(item.size)) 
        ? item.size as CardSize 
        : '1x1';

      const dims = getCardPixelDimensions(size, layout);
      const { row: startRow, col: startCol } = gridManager.findFirstAvailablePosition(
        dims.rows,
        dims.cols
      );

      gridManager.markOccupied(startRow, startCol, dims.rows, dims.cols);

      const position = calculateCardPosition(startRow, startCol, dims, paddingLeft, layout);
      positions[index] = position;

      // 只处理 project 类型且有分类的卡片
      if (item.type === 'project' && item.category && typeof item.category === 'string') {
        const category = item.category.trim();
        if (!category) return;

        const sort = item.sort;
        // Sort 必须是有效数字且 > 0
        if (typeof sort === 'number' && !isNaN(sort) && isFinite(sort) && sort > 0) {
          const current = categoryBestCard[category];
          if (!current || sort < current.sort) {
            categoryBestCard[category] = {
              sort,
              left: position.left,
              centerX: position.centerX,
            };
          }
        }
      }
    });

    // 将最佳卡片信息转换为目标信息
    Object.keys(categoryBestCard).forEach(category => {
      const best = categoryBestCard[category];
      categoryTargetInfo[category] = {
        left: best.left,
        centerX: best.centerX,
      };
    });

    // 计算容器宽度和网格高度
    const containerWidth = calculateContainerWidth(positions, paddingRight);
    const gridHeight = calculateGridHeight(layout);

    return {
      cardPositions: positions,
      categoryTargetInfo,
      containerWidth,
      gridHeight,
    };
  }, [items, windowWidth]);
}
