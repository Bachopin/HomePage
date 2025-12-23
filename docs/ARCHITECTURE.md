# 🏗️ 项目架构指南

本文档定义了项目的架构规范，所有开发都应遵循这些原则。

## 📁 目录结构

```
src/
├── app/                    # Next.js App Router 页面
├── components/
│   ├── ui/                 # 通用基础组件（可复用）
│   ├── layout/             # 全局布局组件
│   └── features/           # 业务功能组件（按功能分组）
│       └── home/           # 首页相关组件
├── hooks/                  # 自定义 React Hooks
├── lib/                    # 工具库、服务、配置
└── pages/api/              # API 路由
```

## 🎯 核心原则

### 1. 单一事实来源 (Single Source of Truth)

所有配置集中在 `src/lib/config.ts`：
- 布局参数、动画配置、UI 常量
- **禁止在组件中硬编码魔术数字**

```typescript
// ✅ 正确
import { ANIMATION, UI } from '@/lib/config';
const scale = ANIMATION.cardHoverScale;

// ❌ 错误
const scale = 1.02; // 魔术数字
```

### 2. 组件分层

| 层级 | 目录 | 职责 | 示例 |
|------|------|------|------|
| UI 层 | `components/ui/` | 通用、无业务逻辑、可复用 | `ScrambleText`, `ScrollHint`, `ScrollingText` |
| 布局层 | `components/layout/` | 全局布局结构 | `Navigation` |
| 功能层 | `components/features/` | 业务逻辑、特定功能 | `HomeClient`, `MasonryCard` |

### 3. 桶文件导出 (Barrel Export)

每个目录必须有 `index.ts` 导出所有公开模块：

```typescript
// components/ui/index.ts
export { default as ScrambleText } from './ScrambleText';
export { default as DarkModeToggle } from './DarkModeToggle';
```

导入时使用桶文件：

```typescript
// ✅ 正确
import { ScrambleText, DarkModeToggle } from '@/components/ui';

// ❌ 错误
import ScrambleText from '@/components/ui/ScrambleText';
```

### 4. Hook 设计原则

- 每个 Hook 单独一个文件
- 导出类型定义
- 在 `hooks/index.ts` 中统一导出

```typescript
// hooks/index.ts
export { useMyHook } from './useMyHook';
export type { UseMyHookProps, UseMyHookResult } from './useMyHook';
```

### 5. 新增组件检查清单

添加新组件时：

- [ ] 确定组件层级（ui / layout / features）
- [ ] 创建组件文件
- [ ] 在对应 `index.ts` 中添加导出
- [ ] 如有配置常量，添加到 `lib/config.ts`
- [ ] 如有类型定义，确保导出

## 📦 现有模块说明

### UI 组件 (`components/ui/`)

| 组件 | 用途 |
|------|------|
| `ScrambleText` | 文字乱码解码动画效果 |
| `CrosshairToggle` | 十字准星暗色模式切换 |
| `DarkModeToggle` | 暗色模式开关 |
| `DisableContextMenu` | 禁用右键菜单 |
| `ErrorBoundary` | 错误边界 |
| `InteractiveList` | 交互列表（悬停显示图片） |
| `ScrollHint` | 滚动提示组件（鼠标滚轮图标） |
| `ScrollingText` | 背景滚动大字效果 |
| `TypedText` | 打字机效果 |

### Hooks (`hooks/`)

| Hook | 用途 |
|------|------|
| `useMasonryLayout` | 瀑布流布局计算 |
| `useParallax` | 视差效果物理引擎 |
| `useScrollSpy` | 滚动监听与导航 |
| `useProgressiveImage` | 渐进式图片加载 |
| `useImageCache` | 图片缓存管理 |
| `useMouse` | 鼠标位置追踪 |
| `useInfiniteScroll` | 无限循环滚动 |

### 工具库 (`lib/`)

| 文件 | 用途 |
|------|------|
| `config.ts` | 全局配置中心（布局、动画、UI、SEO） |
| `notion.ts` | Notion API 服务 |
| `imageService.ts` | 图片优化服务 |
| `imageConfig.ts` | 图片配置 |
| `transformers.ts` | 数据转换器 |
| `faviconGenerator.ts` | 动态 favicon 生成器 |

### 配置常量 (`lib/config.ts`)

| 常量 | 用途 |
|------|------|
| `BREAKPOINTS` | 响应式断点 |
| `LAYOUT_DESKTOP/MOBILE` | 布局配置 |
| `CARD_SIZES` | 卡片尺寸定义 |
| `ANIMATION` | 动画参数（缩放、时长、弹簧） |
| `SCROLL` | 滚动配置 |
| `UI` | UI 常量（圆角、图标尺寸） |
| `DEFAULTS` | 默认值 |
| `METADATA` | SEO 元数据 |

## ✏️ 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件 | PascalCase | `ScrambleText.tsx` |
| Hook | camelCase，以 `use` 开头 | `useParallax.ts` |
| 工具函数 | camelCase | `getLayoutConfig` |
| 常量 | UPPER_SNAKE_CASE | `ANIMATION`, `BREAKPOINTS` |
| 类型 | PascalCase | `CardSize`, `LayoutConfig` |

## 🔗 相关文档

- [部署指南](./DEPLOYMENT_GUIDE.md)
- [图片优化](./IMAGE_OPTIMIZATION.md)

## 🎨 动态 Favicon 系统

### 架构设计

动态 favicon 系统基于 Notion 数据库图标自动生成多尺寸 favicon 文件：

```
Notion Database Icon → FaviconGenerator → Multi-size Files
     ↓                       ↓                    ↓
  emoji/file/external    Sharp Processing    16x16, 32x32, 192x192, 512x512
```

### 核心组件

| 组件 | 职责 |
|------|------|
| `FaviconGenerator` | 核心生成逻辑，处理不同图标类型 |
| `generate-favicon.js` | 构建脚本，集成到构建流程 |
| `DatabaseIcon` 接口 | 类型定义，支持 emoji/external/file |

### 支持的图标类型

1. **Emoji**: 转换为 SVG 再生成 PNG
2. **External URL**: 下载并处理外部图片
3. **File Upload**: 处理 Notion 上传的文件

### 错误处理策略

- **多层回退**: Notion图标 → 默认图标 → 最简图标
- **重试机制**: 网络请求失败时自动重试
- **构建保护**: 确保构建过程不会因图标问题失败

### 性能优化

- **零额外API调用**: 复用现有 Notion 数据库查询
- **文件大小控制**: 总计 < 50KB
- **智能缓存**: 24小时内跳过重复生成
