#!/usr/bin/env node
/**
 * 一次性种子脚本：创建 10 篇示例文章，其中 5 篇设为首页精选。
 * 直接写入 .local-data/kv.sqlite，复用真实 data.js 逻辑。
 * 用法：node --experimental-sqlite scripts/seed-10.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, '.local-data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'kv.sqlite'));
db.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
const sGet = db.prepare('SELECT value FROM kv WHERE key = ?');
const sPut = db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
const sDel = db.prepare('DELETE FROM kv WHERE key = ?');
const sList = db.prepare('SELECT key FROM kv WHERE key GLOB ? ORDER BY key LIMIT ?');
const sListAfter = db.prepare('SELECT key FROM kv WHERE key > ? AND key GLOB ? ORDER BY key LIMIT ?');

globalThis.__BLOG_KV__ = {
  async get(key) { const r = sGet.get(String(key)); return r ? r.value : null; },
  async put(key, value) { sPut.run(String(key), String(value)); },
  async delete(key) { sDel.run(String(key)); },
  async list({ prefix = '', limit = 1000, cursor = '' } = {}) {
    const pat = `${prefix}*`;
    const rows = cursor ? sListAfter.all(String(cursor), pat, limit) : sList.all(pat, limit);
    const complete = rows.length < limit;
    return { complete, cursor: complete ? null : (rows[rows.length - 1]?.key ?? null), keys: rows.map((r) => ({ key: r.key })) };
  },
};

const { createCategory, createPost, saveSiteConfig, ensureTagByName } = await import('../edge-functions/api/_lib/data.js');
const env = {};

/* 幂等：清空既有文章 / 分类 / 标签 / 配置 / 快照（保留访问统计） */
async function purge(prefix) {
  let cursor = '';
  for (;;) {
    const res = await globalThis.__BLOG_KV__.list({ prefix, limit: 256, ...(cursor ? { cursor } : {}) });
    for (const k of res.keys) await globalThis.__BLOG_KV__.delete(k.key);
    if (res.complete) break;
    cursor = res.cursor;
  }
}
await purge('post_');
await purge('category_');
await purge('tag_');
for (const k of ['post_list', 'category_list', 'tag_list', 'config_site', 'cache_public_posts']) {
  await globalThis.__BLOG_KV__.delete(k);
}

/* 分类 */
const catTech = await createCategory(env, { name: '技术随笔', description: '踩坑记录与工程思考', icon: 'code', sort: 1 });
const catTools = await createCategory(env, { name: '工具分享', description: '提效工具与工作流', icon: 'tool', sort: 2 });

async function tagIds(names) {
  const ids = [];
  for (const n of names) {
    const t = await ensureTagByName(env, n);
    if (t) ids.push(t.id);
  }
  return ids;
}

