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
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分钟

// 模块级单一定时器（避免每个卡片实例各自 setInterval）
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
let cleanupSubscribers = 0;

function cleanExpiredCache() {
  const now = Date.now();
  for (const [url, entry] of imageCache.entries()) {
    if (now - entry.timestamp > CACHE_EXPIRE_TIME) {
      imageCache.delete(url);
    }
  }
}

function limitCacheSize() {
  if (imageCache.size <= MAX_CACHE_SIZE) return;
  
  const entries = Array.from(imageCache.entries())
    .sort(([, a], [, b]) => a.timestamp - b.timestamp);
  
  const toDelete = entries.slice(0, imageCache.size - MAX_CACHE_SIZE);
  toDelete.forEach(([url]) => imageCache.delete(url));
}

function subscribeCleanupTimer() {
  cleanupSubscribers += 1;
  if (!cleanupTimer) {
    cleanupTimer = setInterval(cleanExpiredCache, CLEANUP_INTERVAL);
  }
}

function unsubscribeCleanupTimer() {
  cleanupSubscribers = Math.max(0, cleanupSubscribers - 1);
  if (cleanupSubscribers === 0 && cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useImageCache(imageUrl: string): UseImageCacheResult {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const preloadImage = useCallback(async (url: string): Promise<void> => {
    if (!url || url.trim() === '') return;

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

  const clearCache = useCallback(() => {
    imageCache.clear();
  }, []);

  useEffect(() => {
    if (!imageUrl || imageUrl.trim() === '') {
      setIsLoaded(true);
      setHasError(false);
      return;
    }

    const cached = imageCache.get(imageUrl);
    if (cached) {
      setIsLoaded(cached.loaded);
      setHasError(cached.error);
      return;
    }

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

  useEffect(() => {
    subscribeCleanupTimer();
    return () => unsubscribeCleanupTimer();
  }, []);

  return {
    isLoaded,
    hasError,
    preloadImage,
    clearCache,
  };
}
