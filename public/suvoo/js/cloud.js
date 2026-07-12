/* ============================================================
   SUVOO 进销存 — 云同步（Supabase）
   行级差异同步：本地为主，改动后 2 秒推送，每 45 秒拉取合并。
   库存以流水（moves）为准，拉取后重算，多设备并发扫单不丢数。
   ============================================================ */
const CLOUD_CFG_KEY = 'suvoo_ims_cloud';
const SYNC_SNAP_KEY = 'suvoo_ims_sync_snap';
const CLOUD_DEFAULTS = {
  url: 'https://zzsocnuqopudapecgkzu.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6c29jbnVxb3B1ZGFwZWNna3p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2Mzk4MDQsImV4cCI6MjA5NzIxNTgwNH0.AwXd0HLmWQhlmltzeHRCKuUOqnluSBoB0JoSyQ4Ouzg'
};
const SYNC_PUSH_DELAY = 2000;
const SYNC_PULL_EVERY = 45000;

let sb = null;
let syncDebounce = null;
let syncTicker = null;
let syncBusy = false;
const syncStatus = { state: 'off', lastAt: null, error: '', email: '' };
// state: off | nolib | login | syncing | ok | error

function getCloudCfg() {
  try {
    const raw = localStorage.getItem(CLOUD_CFG_KEY);
    if (raw) { const c = JSON.parse(raw); if (c && c.url && c.key) return c; }
  } catch (e) { /* ignore */ }
  return { ...CLOUD_DEFAULTS };
}
function saveCloudCfg(cfg) { localStorage.setItem(CLOUD_CFG_KEY, JSON.stringify(cfg)); }

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
// 首次/异常时：把「直接设置的库存」与流水的差额补一条校准流水，让库存完全可由流水推导
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
  if (!sb || syncStatus.state === 'off' || syncStatus.state === 'login' || syncBusy) return;
  clearTimeout(syncDebounce);
  syncDebounce = setTimeout(() => syncNow(), SYNC_PUSH_DELAY);
}

function chunks(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// 分页拉取整张表（PostgREST 单次最多返回 1000 行，须用 range 翻页）
const PAGE = 1000;
async function fetchAllRows(table) {
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select('data').range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...data);
    if (!data || data.length < PAGE) break;
  }
  return all;
}

async function pushTable(table, rows, snapPart) {
  const ids = new Set(rows.map(r => r.id));
  const ups = rows.filter(r => snapPart[r.id] !== recHash(r));
  const dels = Object.keys(snapPart).filter(id => !ids.has(id));
  for (const c of chunks(ups, 400)) {
    const { error } = await sb.from(table).upsert(c.map(r => ({ id: r.id, data: r })));
    if (error) throw error;
  }
  for (const c of chunks(dels, 400)) {
    const { error } = await sb.from(table).delete().in('id', c);
    if (error) throw error;
  }
  return ups.length + dels.length;
}

