/* ============================================================
   SUVOO 进销存 — 扫码打包台
   单输入框自动分流：空闲时扫面单开包裹，进行中扫商品条码装箱。
   智能混合：单件订单扫面单直接出库；多件订单逐件核对防装错。
   进度存于订单 packing 字段 → 随订单行级同步上云，可换设备接力。
   ============================================================ */

const packState = {
  currentOrderId: null,
  session: [],  // {at, code, result, orderId}  result: fast|done|force|wrong|unknown|dupw|undone
  event: null,  // {kind:'ok'|'warn'|'err'|'info', msg}  最近一次扫描反馈
  dims: { l: '', w: '', h: '', kg: '' } // 包裹长宽厚重（选填），出库时附到订单
};

// 出库时把选填的尺寸/重量附到订单（随订单行同步上云），然后清空输入
function attachParcel(o) {
  const d = packState.dims;
  const n = v => { const x = parseFloat(v); return isFinite(x) && x > 0 ? x : ''; };
  const p = { l: n(d.l), w: n(d.w), h: n(d.h), kg: n(d.kg) };
  if (p.l !== '' || p.w !== '' || p.h !== '' || p.kg !== '') o.parcel = p;
  packState.dims = { l: '', w: '', h: '', kg: '' };
}

function packCurrent() {
  return packState.currentOrderId
    ? DB.orders.find(o => o.id === packState.currentOrderId) || null
    : null;
}
function packEvt(kind, msg) { packState.event = { kind, msg }; }
function packLog(code, result, orderId = null) {
  packState.session.unshift({ at: Date.now(), code, result, orderId });
  if (packState.session.length > 500) packState.session.length = 500;
}
function focusPack() {
  const i = document.getElementById('packInput');
  if (i) { i.value = ''; i.focus(); }
}

/* ---------- 扫描分流 ---------- */
function handlePackScan(code) {
  code = String(code || '').trim();
  if (!code) return;
  const cur = packCurrent();
  if (!cur) handlePackWaybill(code);
  else handlePackItem(cur, code);
  render();
  focusPack();
}

// 空闲状态：这一枪是面单
function handlePackWaybill(code) {
  const o = orderByCode(code);
  if (!o) {
    packEvt('err', t('未找到该单号：{code}（订单可能未导入）', {code}));
    packLog(code, 'unknown');
    playBeep('err');
    return;
  }
  if (o.status === 'verified') {
    packEvt('warn', t('该单已于 {time} 出库，请勿重复发货！', {time: fmtDT(o.verifiedAt)}));
    packLog(code, 'dupw', o.id);
    playBeep('dup');
    return;
  }
  const req = packRequired(o);
  const total = req.reduce((s, l) => s + l.qty, 0);
  // 智能混合：单件订单（或无明细订单）扫面单直接出库
  if (!req.length || (total <= 1 && DB.settings.packSingleFast !== false)) {
    attachParcel(o);
    verifyOrder(o);
    packEvt('ok', t('单件订单，已直接完成出库：{no}', {no: o.trackingNo || o.orderNo}));
    packLog(code, 'fast', o.id);
    playBeep('ok');
    return;
  }
  const resume = !!o.packing;
  if (!o.packing) {
    o.packing = { startedAt: Date.now(), packed: {}, updatedAt: Date.now() };
    save();
  }
  packState.currentOrderId = o.id;
  const tot = packTotals(o);
  packEvt('info', resume
    ? t('继续打包（此前已装 {done}/{total} 件），请扫商品条码', {done: tot.done, total: tot.total})
    : t('开始打包，共 {total} 件，请逐件扫商品条码装箱', {total: tot.total}));
  playBeep('tick');
}

