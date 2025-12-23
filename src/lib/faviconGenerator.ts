/**
 * Favicon Generator - 基于 Notion 数据库图标生成多尺寸 favicon
 * 
 * 复用现有的图片优化架构，支持 emoji、外部文件、上传文件三种图标类型
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import type { DatabaseIcon } from './notion';

// ============================================================================
// Types
// ============================================================================

export interface FaviconConfig {
  source: DatabaseIcon;
  outputDir: string;
  sizes: number[];
}

export interface FaviconGenerationResult {
  success: boolean;
  generatedFiles: string[];
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const FAVICON_SIZES = [16, 32, 192, 512] as const;
const FAVICON_FILES = {
  ico: 'favicon.ico',
  png16: 'favicon-16x16.png',
  png32: 'favicon-32x32.png',
  appleTouchIcon: 'apple-touch-icon.png', // 192x192
  androidChrome: 'android-chrome-512x512.png', // 512x512
} as const;

// ============================================================================
// Favicon Generator Class
// ============================================================================

export class FaviconGenerator {
  private outputDir: string;

  constructor(outputDir: string = 'public') {
    this.outputDir = outputDir;
  }

  /**
   * 从数据库图标生成所有 favicon 文件
   */
  async generateFromDatabaseIcon(icon: DatabaseIcon): Promise<FaviconGenerationResult> {
    try {
      console.log('[FaviconGenerator] Starting favicon generation from database icon:', icon.type);
      
      // 1. 获取源图片 Buffer
      const sourceBuffer = await this.getSourceImageBuffer(icon);
      
      // 2. 生成多尺寸 favicon
      const generatedFiles = await this.generateAllSizes(sourceBuffer);
      
      console.log('[FaviconGenerator] Successfully generated favicons:', generatedFiles);
      
      return {
        success: true,
        generatedFiles,
      };
    } catch (error: any) {
      console.error('[FaviconGenerator] Failed to generate favicons:', error?.message || error);
      return {
        success: false,
        generatedFiles: [],
        error: error?.message || 'Unknown error',
      };
    }
  }

  /**
   * 使用默认 favicon（当数据库图标不可用时）
   */
  async useDefaultFavicon(): Promise<FaviconGenerationResult> {
    try {
      console.log('[FaviconGenerator] Using default favicon');
      
      // 检查是否已有默认 favicon 文件
      const defaultFaviconPath = path.join(this.outputDir, 'favicon.ico');
      
      try {
        await fs.access(defaultFaviconPath);
        const stats = await fs.stat(defaultFaviconPath);
        console.log(`[FaviconGenerator] Default favicon already exists (${stats.size} bytes)`);
        return {
          success: true,
          generatedFiles: [defaultFaviconPath],
        };
      } catch {
        // 默认 favicon 不存在，创建一个基于站点名称的占位符
        console.log('[FaviconGenerator] No default favicon found, generating placeholder');
        return await this.generatePlaceholderFavicon();
      }
    } catch (error: any) {
      console.error('[FaviconGenerator] Failed to use default favicon:', error?.message || error);
      
      // 最后的回退：尝试创建最简单的占位符
      try {
        return await this.generateMinimalFavicon();
      } catch (fallbackError: any) {
        console.error('[FaviconGenerator] Even minimal favicon generation failed:', fallbackError?.message || fallbackError);
        return {
          success: false,
          generatedFiles: [],
          error: `All favicon generation methods failed: ${error?.message || error}`,
        };
      }
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * 根据图标类型获取源图片 Buffer
   */
  private async getSourceImageBuffer(icon: DatabaseIcon): Promise<Buffer> {
    switch (icon.type) {
      case 'emoji':
        return await this.convertEmojiToBuffer(icon.emoji!);
      
      case 'external':
      case 'file':
        const url = icon.type === 'external' ? icon.external!.url : icon.file!.url;
        return await this.downloadImageFromUrl(url);
      
      default:
        throw new Error(`Unsupported icon type: ${(icon as any).type}`);
    }
  }

  /**
   * 将 emoji 转换为图片 Buffer
   */
  private async convertEmojiToBuffer(emoji: string): Promise<Buffer> {
    try {
      // 使用 SVG 方式生成 emoji 图片
      const svgContent = this.createEmojiSvg(emoji);
      
      // 使用 sharp 将 SVG 转换为 PNG
      const buffer = await sharp(Buffer.from(svgContent))
        .png()
        .resize(512, 512) // 生成高分辨率版本
        .toBuffer();
      
      return buffer;
    } catch (error: any) {
      throw new Error(`Failed to convert emoji to image: ${error?.message || error}`);
    }
  }

  /**
   * 创建 emoji SVG
   */
  private createEmojiSvg(emoji: string): string {
    return `
      <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
        <rect width="512" height="512" fill="transparent"/>
        <text x="256" y="350" font-size="400" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">
          ${emoji}
        </text>
      </svg>
    `.trim();
  }

  /**
   * 从 URL 下载图片（带重试逻辑）
   */
  private async downloadImageFromUrl(url: string, retries: number = 3): Promise<Buffer> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[FaviconGenerator] Downloading image from: ${url} (attempt ${attempt}/${retries})`);
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; FaviconGenerator/1.0)',
          },
          // 10 秒超时
          signal: AbortSignal.timeout(10000),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType && !contentType.startsWith('image/')) {
          throw new Error(`Invalid content type: ${contentType}, expected image/*`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // 验证是否为有效图片
        await this.validateImageBuffer(buffer);
        
        console.log(`[FaviconGenerator] Successfully downloaded image (${buffer.length} bytes)`);
        return buffer;
        
      } catch (error: any) {
        lastError = error;
        console.warn(`[FaviconGenerator] Download attempt ${attempt} failed:`, error?.message || error);
        
        if (attempt < retries) {
          // 指数退避：1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`[FaviconGenerator] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Failed to download image after ${retries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * 验证图片 Buffer 是否有效
   */
  private async validateImageBuffer(buffer: Buffer): Promise<void> {
    try {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image: no dimensions');
      }
      if (metadata.width < 16 || metadata.height < 16) {
        throw new Error(`Image too small: ${metadata.width}x${metadata.height}, minimum 16x16`);
      }
      if (metadata.width > 2048 || metadata.height > 2048) {
        console.warn(`[FaviconGenerator] Large image detected: ${metadata.width}x${metadata.height}, will be resized`);
      }
    } catch (error: any) {
      throw new Error(`Image validation failed: ${error?.message || error}`);
    }
  }

  /**
   * 生成所有尺寸的 favicon 文件
   */
  private async generateAllSizes(sourceBuffer: Buffer): Promise<string[]> {
    const generatedFiles: string[] = [];
    let totalSize = 0;
    const MAX_TOTAL_SIZE = 50 * 1024; // 50KB 限制
    
    // 确保输出目录存在
    await fs.mkdir(this.outputDir, { recursive: true });
    
    // 预处理：确保图片是方形的
    const processedBuffer = await this.ensureSquareImage(sourceBuffer);
    
    // 生成各种尺寸
    for (const size of FAVICON_SIZES) {
      const filename = this.getFilenameForSize(size);
      const outputPath = path.join(this.outputDir, filename);
      
      // 根据尺寸调整质量以控制文件大小
      const quality = this.getQualityForSize(size);
      
      await sharp(processedBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }, // 透明背景
        })
        .png({ quality, compressionLevel: 9 }) // 最高压缩
        .toFile(outputPath);
      
      // 检查文件大小
      const stats = await fs.stat(outputPath);
      totalSize += stats.size;
      
      console.log(`[FaviconGenerator] Generated ${filename}: ${stats.size} bytes`);
      generatedFiles.push(outputPath);
    }
    
    // 生成 ICO 文件（使用 32x32 版本）
    const icoPath = path.join(this.outputDir, FAVICON_FILES.ico);
    await sharp(processedBuffer)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ quality: 90, compressionLevel: 9 })
      .toFile(icoPath.replace('.ico', '.png'));
    
    // 重命名为 .ico（浏览器通常能处理 PNG 格式的 .ico 文件）
    await fs.rename(icoPath.replace('.ico', '.png'), icoPath);
    
    const icoStats = await fs.stat(icoPath);
    totalSize += icoStats.size;
    generatedFiles.push(icoPath);
    
    console.log(`[FaviconGenerator] Total favicon bundle size: ${totalSize} bytes (${(totalSize/1024).toFixed(1)}KB)`);
    
    if (totalSize > MAX_TOTAL_SIZE) {
      console.warn(`[FaviconGenerator] Warning: Total favicon size (${(totalSize/1024).toFixed(1)}KB) exceeds recommended limit (${MAX_TOTAL_SIZE/1024}KB)`);
    }
    
    return generatedFiles;
  }

  /**
   * 根据尺寸获取合适的质量设置
   */
  private getQualityForSize(size: number): number {
    // 小尺寸使用更高质量，大尺寸使用较低质量以控制文件大小
    if (size <= 32) return 95;
    if (size <= 192) return 85;
    return 75;
  }

  /**
   * 确保图片是方形的
   */
  private async ensureSquareImage(buffer: Buffer): Promise<Buffer> {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to determine image dimensions');
    }
    
    // 如果已经是方形，直接返回
    if (metadata.width === metadata.height) {
      return buffer;
    }
    
    // 计算方形尺寸（使用较大的边）
    const size = Math.max(metadata.width, metadata.height);
    
    // 居中裁剪或添加透明填充
    return await image
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
  }

  /**
   * 根据尺寸获取文件名
   */
  private getFilenameForSize(size: number): string {
    switch (size) {
      case 16:
        return FAVICON_FILES.png16;
      case 32:
        return FAVICON_FILES.png32;
      case 192:
        return FAVICON_FILES.appleTouchIcon;
      case 512:
        return FAVICON_FILES.androidChrome;
      default:
        return `favicon-${size}x${size}.png`;
    }
  }

  /**
   * 生成占位符 favicon（基于站点名称）
   */
  private async generatePlaceholderFavicon(): Promise<FaviconGenerationResult> {
    try {
      console.log('[FaviconGenerator] Generating placeholder favicon');
      
      // 尝试从环境变量或默认值获取站点名称的首字母
      const siteName = process.env.SITE_NAME || 'Mextric';
      const initial = siteName.charAt(0).toUpperCase();
      
      // 创建一个基于首字母的 SVG
      const placeholderSvg = `
        <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="6" fill="url(#grad)"/>
          <text x="16" y="22" font-size="18" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-weight="600">
            ${initial}
          </text>
        </svg>
      `.trim();
      
      const buffer = await sharp(Buffer.from(placeholderSvg))
        .png({ quality: 95 })
        .toBuffer();
      
      // 确保输出目录存在
      await fs.mkdir(this.outputDir, { recursive: true });
      
      // 生成基本的 favicon 文件
      const faviconPath = path.join(this.outputDir, 'favicon.ico');
      await fs.writeFile(faviconPath, buffer);
      
      // 也生成一个 PNG 版本
      const pngPath = path.join(this.outputDir, 'favicon-32x32.png');
      await fs.writeFile(pngPath, buffer);
      
      console.log(`[FaviconGenerator] Generated placeholder favicon with initial "${initial}"`);
      
      return {
        success: true,
        generatedFiles: [faviconPath, pngPath],
      };
    } catch (error: any) {
      throw new Error(`Failed to generate placeholder favicon: ${error?.message || error}`);
    }
  }

  /**
   * 生成最简单的 favicon（最后的回退方案）
   */
  private async generateMinimalFavicon(): Promise<FaviconGenerationResult> {
    try {
      console.log('[FaviconGenerator] Generating minimal fallback favicon');
      
      // 创建一个非常简单的单色方块
      const minimalSvg = `
        <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
          <rect width="16" height="16" fill="#6366f1"/>
        </svg>
      `.trim();
      
      const buffer = await sharp(Buffer.from(minimalSvg))
        .png()
        .toBuffer();
      
      // 确保输出目录存在
      await fs.mkdir(this.outputDir, { recursive: true });
      
      const faviconPath = path.join(this.outputDir, 'favicon.ico');
      await fs.writeFile(faviconPath, buffer);
      
      console.log('[FaviconGenerator] Generated minimal fallback favicon');
      
      return {
        success: true,
        generatedFiles: [faviconPath],
      };
    } catch (error: any) {
      throw new Error(`Failed to generate minimal favicon: ${error?.message || error}`);
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 生成 favicon 的便捷函数（带完整错误处理）
 */
export async function generateFavicon(
  icon?: DatabaseIcon,
  outputDir: string = 'public'
): Promise<FaviconGenerationResult> {
  const generator = new FaviconGenerator(outputDir);
  
  // 如果没有图标，直接使用默认
  if (!icon) {
    console.log('[generateFavicon] No icon provided, using default favicon');
    return await generator.useDefaultFavicon();
  }
  
  // 验证图标数据
  const validationError = validateDatabaseIcon(icon);
  if (validationError) {
    console.warn(`[generateFavicon] Invalid icon data: ${validationError}, falling back to default`);
    return await generator.useDefaultFavicon();
  }
  
  // 尝试从数据库图标生成
  try {
    console.log(`[generateFavicon] Generating favicon from ${icon.type} icon`);
    const result = await generator.generateFromDatabaseIcon(icon);
    
    if (result.success) {
      console.log(`[generateFavicon] Successfully generated ${result.generatedFiles.length} favicon files`);
      return result;
    } else {
      console.warn(`[generateFavicon] Generation failed: ${result.error}, falling back to default`);
      return await generator.useDefaultFavicon();
    }
  } catch (error: any) {
    console.warn(`[generateFavicon] Exception during generation: ${error?.message || error}, falling back to default`);
    return await generator.useDefaultFavicon();
  }
}

/**
 * 验证数据库图标数据
 */
function validateDatabaseIcon(icon: DatabaseIcon): string | null {
  if (!icon || typeof icon !== 'object') {
    return 'Icon is null or not an object';
  }
  
  if (!icon.type) {
    return 'Icon type is missing';
  }
  
  switch (icon.type) {
    case 'emoji':
      if (!icon.emoji || typeof icon.emoji !== 'string' || icon.emoji.trim() === '') {
        return 'Emoji icon is missing or empty';
      }
      // 简单的 emoji 验证（检查是否包含 Unicode emoji 字符）
      if (!/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(icon.emoji)) {
        console.warn(`[validateDatabaseIcon] Emoji "${icon.emoji}" may not be a valid emoji character`);
      }
      break;
      
    case 'external':
      if (!icon.external?.url || typeof icon.external.url !== 'string') {
        return 'External icon URL is missing or invalid';
      }
      if (!isValidUrl(icon.external.url)) {
        return `External icon URL is not valid: ${icon.external.url}`;
      }
      break;
      
    case 'file':
      if (!icon.file?.url || typeof icon.file.url !== 'string') {
        return 'File icon URL is missing or invalid';
      }
      if (!isValidUrl(icon.file.url)) {
        return `File icon URL is not valid: ${icon.file.url}`;
      }
      // 检查是否为 Notion 文件 URL
      if (!icon.file.url.includes('amazonaws.com') && !icon.file.url.includes('notion.so')) {
        console.warn(`[validateDatabaseIcon] File URL may not be from Notion: ${icon.file.url}`);
      }
      break;
      
    default:
      return `Unknown icon type: ${(icon as any).type}`;
  }
  
  return null; // 验证通过
}

/**
 * 验证 URL 格式
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 安全的 favicon 生成函数（保证不会抛出异常）
 */
export async function generateFaviconSafe(
  icon?: DatabaseIcon,
  outputDir: string = 'public'
): Promise<FaviconGenerationResult> {
  try {
    return await generateFavicon(icon, outputDir);
  } catch (error: any) {
    console.error(`[generateFaviconSafe] Unexpected error: ${error?.message || error}`);
    
    // 最后的回退：尝试生成最简单的默认 favicon
    try {
      const generator = new FaviconGenerator(outputDir);
      return await generator.useDefaultFavicon();
    } catch (fallbackError: any) {
      console.error(`[generateFaviconSafe] Even default favicon failed: ${fallbackError?.message || fallbackError}`);
      return {
        success: false,
        generatedFiles: [],
        error: `All favicon generation methods failed: ${error?.message || error}`,
      };
    }
  }
}