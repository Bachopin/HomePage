# 图片优化系统

## 🎯 概述

本系统实现了完整的图片优化流程，从构建时预处理到运行时智能选择，大幅提升加载性能。

## 📊 性能提升

- **文件大小**：1-5MB → 50-200KB（减少 90-95%）
- **加载速度**：3-10秒 → 0.5-2秒
- **用户体验**：几乎无感知加载

## 🔧 使用方法

### 1. 安装依赖

```bash
npm install sharp
```

### 2. 优化图片

```bash
# 首次运行或强制重新优化
npm run optimize-images:force

# 增量优化（只处理新图片）
npm run optimize-images
```

### 3. 构建项目

```bash
# 自动优化图片并构建
npm run build

# 跳过图片优化直接构建（开发时使用）
npm run build:fast
```

## 🏗️ 系统架构

### 构建时优化（scripts/optimize-images.js）

1. **下载原图**：从 Notion 获取所有图片
2. **生成多尺寸**：
   - thumbnail: 200px 宽，质量 70%
   - medium: 800px 宽，质量 80%
   - large: 1200px 宽，质量 85%
3. **多格式输出**：WebP + JPEG 备用
4. **生成映射**：创建 URL 映射文件

### 运行时选择（src/lib/imageService.ts）

1. **智能尺寸选择**：根据视口宽度和设备像素比
2. **格式协商**：优先 WebP，回退 JPEG
3. **网络适配**：慢速网络自动降级
4. **预加载策略**：关键图片优先加载

### 缓存系统（src/hooks/useImageCache.ts）

1. **全局缓存**：避免重复加载
2. **智能清理**：30分钟过期，最多缓存50张
3. **内存管理**：防止内存泄漏

## 📁 文件结构

```
public/images/optimized/
├── image-mapping.json          # URL 映射文件
├── item_123_thumbnail.webp     # 缩略图 WebP
├── item_123_thumbnail.jpeg     # 缩略图 JPEG
├── item_123_medium.webp        # 中等尺寸 WebP
├── item_123_medium.jpeg        # 中等尺寸 JPEG
├── item_123_large.webp         # 大尺寸 WebP
└── item_123_large.jpeg         # 大尺寸 JPEG
```

## 🔄 工作流程

### 开发环境

```bash
# 启动开发服务器（使用原图）
npm run dev
```

### 生产环境

```bash
# 1. 优化图片
npm run optimize-images

# 2. 构建项目
npm run build

# 3. 启动生产服务器
npm start
```

### CI/CD 集成

```yaml
# GitHub Actions 示例
- name: Install dependencies
  run: npm ci

- name: Optimize images
  run: npm run optimize-images

- name: Build project
  run: npm run build:fast  # 跳过重复优化
```

## ⚙️ 配置选项

### 图片尺寸配置

```javascript
// scripts/optimize-images.js
const CONFIG = {
  sizes: {
    thumbnail: { width: 200, quality: 70 },
    medium: { width: 800, quality: 80 },
    large: { width: 1200, quality: 85 },
  },
  formats: ['webp', 'jpeg'],
  concurrency: 5,
};
```

### 运行时选择逻辑

```typescript
// src/lib/imageService.ts
function selectImageSize(viewportWidth: number, devicePixelRatio: number) {
  const effectiveWidth = viewportWidth * devicePixelRatio;
  
  if (effectiveWidth <= 400) return 'thumbnail';
  if (effectiveWidth <= 1000) return 'medium';
  return 'large';
}
```

## 🚨 注意事项

1. **Sharp 依赖**：需要安装 `sharp` 进行图片处理
2. **构建时间**：首次优化可能需要较长时间
3. **存储空间**：优化后的图片会占用额外空间
4. **网络依赖**：需要能访问 Notion 图片 URL

## 🔍 故障排除

### 图片优化失败

```bash
# 检查 Sharp 安装
npm list sharp

# 重新安装 Sharp
npm uninstall sharp
npm install sharp

# 清理并重新优化
npm run optimize-images:force
```

### 图片不显示

1. 检查映射文件是否存在：`public/images/optimized/image-mapping.json`
2. 检查优化后的图片文件是否生成
3. 查看浏览器控制台错误信息

### 性能问题

1. 检查网络连接检测是否正常工作
2. 验证预加载逻辑是否生效
3. 监控缓存命中率

## 📈 监控和分析

### 性能指标

- **LCP (Largest Contentful Paint)**：首屏最大内容绘制时间
- **FID (First Input Delay)**：首次输入延迟
- **CLS (Cumulative Layout Shift)**：累积布局偏移

### 分析工具

- Chrome DevTools Network 面板
- Lighthouse 性能审计
- WebPageTest 在线测试

## 🔮 未来优化

1. **AVIF 格式支持**：更先进的图片格式
2. **懒加载优化**：Intersection Observer API
3. **Service Worker 缓存**：离线图片缓存
4. **CDN 集成**：阿里云 OSS / 腾讯云 COS