#!/usr/bin/env node

/**
 * 🔍 部署配置检查工具
 * 
 * 检查项目配置是否完整，帮助用户快速发现问题
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 检查部署配置...\n');

const checks = [];
let hasErrors = false;

// 检查环境变量文件
function checkEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  
  if (!fs.existsSync(envPath)) {
    checks.push({
      status: '❌',
      item: '.env 文件',
      message: '缺失 .env 文件，请复制 .env.example 并填入配置'
    });
    hasErrors = true;
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  if (!envContent.includes('NOTION_API_KEY=') || envContent.includes('NOTION_API_KEY=your_notion_api_key_here')) {
    checks.push({
      status: '❌',
      item: 'NOTION_API_KEY',
      message: '请在 .env 文件中设置正确的 Notion API Key'
    });
    hasErrors = true;
  } else {
    checks.push({
      status: '✅',
      item: 'NOTION_API_KEY',
      message: '已配置'
    });
  }
  
  if (!envContent.includes('NOTION_DATABASE_ID=') || envContent.includes('NOTION_DATABASE_ID=your_notion_database_id_here')) {
    checks.push({
      status: '❌',
      item: 'NOTION_DATABASE_ID',
      message: '请在 .env 文件中设置正确的 Notion Database ID'
    });
    hasErrors = true;
  } else {
    checks.push({
      status: '✅',
      item: 'NOTION_DATABASE_ID',
      message: '已配置'
    });
  }
}

// 检查配置文件
function checkConfigFile() {
  const configPath = path.join(process.cwd(), 'src/lib/config.ts');
  
  if (!fs.existsSync(configPath)) {
    checks.push({
      status: '❌',
      item: '配置文件',
      message: '缺失 src/lib/config.ts 文件'
    });
    hasErrors = true;
    return;
  }
  
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  // 检查是否还是默认配置
  if (configContent.includes('Your Name') || configContent.includes('your-site.vercel.app')) {
    checks.push({
      status: '⚠️',
      item: '个人信息',
      message: '建议更新 src/lib/config.ts 中的个人信息'
    });
  } else {
    checks.push({
      status: '✅',
      item: '个人信息',
      message: '已配置'
    });
  }
}

// 检查 OG 图片
function checkOGImage() {
  const ogImagePath = path.join(process.cwd(), 'public/og-image.png');
  
  if (!fs.existsSync(ogImagePath)) {
    checks.push({
      status: '⚠️',
      item: 'OG 图片',
      message: '建议添加 public/og-image.png 用于社交分享'
    });
  } else {
    const stats = fs.statSync(ogImagePath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    
    if (fileSizeInMB > 1) {
      checks.push({
        status: '⚠️',
        item: 'OG 图片',
        message: `图片大小 ${fileSizeInMB.toFixed(2)}MB，建议压缩到 1MB 以下`
      });
    } else {
      checks.push({
        status: '✅',
        item: 'OG 图片',
        message: '已配置'
      });
    }
  }
}

// 检查 package.json
function checkPackageJson() {
  const packagePath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packagePath)) {
    checks.push({
      status: '❌',
      item: 'package.json',
      message: '缺失 package.json 文件'
    });
    hasErrors = true;
    return;
  }
  
  const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  // 检查必需的依赖
  const requiredDeps = ['@notionhq/client', 'next', 'react', 'framer-motion'];
  const missingDeps = requiredDeps.filter(dep => !packageContent.dependencies[dep]);
  
  if (missingDeps.length > 0) {
    checks.push({
      status: '❌',
      item: '项目依赖',
      message: `缺失依赖: ${missingDeps.join(', ')}`
    });
    hasErrors = true;
  } else {
    checks.push({
      status: '✅',
      item: '项目依赖',
      message: '已安装'
    });
  }
}

// 执行所有检查
checkEnvFile();
checkConfigFile();
checkOGImage();
checkPackageJson();

// 输出结果
console.log('📋 配置检查结果:\n');

checks.forEach(check => {
  console.log(`${check.status} ${check.item}: ${check.message}`);
});

console.log('\n' + '='.repeat(50));

if (hasErrors) {
  console.log('❌ 发现配置问题，请参考 DEPLOYMENT_GUIDE.md 进行修复');
  process.exit(1);
} else {
  console.log('🎉 配置检查通过！你的项目已准备好部署');
  console.log('\n💡 下一步:');
  console.log('1. 运行 npm run build 测试构建');
  console.log('2. 部署到 Vercel');
  console.log('3. 配置环境变量');
}

console.log('\n📚 详细指南: DEPLOYMENT_GUIDE.md');