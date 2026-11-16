# 半山 · 云上禅寺

需求见 [CLAUDE.md](./CLAUDE.md)。

```sh
pnpm install
pnpm dev      # 前端 http://localhost:5173 ，Worker http://localhost:8787
pnpm test
pnpm build
pnpm lint
```

- `apps/web` — 前端（Vite + React + React Three Fiber）
- `workers/realtime` — 实时服务（Cloudflare Workers + Durable Objects）
- `packages/shared` — 协议、常量、文案

改了 `workers/realtime/wrangler.jsonc` 之后，在该目录跑一次 `pnpm types`。
