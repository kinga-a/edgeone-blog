#!/usr/bin/env node
/**
 * 本地演示数据种子：复用真实 data.js 逻辑，写入 .local-data/kv.json。
 * 先于 local-serve.mjs 运行一次即可；之后 local-serve 启动会加载该数据。
 * 用法：node scripts/seed-demo.mjs
 */
import fs from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, '.local-data');
const KV_FILE = path.join(DATA_DIR, 'kv.json');

await fs.mkdir(DATA_DIR, { recursive: true });

/* ---------------- KV mock（文件持久化，与 local-serve.mjs 同款） ---------------- */
let kvMap = new Map();
try {
  kvMap = new Map(Object.entries(JSON.parse(await fs.readFile(KV_FILE, 'utf8'))));
} catch { /* 首次运行 */ }

function saveKv() {
  writeFileSync(KV_FILE, JSON.stringify(Object.fromEntries(kvMap), null, 0));
}

globalThis.__BLOG_KV__ = {
  async put(key, value) { kvMap.set(String(key), String(value)); saveKv(); },
  async get(key) { const v = kvMap.get(String(key)); return v === undefined ? null : v; },
  async delete(key) { kvMap.delete(String(key)); saveKv(); },
  async list({ prefix = '', limit = 1000, cursor = '' } = {}) {
    const keys = [...kvMap.keys()].filter((k) => k.startsWith(prefix)).sort();
    const start = cursor ? keys.indexOf(cursor) + 1 : 0;
    const slice = keys.slice(start, start + limit);
    const complete = start + limit >= keys.length;
    return { complete, cursor: complete ? null : slice[slice.length - 1] ?? null, keys: slice.map((key) => ({ key })) };
  },
};

/* ---------------- 复用真实数据层 ---------------- */
const { createCategory, createPost, saveSiteConfig } = await import('../edge-functions/api/_lib/data.js');

const env = {};

/* ---------------- 分类 ---------------- */
const cat1 = await createCategory(env, { name: '技术随笔', description: '踩坑记录与工程思考' });
const cat2 = await createCategory(env, { name: '工具分享', description: '提效工具与工作流' });

/* ---------------- 精选文章（旋转卡片） ---------------- */
const featured = [
  {
    title: '把三年博客部署到 EdgeOne Pages 的全过程',
    summary: '从传统 VPS 到边缘函数托管，记录迁移决策、KV/Blob 适配、静态导出踩坑与最终的体感差异。',
    content: `## 缘起

跑了三年的博客一直放在一台老 VPS 上，每月续费、手动备份、HTTPS 证书续期，烦不胜烦。这次下决心迁到 EdgeOne Pages，把运维彻底交给平台。

## 迁移决策

静态导出是关键。Next.js 的 output: 'export' 把每页都变成 HTML，配合边缘函数跑 API，前后端分离但同域部署。

## 踩坑记录

- 图片优化在静态导出下必须关闭
- KV 的 key 只能数字字母下划线
- 管理后台路径要可配置隐藏

## 体感

部署从 10 分钟降到 30 秒，再也不用惦记证书过期。`,
    categoryId: cat1.id,
  },
  {
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
    categoryId: cat1.id,
  },
  {
    title: '一个 CSS 变量驱动的旋转卡片，我调了三天',
    summary: '封面流 coverflow 的 3D 变换、响应式尺寸与悬停放大，全部用 CSS 自定义属性驱动。',
    content: `## 目标

中央卡片大而清晰，两侧倾斜露出，hover 中央卡可放大。

## 实现

- transform 用 --i 与 --cur 的差值驱动
- scale 抽成 --scale 变量，hover 叠加 --hover-scale
- 三个断点各自调 --cw/--gap/--angle-side

## 教训

别把缩放写死在 transform 里，抽成变量才能被 hover 覆盖。`,
    categoryId: cat1.id,
  },
  {
    title: '我用 frpc 把本地服务穿透出去看效果',
    summary: '不用部署到公网也能在手机上预览本地跑的前端，一条命令搞定。',
    content: `## 场景

改了前端样式想在手机上看，又不想每次 build 部署。frpc + 一台轻量云服务器就够了。

## 配置

本地 8080 → 远端 6080，tcp 隧道，token 鉴权。

## 体感

延迟低到无感，刷新即见改动。`,
    categoryId: cat2.id,
  },
  {
    title: '给博客加了一个 MCP Server，让 AI 帮我写文章',
    summary: '把文章管理封装成 Streamable HTTP 工具，AI 助手就能直接增删改查。',
    content: `## 思路

博客后台有全套 CRUD，再包一层 MCP 协议，任何支持 Streamable HTTP 的助手都能接。

## 工具集

list / get / create / update / delete / taxonomy / search，七个工具覆盖日常。

## 鉴权

独立于后台 Cookie，用 API Key + 哈希校验 + IP 限速。`,
    categoryId: cat2.id,
  },
  {
    title: '深夜重读《重构》：那些我当年划过的线',
    summary: '翻出十年前的读书笔记，发现当时看不懂的，现在都成了日常。',
    content: `## 重读

十年前划的重点，如今每条都对应一个真实踩过的坑。

## 摘抄

- 坏味道不是错误，是气味
- 重构的前提是测试
- 小步快跑，随时可停

## 感想

书没变，人变了。`,
    categoryId: cat1.id,
  },
];

