/* ============================================================
   SUVOO 进销存 — UI 基础组件（图标 / 弹窗 / 提示 / 商品选择器）
   ============================================================ */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- 图标（Lucide 风格内联 SVG） ---------- */
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
  orders: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  package: '<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v9"/>',
  inbound: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>',
  alert: '<path d="M21.73 18l-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
  undo: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  barcode: '<path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  adjust: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v9"/>',
  printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  pack: '<path d="m16 16 2 2 4-4"/><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><path d="M3.29 7 12 12l8.71-5"/><path d="M12 22V12"/>'
};
function icon(name, size = 18) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/* ---------- Toast ---------- */
function toast(msg, type = 'info') {
  const box = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast t-' + type;
  t.textContent = msg;
  if (typeof translateDOM === 'function') translateDOM(t);
  box.appendChild(t);
  const life = type === 'error' ? 5200 : 3200;
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .25s'; }, life - 260);
  setTimeout(() => t.remove(), life);
}

/* ---------- Modal ---------- */
function openModal({ title, body, footer = '', wide = false, onClose = null }) {
  const root = document.getElementById('modalRoot');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-h">
        <h3>${esc(title)}</h3>
        <button class="modal-x" data-close aria-label="关闭">${icon('x', 18)}</button>
      </div>
      <div class="modal-b"></div>
      ${footer ? `<div class="modal-f">${footer}</div>` : ''}
    </div>`;
  const bodyEl = overlay.querySelector('.modal-b');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else bodyEl.appendChild(body);

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-close]').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  root.appendChild(overlay);
  if (typeof translateDOM === 'function') translateDOM(overlay);
  const first = overlay.querySelector('input, select, textarea, button:not(.modal-x)');
  if (first) setTimeout(() => first.focus(), 30);
  return { overlay, body: bodyEl, close };
}

function confirmBox(msg, { danger = false, okText = '确定' } = {}) {
  return new Promise(resolve => {
    const m = openModal({
      title: danger ? '请确认操作' : '确认',
      body: `<div style="font-size:14px;line-height:1.7">${msg}</div>`,
      footer: `
        <button class="btn" data-no>取消</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okText)}</button>`,
      onClose: () => resolve(false)
    });
    m.overlay.querySelector('[data-no]').addEventListener('click', () => { resolve(false); m.close(); });
    m.overlay.querySelector('[data-ok]').addEventListener('click', () => { resolve(true); m.close(); });
  });
}

/* ---------- 徽章 ---------- */
function statusBadge(o) {
  if (o.status === 'verified') return `<span class="badge b-green">${icon('check', 12)}已核对</span>`;
  if (o.packing && typeof packTotals === 'function') {
    const t = packTotals(o);
    return `<span class="badge b-blue">${icon('pack', 12)}打包中 ${t.done}/${t.total}</span>`;
  }
  return `<span class="badge b-amber">待核对</span>`;
}
const CHAN_COLORS = ['#059669', '#2563EB', '#D97706', '#DB2777', '#7C3AED', '#0891B2', '#65A30D', '#DC2626'];
function chanColor(name) {
  let h = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return CHAN_COLORS[h % CHAN_COLORS.length];
}
function channelBadge(name) {
  if (!name) return '<span class="badge b-gray">—</span>';
  return `<span class="badge b-gray"><span class="dot" style="background:${chanColor(name)}"></span>${esc(name)}</span>`;
}

/* ---------- 商品选择器（组合框） ---------- */
// 在文本输入框上挂建议下拉；选中后回调 onPick(product)，清除选择回调 onPick(null)
function attachProductPicker(input, onPick) {
  const wrap = input.closest('.picker-wrap') || input.parentElement;
  let list = null, hlIdx = -1, items = [];

  function closeList() { if (list) { list.remove(); list = null; hlIdx = -1; } }
  function render() {
    closeList();
    items = searchProducts(input.value, 8);
    list = document.createElement('div');
    list.className = 'picker-list';
    if (!items.length) {
      list.innerHTML = '<div class="picker-empty">没有匹配的商品</div>';
    } else {
      list.innerHTML = items.map((p, i) => `
        <div class="picker-item" data-i="${i}">
          <span class="p-sku">${esc(p.sku)}</span>
          <span class="p-name">${esc(p.name)}${p.spec ? ' <span class="muted">' + esc(p.spec) + '</span>' : ''}</span>
          <span class="p-stock">库存 ${Number(p.stock)}</span>
        </div>`).join('');
      list.querySelectorAll('.picker-item').forEach(el => {
        el.addEventListener('mousedown', e => {
          e.preventDefault();
          pick(items[Number(el.dataset.i)]);
        });
      });
    }
    wrap.appendChild(list);
  }
  function pick(p) {
    input.value = `${p.sku}｜${p.name}`;
    input.dataset.pickedSku = p.sku;
    closeList();
    onPick(p);
  }
  input.addEventListener('input', () => {
    delete input.dataset.pickedSku;
    onPick(null);
    render();
  });
  input.addEventListener('focus', render);
  input.addEventListener('blur', () => setTimeout(closeList, 120));
  input.addEventListener('keydown', e => {
    if (!list) return;
    const n = items.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!n) return;
      hlIdx = (hlIdx + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
      list.querySelectorAll('.picker-item').forEach((el, i) => el.classList.toggle('hl', i === hlIdx));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (hlIdx >= 0 && items[hlIdx]) { pick(items[hlIdx]); return; }
      // 扫码枪回车：SKU / 条码精确匹配直接选中
      const p = productByCode(input.value);
      if (p) pick(p);
      else if (items.length === 1) pick(items[0]);
    } else if (e.key === 'Escape') closeList();
  });
}

/* ---------- Excel 导出（SheetJS 按需加载） ---------- */
let _xlsxLoading = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve();
  if (_xlsxLoading) return _xlsxLoading;
  _xlsxLoading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = res;
    s.onerror = () => { _xlsxLoading = null; rej(new Error('Excel 组件加载失败')); };
    document.head.appendChild(s);
  });
  return _xlsxLoading;
}
// sheets: [{name, rows:[[...],...]}] → 下载 .xlsx；组件加载失败时退回 CSV
async function exportXLSX(filename, sheets) {
  try {
    await loadXLSX();
    const wb = XLSX.utils.book_new();
    for (const sh of sheets) {
      const ws = XLSX.utils.aoa_to_sheet(sh.rows);
      ws['!cols'] = (sh.rows[0] || []).map((_, i) => ({
        wch: Math.min(42, Math.max(9, ...sh.rows.slice(0, 60).map(r => String(r[i] ?? '').length * 1.8)))
      }));
      XLSX.utils.book_append_sheet(wb, ws, sh.name);
    }
    XLSX.writeFile(wb, filename);
    toast(`已导出 ${filename}`, 'success');
  } catch (e) {
    console.error(e);
    for (const sh of sheets) {
      downloadFile(filename.replace(/\.xlsx$/, '') + '_' + sh.name + '.csv', toCSV(sh.rows));
    }
    toast('Excel 组件加载失败（离线？），已改为导出 CSV', 'warn');
  }
}

/* ---------- 扫码枪自动确认（无需回车/Invio） ----------
   扫描枪逐字输入极快（<40ms/字符），人工打字远慢于此。
   检测到高速输入且停顿 300ms 即视为一次完整扫码，自动触发。
   粘贴单号（单事件整串进入）同样自动触发。手动打字不受影响。 */
function attachAutoScan(input, fire) {
  let firstTs = 0, timer = null, composing = false;
  // 输入法（IME）组字期间不做任何自动判定——扫码工位请使用英文输入法，
  // 否则拼音候选会把扫入的数字当成选词指令吃掉（如 UHA 后的 1）
  input.addEventListener('compositionstart', () => { composing = true; clearTimeout(timer); });
  input.addEventListener('compositionend', () => { composing = false; });
  input.addEventListener('input', () => {
    const v = input.value.trim();
    clearTimeout(timer);
    if (!v) { firstTs = 0; return; }
    const now = Date.now();
    if (!firstTs) firstTs = now;
    // 打字速度只看输入事件本身的间隔（与定时器何时触发无关，防主线程繁忙误判）
    const perChar = (now - firstTs) / v.length;
    if (composing) return;
    timer = setTimeout(() => {
      // 回车已处理（元素被重渲染移除）或内容已变 → 不再触发，避免一次扫码处理两遍
      if (!document.contains(input)) return;
      const cur = input.value.trim();
      if (cur !== v || cur.length < 5) return;
      if (perChar < 40) { firstTs = 0; fire(cur); }
    }, 500);
  });
  // 扫描枪带回车后缀 / 手动回车：立即处理的同时取消挂起的自动确认，防止双触发；
  // 输入法确认组字的回车（isComposing）不算提交
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) { firstTs = 0; clearTimeout(timer); }
  });
}

/* ---------- 空状态 ---------- */
function emptyHTML(text, actionsHTML = '') {
  return `<div class="empty">${icon('box', 40)}<p>${esc(text)}</p>${actionsHTML}</div>`;
}
