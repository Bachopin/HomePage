#!/usr/bin/env node

/**
 * 图片优化脚本
 * 
 * 功能：
 * 1. 从 Notion 下载所有图片
 * 2. 生成多种尺寸和格式
 * 3. 压缩并保存到本地
 * 4. 更新图片 URL 映射
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const sharp = require('sharp');

// 动态导入 ES 模块
let getDatabaseItems;

async function initializeNotionModule() {
  try {
    const notionModule = await import('../src/lib/notion.js');
    getDatabaseItems = notionModule.getDatabaseItems;
  } catch (error) {
    console.error('Failed to import Notion module:', error);
    // 在构建时提供一个 fallback
    getDatabaseItems = async () => {
      console.warn('Notion module not available during build, returning empty result');
      return { title: 'Mextric Homepage', items: [] };
    };
  }
}

// ============================================================================
// 配置
// ============================================================================

const CONFIG = {
  // 输出目录
  outputDir: path.join(process.cwd(), 'public', 'images', 'optimized'),
  
  // 图片尺寸配置 - 高质量设置（确保视觉效果）
  sizes: {
    thumbnail: { width: 200, quality: 80 },   // 缩略图高质量
    medium: { width: 800, quality: 88 },      // 中等尺寸高质量  
    large: { width: 1200, quality: 92 },      // 大尺寸超高质量
  },
  
  // 支持的格式
  formats: ['webp', 'jpeg'],
  
  // 并发下载数
  concurrency: 5,
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 下载图片
 */
async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = require('fs').createWriteStream(outputPath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${url}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(outputPath).catch(() => {}); // 删除部分下载的文件
        reject(err);
      });
    }).on('error', reject);
  });
}

/**
 * 生成文件名
 */
function generateFileName(originalUrl, size, format) {
  // 从 URL 提取文件 ID
  const urlParts = originalUrl.split('/');
  const fileName = urlParts[urlParts.length - 1].split('?')[0];
  const baseName = path.parse(fileName).name || 'image';
  
  return `${baseName}_${size}.${format}`;
}

/**
 * 优化单张图片
 */
async function optimizeImage(inputPath, outputDir, baseName) {
  const results = {};
  
  // 分析图片特征，调整质量
  const metadata = await sharp(inputPath).metadata();
  const isHighDetail = metadata.width > 1500 || metadata.height > 1500;
  
  for (const [sizeName, config] of Object.entries(CONFIG.sizes)) {
    for (const format of CONFIG.formats) {
      const outputFileName = `${baseName}_${sizeName}.${format}`;
      const outputPath = path.join(outputDir, outputFileName);
      
      try {
        let pipeline = sharp(inputPath)
          .resize(config.width, null, {
            withoutEnlargement: true,
            fit: 'inside',
          });
        
        // 根据图片特征调整质量
        let quality = config.quality;
        if (isHighDetail && sizeName === 'large') {
          quality = Math.min(95, quality + 3); // 高细节图片提高质量
        }
        
        if (format === 'webp') {
          pipeline = pipeline.webp({ 
            quality,
            effort: 6, // 更好的压缩算法
            smartSubsample: true, // 智能子采样
          });
        } else if (format === 'jpeg') {
          pipeline = pipeline.jpeg({ 
            quality,
            progressive: true,
            mozjpeg: true, // 使用 mozjpeg 编码器（更好的质量）
          });
        }
        
        await pipeline.toFile(outputPath);
        
        // 获取文件信息
        const stats = await fs.stat(outputPath);
        
        if (!results[sizeName]) results[sizeName] = {};
        results[sizeName][format] = {
          path: `/images/optimized/${outputFileName}`,
          size: stats.size,
        };
        
        console.log(`✓ Generated: ${outputFileName} (${Math.round(stats.size / 1024)}KB, Q${quality})`);
      } catch (error) {
        console.error(`✗ Failed to generate ${outputFileName}:`, error.message);
      }
    }
  }
  
  return results;
}

