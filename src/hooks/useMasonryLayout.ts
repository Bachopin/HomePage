/**
 * 瀑布流布局计算 Hook
 * 
 * 基于中心横线的布局逻辑：
 * 1. 屏幕中心有一条隐形横线
 * 2. Intro 卡片 (2x2) 居中于横线，其边长/2 = 基准距离
 * 3. 1行高卡片：上边缘或下边缘距离横线 = 基准距离 + gap/2
 * 4. 2行高卡片：横线穿过卡片中心
 * 5. 排列顺序：Intro → Projects（按分类+Sort）→ Outro
 * 
 * 智能填坑算法：
 * - 普通卡片：从第 0 列开始找空位（全局填坑）
 * - Outro 卡片：从当前最右侧列开始找空位（受限填坑，保持队尾性质）
 */

import { useMemo } from 'react';
import type { NotionItem } from '@/lib/notion';
import { getLayoutConfig, getCardPixelDimensions } from '@/lib/config';
import type { CardSize } from '@/lib/config';

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
// Grid Occupancy Manager - 网格占用管理器
// ============================================================================

/**
 * 管理 2D 网格的占用状态，支持智能填坑算法
 */
class GridOccupancyManager {
  // 使用 Set 存储已占用的格子，key 格式: "row,col"
  private occupied: Set<string> = new Set();
  // 追踪当前最大列索引
  private _maxColumn: number = -1;

  /**
   * 获取当前最大列索引
   */
  get maxColumn(): number {
    return this._maxColumn;
  }

  /**
   * 检查指定位置是否可以放置指定尺寸的卡片
   */
  canPlace(startRow: number, startCol: number, rows: number, cols: number): boolean {
    // 检查是否超出行边界（固定 2 行）
    if (startRow < 0 || startRow + rows > 2) {
      return false;
    }
    if (startCol < 0) {
      return false;
    }

    // 检查所有需要占用的格子是否都空闲
    for (let r = startRow; r < startRow + rows; r++) {
      for (let c = startCol; c < startCol + cols; c++) {
        if (this.occupied.has(`${r},${c}`)) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * 标记指定区域为已占用
   */
  markOccupied(startRow: number, startCol: number, rows: number, cols: number): void {
    for (let r = startRow; r < startRow + rows; r++) {
      for (let c = startCol; c < startCol + cols; c++) {
        this.occupied.add(`${r},${c}`);
        // 更新最大列索引
        if (c > this._maxColumn) {
          this._maxColumn = c;
        }
      }
    }
  }

  /**
   * 查找第一个可用位置
   * @param rows 需要的行数
   * @param cols 需要的列数
   * @param startColIndex 开始搜索的列索引（用于 Outro 的受限填坑）
   * @returns 可用位置的 { row, col }
   */
  findFirstAvailablePosition(
    rows: number,
    cols: number,
    startColIndex: number = 0
  ): { row: number; col: number } {
    // 搜索范围：从 startColIndex 到 maxColumn + 1（允许扩展到新列）
    const searchEndCol = Math.max(this._maxColumn + 1, startColIndex);
    
    for (let col = startColIndex; col <= searchEndCol + 1; col++) {
      for (let row = 0; row <= 2 - rows; row++) {
        if (this.canPlace(row, col, rows, cols)) {
          return { row, col };
        }
      }
    }
    
    // 如果都找不到，返回新的一列
    return { row: 0, col: this._maxColumn + 1 };
  }
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
 *   - row=0 (上方)：bottom = centerLineY - gap/2，所以 top = centerLineY - gap/2 - height
 *   - row=1 (下方)：top = centerLineY + gap/2
 */
function calculateCardTop(
  gridRow: number,
  rows: number,
  height: number,
  centerLineY: number,
  gap: number
): number {
  if (rows === 2) {
    // 2行高：横线穿过中心
    return centerLineY - height / 2;
  } else {
    // 1行高：根据 gridRow 决定上方或下方
    if (gridRow === 0) {
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
    const { columnWidth, gap } = layout;

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
    
    // 中心横线的 Y 坐标（相对于容器顶部）
    // 容器高度 = 2x2卡片高度（因为最大就是2行）
    const gridHeight = introDims.height;
    const centerLineY = gridHeight / 2;

    // Intro 卡片居中显示，左边距 = (屏幕宽度 - 卡片宽度) / 2
    const introPaddingLeft = (safeWindowWidth - introDims.width) / 2;

    // 初始化网格管理器
    const gridManager = new GridOccupancyManager();

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
      let startRow: number;
      let startCol: number;

      if (item.type === 'intro') {
        // Intro：居中于屏幕中心，占据 grid 的 (0,0) 位置
        startRow = 0;
        startCol = 0;
        gridManager.markOccupied(startRow, startCol, rows, cols);
        
        left = introPaddingLeft;
        top = centerLineY - height / 2;
      } else if (item.type === 'outro') {
        // Outro：受限智能填坑 - 从当前最右侧列开始搜索
        const searchStartCol = Math.max(0, gridManager.maxColumn);
        const pos = gridManager.findFirstAvailablePosition(rows, cols, searchStartCol);
        startRow = pos.row;
        startCol = pos.col;
        gridManager.markOccupied(startRow, startCol, rows, cols);
        
        // 计算像素位置
        left = introPaddingLeft + startCol * (columnWidth + gap);
        top = calculateCardTop(startRow, rows, height, centerLineY, gap);
      } else {
        // Project 卡片：全局智能填坑 - 从第 0 列开始搜索
        const pos = gridManager.findFirstAvailablePosition(rows, cols, 0);
        startRow = pos.row;
        startCol = pos.col;
        gridManager.markOccupied(startRow, startCol, rows, cols);
        
        // 计算像素位置
        left = introPaddingLeft + startCol * (columnWidth + gap);
        top = calculateCardTop(startRow, rows, height, centerLineY, gap);

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
