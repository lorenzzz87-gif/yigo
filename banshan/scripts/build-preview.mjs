// 把前端打成一个可以发布为 Claude Artifact 的预览包：
//   node scripts/build-preview.mjs <输出目录>
//
// 预览页不能连外部服务，所以殿（workers/realtime 的 Room 代码）直接在页面里跑，
// 页面上下两个画面各是一个完整的客户端，按真实协议和它说话。只用于开发期预览，不进生产构建。
//
// 产物（文件名固定，方便原地更新）：
//   banshan-preview.html  外层页面：两个画面 + 断网按钮
//   host.js               外层页面里跑的殿
//   client.html           单个客户端
//   shim.js               客户端里把 WebSocket 接到外层页面
//   app.js                应用本体
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const out = resolve(process.argv[2] ?? 'preview-dist');
const web = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web');
const require = createRequire(join(web, 'package.json'));
const { build } = await import(pathToFileURL(require.resolve('vite')).href);
const tmp = join(out, '.build');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 1. 应用本体：实时服务指向 loopback，由 shim 接住
process.env.VITE_REALTIME_URL = 'http://loopback';
process.env.VITE_DEBUG_HOOKS = '1';
await build({
  root: web,
  base: './',
  logLevel: 'warn',
  build: { outDir: join(tmp, 'app'), emptyOutDir: true },
});
const assets = readdirSync(join(tmp, 'app', 'assets'));
const js = assets.filter((f) => f.endsWith('.js'));
if (js.length !== 1) throw new Error(`expected one JS bundle, got ${js.length}`);
const css = assets
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(join(tmp, 'app', 'assets', f), 'utf8'))
  .join('\n');
writeFileSync(join(out, 'app.js'), readFileSync(join(tmp, 'app', 'assets', js[0])));

// 2. 两个小脚本：外层的殿、客户端的 shim
const lib = (entry, name, format, alias = {}) =>
  build({
    root: web,
    logLevel: 'warn',
    configFile: false,
    resolve: { alias },
    build: {
      outDir: join(tmp, name),
      emptyOutDir: true,
      minify: true,
      lib: {
        entry: join(web, 'preview', entry),
        formats: [format],
        name,
        fileName: () => `${name}.js`,
      },
    },
  });
await lib('host.ts', 'host', 'es', { 'cloudflare:workers': join(web, 'preview', 'cf-shim.ts') });
await lib('shim.ts', 'shim', 'iife');
for (const name of ['host', 'shim']) {
  writeFileSync(join(out, `${name}.js`), readFileSync(join(tmp, name, `${name}.js`)));
}
rmSync(tmp, { recursive: true, force: true });

const FONT =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500&display=swap" />';

writeFileSync(
  join(out, 'client.html'),
  `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
${FONT}
<style>${css}</style>
<script src="shim.js"></script>
</head>
<body>
<div id="root"></div>
<script type="module" src="app.js"></script>
</body>
</html>
`,
);

writeFileSync(
  join(out, 'banshan-preview.html'),
  `<title>半山 · 云上禅寺</title>
<meta name="theme-color" content="#EDE8DD" />
${FONT}
<style>
  :root { --xuan: #ede8dd; --jiaomo: #2b2b28; --danmo: #8a8578; --line: rgb(43 43 40 / 35%); color-scheme: light; }
  html, body { height: 100%; margin: 0; background: var(--xuan); color: var(--jiaomo); font-family: 'Noto Serif SC', 'Songti SC', serif; }
  .demo { display: flex; flex-direction: column; height: 100%; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px;
    padding-block: 8px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
    border-bottom: 1px solid var(--line); font-size: 13px; }
  .bar p { margin: 0; color: var(--danmo); }
  .bar button { min-height: 44px; padding: 0 14px; border: 1px solid var(--jiaomo); border-radius: 0; background: none;
    color: var(--jiaomo); font: inherit; font-size: 13px; cursor: pointer; }
  .bar button:disabled { color: var(--danmo); border-color: var(--line); cursor: default; }
  .bar button:focus-visible { outline: 2px solid var(--jiaomo); outline-offset: 2px; }
  .views { flex: 1; min-height: 0; display: grid; grid-template-rows: 1fr 1fr; }
  @media (min-aspect-ratio: 1/1) { .views { grid-template-rows: none; grid-template-columns: 1fr 1fr; } }
  .view { position: relative; min-height: 0; min-width: 0; }
  .view + .view { border-top: 1px solid var(--jiaomo); }
  @media (min-aspect-ratio: 1/1) { .view + .view { border-top: 0; border-left: 1px solid var(--jiaomo); } }
  .view iframe { display: block; width: 100%; height: 100%; border: 0; }
  .tag { position: absolute; left: 8px; top: 8px; z-index: 1; padding: 2px 8px; font-size: 12px;
    background: rgb(237 232 221 / 85%); border: 1px solid var(--line); pointer-events: none; }
</style>
<div class="demo">
  <div class="bar">
    <p>开发预览：甲和乙是同一个殿里的两个人，各自独立操作。</p>
    <button id="drop" type="button">让乙断网 20 秒</button>
  </div>
  <div class="views">
    <div class="view"><span class="tag">甲</span><iframe id="a" src="client.html?who=a" title="甲的画面"></iframe></div>
    <div class="view"><span class="tag">乙</span><iframe id="b" src="client.html?who=b" title="乙的画面"></iframe></div>
  </div>
</div>
<script type="module" src="host.js"></script>
`,
);
console.log(`preview written to ${out}`);
