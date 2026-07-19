/* ============================================================
   SUVOO 进销存 — 数据层（localStorage 持久化）
   ============================================================ */
const DB_KEY = 'suvoo_ims_v1';
const MOVES_CAP = 8000; // 流水最多保留条数，超出自动裁剪最旧记录

function defaultDB() {
  return {
    version: 1,
    products: [],   // {id, sku, barcode, name, spec, stock, safeStock, cost, note, createdAt}
    orders: [],     // {id, channel, orderNo, trackingNo, carrier, receiver, note,
                    //  items:[{sku,name,qty}], status:'pending'|'verified', createdAt, verifiedAt}
    moves: [],      // {id, at, type:'in'|'out'|'adjust', sku, name, qty(signed), reason, ref, note}
    channels: ['淘宝', '拼多多', '抖音', '微信', 'Shopify', '其他'],
    settings: { beep: true, deduct: true, packSingleFast: true, packVerifyItems: true, printAgent: false, printAgentUrl: 'http://127.0.0.1:17777', lastBackup: null }
  };
}

let DB = loadDB();

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return defaultDB();
    const d = JSON.parse(raw);
    const base = defaultDB();
    return {
      ...base, ...d,
      channels: Array.isArray(d.channels) && d.channels.length ? d.channels : base.channels,
      settings: { ...base.settings, ...(d.settings || {}) }
    };
  } catch (e) {
    console.error('读取数据失败', e);
    return defaultDB();
  }
}

function save() {
  // 超出上限时把最旧流水按 SKU 结转为汇总记录（保证库存始终可由流水推导）
  if (DB.moves.length > MOVES_CAP) {
    const keep = DB.moves.slice(0, MOVES_CAP - 200);
    const drop = DB.moves.slice(MOVES_CAP - 200);
    const agg = new Map();
    for (const mv of drop) {
      const k = mv.sku;
      const cur = agg.get(k) || { qty: 0, name: mv.name };
      cur.qty += Number(mv.qty) || 0;
      agg.set(k, cur);
    }
    const rolled = [...agg.entries()].filter(([, v]) => v.qty !== 0).map(([sku, v]) => ({
      id: uid(), at: drop[0].at, type: 'adjust', sku, name: v.name,
      qty: v.qty, reason: '历史流水结转', ref: '', note: ''
    }));
    DB.moves = keep.concat(rolled);
  }
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(DB));
  } catch (e) {
    console.error(e);
    if (typeof toast === 'function') toast('保存失败：浏览器存储空间不足，请先导出备份并清理旧数据', 'error');
  }
  if (typeof scheduleSync === 'function') scheduleSync();
}

function uid() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/* ---------- 商品 ---------- */
function normCode(s) { return String(s ?? '').trim().toLowerCase(); }

function productBySku(sku) {
  const s = normCode(sku);
  if (!s) return null;
  return DB.products.find(p => normCode(p.sku) === s) || null;
}
// 按 SKU 或条码找商品
function productByCode(code) {
  const s = normCode(code);
  if (!s) return null;
  return DB.products.find(p => normCode(p.sku) === s || normCode(p.barcode) === s) || null;
}
function searchProducts(q, limit = 8) {
  const s = normCode(q);
  if (!s) return DB.products.slice(0, limit);
  const hit = [];
  for (const p of DB.products) {
    if (normCode(p.sku).includes(s) || normCode(p.barcode).includes(s) ||
        normCode(p.name).includes(s) || normCode(p.spec).includes(s)) {
      hit.push(p);
      if (hit.length >= limit) break;
    }
  }
  return hit;
}
function isLowStock(p) {
  return Number(p.safeStock) > 0 && Number(p.stock) <= Number(p.safeStock);
}

/* ---------- 库存变动 ---------- */
function addStockMove(product, delta, type, reason, ref = '', note = '') {
  delta = Number(delta) || 0;
  if (!product || delta === 0) return;
  product.stock = Math.round((Number(product.stock) + delta) * 1000) / 1000;
  DB.moves.unshift({
    id: uid(), at: Date.now(), type,
    sku: product.sku, name: product.name,
    qty: delta, reason, ref, note
  });
}

/* ---------- 订单 ---------- */
function orderByCode(code) {
  const s = normCode(code);
  if (!s) return null;
  return DB.orders.find(o => normCode(o.trackingNo) === s)
      || DB.orders.find(o => normCode(o.orderNo) === s)
      || null;
}
function trackingExists(trackingNo) {
  const s = normCode(trackingNo);
  if (!s) return false;
  return DB.orders.some(o => normCode(o.trackingNo) === s);
}

