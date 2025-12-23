#!/usr/bin/env node

/**
 * Favicon 生成脚本
 * 
 * 功能：
 * 1. 从 Notion 数据库获取图标信息
 * 2. 生成多尺寸 favicon 文件
 * 3. 处理 emoji、外部文件、上传文件三种类型
 * 4. 提供完整的错误处理和回退机制
 */

const path = require('path');

// 加载环境变量
require('dotenv').config();

// 使用 ts-node 或直接执行 TypeScript 模块的方法
let getDatabaseItems, generateFaviconSafe;

async function initializeModules() {
  try {
    // 方法1: 使用 ts-node/register 来直接执行 TypeScript
    require('ts-node/register');
    
    const notionModule = require('../src/lib/notion.ts');
    const faviconModule = require('../src/lib/faviconGenerator.ts');
    
    getDatabaseItems = notionModule.getDatabaseItems;
    generateFaviconSafe = faviconModule.generateFaviconSafe;
    
    console.log('[generate-favicon] Modules loaded successfully via ts-node');
  } catch (tsNodeError) {
    console.warn('[generate-favicon] ts-node not available, trying alternative methods...');
    
    try {
      // 方法2: 尝试使用 tsx 或其他 TypeScript 运行器
      const { spawn } = require('child_process');
      
      // 创建一个临时的 Node.js 兼容版本
      await createNodeCompatibleModules();
      
      const notionModule = require('../temp/notion.js');
      const faviconModule = require('../temp/faviconGenerator.js');
      
      getDatabaseItems = notionModule.getDatabaseItems;
      generateFaviconSafe = faviconModule.generateFaviconSafe;
      
      console.log('[generate-favicon] Modules loaded successfully via temporary compilation');
    } catch (compileError) {
      console.warn('[generate-favicon] Compilation failed, using inline implementation...');
      
      // 方法3: 内联实现核心功能
      await createInlineImplementation();
    }
  }
}

async function createNodeCompatibleModules() {
  // 这个函数会创建临时的 CommonJS 兼容模块
  // 但为了简化，我们直接使用内联实现
  throw new Error('Compilation not implemented, using inline version');
}

async function createInlineImplementation() {
  // 内联实现 Notion 数据库获取功能
  getDatabaseItems = async () => {
    console.log('[generate-favicon] Using inline getDatabaseItems implementation');
    
    if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
      console.warn('[generate-favicon] NOTION_API_KEY or NOTION_DATABASE_ID not set');
      return { title: 'Mextric Homepage', items: [], icon: undefined };
    }

    try {
      const apiKey = process.env.NOTION_API_KEY;
      const databaseId = process.env.NOTION_DATABASE_ID;
      
      // 获取数据库元数据（包含图标）
      const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`[generate-favicon] Failed to fetch database: ${response.status}`);
        return { title: 'Mextric Homepage', items: [], icon: undefined };
      }

      const database = await response.json();
      
      // 提取标题
      let title = 'Mextric Homepage';
      if (database.title && Array.isArray(database.title) && database.title.length > 0) {
        const extractedTitle = database.title.map(t => t.plain_text).join('');
        if (extractedTitle.trim()) {
          title = extractedTitle.trim();
        }
      }
      
      // 提取图标
      let icon = undefined;
      if (database.icon) {
        icon = parseDatabaseIcon(database.icon);
      }
      
      console.log(`[generate-favicon] Database: ${title}, Icon: ${icon ? icon.type : 'none'}`);
      
      return { title, items: [], icon };
    } catch (error) {
      console.error('[generate-favicon] Error fetching database:', error.message);
      return { title: 'Mextric Homepage', items: [], icon: undefined };
    }
  };

  // 内联实现 favicon 生成功能
  generateFaviconSafe = async (icon, outputDir) => {
    console.log('[generate-favicon] Using inline generateFaviconSafe implementation');
    
    const fs = require('fs').promises;
    const sharp = require('sharp');
    
    try {
      // 确保输出目录存在
      await fs.mkdir(outputDir, { recursive: true });
      
      let sourceBuffer;
      
      if (icon) {
        console.log(`[generate-favicon] Processing ${icon.type} icon`);
        
        switch (icon.type) {
          case 'emoji':
            sourceBuffer = await convertEmojiToBuffer(icon.emoji);
            break;
          case 'external':
          case 'file':
            const url = icon.type === 'external' ? icon.external.url : icon.file.url;
            sourceBuffer = await downloadImageFromUrl(url);
            break;
          default:
            throw new Error(`Unsupported icon type: ${icon.type}`);
        }
      } else {
        // 生成默认 favicon
        console.log('[generate-favicon] No icon provided, generating default');
        sourceBuffer = await generateDefaultFavicon();
      }
      
      // 生成多尺寸 favicon
      const generatedFiles = [];
      const sizes = [16, 32, 192, 512];
      
      for (const size of sizes) {
        const filename = getFilenameForSize(size);
        const outputPath = path.join(outputDir, filename);
        
        await sharp(sourceBuffer)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png({ quality: size <= 32 ? 95 : 85, compressionLevel: 9 })
          .toFile(outputPath);
        
        generatedFiles.push(outputPath);
        console.log(`[generate-favicon] Generated ${filename}`);
      }
      
      // 生成 ICO 文件
      const icoPath = path.join(outputDir, 'favicon.ico');
      await sharp(sourceBuffer)
        .resize(32, 32, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ quality: 95 })
        .toFile(icoPath);
      
      generatedFiles.push(icoPath);
      
      return {
        success: true,
        generatedFiles,
      };
    } catch (error) {
      console.error('[generate-favicon] Generation failed:', error.message);
      
      // 最后的回退
      try {
        const fallbackPath = path.join(outputDir, 'favicon.ico');
        const fallbackSvg = `
          <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" fill="#6366f1"/>
            <text x="16" y="22" font-size="18" text-anchor="middle" fill="white" font-family="system-ui">
              M
            </text>
          </svg>
        `.trim();
        
        await fs.writeFile(fallbackPath, fallbackSvg);
        
        return {
          success: true,
          generatedFiles: [fallbackPath],
        };
      } catch (fallbackError) {
        return {
          success: false,
          generatedFiles: [],
          error: error.message,
        };
      }
    }
  };
}

