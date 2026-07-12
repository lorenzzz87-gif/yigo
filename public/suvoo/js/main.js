/* ============================================================
   SUVOO 进销存 — 路由与启动
   ============================================================ */
const ROUTES = [
  { path: 'dashboard', label: '概览', icon: 'dashboard', render: renderDashboard },
  { path: 'scan', label: '扫描核对', icon: 'scan', render: renderScan },
  { path: 'pack', label: '扫码打包', icon: 'pack', render: renderPack },
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
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
render();
initCloud();
