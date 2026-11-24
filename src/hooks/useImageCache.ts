/**
 * 图片缓存 Hook
 *
 * - 全局 Map 去重
 * - 模块级清理定时器
 * - 仅对同源 URL 设置 crossOrigin（Notion 原图设 anonymous 会 CORS 失败）
 */

import { useState, useEffect, useCallback } from 'react';
import { isSameOriginImageUrl } from '@/lib/imageService';

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

const imageCache = new Map<string, ImageCacheEntry>();
const MAX_CACHE_SIZE = 80;
const CACHE_EXPIRE_TIME = 30 * 60 * 1000;
const CLEANUP_INTERVAL = 5 * 60 * 1000;

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
  const entries = Array.from(imageCache.entries()).sort(
    ([, a], [, b]) => a.timestamp - b.timestamp
  );
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

/** Warm global cache after an external preload (avoids upgrade flicker). */
export function warmImageCache(url: string, element?: HTMLImageElement) {
  if (!url) return;
  imageCache.set(url, {
    url,
    loaded: true,
    error: false,
    element,
    timestamp: Date.now(),
  });
  limitCacheSize();
}

export function useImageCache(imageUrl: string): UseImageCacheResult {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const preloadImage = useCallback(async (url: string): Promise<void> => {
    if (!url || url.trim() === '') return;

    const cached = imageCache.get(url);
    if (cached) {
      if (cached.loaded) return;
      if (cached.error) return Promise.reject(new Error('Image failed to load'));
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      // Only same-origin: Notion signed URLs often lack CORS → anonymous would fail
      if (isSameOriginImageUrl(url)) {
        img.crossOrigin = 'anonymous';
      }

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

    let cancelled = false;
    setIsLoaded(false);
    setHasError(false);

    preloadImage(imageUrl)
      .then(() => {
        if (!cancelled) {
          setIsLoaded(true);
          setHasError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoaded(false);
          setHasError(true);
        }
      });

    return () => {
      cancelled = true;
    };
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
