import { useMemo } from 'react';
import { NotionItem } from '@/lib/notion';

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
  /** 每个分类的起始 X 坐标 */
  categoryStartX: Record<string, number>;
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

/**
 * 获取卡片在网格中的尺寸
 */
interface CardDimensions {
  rows: number;
  cols: number;
  width: number;
  height: number;
}

function getCardDimensions(
  size: string,
  columnWidth: number,
  rowHeight: number,
  gap: number
): CardDimensions {
  switch (size) {
    case '1x1':
      return { rows: 1, cols: 1, width: columnWidth, height: rowHeight };
    case '1x2':
      return { rows: 2, cols: 1, width: columnWidth, height: rowHeight * 2 + gap };
    case '2x1':
      return { rows: 1, cols: 2, width: columnWidth * 2 + gap, height: rowHeight };
    case '2x2':
      return { rows: 2, cols: 2, width: columnWidth * 2 + gap, height: rowHeight * 2 + gap };
    default:
      return { rows: 1, cols: 1, width: columnWidth, height: rowHeight };
  }
}

/**
 * 网格占用管理器
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

/**
 * 瀑布流布局计算 Hook
 * 
 * 职责：
 * 1. 计算每张卡片的绝对位置（top, left, width, height）
 * 2. 计算容器总宽度
 * 3. 记录每个分类的起始 X 坐标
 * 4. 计算网格高度
 */
export function useMasonryLayout({
  items,
  windowWidth,
  categories,
}: UseMasonryLayoutProps): MasonryLayoutResult {
  return useMemo(() => {
    const positions: CardPosition[] = [];
    const categoryStarts: Record<string, number> = {};
    const gap = 24; // 1.5rem

    // 响应式布局
    const isMobile = windowWidth < 640;
    const columnWidth = isMobile ? (windowWidth - gap) / 2 : 300;
    const rowHeight = columnWidth; // 保持正方形网格单元

    // 空数据早返回
    if (!items || items.length === 0) {
      return {
        cardPositions: positions,
        categoryStartX: categoryStarts,
        containerWidth: 0,
        gridHeight: rowHeight * 2 + gap,
      };
    }

    // 计算首尾卡片宽度，用于非对称内边距
    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    const firstDims = getCardDimensions(firstItem?.size || '1x1', columnWidth, rowHeight, gap);
    const lastDims = getCardDimensions(lastItem?.size || '1x1', columnWidth, rowHeight, gap);

    // 非对称内边距：首尾卡片居中
    const paddingLeft = Math.max(0, (windowWidth - firstDims.width) / 2);
    const paddingRight = Math.max(24, (windowWidth - lastDims.width) / 2);

    // 网格占用管理器（2 行）
    const gridManager = new GridOccupancyManager(2);

    // 放置每张卡片
    items.forEach((item, index) => {
      if (!item || !item.size) {
        console.warn(`Item at index ${index} has invalid size:`, item);
        return;
      }

      const dims = getCardDimensions(item.size, columnWidth, rowHeight, gap);
      const { row: startRow, col: startCol } = gridManager.findFirstAvailablePosition(
        dims.rows,
        dims.cols
      );

      gridManager.markOccupied(startRow, startCol, dims.rows, dims.cols);

      // 计算绝对位置
      const left = paddingLeft + startCol * (columnWidth + gap);
      const top = startRow * (rowHeight + gap);
      const centerX = left + dims.width / 2;

      positions[index] = {
        top,
        left,
        width: dims.width,
        height: dims.height,
        centerX,
      };

      // 记录分类起始位置（每个分类第一张卡片的左边缘）
      if (item.type === 'project' && item.category) {
        if (categoryStarts[item.category] === undefined) {
          categoryStarts[item.category] = left;
        }
      }
    });

    // 计算容器宽度：最右边内容边缘 + 右内边距
    let maxContentRightEdge = 0;
    positions.forEach(pos => {
      const rightEdge = pos.left + pos.width;
      if (rightEdge > maxContentRightEdge) {
        maxContentRightEdge = rightEdge;
      }
    });
    const containerWidth = maxContentRightEdge + paddingRight;

    // 网格高度：两行 + 间距
    const gridHeight = rowHeight * 2 + gap;

    return {
      cardPositions: positions,
      categoryStartX: categoryStarts,
      containerWidth,
      gridHeight,
    };
  }, [items, windowWidth, categories]);
}
