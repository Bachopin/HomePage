/**
 * 渐进式图片加载
 *
 * 1. 立刻展示 Notion 原图（首屏）
 * 2. 后台解析优化 URL（本地映射或同源代理）并预加载
 * 3. 成功后平滑切换；失败则保留原图
 */

import { useState, useEffect, useRef } from 'react';
import {
  getOptimizedImageUrl,
  detectConnectionType,
  isSameOriginImageUrl,
} from '@/lib/imageService';
import { useImageCache, warmImageCache } from './useImageCache';

export interface UseProgressiveImageResult {
  currentImageUrl: string;
  isOptimized: boolean;
  isLoading: boolean;
  hasError: boolean;
  loadingProgress: 'original' | 'upgrading' | 'complete';
}

export interface UseProgressiveImageOptions {
  viewportWidth?: number;
  devicePixelRatio?: number;
  /** Card display width in CSS px — drives proxy resize */
  targetWidth?: number;
  enableOptimization?: boolean;
}

function preloadUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (isSameOriginImageUrl(url)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      warmImageCache(url, img);
      resolve();
    };
    img.onerror = () => reject(new Error('preload failed'));
    img.src = url;
  });
}

export function useProgressiveImage(
  originalUrl: string,
  options: UseProgressiveImageOptions = {}
): UseProgressiveImageResult {
  const {
    viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200,
    devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    targetWidth,
    enableOptimization = true,
  } = options;

  // Paint original immediately — do not wait for mapping/proxy
  const [currentImageUrl, setCurrentImageUrl] = useState(originalUrl || '');
  const [isOptimized, setIsOptimized] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<
    'original' | 'upgrading' | 'complete'
  >('original');

  const upgradeGen = useRef(0);

  useEffect(() => {
    setCurrentImageUrl(originalUrl || '');
    setIsOptimized(false);
    setLoadingProgress(originalUrl ? 'original' : 'complete');
  }, [originalUrl]);

  const { isLoaded, hasError } = useImageCache(currentImageUrl);

  // Background upgrade to local/proxy optimized URL
  useEffect(() => {
    if (!originalUrl || !enableOptimization) {
      setLoadingProgress(originalUrl ? 'complete' : 'complete');
      return;
    }

    const gen = ++upgradeGen.current;
    let cancelled = false;

    setLoadingProgress('upgrading');

    (async () => {
      try {
        const result = await getOptimizedImageUrl(originalUrl, {
          viewportWidth,
          devicePixelRatio,
          targetWidth,
          connectionType: detectConnectionType(),
        });

        if (cancelled || gen !== upgradeGen.current) return;

        const next = result.primary;
        if (!next || next === originalUrl || next === currentImageUrl) {
          setLoadingProgress('complete');
          return;
        }

        await preloadUrl(next);
        if (cancelled || gen !== upgradeGen.current) return;

        setCurrentImageUrl(next);
        setIsOptimized(!result.fromProxy);
        setLoadingProgress('complete');
      } catch {
        if (!cancelled && gen === upgradeGen.current) {
          // Keep original; upgrade is optional
          setLoadingProgress('complete');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-upgrade on source/options
  }, [
    originalUrl,
    enableOptimization,
    viewportWidth,
    devicePixelRatio,
    targetWidth,
  ]);

  const waitingForDisplay =
    Boolean(currentImageUrl) && !isLoaded && !hasError;

  return {
    currentImageUrl,
    isOptimized,
    isLoading: waitingForDisplay,
    // Only surface error if the *currently displayed* URL failed (usually original)
    hasError,
    loadingProgress,
  };
}

/**
 * Preload first N optimized URLs (non-blocking).
 */
export function useProgressiveImagePreloader(
  imageUrls: string[],
  options: UseProgressiveImageOptions = {}
) {
  const [preloadedCount, setPreloadedCount] = useState(0);

  useEffect(() => {
    if (!imageUrls.length || options.enableOptimization === false) return;

    let completed = 0;
    let cancelled = false;
    const limit = Math.min(imageUrls.length, 6);

    const run = async () => {
      for (let i = 0; i < limit; i++) {
        if (cancelled) return;
        const url = imageUrls[i];
        try {
          const result = await getOptimizedImageUrl(url, {
            viewportWidth: options.viewportWidth || 1200,
            devicePixelRatio: options.devicePixelRatio || 1,
            targetWidth: options.targetWidth,
            connectionType: detectConnectionType(),
          });
          if (result.primary) {
            await preloadUrl(result.primary).catch(() => undefined);
          }
        } catch {
          // ignore
        }
        completed++;
        if (!cancelled) setPreloadedCount(completed);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    imageUrls,
    options.viewportWidth,
    options.devicePixelRatio,
    options.targetWidth,
    options.enableOptimization,
  ]);

  return {
    preloadedCount,
    totalCount: Math.min(imageUrls.length, 6),
    isComplete: preloadedCount >= Math.min(imageUrls.length, 6),
  };
}
