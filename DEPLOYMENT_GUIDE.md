# 🚀 部署配置指南

Fork 本项目后，按照以下步骤快速部署你的个人网站。

## 📋 快速检查清单

- [ ] 1. 配置 Notion 集成
- [ ] 2. 设置环境变量
- [ ] 3. 修改个人信息
- [ ] 4. 替换 OG 图片
- [ ] 5. 部署到 Vercel
- [ ] 6. 配置自定义域名（可选）

---

## 🔧 详细配置步骤

### 1. Notion 配置

#### 1.1 创建 Notion 集成
1. 访问 [Notion Integrations](https://www.notion.so/my-integrations)
2. 点击 "New integration"
3. 填写基本信息，获得 **Integration Token**

#### 1.2 创建数据库

**🚀 快速开始：使用模板**

点击下方链接直接复制预配置的 Notion 数据库模板：

**👉 [复制 Notion 数据库模板](https://mextrel.notion.site/notionhome?v=2d0a2cfb3e4980f6987f000c6c74f712&source=copy_link)**

模板包含完整的字段配置和示例数据，复制后即可直接使用。

**📋 数据库字段说明：**

| 字段名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| Name | Title | ✅ | 项目名称 |
| Type | Select | ✅ | intro \| project \| outro |
| Grid Size | Select | ✅ | 1x1 \| 1x2 \| 2x1 \| 2x2 |
| Status | Select | ✅ | Live \| Draft |
| Summary | Text | ❌ | 项目描述 |
| Quotes | Text | ❌ | 引用或标签 |
| Cover | Files | ❌ | 封面图片 |
| Link | URL | ❌ | 项目链接 |
| Category | Select | ❌ | 项目分类 |
| Sort | Number | ❌ | 排序权重 |
| Debug | Text | ❌ | 调试信息（自动填充） |

#### 1.3 分享数据库
1. 点击数据库右上角的 "Share"
2. 邀请你创建的集成
3. 复制数据库链接，提取 Database ID

### 2. 环境变量配置

#### 2.1 本地开发
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件
NOTION_API_KEY=your_integration_token_here
NOTION_DATABASE_ID=your_database_id_here
```

#### 2.2 Vercel 部署
在 Vercel 项目设置中添加环境变量：
- `NOTION_API_KEY`: 你的 Notion Integration Token
- `NOTION_DATABASE_ID`: 你的数据库 ID

### 3. 个人信息配置

编辑 `src/lib/config.ts` 文件中的 `METADATA` 配置：

```typescript
export const METADATA: MetadataConfig = {
  // 默认标题（仅在 Notion 获取失败时使用）
  title: 'Your Name Homepage',
  
  // 搜索引擎结果中的描述
  description: 'Your personal description here...',
  
  // 关键词
  keywords: [
    'your-name',
    'your-skills',
    'your-industry',
    // 添加更多关键词...
  ],
  
  // 作者名
  author: 'Your Name',
  
  // 你的网站域名
  siteUrl: 'https://your-domain.com',
  
  // 社交媒体配置
  openGraph: {
    type: 'website',
    locale: 'en_US', // 或 'zh_CN'
    siteName: 'Your Site Name',
  },
};
```

### 4. 图片配置

#### 4.1 OG 图片
替换 `public/og-image.png` 为你的图片：
- 推荐尺寸：1200x630px
- 格式：PNG 或 JPG
- 大小：< 1MB

#### 4.2 Favicon（运行时动态）

`layout.tsx` 读取 Notion 数据库图标，经 `/api/image-proxy` 输出多尺寸 link：

- 支持 emoji（Twemoji）、external URL、file / custom_emoji
- **无图标时**回退到 `/favicon.ico`（不会再拼出错误的 `favicon.ico&w=...`）
- 无需 `generate-favicon` 构建脚本；PWA manifest 见 `public/site.webmanifest`

### 5. Vercel 部署

#### 5.1 连接 GitHub
1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "New Project"
3. 选择你 Fork 的仓库

#### 5.2 配置项目
- **Framework Preset**: Next.js（自动检测）
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

#### 5.3 添加环境变量
在部署前添加：
- `NOTION_API_KEY`
- `NOTION_DATABASE_ID`

### 6. 自定义域名（可选）

#### 6.1 在 Vercel 中添加域名
1. 项目设置 → **Domains**
2. 添加你的域名
3. 按提示配置 DNS

#### 6.2 更新配置
部署完成后，更新 `src/lib/config.ts` 中的 `siteUrl`：

```typescript
siteUrl: 'https://your-custom-domain.com',
```

---

## 🎨 自定义样式（高级）

### 主题色彩
编辑 `src/app/globals.css` 中的 CSS 变量：

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  /* 修改更多颜色变量... */
}
```

### 布局配置
编辑 `src/lib/config.ts` 中的布局常量：

```typescript
export const LAYOUT_DESKTOP: LayoutConfig = {
  columnWidth: 320,  // 列宽
  rowHeight: 320,    // 行高
  gap: 24,          // 间距
  minPadding: 40,   // 最小内边距
};
```

---

## 🐛 常见问题

### Q: 页面显示空白
**A**: 检查环境变量是否正确设置，Notion 数据库是否有 "Live" 状态的项目。

### Q: 图片不显示
**A**: 确保 Notion 数据库中的图片字段类型为 "Files"，并且已上传图片。

### Q: 标题显示错误
**A**: 检查 Notion 数据库标题是否正确，或者修改 `config.ts` 中的默认标题。

### Q: 部署失败
**A**: 检查构建日志，通常是环境变量缺失或 TypeScript 类型错误。

---

## 📚 进阶定制

### 添加新的卡片类型
1. 在 Notion 数据库的 "Type" 字段中添加新选项
2. 修改 `src/lib/transformers.ts` 中的类型处理逻辑
3. 在 `src/components/features/home/MasonryCard.tsx` 中添加渲染逻辑

### 修改动画 / 滚动阶段
编辑 `src/lib/config.ts` 中的 `ANIMATION` 与 `SCROLL`（SSOT，勿在组件内再抄一份）：

```typescript
export const ANIMATION = {
  cardHoverScale: 1.02,
  hoverDuration: 0.2,
  scrollScaleSpring: { stiffness: 60, damping: 25 },
  scrollPositionSpring: { stiffness: 800, damping: 50 },
};

export const SCROLL = {
  introPauseEnd: 0.06,
  introEnd: 0.12,
  outroStart: 0.88,
  outroPauseStart: 0.94,
  loopPauseMs: 1000,
  loopMomentumThreshold: 600,
};
```

### 添加新的页面
1. 在 `src/app/` 目录下创建新的路由文件
2. 遵循 Next.js App Router 规范
3. 复用现有的组件和样式

---

## 🤝 贡献

如果你在使用过程中发现问题或有改进建议，欢迎：
1. 提交 Issue
2. 发起 Pull Request
3. 分享你的定制案例

---

## 📄 许可证

本项目采用 MIT 许可证，你可以自由使用、修改和分发。

---

**🎉 恭喜！你的个人网站已经准备就绪。开始创建你的第一个项目吧！**