# EdgeOne Pages 个人博客系统

基于 **EdgeOne Pages** 的全栈个人博客，前端使用 Next.js（静态导出）+ Tailwind CSS，后端全部由 **EdgeOne Functions** 提供 API，存储使用 **EdgeOne KV**（文章/分类/标签/评论/站点配置/统计）与 **EdgeOne Blob**（封面/正文图片/附件），可直接部署到 EdgeOne Pages。

## 功能特性

### 前台
- **首页**：最新文章列表 + 分类快捷入口
- **文章列表**：分类/标签筛选、关键词过滤、分页
- **文章详情**：Markdown 渲染、代码高亮、目录、上一篇/下一篇、相关文章、点赞、评论、阅读量统计、分享
- **分类页 / 标签页**：分类归档、标签云
- **归档页**：按月份时间线归档
- **搜索页**：站内全文检索（标题/摘要/正文/分类/标签）
- **关于页**：Markdown 内容 + 社交联系方式
- **SEO**：服务端渲染（SSR 页面函数输出完整 HTML）、Open Graph、Twitter Card、JSON-LD（BlogPosting）、canonical、sitemap.xml、rss.xml
- **暗色模式**：跟随系统 + 手动切换，localStorage 记忆
- **移动端适配**：响应式布局、折叠导航、图片懒加载

### 后台（默认 `/admin`，可通过环境变量自定义路径）
- 管理员登录（PBKDF2-SHA256 密码哈希 + HttpOnly 会话 Cookie + **登录失败限速/锁定**）
- **TOTP 二次验证**：站点设置内可开启，setup secret 一次性、disable 必须复验
- **文章管理**：Vditor Markdown 编辑器（实时预览、代码高亮、图片直插）、封面支持外部 URL、分类/标签/可见性（公开/私人）
- **分类 / 标签管理**：增删改，自动关联文章计数，分类可指定 SVG 图标
- **评论审核**：待审 / 通过 / 拒绝 / 删除，站点级评论开关
- **媒体库**：浏览器直传 Blob（预签名 URL）、列表、删除
- **站点设置**：站点信息、关于页、评论策略、SEO、社交链接、favicon URL、TOTP
- **备份与恢复**：一键导出全量 JSON（KV + Blob 元数据）、WebDAV 自动备份到任意 WebDAV 服务器、支持从备份包恢复
- **访问统计**：总访问量、今日访问、30 天趋势、Top 文章

## 安全设计

- **安全响应头**：CSP（白名单 frame-src 含 B 站/YouTube/腾讯/Vimeo）、HSTS（1 年 + includeSubDomains）、X-Frame-Options SAMEORIGIN、X-Content-Type-Options nosniff、Referrer-Policy、Permissions-Policy（静态 edgeone.json 与 SSR render-html.js 双处下发）
- **后台路径隐蔽**：构建时环境变量 `ADMIN_PATH` 可把后台从 `/admin` 迁到任意秘密路径，原路径返回 404
- **认证**：PBKDF2-SHA256 密码哈希、HttpOnly Cookie、服务端 session 有过期时间、登出即销毁、登录失败按 IP 限速
- **TOTP**：管理员可开启二次验证
- **CORS**：仅公开只读 GET 接口下发 `Access-Control-Allow-Origin: *`（无 credentials），管理接口不带 CORS 头

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js 15（`output: 'export'` 静态导出） |
| 样式 | Tailwind CSS 3 + @tailwindcss/typography |
| API | EdgeOne Functions（`edge-functions/`，onRequest* handlers） |
| 存储 | EdgeOne KV（`BLOG_KV` 绑定）+ EdgeOne Blob（store：`blog-media`） |
| Markdown | marked + highlight.js（服务端与前端双渲染） |
| 构建检查 | esbuild + 内存 mock 冒烟测试 |

## 目录结构

```
edgeone-blog/
├── app/                      # Next.js 前端页面（静态导出）
│   ├── layout.tsx            # 全局布局：暗色 Provider、Header/Footer、Metadata
│   ├── page.tsx              # 首页
│   ├── posts/ categories/ tags/ archives/ search/ about/ admin/
│   └── not-found.tsx
├── components/               # 前端组件（含 admin/ 后台管理全套）
├── lib/                      # 类型定义、API 客户端、Markdown 渲染
├── public/
│   ├── styles/article.css    # SSR 页面样式（与前端视觉一致）
│   └── js/article.js         # SSR 页面交互（点赞/评论/阅读量/目录高亮）
├── edge-functions/           # EdgeOne Functions 后端
│   ├── api/                  # JSON API
│   │   ├── auth/             # setup / login / logout / me
│   │   ├── posts/            # 列表 / 详情 / 点赞 / 阅读 / 评论 / 相关
│   │   ├── comments/         # 列表 / 审核 / 删除
│   │   ├── categories/ tags/ media/ config/ stats/ search
│   │   └── _lib/             # kv / blob / auth / md / data / render-html 等
│   ├── posts/[slug].js       # 文章页 SSR（完整 HTML）
│   ├── categories/[slug].js  # 分类归档页 SSR
│   ├── tags/[slug].js        # 标签归档页 SSR
│   ├── sitemap.xml.js        # sitemap
│   └── rss.xml.js            # RSS
├── scripts/
│   ├── check-functions.mjs   # esbuild 打包检查（npm run check:functions）
│   ├── smoke-functions.mjs   # 内存 mock 冒烟测试（npm run test:functions）
│   └── relocate-admin.mjs    # postbuild：按 ADMIN_PATH 环境变量迁移后台目录
├── edgeone.json              # EdgeOne Pages 部署配置
├── next.config.mjs           # 静态导出配置 + 本地开发 /api 代理
└── package.json
```

