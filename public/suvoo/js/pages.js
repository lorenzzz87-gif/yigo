/* ============================================================
   SUVOO 进销存 — 功能页面
   ============================================================ */

function pageHead(title, sub, actionsHTML = '') {
  return `<div class="page-head">
    <div><h1>${esc(title)}</h1>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>
    ${actionsHTML ? `<div class="page-actions">${actionsHTML}</div>` : ''}
  </div>`;
}

/* ============================================================
   概览
   ============================================================ */
function renderDashboard(el) {
  const pending = DB.orders.filter(o => o.status === 'pending');
  const todayVerified = DB.orders.filter(o => o.status === 'verified' && isToday(o.verifiedAt));
  const lowStock = DB.products.filter(isLowStock);

  if (!DB.products.length && !DB.orders.length) {
    el.innerHTML = pageHead('概览', '欢迎使用 SUVOO 进销存 · 面单核对') + `
      <div class="card"><div class="empty">
        ${icon('box', 44)}
        <p style="max-width:460px;margin:0 auto 6px">轻量级进销存 + 电商面单出库核对工具。<br>
        导入各渠道订单 → 扫描面单运单号 → 自动核对并扣减库存。<br>数据保存在本机浏览器，无需注册。</p>
        <div class="mt-14">
          <button class="btn btn-accent" data-demo>${icon('download', 15)}载入示例数据体验</button>
          <button class="btn" data-goto="#/products">${icon('plus', 15)}新增商品</button>
          <button class="btn" data-goto="#/orders">${icon('upload', 15)}导入订单</button>
        </div>
      </div></div>`;
    el.querySelector('[data-demo]').addEventListener('click', () => {
      loadDemoData();
      toast('已载入示例数据，去「扫描核对」页试试扫单吧', 'success');
      render();
    });
    el.querySelectorAll('[data-goto]').forEach(b =>
      b.addEventListener('click', () => location.hash = b.dataset.goto));
    return;
  }

  const chanMap = new Map();
  for (const o of pending) {
    const c = o.channel || '未分渠道';
    const v = chanMap.get(c) || { n: 0, pcs: 0 };
    v.n++; v.pcs += orderPieces(o);
    chanMap.set(c, v);
  }

  el.innerHTML = pageHead('概览', '今天是 ' + dayKey(Date.now()),
    `<button class="btn btn-accent" onclick="location.hash='#/scan'">${icon('scan', 16)}去扫描核对</button>`) + `
    <div class="grid grid-stats">
      <div class="stat" onclick="location.hash='#/orders'">
        <div class="stat-ico amber">${icon('orders', 21)}</div>
        <div><div class="stat-num">${pending.length}</div><div class="stat-lbl">待核对订单</div></div>
      </div>
      <div class="stat" onclick="location.hash='#/scan'">
        <div class="stat-ico green">${icon('check', 21)}</div>
        <div><div class="stat-num">${todayVerified.length}</div><div class="stat-lbl">今日已核对</div></div>
      </div>
      <div class="stat" onclick="location.hash='#/products'">
        <div class="stat-ico red">${icon('alert', 21)}</div>
        <div><div class="stat-num">${lowStock.length}</div><div class="stat-lbl">库存预警商品</div></div>
      </div>
      <div class="stat" onclick="location.hash='#/products'">
        <div class="stat-ico blue">${icon('package', 21)}</div>
        <div><div class="stat-num">${DB.products.length}</div><div class="stat-lbl">在库商品种类</div></div>
      </div>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">${icon('orders', 16)}各渠道待发货</div>
        ${chanMap.size ? `<div class="tbl-wrap"><table class="tbl"><thead>
          <tr><th>渠道</th><th class="num">订单数</th><th class="num">件数</th></tr></thead><tbody>
          ${[...chanMap.entries()].sort((a, b) => b[1].n - a[1].n).map(([c, v]) =>
            `<tr><td>${channelBadge(c)}</td><td class="num">${v.n}</td><td class="num">${v.pcs}</td></tr>`).join('')}
        </tbody></table></div>` : `<p class="muted small">当前没有待核对的订单 ✓</p>`}
      </div>
      <div class="card">
        <div class="card-title">${icon('alert', 16)}库存预警<span class="spacer"></span>
          <button class="btn btn-sm btn-ghost" onclick="location.hash='#/products'">查看全部</button></div>
        ${lowStock.length ? `<div class="tbl-wrap"><table class="tbl"><thead>
          <tr><th>SKU</th><th>名称</th><th class="num">库存</th><th class="num">安全线</th></tr></thead><tbody>
          ${lowStock.slice(0, 8).map(p => `<tr>
            <td class="mono">${esc(p.sku)}</td><td class="ellip">${esc(p.name)}</td>
            <td class="num neg">${Number(p.stock)}</td><td class="num muted">${Number(p.safeStock)}</td></tr>`).join('')}
        </tbody></table></div>` : `<p class="muted small">库存充足，暂无预警商品</p>`}
      </div>
    </div>
    <div class="card mt-14">
      <div class="card-title">${icon('history', 16)}最近动态<span class="spacer"></span>
        <button class="btn btn-sm btn-ghost" onclick="location.hash='#/records'">全部流水</button></div>
      ${DB.moves.length ? `<div class="tbl-wrap"><table class="tbl"><thead>
        <tr><th>时间</th><th>类型</th><th>商品</th><th class="num">数量</th><th>事由</th><th>关联单号</th></tr></thead><tbody>
        ${DB.moves.slice(0, 8).map(mv => `<tr>
          <td class="muted small">${fmtDT(mv.at)}</td><td>${moveTypeBadge(mv.type)}</td>
          <td class="ellip">${esc(mv.name)} <span class="mono muted">${esc(mv.sku)}</span></td>
          <td class="num ${mv.qty > 0 ? 'pos' : 'neg'}">${mv.qty > 0 ? '+' : ''}${mv.qty}</td>
          <td class="dim small">${esc(mv.reason)}</td><td class="mono muted small">${esc(mv.ref || '')}</td></tr>`).join('')}
      </tbody></table></div>` : `<p class="muted small">暂无出入库记录</p>`}
    </div>`;
}

function moveTypeBadge(t) {
  if (t === 'in') return '<span class="badge b-green">入库</span>';
  if (t === 'out') return '<span class="badge b-blue">出库</span>';
  return '<span class="badge b-gray">调整</span>';
}

/* ============================================================
   商品库存
   ============================================================ */
const prodState = { q: '', lowOnly: false };