/* 10 篇示例文章；前 5 篇为精选 */
const seedPosts = [
  {
    featured: true,
    categoryId: catTech.id,
    tagNames: ['EdgeOne', '部署', 'Next.js'],
    title: '把三年博客部署到 EdgeOne Pages 的全过程',
    summary: '从传统 VPS 到边缘函数托管，记录迁移决策、KV/Blob 适配、静态导出踩坑与最终的体感差异。',
    content: `## 缘起

跑了三年的博客一直放在一台老 VPS 上，每月续费、手动备份、HTTPS 证书续期，烦不胜烦。这次下决心迁到 EdgeOne Pages，把运维彻底交给平台。

## 迁移决策

静态导出是关键。Next.js 的 \`output: 'export'\` 把每页都变成 HTML，配合边缘函数跑 API，前后端分离但同域部署。

## 踩坑记录

- 图片优化在静态导出下必须关闭
- KV 的 key 只能数字字母下划线
- 管理后台路径要可配置隐藏

## 体感

部署从 10 分钟降到 30 秒，再也不用惦记证书过期。`,
  },
  {
    featured: true,
    categoryId: catTech.id,
    tagNames: ['前端', '状态管理', '重构'],
    title: '为什么我把所有状态都收回了组件里',
    summary: '一次重构后的复盘：全局状态库用得越少，代码越容易读、越容易改。',
    content: `## 起因

项目里状态散落在四个 store 里，改一个字段要追三层依赖。这次重构把状态全部收回组件内部。

## 原则

- 状态跟着组件生命周期走
- 跨组件通信用 props 或 context
- 只有真正全局的才进 store

## 结果

组件数多了，但每个组件都能独立读懂。`,
  },
  {
    featured: true,
    categoryId: catTech.id,
    tagNames: ['CSS', '动画', '前端'],
    title: '一个 CSS 变量驱动的旋转卡片，我调了三天',
    summary: '封面流 coverflow 的 3D 变换、响应式尺寸与悬停放大，全部用 CSS 自定义属性驱动。',
    content: `## 目标

中央卡片大而清晰，两侧倾斜露出，hover 中央卡可放大。

## 实现

- transform 用 \`--i\` 与 \`--cur\` 的差值驱动
- scale 抽成 \`--scale\` 变量，hover 叠加 \`--hover-scale\`
- 三个断点各自调 \`--cw/--gap/--angle-side\`

## 教训

别把缩放写死在 transform 里，抽成变量才能被 hover 覆盖。`,
  },
  {
    featured: true,
    categoryId: catTools.id,
    tagNames: ['frp', '内网穿透', '工具'],
    title: '我用 frpc 把本地服务穿透出去看效果',
    summary: '不用部署到公网也能在手机上预览本地跑的前端，一条命令搞定。',
    content: `## 场景

改了前端样式想在手机上看，又不想每次 build 部署。frpc + 一台轻量云服务器就够了。

## 配置

本地 8080 → 远端 6080，tcp 隧道，token 鉴权。

\`\`\`toml
serverAddr = "x.x.x.x"
serverPort = 7000

[[proxies]]
name = "ddblog-6080"
type = "tcp"
localIP = "127.0.0.1"
localPort = 8080
remotePort = 6080
\`\`\`

## 体感

延迟低到无感，刷新即见改动。`,
  },
  {
    featured: true,
    categoryId: catTools.id,
    tagNames: ['MCP', 'AI', '工具'],
    title: '给博客加了一个 MCP Server，让 AI 帮我写文章',
    summary: '把文章管理封装成 Streamable HTTP 工具，AI 助手就能直接增删改查。',
    content: `## 思路

博客后台有全套 CRUD，再包一层 MCP 协议，任何支持 Streamable HTTP 的助手都能接。

## 工具集

list / get / create / update / delete / taxonomy / search，七个工具覆盖日常。

## 鉴权

独立于后台 Cookie，用 API Key + 哈希校验 + IP 限速。`,
  },
  {
    featured: false,
    categoryId: catTech.id,
    tagNames: ['排查', '内存'],
    title: '记一次 OOM 排查：从堆 dump 到一行代码',
    summary: '容器内存被打满，最终发现是一个缓存没有上限地增长。',
    content: `## 现象

容器凌晨被 OOM Killer 干掉，重启后几小时又复现。

## 过程

- 打开 heap dump，发现一个 Map 占了 80% 堆
- 顺着引用链找到缓存写入点
- 缓存 key 是用户输入，没有淘汰策略

## 修复

换成带容量上限的 LRU，并加了监控告警。`,
  },
  {
    featured: false,
    categoryId: catTech.id,
    tagNames: ['性能优化', 'Markdown'],
    title: '把 Markdown 渲染速度优化了 40 倍',
    summary: '从同步全量高亮到异步按需，profiling 给出的答案很直接。',
    content: `## 瓶颈

每篇文章渲染时对所有代码块同步高亮，长文能卡住主线程 300ms。

## 优化

- 代码块进入视口再高亮
- 高亮放到 Web Worker
- 结果按内容 hash 缓存

## 结果

首屏渲染从 320ms 降到 8ms。`,
  },
  {
    featured: false,
    categoryId: catTools.id,
    tagNames: ['自动化', '备份', '脚本'],
    title: '我用三个脚本自动化了博客备份',
    summary: 'KV 全量导出 + Blob 打包 + WebDAV 推送，一条 cron 搞定。',
    content: `## 组成

- export：把所有 KV 导出成 JSON
- pack：把 Blob 目录打成压缩包
- push：上传到 WebDAV，保留最近 30 份

## 调度

crontab 每天凌晨 3 点跑一次，失败发邮件。`,
  },
  {
    featured: false,
    categoryId: catTools.id,
    tagNames: ['Vditor', '插件', '图床'],
    title: '给 Vditor 写了一个本地图床插件',
    summary: '粘贴即上传到 Blob，返回代理 URL，编辑体验顺了很多。',
    content: `## 需求

在编辑器里粘贴图片，自动上传并插入 Markdown 图片语法。

## 实现

监听 paste 事件 → 调上传接口拿 key → 插入 \`![](/api/media/key)\`。

## 收获

把重复操作交给插件，写作时注意力更集中。`,
  },
  {
    featured: false,
    categoryId: catTech.id,
    tagNames: ['暗色模式', 'CSS', '前端'],
    title: '博客的暗色模式是怎么做到平滑切换的',
    summary: '主题动画窗口 + 全局过渡，避免参差跳变。',
    content: `## 问题

直接切 class，颜色瞬间跳变，很生硬。

## 方案

- 用 \`View Transitions API\` 包裹切换
- 不支持时退回全局 \`transition: background-color .3s\`
- 偏好存 localStorage，首屏无闪烁

## 效果

点一下，整页颜色平滑过渡。`,
  },
];