/**
 * 处理单个图片项目
 */
async function processImageItem(item, index, total) {
  if (!item.image || item.image.trim() === '') {
    console.log(`[${index + 1}/${total}] Skipping ${item.title || 'Untitled'}: No image`);
    return null;
  }
  
  console.log(`[${index + 1}/${total}] Processing: ${item.title || 'Untitled'}`);
  
  try {
    // 生成基础文件名
    const baseName = `item_${item.id}`;
    const tempPath = path.join(CONFIG.outputDir, 'temp', `${baseName}_original`);
    
    // 确保临时目录存在
    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    
    // 下载原图
    console.log(`  Downloading: ${item.image}`);
    await downloadImage(item.image, tempPath);
    
    // 优化图片
    console.log(`  Optimizing...`);
    const optimizedVersions = await optimizeImage(tempPath, CONFIG.outputDir, baseName);
    
    // 删除临时文件
    await fs.unlink(tempPath).catch(() => {});
    
    return {
      id: item.id,
      title: item.title,
      originalUrl: item.image,
      optimized: optimizedVersions,
    };
  } catch (error) {
    console.error(`✗ Failed to process ${item.title || 'Untitled'}:`, error.message);
    return null;
  }
}

/**
 * 批量处理图片
 */
async function processImagesInBatches(items, batchSize = CONFIG.concurrency) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map((item, batchIndex) => 
      processImageItem(item, i + batchIndex, items.length)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter(Boolean));
    
    // 批次间稍作延迟，避免过载
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  try {
    console.log('🖼️ Starting image optimization...\n');
    
    // 初始化 Notion 模块
    await initializeNotionModule();
    
    // 检查依赖
    try {
      require('sharp');
    } catch (error) {
      console.error('❌ Sharp is required for image processing.');
      console.error('   Install it with: npm install sharp');
      process.exit(1);
    }
    
    // 创建输出目录
    await fs.mkdir(CONFIG.outputDir, { recursive: true });
    
    // 获取 Notion 数据
    console.log('📡 Fetching data from Notion...');
    const { items } = await getDatabaseItems();
    const imageItems = items.filter(item => item.image && item.image.trim() !== '');
    
    console.log(`Found ${imageItems.length} items with images\n`);
    
    if (imageItems.length === 0) {
      console.log('No images to process.');
      return;
    }
    
    // 处理图片
    const results = await processImagesInBatches(imageItems);
    
    // 生成映射文件
    const mappingPath = path.join(CONFIG.outputDir, 'image-mapping.json');
    await fs.writeFile(mappingPath, JSON.stringify(results, null, 2));
    
    // 统计信息
    const totalOriginalSize = results.reduce((sum, item) => {
      // 估算原图大小（无法准确获取，使用估算值）
      return sum + 2000000; // 假设每张原图 2MB
    }, 0);
    
    const totalOptimizedSize = results.reduce((sum, item) => {
      return sum + Object.values(item.optimized).reduce((sizeSum, sizeVersions) => {
        return sizeSum + Object.values(sizeVersions).reduce((formatSum, formatInfo) => {
          return formatSum + formatInfo.size;
        }, 0);
      }, 0);
    }, 0);
    
    console.log('\n✅ Image optimization completed!');
    console.log(`📊 Statistics:`);
    console.log(`   - Processed: ${results.length} images`);
    console.log(`   - Original size (estimated): ${Math.round(totalOriginalSize / 1024 / 1024)}MB`);
    console.log(`   - Optimized size: ${Math.round(totalOptimizedSize / 1024 / 1024)}MB`);
    console.log(`   - Savings: ${Math.round((1 - totalOptimizedSize / totalOriginalSize) * 100)}%`);
    console.log(`   - Mapping file: ${mappingPath}`);
    
  } catch (error) {
    console.error('❌ Error during image optimization:', error);
    process.exit(1);
  }
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = { main, processImageItem, optimizeImage };