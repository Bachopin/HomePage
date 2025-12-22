/**
 * 全局配置中心 - Single Source of Truth
 * 
 * 所有布局、动画、响应式断点的常量定义
 * 任何组件和 Hook 都应从此处引入配置，禁止硬编码魔术数字
 */

// ============================================================================
// Types
// ============================================================================

export interface BreakpointConfig {
  /** 移动端断点阈值 (px) */
  mobile: number;
  /** 平板断点阈值 (px) */
  tablet: number;
  /** 桌面断点阈值 (px) */
  desktop: number;
}

export interface LayoutConfig {
  /** 列宽 (px) */
  columnWidth: number;
  /** 行高 (px) - 通常等于列宽保持正方形 */
  rowHeight: number;
  /** 网格间距 (px) */
  gap: number;
  /** 最小内边距 (px) */
  minPadding: number;
}

export interface CardSizeDefinition {
  /** 占用行数 */
  rows: number;
  /** 占用列数 */
  cols: number;
}

export interface CardSizeConfig {
  '1x1': CardSizeDefinition;
  '1x2': CardSizeDefinition;
  '2x1': CardSizeDefinition;
  '2x2': CardSizeDefinition;
}

export type CardSize = keyof CardSizeConfig;

export interface SpringConfig {
  /** 弹簧刚度 */
  stiffness: number;
  /** 阻尼系数 */
  damping: number;
}

export interface AnimationConfig {
  /** 图片缩放比例 */
  imageScale: number;
  /** 视差安全系数 (0-1)，用于防止图片边缘露白 */
  parallaxSafetyFactor: number;
  /** 卡片悬停缩放 */
  cardHoverScale: number;
  /** 悬停动画时长 (秒) */
  hoverDuration: number;
  /** 主弹簧配置 */
  spring: SpringConfig;
  /** 缩放动画弹簧配置 */
  scaleSpring: SpringConfig;
}

export interface ScrollConfig {
  /** 缩放动画结束的滚动进度点 */
  scaleEndProgress: number;
  /** 水平滚动开始的进度点 */
  horizontalScrollStartProgress: number;
  /** 滚动末尾检测阈值 (px) */
  endThreshold: number;
}

export interface GridConfig {
  /** 网格行数 */
  rows: number;
}

// ============================================================================
// Breakpoints - 响应式断点
// ============================================================================

export const BREAKPOINTS: BreakpointConfig = {
  mobile: 640,
  tablet: 768,
  desktop: 1024,
} as const;

// ============================================================================
// Layout - 布局配置
// ============================================================================

export const LAYOUT_DESKTOP: LayoutConfig = {
  columnWidth: 300,
  rowHeight: 300,
  gap: 24,
  minPadding: 24,
} as const;

export const LAYOUT_MOBILE: LayoutConfig = {
  columnWidth: 0, // 动态计算: (windowWidth - gap) / 2
  rowHeight: 0,   // 动态计算: 等于 columnWidth
  gap: 24,
  minPadding: 16,
} as const;

/**
 * 根据窗口宽度获取布局配置
 */
export function getLayoutConfig(windowWidth: number): LayoutConfig {
  const isMobile = windowWidth < BREAKPOINTS.mobile;
  
  if (isMobile) {
    const gap = LAYOUT_MOBILE.gap;
    const columnWidth = (windowWidth - gap) / 2;
    return {
      columnWidth,
      rowHeight: columnWidth,
      gap,
      minPadding: LAYOUT_MOBILE.minPadding,
    };
  }
  
  return LAYOUT_DESKTOP;
}

// ============================================================================
// Grid - 卡片尺寸定义
// ============================================================================

export const CARD_SIZES: CardSizeConfig = {
  '1x1': { rows: 1, cols: 1 },
  '1x2': { rows: 2, cols: 1 },
  '2x1': { rows: 1, cols: 2 },
  '2x2': { rows: 2, cols: 2 },
} as const;

export const GRID: GridConfig = {
  rows: 2,
} as const;

/**
 * 计算卡片像素尺寸
 */
export interface CardPixelDimensions {
  rows: number;
  cols: number;
  width: number;
  height: number;
}

export function getCardPixelDimensions(
  size: CardSize,
  layout: LayoutConfig
): CardPixelDimensions {
  const { columnWidth, rowHeight, gap } = layout;
  const sizeConfig = CARD_SIZES[size];
  
  return {
    rows: sizeConfig.rows,
    cols: sizeConfig.cols,
    width: sizeConfig.cols === 1 ? columnWidth : columnWidth * 2 + gap,
    height: sizeConfig.rows === 1 ? rowHeight : rowHeight * 2 + gap,
  };
}

// ============================================================================
// Animation - 动画配置
// ============================================================================

export const ANIMATION: AnimationConfig = {
  imageScale: 1.15,
  parallaxSafetyFactor: 0.7,
  cardHoverScale: 1.02,
  hoverDuration: 0.2,
  spring: {
    stiffness: 400,
    damping: 40,
  },
  scaleSpring: {
    stiffness: 400,
    damping: 40,
  },
} as const;

// ============================================================================
// Scroll - 滚动配置
// ============================================================================

export const SCROLL: ScrollConfig = {
  scaleEndProgress: 0.05,
  horizontalScrollStartProgress: 0.05,
  endThreshold: 50,
} as const;

// ============================================================================
// UI Constants - UI 常量
// ============================================================================

export const UI = {
  /** 卡片圆角 (px) */
  cardBorderRadius: 32,
  /** 卡片内边距 (px) */
  cardPadding: 24,
  /** 图标按钮内边距 (px) */
  iconButtonPadding: 8,
  /** 图标尺寸 (px) */
  iconSize: 16,
} as const;

// ============================================================================
// Default Values - 默认值
// ============================================================================

export const DEFAULTS = {
  /** 默认窗口宽度 (SSR) */
  windowWidth: 1920,
  /** 默认窗口高度 (SSR) */
  windowHeight: 1080,
  /** 默认分类列表 */
  categories: ['All', 'Work', 'Lab', 'Life'] as const,
} as const;

// ============================================================================
// SEO Metadata - SEO 元数据配置
// ============================================================================

export interface MetadataConfig {
  title: string;
  description: string;
  keywords: string[];
  author: string;
  siteUrl: string;
  openGraph: {
    type: string;
    locale: string;
    siteName: string;
  };
  twitter: {
    card: string;
  };
}

export const METADATA: MetadataConfig = {
  title: 'Personal Homepage',
  description: 'Developer and product designer portfolio showcasing creative works, projects, and experiments.',
  keywords: [
    'portfolio',
    'developer',
    'designer',
    'creative',
    'projects',
    'web development',
    'product design',
  ],
  author: 'Bachopin',
  siteUrl: 'https://bachopin.com',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: 'Personal Homepage',
  },
  twitter: {
    card: 'summary_large_image',
  },
} as const;
