/* ============================================================
   SUVOO 进销存 — 云同步（Cloudflare Worker + D1）
   增量同步：本地改动差异推送（2 秒防抖），每 45 秒增量拉取
   （updated_at > since，含删除墓碑），流量只与变动量相关。
   库存以流水为准，拉取合并后重算，多设备并发不互相覆盖。
   ============================================================ */
const CLOUD_CFG_KEY = 'suvoo_ims_cloud2';
const CLOUD_TOKEN_KEY = 'suvoo_cloud_token';
const CLOUD_EMAIL_KEY = 'suvoo_cloud_email';
const SYNC_SNAP_KEY = 'suvoo_ims_sync_snap';
const SYNC_PULL_TS_KEY = 'suvoo_ims_pull_ts';
const CLOUD_DEFAULTS = { url: 'https://suvoo-api.lorenzzz87.workers.dev' };
const SYNC_PUSH_DELAY = 2000;
const SYNC_PULL_EVERY = 45000;
const PUSH_CHUNK = 400;

let syncDebounce = null;
let syncTicker = null;
let syncBusy = false;
const syncStatus = { state: 'off', lastAt: null, error: '', email: localStorage.getItem(CLOUD_EMAIL_KEY) || '' };
// state: off | login | syncing | ok | error

function getCloudCfg() {
  try {
    const raw = localStorage.getItem(CLOUD_CFG_KEY);
    if (raw) { const c = JSON.parse(raw); if (c && c.url) return c; }
  } catch (e) { /* ignore */ }
  return { ...CLOUD_DEFAULTS };
}
function saveCloudCfg(cfg) { localStorage.setItem(CLOUD_CFG_KEY, JSON.stringify(cfg)); }
function cloudToken() { return localStorage.getItem(CLOUD_TOKEN_KEY) || ''; }

async function api(path, opts = {}) {
  const cfg = getCloudCfg();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const tk = cloudToken();
  if (tk) headers['Authorization'] = 'Bearer ' + tk;
  const res = await fetch(cfg.url.replace(/\/$/, '') + path, { ...opts, headers });
  let body = null;
  try { body = await res.json(); } catch (e) { /* ignore */ }
  if (!res.ok) {
    const err = new Error((body && body.error) || ('HTTP ' + res.status));
    err.status = res.status;
    throw err;
  }
  return body;
}

