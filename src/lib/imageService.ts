/**
 * 图片服务
 *
 * 优先级：本地预优化 → 同源代理 → 原图
 * 首屏策略：调用方应立刻用原图，再后台升级到优化 URL
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
  /** Prefer card pixel width over full viewport when choosing size */
  targetWidth?: number;
  viewportWidth?: number;
  connectionType?: 'slow' | 'fast' | 'unknown';
}

export interface OptimizedImageResult {
  primary: string;
  fallback?: string;
  /** true when primary is proxy (not local static) */
  fromProxy?: boolean;
}

// ============================================================================
// Image mapping (optional acceleration; never block critical path long)
// ============================================================================

let imageMapping: ImageMapping[] = [];
let mappingLoaded = false;
let mappingPromise: Promise<void> | null = null;

const MAPPING_CACHE_KEY = 'image-mapping-cache';
const MAPPING_CACHE_VERSION = 'v2';

function getUrlPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0] ?? url;
  }
}

async function loadImageMapping(): Promise<void> {
  if (mappingLoaded) return;
  if (mappingPromise) return mappingPromise;

  mappingPromise = (async () => {
    try {
      if (typeof window !== 'undefined') {
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
          // ignore
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const response = await fetch('/images/optimized/image-mapping.json', {
          signal: controller.signal,
        }).catch(() => null);
        clearTimeout(timeoutId);

        if (response?.ok) {
          imageMapping = await response.json();
          try {
            sessionStorage.setItem(
              MAPPING_CACHE_KEY,
              JSON.stringify({ version: MAPPING_CACHE_VERSION, data: imageMapping })
            );
          } catch {
            // ignore
          }
        } else {
          imageMapping = [];
        }
      } else {
        try {
          const fs = await import('fs').then((m) => m.promises);
          const path = await import('path');
          const mappingPath = path.join(
            process.cwd(),
            'public',
            'images',
            'optimized',
            'image-mapping.json'
          );
          const data = await fs.readFile(mappingPath, 'utf-8');
          imageMapping = JSON.parse(data);
        } catch {
          imageMapping = [];
        }
      }
    } catch (error) {
      console.warn('Failed to load image mapping:', error);
      imageMapping = [];
    } finally {
      mappingLoaded = true;
      mappingPromise = null;
    }
  })();

  return mappingPromise;
}

function findOptimizedImage(originalUrl: string): ImageMapping | null {
  if (!originalUrl || imageMapping.length === 0) return null;
  const targetPath = getUrlPath(originalUrl);
  return (
    imageMapping.find((item) => getUrlPath(item.originalUrl) === targetPath) || null
  );
}

// ============================================================================
// Format / size helpers
// ============================================================================

let webpSupport: boolean | null = null;

export function supportsWebP(): boolean {
  if (typeof window === 'undefined') return true; // SSR assume modern
  if (webpSupport !== null) return webpSupport;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    webpSupport = canvas.toDataURL('image/webp').includes('data:image/webp');
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

/**
 * Pick size tier from the actual display width (card), not the whole viewport.
 */
function selectImageSize(
  targetWidth: number,
  devicePixelRatio: number = 1
): keyof OptimizedImageSizes {
  const effectiveWidth = targetWidth * devicePixelRatio;
  if (effectiveWidth <= 400) return 'thumbnail';
  if (effectiveWidth <= 900) return 'medium';
  return 'large';
}

function selectImageFormat(
  versions: OptimizedImageVersions,
  preferWebP: boolean = true
): { path: string; size: number } | null {
  if (preferWebP && versions.webp) return versions.webp;
  if (versions.jpeg) return versions.jpeg;
  if (versions.webp) return versions.webp;
  return null;
}

const SIZE_WIDTHS = {
  thumbnail: 400,
  medium: 800,
  large: 1200,
} as const;

// ============================================================================
// Public API
// ============================================================================

/**
 * Build same-origin proxy URL. URLSearchParams encodes once — do not double-encode.
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
  if (!originalUrl || originalUrl.trim() === '') return '';

  const {
    width,
    height,
    quality = 82,
    format = supportsWebP() ? 'webp' : 'jpeg',
  } = options;

  const params = new URLSearchParams();
  params.set('url', originalUrl);
  if (width) params.set('w', String(width));
  if (height) params.set('h', String(height));
  params.set('q', String(quality));
  params.set('f', format);

  return `/api/image-proxy?${params.toString()}`;
}

/**
 * Resolve best optimized URL (local mapping or proxy). Does not replace progressive first paint —
 * callers should show `originalUrl` immediately, then swap to `primary` when ready.
 */
export async function getOptimizedImageUrl(
  originalUrl: string,
  options: ImageServiceOptions = {}
): Promise<OptimizedImageResult> {
  if (!originalUrl || originalUrl.trim() === '') {
    return { primary: '' };
  }

  const {
    preferWebP = supportsWebP(),
    devicePixelRatio =
      typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    targetWidth,
    viewportWidth =
      typeof window !== 'undefined' ? window.innerWidth : 1200,
    connectionType = 'unknown',
  } = options;

  const displayWidth = targetWidth && targetWidth > 0 ? targetWidth : Math.min(viewportWidth, 800);
  let effectiveSize = selectImageSize(displayWidth, devicePixelRatio);
  if (connectionType === 'slow') {
    if (effectiveSize === 'large') effectiveSize = 'medium';
    else if (effectiveSize === 'medium') effectiveSize = 'thumbnail';
  }

  // Optional local mapping — short timeout already in loader; never required
  await loadImageMapping();
  const optimizedImage = findOptimizedImage(originalUrl);

  if (optimizedImage) {
    const trySizes: (keyof OptimizedImageSizes)[] = [
      effectiveSize,
      'medium',
      'large',
      'thumbnail',
    ];
    const seen = new Set<string>();
    for (const size of trySizes) {
      if (seen.has(size)) continue;
      seen.add(size);
      const versions = optimizedImage.optimized[size];
      if (!versions) continue;
      const selected = selectImageFormat(versions, preferWebP);
      if (selected) {
        return {
          primary: selected.path,
          fallback: originalUrl,
          fromProxy: false,
        };
      }
    }
  }

  const width = SIZE_WIDTHS[effectiveSize];
  let quality = 82;
  if (connectionType === 'slow') quality = 72;
  else if (connectionType === 'fast') quality = 88;

  return {
    primary: getProxyImageUrl(originalUrl, {
      width,
      quality,
      format: preferWebP ? 'webp' : 'jpeg',
    }),
    fallback: originalUrl,
    fromProxy: true,
  };
}

export function detectConnectionType(): 'slow' | 'fast' | 'unknown' {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return 'unknown';
  }

  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number };
  }).connection;

  if (!connection?.effectiveType) return 'unknown';

  if (
    connection.effectiveType === 'slow-2g' ||
    connection.effectiveType === '2g'
  ) {
    return 'slow';
  }
  if (connection.effectiveType === '4g') return 'fast';
  if (connection.effectiveType === '3g') {
    return connection.downlink && connection.downlink < 1.5 ? 'slow' : 'fast';
  }
  return 'unknown';
}

/** Whether URL is same-origin (safe for crossOrigin=anonymous). */
export function isSameOriginImageUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/')) return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}
