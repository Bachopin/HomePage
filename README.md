# Notion-Powered Personal Homepage

基于 Next.js 14 和 Notion API 构建的个人主页，采用水平滚动瀑布流布局，支持视差动画效果。

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
│   ├── globals.css               # 全局样式
│   ├── layout.tsx                # 根布局
│   └── page.tsx                  # 首页（SSR + ISR）
├── components/
│   ├── ui/                       # 通用基础组件
│   │   ├── CrosshairToggle.tsx   # 十字准星暗色模式切换
│   │   ├── DarkModeToggle.tsx    # 暗色模式开关
│   │   ├── ErrorBoundary.tsx     # 错误边界
│   │   ├── InteractiveList.tsx   # 交互列表
│   │   └── TypedText.tsx         # 打字机效果
│   ├── layout/                   # 全局布局组件
│   │   └── Navigation.tsx        # 导航栏
│   └── features/home/            # 首页业务组件
│       ├── HomeClient.tsx        # 首页客户端组件（指挥官）
│       └── MasonryCard.tsx       # 瀑布流卡片
├── hooks/                        # 自定义 Hooks
│   ├── useMasonryLayout.ts       # 瀑布流布局计算
│   ├── useMouse.ts               # 鼠标位置追踪
│   ├── useParallax.ts            # 视差物理引擎
│   └── useScrollSpy.ts           # 滚动监听与导航
└── lib/                          # 工具库
    ├── config.ts                 # 全局配置中心（Single Source of Truth）
    ├── notion.ts                 # Notion API 服务
    └── transformers.ts           # 数据转换器
```

## 架构设计

### 单一事实来源 (Single Source of Truth)

所有布局、动画、响应式断点的常量集中在 `lib/config.ts`：

- `BREAKPOINTS` - 响应式断点
- `LAYOUT_DESKTOP/MOBILE` - 布局配置（列宽、间距、内边距）
- `CARD_SIZES` - 卡片尺寸定义（1x1, 1x2, 2x1, 2x2）
- `ANIMATION` - 动画参数（缩放、弹簧配置、视差系数）
- `SCROLL` - 滚动配置
- `UI` - UI 常量（圆角、图标尺寸）

### 组件职责分离

| 组件 | 职责 |
|------|------|
| `HomeClient` | 数据流转、Hook 调用、布局编排 |
| `MasonryCard` | 纯 UI 渲染，无数学计算 |
| `useParallax` | 视差物理引擎，几何计算 |
| `useMasonryLayout` | 瀑布流布局算法 |
| `useScrollSpy` | 滚动位置监听与导航 |

## 环境配置

创建 `.env` 文件：

```env
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_database_id
```

## Notion 数据库结构

| 字段 | 类型 | 说明 |
|------|------|------|
| Title | Title | 项目标题 |
| Year | Rich Text | 年份 |
| Description | Rich Text | 描述 |
| Image | Files | 封面图片 |
| Size | Select | 卡片尺寸 (1x1/1x2/2x1/2x2) |
| Type | Select | 类型 (intro/project/outro) |
| Category | Select | 分类 |
| Link | URL | 链接 |
| Status | Select | 状态 (Live/Draft) |
| Sort | Number | 排序权重 |

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 启动生产服务
npm start
```

## 特性

- **水平滚动瀑布流** - 两行网格布局，支持多种卡片尺寸
- **智能视差效果** - 根据图片和卡片宽高比自动计算视差方向
- **响应式设计** - 桌面端固定列宽，移动端自适应
- **暗色模式** - 支持系统偏好和手动切换
- **ISR 增量更新** - 每 36 秒重新验证数据
- **三明治结构** - intro → projects → outro 的内容组织

## License

MIT
