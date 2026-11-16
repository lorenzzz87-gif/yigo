// 把前端打成一个可以发布为 Claude Artifact 的预览包：
//   node scripts/build-preview.mjs <输出目录>
// 产物：banshan-preview.html（页面片段，样式内联）和 app.js（固定文件名，方便原地更新）。
// 只用于开发期预览。Artifact 不允许连接外部服务，M3 起的多人同步要用 Cloudflare 部署来看。
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(process.argv[2] ?? 'preview-dist');
const web = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web');
const dist = join(out, 'vite');

execFileSync('pnpm', ['exec', 'vite', 'build', '--base', './', '--outDir', dist, '--emptyOutDir'], {
  cwd: web,
  stdio: 'inherit',
});

const assets = readdirSync(join(dist, 'assets'));
const js = assets.filter((f) => f.endsWith('.js'));
const css = assets.filter((f) => f.endsWith('.css'));
if (js.length !== 1) throw new Error(`expected one JS bundle, got ${js.length}`);

const styles = css.map((f) => readFileSync(join(dist, 'assets', f), 'utf8')).join('\n');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'app.js'), readFileSync(join(dist, 'assets', js[0])));
writeFileSync(
  join(out, 'banshan-preview.html'),
  `<title>半山 · 云上禅寺</title>
<meta name="theme-color" content="#EDE8DD" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500&display=swap" />
<style>${styles}</style>
<div id="root"></div>
<script type="module" src="app.js"></script>
`,
);
console.log(`preview written to ${out}`);