## 本地开发

```bash
npm install
npm run check:functions   # 函数打包检查（37 个文件）
npm run test:functions    # 内存 mock 冒烟测试（41 项断言）
npm run build             # Next.js 静态导出到 out/
```

本地联调（`/api` 代理到 EdgeOne Pages Dev）：

```bash
npx edgeone pages dev     # 启动本地函数运行时
npm run dev               # 启动 Next.js 开发服务器
```

## 部署到 EdgeOne Pages

1. **推送代码**：将仓库推送到 GitHub（或任意 Git 平台）。
2. **创建项目**：在 [EdgeOne 控制台](https://console.cloud.tencent.com/edgeone/pages) 创建 Pages 项目，选择仓库导入；框架预设选择 **Next.js**（静态导出模式）。仓库根目录的 `edgeone.json` 已配置：
   ```json
   {
     "buildCommand": "npm run build",
     "installCommand": "npm install",
     "outputDirectory": "./out",
     "nodeVersion": "22.11.0",
     "caches": { ... },
     "headers": { ... }
   }
   ```
3. **绑定 KV 命名空间**：控制台 → 存储 → KV → 创建命名空间，在项目「绑定命名空间」中将变量名设为 **`BLOG_KV`**（代码同时兼容 `blog_kv`）。若未绑定，站点以内存模式运行，重启后数据丢失。
4. **Blob 存储**：`@edgeone/pages-blob` 零配置设计，`blog-media` store 首次访问时自动创建（也可在控制台显式创建同名 Blob store）。
5. **首次初始化**：部署完成后访问 `https://<你的域名>/admin/`（或你自定义的后台路径），在登录页选择「首次使用初始化」，创建管理员账号。
6. **站点设置**：登录后台 → 「站点设置」→ 填写站点名称、`siteUrl`（用于 SEO canonical / sitemap / RSS 的完整域名）、关于页、SEO 与社交信息。
7. **（可选）自定义后台路径**：在 EdgeOne Pages 控制台「环境变量」中添加 `ADMIN_PATH=你的秘密路径`（仅小写字母/数字/短横线/下划线，1–32 字符），重新部署后后台会从 `/admin/` 迁到 `/${你的秘密路径}/`，原 `/admin/` 返回 404。不设置则保持默认 `/admin/`。

## API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/setup` | 首次初始化管理员（一次性） |
| POST | `/api/auth/login` `/api/auth/logout` | 登录 / 登出（HttpOnly Cookie，失败限速） |
| GET | `/api/auth/me` | 当前登录状态 |
| POST | `/api/auth/totp` | TOTP 二次验证管理（setup/verify/disable，需管理员） |
| GET/POST | `/api/posts` | 文章列表（公开）/ 创建（管理员） |
| GET/PUT/DELETE | `/api/posts/:id` | 文章详情 / 更新 / 删除（支持 id 或 slug） |
| POST | `/api/posts/:slug/like` `/view` | 点赞 / 阅读量 |
| GET/POST | `/api/posts/:slug/comments` | 评论列表 / 提交 |
| GET | `/api/posts/:slug/related` | 相关文章 |
| GET/POST | `/api/categories` `/api/tags` | 分类 / 标签列表与创建 |
| GET | `/api/comments?status=` | 评论管理列表（管理员） |
| PUT/DELETE | `/api/comments/:id` | 审核（通过/拒绝）/ 删除 |
| POST | `/api/media/upload-url` | 获取 Blob 预签名直传 URL（管理员） |
| GET | `/api/media/*` | 媒体文件访问（公开，带缓存头） |
| GET/PUT | `/api/config` | 站点配置读取 / 更新 |
| GET | `/api/stats` | 访问统计（管理员） |
| POST | `/api/stats/track` | 访问埋点 |
| GET/POST | `/api/backup` | 导出全量备份 / 从备份恢复（管理员） |
| POST | `/api/backup/webdav` | 测试 WebDAV 连通性 / 立即备份到 WebDAV（管理员） |
| GET | `/api/search?q=` | 全文搜索 |
| GET | `/posts/:slug/` | 文章页（SSR 完整 HTML + SEO） |
| GET | `/categories/:slug/` `/tags/:slug/` | 归档页 SSR |
| GET | `/sitemap.xml` `/rss.xml` | SEO 产物 |

## KV 键设计

| 前缀 | 说明 |
|---|---|
| `config_site` | 站点配置 |
| `post_<id>` / `post_list` | 文章正文与列表索引 |
| `category_<id>` / `category_list` | 分类 |
| `tag_<id>` / `tag_list` | 标签 |
| `comment_<id>` / `comment_list` | 评论 |
| `stats_view_<id>` / `stats_like_<id>` | 文章阅读量 / 点赞 |
| `stats_daily_<YYYYMMDD>` / `stats_total` | 访问统计 |
| `media_list` | 媒体元数据 |
| `auth_admin` / `auth_session_<token>` | 管理员账户与会话 |

## 验证命令

```bash
npm run check:functions   # ✅ 37 个函数文件 esbuild 打包检查通过
npm run test:functions    # ✅ 41 项内存 mock 冒烟测试通过（认证/文章/评论/搜索/统计/媒体/SSR）
npm run build             # ✅ Next.js 静态导出 11 个页面到 out/
```

## 许可

MIT
