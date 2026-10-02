#!/usr/bin/env node
/**
 * 后台路径环境变量化（构建时）。
 *
 * 读取环境变量 ADMIN_PATH（默认 "admin"）：
 *   - 若 ADMIN_PATH === "admin"：保持现状（向后兼容）。
 *   - 否则把 out/admin/ 重命名为 out/<ADMIN_PATH>/，并删除原 out/admin/，
 *     使 /admin 路径返回 404，后台只能通过自定义路径访问。
 *
 * 约束：ADMIN_PATH 仅允许小写字母、数字、短横线、下划线，长度 1-32，
 * 防止路径穿越（如 "../" 或绝对路径）。
 *
 * 在 EdgeOne Pages 控制台设置环境变量 ADMIN_PATH=your-secret-path 后重新部署即可。
 */
import { existsSync, renameSync, rmSync, statSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';

const outDir = resolve(process.cwd(), 'out');
const raw = (process.env.ADMIN_PATH || 'admin').trim();

// 校验：拒绝空、绝对路径、包含分隔符、超出字符集
if (!raw || raw.includes('/') || raw.includes('\\') || raw.includes('..')) {
  console.error(`[relocate-admin] 非法 ADMIN_PATH="${raw}"：仅允许单层目录名（不含 / \\ ..）`);
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(raw)) {
  console.error(`[relocate-admin] 非法 ADMIN_PATH="${raw}"：需匹配 ^[a-z0-9][a-z0-9_-]{0,31}$`);
  process.exit(1);
}

if (raw === 'admin') {
  console.log('[relocate-admin] ADMIN_PATH 未自定义，保持默认 /admin');
  process.exit(0);
}

const src = join(outDir, 'admin');
const dst = join(outDir, raw);

if (!existsSync(src)) {
  console.error(`[relocate-admin] 未找到 ${src}，跳过`);
  process.exit(0);
}
if (!statSync(src).isDirectory()) {
  console.error(`[relocate-admin] ${src} 不是目录，跳过`);
  process.exit(0);
}
if (existsSync(dst)) {
  rmSync(dst, { recursive: true, force: true });
}

renameSync(src, dst);
// 删除原 /admin 路径，使其返回 404
rmSync(src, { recursive: true, force: true });

console.log(`[relocate-admin] 后台路径已重命名：/admin → /${raw}/`);
console.log(`[relocate-admin] 请通过 https://<你的域名>/${raw}/ 访问后台`);
