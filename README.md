# 🎨 Notion-Powered Personal Homepage Template

一个基于 Next.js 14 和 Notion API 的现代化个人主页模板，采用水平滚动瀑布流布局，支持视差动画和无缝循环滚动效果。

**🚀 一键 Fork，快速部署你的个人网站！**

## ✨ 为什么选择这个模板？

- 🎯 **零代码内容管理** - 通过 Notion 数据库管理所有内容
- 🎨 **现代化设计** - 独特的水平滚动瀑布流布局
- ⚡ **性能优化** - ISR 增量更新，图片优化，骨架屏加载
- 📱 **完全响应式** - 桌面和移动端完美适配
- 🔧 **高度可定制** - 统一配置中心，轻松个性化
- 🚀 **一键部署** - 完美支持 Vercel 部署

## 🚀 快速开始

### 1. Fork 并克隆项目
```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
npm install
```

### 2. 配置检查
```bash
npm run setup-check
```

### 3. 配置 Notion
1. 创建 [Notion 集成](https://www.notion.so/my-integrations)
2. 创建数据库（参考下方结构）
3. 复制 `.env.example` 为 `.env` 并填入配置

### 4. 个性化配置
编辑 `src/lib/config.ts` 中的个人信息：
```typescript
export const METADATA = {
  author: 'Your Name',
  siteUrl: 'https://your-domain.com',
  description: 'Your description...',
  // ... 更多配置
};
```

### 5. 部署到 Vercel
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

**📚 详细指南**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

---

## 技术栈

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **CMS**: Notion API
- **Language**: TypeScript

## 项目结构

```
src/
├── app/                          # Next.js App Router
│   ├── globals.css               # 全局样式（含 shimmer 动画）
│   ├── layout.tsx                # 根布局
│   ├── page.tsx                  # 首页（SSR + ISR + SEO）
│   ├── not-found.tsx             # 404 页面
│   └── error.tsx                 # 全局错误边界
├── components/
│   ├── ui/                       # 通用基础组件
│   │   ├── index.ts              # 桶文件导出
│   │   ├── CrosshairToggle.tsx   # 十字准星暗色模式切换
│   │   ├── DarkModeToggle.tsx    # 暗色模式开关
│   │   ├── DisableContextMenu.tsx # 禁用右键菜单
│   │   ├── ErrorBoundary.tsx     # 错误边界
│   │   ├── InteractiveList.tsx   # 交互列表
│   │   ├── ScrambleText.tsx      # 文字乱码解码动画
│   │   └── TypedText.tsx         # 打字机效果
│   ├── layout/                   # 全局布局组件
│   │   ├── index.ts              # 桶文件导出
│   │   └── Navigation.tsx        # 导航栏
│   └── features/home/            # 首页业务组件
│       ├── index.ts              # 桶文件导出
│       ├── HomeClient.tsx        # 首页客户端组件（指挥官）
│       └── MasonryCard.tsx       # 瀑布流卡片（含骨架屏）
├── hooks/                        # 自定义 Hooks
│   ├── index.ts                  # 桶文件导出
│   ├── useImageCache.ts          # 图片缓存管理
│   ├── useInfiniteScroll.ts      # 无限循环滚动（未启用）
│   ├── useMasonryLayout.ts       # 瀑布流布局计算（智能填坑算法）
│   ├── useMouse.ts               # 鼠标位置追踪
│   ├── useParallax.ts            # 视差物理引擎
│   ├── useProgressiveImage.ts    # 渐进式图片加载
│   └── useScrollSpy.ts           # 滚动监听与导航
└── lib/                          # 工具库
    ├── config.ts                 # 全局配置中心（含 SEO 元数据）
    ├── imageConfig.ts            # 图片优化配置
    ├── imageService.ts           # 图片优化服务
    ├── notion.ts                 # Notion API 服务
    └── transformers.ts           # 数据转换器
```

## 核心特性

### 1. 对称的开头与结尾动画

- **开头 (Intro)**：页面加载时 Intro 卡片全屏显示，随着滚动逐渐缩小，其他内容淡入
- **结尾 (Outro)**：滚动到末尾时 Outro 卡片逐渐放大至全屏，其他内容淡出
- **无缝循环**：在 Intro/Outro 全屏状态下继续滚动，可无缝跳转到另一端（需停留+累积动量）

### 2. 智能填坑瀑布流算法

`useMasonryLayout` 实现了基于网格占用管理的智能布局：

- **普通卡片**：从第 0 列开始全局搜索空位
- **Outro 卡片**：从当前最右侧列开始搜索，保持队尾性质同时填补空白
- **移动端精度修复**：`columnWidth` 使用 `Math.floor` 取整，避免滚动抖动

### 3. 滚动阶段管理

```
Phase 1 (0% - 6%):    Intro 停留（全屏）
Phase 2 (6% - 12%):   Intro 缩放（大→小），内容淡入
Phase 3 (12% - 88%):  水平滚动
Phase 4 (88% - 94%):  Outro 缩放（小→大），内容淡出
Phase 5 (94% - 100%): Outro 停留（全屏）
```

### 4. 双向无缝循环

在边界处继续滚动可触发循环跳转：
1. 停留 1 秒
2. 累积 600px 滑动量
3. 瞬间跳转（使用 `spring.jump()` 避免动画）

## 架构设计

### 单一事实来源 (Single Source of Truth)

所有布局、动画、响应式断点、SEO 元数据集中在 `lib/config.ts`：

- `BREAKPOINTS` - 响应式断点
- `LAYOUT_DESKTOP/MOBILE` - 布局配置（列宽、间距、内边距）
- `CARD_SIZES` - 卡片尺寸定义（1x1, 1x2, 2x1, 2x2）
- `ANIMATION` - 动画参数（缩放、弹簧配置、视差系数）
- `SCROLL` - 滚动配置
- `UI` - UI 常量（圆角、图标尺寸）
- `METADATA` - SEO 元数据

### 组件职责分离

| 组件 | 职责 |
|------|------|
| `HomeClient` | 数据流转、滚动阶段管理、动画编排 |
| `MasonryCard` | 纯 UI 渲染，支持 Intro/Outro 独立缩放 |
| `useParallax` | 视差物理引擎，几何计算 |
| `useMasonryLayout` | 瀑布流布局算法（GridOccupancyManager） |
| `useScrollSpy` | 滚动位置监听与导航跳转 |

### 模块导入规范

```typescript
// ✅ 推荐：使用桶文件
import { HomeClient } from '@/components/features/home';
import { ErrorBoundary, CrosshairToggle } from '@/components/ui';
import { useMasonryLayout, useParallax } from '@/hooks';

// 类型导入
import type { NotionItem } from '@/lib/notion';
import type { CardSize, LayoutConfig } from '@/lib/config';
```

## 环境配置

创建 `.env` 文件：

```env
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_database_id
```

## Notion 数据库结构

| 字段 | 类型 | 说明 |
|------|------|------|
| Name | Title | 项目标题（可选） |
| Year | Rich Text | 年份/标签 |
| Summary | Rich Text | 描述（支持多行） |
| Cover | Files | 封面图片 |
| Grid Size | Select | 卡片尺寸 (1x1/1x2/2x1/2x2) |
| Type | Select | 类型 (intro/project/outro) |
| Category | Select | 分类 |
| Link | URL | 链接 |
| Status | Select | 状态 (Live/Draft) |
| Sort | Number | 排序权重 |
| Debug | Rich Text | 验证错误信息（自动写入） |

## 开发

```bash
# 安装依赖
npm install

# 开发模式（端口 3456）
npm run dev

# 构建
npm run build

# 启动生产服务
npm start
```

## 特性清单

- ✅ 水平滚动瀑布流（两行网格，多种卡片尺寸）
- ✅ 智能填坑算法（GridOccupancyManager）
- ✅ 对称的 Intro/Outro 缩放动画
- ✅ 双向无缝循环滚动
- ✅ 智能视差效果（根据图片宽高比自动计算）
- ✅ 骨架屏加载（Shimmer 动画）
- ✅ 响应式设计（桌面固定列宽，移动端自适应）
- ✅ 暗色模式（系统偏好 + 手动切换）
- ✅ 禁用右键菜单
- ✅ ISR 增量更新（36 秒重新验证）
- ✅ 完整 SEO（OpenGraph、Twitter Cards）
- ✅ 自定义 404 和全局错误边界
- ✅ 严格 TypeScript 类型定义
- ✅ 移动端适配（100dvh、overscroll-none）
- ✅ 文字乱码解码动画（ScrambleText，基于 use-scramble）
- ✅ 渐进式图片加载（缩略图 → 高清）
- ✅ 图片缓存管理（避免重复加载）

## 版本

**v1.0.0** - 首个正式版本

## License

MIT
