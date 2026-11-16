/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REALTIME_URL?: string;
  readonly VITE_DONATE_URL?: string;
  /** 预览包打开调试钩子（window.__banshan），生产构建不设 */
  readonly VITE_DEBUG_HOOKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
