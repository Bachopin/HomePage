/**
 * 渐进式图片加载 Hook
 * 
 * 职责：
 * 1. 优先显示 Notion 原图（快速显示）
 * 2. 后台加载优化图片（更好体验）
 * 3. 平滑切换到优化版本（无感知升级）
 */

import { useState, useEffect, useCallback } from 'react';
import { getOptimizedImageUrl, detectConnectionType } from '@/lib/imageService';
import { useImageCache } from './useImageCache';

// ============================================================================
// Types
// ============================================================================

export interface UseProgressiveImageResult {
  currentImageUrl: string;
  isOptimized: boolean;
  isLoading: boolean;
  hasError: boolean;
  loadingProgress: 'original' | 'optimized' | 'complete';
}

export interface UseProgressiveImageOptions {
  viewportWidth?: number;
  devicePixelRatio?: number;
  enableOptimization?: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useProgressiveImage(
  originalUrl: string,
  options: UseProgressiveImageOptions = {}
): UseProgressiveImageResult {
  const [currentImageUrl, setCurrentImageUrl] = useState<string>('');
  const [optimizedUrl, setOptimizedUrl] = useState<string>('');
  const [isOptimized, setIsOptimized] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<'original' | 'optimized' | 'complete'>('original');
  
  const {
    viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200,
    devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    enableOptimization = true,
  } = options;

  // 使用缓存 hook 加载当前图片
  const { isLoaded, hasError } = useImageCache(currentImageUrl);

  // 获取优化图片 URL
  useEffect(() => {
    if (!originalUrl || !enableOptimization) {
      setCurrentImageUrl(originalUrl);
      setOptimizedUrl('');
      setIsOptimized(false);
      setLoadingProgress('complete');
      return;
    }

    // 立即设置原图作为初始显示
    setCurrentImageUrl(originalUrl);
    setIsOptimized(false);
    setLoadingProgress('original');

    // 异步获取优化图片
    getOptimizedImageUrl(originalUrl, {
      viewportWidth,
      devicePixelRatio,
      connectionType: detectConnectionType(),
    }).then(result => {
      if (result.shouldUpgrade && result.primary !== originalUrl) {
        setOptimizedUrl(result.primary);
        setLoadingProgress('optimized');
      } else {
        setLoadingProgress('complete');
      }
    }).catch(error => {
      console.warn('Failed to get optimized image URL:', error);
      setLoadingProgress('complete');
    });
  }, [originalUrl, viewportWidth, devicePixelRatio, enableOptimization]);

  // 预加载优化图片
  useEffect(() => {
    if (!optimizedUrl || optimizedUrl === currentImageUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // 优化图片加载完成，平滑切换
      setCurrentImageUrl(optimizedUrl);
      setIsOptimized(true);
      setLoadingProgress('complete');
    };
    
    img.onerror = () => {
      // 优化图片加载失败，保持使用原图
      console.warn('Failed to load optimized image, keeping original');
      setLoadingProgress('complete');
    };
    
    img.src = optimizedUrl;
  }, [optimizedUrl, currentImageUrl]);

  return {
    currentImageUrl,
    isOptimized,
    isLoading: !isLoaded,
    hasError,
    loadingProgress,
  };
}

/**
 * 批量预加载优化图片
 */
export function useProgressiveImagePreloader(
  imageUrls: string[],
  options: UseProgressiveImageOptions = {}
) {
  const [preloadedCount, setPreloadedCount] = useState(0);
  
  useEffect(() => {
    if (!imageUrls.length || !options.enableOptimization) return;

    let completed = 0;
    
    const preloadPromises = imageUrls.slice(0, 6).map(async (url) => {
      try {
        const result = await getOptimizedImageUrl(url, {
          viewportWidth: options.viewportWidth || 1200,
          devicePixelRatio: options.devicePixelRatio || 1,
          connectionType: detectConnectionType(),
        });
        
        if (result.shouldUpgrade && result.primary !== url) {
          // 预加载优化图片
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          return new Promise<void>((resolve) => {
            img.onload = () => {
              completed++;
              setPreloadedCount(completed);
              resolve();
            };
            img.onerror = () => {
              completed++;
              setPreloadedCount(completed);
              resolve();
            };
            img.src = result.primary;
          });
        }
      } catch (error) {
        console.warn('Failed to preload optimized image:', error);
      }
      
      completed++;
      setPreloadedCount(completed);
    });

    Promise.all(preloadPromises);
  }, [imageUrls, options.viewportWidth, options.devicePixelRatio, options.enableOptimization]);

  return {
    preloadedCount,
    totalCount: Math.min(imageUrls.length, 6),
    isComplete: preloadedCount >= Math.min(imageUrls.length, 6),
  };
}