/* ---------- 差异快照（id → hash） ---------- */
function recHash(obj) {
  const s = JSON.stringify(obj);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h;
}
function loadSnap() {
  try {
    const raw = localStorage.getItem(SYNC_SNAP_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { products: {}, orders: {}, moves: {}, channels: 0 };
}
let syncSnap = loadSnap();
function rebuildSnap() {
  const snap = { products: {}, orders: {}, moves: {}, channels: recHash(DB.channels) };
  for (const r of DB.products) snap.products[r.id] = recHash(r);
  for (const r of DB.orders) snap.orders[r.id] = recHash(r);
  for (const r of DB.moves) snap.moves[r.id] = recHash(r);
  syncSnap = snap;
  try { localStorage.setItem(SYNC_SNAP_KEY, JSON.stringify(snap)); } catch (e) { /* ignore */ }
}

/* ---------- 库存与流水一致性 ---------- */
function stockFromMoves() {
  const sum = {};
  for (const mv of DB.moves) {
    const k = normCode(mv.sku);
    sum[k] = (sum[k] || 0) + (Number(mv.qty) || 0);
  }
  return sum;
}
// 把「直接设置的库存」与流水差额补一条校准流水，让库存完全可由流水推导
function ensureStockBaseline() {
  const sums = stockFromMoves();
  let changed = false;
  for (const p of DB.products) {
    const diff = Math.round(((Number(p.stock) || 0) - (sums[normCode(p.sku)] || 0)) * 1000) / 1000;
    if (diff !== 0) {
      DB.moves.unshift({
        id: uid(), at: Date.now(), type: 'adjust', sku: p.sku, name: p.name,
        qty: diff, reason: '库存基线校准', ref: '', note: ''
      });
      changed = true;
    }
  }
  if (changed) save();
}
// 拉取合并后：库存 = 流水之和（多设备并发出入库自动收敛）
function recomputeStocks() {
  const sums = stockFromMoves();
  for (const p of DB.products) {
    p.stock = Math.round((sums[normCode(p.sku)] || 0) * 1000) / 1000;
  }
}

/* ---------- 同步引擎 ---------- */
function scheduleSync() {
  if (syncStatus.state === 'off' || syncStatus.state === 'login' || syncBusy) return;
  clearTimeout(syncDebounce);
  syncDebounce = setTimeout(() => syncNow(), SYNC_PUSH_DELAY);
}

function buildDiffOps() {
  const ops = []; // {tbl, up:{id,data}} | {tbl, del:id} | {meta:{key,data}}
  const pairs = [['products', DB.products], ['orders', DB.orders], ['moves', DB.moves]];
  for (const [tbl, list] of pairs) {
    const snapPart = syncSnap[tbl] || {};
    const ids = new Set();
    for (const r of list) {
      ids.add(r.id);
      if (snapPart[r.id] !== recHash(r)) ops.push({ tbl, up: { id: r.id, data: r } });
    }
    for (const id of Object.keys(snapPart)) {
      if (!ids.has(id)) ops.push({ tbl, del: id });
    }
  }
  if (recHash(DB.channels) !== syncSnap.channels) {
    ops.push({ meta: { key: 'channels', data: DB.channels } });
  }
  return ops;
}

async function pushOps(ops) {
  for (let i = 0; i < ops.length; i += PUSH_CHUNK) {
    const chunk = ops.slice(i, i + PUSH_CHUNK);
    const payload = { products: { up: [], del: [] }, orders: { up: [], del: [] }, moves: { up: [], del: [] }, meta: { up: [] } };
    for (const op of chunk) {
      if (op.meta) payload.meta.up.push(op.meta);
      else if (op.up) payload[op.tbl].up.push(op.up);
      else payload[op.tbl].del.push(op.del);
    }
    await api('/api/push', { method: 'POST', body: JSON.stringify(payload) });
  }
}

function applyDelta(list, rows) {
  if (!rows || !rows.length) return { list, changed: false };
  const map = new Map(list.map(r => [r.id, r]));
  for (const row of rows) {
    if (row.deleted) map.delete(row.id);
    else { try { map.set(row.id, JSON.parse(row.data)); } catch (e) { /* skip bad row */ } }
  }
  return { list: [...map.values()], changed: true };
}

async function syncNow(manual = false) {
  if (syncBusy) return;
  if (syncStatus.state === 'off' || (!cloudToken() && !manual)) return;
  if (!cloudToken()) { setSyncState('login'); return; }
  // 弹窗打开时跳过（避免正在编辑的对象被拉取替换）
  if (document.querySelector('#modalRoot .modal-overlay') && !manual) return;
  syncBusy = true;
  setSyncState('syncing');
  try {
    ensureStockBaseline();
    // 1) 推送本地差异
    const ops = buildDiffOps();
    if (ops.length) await pushOps(ops);
    // 2) 增量拉取（updated_at > since，含删除墓碑）
    const since = Number(localStorage.getItem(SYNC_PULL_TS_KEY) || 0);
    const out = await api('/api/pull?since=' + since);
    let changed = ops.length > 0;
    let r = applyDelta(DB.products, out.products);
    if (r.changed) { DB.products = r.list.sort((a, b) => String(a.sku).localeCompare(String(b.sku))); changed = true; }
    r = applyDelta(DB.orders, out.orders);
    if (r.changed) { DB.orders = r.list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); changed = true; }
    r = applyDelta(DB.moves, out.moves);
    if (r.changed) { DB.moves = r.list.sort((a, b) => (b.at || 0) - (a.at || 0)); changed = true; }
    for (const m of (out.meta || [])) {
      if (m.key === 'channels') {
        try {
          const ch = JSON.parse(m.data);
          if (Array.isArray(ch) && ch.length) { DB.channels = ch; changed = true; }
        } catch (e) { /* ignore */ }
      }
    }
    if (changed) {
      recomputeStocks();
      save();
      rebuildSnap();
    }
    localStorage.setItem(SYNC_PULL_TS_KEY, String((out.now || Date.now()) - 2000)); // 2 秒重叠防边界漏行
    syncStatus.lastAt = Date.now();
    setSyncState('ok');
    if (changed && !document.querySelector('#modalRoot .modal-overlay')) render();
    if (manual) toast('云同步完成', 'success');
  } catch (e) {
    console.error('同步失败', e);
    if (e && e.status === 401) {
      localStorage.removeItem(CLOUD_TOKEN_KEY);
      syncStatus.error = '登录已过期，请重新登录';
      setSyncState('login');
    } else {
      syncStatus.error = friendlySyncError(e);
      setSyncState('error');
    }
    if (manual) toast('同步失败：' + syncStatus.error, 'error');
  } finally {
    syncBusy = false;
    updateSyncUI();
  }
}

function friendlySyncError(e) {
  const msg = String((e && e.message) || e);
  if (/invalid_credentials/i.test(msg)) return '邮箱或密码不正确';
  if (/Failed to fetch|NetworkError|network|Load failed/i.test(msg)) return '网络不可用，恢复后会自动重试';
  return msg.slice(0, 120);
}

function setSyncState(s) { syncStatus.state = s; updateSyncUI(); }

function startSyncLoop() {
  clearInterval(syncTicker);
  syncTicker = setInterval(() => syncNow(), SYNC_PULL_EVERY);
  window.addEventListener('online', () => syncNow());
}

/* ---------- 登录 / 登出 ---------- */
async function cloudLogin(email, password) {
  let out;
  try {
    out = await api('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  } catch (e) {
    throw new Error(friendlySyncError(e));
  }
  localStorage.setItem(CLOUD_TOKEN_KEY, out.token);
  localStorage.setItem(CLOUD_EMAIL_KEY, out.email);
  syncStatus.email = out.email;
  setSyncState('syncing');
  startSyncLoop();
  await syncNow(true);
}
async function cloudLogout() {
  clearInterval(syncTicker);
  clearTimeout(syncDebounce);
  localStorage.removeItem(CLOUD_TOKEN_KEY);
  syncStatus.email = '';
  setSyncState('login');
  toast('已退出云同步，数据仍保留在本机');
}
function cloudReconnect(cfg) { saveCloudCfg(cfg); }

/* ---------- 状态指示 ---------- */
function syncStatusText() {
  switch (syncStatus.state) {
    case 'off': return '云同步未启用';
    case 'login': return '云同步：待登录';
    case 'syncing': return '云同步中…';
    case 'error': return '同步失败，自动重试中';
    case 'ok': {
      const d = new Date(syncStatus.lastAt);
      return `已同步 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }
  }
  return '';
}
function updateSyncUI() {
  const el = document.getElementById('syncStatus');
  if (el) {
    const color = { ok: '#34D399', syncing: '#FBBF24', error: '#F87171', login: '#94A3B8', off: '#64748B' }[syncStatus.state] || '#64748B';
    el.innerHTML = `<a href="#/settings" style="color:#94A3B8;display:inline-flex;align-items:center;gap:6px">
      <span style="width:8px;height:8px;border-radius:50%;background:${color};flex:0 0 8px"></span>${esc(syncStatusText())}</a>`;
  }
  const note = document.getElementById('storageNote');
  if (note) {
    const synced = syncStatus.state === 'ok' || syncStatus.state === 'syncing'
      || (syncStatus.state === 'error' && syncStatus.email);
    note.innerHTML = synced
      ? '数据已云端同步（' + esc(syncStatus.email) + '）<br>本机仅作离线缓存，多设备共享'
      : '数据保存在本机浏览器<br>登录云同步或定期在「设置」导出备份';
  }
  const badge = document.querySelector('[data-cloud-state]');
  if (badge) badge.textContent = syncStatusText();
  if (typeof translateDOM === 'function') {
    translateDOM(el); translateDOM(document.getElementById('storageNote'));
    if (badge) translateDOM(badge);
  }
}

/* ---------- 启动 ---------- */
async function initCloud() {
  if (cloudToken()) {
    setSyncState('syncing');
    startSyncLoop();
    syncNow();
  } else {
    setSyncState('login');
  }
}