async function syncNow(manual = false) {
  if (!sb || syncBusy) return;
  if (syncStatus.state === 'off' || syncStatus.state === 'login' || syncStatus.state === 'nolib') return;
  // 弹窗打开时跳过（避免正在编辑的对象被拉取替换）
  if (document.querySelector('#modalRoot .modal-overlay')) { if (!manual) return; }
  const { data: sess } = await sb.auth.getSession();
  if (!sess || !sess.session) { setSyncState('login'); return; }
  syncStatus.email = sess.session.user.email || '';
  syncBusy = true;
  setSyncState('syncing');
  try {
    ensureStockBaseline();
    // 1) 推送本地差异
    let pushed = 0;
    pushed += await pushTable('suvoo_products', DB.products, syncSnap.products);
    pushed += await pushTable('suvoo_orders', DB.orders, syncSnap.orders);
    pushed += await pushTable('suvoo_moves', DB.moves, syncSnap.moves);
    if (recHash(DB.channels) !== syncSnap.channels) {
      const { error } = await sb.from('suvoo_meta').upsert({ key: 'channels', data: DB.channels });
      if (error) throw error;
    }
    // 2) 拉取云端全量并重建本地（分页，绕过 PostgREST 单次 1000 行上限）
    const [pRows, oRows, mRows, meta] = await Promise.all([
      fetchAllRows('suvoo_products'),
      fetchAllRows('suvoo_orders'),
      fetchAllRows('suvoo_moves'),
      sb.from('suvoo_meta').select('key,data').eq('key', 'channels')
    ]);
    if (meta.error) throw meta.error;
    const before = JSON.stringify([DB.products, DB.orders, DB.moves, DB.channels]);
    DB.products = pRows.map(r => r.data).sort((a, b) => String(a.sku).localeCompare(String(b.sku)));
    DB.orders = oRows.map(r => r.data).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    DB.moves = mRows.map(r => r.data).sort((a, b) => (b.at || 0) - (a.at || 0));
    if (meta.data.length && Array.isArray(meta.data[0].data) && meta.data[0].data.length) {
      DB.channels = meta.data[0].data;
    }
    recomputeStocks();
    save();
    rebuildSnap();
    syncStatus.lastAt = Date.now();
    setSyncState('ok');
    const after = JSON.stringify([DB.products, DB.orders, DB.moves, DB.channels]);
    if (before !== after && !document.querySelector('#modalRoot .modal-overlay')) render();
    if (manual) toast('云同步完成', 'success');
  } catch (e) {
    console.error('同步失败', e);
    syncStatus.error = friendlySyncError(e);
    setSyncState('error');
    if (manual) toast('同步失败：' + syncStatus.error, 'error');
  } finally {
    syncBusy = false;
    updateSyncUI();
  }
}

function friendlySyncError(e) {
  const msg = String((e && (e.message || e.hint)) || e);
  if (/does not exist|PGRST205|Could not find the table/i.test(msg)) {
    return '云端数据表不存在，请先在 Supabase SQL 编辑器执行 suvoo-cloud-schema.sql';
  }
  if (/row-level security|permission denied|42501/i.test(msg)) {
    return '没有权限：请确认登录邮箱已加入 suvoo_users 白名单';
  }
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return '网络不可用，恢复后会自动重试';
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
  if (!sb) throw new Error('Supabase 未初始化');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(/Invalid login/i.test(error.message) ? '邮箱或密码不正确（需先在 Supabase 后台创建账号）' : error.message);
  syncStatus.email = data.user.email || email;
  setSyncState('syncing');
  startSyncLoop();
  await syncNow(true);
}
async function cloudLogout() {
  clearInterval(syncTicker);
  clearTimeout(syncDebounce);
  if (sb) await sb.auth.signOut();
  syncStatus.email = '';
  setSyncState('login');
  toast('已退出云同步，数据仍保留在本机');
}
function cloudReconnect(cfg) {
  saveCloudCfg(cfg);
  sb = window.supabase ? window.supabase.createClient(cfg.url, cfg.key) : null;
}

/* ---------- 状态指示 ---------- */
function syncStatusText() {
  switch (syncStatus.state) {
    case 'off': return '云同步未启用';
    case 'nolib': return '云同步组件加载失败';
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
    const color = { ok: '#34D399', syncing: '#FBBF24', error: '#F87171', login: '#94A3B8', off: '#64748B', nolib: '#F87171' }[syncStatus.state] || '#64748B';
    el.innerHTML = `<a href="#/settings" style="color:#94A3B8;display:inline-flex;align-items:center;gap:6px">
      <span style="width:8px;height:8px;border-radius:50%;background:${color};flex:0 0 8px"></span>${esc(syncStatusText())}</a>`;
  }
  const badge = document.querySelector('[data-cloud-state]');
  if (badge) badge.textContent = syncStatusText();
}

/* ---------- 启动 ---------- */
async function initCloud() {
  if (!window.supabase) { setSyncState('nolib'); return; }
  const cfg = getCloudCfg();
  sb = window.supabase.createClient(cfg.url, cfg.key);
  try {
    const { data } = await sb.auth.getSession();
    if (data && data.session) {
      syncStatus.email = data.session.user.email || '';
      setSyncState('syncing');
      startSyncLoop();
      syncNow();
    } else {
      setSyncState('login');
    }
  } catch (e) {
    setSyncState('login');
  }
}