// 核对出库：标记已核对，按设置扣减库存
function verifyOrder(o) {
  if (!o || o.status === 'verified') return false;
  o.status = 'verified';
  o.verifiedAt = Date.now();
  delete o.packing; // 打包进度随出库清除
  if (DB.settings.deduct) {
    for (const it of (o.items || [])) {
      const p = productByCode(it.sku);
      const q = Number(it.qty) || 0;
      if (p && q > 0) addStockMove(p, -q, 'out', '订单核对出库', o.trackingNo || o.orderNo || '');
    }
  }
  save();
  return true;
}

// 撤销核对：回补库存
function unverifyOrder(o) {
  if (!o || o.status !== 'verified') return false;
  o.status = 'pending';
  o.verifiedAt = null;
  if (DB.settings.deduct) {
    for (const it of (o.items || [])) {
      const p = productByCode(it.sku);
      const q = Number(it.qty) || 0;
      if (p && q > 0) addStockMove(p, q, 'adjust', '撤销核对回补', o.trackingNo || o.orderNo || '');
    }
  }
  save();
  return true;
}

/* ---------- 打包进度（存于订单 packing 字段，随订单行级同步上云） ---------- */
function packKey(it) { return normCode(it.sku || it.name); }
// 应装清单：按 SKU 聚合订单明细 → [{key, sku, name, qty}]
function packRequired(o) {
  const map = new Map();
  for (const it of (o.items || [])) {
    const k = packKey(it);
    if (!k) continue;
    const cur = map.get(k) || { key: k, sku: it.sku || '', name: it.name || it.sku || '', qty: 0 };
    cur.qty += Number(it.qty) || 0;
    map.set(k, cur);
  }
  return [...map.values()];
}
function packedCount(o, key) {
  return (o.packing && o.packing.packed && o.packing.packed[key]) || 0;
}
function packTotals(o) {
  let total = 0, done = 0;
  for (const l of packRequired(o)) {
    total += l.qty;
    done += Math.min(packedCount(o, l.key), l.qty);
  }
  return { total, done };
}
function packIsComplete(o) {
  const req = packRequired(o);
  return req.length > 0 && req.every(l => packedCount(o, l.key) >= l.qty);
}