const featuredIds = [];
for (const p of featured) {
  const post = await createPost(env, { ...p, status: 'published', visibility: 'public' });
  featuredIds.push(post.id);
}

/* ---------------- 非精选文章（填充最新/热门） ---------------- */
const others = [
  { title: '记一次 OOM 排查：从堆 dump 到一行代码', summary: '容器内存被打满，最终是一个缓存无限增长。', cat: cat1.id, views: 320 },
  { title: '把 Markdown 渲染速度优化了 40 倍', summary: '从同步高亮到异步按需， profiling 给出的答案很直接。', cat: cat1.id, views: 210 },
  { title: '我用三个脚本自动化了博客备份', summary: 'KV 全量导出 + Blob 打包 + WebDAV 推送，一条 cron 搞定。', cat: cat2.id, views: 188 },
  { title: '给 Vditor 写了一个本地图床插件', summary: '粘贴即上传到 Blob，返回代理 URL，编辑体验顺了很多。', cat: cat2.id, views: 142 },
  { title: '响应式图片在静态导出下的正确姿势', summary: 'srcset + sizes 手写，不用 next/image，也能自适应。', cat: cat1.id, views: 97 },
  { title: '博客的暗色模式是怎么做到平滑切换的', summary: '主题动画窗口 + 全局过渡，避免参差跳变。', cat: cat1.id, views: 76 },
  { title: '我用 esbuild 替换了 webpack 构建链', summary: '构建从 90s 降到 8s，代价是两个插件自己写。', cat: cat2.id, views: 61 },
  { title: '给文章页加了阅读进度环', summary: 'SVG 圆环 + 滚动监听，纯 CSS 变量驱动。', cat: cat2.id, views: 45 },
  { title: '一次域名迁移的 301 地图', summary: '旧路径全量映射到新站，SEO 流量零损失。', cat: cat1.id, views: 28 },
];

const otherIds = [];
for (const p of others) {
  const post = await createPost(env, { ...p, status: 'published', visibility: 'public' });
  otherIds.push(post.id);
  // 写入阅读量
  kvMap.set(`stats_view_${post.id}`, JSON.stringify({ count: p.views }));
}
saveKv();

/* ---------------- 站点配置：旋转卡片布局 ---------------- */
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
});

console.log(`[seed] 分类 2 篇，精选 ${featuredIds.length} 篇，其他 ${otherIds.length} 篇，已写入 ${KV_FILE}`);