// 打包中：这一枪是商品条码
function handlePackItem(cur, code) {
  const c = normCode(code);
  // 重复扫了当前面单
  if (c === normCode(cur.trackingNo) || c === normCode(cur.orderNo)) {
    packEvt('info', t('当前包裹正在打包中，请扫商品条码'));
    playBeep('tick');
    return;
  }
  const req = packRequired(cur);
  // 匹配应装清单：明细 key 直配，或经商品库 SKU/条码转换
  let line = req.find(l => l.key === c);
  let known = null;
  if (!line) {
    known = productByCode(code);
    if (known) {
      const ks = normCode(known.sku), kb = normCode(known.barcode);
      line = req.find(l => l.key === ks || (kb && l.key === kb));
    }
  }
  if (line) {
    const done = packedCount(cur, line.key);
    if (done >= line.qty) {
      packEvt('warn', t('【{name}】已装满 {qty} 件，请勿多装！', {name: line.name, qty: line.qty}));
      playBeep('dup');
      return;
    }
    cur.packing.packed[line.key] = done + 1;
    cur.packing.updatedAt = Date.now();
    if (packIsComplete(cur)) {
      completePack(cur, false);
    } else {
      save();
      packEvt('ok', t('已装 {name}（{n}/{qty}）', {name: line.name, n: done + 1, qty: line.qty}));
      playBeep('tick');
    }
    return;
  }
  if (known) {
    packEvt('err', t('装错了！【{name}】不在本单，请取出', {name: known.name}));
    packLog(code, 'wrong', cur.id);
    playBeep('err');
    return;
  }
  // 是不是误扫了另一张面单？
  const other = orderByCode(code);
  if (other) {
    packEvt('warn', t('这是另一张面单。请先完成或暂停当前包裹，再扫新面单'));
    playBeep('err');
    return;
  }
  packEvt('err', t('未知条码：{code}（不在本单，也不在商品库）', {code}));
  packLog(code, 'unknown', cur.id);
  playBeep('err');
}

function completePack(o, forced) {
  attachParcel(o);
  verifyOrder(o); // 内部会清除 packing 并扣库存
  packState.currentOrderId = null;
  packLog(o.trackingNo || o.orderNo || '', forced ? 'force' : 'done', o.id);
  packEvt('ok', t(forced ? '打包完成，已出库：{no}（缺件强制完成）' : '打包完成，已出库：{no}', {no: o.trackingNo || o.orderNo}));
  playBeep('ok');
}

/* ---------- Excel 导出 ---------- */
function exportPackXLSX() {
  const verified = DB.orders.filter(o => o.status === 'verified')
    .sort((a, b) => (b.verifiedAt || 0) - (a.verifiedAt || 0));
  const pending = DB.orders.filter(o => o.status === 'pending')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const pv = (o, k) => (o.parcel && o.parcel[k] !== '' && o.parcel[k] != null) ? o.parcel[k] : '';
  exportXLSX(`打包数据_${dayKey(Date.now())}.xlsx`, [
    {
      name: '打包出库',
      rows: [['出库时间', '渠道', '订单号', '运单号', '收件人', '商品明细', '件数', '长(cm)', '宽(cm)', '厚(cm)', '重量(kg)', '备注'],
        ...verified.map(o => [fmtFull(o.verifiedAt), o.channel || '', o.orderNo || '', o.trackingNo || '',
          o.receiver || '', orderItemsSummary(o), orderPieces(o),
          pv(o, 'l'), pv(o, 'w'), pv(o, 'h'), pv(o, 'kg'), o.note || ''])]
    },
    {
      name: '待打包',
      rows: [['创建时间', '渠道', '订单号', '运单号', '收件人', '商品明细', '件数', '打包进度', '备注'],
        ...pending.map(o => {
          const tot = packTotals(o);
          return [fmtFull(o.createdAt), o.channel || '', o.orderNo || '', o.trackingNo || '',
            o.receiver || '', orderItemsSummary(o), tot.total,
            o.packing ? `打包中 ${tot.done}/${tot.total}` : (tot.total <= 1 ? '单件直发' : '待打包'), o.note || ''];
        })]
    }
  ]);
}

/* ---------- 页面 ---------- */
function packEventHTML() {
  const e = packState.event;
  if (!e) return '';
  const ic = { ok: 'check', warn: 'alert', err: 'x', info: 'info' }[e.kind];
  return `<div class="pk-event ${e.kind}">${icon(ic, 16)}<span>${esc(e.msg)}</span></div>`;
}