function renderProducts(el) {
  const q = normCode(prodState.q);
  let list = DB.products.filter(p =>
    !q || normCode(p.sku).includes(q) || normCode(p.barcode).includes(q) ||
    normCode(p.name).includes(q) || normCode(p.spec).includes(q));
  if (prodState.lowOnly) list = list.filter(isLowStock);

  el.innerHTML = pageHead('商品库存', `共 ${DB.products.length} 个商品，${DB.products.filter(isLowStock).length} 个低于安全库存`,
    `<button class="btn" data-imp>${icon('upload', 15)}导入商品</button>
     <button class="btn" data-exp>${icon('download', 15)}导出 CSV</button>
     <button class="btn btn-primary" data-add>${icon('plus', 15)}新增商品</button>`) + `
    <div class="toolbar">
      <input class="input" style="width:260px" placeholder="搜索 SKU / 条码 / 名称 / 规格" data-q value="${esc(prodState.q)}">
      <label class="checkbox-line"><input type="checkbox" data-low ${prodState.lowOnly ? 'checked' : ''}>仅看库存预警</label>
    </div>
    ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th>SKU</th><th>条码</th><th>名称</th><th>规格</th><th class="num">成本</th>
      <th class="num">库存</th><th class="num">安全库存</th><th style="text-align:right">操作</th>
    </tr></thead><tbody>
    ${list.map(p => `<tr class="${isLowStock(p) ? 'low-row' : ''}" data-id="${p.id}">
      <td class="mono">${esc(p.sku)}</td>
      <td class="mono muted">${esc(p.barcode || '')}</td>
      <td class="ellip">${esc(p.name)}${p.note ? ` <span class="muted small" title="${esc(p.note)}">ⓘ</span>` : ''}</td>
      <td class="dim">${esc(p.spec || '')}</td>
      <td class="num muted">${p.cost !== '' && p.cost != null ? Number(p.cost).toFixed(2) : ''}</td>
      <td class="num" style="font-weight:600${isLowStock(p) ? ';color:var(--danger)' : ''}">${Number(p.stock)}</td>
      <td class="num muted">${Number(p.safeStock) || ''}</td>
      <td><div class="row-actions">
        <button class="btn btn-sm" data-act="adjust" title="调整库存">${icon('adjust', 13)}调整</button>
        <button class="btn btn-sm btn-ghost" data-act="edit" title="编辑">${icon('edit', 13)}</button>
        <button class="btn btn-sm btn-ghost" data-act="del" title="删除">${icon('trash', 13)}</button>
      </div></td></tr>`).join('')}
    </tbody></table></div>`
    : `<div class="card">${emptyHTML(prodState.q || prodState.lowOnly ? '没有符合条件的商品' : '还没有商品，点击右上角「新增商品」或「导入商品」开始')}</div>`}`;

  el.querySelector('[data-q]').addEventListener('input', e => { prodState.q = e.target.value; render(); refocus(el, '[data-q]'); });
  el.querySelector('[data-low]').addEventListener('change', e => { prodState.lowOnly = e.target.checked; render(); });
  el.querySelector('[data-add]').addEventListener('click', () => openProductModal());
  el.querySelector('[data-exp]').addEventListener('click', exportProductsCSV);
  el.querySelector('[data-imp]').addEventListener('click', openProductImport);

  el.querySelectorAll('tbody tr').forEach(tr => {
    tr.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', async () => {
      const p = DB.products.find(x => x.id === tr.dataset.id);
      if (!p) return;
      if (btn.dataset.act === 'edit') openProductModal(p);
      else if (btn.dataset.act === 'adjust') openAdjustModal(p);
      else if (btn.dataset.act === 'del') {
        const ok = await confirmBox(`确定删除商品 <b>${esc(p.name)}</b>（${esc(p.sku)}）？<br><span class="muted small">历史流水会保留，此操作不可撤销。</span>`, { danger: true, okText: '删除' });
        if (ok) { DB.products = DB.products.filter(x => x.id !== p.id); save(); toast('已删除商品'); render(); }
      }
    }));
  });
}

// 搜索框重渲染后恢复焦点和光标
function refocus(el, sel) {
  const i = el.querySelector(sel);
  if (i) { const v = i.value; i.focus(); i.setSelectionRange(v.length, v.length); }
}

function openProductModal(p = null) {
  const isEdit = !!p;
  const m = openModal({
    title: isEdit ? '编辑商品' : '新增商品',
    body: `
      <div class="form-row">
        <div class="field"><label>SKU 编码<span class="req">*</span></label>
          <input class="input mono" data-f="sku" value="${esc(p?.sku || '')}" ${isEdit ? 'disabled' : ''} placeholder="如 BX-001"></div>
        <div class="field"><label>条码（扫码入库用）</label>
          <input class="input mono" data-f="barcode" value="${esc(p?.barcode || '')}" placeholder="EAN/UPC 条形码"></div>
      </div>
      <div class="field"><label>商品名称<span class="req">*</span></label>
        <input class="input" data-f="name" value="${esc(p?.name || '')}"></div>
      <div class="form-row">
        <div class="field"><label>规格 / 型号</label>
          <input class="input" data-f="spec" value="${esc(p?.spec || '')}" placeholder="颜色 / 尺寸 / 包装"></div>
        <div class="field"><label>成本价</label>
          <input class="input" type="number" step="0.01" min="0" data-f="cost" value="${esc(p?.cost ?? '')}"></div>
      </div>
      <div class="form-row">
        ${isEdit
          ? `<div class="field"><label>当前库存</label>
              <input class="input" value="${Number(p.stock)}" disabled>
              <span class="field-hint">库存请通过「调整」或「入库」变更，保证流水可追溯</span></div>`
          : `<div class="field"><label>期初库存</label>
              <input class="input" type="number" step="1" data-f="stock" value="0"></div>`}
        <div class="field"><label>安全库存（低于此数预警）</label>
          <input class="input" type="number" step="1" min="0" data-f="safeStock" value="${esc(p?.safeStock ?? '')}" placeholder="0 = 不预警"></div>
      </div>
      <div class="field"><label>备注</label><input class="input" data-f="note" value="${esc(p?.note || '')}"></div>`,
    footer: `<button class="btn" data-cancel>取消</button>
             <button class="btn btn-primary" data-save>${icon('save', 15)}保存</button>`
  });
  const get = f => m.body.querySelector(`[data-f="${f}"]`)?.value.trim() ?? '';
  m.overlay.querySelector('[data-cancel]').addEventListener('click', m.close);
  m.overlay.querySelector('[data-save]').addEventListener('click', () => {
    const sku = isEdit ? p.sku : get('sku');
    const name = get('name');
    if (!sku) return toast('请填写 SKU 编码', 'warn');
    if (!name) return toast('请填写商品名称', 'warn');
    if (!isEdit && productBySku(sku)) return toast('该 SKU 已存在', 'error');
    const data = {
      barcode: get('barcode'), name, spec: get('spec'),
      cost: get('cost') === '' ? '' : Number(get('cost')),
      safeStock: Number(get('safeStock')) || 0,
      note: get('note')
    };
    if (isEdit) Object.assign(p, data);
    else DB.products.push({ id: uid(), sku, stock: Number(get('stock')) || 0, createdAt: Date.now(), ...data });
    save(); m.close();
    toast(isEdit ? '商品已更新' : '商品已添加', 'success');
    render();
  });
}

function openAdjustModal(p) {
  const m = openModal({
    title: '调整库存',
    body: `
      <p class="mb-14"><b>${esc(p.name)}</b> <span class="mono muted">${esc(p.sku)}</span>
        <span class="badge b-gray" style="margin-left:8px">当前库存 ${Number(p.stock)}</span></p>
      <div class="form-row">
        <div class="field"><label>变动数量（正数增加 / 负数减少）</label>
          <input class="input" type="number" step="1" data-delta placeholder="如 10 或 -3"></div>
        <div class="field"><label>事由</label>
          <select class="select" data-reason>
            <option>采购入库</option><option>退货入库</option><option>盘盈</option>
            <option>盘亏</option><option>损耗报废</option><option>样品赠送</option><option>手动修正</option>
          </select></div>
      </div>
      <div class="field"><label>备注</label><input class="input" data-note></div>`,
    footer: `<button class="btn" data-cancel>取消</button>
             <button class="btn btn-primary" data-save>确认调整</button>`
  });
  m.overlay.querySelector('[data-cancel]').addEventListener('click', m.close);
  m.overlay.querySelector('[data-save]').addEventListener('click', () => {
    const delta = Number(m.body.querySelector('[data-delta]').value);
    if (!delta) return toast('请填写非 0 的变动数量', 'warn');
    const reason = m.body.querySelector('[data-reason]').value;
    const type = delta > 0 && reason.includes('入库') ? 'in' : 'adjust';
    addStockMove(p, delta, type, reason, '', m.body.querySelector('[data-note]').value.trim());
    save(); m.close();
    toast(`${esc(p.name)} 库存 ${delta > 0 ? '+' : ''}${delta} → ${Number(p.stock)}`, 'success');
    render();
  });
}

function exportProductsCSV() {
  const rows = [['SKU', '条码', '名称', '规格', '库存', '安全库存', '成本', '备注'],
    ...DB.products.map(p => [p.sku, p.barcode, p.name, p.spec, p.stock, p.safeStock, p.cost, p.note])];
  downloadFile(`商品库存_${dayKey(Date.now())}.csv`, toCSV(rows));
  toast('已导出商品 CSV', 'success');
}

/* ============================================================
   通用导入向导（订单 / 商品 共用）
   ============================================================ */
function guessField(header, guessList) {
  const h = normCode(header);
  if (!h) return 'ignore';
  for (const [key, kws] of guessList) {
    if (kws.some(k => h.includes(k))) return key;
  }
  return 'ignore';
}

function openImportWizard({ title, fields, guessList, templateRows, templateName, extraHTML = '', buildAndImport }) {
  const wiz = { rows: [], mapping: [], hasHeader: true };
  const m = openModal({
    title, wide: true,
    body: `
      <div class="field"><label>粘贴表格内容（从 Excel / 平台导出表直接复制粘贴，支持逗号或制表符分隔）</label>
        <textarea class="textarea" data-paste rows="6" placeholder="渠道,订单号,运单号,SKU,商品名,数量&#10;淘宝,TB001,SF12345678,BX-001,保鲜盒,2"></textarea></div>
      <div class="flex mb-14" style="flex-wrap:wrap">
        <button class="btn" data-file-btn>${icon('upload', 15)}选择 CSV 文件</button>
        <input type="file" accept=".csv,.tsv,.txt" hidden data-file>
        <button class="btn btn-ghost" data-tpl>${icon('download', 15)}下载模板</button>
        <span class="grow"></span>
        <button class="btn btn-primary" data-parse>${icon('search', 15)}解析预览</button>
      </div>
      ${extraHTML}
      <div data-map></div>`,
    footer: `<span class="small muted" data-info style="margin-right:auto"></span>
      <button class="btn" data-cancel>取消</button>
      <button class="btn btn-accent" data-import disabled>${icon('check', 15)}确认导入</button>`
  });
  const $ = s => m.overlay.querySelector(s);

  $('[data-cancel]').addEventListener('click', m.close);
  $('[data-file-btn]').addEventListener('click', () => $('[data-file]').click());
  $('[data-file]').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { $('[data-paste]').value = rd.result; parse(); };
    rd.readAsText(f, 'utf-8');
  });
  $('[data-tpl]').addEventListener('click', () => downloadFile(templateName, toCSV(templateRows)));
  $('[data-parse]').addEventListener('click', parse);

  function parse() {
    wiz.rows = parseTable($('[data-paste]').value);
    if (!wiz.rows.length) return toast('没有解析到内容，请先粘贴表格或选择文件', 'warn');
    const guessed = wiz.rows[0].map(h => guessField(h, guessList));
    wiz.hasHeader = guessed.some(g => g !== 'ignore');
    wiz.mapping = wiz.hasHeader ? guessed : wiz.rows[0].map(() => 'ignore');
    drawMap();
    $('[data-import]').disabled = false;
  }

  function drawMap() {
    const cols = Math.max(...wiz.rows.slice(0, 6).map(r => r.length));
    const opts = f => `<option value="ignore">— 忽略 —</option>` +
      fields.map(x => `<option value="${x.key}" ${f === x.key ? 'selected' : ''}>${x.label}</option>`).join('');
    $('[data-map]').innerHTML = `
      <label class="checkbox-line mb-8"><input type="checkbox" data-hh ${wiz.hasHeader ? 'checked' : ''}>首行是标题行（不导入）</label>
      <div class="map-grid">
        ${Array.from({ length: cols }, (_, i) => `
          <div class="map-col"><div class="mc-head">
            <select data-map-i="${i}" class="${wiz.mapping[i] !== 'ignore' ? 'mapped' : ''}">${opts(wiz.mapping[i])}</select></div>
            ${wiz.rows.slice(0, 5).map((r, ri) =>
              `<div class="mc-cell ${ri === 0 && wiz.hasHeader ? 'hdr' : ''}">${esc(r[i] ?? '')}</div>`).join('')}
          </div>`).join('')}
      </div>
      <p class="small muted mt-8">共解析到 ${wiz.rows.length} 行。请为每一列选择对应字段（已按标题自动匹配）。</p>`;
    $('[data-hh]').addEventListener('change', e => { wiz.hasHeader = e.target.checked; drawMap(); });
    m.overlay.querySelectorAll('[data-map-i]').forEach(sel => sel.addEventListener('change', () => {
      wiz.mapping[Number(sel.dataset.mapI)] = sel.value;
      sel.classList.toggle('mapped', sel.value !== 'ignore');
    }));
  }

  $('[data-import]').addEventListener('click', () => {
    const dataRows = wiz.hasHeader ? wiz.rows.slice(1) : wiz.rows;
    const objs = dataRows.map(r => {
      const o = {};
      wiz.mapping.forEach((f, i) => {
        const v = (r[i] ?? '').trim();
        if (f && f !== 'ignore' && v !== '' && o[f] == null) o[f] = v;
      });
      return o;
    }).filter(o => Object.keys(o).length);
    if (!objs.length) return toast('没有可导入的数据行', 'warn');
    try {
      const msg = buildAndImport(objs, m.body);
      m.close();
      toast(msg, 'success');
      render();
    } catch (e) {
      toast(e.message || '导入失败', 'error');
    }
  });
}

const PRODUCT_GUESS = [
  ['sku', ['sku', '货号', '编码', '编号']],
  ['barcode', ['条码', '条形码', 'barcode', 'ean', 'upc']],
  ['name', ['名称', '品名', '商品', 'name', 'title']],
  ['spec', ['规格', '型号', 'spec', '款式', '颜色']],
  ['safeStock', ['安全', '预警', '警戒', 'safe']],
  ['stock', ['库存', '数量', 'stock', 'qty']],
  ['cost', ['成本', '进价', '单价', 'cost', 'price']],
  ['note', ['备注', 'note', 'remark']]
];

function openProductImport() {
  openImportWizard({
    title: '导入商品',
    fields: [
      { key: 'sku', label: 'SKU 编码' }, { key: 'barcode', label: '条码' },
      { key: 'name', label: '名称' }, { key: 'spec', label: '规格' },
      { key: 'stock', label: '库存' }, { key: 'safeStock', label: '安全库存' },
      { key: 'cost', label: '成本' }, { key: 'note', label: '备注' }
    ],
    guessList: PRODUCT_GUESS,
    templateName: '商品导入模板.csv',
    templateRows: [['SKU', '条码', '名称', '规格', '库存', '安全库存', '成本', '备注'],
      ['BX-001', '8054321000011', '密封保鲜盒三件套', '大中小', '100', '20', '2.10', '']],
    extraHTML: `<div class="field"><label>已存在的 SKU 如何处理</label>
      <div class="flex">
        <label class="checkbox-line"><input type="radio" name="impMode" value="skip" checked>跳过不动</label>
        <label class="checkbox-line"><input type="radio" name="impMode" value="update">覆盖更新资料（含库存）</label>
      </div></div>`,
    buildAndImport(objs, body) {
      const mode = body.querySelector('input[name="impMode"]:checked').value;
      let added = 0, updated = 0, skipped = 0, bad = 0;
      for (const o of objs) {
        const sku = (o.sku || '').trim();
        if (!sku) { bad++; continue; }
        const exist = productBySku(sku);
        if (exist) {
          if (mode === 'update') {
            if (o.name) exist.name = o.name;
            if (o.barcode != null) exist.barcode = o.barcode;
            if (o.spec != null) exist.spec = o.spec;
            if (o.safeStock != null) exist.safeStock = Number(o.safeStock) || 0;
            if (o.cost != null && o.cost !== '') exist.cost = Number(o.cost);
            if (o.note != null) exist.note = o.note;
            if (o.stock != null && o.stock !== '') {
              const delta = Number(o.stock) - Number(exist.stock);
              if (delta) addStockMove(exist, delta, 'adjust', '导入覆盖库存');
            }
            updated++;
          } else skipped++;
        } else {
          DB.products.push({
            id: uid(), sku, barcode: o.barcode || '', name: o.name || sku, spec: o.spec || '',
            stock: Number(o.stock) || 0, safeStock: Number(o.safeStock) || 0,
            cost: o.cost != null && o.cost !== '' ? Number(o.cost) : '', note: o.note || '', createdAt: Date.now()
          });
          added++;
        }
      }
      save();
      return `导入完成：新增 ${added} 个${updated ? `，更新 ${updated} 个` : ''}${skipped ? `，跳过已存在 ${skipped} 个` : ''}${bad ? `，无 SKU 忽略 ${bad} 行` : ''}`;
    }
  });
}

/* ============================================================
   入库
   ============================================================ */
const inboundPending = []; // {sku, qty}

function renderInbound(el) {
  el.innerHTML = pageHead('入库', '收货时扫商品条码连续入库，或手动单笔录入') + `
    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">${icon('barcode', 16)}扫码连续入库</div>
        <div class="scan-input-wrap mb-8">${icon('barcode', 20)}
          <input class="scan-input" style="font-size:16px;padding-top:10px;padding-bottom:10px" data-inscan
            placeholder="扫描商品条码（自动确认）/ 输入 SKU 回车" autocomplete="off"></div>
        <p class="small muted mb-8">同一商品重复扫码自动累加数量</p>
        ${inboundPending.length ? `<div class="tbl-wrap mb-8"><table class="tbl"><thead>
          <tr><th>SKU</th><th>名称</th><th class="num" style="width:90px">数量</th><th></th></tr></thead><tbody>
          ${inboundPending.map((it, i) => {
            const p = productBySku(it.sku);
            return `<tr><td class="mono">${esc(it.sku)}</td><td class="ellip">${esc(p?.name || '')}</td>
              <td class="num"><input class="input" type="number" min="1" step="1" style="width:76px;text-align:right;padding:4px 8px"
                value="${it.qty}" data-qty-i="${i}"></td>
              <td style="text-align:right"><button class="btn btn-sm btn-ghost" data-rm-i="${i}">${icon('x', 13)}</button></td></tr>`;
          }).join('')}
        </tbody></table></div>
        <div class="flex" style="flex-wrap:wrap">
          <select class="select" data-in-reason style="width:auto"><option>采购入库</option><option>退货入库</option></select>
          <input class="input grow" data-in-note placeholder="备注（选填）" style="min-width:120px">
          <button class="btn btn-accent" data-in-ok>${icon('check', 15)}确认入库 ${inboundPending.reduce((s, x) => s + x.qty, 0)} 件</button>
          <button class="btn btn-ghost" data-in-clear>清空</button>
        </div>` : `<p class="muted small" style="padding:16px 0">尚未扫入商品</p>`}
      </div>
      <div class="card">
        <div class="card-title">${icon('inbound', 16)}单笔入库</div>
        <div class="field"><label>商品（输入 SKU / 条码 / 名称搜索）</label>
          <div class="picker-wrap"><input class="input" data-one-prod placeholder="搜索选择商品" autocomplete="off"></div></div>
        <div class="form-row">
          <div class="field"><label>数量</label><input class="input" type="number" min="1" step="1" data-one-qty value="1"></div>
          <div class="field"><label>事由</label><select class="select" data-one-reason>
            <option>采购入库</option><option>退货入库</option><option>盘盈</option></select></div>
        </div>
        <div class="field"><label>备注</label><input class="input" data-one-note></div>
        <button class="btn btn-primary" data-one-ok>${icon('check', 15)}入库</button>
      </div>
    </div>
    <div class="card mt-14">
      <div class="card-title">${icon('history', 16)}最近入库记录</div>
      ${(() => {
        const ins = DB.moves.filter(mv => mv.qty > 0 && mv.type !== 'out').slice(0, 15);
        return ins.length ? `<div class="tbl-wrap"><table class="tbl"><thead>
          <tr><th>时间</th><th>SKU</th><th>名称</th><th class="num">数量</th><th>事由</th><th>备注</th></tr></thead><tbody>
          ${ins.map(mv => `<tr><td class="muted small">${fmtDT(mv.at)}</td>
            <td class="mono">${esc(mv.sku)}</td><td class="ellip">${esc(mv.name)}</td>
            <td class="num pos">+${mv.qty}</td><td class="dim small">${esc(mv.reason)}</td>
            <td class="dim small">${esc(mv.note || '')}</td></tr>`).join('')}
        </tbody></table></div>` : `<p class="muted small">暂无入库记录</p>`;
      })()}
    </div>`;

  // 扫码连续入库
  const inScan = el.querySelector('[data-inscan]');
  function inboundScan(code) {
    code = String(code || '').trim();
    if (!code) return;
    const p = productByCode(code);
    if (!p) { playBeep('err'); toast(t('未找到商品「{code}」，请先在商品库添加', { code }), 'error'); inScan.select(); return; }
    const ex = inboundPending.find(x => x.sku === p.sku);
    if (ex) ex.qty++; else inboundPending.push({ sku: p.sku, qty: 1 });
    playBeep('ok');
    render();
    const ni = document.querySelector('[data-inscan]');
    if (ni) ni.focus();
  }
  inScan.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    inboundScan(inScan.value);
  });
  attachAutoScan(inScan, inboundScan);
  el.querySelectorAll('[data-qty-i]').forEach(inp => inp.addEventListener('change', () => {
    inboundPending[Number(inp.dataset.qtyI)].qty = Math.max(1, Number(inp.value) || 1);
    render();
  }));
  el.querySelectorAll('[data-rm-i]').forEach(b => b.addEventListener('click', () => {
    inboundPending.splice(Number(b.dataset.rmI), 1);
    render();
  }));
  el.querySelector('[data-in-clear]')?.addEventListener('click', () => { inboundPending.length = 0; render(); });
  el.querySelector('[data-in-ok]')?.addEventListener('click', () => {
    const reason = el.querySelector('[data-in-reason]').value;
    const note = el.querySelector('[data-in-note]').value.trim();
    let total = 0;
    for (const it of inboundPending) {
      const p = productBySku(it.sku);
      if (p && it.qty > 0) { addStockMove(p, it.qty, 'in', reason, '', note); total += it.qty; }
    }
    save();
    inboundPending.length = 0;
    toast(`入库完成，共 ${total} 件`, 'success');
    render();
  });

  // 单笔入库
  let onePicked = null;
  attachProductPicker(el.querySelector('[data-one-prod]'), p => onePicked = p);
  el.querySelector('[data-one-ok]').addEventListener('click', () => {
    if (!onePicked) return toast('请先选择商品', 'warn');
    const qty = Number(el.querySelector('[data-one-qty]').value);
    if (!qty || qty <= 0) return toast('数量需大于 0', 'warn');
    addStockMove(onePicked, qty, 'in', el.querySelector('[data-one-reason]').value, '',
      el.querySelector('[data-one-note]').value.trim());
    save();
    toast(`${onePicked.name} 入库 +${qty} → 库存 ${Number(onePicked.stock)}`, 'success');
    render();
  });
}

/* ============================================================
   订单管理
   ============================================================ */
const orderState = { status: 'pending', channel: '', q: '' };

function renderOrders(el) {
  const counts = {
    all: DB.orders.length,
    pending: DB.orders.filter(o => o.status === 'pending').length,
    verified: DB.orders.filter(o => o.status === 'verified').length
  };
  const chansInUse = [...new Set([...DB.channels, ...DB.orders.map(o => o.channel).filter(Boolean)])];
  const q = normCode(orderState.q);
  let list = DB.orders.filter(o => {
    if (orderState.status !== 'all' && o.status !== orderState.status) return false;
    if (orderState.channel && o.channel !== orderState.channel) return false;
    if (q) {
      const hay = [o.orderNo, o.trackingNo, o.receiver, ...(o.items || []).flatMap(i => [i.sku, i.name])]
        .map(normCode).join('|');
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const shown = list.slice(0, 300);

  el.innerHTML = pageHead('订单管理', '导入各渠道订单，扫描面单核对出库',
    `<button class="btn" data-exp>${icon('download', 15)}导出待核对</button>
     <button class="btn" data-clean>${icon('trash', 15)}清理已核对</button>
     <button class="btn" data-new>${icon('plus', 15)}手动新增</button>
     <button class="btn btn-accent" data-imp>${icon('upload', 15)}导入订单</button>`) + `
    <div class="toolbar">
      <div class="seg">
        <button data-st="pending" class="${orderState.status === 'pending' ? 'on' : ''}">待核对 ${counts.pending}</button>
        <button data-st="verified" class="${orderState.status === 'verified' ? 'on' : ''}">已核对 ${counts.verified}</button>
        <button data-st="all" class="${orderState.status === 'all' ? 'on' : ''}">全部 ${counts.all}</button>
      </div>
      <select class="select" data-chan>
        <option value="">全部渠道</option>
        ${chansInUse.map(c => `<option ${orderState.channel === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
      <input class="input" style="width:240px" data-q placeholder="搜索订单号 / 运单号 / 收件人 / 商品" value="${esc(orderState.q)}">
    </div>
    ${shown.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th>状态</th><th>渠道</th><th>订单号</th><th>运单号</th><th>商品</th><th class="num">件数</th>
      <th>创建</th><th>核对时间</th><th style="text-align:right">操作</th></tr></thead>
    <tbody data-obody>
    ${shown.map(o => `
      <tr data-id="${o.id}">
        <td>${statusBadge(o)}</td>
        <td>${channelBadge(o.channel)}</td>
        <td class="mono">${esc(o.orderNo || '')}</td>
        <td class="mono">${esc(o.trackingNo || '')}</td>
        <td class="ellip" style="cursor:pointer" data-tgl title="点击展开明细">${esc(orderItemsSummary(o))} ${icon('chevron', 12)}</td>
        <td class="num">${orderPieces(o)}</td>
        <td class="muted small">${fmtDT(o.createdAt)}</td>
        <td class="muted small">${fmtDT(o.verifiedAt)}</td>
        <td><div class="row-actions">
          ${o.status === 'pending'
            ? `<button class="btn btn-sm btn-accent" data-act="verify">${icon('check', 13)}核对</button>
               <button class="btn btn-sm btn-ghost" data-act="edit">${icon('edit', 13)}</button>`
            : `<button class="btn btn-sm" data-act="undo">${icon('undo', 13)}撤销</button>`}
          <button class="btn btn-sm btn-ghost" data-act="del">${icon('trash', 13)}</button>
        </div></td>
      </tr>
      <tr class="detail-tr" data-detail="${o.id}" hidden><td colspan="9">
        ${(o.items || []).length ? `<div class="small" style="display:flex;flex-direction:column;gap:3px">
          ${(o.items || []).map(i => {
            const p = productByCode(i.sku);
            return `<div>${icon('package', 12)} <span class="mono">${esc(i.sku || '—')}</span>
              ${esc(i.name || '')} ×<b>${i.qty}</b>
              ${p ? `<span class="muted">（当前库存 ${Number(p.stock)}）</span>`
                  : `<span class="badge b-red" style="margin-left:6px">未匹配商品库</span>`}</div>`;
          }).join('')}</div>` : '<span class="muted small">无商品明细</span>'}
        ${o.receiver ? `<div class="small muted mt-8"><span>收件人：</span>${esc(o.receiver)}</div>` : ''}
        ${o.parcel ? `<div class="small muted"><span>包裹：</span>${[o.parcel.l, o.parcel.w, o.parcel.h].map(v => v === '' || v == null ? '?' : v).join('×')} cm${o.parcel.kg !== '' && o.parcel.kg != null ? ` · ${o.parcel.kg} kg` : ''}</div>` : ''}
        ${o.note ? `<div class="small muted"><span>备注：</span>${esc(o.note)}</div>` : ''}
      </td></tr>`).join('')}
    </tbody></table></div>
    ${list.length > 300 ? `<p class="small muted mt-8">仅显示前 300 条（共 ${list.length} 条），可用搜索缩小范围</p>` : ''}`
    : `<div class="card">${emptyHTML(
        counts.all === 0 ? '还没有订单，点击右上角「导入订单」批量粘贴，或「手动新增」' : '没有符合条件的订单')}</div>`}`;

  el.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', () => {
    orderState.status = b.dataset.st; render();
  }));
  el.querySelector('[data-chan]').addEventListener('change', e => { orderState.channel = e.target.value; render(); });
  el.querySelector('[data-q]').addEventListener('input', e => { orderState.q = e.target.value; render(); refocus(el, '[data-q]'); });
  el.querySelector('[data-new]').addEventListener('click', () => openOrderModal());
  el.querySelector('[data-imp]').addEventListener('click', openOrderImport);
  el.querySelector('[data-exp]').addEventListener('click', exportPendingCSV);
  el.querySelector('[data-clean]').addEventListener('click', async () => {
    const n = DB.orders.filter(o => o.status === 'verified').length;
    if (!n) return toast('没有已核对的订单需要清理');
    const ok = await confirmBox(`将删除 <b>${n}</b> 个已核对订单（不影响库存与流水记录）。<br><span class="muted small">建议先在「设置」中导出备份。</span>`, { danger: true, okText: `删除 ${n} 个` });
    if (!ok) return;
    DB.orders = DB.orders.filter(o => o.status !== 'verified');
    save(); toast(`已清理 ${n} 个已核对订单`, 'success'); render();
  });

  const tbody = el.querySelector('[data-obody]');
  if (tbody) tbody.addEventListener('click', async e => {
    const tgl = e.target.closest('[data-tgl]');
    if (tgl) {
      const id = tgl.closest('tr').dataset.id;
      const d = tbody.querySelector(`[data-detail="${id}"]`);
      if (d) d.hidden = !d.hidden;
      return;
    }
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    const o = DB.orders.find(x => x.id === id);
    if (!o) return;
    const act = btn.dataset.act;
    if (act === 'verify') {
      verifyOrder(o);
      toast(`已核对出库：${o.trackingNo || o.orderNo}`, 'success');
      render();
    } else if (act === 'undo') {
      unverifyOrder(o);
      toast('已撤销核对，库存已回补');
      render();
    } else if (act === 'edit') {
      openOrderModal(o);
    } else if (act === 'del') {
      const ok = await confirmBox(`确定删除订单 <b class="mono">${esc(o.trackingNo || o.orderNo || '')}</b>？<br><span class="muted small">${o.status === 'verified' ? '该订单已核对出库，删除不会回补库存。' : '删除后无法通过扫描核对到此单。'}</span>`, { danger: true, okText: '删除' });
      if (ok) { DB.orders = DB.orders.filter(x => x.id !== id); save(); toast('订单已删除'); render(); }
    }
  });
}

function exportPendingCSV() {
  const rows = [['渠道', '订单号', '运单号', '收件人', '商品明细', '件数', '创建时间'],
    ...DB.orders.filter(o => o.status === 'pending').map(o =>
      [o.channel, o.orderNo, o.trackingNo, o.receiver, orderItemsSummary(o), orderPieces(o), fmtFull(o.createdAt)])];
  downloadFile(`待核对订单_${dayKey(Date.now())}.csv`, toCSV(rows));
  toast('已导出待核对订单', 'success');
}

/* ---------- 手动新增 / 编辑订单 ---------- */
function openOrderModal(o = null, prefill = {}) {
  const isEdit = !!o;
  const chans = [...new Set([...DB.channels, o?.channel].filter(Boolean))];
  const items = (o?.items || []).map(i => ({ ...i }));
  if (!items.length) items.push({ sku: '', name: '', qty: 1 });

  const m = openModal({
    title: isEdit ? '编辑订单' : '新增订单', wide: true,
    body: `
      <div class="form-row-3">
        <div class="field"><label>渠道</label><select class="select" data-f="channel">
          ${chans.map(c => `<option ${(o?.channel || prefill.channel) === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select></div>
        <div class="field"><label>订单号</label>
          <input class="input mono" data-f="orderNo" value="${esc(o?.orderNo || prefill.orderNo || '')}"></div>
        <div class="field"><label>运单号（扫描核对依据）</label>
          <input class="input mono" data-f="trackingNo" value="${esc(o?.trackingNo || prefill.trackingNo || '')}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>收件人 / 客户</label>
          <input class="input" data-f="receiver" value="${esc(o?.receiver || '')}"></div>
        <div class="field"><label>备注</label>
          <input class="input" data-f="note" value="${esc(o?.note || '')}"></div>
      </div>
      <div class="field"><label>商品明细</label><div data-items></div>
        <button class="btn btn-sm mt-8" data-add-item type="button">${icon('plus', 13)}添加商品行</button></div>`,
    footer: `<button class="btn" data-cancel>取消</button>
             <button class="btn btn-primary" data-save>${icon('save', 15)}保存订单</button>`
  });

  const itemsBox = m.body.querySelector('[data-items]');
  function drawItems() {
    itemsBox.innerHTML = items.map((it, i) => `
      <div class="flex mb-8" data-item-row="${i}">
        <div class="picker-wrap grow"><input class="input" data-item-prod="${i}" autocomplete="off"
          placeholder="搜索商品（SKU/条码/名称）" value="${esc(it.sku ? `${it.sku}｜${it.name || ''}` : (it.name || ''))}"
          ${it.sku ? `data-picked-sku="${esc(it.sku)}"` : ''}></div>
        <input class="input" type="number" min="1" step="1" style="width:84px" data-item-qty="${i}" value="${it.qty}">
        <button class="btn btn-sm btn-ghost" data-item-rm="${i}" type="button">${icon('x', 13)}</button>
      </div>`).join('');
    itemsBox.querySelectorAll('[data-item-prod]').forEach(inp => {
      const i = Number(inp.dataset.itemProd);
      if (items[i].sku) inp.dataset.pickedSku = items[i].sku;
      attachProductPicker(inp, p => {
        if (p) { items[i].sku = p.sku; items[i].name = p.name; }
        else { items[i].sku = ''; items[i].name = inp.value.trim(); }
      });
      inp.addEventListener('input', () => { if (!inp.dataset.pickedSku) items[i].name = inp.value.trim(); });
    });
    itemsBox.querySelectorAll('[data-item-qty]').forEach(inp =>
      inp.addEventListener('change', () => items[Number(inp.dataset.itemQty)].qty = Math.max(1, Number(inp.value) || 1)));
    itemsBox.querySelectorAll('[data-item-rm]').forEach(b =>
      b.addEventListener('click', () => { items.splice(Number(b.dataset.itemRm), 1); if (!items.length) items.push({ sku: '', name: '', qty: 1 }); drawItems(); }));
  }
  drawItems();
  m.body.querySelector('[data-add-item]').addEventListener('click', () => { items.push({ sku: '', name: '', qty: 1 }); drawItems(); });

  const get = f => m.body.querySelector(`[data-f="${f}"]`).value.trim();
  m.overlay.querySelector('[data-cancel]').addEventListener('click', m.close);
  m.overlay.querySelector('[data-save]').addEventListener('click', () => {
    const orderNo = get('orderNo'), trackingNo = get('trackingNo');
    if (!orderNo && !trackingNo) return toast('订单号和运单号至少填写一个', 'warn');
    if (trackingNo) {
      const dup = DB.orders.find(x => normCode(x.trackingNo) === normCode(trackingNo) && x.id !== o?.id);
      if (dup) return toast('该运单号已存在于订单列表中', 'error');
    }
    const cleanItems = items
      .filter(it => (it.sku || it.name || '').trim())
      .map(it => {
        const p = it.sku ? productByCode(it.sku) : productByCode(it.name);
        return { sku: p ? p.sku : (it.sku || it.name), name: p ? p.name : (it.name || it.sku), qty: Math.max(1, Number(it.qty) || 1) };
      });
    const data = { channel: get('channel'), orderNo, trackingNo, receiver: get('receiver'), note: get('note'), items: cleanItems };
    if (isEdit) Object.assign(o, data);
    else DB.orders.unshift({ id: uid(), carrier: '', status: 'pending', createdAt: Date.now(), verifiedAt: null, ...data });
    save(); m.close();
    toast(isEdit ? '订单已更新' : '订单已添加', 'success');
    render();
  });
}