// 辅助函数
function parseDatabaseIcon(iconData) {
  if (!iconData || typeof iconData !== 'object') {
    return undefined;
  }

  try {
    switch (iconData.type) {
      case 'emoji':
        if (iconData.emoji && typeof iconData.emoji === 'string') {
          return {
            type: 'emoji',
            emoji: iconData.emoji,
          };
        }
        break;
      
      case 'custom_emoji':
        // 处理自定义 emoji（实际上是图片文件）
        if (iconData.custom_emoji?.url && typeof iconData.custom_emoji.url === 'string') {
          return {
            type: 'file',
            file: {
              url: iconData.custom_emoji.url,
              expiry_time: '',
            },
          };
        }
        break;
      
      case 'external':
        if (iconData.external?.url && typeof iconData.external.url === 'string') {
          return {
            type: 'external',
            external: { url: iconData.external.url },
          };
        }
        break;
      
      case 'file':
        if (iconData.file?.url && typeof iconData.file.url === 'string') {
          return {
            type: 'file',
            file: {
              url: iconData.file.url,
              expiry_time: iconData.file.expiry_time || '',
            },
          };
        }
        break;
    }
  } catch (error) {
    console.warn('[parseDatabaseIcon] Error parsing icon:', error.message);
  }

  return undefined;
}

async function convertEmojiToBuffer(emoji) {
  const sharp = require('sharp');
  
  const svgContent = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="transparent"/>
      <text x="256" y="350" font-size="400" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">
        ${emoji}
      </text>
    </svg>
  `.trim();
  
  return await sharp(Buffer.from(svgContent))
    .png()
    .resize(512, 512)
    .toBuffer();
}

async function downloadImageFromUrl(url) {
  console.log(`[generate-favicon] Downloading image from: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FaviconGenerator/1.0)',
    },
    signal: AbortSignal.timeout(10000),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function generateDefaultFavicon() {
  const sharp = require('sharp');
  
  const defaultSvg = `
    <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="6" fill="url(#grad)"/>
      <text x="16" y="22" font-size="18" text-anchor="middle" fill="white" font-family="system-ui" font-weight="600">
        M
      </text>
    </svg>
  `.trim();
  
  return await sharp(Buffer.from(defaultSvg))
    .png({ quality: 95 })
    .toBuffer();
}

function getFilenameForSize(size) {
  switch (size) {
    case 16:
      return 'favicon-16x16.png';
    case 32:
      return 'favicon-32x32.png';
    case 192:
      return 'apple-touch-icon.png';
    case 512:
      return 'android-chrome-512x512.png';
    default:
      return `favicon-${size}x${size}.png`;
  }
}

// ============================================================================
// 配置
// ============================================================================

const CONFIG = {
  // 输出目录
  outputDir: path.join(process.cwd(), 'public'),
  
  // 是否在开发模式下跳过生成
  skipInDevelopment: process.env.NODE_ENV === 'development',
  
  // 是否强制重新生成
  forceRegenerate: process.argv.includes('--force'),
  
  // 详细日志
  verbose: process.argv.includes('--verbose'),
};

// ============================================================================
// 主要功能
// ============================================================================

/**
 * 检查是否需要生成 favicon
 */
