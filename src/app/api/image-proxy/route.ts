/**
 * 图片代理 API (App Router)
 *
 * - 拉 Notion/外部图 → Sharp 缩放转码 → 长缓存
 * - HTTP 403/404 时按 path 匹配刷新 Notion 签名 URL 并重试
 * - 失败返回真实错误码（不再用 200 + 透明像素骗前端）
 */

import sharp from 'sharp';
import { getDatabaseItems } from '@/lib/notion';

export const runtime = 'nodejs';

const CACHE_DURATION = 7 * 24 * 60 * 60;
const MAX_AGE = 30 * 24 * 60 * 60;
const URL_CACHE_TTL = 12 * 60 * 60 * 1000;

const urlCache = new Map<string, { url: string; timestamp: number }>();

function imageUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split('?')[0] ?? url;
  }
}

async function getRefreshedImageUrl(originalUrl: string): Promise<string | null> {
  const cached = urlCache.get(originalUrl);
  if (cached && Date.now() - cached.timestamp < URL_CACHE_TTL) {
    return cached.url;
  }

  try {
    const { items } = await getDatabaseItems();
    const originalKey = imageUrlKey(originalUrl);
    const item = items.find(
      (entry) => entry.image && imageUrlKey(entry.image) === originalKey
    );

    if (item?.image && item.image !== originalUrl) {
      urlCache.set(originalUrl, {
        url: item.image,
        timestamp: Date.now(),
      });
      return item.image;
    }
  } catch (error) {
    console.warn('Failed to refresh image URL:', error);
  }

  return null;
}

async function fetchRemoteImage(imageUrl: string): Promise<Response> {
  const response = await fetch(imageUrl, {
    headers: {
      // Some CDNs behave better with a UA
      'User-Agent': 'MextricHomepageImageProxy/1.1',
      Accept: 'image/*,*/*;q=0.8',
    },
    redirect: 'follow',
  });

  if (response.ok) return response;

  // Expired Notion signed URLs typically 403 — refresh and retry once
  if (response.status === 403 || response.status === 404 || response.status === 401) {
    const refreshed = await getRefreshedImageUrl(imageUrl);
    if (refreshed) {
      const retry = await fetch(refreshed, {
        headers: {
          'User-Agent': 'MextricHomepageImageProxy/1.1',
          Accept: 'image/*,*/*;q=0.8',
        },
        redirect: 'follow',
      });
      if (retry.ok) return retry;
      throw new Error(`Refresh fetch failed: ${retry.status}`);
    }
  }

  throw new Error(`Failed to fetch image: ${response.status}`);
}

async function fetchAndOptimizeImage(
  imageUrl: string,
  width?: number,
  height?: number,
  quality: number = 82,
  format: 'webp' | 'jpeg' = 'webp'
): Promise<{ buffer: Buffer; contentType: string }> {
  let response: Response;
  try {
    response = await fetchRemoteImage(imageUrl);
  } catch (error) {
    // Network throw — still try refresh once
    const refreshed = await getRefreshedImageUrl(imageUrl);
    if (refreshed) {
      response = await fetchRemoteImage(refreshed);
    } else {
      throw error;
    }
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer());
  let pipeline = sharp(imageBuffer, { failOn: 'none' });

  if (width || height) {
    pipeline = pipeline.resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Lower effort = faster serverless cold path; quality still fine for cards
  if (format === 'webp') {
    pipeline = pipeline.webp({
      quality,
      effort: 3,
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
  // URLSearchParams already decodes once — do not decodeURIComponent again
  const url = searchParams.get('url');
  const w = searchParams.get('w');
  const h = searchParams.get('h');
  const q = searchParams.get('q') ?? '82';
  const f = searchParams.get('f') ?? 'webp';

  if (!url) {
    return Response.json({ error: 'Missing image URL' }, { status: 400 });
  }

  try {
    const width = w ? parseInt(w, 10) : undefined;
    const height = h ? parseInt(h, 10) : undefined;
    const quality = Math.min(100, Math.max(1, parseInt(q, 10) || 82));
    const format = f === 'jpeg' ? 'jpeg' : 'webp';

    const { buffer, contentType } = await fetchAndOptimizeImage(
      url,
      width,
      Number.isFinite(height) ? height : undefined,
      quality,
      format
    );

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Cache-Control': `public, max-age=${MAX_AGE}, s-maxage=${CACHE_DURATION}, stale-while-revalidate=86400`,
        'CDN-Cache-Control': `public, max-age=${CACHE_DURATION}`,
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    // Real error so client keeps / falls back to original instead of "successful" blank pixel
    return Response.json(
      { error: 'Image proxy failed' },
      {
        status: 502,
        headers: {
          'Cache-Control': 'public, max-age=30',
        },
      }
    );
  }
}