function orderItemsSummary(o) {
  const items = o.items || [];
  if (!items.length) return '—';
  return items.map(i => `${i.name || i.sku || '?'}×${i.qty}`).join('，');
}
function orderPieces(o) {
  return (o.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
}

/* ---------- 日期 ---------- */
function pad2(n) { return String(n).padStart(2, '0'); }
function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function fmtDT(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function fmtFull(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${dayKey(ts)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
function isToday(ts) { return ts && dayKey(ts) === dayKey(Date.now()); }

/* ---------- CSV / 表格文本解析 ---------- */
function detectDelim(line) {
  if (line.includes('\t')) return '\t';
  const sc = (line.match(/;/g) || []).length;
  const cc = (line.match(/,/g) || []).length;
  return sc > cc ? ';' : ',';
}
// 解析 CSV / TSV（支持引号包裹字段），返回二维数组
function parseTable(text) {
  text = String(text || '').replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const firstLine = text.split('\n').find(l => l.trim()) || '';
  const delim = detectDelim(firstLine);
  const rows = [];
  let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === delim) {
      row.push(cell); cell = '';
    } else if (ch === '\n') {
      row.push(cell); cell = '';
      if (row.some(c => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim() !== '')) rows.push(row);
  return rows;
}
function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCSV(rows) {
  return '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\n');
}
function downloadFile(name, content, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------- 备份 ---------- */
function exportBackup() {
  DB.settings.lastBackup = Date.now();
  save();
  downloadFile(`SUVOO备份_${dayKey(Date.now())}.json`, JSON.stringify(DB, null, 1), 'application/json');
}
function importBackup(text) {
  const d = JSON.parse(text);
  if (!d || !Array.isArray(d.products) || !Array.isArray(d.orders)) {
    throw new Error('文件格式不正确，不是 SUVOO 备份文件');
  }
  const base = defaultDB();
  DB = {
    ...base, ...d,
    channels: Array.isArray(d.channels) && d.channels.length ? d.channels : base.channels,
    settings: { ...base.settings, ...(d.settings || {}) }
  };
  save();
}

/* ---------- 示例数据 ---------- */
function loadDemoData() {
  const now = Date.now();
  const P = (sku, barcode, name, spec, stock, safeStock, cost) =>
    ({ id: uid(), sku, barcode, name, spec, stock, safeStock, cost, note: '', createdAt: now });
  DB.products = [
    P('BX-001', '8054321000011', '密封保鲜盒三件套', '透明/大中小', 120, 20, 2.10),
    P('LJ-030', '8054321000028', '加厚垃圾袋', '50L×30只', 260, 50, 0.85),
    P('YJ-010', '8054321000035', '防滑衣架', '10支装/白', 75, 30, 1.20),
    P('SN-055', '8054321000042', '折叠收纳箱', '55L 灰色', 18, 20, 3.60),
    P('TX-201', '8054321000059', '居家棉拖鞋', '38-39 米色', 42, 10, 1.75),
    P('YS-008', '8054321000066', '自动折叠雨伞', '黑色 八骨', 66, 15, 2.90)
  ];
  const O = (channel, orderNo, trackingNo, items, receiver, hoursAgo, verified) => ({
    id: uid(), channel, orderNo, trackingNo, carrier: '', receiver, note: '',
    items, status: verified ? 'verified' : 'pending',
    createdAt: now - hoursAgo * 3600e3,
    verifiedAt: verified ? now - (hoursAgo - 1) * 3600e3 : null
  });
  DB.orders = [
    O('淘宝', 'TB2607110001', 'SF1390227765123', [{ sku: 'BX-001', name: '密封保鲜盒三件套', qty: 2 }], '王女士', 5, false),
    O('淘宝', 'TB2607110002', 'SF1390227765124', [{ sku: 'LJ-030', name: '加厚垃圾袋', qty: 3 }, { sku: 'YJ-010', name: '防滑衣架', qty: 1 }], '李先生', 5, false),
    O('拼多多', 'PDD88420011', 'YT7566001122334', [{ sku: 'SN-055', name: '折叠收纳箱', qty: 1 }], '陈女士', 4, false),
    O('拼多多', 'PDD88420012', 'YT7566001122335', [{ sku: 'TX-201', name: '居家棉拖鞋', qty: 2 }], '刘先生', 4, false),
    O('抖音', 'DY99001123', 'ZT0099887766554', [{ sku: 'YS-008', name: '自动折叠雨伞', qty: 1 }, { sku: 'BX-001', name: '密封保鲜盒三件套', qty: 1 }], '赵女士', 3, false),
    O('微信', 'WX20260711A', 'SF1390227765130', [{ sku: 'LJ-030', name: '加厚垃圾袋', qty: 10 }], '批发-周老板', 2, false),
    O('淘宝', 'TB2607100009', 'SF1390227765001', [{ sku: 'BX-001', name: '密封保鲜盒三件套', qty: 1 }], '孙女士', 26, true),
    O('抖音', 'DY99001100', 'ZT0099887766001', [{ sku: 'TX-201', name: '居家棉拖鞋', qty: 1 }], '吴先生', 27, true)
  ];
  // 演示：按运单前缀分配物流公司（分拣台演示用）
  for (const o of DB.orders) {
    o.carrier = o.trackingNo.startsWith('SF') ? 'GLS' : o.trackingNo.startsWith('YT') ? 'BRT' : 'SDA';
  }
  DB.moves = [
    { id: uid(), at: now - 26 * 3600e3, type: 'out', sku: 'BX-001', name: '密封保鲜盒三件套', qty: -1, reason: '订单核对出库', ref: 'SF1390227765001', note: '' },
    { id: uid(), at: now - 27 * 3600e3, type: 'out', sku: 'TX-201', name: '居家棉拖鞋', qty: -1, reason: '订单核对出库', ref: 'ZT0099887766001', note: '' },
    { id: uid(), at: now - 48 * 3600e3, type: 'in', sku: 'BX-001', name: '密封保鲜盒三件套', qty: 60, reason: '采购入库', ref: '', note: '' },
    { id: uid(), at: now - 48 * 3600e3, type: 'in', sku: 'LJ-030', name: '加厚垃圾袋', qty: 100, reason: '采购入库', ref: '', note: '' }
  ];
  save();
}