function packChecklistHTML(o) {
  const req = packRequired(o);
  const tot = packTotals(o);
  return `
    <div class="pk-head">
      ${channelBadge(o.channel)}
      <span class="pk-track">${esc(o.trackingNo || o.orderNo || '')}</span>
      ${o.receiver ? `<span class="dim small"><span>收件</span> ${esc(o.receiver)}</span>` : ''}
      ${o.note ? `<span class="muted small"><span>备注：</span>${esc(o.note)}</span>` : ''}
    </div>
    <div class="pk-list">
      ${req.map(l => {
        const done = packedCount(o, l.key);
        const full = done >= l.qty;
        const p = productByCode(l.sku);
        return `<div class="pk-row ${full ? 'full' : ''}">
          <div class="pk-name"><b>${esc(l.name)}</b>
            <span class="mono muted">${esc(l.sku)}${p && p.barcode ? ' · ' + esc(p.barcode) : ''}</span></div>
          <div class="pk-bar"><i style="width:${Math.min(100, done / l.qty * 100)}%"></i></div>
          <div class="pk-qty">${done}/${l.qty}</div>
          <div class="row-actions">
            <button class="btn btn-sm btn-ghost" data-pk-minus="${esc(l.key)}" title="误扫回退" ${done ? '' : 'disabled'}>−1</button>
            <button class="btn btn-sm" data-pk-plus="${esc(l.key)}" title="无条码商品手动装箱" ${full ? 'disabled' : ''}>+1</button>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="pk-total">
      <b>${tot.done} / ${tot.total} 件</b>
      <div class="pk-bar"><i style="width:${tot.total ? Math.min(100, tot.done / tot.total * 100) : 0}%"></i></div>
    </div>
    <div class="flex" style="flex-wrap:wrap">
      <button class="btn btn-accent" data-pk-finish>${icon('check', 15)}完成打包出库</button>
      <button class="btn" data-pk-pause>${icon('undo', 15)}暂停 / 换单</button>
      <button class="btn btn-ghost" data-pk-reset>清除进度</button>
    </div>`;
}

const PACK_RESULT_LABEL = {
  fast: '<span class="scan-log-result sl-ok">✓ 单件直发</span>',
  done: '<span class="scan-log-result sl-ok">✓ 完成</span>',
  force: '<span class="scan-log-result sl-dup">强制完成</span>',
  wrong: '<span class="scan-log-result sl-err">装错商品</span>',
  unknown: '<span class="scan-log-result sl-err">未知码</span>',
  dupw: '<span class="scan-log-result sl-dup">已出库</span>',
  undone: '<span class="muted">已撤销</span>'
};

function renderPack(el) {
  const cur = packCurrent();
  const pending = DB.orders.filter(o => o.status === 'pending');
  const queue = pending
    .slice()
    .sort((a, b) => (b.packing ? 1 : 0) - (a.packing ? 1 : 0) || (b.createdAt || 0) - (a.createdAt || 0));
  const s = packState.session;
  const doneCnt = s.filter(x => x.result === 'fast' || x.result === 'done' || x.result === 'force').length;
  const errCnt = s.filter(x => x.result === 'wrong' || x.result === 'unknown').length;

  const d = packState.dims;
  el.innerHTML = pageHead('扫码打包台', '扫面单开包裹 → 逐件扫商品装箱 → 装齐自动出库；单件订单扫面单直发',
    `<button class="btn" data-pk-xlsx>${icon('download', 15)}导出打包 Excel</button>`) + `
    <div class="scan-chips mb-14">
      <span class="chip">待打包 <b>${pending.length}</b> 单</span>
      <span class="chip c-green">本次完成 <b>${doneCnt}</b></span>
      <span class="chip c-red">异常 <b>${errCnt}</b></span>
      ${cur ? `<span class="chip c-amber">进行中 <b class="mono">${esc(cur.trackingNo || cur.orderNo || '')}</b></span>` : ''}
      <label class="checkbox-line" style="margin-left:auto"><input type="checkbox" data-pk-beep ${DB.settings.beep ? 'checked' : ''}>提示音</label>
    </div>
    <div class="scan-grid">
      <div>
        <div class="card">
          <div class="scan-input-wrap">${icon(cur ? 'barcode' : 'pack', 22)}
            <input id="packInput" class="scan-input" placeholder="${cur ? '扫商品条码装箱…' : '扫描面单开始打包'}" autocomplete="off" spellcheck="false"></div>
          <p class="small muted mt-8">${cur
            ? '逐件扫商品条码 / SKU · 无条码商品点行内 +1 · 装齐自动完成出库'
            : '扫运单号或订单号 · 单件订单直接出库 · 多件订单进入装箱核对'}</p>
          <div class="pk-dims">
            <span class="small dim">包裹尺寸/重量<span class="muted">（选填，出库时记入订单）</span></span>
            <input class="input" type="number" min="0" step="0.1" data-dim="l" placeholder="长 cm" value="${esc(d.l)}">
            <span class="muted">×</span>
            <input class="input" type="number" min="0" step="0.1" data-dim="w" placeholder="宽 cm" value="${esc(d.w)}">
            <span class="muted">×</span>
            <input class="input" type="number" min="0" step="0.1" data-dim="h" placeholder="厚 cm" value="${esc(d.h)}">
            <input class="input" type="number" min="0" step="0.01" data-dim="kg" placeholder="重 kg" value="${esc(d.kg)}">
          </div>
          ${packEventHTML()}
          ${cur ? packChecklistHTML(cur) : `<div class="scan-result"><div class="res-idle">${icon('pack', 32)}<span>等待扫描面单…</span></div></div>`}
        </div>
        <div class="card mt-14">
          <div class="card-title">${icon('orders', 16)}打包队列<span class="spacer"></span>
            <button class="btn btn-sm btn-ghost" onclick="location.hash='#/orders'">全部订单</button></div>
          ${queue.length ? `<div class="tbl-wrap"><table class="tbl"><thead>
            <tr><th>渠道</th><th>运单号</th><th>商品</th><th class="num">件数</th><th>进度</th></tr></thead><tbody>
            ${queue.slice(0, 8).map(o => {
              const tot = packTotals(o);
              return `<tr data-pk-open="${o.id}" style="cursor:pointer" title="点击开始/继续打包">
                <td>${channelBadge(o.channel)}</td>
                <td class="mono">${esc(o.trackingNo || o.orderNo || '')}</td>
                <td class="ellip">${esc(orderItemsSummary(o))}</td>
                <td class="num">${tot.total}</td>
                <td>${o.packing ? `<span class="badge b-blue">打包中 ${tot.done}/${tot.total}</span>`
                  : tot.total <= 1 ? '<span class="badge b-gray">单件直发</span>'
                  : '<span class="badge b-amber">待打包</span>'}</td></tr>`;
            }).join('')}
          </tbody></table></div>
          ${queue.length > 8 ? `<p class="small muted mt-8">仅显示前 8 单，共 ${queue.length} 单待打包</p>` : ''}`
          : `<p class="muted small">全部订单已打包完毕 ✓</p>`}
        </div>
      </div>
      <div class="card">
        <div class="card-title">${icon('history', 16)}本次打包记录<span class="spacer"></span>
          ${s.length ? `<button class="btn btn-sm btn-ghost" data-pk-clear>清空</button>` : ''}</div>
        ${s.length ? `<div class="tbl-wrap"><table class="tbl"><thead>
          <tr><th>时间</th><th>单号 / 条码</th><th>结果</th><th></th></tr></thead><tbody>
          ${s.slice(0, 50).map((x, i) => `<tr>
            <td class="muted small">${fmtDT(x.at).slice(6)}</td>
            <td class="mono">${esc(x.code)}</td>
            <td>${PACK_RESULT_LABEL[x.result] || esc(x.result)}</td>
            <td style="text-align:right">${(x.result === 'done' || x.result === 'fast' || x.result === 'force')
              ? `<button class="btn btn-sm btn-ghost" data-pk-undo="${i}" title="撤销出库">${icon('undo', 13)}</button>` : ''}</td>
          </tr>`).join('')}
        </tbody></table></div>` : `<p class="muted small" style="padding:12px 0">还没有记录。把光标放在左侧输入框，扫面单即可开始。</p>`}
      </div>
    </div>`;

  const input = el.querySelector('#packInput');
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); handlePackScan(input.value); }
  });
  setTimeout(() => input.focus(), 30);

  el.querySelector('[data-pk-beep]').addEventListener('change', e => {
    DB.settings.beep = e.target.checked;
    save();
  });
  // 尺寸/重量输入（存内存，出库时附单）
  el.querySelectorAll('[data-dim]').forEach(inp => inp.addEventListener('input', () => {
    packState.dims[inp.dataset.dim] = inp.value;
  }));
  el.querySelector('[data-pk-xlsx]').addEventListener('click', exportPackXLSX);
  el.querySelector('[data-pk-clear]')?.addEventListener('click', () => {
    packState.session = [];
    packState.event = null;
    render();
  });

  // 行内 +1 / −1（无条码兜底、误扫回退）
  el.querySelectorAll('[data-pk-plus]').forEach(b => b.addEventListener('click', () => {
    const o = packCurrent();
    if (!o) return;
    const key = b.dataset.pkPlus;
    const line = packRequired(o).find(l => l.key === key);
    if (!line) return;
    const done = packedCount(o, key);
    if (done >= line.qty) return;
    o.packing.packed[key] = done + 1;
    o.packing.updatedAt = Date.now();
    if (packIsComplete(o)) completePack(o, false);
    else { save(); packEvt('ok', t('已装 {name}（{n}/{qty}）', {name: line.name, n: done + 1, qty: line.qty})); playBeep('tick'); }
    render(); focusPack();
  }));
  el.querySelectorAll('[data-pk-minus]').forEach(b => b.addEventListener('click', () => {
    const o = packCurrent();
    if (!o) return;
    const key = b.dataset.pkMinus;
    const done = packedCount(o, key);
    if (done > 0) {
      o.packing.packed[key] = done - 1;
      o.packing.updatedAt = Date.now();
      save();
      packEvt('info', t('已回退 1 件'));
    }
    render(); focusPack();
  }));

  // 完成 / 暂停 / 清除
  el.querySelector('[data-pk-finish]')?.addEventListener('click', async () => {
    const o = packCurrent();
    if (!o) return;
    if (packIsComplete(o)) { completePack(o, false); render(); focusPack(); return; }
    const missing = packRequired(o)
      .filter(l => packedCount(o, l.key) < l.qty)
      .map(l => `${esc(l.name)} 还缺 ${l.qty - packedCount(o, l.key)} 件`);
    const ok = await confirmBox(
      `包裹还没装齐：<br><b>${missing.join('<br>')}</b><br><span class="muted small">强制完成会按订单全量出库扣减库存。</span>`,
      { danger: true, okText: '缺件强制完成' });
    if (ok) { completePack(o, true); render(); }
    focusPack();
  });
  el.querySelector('[data-pk-pause]')?.addEventListener('click', () => {
    packState.currentOrderId = null;
    packEvt('info', t('已暂停，进度已保存（云同步后其他设备可继续）'));
    render(); focusPack();
  });
  el.querySelector('[data-pk-reset]')?.addEventListener('click', async () => {
    const o = packCurrent();
    if (!o) return;
    const ok = await confirmBox('清除本单的装箱进度并退出？', { danger: true, okText: '清除' });
    if (ok) {
      delete o.packing;
      save();
      packState.currentOrderId = null;
      packEvt('info', t('已清除进度'));
      render();
    }
    focusPack();
  });

  // 点击队列行开始 / 继续打包（面单破损时用）
  el.querySelectorAll('[data-pk-open]').forEach(tr => tr.addEventListener('click', () => {
    const o = DB.orders.find(x => x.id === tr.dataset.pkOpen);
    if (!o) return;
    const c = packCurrent();
    if (c && c.id !== o.id) { toast('请先完成或暂停当前包裹', 'warn'); return; }
    handlePackWaybill(o.trackingNo || o.orderNo || '');
    render(); focusPack();
  }));

  // 撤销出库
  el.querySelectorAll('[data-pk-undo]').forEach(b => b.addEventListener('click', () => {
    const entry = packState.session[Number(b.dataset.pkUndo)];
    const o = entry && DB.orders.find(x => x.id === entry.orderId);
    if (!o || o.status !== 'verified') { toast('该订单已不可撤销', 'warn'); return; }
    unverifyOrder(o);
    entry.result = 'undone';
    toast('已撤销出库，库存已回补');
    render(); focusPack();
  }));

  // 点击空白自动回焦
  function packFocusGuard(e) {
    if (document.querySelector('#modalRoot .modal-overlay')) return;
    if (e.target.closest('input, textarea, select, button, a, label, .picker-list, [data-pk-open]')) return;
    setTimeout(focusPack, 0);
  }
  document.addEventListener('mousedown', packFocusGuard);
  window._pageCleanup = () => document.removeEventListener('mousedown', packFocusGuard);
}