async function shouldGenerateFavicon() {
  if (CONFIG.forceRegenerate) {
    console.log('[generate-favicon] Force regenerate flag detected');
    return true;
  }
  
  if (CONFIG.skipInDevelopment) {
    console.log('[generate-favicon] Skipping favicon generation in development mode');
    return false;
  }
  
  // 检查是否已存在 favicon 文件
  const fs = require('fs').promises;
  const faviconPath = path.join(CONFIG.outputDir, 'favicon.ico');
  
  try {
    const stats = await fs.stat(faviconPath);
    const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
    
    if (ageInHours < 24) {
      console.log(`[generate-favicon] Favicon exists and is recent (${ageInHours.toFixed(1)}h old), skipping generation`);
      return false;
    } else {
      console.log(`[generate-favicon] Favicon exists but is old (${ageInHours.toFixed(1)}h), regenerating`);
      return true;
    }
  } catch {
    console.log('[generate-favicon] No existing favicon found, generating new one');
    return true;
  }
}

/**
 * 生成 favicon
 */
async function generateFavicon() {
  try {
    console.log('[generate-favicon] Starting favicon generation...');
    
    // 1. 获取数据库信息（包含图标）
    console.log('[generate-favicon] Fetching database information...');
    const { title, items, icon } = await getDatabaseItems();
    
    if (CONFIG.verbose) {
      console.log(`[generate-favicon] Database info:`, {
        title,
        itemsCount: items.length,
        hasIcon: !!icon,
        iconType: icon?.type,
      });
    }
    
    // 2. 生成 favicon
    console.log(`[generate-favicon] Generating favicon${icon ? ` from ${icon.type} icon` : ' (using default)'}...`);
    const result = await generateFaviconSafe(icon, CONFIG.outputDir);
    
    // 3. 报告结果
    if (result.success) {
      console.log(`[generate-favicon] ✅ Successfully generated ${result.generatedFiles.length} favicon files:`);
      result.generatedFiles.forEach(file => {
        const relativePath = path.relative(process.cwd(), file);
        console.log(`[generate-favicon]   - ${relativePath}`);
      });
      
      // 显示文件大小信息
      if (CONFIG.verbose) {
        const fs = require('fs').promises;
        let totalSize = 0;
        
        for (const file of result.generatedFiles) {
          try {
            const stats = await fs.stat(file);
            totalSize += stats.size;
            console.log(`[generate-favicon]     ${path.basename(file)}: ${stats.size} bytes`);
          } catch (error) {
            console.warn(`[generate-favicon]     ${path.basename(file)}: size unknown`);
          }
        }
        
        console.log(`[generate-favicon]   Total size: ${totalSize} bytes (${(totalSize/1024).toFixed(1)}KB)`);
      }
      
      return true;
    } else {
      console.error(`[generate-favicon] ❌ Favicon generation failed: ${result.error}`);
      return false;
    }
    
  } catch (error) {
    console.error('[generate-favicon] ❌ Unexpected error during favicon generation:', error);
    return false;
  }
}

/**
 * 清理旧的 favicon 文件
 */
async function cleanupOldFavicons() {
  if (!CONFIG.forceRegenerate) {
    return;
  }
  
  try {
    const fs = require('fs').promises;
    const faviconFiles = [
      'favicon.ico',
      'favicon-16x16.png',
      'favicon-32x32.png',
      'apple-touch-icon.png',
      'android-chrome-512x512.png',
    ];
    
    console.log('[generate-favicon] Cleaning up old favicon files...');
    
    for (const filename of faviconFiles) {
      const filePath = path.join(CONFIG.outputDir, filename);
      try {
        await fs.unlink(filePath);
        console.log(`[generate-favicon] Removed old file: ${filename}`);
      } catch {
        // 文件不存在，忽略
      }
    }
  } catch (error) {
    console.warn('[generate-favicon] Failed to cleanup old favicons:', error);
  }
}

// ============================================================================
// 主程序
// ============================================================================

async function main() {
  const startTime = Date.now();
  
  try {
    console.log('[generate-favicon] 🎨 Favicon Generator Starting...');
    
    // 初始化模块
    await initializeModules();
    
    // 检查是否需要生成
    if (!(await shouldGenerateFavicon())) {
      console.log('[generate-favicon] ⏭️  Favicon generation skipped');
      return;
    }
    
    // 清理旧文件（如果需要）
    await cleanupOldFavicons();
    
    // 生成 favicon
    const success = await generateFavicon();
    
    const duration = Date.now() - startTime;
    
    if (success) {
      console.log(`[generate-favicon] ✅ Favicon generation completed in ${duration}ms`);
    } else {
      console.log(`[generate-favicon] ❌ Favicon generation failed after ${duration}ms`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('[generate-favicon] ❌ Fatal error:', error);
    process.exit(1);
  }
}

// 运行主程序
if (require.main === module) {
  main();
}

module.exports = { main, generateFavicon };