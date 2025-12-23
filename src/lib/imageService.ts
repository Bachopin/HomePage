/**
 * 图片服务
 * 
 * 职责：
 * 1. 根据设备和网络条件选择最佳图片
 * 2. 提供 WebP/JPEG 格式回退
 * 3. 管理图片 URL 映射
 */

// ============================================================================
// Types
// ============================================================================

export interface OptimizedImageVersions {
  webp?: { path: string; size: number };
  jpeg?: { path: string; size: number };
}

export interface OptimizedImageSizes {
  thumbnail?: OptimizedImageVersions;
  medium?: OptimizedImageVersions;
  large?: OptimizedImageVersions;
}

export interface ImageMapping {
  id: string;
  title: string;
  originalUrl: string;
  optimized: OptimizedImageSizes;
}

export interface ImageServiceOptions {
  preferWebP?: boolean;
  devicePixelRatio?: number;
  viewportWidth?: number;
  connectionType?: 'slow' | 'fast' | 'unknown';
}

// ============================================================================
// 图片映射管理
// ============================================================================

let imageMapping: ImageMapping[] = [];
let mappingLoaded = false;

// 客户端缓存 key
const MAPPING_CACHE_KEY = 'image-mapping-cache';
const MAPPING_CACHE_VERSION = 'v1';

/**
 * 加载图片映射（带客户端缓存）
 */
async function loadImageMapping(): Promise<void> {
  if (mappingLoaded) return;
  
  try {
    // 在客户端环境中加载映射文件
    if (typeof window !== 'undefined') {
      // 尝试从 sessionStorage 读取缓存（同一会话内复用）
      try {
        const cached = sessionStorage.getItem(MAPPING_CACHE_KEY);
        if (cached) {
          const { version, data } = JSON.parse(cached);
          if (version === MAPPING_CACHE_VERSION && Array.isArray(data)) {
            imageMapping = data;
            mappingLoaded = true;
            return;
          }
        }
      } catch {
        // sessionStorage 不可用，继续 fetch
      }
      
      const response = await fetch('/images/optimized/image-mapping.json');
      if (response.ok) {
        imageMapping = await response.json();
        
        // 缓存到 sessionStorage
        try {
          sessionStorage.setItem(MAPPING_CACHE_KEY, JSON.stringify({
            version: MAPPING_CACHE_VERSION,
            data: imageMapping,
          }));
        } catch {
          // sessionStorage 写入失败，忽略
        }
      }
    } else {
      // 在服务端环境中加载映射文件
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');
      
      const mappingPath = path.join(process.cwd(), 'public', 'images', 'optimized', 'image-mapping.json');
      
      try {
        const data = await fs.readFile(mappingPath, 'utf-8');
        imageMapping = JSON.parse(data);
      } catch (error) {
        // 映射文件不存在，使用空数组
        imageMapping = [];
      }
    }
    
    mappingLoaded = true;
  } catch (error) {
    console.warn('Failed to load image mapping:', error);
    imageMapping = [];
    mappingLoaded = true;
  }
}

/**
 * 根据原始 URL 查找优化后的图片
 * 
 * 匹配策略：
 * 1. 优先通过 URL 中的文件路径匹配（去除签名参数）
 * 2. 如果 URL 包含 Notion 的 S3 路径，提取文件 ID 进行匹配
 */
function findOptimizedImage(originalUrl: string): ImageMapping | null {
  if (!originalUrl || imageMapping.length === 0) return null;
  
  // 提取 URL 的核心路径（去除查询参数）
  const getUrlPath = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch {
      // 如果 URL 解析失败，尝试简单分割
      return url.split('?')[0];
    }
  };
  
  const targetPath = getUrlPath(originalUrl);
  
  // 通过路径匹配
  const match = imageMapping.find(item => {
    const itemPath = getUrlPath(item.originalUrl);
    return itemPath === targetPath;
  });
  
  return match || null;
}



// ============================================================================
// 图片选择逻辑
// ============================================================================

/**
 * 检测浏览器是否支持 WebP
 */
function supportsWebP(): boolean {
  if (typeof window === 'undefined') return false;
  
  // 检查 canvas 支持
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

/**
 * 根据视口宽度选择合适的尺寸
 */
function selectImageSize(viewportWidth: number, devicePixelRatio: number = 1): keyof OptimizedImageSizes {
  const effectiveWidth = viewportWidth * devicePixelRatio;
  
  if (effectiveWidth <= 400) return 'thumbnail';
  if (effectiveWidth <= 1000) return 'medium';
  return 'large';
}

/**
 * 选择最佳格式
 */
function selectImageFormat(
  versions: OptimizedImageVersions,
  preferWebP: boolean = true
): { path: string; size: number } | null {
  // 优先使用 WebP（如果支持且可用）
  if (preferWebP && versions.webp) {
    return versions.webp;
  }
  
  // 回退到 JPEG
  if (versions.jpeg) {
    return versions.jpeg;
  }
  
  // 如果 WebP 不被支持，但只有 WebP 版本，仍然使用它
  if (versions.webp) {
    return versions.webp;
  }
  
  return null;
}

// ============================================================================
// 主要 API
// ============================================================================

/**
 * 获取代理图片 URL
 */
export function getProxyImageUrl(
  originalUrl: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg';
  } = {}
): string {
  if (!originalUrl || originalUrl.trim() === '') {
    return '';
  }

  const {
    width,
    height,
    quality = 85,
    format = supportsWebP() ? 'webp' : 'jpeg',
  } = options;

  const params = new URLSearchParams();
  params.set('url', encodeURIComponent(originalUrl));
  
  if (width) params.set('w', width.toString());
  if (height) params.set('h', height.toString());
  params.set('q', quality.toString());
  params.set('f', format);

  return `/api/image-proxy?${params.toString()}`;
}

