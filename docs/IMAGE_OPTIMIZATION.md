# 图片优化系统

## 概述

两层策略：

1. **运行时**：`/api/image-proxy`（App Router + Sharp）按需缩放、WebP/JPEG、CDN 缓存；Notion 签名 URL 过期时按 path 匹配刷新。
2. **可选构建时**：`npm run optimize-images` 预生成多尺寸到 `public/images/optimized/`，运行时 `imageService` 优先用本地文件。

默认 `npm run build` **不会**自动跑图片预优化；需要时用 `npm run build:with-images`。

## 命令

```bash
# 增量预优化
npm run optimize-images

# 清空后强制重做
npm run optimize-images:force

# 预优化 + Next build
npm run build:with-images

# 仅 Next build（默认）
npm run build
```

## 构建时输出

`scripts/optimize-images.js` 从 Notion 拉封面，生成：

| 尺寸 | 宽度 | 质量（约） |
|------|------|------------|
| thumbnail | 200px | ~80 |
| medium | 800px | ~88 |
| large | 1200px | ~92 |

格式：WebP + JPEG；映射文件：`public/images/optimized/image-mapping.json`。

## 运行时选择

`src/lib/imageService.ts` + `useProgressiveImage`：

1. 有本地映射 → 按视口 / DPR / 网速选尺寸与格式  
2. 否则走 `/api/image-proxy?url=...&w=&h=&q=&f=`  
3. 再失败回退原图  

`useImageCache` 提供全局缓存；过期清理为**模块级单一定时器**（多卡片共享）。

## 代理行为

- Route：`src/app/api/image-proxy/route.ts`（`runtime = 'nodejs'`）
- 缓存头：浏览器长缓存 + CDN `s-maxage`
- URL 刷新：忽略 query，按 `origin + pathname` 与最新 Notion item.image 匹配
- 失败：返回 1×1 透明 PNG 占位

## 静态资源缓存

`next.config.js` 对 `/images/optimized/*` 设置长期 `Cache-Control`；映射 JSON 较短缓存 + SWR。

## 相关代码

| 文件 | 职责 |
|------|------|
| `src/app/api/image-proxy/route.ts` | 代理与实时优化 |
| `src/lib/imageService.ts` | URL 选择与映射加载 |
| `src/lib/imageConfig.ts` | 图片相关常量 |
| `src/hooks/useProgressiveImage.ts` | 渐进加载 |
| `src/hooks/useImageCache.ts` | 客户端缓存 |
| `scripts/optimize-images.js` | 构建预优化 |
