# Notion-Powered Personal Homepage

基于 Next.js 14 App Router + Notion API 的个人主页。内容在 Notion 维护，页面为水平滚动瀑布流（Intro → Projects → Outro），带视差、暗色模式与 ISR。

线上稳定版：`https://mextric.vercel.app`

## 技术栈

| 层 | 选型 |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| CMS | Notion API（请求级 `cache` 去重） |
| Images | Sharp + `/api/image-proxy` + 可选构建时预优化 |

## 快速开始

```bash
git clone <your-fork>
cd HomePage
npm install
cp .env.example .env   # 填入 NOTION_API_KEY / NOTION_DATABASE_ID
npm run setup-check
npm run dev            # http://0.0.0.0:3456
```

Notion 数据库模板：  
https://mextrel.notion.site/notionhome?v=2d0a2cfb3e4980f6987f000c6c74f712&source=copy_link

个性化：编辑 `src/lib/config.ts` 中的 `METADATA`。

部署：见 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)。

## 项目结构

```
src/
├── app/
│   ├── api/image-proxy/route.ts  # 图片代理（App Router）
│   ├── layout.tsx                # 根布局 + 动态 favicon
│   ├── page.tsx                  # SSR + ISR（revalidate 36s）
│   ├── error.tsx / not-found.tsx
│   ├── robots.ts / sitemap.ts
│   └── globals.css
├── components/
│   ├── ui/                       # CrosshairToggle, ScrambleText, ScrollHint...
│   ├── layout/Navigation.tsx
│   └── features/home/            # HomeClient, MasonryCard
├── hooks/                        # useMasonryLayout, useParallax, useScrollSpy...
└── lib/
    ├── config.ts                 # 布局 / 动画 / SCROLL 阶段 / SEO（SSOT）
    ├── notion.ts                 # Notion 拉取（cache + 分页）
    ├── transformers.ts           # 过滤 / 排序 / 三明治结构
    ├── imageService.ts
    └── imageConfig.ts
```

## 交互与滚动阶段

阶段参数统一在 `src/lib/config.ts` → `SCROLL` / `ANIMATION`：

```
0%–6%     Intro 全屏停留
6%–12%    Intro 缩小，内容淡入
12%–88%   水平瀑布流滚动
88%–94%   Outro 放大，内容淡出
94%–100%  Outro 全屏停留
```

边界处停留 `loopPauseMs` + 累积动量 `loopMomentumThreshold` 后可双向无缝跳转。

## Notion 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| Name | Title | 标题（可空） |
| Quotes | Rich Text | 引用/标签 |
| Summary | Rich Text | 描述 |
| Cover | Files | 封面 |
| Grid Size | Select | 1x1 / 1x2 / 2x1 / 2x2 |
| Type | Select | intro / project / outro |
| Category | Select | 分类（project 必需） |
| Link | URL | 外链 |
| Status | Select | Live / Draft |
| Sort | Number | 排序 |
| Debug | Rich Text | 校验信息（后台异步写入，不阻塞渲染） |

## 脚本

```bash
npm run dev                 # 开发（3456）
npm run build               # 生产构建
npm run build:with-images   # 先 optimize-images 再 build
npm run optimize-images     # 构建时预优化 Notion 封面
npm run setup-check         # 环境检查
npm run health-check        # 健康检查
npm run lint
```

## 文档

- [部署指南](./DEPLOYMENT_GUIDE.md)
- [架构说明](./docs/ARCHITECTURE.md)
- [图片优化](./docs/IMAGE_OPTIMIZATION.md)

## 版本

**v1.1.0** — 优化重构：Notion 去重与分页、滚动配置 SSOT、App Router 图片代理、死代码清理；行为与观感对齐 v1.0。

## License

MIT