/**
 * 获取优化后的图片 URL
 * 
 * 优先级：
 * 1. 本地预优化图片（构建时生成，最快）
 * 2. 代理实时优化（fallback，较慢）
 * 3. 原图（最后手段）
 */
export async function getOptimizedImageUrl(
  originalUrl: string,
  options: ImageServiceOptions = {}
): Promise<{ primary: string; fallback?: string; shouldUpgrade?: boolean }> {
  // 如果没有原始 URL，返回空字符串
  if (!originalUrl || originalUrl.trim() === '') {
    return { primary: '' };
  }
  
  // 确定选项
  const {
    preferWebP = supportsWebP(),
    devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200,
    connectionType = 'unknown',
  } = options;
  
  // 根据视口和设备选择尺寸
  const targetSize = selectImageSize(viewportWidth, devicePixelRatio);
  
  // 慢速网络降级到更小尺寸
  let effectiveSize = targetSize;
  if (connectionType === 'slow') {
    if (targetSize === 'large') effectiveSize = 'medium';
    else if (targetSize === 'medium') effectiveSize = 'thumbnail';
  }
  
  // 1. 优先尝试本地预优化图片
  await loadImageMapping();
  const optimizedImage = findOptimizedImage(originalUrl);
  
  if (optimizedImage) {
    const sizeVersions = optimizedImage.optimized[effectiveSize];
    if (sizeVersions) {
      const selectedFormat = selectImageFormat(sizeVersions, preferWebP);
      if (selectedFormat) {
        // 找到本地优化图片，直接返回
        return {
          primary: selectedFormat.path,
          fallback: originalUrl,
          shouldUpgrade: false, // 已经是优化版本，无需升级
        };
      }
    }
    
    // 如果目标尺寸没有，尝试其他尺寸（large > medium > thumbnail）
    const fallbackSizes: (keyof OptimizedImageSizes)[] = ['large', 'medium', 'thumbnail'];
    for (const size of fallbackSizes) {
      if (size === effectiveSize) continue;
      const versions = optimizedImage.optimized[size];
      if (versions) {
        const selectedFormat = selectImageFormat(versions, preferWebP);
        if (selectedFormat) {
          return {
            primary: selectedFormat.path,
            fallback: originalUrl,
            shouldUpgrade: false,
          };
        }
      }
    }
  }
  
  // 2. 没有本地优化图片，使用代理实时优化
  const widthMap = {
    thumbnail: 200,
    medium: 800,
    large: 1200,
  };
  
  const width = widthMap[effectiveSize];
  
  // 根据网络条件调整质量
  let quality = 85;
  if (connectionType === 'slow') {
    quality = 75;
  } else if (connectionType === 'fast') {
    quality = 90;
  }
  
  const proxyUrl = getProxyImageUrl(originalUrl, {
    width,
    quality,
    format: preferWebP ? 'webp' : 'jpeg',
  });
  
  return {
    primary: proxyUrl,
    fallback: originalUrl,
    shouldUpgrade: true,
  };
}

/**
 * 获取图片的 srcSet 用于响应式加载
 */
export async function getImageSrcSet(
  originalUrl: string,
  options: Omit<ImageServiceOptions, 'viewportWidth'> = {}
): Promise<string> {
  if (!originalUrl || originalUrl.trim() === '') {
    return '';
  }
  
  await loadImageMapping();
  
  const optimizedImage = findOptimizedImage(originalUrl);
  if (!optimizedImage) {
    return originalUrl;
  }
  
  const {
    preferWebP = supportsWebP(),
  } = options;
  
  const srcSetEntries: string[] = [];
  
  // 为每个可用尺寸生成 srcSet 条目
  const sizeWidths = {
    thumbnail: 200,
    medium: 800,
    large: 1200,
  };
  
  for (const [sizeName, width] of Object.entries(sizeWidths)) {
    const sizeKey = sizeName as keyof OptimizedImageSizes;
    const versions = optimizedImage.optimized[sizeKey];
    
    if (versions) {
      const selectedImage = selectImageFormat(versions, preferWebP);
      if (selectedImage) {
        srcSetEntries.push(`${selectedImage.path} ${width}w`);
      }
    }
  }
  
  return srcSetEntries.join(', ') || originalUrl;
}

/**
 * 预加载关键图片
 */
export async function preloadCriticalImages(
  imageUrls: string[],
  options: ImageServiceOptions = {}
): Promise<void> {
  const preloadPromises = imageUrls.slice(0, 6).map(async (url, index) => {
    const result = await getOptimizedImageUrl(url, {
      ...options,
      viewportWidth: options.viewportWidth || 800, // 假设中等尺寸
    });
    
    if (result.primary && typeof document !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = result.primary;
      
      // 前3张设置高优先级
      if (index < 3) {
        link.fetchPriority = 'high';
      }
      
      document.head.appendChild(link);
    }
  });
  
  await Promise.all(preloadPromises);
}

/**
 * 检测网络连接类型
 */
export function detectConnectionType(): 'slow' | 'fast' | 'unknown' {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return 'unknown';
  }
  
  const connection = (navigator as any).connection;
  
  if (connection.effectiveType) {
    // 2G, 3G 被认为是慢速连接
    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      return 'slow';
    }
    // 4G 及以上被认为是快速连接
    if (connection.effectiveType === '4g') {
      return 'fast';
    }
    // 3G 被认为是中等速度，根据下行速度判断
    if (connection.effectiveType === '3g') {
      return connection.downlink && connection.downlink < 1.5 ? 'slow' : 'fast';
    }
  }
  
  return 'unknown';
}