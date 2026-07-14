/* ============================================================
   SUVOO 进销存 — 扫描核对台
   ============================================================ */

/* ---------- 提示音 ---------- */
let _actx = null;
function playBeep(kind) {
  if (!DB.settings.beep) return;
  try {
    _actx = _actx || new (window.AudioContext || window.webkitAudioContext)();
    if (_actx.state === 'suspended') _actx.resume();
    const seq = kind === 'ok' ? [[1175, 90]]
      : kind === 'tick' ? [[1568, 50]]
      : kind === 'dup' ? [[660, 90], [660, 90]]
      : [[220, 340]];
    let t = _actx.currentTime + 0.01;
    for (const [f, d] of seq) {
      const o = _actx.createOscillator(), g = _actx.createGain();
      o.type = 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + d / 1000);
      o.connect(g); g.connect(_actx.destination);
      o.start(t); o.stop(t + d / 1000 + 0.02);
      t += d / 1000 + 0.06;
    }
  } catch (e) { /* 无音频环境时忽略 */ }
}

const scanState = {
  session: [], // {at, code, result:'ok'|'dup'|'err'|'undone', orderId}
  last: null   // {res, code, orderId, at}
};

function focusScan() {
  const i = document.getElementById('scanInput');
  if (i) { i.value = ''; i.focus(); }
}

function handleScan(code) {
  code = String(code || '').trim();
  if (!code) return;
  const o = orderByCode(code);
  let res;
  if (o && o.status === 'pending') { verifyOrder(o); res = 'ok'; }
  else if (o) res = 'dup';
  else res = 'err';
  playBeep(res);
  scanState.session.unshift({ at: Date.now(), code, result: res, orderId: o ? o.id : null });
  if (scanState.session.length > 500) scanState.session.length = 500;
  scanState.last = { res, code, orderId: o ? o.id : null, at: Date.now() };
  render();
  focusScan();
}

function scanItemsHTML(o) {
  const items = o.items || [];
  if (!items.length) return '<div class="res-items"><span class="muted small">该订单无商品明细（不扣库存）</span></div>';
  return `<div class="res-items">${items.map(i => {
    const p = productByCode(i.sku);
    return `<div class="ri">
      <span>${esc(i.name || i.sku)} <span class="mono muted">${esc(i.sku || '')}</span>
        ${!p ? '<span class="badge b-red">未匹配商品库</span>' : ''}</span>
      <span>×<b>${i.qty}</b>${p ? ` <span class="muted small">现库存 ${Number(p.stock)}</span>` : ''}</span>
    </div>`;
  }).join('')}</div>`;
}

function scanResultHTML() {
  const L = scanState.last;
  if (!L) return `<div class="res-idle">${icon('scan', 32)}<span>等待扫描…</span></div>`;
  const o = L.orderId ? DB.orders.find(x => x.id === L.orderId) : null;
  if (L.res === 'ok' && o) {
    return `
      <div class="res-head">${icon('check', 22)}核对成功，已出库</div>
      <div class="res-meta">
        <span>${channelBadge(o.channel)}</span>
        ${o.orderNo ? `<span>订单 <b class="mono">${esc(o.orderNo)}</b></span>` : ''}
        <span>运单 <b class="mono">${esc(o.trackingNo || L.code)}</b></span>
        ${o.receiver ? `<span>收件 <b>${esc(o.receiver)}</b></span>` : ''}
      </div>
      ${scanItemsHTML(o)}
      <div class="res-actions"><button class="btn btn-sm" data-undo>${icon('undo', 13)}撤销本次核对</button></div>`;
  }
  if (L.res === 'dup' && o) {
    return `
      <div class="res-head">${icon('alert', 22)}重复扫描！</div>
      <div class="res-meta">
        <span>该单已于 <b>${fmtDT(o.verifiedAt)}</b> 核对过，请检查是否重复打单</span>
      </div>
      <div class="res-meta">
        <span>${channelBadge(o.channel)}</span>
        ${o.orderNo ? `<span>订单 <b class="mono">${esc(o.orderNo)}</b></span>` : ''}
        <span>运单 <b class="mono">${esc(o.trackingNo || L.code)}</b></span>
      </div>
      ${scanItemsHTML(o)}`;
  }
  return `
    <div class="res-head">${icon('x', 22)}未找到该单号</div>
    <div class="res-meta"><span>扫描内容：<b class="mono">${esc(L.code)}</b></span></div>
    <p class="small dim">订单列表中没有匹配的运单号或订单号。可能：订单还未导入 / 单号录入有误 / 属于其他渠道。</p>
    <div class="res-actions">
      <button class="btn btn-sm btn-primary" data-register>${icon('plus', 13)}快速登记此订单</button>
      <button class="btn btn-sm btn-ghost" data-ignore>忽略</button>
    </div>`;
}

