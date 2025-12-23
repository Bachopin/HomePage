#!/usr/bin/env node

/**
 * 系统健康检查脚本
 * 
 * 功能：
 * 1. 检查环境变量
 * 2. 验证 Notion API 连接
 * 3. 测试图片优化功能
 * 4. 生成健康报告
 */

// 加载环境变量
require('dotenv').config();

const https = require('https');
const { Client } = require('@notionhq/client');

// ============================================================================
// 工具函数
// ============================================================================

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          size: Buffer.byteLength(data),
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// ============================================================================
// 健康检查函数
// ============================================================================

async function checkNotionConnection() {
  console.log('🔍 检查 Notion API 连接...');
  
  try {
    if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
      return {
        status: 'error',
        message: '缺少必需的环境变量 NOTION_API_KEY 或 NOTION_DATABASE_ID',
        details: {}
      };
    }

    const notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });

    // 测试数据库连接
    const response = await notion.databases.retrieve({
      database_id: process.env.NOTION_DATABASE_ID,
    });
    
    return {
      status: 'success',
      message: `Notion API 连接成功，数据库可访问`,
      details: {
        databaseTitle: response.title?.[0]?.plain_text || 'Unknown',
        databaseId: process.env.NOTION_DATABASE_ID.substring(0, 8) + '...'
      }
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Notion API 连接失败',
      details: { error: error.message }
    };
  }
}

async function checkImageProxy(baseUrl = 'http://localhost:3456') {
  console.log('🖼️ 检查图片代理服务...');
  
  try {
    // 使用一个测试图片 URL
    const testImageUrl = 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131';
    const proxyUrl = `${baseUrl}/api/image-proxy?url=${encodeURIComponent(testImageUrl)}&w=400&q=80&f=webp`;
    
    const response = await makeRequest(proxyUrl);
    
    if (response.statusCode === 200) {
      return {
        status: 'success',
        message: '图片代理服务正常',
        details: {
          responseSize: `${Math.round(response.size / 1024)}KB`,
          contentType: response.headers['content-type'],
          cacheControl: response.headers['cache-control'],
        }
      };
    } else {
      return {
        status: 'warning',
        message: `图片代理服务未运行 (状态: ${response.statusCode})`,
        details: { statusCode: response.statusCode, note: '这在构建时是正常的' }
      };
    }
  } catch (error) {
    return {
      status: 'warning',
      message: '图片代理服务不可用',
      details: { error: error.message, note: '这在构建时是正常的' }
    };
  }
}

async function checkImageOptimization() {
  console.log('⚡ 检查图片优化功能...');
  
  try {
    // 检查 Sharp 是否可用
    const sharp = require('sharp');
    
    // 创建一个测试图片
    const testBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    }).png().toBuffer();
    
    // 测试 WebP 转换
    const webpBuffer = await sharp(testBuffer)
      .resize(50, 50)
      .webp({ quality: 80 })
      .toBuffer();
    
    return {
      status: 'success',
      message: '图片优化功能正常',
      details: {
        sharpVersion: sharp.versions.sharp,
        originalSize: `${testBuffer.length}B`,
        optimizedSize: `${webpBuffer.length}B`,
        compressionRatio: `${Math.round((1 - webpBuffer.length / testBuffer.length) * 100)}%`,
      }
    };
  } catch (error) {
    return {
      status: 'error',
      message: '图片优化功能不可用',
      details: { error: error.message }
    };
  }
}

async function checkEnvironmentVariables() {
  console.log('🔧 检查环境变量...');
  
  const requiredVars = ['NOTION_API_KEY', 'NOTION_DATABASE_ID'];
  const missing = [];
  const present = [];
  
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      present.push(varName);
    } else {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    return {
      status: 'error',
      message: `缺少必需的环境变量: ${missing.join(', ')}`,
      details: { missing, present }
    };
  }
  
  return {
    status: 'success',
    message: '所有必需的环境变量都已设置',
    details: { present }
  };
}

// ============================================================================
// 主函数
// ============================================================================

async function runHealthCheck() {
  console.log('🏥 系统健康检查开始...\n');
  
  const checks = [
    { name: '环境变量', fn: checkEnvironmentVariables },
    { name: 'Notion 连接', fn: checkNotionConnection },
    { name: '图片优化', fn: checkImageOptimization },
    { name: '图片代理', fn: () => checkImageProxy() },
  ];
  
  const results = [];
  
  for (const check of checks) {
    try {
      const result = await check.fn();
      results.push({ name: check.name, ...result });
      
      const statusIcon = {
        success: '✅',
        warning: '⚠️',
        error: '❌'
      }[result.status];
      
      console.log(`${statusIcon} ${check.name}: ${result.message}`);
      
      if (result.details && Object.keys(result.details).length > 0) {
        console.log(`   详情:`, result.details);
      }
      
      console.log('');
    } catch (error) {
      results.push({
        name: check.name,
        status: 'error',
        message: '检查过程中发生错误',
        details: { error: error.message }
      });
      
      console.log(`❌ ${check.name}: 检查失败 - ${error.message}\n`);
    }
  }
  
  // 生成总结
  const successCount = results.filter(r => r.status === 'success').length;
  const warningCount = results.filter(r => r.status === 'warning').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  
  console.log('📊 健康检查总结:');
  console.log(`   ✅ 成功: ${successCount}`);
  console.log(`   ⚠️ 警告: ${warningCount}`);
  console.log(`   ❌ 错误: ${errorCount}`);
  console.log('');
  
  if (errorCount === 0) {
    console.log('🎉 系统运行正常！');
  } else if (errorCount === 1 && warningCount === 0) {
    console.log('⚠️ 系统基本正常，但有一些问题需要解决。');
  } else {
    console.log('🚨 系统存在问题，需要立即处理。');
  }
  
  // 返回结果供其他脚本使用
  return {
    overall: errorCount === 0 ? 'healthy' : 'unhealthy',
    results,
    summary: { successCount, warningCount, errorCount }
  };
}

// 运行检查
if (require.main === module) {
  runHealthCheck()
    .then(result => {
      process.exit(result.overall === 'healthy' ? 0 : 1);
    })
    .catch(error => {
      console.error('健康检查失败:', error);
      process.exit(1);
    });
}

module.exports = { runHealthCheck };