/**
 * 函数语法/依赖检查：用 esbuild 逐个打包 edge-functions 下的所有入口文件，
 * 模拟 EdgeOne 构建器的打包过程，提前发现语法错误、缺失依赖等问题。
 * 运行：npm run check:functions
 */
import { build } from 'esbuild';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../edge-functions', import.meta.url).pathname;

function listJs(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listJs(p, acc);
    else if (name.endsWith('.js')) acc.push(p);
  }
  return acc;
}

const files = listJs(ROOT);
console.log(`发现 ${files.length} 个函数文件，开始打包检查…\n`);

let failed = 0;
for (const file of files) {
  try {
    const result = await build({
      entryPoints: [file],
      bundle: true,
      platform: 'browser',
      format: 'esm',
      write: false,
      logLevel: 'silent',
      external: ['@edgeone/pages-blob'],
    });
    const size = result.outputFiles.reduce((s, f) => s + f.contents.length, 0);
    console.log(`✓ ${relative(ROOT, file)}  (${(size / 1024).toFixed(1)} KB)`);
  } catch (e) {
    failed++;
    console.error(`✗ ${relative(ROOT, file)}`);
    console.error(`  ${e.errors?.map((x) => x.text).join('; ') || e.message}`);
  }
}

console.log(`\n${failed ? `❌ ${failed} 个文件检查失败` : '✅ 全部函数文件打包检查通过'}`);
process.exit(failed ? 1 : 0);
