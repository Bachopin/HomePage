/**
 * 图片代理 API (App Router)
 *
 * 功能：
 * 1. 代理 Notion 图片请求
 * 2. 实时优化和缓存
 * 3. 自动处理 URL 过期
 * 4. 支持多种尺寸和格式
 */

import sharp from 'sharp';
import { getDatabaseItems } from '@/lib/notion';

export const runtime = 'nodejs';

const CACHE_DURATION = 7 * 24 * 60 * 60; // 7天 CDN 缓存
const MAX_AGE = 30 * 24 * 60 * 60; // 30天浏览器缓存
const URL_CACHE_TTL = 12 * 60 * 60 * 1000; // 12小时

const urlCache = new Map<string, { url: string; timestamp: number }>();

const TRANSPARENT_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

/** Stable key for Notion signed URLs (query params rotate; path usually stays). */
function imageUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split('?')[0] ?? url;
  }
}

async function getRefreshedImageUrl(originalUrl: string): Promise<string> {
  const cached = urlCache.get(originalUrl);
  if (cached && Date.now() - cached.timestamp < URL_CACHE_TTL) {
    return cached.url;
  }

  try {
    const { items } = await getDatabaseItems();
    const originalKey = imageUrlKey(originalUrl);
    const item = items.find(
      entry => entry.image && imageUrlKey(entry.image) === originalKey
    );

    if (item?.image) {
      urlCache.set(originalUrl, {
        url: item.image,
        timestamp: Date.now(),
      });
      return item.image;
    }
  } catch (error) {
    console.warn('Failed to refresh image URL:', error);
  }

  return originalUrl;
}

async function fetchAndOptimizeImage(
  imageUrl: string,
  width?: number,
  height?: number,
  quality: number = 85,
  format: 'webp' | 'jpeg' = 'webp'
): Promise<{ buffer: Buffer; contentType: string }> {
  let response: Response;
  try {
    response = await fetch(imageUrl);
  } catch (error) {
    const refreshedUrl = await getRefreshedImageUrl(imageUrl);
    if (refreshedUrl !== imageUrl) {
      response = await fetch(refreshedUrl);
    } else {
      throw error;
    }
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer());
  let pipeline = sharp(imageBuffer);

  if (width || height) {
    pipeline = pipeline.resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  if (format === 'webp') {
    pipeline = pipeline.webp({
      quality,
      effort: 6,
      smartSubsample: true,
    });
  } else {
    pipeline = pipeline.jpeg({
      quality,
      progressive: true,
      mozjpeg: true,
    });
  }

  const optimizedBuffer = await pipeline.toBuffer();

  return {
    buffer: optimizedBuffer,
    contentType: format === 'webp' ? 'image/webp' : 'image/jpeg',
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const w = searchParams.get('w');
  const h = searchParams.get('h');
  const q = searchParams.get('q') ?? '85';
  const f = searchParams.get('f') ?? 'webp';

  if (!url) {
    return Response.json({ error: 'Missing image URL' }, { status: 400 });
  }

  try {
    const width = w ? parseInt(w, 10) : undefined;
    const height = h ? parseInt(h, 10) : undefined;
    const quality = Math.min(100, Math.max(1, parseInt(q, 10) || 85));
    const format = f === 'jpeg' ? 'jpeg' : 'webp';

    const { buffer, contentType } = await fetchAndOptimizeImage(
      decodeURIComponent(url),
      width,
      height,
      quality,
      format
    );

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Cache-Control': `public, max-age=${MAX_AGE}, s-maxage=${CACHE_DURATION}`,
        'CDN-Cache-Control': `public, max-age=${CACHE_DURATION}`,
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);

    return new Response(new Uint8Array(TRANSPARENT_PIXEL), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
      },
    });
  }
}