/* ---------- 订单导入 ---------- */
const ORDER_GUESS = [
  ['trackingNo', ['运单', '快递单号', '物流单号', '面单', 'tracking', 'waybill', '单号']],
  ['orderNo', ['订单', 'order']],
  ['channel', ['渠道', '平台', '店铺', 'channel', 'shop', '来源']],
  ['sku', ['sku', '货号', '商品编码', '商品编号', '编码']],
  ['qty', ['数量', '件数', 'qty', 'quantity', 'pcs']],
  ['name', ['商品', '品名', '名称', '标题', 'product', 'title', 'item']],
  ['receiver', ['收件', '客户', '买家', '姓名', 'receiver']],
  ['carrier', ['快递公司', '物流公司', '承运', 'carrier']],
  ['note', ['备注', 'note', 'remark']]
];

function openOrderImport() {
  openImportWizard({
    title: '导入订单（多渠道通用）',
    fields: [
      { key: 'trackingNo', label: '运单号 ★' }, { key: 'orderNo', label: '订单号' },
      { key: 'channel', label: '渠道' }, { key: 'sku', label: 'SKU' },
      { key: 'name', label: '商品名' }, { key: 'qty', label: '数量' },
      { key: 'receiver', label: '收件人' }, { key: 'carrier', label: '快递公司' },
      { key: 'note', label: '备注' }
    ],
    guessList: ORDER_GUESS,
    templateName: '订单导入模板.csv',
    templateRows: [['渠道', '订单号', '运单号', 'SKU', '商品名', '数量', '收件人', '备注'],
      ['淘宝', 'TB001', 'SF1234567890', 'BX-001', '密封保鲜盒三件套', '2', '王女士', ''],
      ['淘宝', 'TB001', 'SF1234567890', 'LJ-030', '加厚垃圾袋', '1', '王女士', '同单第二个商品写同一运单号']],
    extraHTML: `<div class="form-row">
      <div class="field"><label>默认渠道（表中无渠道列时使用）</label>
        <select class="select" data-def-chan>${DB.channels.map(c => `<option>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label class="field-hint" style="margin-top:26px">同一订单多个商品：写多行，运单号相同即可自动合并</label></div>
    </div>`,
    buildAndImport(objs, body) {
      const defChan = body.querySelector('[data-def-chan]').value;
      const groups = new Map();
      let noKey = 0;
      const dups = new Set();
      for (const ob of objs) {
        const tracking = (ob.trackingNo || '').trim();
        const orderNo = (ob.orderNo || '').trim();
        if (!tracking && !orderNo) { noKey++; continue; }
        if (tracking && trackingExists(tracking)) { dups.add(normCode(tracking)); continue; }
        const key = tracking ? 't:' + normCode(tracking) : 'o:' + normCode(orderNo);
        let g = groups.get(key);
        if (!g) {
          g = {
            channel: (ob.channel || '').trim() || defChan, orderNo, trackingNo: tracking,
            carrier: (ob.carrier || '').trim(), receiver: (ob.receiver || '').trim(),
            note: (ob.note || '').trim(), items: []
          };
          groups.set(key, g);
        }
        const sku = (ob.sku || '').trim(), name = (ob.name || '').trim();
        const qty = Math.max(1, Number(ob.qty) || 1);
        if (sku || name) {
          const p = productByCode(sku) || (sku ? null : productByCode(name));
          g.items.push({ sku: p ? p.sku : sku, name: name || (p ? p.name : ''), qty });
        }
      }
      if (!groups.size) throw new Error('没有可导入的订单' + (dups.size ? `（${dups.size} 个运单号已存在）` : '，请检查运单号/订单号列是否已正确映射'));
      const now = Date.now();
      for (const g of groups.values()) {
        DB.orders.unshift({ id: uid(), status: 'pending', createdAt: now, verifiedAt: null, ...g });
      }
      save();
      return `导入 ${groups.size} 个订单` +
        (dups.size ? `，跳过重复运单 ${dups.size} 个` : '') +
        (noKey ? `，忽略无单号行 ${noKey} 行` : '');
    }
  });
}

/* ============================================================
   出入流水
   ============================================================ */
const recState = { type: 'all', q: '', from: '', to: '' };

function renderRecords(el) {
  const q = normCode(recState.q);
  const fromTs = recState.from ? new Date(recState.from + 'T00:00:00').getTime() : 0;
  const toTs = recState.to ? new Date(recState.to + 'T23:59:59').getTime() : Infinity;
  const list = DB.moves.filter(mv => {
    if (recState.type !== 'all' && mv.type !== recState.type) return false;
    if (mv.at < fromTs || mv.at > toTs) return false;
    if (q && !(normCode(mv.sku).includes(q) || normCode(mv.name).includes(q) || normCode(mv.ref).includes(q))) return false;
    return true;
  });
  const inSum = list.filter(m => m.qty > 0).reduce((s, m) => s + m.qty, 0);
  const outSum = list.filter(m => m.qty < 0).reduce((s, m) => s - m.qty, 0);
  const shown = list.slice(0, 500);

  el.innerHTML = pageHead('出入流水', '每一次库存变动都有据可查',
    `<button class="btn" data-exp>${icon('download', 15)}导出 CSV</button>`) + `
    <div class="toolbar">
      <div class="seg">
        <button data-t="all" class="${recState.type === 'all' ? 'on' : ''}">全部</button>
        <button data-t="in" class="${recState.type === 'in' ? 'on' : ''}">入库</button>
        <button data-t="out" class="${recState.type === 'out' ? 'on' : ''}">出库</button>
        <button data-t="adjust" class="${recState.type === 'adjust' ? 'on' : ''}">调整</button>
      </div>
      <input class="input" style="width:200px" data-q placeholder="搜索 SKU / 名称 / 单号" value="${esc(recState.q)}">
      <input class="input" type="date" data-from value="${esc(recState.from)}" title="开始日期">
      <span class="muted">—</span>
      <input class="input" type="date" data-to value="${esc(recState.to)}" title="结束日期">
      <span class="grow"></span>
      <span class="chip c-green">入 <b>+${inSum}</b></span>
      <span class="chip c-red">出 <b>-${outSum}</b></span>
    </div>
    ${shown.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th>时间</th><th>类型</th><th>SKU</th><th>名称</th><th class="num">数量</th><th>事由</th><th>关联单号</th><th>备注</th>
    </tr></thead><tbody>
    ${shown.map(mv => `<tr>
      <td class="muted small" style="white-space:nowrap">${fmtFull(mv.at)}</td>
      <td>${moveTypeBadge(mv.type)}</td>
      <td class="mono">${esc(mv.sku)}</td>
      <td class="ellip">${esc(mv.name)}</td>
      <td class="num ${mv.qty > 0 ? 'pos' : 'neg'}">${mv.qty > 0 ? '+' : ''}${mv.qty}</td>
      <td class="dim small">${esc(mv.reason)}</td>
      <td class="mono muted small">${esc(mv.ref || '')}</td>
      <td class="dim small">${esc(mv.note || '')}</td></tr>`).join('')}
    </tbody></table></div>
    ${list.length > 500 ? `<p class="small muted mt-8">仅显示前 500 条（共 ${list.length} 条），可用日期或搜索缩小范围</p>` : ''}`
    : `<div class="card">${emptyHTML('没有符合条件的流水记录')}</div>`}`;

  el.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => { recState.type = b.dataset.t; render(); }));
  el.querySelector('[data-q]').addEventListener('input', e => { recState.q = e.target.value; render(); refocus(el, '[data-q]'); });
  el.querySelector('[data-from]').addEventListener('change', e => { recState.from = e.target.value; render(); });
  el.querySelector('[data-to]').addEventListener('change', e => { recState.to = e.target.value; render(); });
  el.querySelector('[data-exp]').addEventListener('click', () => {
    const rows = [['时间', '类型', 'SKU', '名称', '数量', '事由', '关联单号', '备注'],
      ...list.map(mv => [fmtFull(mv.at), mv.type === 'in' ? '入库' : mv.type === 'out' ? '出库' : '调整',
        mv.sku, mv.name, mv.qty, mv.reason, mv.ref, mv.note])];
    downloadFile(`出入流水_${dayKey(Date.now())}.csv`, toCSV(rows));
    toast('已导出流水 CSV', 'success');
  });
}

/* ============================================================
   设置
   ============================================================ */
function cloudCardHTML() {
  const cfg = getCloudCfg();
  const st = syncStatus.state;
  let body = '';
  if (st === 'login' || st === 'off') {
    body = `
      <p class="small dim mb-14">登录后，商品 / 订单 / 流水在多设备之间自动同步（改动后约 2 秒推送，每 45 秒增量拉取；库存按流水汇总计算，多台设备同时扫单不会互相覆盖）。使用管理员提供的账号密码登录即可。</p>
      ${syncStatus.error ? `<p class="small neg mb-8">${esc(syncStatus.error)}</p>` : ''}
      <div class="form-row">
        <div class="field"><label>登录邮箱</label>
          <input class="input" type="email" data-cl-email autocomplete="username" placeholder="管理员提供的账号"></div>
        <div class="field"><label>密码</label>
          <input class="input" type="password" data-cl-pass autocomplete="current-password"></div>
      </div>
      <div class="field"><label>同步服务地址（一般不用改）</label>
        <input class="input mono" data-cl-url value="${esc(cfg.url)}"></div>
      <button class="btn btn-accent" data-cl-login>${icon('upload', 15)}登录并开始同步</button>`;
  } else {
    body = `
      <div class="setting-line">
        <div class="sl-txt"><b>${esc(syncStatus.email)}</b>
          <span data-cloud-state>${esc(syncStatusText())}</span>
          ${st === 'error' ? `<span class="neg small" style="display:block">${esc(syncStatus.error)}</span>` : ''}</div>
        <div class="flex">
          <button class="btn" data-cl-sync>${icon('undo', 15)}立即同步</button>
          <button class="btn btn-ghost" data-cl-out>退出登录</button>
        </div>
      </div>`;
  }
  return `<div class="card">
    <div class="card-title">${icon('scan', 16)}云同步（多设备共享）</div>
    ${body}
  </div>`;
}

function renderSettings(el) {
  const sizeKB = Math.round((localStorage.getItem(DB_KEY) || '').length / 1024 * 10) / 10;
  el.innerHTML = pageHead('设置', '云同步、渠道、偏好与数据备份') + cloudCardHTML() + `
    <div class="card">
      <div class="card-title">${icon('orders', 16)}销售渠道</div>
      <div class="chips-edit" data-chans>
        ${DB.channels.map((c, i) => `<span class="chan-chip"><span class="dot" style="width:8px;height:8px;border-radius:50%;background:${chanColor(c)}"></span>${esc(c)}
          <button data-rm-chan="${i}" title="删除" aria-label="删除渠道${esc(c)}">${icon('x', 13)}</button></span>`).join('')}
        <input class="input" style="width:150px" data-new-chan placeholder="新渠道名，回车添加">
      </div>
    </div>
    <div class="card">
      <div class="card-title">${icon('settings', 16)}偏好</div>
      <div class="setting-line">
        <div class="sl-txt"><b>扫描提示音</b><span>核对成功 / 重复 / 异常时播放不同提示音</span></div>
        <label class="checkbox-line"><input type="checkbox" data-set="beep" ${DB.settings.beep ? 'checked' : ''}>开启</label>
      </div>
      <div class="setting-line">
        <div class="sl-txt"><b>核对时自动扣减库存</b><span>扫描核对订单时按商品明细自动出库；撤销核对自动回补</span></div>
        <label class="checkbox-line"><input type="checkbox" data-set="deduct" ${DB.settings.deduct ? 'checked' : ''}>开启</label>
      </div>
      <div class="setting-line">
        <div class="sl-txt"><b>单件订单扫面单直发</b><span>扫码打包页：只有 1 件商品的订单扫面单直接出库，无需再扫商品</span></div>
        <label class="checkbox-line"><input type="checkbox" data-set="packSingleFast" ${DB.settings.packSingleFast !== false ? 'checked' : ''}>开启</label>
      </div>
    </div>
    <div class="card">
      <div class="card-title">${icon('save', 16)}数据备份</div>
      <p class="small dim mb-14">所有数据仅保存在本机浏览器（localStorage）。清除浏览器数据会导致丢失，<b>请定期导出备份</b>。<span>上次备份：</span>${DB.settings.lastBackup ? fmtFull(DB.settings.lastBackup) : '<span class="neg">从未备份</span>'}</p>
      <div class="flex" style="flex-wrap:wrap">
        <button class="btn btn-primary" data-backup>${icon('download', 15)}导出备份（JSON）</button>
        <button class="btn" data-restore-btn>${icon('upload', 15)}导入备份恢复</button>
        <input type="file" accept=".json" hidden data-restore>
        <button class="btn" data-demo>${icon('box', 15)}载入示例数据</button>
        <span class="grow"></span>
        <button class="btn btn-danger" data-wipe>${icon('trash', 15)}清空全部数据</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">${icon('info', 16)}关于</div>
      <p class="small dim">SUVOO 进销存 · 面单核对 v1.0 — 轻量级本地进销存工具，适合小团队多渠道电商出库核对。<br>
      当前数据：${DB.products.length} 个商品 · ${DB.orders.length} 个订单 · ${DB.moves.length} 条流水 · 占用 ${sizeKB} KB</p>
    </div>`;

  // 云同步
  el.querySelector('[data-cl-login]')?.addEventListener('click', async e => {
    const btn = e.currentTarget;
    const url = el.querySelector('[data-cl-url]').value.trim();
    const email = el.querySelector('[data-cl-email]').value.trim();
    const pass = el.querySelector('[data-cl-pass]').value;
    if (!url) return toast('请填写同步服务地址', 'warn');
    if (!email || !pass) return toast('请填写登录邮箱和密码', 'warn');
    btn.disabled = true;
    try {
      cloudReconnect({ url });
      await cloudLogin(email, pass);
      render();
    } catch (err) {
      toast(err.message || '登录失败', 'error');
      btn.disabled = false;
    }
  });
  el.querySelector('[data-cl-sync]')?.addEventListener('click', () => syncNow(true));
  el.querySelector('[data-cl-out]')?.addEventListener('click', async () => {
    await cloudLogout();
    render();
  });

  // 渠道
  el.querySelectorAll('[data-rm-chan]').forEach(b => b.addEventListener('click', () => {
    DB.channels.splice(Number(b.dataset.rmChan), 1);
    save(); render();
  }));
  el.querySelector('[data-new-chan]').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const v = e.target.value.trim();
    if (!v) return;
    if (DB.channels.includes(v)) return toast('该渠道已存在', 'warn');
    DB.channels.push(v);
    save(); render();
  });
  // 偏好
  el.querySelectorAll('[data-set]').forEach(cb => cb.addEventListener('change', () => {
    DB.settings[cb.dataset.set] = cb.checked;
    save();
    toast('设置已保存', 'success');
  }));
  // 备份
  el.querySelector('[data-backup]').addEventListener('click', () => { exportBackup(); toast('备份文件已下载', 'success'); render(); });
  el.querySelector('[data-restore-btn]').addEventListener('click', () => el.querySelector('[data-restore]').click());
  el.querySelector('[data-restore]').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    const ok = await confirmBox('导入备份将<b>完全覆盖</b>当前所有数据，确定继续？', { danger: true, okText: '覆盖恢复' });
    if (!ok) { e.target.value = ''; return; }
    const rd = new FileReader();
    rd.onload = () => {
      try {
        importBackup(rd.result);
        toast('备份恢复成功', 'success');
        render();
      } catch (err) { toast(err.message || '备份文件无法解析', 'error'); }
    };
    rd.readAsText(f, 'utf-8');
  });
  el.querySelector('[data-demo]').addEventListener('click', async () => {
    if (DB.products.length || DB.orders.length) {
      const ok = await confirmBox('载入示例数据将<b>覆盖</b>当前的商品、订单和流水，确定继续？', { danger: true, okText: '覆盖载入' });
      if (!ok) return;
    }
    loadDemoData();
    toast('已载入示例数据', 'success');
    render();
  });
  el.querySelector('[data-wipe]').addEventListener('click', async () => {
    const ok = await confirmBox('将<b>永久删除</b>全部商品、订单、流水和设置！<br><span class="muted small">强烈建议先导出备份。此操作不可恢复。</span>', { danger: true, okText: '我已了解，清空' });
    if (!ok) return;
    const ok2 = await confirmBox('最后确认：真的要清空全部数据吗？', { danger: true, okText: '清空' });
    if (!ok2) return;
    localStorage.removeItem(DB_KEY);
    DB = loadDB();
    toast('数据已清空');
    render();
  });
}
