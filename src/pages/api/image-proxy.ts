/**
 * 图片代理 API
 * 
 * 功能：
 * 1. 代理 Notion 图片请求
 * 2. 实时优化和缓存
 * 3. 自动处理 URL 过期
 * 4. 支持多种尺寸和格式
 */

import { NextApiRequest, NextApiResponse } from 'next';
import sharp from 'sharp';
import { getDatabaseItems } from '@/lib/notion';

// ============================================================================
// 配置
// ============================================================================

const CACHE_DURATION = 7 * 24 * 60 * 60; // 7天缓存
const MAX_AGE = 30 * 24 * 60 * 60; // 30天浏览器缓存

interface ImageProxyQuery {
  url?: string;
  w?: string;
  h?: string;
  q?: string;
  f?: string;
}

// ============================================================================
// 图片 URL 刷新缓存
// ============================================================================

const urlCache = new Map<string, { url: string; timestamp: number }>();
const URL_CACHE_TTL = 12 * 60 * 60 * 1000; // 12小时

async function getRefreshedImageUrl(originalUrl: string): Promise<string> {
  // 检查缓存
  const cached = urlCache.get(originalUrl);
  if (cached && Date.now() - cached.timestamp < URL_CACHE_TTL) {
    return cached.url;
  }

  try {
    // 重新获取 Notion 数据以刷新 URL
    const items = await getDatabaseItems();
    const item = items.find(item => item.image === originalUrl);
    
    if (item && item.image) {
      // 更新缓存
      urlCache.set(originalUrl, {
        url: item.image,
        timestamp: Date.now(),
      });
      return item.image;
    }
  } catch (error) {
    console.warn('Failed to refresh image URL:', error);
  }

  // 如果刷新失败，返回原 URL
  return originalUrl;
}

// ============================================================================
// 图片获取和优化
// ============================================================================

async function fetchAndOptimizeImage(
  imageUrl: string,
  width?: number,
  height?: number,
  quality: number = 85,
  format: 'webp' | 'jpeg' = 'webp'
): Promise<{ buffer: Buffer; contentType: string }> {
  
  // 尝试获取图片
  let response: Response;
  try {
    response = await fetch(imageUrl);
  } catch (error) {
    // 如果获取失败，尝试刷新 URL
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
  
  // 使用 Sharp 优化图片
  let pipeline = sharp(imageBuffer);
  
  // 调整尺寸
  if (width || height) {
    pipeline = pipeline.resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  
  // 转换格式和质量
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

// ============================================================================
// API 处理器
// ============================================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, w, h, q = '85', f = 'webp' } = req.query as ImageProxyQuery;

  if (!url) {
    return res.status(400).json({ error: 'Missing image URL' });
  }

  try {
    // 解析参数
    const width = w ? parseInt(w, 10) : undefined;
    const height = h ? parseInt(h, 10) : undefined;
    const quality = Math.min(100, Math.max(1, parseInt(q, 10)));
    const format = f === 'jpeg' ? 'jpeg' : 'webp';

    // 生成缓存键
    const cacheKey = `${url}-${width || 'auto'}-${height || 'auto'}-${quality}-${format}`;
    
    // 设置缓存头
    res.setHeader('Cache-Control', `public, max-age=${MAX_AGE}, s-maxage=${CACHE_DURATION}`);
    res.setHeader('CDN-Cache-Control', `public, max-age=${CACHE_DURATION}`);
    
    // 获取和优化图片
    const { buffer, contentType } = await fetchAndOptimizeImage(
      decodeURIComponent(url),
      width,
      height,
      quality,
      format
    );
    
    // 设置响应头
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    
    // 返回优化后的图片
    res.send(buffer);
    
  } catch (error) {
    console.error('Image proxy error:', error);
    
    // 返回 1x1 透明像素作为占位符
    const placeholder = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=60'); // 短缓存
    res.send(placeholder);
  }
}

// 配置 API 路由
export const config = {
  api: {
    responseLimit: '10mb', // 支持大图片
  },
};