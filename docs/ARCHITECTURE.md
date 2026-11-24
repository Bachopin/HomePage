# 项目架构指南

开发应遵循以下约定，避免与实现漂移。

## 目录结构

```
src/
├── app/                         # App Router 页面与 Route Handlers
│   └── api/image-proxy/         # 图片代理（Node runtime + Sharp）
├── components/
│   ├── ui/                      # 无业务逻辑的通用 UI
│   ├── layout/                  # 全局布局（Navigation）
│   └── features/home/           # 首页业务（HomeClient / MasonryCard）
├── hooks/                       # 布局、视差、滚动、图片
└── lib/                         # config / notion / transformers / image*
```

不再使用 `pages/` 路由；API 全部在 App Router。

## 核心原则

### 1. 单一事实来源（SSOT）

布局、动画、滚动阶段、UI 常量、SEO 均在 `src/lib/config.ts`：

| 常量 | 用途 |
|------|------|
| `BREAKPOINTS` | 响应式断点 |
| `LAYOUT_DESKTOP` / `LAYOUT_MOBILE` | 网格列宽与间距 |
| `CARD_SIZES` | 1x1 / 1x2 / 2x1 / 2x2 |
| `ANIMATION` | 视差、悬停、Intro/Outro 弹簧 |
| `SCROLL` | 滚动阶段与循环阈值（HomeClient / useScrollSpy / ScrollHint 共用） |
| `UI` | 圆角、图标尺寸 |
| `METADATA` | SEO / Open Graph |

禁止在组件内硬编码与上述重复的魔术数字。

### 2. 组件分层

| 层级 | 目录 | 职责 |
|------|------|------|
| UI | `components/ui/` | 可复用、无业务逻辑 |
| 布局 | `components/layout/` | 导航等全局壳 |
| 功能 | `components/features/*` | 页面业务 |

使用目录 `index.ts` 桶导出。

### 3. Notion 数据流

```
getDatabaseItems()  ← React cache()，同请求去重
        │
        ├─ database retrieve → title / icon / categoryOrder
        └─ database query（分页）→ Live items
                │
        transformers.processHomePageItems
                │
        page.tsx → HomeClient → MasonryCard
```

- `layout.tsx` / `generateMetadata` / `page.tsx` 共用同一次拉取。
- `getCategoryOrder()` 仅为兼容封装，内部读 cache 结果，不再额外请求。
- Debug 字段异步写入，不阻塞页面返回。
- Query 使用分页，避免超过 100 条时静默截断。

### 4. 滚动与布局职责

| 模块 | 职责 |
|------|------|
| `HomeClient` | 阶段动画、循环跳转、编排卡片 |
| `MasonryCard` | Intro/Outro / Project 渲染 |
| `useMasonryLayout` | GridOccupancyManager 填坑 |
| `useParallax` | 视差几何 |
| `useScrollSpy` | 分类高亮与跳转（读 `SCROLL`） |
| `ScrollHint` | Intro 停留提示（读 `SCROLL.introPauseEnd`） |

## UI / Hooks 清单

### UI

| 组件 | 用途 |
|------|------|
| `CrosshairToggle` | 十字准星暗色切换 |
| `DisableContextMenu` | 禁右键 |
| `ErrorBoundary` | 错误边界 |
| `ScrambleText` | 乱码解码字效 |
| `ScrollHint` | 滚轮提示 |
| `ScrollingText` | 背景滚动大字 |

### Hooks

| Hook | 用途 |
|------|------|
| `useMasonryLayout` | 瀑布流布局 |
| `useParallax` | 视差 |
| `useScrollSpy` | 滚动导航 |
| `useProgressiveImage` | 渐进图 |
| `useImageCache` | 全局图片缓存（模块级清理定时器） |

## 动态 Favicon

运行时方案（无构建脚本）：

```
Notion Database Icon → layout.tsx → /api/image-proxy?url=...&w=&h=
无图标时回退 /favicon.ico
```

支持 emoji（Twemoji CDN）、external、file、custom_emoji。

## 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件 | PascalCase | `MasonryCard.tsx` |
| Hook | `use` + camelCase | `useParallax.ts` |
| 常量 | UPPER_SNAKE_CASE | `SCROLL` |
| 类型 | PascalCase | `NotionItem` |

## 相关文档

- [部署指南](../DEPLOYMENT_GUIDE.md)
- [图片优化](./IMAGE_OPTIMIZATION.md)