const slugList = [
  'edgeone-pages-deploy',
  'state-back-into-components',
  'css-variable-coverflow',
  'frpc-local-tunnel',
  'mcp-server-for-blog',
  'oom-debugging',
  'markdown-render-40x',
  'blog-backup-scripts',
  'vditor-local-imagebed',
  'smooth-dark-mode',
];

const created = [];
for (const p of seedPosts) {
  const tags = await tagIds(p.tagNames || []);
  const post = await createPost(env, {
    slug: slugList[created.length],
    title: p.title,
    summary: p.summary,
    content: p.content,
    categoryId: p.categoryId,
    tags,
    status: 'published',
    visibility: 'public',
    coverUrl: '',
  });
  created.push({ post, featured: !!p.featured });
}

/* 错开时间：精选最新，普通稍旧；同步回写 post 与 post_list，并补统计 */
const now = Date.now();
const interval = 12 * 3600 * 1000;
const id2time = new Map();
created.forEach(({ post }, i) => {
  const iso = new Date(now - i * interval).toISOString();
  id2time.set(post.id, iso);
  post.createdAt = iso;
  post.publishedAt = iso;
  sPut.run(`post_${post.id}`, JSON.stringify(post));
});

const rawList = JSON.parse((await globalThis.__BLOG_KV__.get('post_list')) || '[]');
for (const s of rawList) {
  const iso = id2time.get(s.id);
  if (iso) { s.createdAt = iso; s.publishedAt = iso; }
}
sPut.run('post_list', JSON.stringify(rawList));

/* 阅读量 / 点赞数，让页面更有内容感 */
created.forEach(({ post }, i) => {
  const views = 420 - i * 31 + ((i * 17) % 40);
  const likes = 60 - i * 4 + (i % 5);
  sPut.run(`stats_view_${post.id}`, JSON.stringify({ count: Math.max(12, views) }));
  sPut.run(`stats_like_${post.id}`, JSON.stringify({ count: Math.max(2, likes) }));
});

/* 精选 = 前 5 篇 */
const featuredIds = created.filter((c) => c.featured).map((c) => c.post.id);

await saveSiteConfig(env, {
  title: '墨痕 · 记录与思考',
  subtitle: '技术踩坑 · 工具分享 · 网络观察——用文字存档思考，把零散的认知沉淀成可回看的内容。',
  description: '一个基于 EdgeOne Pages 的个人博客，记录工程思考与工具分享。',
  keywords: '博客, 技术, 工具, 随笔',
  author: '博主',
  footerText: 'Powered by EdgeOne Pages · 墨痕',
  heroQuote: '文字是思考的存档。',
  featuredLayout: 'carousel',
  featuredPostIds: featuredIds,
  perPage: 10,
});

await globalThis.__BLOG_KV__.delete('cache_public_posts');

console.log(`[seed-10] 已创建 ${created.length} 篇文章，精选 ${featuredIds.length} 篇`);
console.log('[seed-10] 精选：');
created.filter((c) => c.featured).forEach((c, i) => console.log(`  ${i + 1}. ${c.post.title}  (${c.post.slug})`));