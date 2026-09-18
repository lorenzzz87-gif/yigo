/* ============================================================
   SUVOO 进销存 — 路由与启动
   ============================================================ */
const ROUTES = [
  { path: 'dashboard', label: '概览', icon: 'dashboard', render: renderDashboard },
  { path: 'pack', label: '扫码打包', icon: 'pack', render: renderPack },
  { path: 'scan', label: '物流分拣', icon: 'truck', render: renderSort },
  { path: 'orders', label: '订单管理', icon: 'orders', render: renderOrders },
  { path: 'products', label: '商品库存', icon: 'package', render: renderProducts },
  { path: 'inbound', label: '入库', icon: 'inbound', render: renderInbound },
  { path: 'records', label: '出入流水', icon: 'history', render: renderRecords },
  { path: 'settings', label: '设置', icon: 'settings', render: renderSettings }
];

function currentPath() {
  const h = location.hash.replace(/^#\/?/, '');
  return ROUTES.some(r => r.path === h) ? h : 'dashboard';
}

function drawNav(active) {
  const pending = DB.orders.filter(o => o.status === 'pending').length;
  document.getElementById('nav').innerHTML = ROUTES.map(r =>
    `<a href="#/${r.path}" class="${r.path === active ? 'active' : ''}">${icon(r.icon, 18)}${r.label}${
      r.path === 'orders' && pending ? `<span class="nav-badge">${pending}</span>` : ''}</a>`).join('');
}

function drawBackupHint() {
  const box = document.getElementById('backupHint');
  if (!box) return;
  // 已开启云同步时数据有云端副本，不再催本地备份
  const synced = typeof syncStatus !== 'undefined' &&
    (syncStatus.state === 'ok' || syncStatus.state === 'syncing');
  const busy = DB.orders.length + DB.moves.length;
  const stale = DB.settings.lastBackup && (Date.now() - DB.settings.lastBackup > 7 * 86400e3);
  box.innerHTML = (!synced && busy > 30 && (!DB.settings.lastBackup || stale))
    ? `<span class="hint-pill">⚠ 建议去「设置」导出备份</span>` : '';
}

/* ---------- 新订单响铃提醒 + 接单 ---------- */
const orderAlertState = { muted: false, timer: null };
function unclaimedOrders() {
  return DB.orders.filter(o => o.status === 'pending' && !o.claimed);
}
function ensureAlertBar() {
  let bar = document.getElementById('orderAlertBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'orderAlertBar';
    bar.className = 'order-alert-bar';
    bar.hidden = true;
    document.body.appendChild(bar);
  }
  return bar;
}
function renderAlertBar() {
  const bar = ensureAlertBar();
  const n = unclaimedOrders().length;
  if (!n || DB.settings.orderAlert === false) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.classList.toggle('muted', orderAlertState.muted);
  bar.innerHTML =
    `<span class="oa-ico">${icon('bell', 20)}</span>` +
    `<b class="oa-msg">${t('有 {n} 个新订单待接单', { n })}</b>` +
    `<button class="btn btn-primary btn-sm" onclick="claimAllOrders()">${t('全部接单')}</button>` +
    `<a class="btn btn-sm" href="#/orders">${t('查看')}</a>` +
    (orderAlertState.muted ? `<span class="oa-muted">${t('已静音')}</span>`
      : `<button class="btn btn-sm oa-mute" onclick="muteOrderAlert()">${icon('x', 14)}${t('静音')}</button>`);
  if (typeof translateDOM === 'function') translateDOM(bar);
}
function startAlertLoop() {
  if (orderAlertState.timer) return;
  orderAlertState.timer = setInterval(() => {
    if (orderAlertState.muted || !unclaimedOrders().length) { stopAlertLoop(); renderAlertBar(); return; }
    playBeep('newOrder');
  }, 10000);
}
function stopAlertLoop() {
  if (orderAlertState.timer) { clearInterval(orderAlertState.timer); orderAlertState.timer = null; }
}
// 云同步检测到新到的待接单订单时调用
function notifyNewOrders(n) {
  if (DB.settings.orderAlert === false) return;
  orderAlertState.muted = false;
  playBeep('newOrder');
  startAlertLoop();
  renderAlertBar();
  if (typeof toast === 'function') toast(t('收到 {n} 个新订单，请接单', { n }), 'info');
}
function muteOrderAlert() { orderAlertState.muted = true; stopAlertLoop(); renderAlertBar(); }
function afterClaim() {
  save();
  if (!unclaimedOrders().length) { orderAlertState.muted = false; stopAlertLoop(); }
  if (typeof syncNow === 'function') syncNow();
  render(); // 会刷新列表、角标与提醒条
}
function claimOrder(id) {
  const o = DB.orders.find(x => x.id === id);
  if (o && !o.claimed) { o.claimed = true; o.claimedAt = Date.now(); touchOrder(o); afterClaim(); }
}
function claimAllOrders() {
  let any = false;
  for (const o of unclaimedOrders()) { o.claimed = true; o.claimedAt = Date.now(); touchOrder(o); any = true; }
  if (any) afterClaim();
}
window.claimOrder = claimOrder;
window.claimAllOrders = claimAllOrders;
window.muteOrderAlert = muteOrderAlert;

// 公司名称：设置里自填 > 实例注入的默认 > 内置 SUVOO；侧栏与标题栏一起改
function brandName() {
  const custom = (DB.settings && DB.settings.brand || '').trim();
  if (custom) return custom;
  if (typeof window !== 'undefined' && window.SUVOO_BRAND) return window.SUVOO_BRAND;
  return 'SUVOO';
}
function applyBrand() {
  const name = brandName();
  const b = document.querySelector('.brand-text b');
  if (b) b.textContent = name;
  const logo = document.querySelector('.brand-logo img');
  if (logo) logo.alt = name;
  document.title = name + ' 进销存 · 面单核对';
}

function render() {
  if (window._pageCleanup) {
    try { window._pageCleanup(); } catch (e) { /* ignore */ }
    window._pageCleanup = null;
  }
  const path = currentPath();
  const route = ROUTES.find(r => r.path === path);
  drawNav(path);
  const page = document.getElementById('page');
  page.innerHTML = '';
  route.render(page);
  drawBackupHint();
  // 静态文案先还原为中文源，再统一翻译（避免二次切换语言时键失配）
  const brandSub = document.querySelector('.brand-text span');
  if (brandSub) brandSub.textContent = '进销存 · 面单核对';
  applyBrand();
  renderAlertBar();
  if (typeof updateSyncUI === 'function') updateSyncUI();
  if (typeof translateDOM === 'function') translateDOM(document.querySelector('.app'));
  window.scrollTo(0, 0);
}

// 一次性迁移：本功能上线前已存在的待发订单视为「已接」，避免旧单一次性涌入待接单
if (!DB.settings.orderAlertInit) {
  let touched = false;
  DB.orders.forEach(o => { if (o.status === 'pending' && o.claimed === undefined) { o.claimed = true; touched = true; } });
  DB.settings.orderAlertInit = true;
  if (touched) save();
}

window.addEventListener('hashchange', render);
render();
initCloud();
