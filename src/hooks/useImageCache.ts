/**
 * 图片缓存 Hook
 * 
 * 职责：
 * 1. 缓存已加载的图片，避免重复请求
 * 2. 预加载可见区域附近的图片
 * 3. 提供图片加载状态管理
 */

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ImageCacheEntry {
  url: string;
  loaded: boolean;
  error: boolean;
  element?: HTMLImageElement;
  timestamp: number;
}

export interface UseImageCacheResult {
  isLoaded: boolean;
  hasError: boolean;
  preloadImage: (url: string) => Promise<void>;
  clearCache: () => void;
}

// ============================================================================
// Global Cache
// ============================================================================

const imageCache = new Map<string, ImageCacheEntry>();
const MAX_CACHE_SIZE = 50; // 最大缓存数量
const CACHE_EXPIRE_TIME = 30 * 60 * 1000; // 30分钟过期

// 清理过期缓存
function cleanExpiredCache() {
  const now = Date.now();
  for (const [url, entry] of imageCache.entries()) {
    if (now - entry.timestamp > CACHE_EXPIRE_TIME) {
      imageCache.delete(url);
    }
  }
}

// 限制缓存大小
function limitCacheSize() {
  if (imageCache.size <= MAX_CACHE_SIZE) return;
  
  // 按时间戳排序，删除最旧的条目
  const entries = Array.from(imageCache.entries())
    .sort(([, a], [, b]) => a.timestamp - b.timestamp);
  
  const toDelete = entries.slice(0, imageCache.size - MAX_CACHE_SIZE);
  toDelete.forEach(([url]) => imageCache.delete(url));
}

// ============================================================================
// Hook
// ============================================================================

export function useImageCache(imageUrl: string): UseImageCacheResult {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // 预加载图片函数
  const preloadImage = useCallback(async (url: string): Promise<void> => {
    if (!url || url.trim() === '') return;

    // 检查缓存
    const cached = imageCache.get(url);
    if (cached) {
      if (cached.loaded) return Promise.resolve();
      if (cached.error) return Promise.reject(new Error('Image failed to load'));
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        imageCache.set(url, {
          url,
          loaded: true,
          error: false,
          element: img,
          timestamp: Date.now(),
        });
        
        limitCacheSize();
        resolve();
      };
      
      img.onerror = () => {
        imageCache.set(url, {
          url,
          loaded: false,
          error: true,
          timestamp: Date.now(),
        });
        
        reject(new Error('Image failed to load'));
      };
      
      img.src = url;
    });
  }, []);

  // 清理缓存函数
  const clearCache = useCallback(() => {
    imageCache.clear();
  }, []);

  // 监听图片 URL 变化
  useEffect(() => {
    if (!imageUrl || imageUrl.trim() === '') {
      setIsLoaded(true);
      setHasError(false);
      return;
    }

    // 检查缓存
    const cached = imageCache.get(imageUrl);
    if (cached) {
      setIsLoaded(cached.loaded);
      setHasError(cached.error);
      return;
    }

    // 开始加载
    setIsLoaded(false);
    setHasError(false);

    preloadImage(imageUrl)
      .then(() => {
        setIsLoaded(true);
        setHasError(false);
      })
      .catch(() => {
        setIsLoaded(false);
        setHasError(true);
      });
  }, [imageUrl, preloadImage]);

  // 定期清理过期缓存
  useEffect(() => {
    const interval = setInterval(cleanExpiredCache, 5 * 60 * 1000); // 每5分钟清理一次
    return () => clearInterval(interval);
  }, []);

  return {
    isLoaded,
    hasError,
    preloadImage,
    clearCache,
  };
}