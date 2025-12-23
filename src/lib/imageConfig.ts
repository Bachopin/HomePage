/**
 * 图片优化配置
 * 
 * 控制图片加载和优化策略
 */

export interface ImageOptimizationConfig {
  // 是否启用图片优化
  enableOptimization: boolean;
  
  // 加载策略
  strategy: 'progressive' | 'optimized-only' | 'original-only';
  
  // 预加载设置
  preload: {
    enabled: boolean;
    count: number; // 预加载图片数量
    priority: 'high' | 'low';
  };
  
  // 质量设置
  quality: {
    thumbnail: number;
    medium: number;
    large: number;
  };
  
  // 开发模式设置
  development: {
    showOptimizationStatus: boolean;
    logPerformance: boolean;
  };
}

// 默认配置
export const DEFAULT_IMAGE_CONFIG: ImageOptimizationConfig = {
  enableOptimization: true,
  strategy: 'progressive', // 渐进式：先显示原图，后台加载优化图片
  
  preload: {
    enabled: true,
    count: 6,
    priority: 'high',
  },
  
  quality: {
    thumbnail: 80,
    medium: 88,
    large: 92,
  },
  
  development: {
    showOptimizationStatus: true,
    logPerformance: false,
  },
};

// 不同策略的配置
export const IMAGE_STRATEGIES = {
  // 渐进式加载：先显示 Notion 原图，后台加载优化图片并平滑切换
  progressive: {
    ...DEFAULT_IMAGE_CONFIG,
    strategy: 'progressive' as const,
    enableOptimization: true,
  },
  
  // 仅优化图片：只使用服务器优化后的图片，如果没有则降级到原图
  'optimized-only': {
    ...DEFAULT_IMAGE_CONFIG,
    strategy: 'optimized-only' as const,
    enableOptimization: true,
  },
  
  // 仅原图：直接使用 Notion 原图，不进行任何优化
  'original-only': {
    ...DEFAULT_IMAGE_CONFIG,
    strategy: 'original-only' as const,
    enableOptimization: false,
  },
} as const;

// 根据环境获取配置
export function getImageConfig(): ImageOptimizationConfig {
  // 生产环境：使用渐进式策略
  if (process.env.NODE_ENV === 'production') {
    return IMAGE_STRATEGIES.progressive;
  }
  
  // 开发环境：根据环境变量决定
  const strategy = process.env.NEXT_PUBLIC_IMAGE_STRATEGY as keyof typeof IMAGE_STRATEGIES;
  
  if (strategy && IMAGE_STRATEGIES[strategy]) {
    return IMAGE_STRATEGIES[strategy];
  }
  
  // 默认使用渐进式策略
  return IMAGE_STRATEGIES.progressive;
}

// 性能监控
export function logImagePerformance(
  imageUrl: string, 
  loadTime: number, 
  isOptimized: boolean,
  fileSize?: number
) {
  if (!DEFAULT_IMAGE_CONFIG.development.logPerformance) return;
  
  console.log(`🖼️ Image Performance:`, {
    url: imageUrl.substring(0, 50) + '...',
    loadTime: `${loadTime}ms`,
    isOptimized,
    fileSize: fileSize ? `${Math.round(fileSize / 1024)}KB` : 'unknown',
    timestamp: new Date().toISOString(),
  });
}