/* ---------- Excel 导出：面单核对表 ---------- */
function exportVerifyXLSX() {
  const verified = DB.orders.filter(o => o.status === 'verified')
    .sort((a, b) => (b.verifiedAt || 0) - (a.verifiedAt || 0));
  const pending = DB.orders.filter(o => o.status === 'pending')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  exportXLSX(`面单核对_${dayKey(Date.now())}.xlsx`, [
    {
      name: '已核对',
      rows: [['核对时间', '渠道', '订单号', '运单号', '收件人', '商品明细', '件数', '备注'],
        ...verified.map(o => [fmtFull(o.verifiedAt), o.channel || '', o.orderNo || '', o.trackingNo || '',
          o.receiver || '', orderItemsSummary(o), orderPieces(o), o.note || ''])]
    },
    {
      name: '待核对',
      rows: [['创建时间', '渠道', '订单号', '运单号', '收件人', '商品明细', '件数', '备注'],
        ...pending.map(o => [fmtFull(o.createdAt), o.channel || '', o.orderNo || '', o.trackingNo || '',
          o.receiver || '', orderItemsSummary(o), orderPieces(o), o.note || ''])]
    }
  ]);
}

function renderScan(el) {
  const pendingList = DB.orders.filter(o => o.status === 'pending');
  const todayVerified = DB.orders.filter(o => o.status === 'verified' && isToday(o.verifiedAt)).length;
  const s = scanState.session;
  const cnt = {
    ok: s.filter(x => x.result === 'ok').length,
    dup: s.filter(x => x.result === 'dup').length,
    err: s.filter(x => x.result === 'err').length
  };
  const L = scanState.last;
  const resCls = L ? ('res-' + L.res) : '';

  el.innerHTML = pageHead('扫描核对台', '扫描枪对准面单条码，回车自动核对出库',
    `<button class="btn" data-sc-xlsx>${icon('download', 15)}导出核对 Excel</button>`) + `
    <div class="scan-chips mb-14">
      <span class="chip">待核对 <b>${pendingList.length}</b> 单</span>
      <span class="chip c-green">今日已核对 <b>${todayVerified}</b></span>
      <span class="chip c-green">本次成功 <b>${cnt.ok}</b></span>
      <span class="chip c-amber">重复 <b>${cnt.dup}</b></span>
      <span class="chip c-red">异常 <b>${cnt.err}</b></span>
      <label class="checkbox-line" style="margin-left:auto"><input type="checkbox" data-beep ${DB.settings.beep ? 'checked' : ''}>提示音</label>
    </div>
    <div class="scan-grid">
      <div>
        <div class="card">
          <div class="scan-input-wrap">${icon('scan', 22)}
            <input id="scanInput" class="scan-input" placeholder="扫描或输入运单号 / 订单号" autocomplete="off" spellcheck="false"></div>
          <p class="small muted mt-8">支持运单号或订单号 · 扫码自动确认（无需回车） · 手动输入按 <span class="kbd">Enter</span> · 点击页面空白处自动回到输入框</p>
          <div id="scanResult" class="scan-result ${resCls}">${scanResultHTML()}</div>
        </div>
        <div class="card mt-14">
          <div class="card-title">${icon('orders', 16)}待核对列表<span class="spacer"></span>
            <button class="btn btn-sm btn-ghost" onclick="location.hash='#/orders'">全部订单</button></div>
          ${pendingList.length ? `<div class="tbl-wrap"><table class="tbl"><thead>
            <tr><th>渠道</th><th>运单号</th><th>商品</th><th class="num">件数</th></tr></thead><tbody>
            ${pendingList.slice(0, 10).map(o => `<tr>
              <td>${channelBadge(o.channel)}</td>
              <td class="mono">${esc(o.trackingNo || o.orderNo || '')}</td>
              <td class="ellip">${esc(orderItemsSummary(o))}</td>
              <td class="num">${orderPieces(o)}</td></tr>`).join('')}
          </tbody></table></div>
          ${pendingList.length > 10 ? `<p class="small muted mt-8">仅显示前 10 单，共 ${pendingList.length} 单待核对</p>` : ''}`
          : `<p class="muted small">全部订单已核对完毕 ✓</p>`}
        </div>
      </div>
      <div class="card">
        <div class="card-title">${icon('history', 16)}本次扫描记录<span class="spacer"></span>
          ${s.length ? `<button class="btn btn-sm btn-ghost" data-clear-log>清空</button>` : ''}</div>
        ${s.length ? `<div class="tbl-wrap"><table class="tbl"><thead>
          <tr><th>时间</th><th>单号</th><th>结果</th></tr></thead><tbody>
          ${s.slice(0, 50).map(x => {
            const o = x.orderId ? DB.orders.find(y => y.id === x.orderId) : null;
            const lbl = x.result === 'ok' ? '<span class="scan-log-result sl-ok">✓ 核对</span>'
              : x.result === 'dup' ? '<span class="scan-log-result sl-dup">重复</span>'
              : x.result === 'undone' ? '<span class="muted">已撤销</span>'
              : '<span class="scan-log-result sl-err">未找到</span>';
            return `<tr><td class="muted small">${fmtDT(x.at).slice(6)}</td>
              <td class="mono">${esc(x.code)}${o && o.channel ? ` <span class="muted small">${esc(o.channel)}</span>` : ''}</td>
              <td>${lbl}</td></tr>`;
          }).join('')}
        </tbody></table></div>` : `<p class="muted small" style="padding:12px 0">还没有扫描记录。将光标放在左侧输入框，直接用扫描枪扫面单即可。</p>`}
      </div>
    </div>`;

  const input = el.querySelector('#scanInput');
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); handleScan(input.value); }
  });
  attachAutoScan(input, code => handleScan(code));
  setTimeout(() => input.focus(), 30);

  el.querySelector('[data-beep]').addEventListener('change', e => {
    DB.settings.beep = e.target.checked;
    save();
  });
  el.querySelector('[data-sc-xlsx]').addEventListener('click', exportVerifyXLSX);
  el.querySelector('[data-clear-log]')?.addEventListener('click', () => {
    scanState.session = [];
    scanState.last = null;
    render();
  });
  el.querySelector('[data-undo]')?.addEventListener('click', () => {
    const L2 = scanState.last;
    const o = L2 && DB.orders.find(x => x.id === L2.orderId);
    if (o) {
      unverifyOrder(o);
      const entry = scanState.session.find(x => x.orderId === o.id && x.result === 'ok');
      if (entry) entry.result = 'undone';
      scanState.last = null;
      toast('已撤销核对，库存已回补');
      render();
      focusScan();
    }
  });
  el.querySelector('[data-register]')?.addEventListener('click', () => {
    openOrderModal(null, { trackingNo: scanState.last?.code || '' });
  });
  el.querySelector('[data-ignore]')?.addEventListener('click', () => {
    scanState.last = null;
    render();
    focusScan();
  });

  // 点击空白处自动回焦到扫描框（不干扰按钮 / 输入框 / 弹窗）
  function focusGuard(e) {
    if (document.querySelector('#modalRoot .modal-overlay')) return;
    if (e.target.closest('input, textarea, select, button, a, label, .picker-list')) return;
    setTimeout(focusScan, 0);
  }
  document.addEventListener('mousedown', focusGuard);
  window._pageCleanup = () => document.removeEventListener('mousedown', focusGuard);
}
