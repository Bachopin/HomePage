# 🚀 部署指南

## 🎯 推荐部署方案

根据你的需求（部署后不用管，只通过 Notion 调整），推荐以下方案：

### 1. Vercel（最推荐）⭐⭐⭐⭐⭐

**优势：**
- ✅ 零配置部署
- ✅ 自动 CDN 全球加速
- ✅ 无服务器架构，无需维护
- ✅ 自动 HTTPS
- ✅ 完美支持 Next.js
- ✅ 免费额度充足

**部署步骤：**
```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录 Vercel
vercel login

# 3. 部署
vercel

# 4. 设置环境变量
vercel env add NOTION_API_KEY
vercel env add NOTION_DATABASE_ID

# 5. 重新部署
vercel --prod
```

**长期维护：**
- 🔄 自动处理 Notion 图片 URL 过期
- 🔄 实时图片优化和缓存
- 🔄 零维护成本

### 2. Netlify（次推荐）⭐⭐⭐⭐

**优势：**
- ✅ 简单部署
- ✅ 自动 CDN
- ✅ 免费 HTTPS
- ✅ 良好的 Next.js 支持

**部署步骤：**
```bash
# 1. 构建项目
npm run build

# 2. 上传到 Netlify
# 或连接 GitHub 自动部署
```

### 3. Railway（适合需要数据库）⭐⭐⭐

**优势：**
- ✅ 支持数据库
- ✅ 简单配置
- ✅ 自动扩容

### 4. 自建服务器（不推荐）⭐⭐

**劣势：**
- ❌ 需要维护服务器
- ❌ 需要配置 HTTPS
- ❌ 需要处理扩容
- ❌ 需要监控和备份

## 🔧 环境变量配置

无论选择哪种部署方案，都需要设置以下环境变量：

```bash
# Notion 配置（必需）
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_database_id

# 图片优化配置（可选）
NEXT_PUBLIC_IMAGE_STRATEGY=progressive
NEXT_PUBLIC_SHOW_IMAGE_DEBUG=false
```

## 📋 Notion 数据库配置

### 快速开始：使用模板

**👉 [复制 Notion 数据库模板](https://mextrel.notion.site/notionhome?v=2d0a2cfb3e4980f6987f000c6c74f712&source=copy_link)**

点击上方链接直接复制预配置的数据库模板，包含完整字段配置和示例数据。

### 手动配置步骤

1. **创建 Notion 集成**
   - 访问 [Notion Integrations](https://www.notion.so/my-integrations)
   - 创建新集成，获取 API Key

2. **设置数据库权限**
   - 在数据库页面点击 "Share"
   - 邀请你创建的集成
   - 复制数据库 ID（URL 中的长字符串）

3. **配置环境变量**
   - 将 API Key 设置为 `NOTION_API_KEY`
   - 将数据库 ID 设置为 `NOTION_DATABASE_ID`

## 📊 方案对比

| 特性 | Vercel | Netlify | Railway | 自建服务器 |
|------|--------|---------|---------|------------|
| 部署难度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| 维护成本 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| 性能 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| 成本 | 免费 | 免费 | $5/月 | $20+/月 |
| 扩展性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |

## 🎯 Vercel 详细部署

### 步骤 1：准备代码

```bash
# 确保代码已提交到 Git
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 步骤 2：连接 GitHub

1. 访问 [vercel.com](https://vercel.com)
2. 使用 GitHub 登录
3. 导入你的仓库
4. Vercel 会自动检测 Next.js 项目

### 步骤 3：配置环境变量

在 Vercel 项目设置中添加：
- `NOTION_API_KEY`
- `NOTION_DATABASE_ID`

### 步骤 4：部署

点击 "Deploy" 按钮，Vercel 会：
1. 自动构建项目
2. 部署到全球 CDN
3. 提供 HTTPS 域名

### 步骤 5：自定义域名（可选）

在 Vercel 项目设置中可以添加自定义域名。

## 🔄 长期运行保证

### 图片 URL 自动刷新

我们的图片代理 API (`/api/image-proxy`) 会：
1. 自动检测 Notion 图片 URL 过期
2. 重新获取最新的 URL
3. 缓存 12 小时避免频繁请求

### 零维护架构

```
用户请求 → Vercel CDN → Next.js API → Notion API → 图片优化 → 缓存返回
```

- ✅ Notion 数据实时同步
- ✅ 图片自动优化和缓存
- ✅ URL 过期自动处理
- ✅ 全球 CDN 加速

### 监控和告警（可选）

可以添加 Vercel Analytics 监控：
```bash
npm install @vercel/analytics
```

## 🚨 故障处理

### 图片不显示
1. 检查 Notion API 密钥是否有效
2. 检查数据库 ID 是否正确
3. 查看 Vercel 函数日志

### 性能问题
1. Vercel 自动处理扩容
2. 图片代理有多级缓存
3. CDN 全球分发

### 成本控制
- Vercel 免费额度：100GB 带宽/月
- 超出后按量付费，通常很便宜
- 可设置使用限制

## 🎉 部署后的使用

部署完成后，你只需要：
1. 在 Notion 数据库中添加/修改内容
2. 网站会自动同步更新
3. 图片会自动优化和缓存
4. 完全零维护！

## 📞 技术支持

如果遇到问题：
1. 查看 Vercel 部署日志
2. 检查浏览器控制台错误
3. 验证 Notion API 连接

**推荐：选择 Vercel，一键部署，终身无忧！**