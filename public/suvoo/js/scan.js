/* ============================================================
   SUVOO 进销存 — 物流分拣台
   场景：多家物流公司揽收时，选定「当前交接给」的物流公司，
   逐件扫包裹面单核对归属——A 物流的包裹绝不交给 B/C（串包报警）。
   纯核对，不改订单状态；交接记录可导出 Excel。
   ============================================================ */

/* ---------- 提示音（全站共用） ---------- */
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

const sortState = {
  carrier: '',   // 当前交接给哪家物流
  session: [],   // {at, code, orderId, oc(所属物流), sel(交接给), result:'ok'|'wrong'|'err'|'dup'|'nocarrier'}
  last: null
};

function knownCarriers() {
  return [...new Set(DB.orders.map(o => (o.carrier || '').trim()).filter(Boolean))];
}

function focusSort() {
  const i = document.getElementById('sortInput');
  if (i) { i.value = ''; i.focus(); }
}

function handleSortScan(code) {
  code = String(code || '').trim();
  if (!code) return;
  if (!sortState.carrier) {
    sortState.last = { res: 'nosel', code };
    playBeep('dup');
    render(); focusSort();
    return;
  }
  const o = orderByCode(code);
  let res, oc = '';
  if (!o) {
    res = 'err';
  } else {
    oc = (o.carrier || '').trim();
    const dupInSession = sortState.session.some(x => x.orderId === o.id && x.result === 'ok');
    if (dupInSession) res = 'dup';
    else if (!oc) res = 'nocarrier';
    else if (normCode(oc) === normCode(sortState.carrier)) res = 'ok';
    else res = 'wrong';
  }
  // 归属正确 → 把交接时间和交给的物流公司持久化记到订单（随云同步保存）
  if (res === 'ok' && o) {
    o.sortedAt = Date.now();
    o.sortedCarrier = sortState.carrier;
    save();
  }
  playBeep(res === 'ok' ? 'ok' : (res === 'dup' || res === 'nocarrier') ? 'dup' : 'err');
  sortState.session.unshift({ at: Date.now(), code, orderId: o ? o.id : null, oc, sel: sortState.carrier, result: res });
  if (sortState.session.length > 800) sortState.session.length = 800;
  sortState.last = { res, code, orderId: o ? o.id : null, oc };
  render();
  focusSort();
}

function sortResultHTML() {
  const L = sortState.last;
  if (!L) return `<div class="scan-result"><div class="res-idle">${icon('truck', 32)}<span>等待扫描包裹面单…</span></div></div>`;
  const o = L.orderId ? DB.orders.find(x => x.id === L.orderId) : null;
  const trackLine = `<div class="res-meta"><span>运单 <b class="mono">${esc(o ? (o.trackingNo || L.code) : L.code)}</b></span>
    ${o ? `<span>${channelBadge(o.channel)}</span>` : ''}</div>`;
  if (L.res === 'nosel') {
    return `<div class="scan-result res-dup">
      <div class="res-head">${icon('alert', 22)}请先选择当前交接的物流公司</div></div>`;
  }
  if (L.res === 'ok') {
    return `<div class="scan-result res-ok">
      <div class="res-head">${icon('check', 22)}归属正确，可交接</div>
      <div style="font-size:34px;font-weight:800;color:#047857;margin:6px 0 10px">${esc(L.oc)} ✓</div>
      ${trackLine}
      ${o && o.status === 'pending' ? `<p class="small" style="color:var(--warn)"><b>注意：该订单尚未打包出库</b></p>` : ''}
    </div>`;
  }
  if (L.res === 'wrong') {
    return `<div class="scan-result res-err">
      <div class="res-head">${icon('x', 22)}${esc(t('串包警报！不要交给 {sel}', { sel: sortState.carrier }))}</div>
      <div style="font-size:34px;font-weight:800;color:#B91C1C;margin:6px 0 10px">${esc(t('{oc} 的包裹', { oc: L.oc }))}</div>
      <p class="small dim">${esc(t('该包裹属于【{oc}】，请取出放回对应区域。', { oc: L.oc }))}</p>
      ${trackLine}
    </div>`;
  }
  if (L.res === 'dup') {
    return `<div class="scan-result res-dup">
      <div class="res-head">${icon('alert', 22)}该包裹本次已扫过</div>
      ${trackLine}
    </div>`;
  }
  if (L.res === 'nocarrier') {
    return `<div class="scan-result res-dup">
      <div class="res-head">${icon('alert', 22)}该订单未指定物流公司</div>
      <p class="small dim">导入订单时映射「物流公司」列，或在订单编辑中补填。</p>
      ${trackLine}
    </div>`;
  }
  return `<div class="scan-result res-err">
    <div class="res-head">${icon('x', 22)}未找到该单号</div>
    <div class="res-meta"><span>扫描内容：<b class="mono">${esc(L.code)}</b></span></div>
  </div>`;
}

const SORT_RESULT_LABEL = {
  ok: '<span class="scan-log-result sl-ok">✓ 正确</span>',
  wrong: '<span class="scan-log-result sl-err">串包</span>',
  err: '<span class="scan-log-result sl-err">未找到</span>',
  dup: '<span class="scan-log-result sl-dup">重复</span>',
  nocarrier: '<span class="scan-log-result sl-dup">未指定</span>'
};

/* ---------- 交接记录导出 ---------- */
function exportSortXLSX() {
  const rows = [['时间', '运单号', '所属物流', '交接给', '结果'],
    ...sortState.session.slice().reverse().map(x => [fmtFull(x.at), x.code, x.oc || '',
      x.sel, { ok: '正确', wrong: '串包', err: '未找到', dup: '重复', nocarrier: '未指定物流' }[x.result] || x.result])];
  exportXLSX(`物流交接_${dayKey(Date.now())}.xlsx`, [{ name: '交接记录', rows }]);
}

function renderSort(el) {
  const carriers = knownCarriers();
  const s = sortState.session;
  const cnt = {
    ok: s.filter(x => x.result === 'ok').length,
    wrong: s.filter(x => x.result === 'wrong').length,
    err: s.filter(x => x.result === 'err' || x.result === 'nocarrier').length
  };

  el.innerHTML = pageHead('物流分拣台', '选定交接的物流公司，逐件扫包裹面单核对归属，防止串包',
    s.length ? `<button class="btn" data-so-xlsx>${icon('download', 15)}导出交接 Excel</button>` : '') + `
    <div class="scan-chips mb-14">
      <span class="chip c-green">正确 <b>${cnt.ok}</b></span>
      <span class="chip c-red">串包 <b>${cnt.wrong}</b></span>
      <span class="chip c-amber">异常 <b>${cnt.err}</b></span>
      <label class="checkbox-line" style="margin-left:auto"><input type="checkbox" data-so-beep ${DB.settings.beep ? 'checked' : ''}>提示音</label>
    </div>
    <div class="scan-grid">
      <div>
        <div class="card">
          <div class="card-title">${icon('truck', 16)}当前交接给</div>
          ${carriers.length ? `<div class="flex mb-14" style="flex-wrap:wrap">
            ${carriers.map(c => `<button class="btn ${sortState.carrier === c ? 'btn-accent' : ''}" data-so-carrier="${esc(c)}">${esc(c)}</button>`).join('')}
          </div>` : `<p class="small dim mb-14">订单数据里还没有物流公司，导入订单时请映射「物流公司」列。</p>`}
          <div class="scan-input-wrap">${icon('scan', 22)}
            <input id="sortInput" class="scan-input" placeholder="扫描包裹面单运单号" autocomplete="off" spellcheck="false" ${sortState.carrier ? '' : 'disabled'}></div>
          <p class="small muted mt-8">扫码自动确认（无需回车） · 归属正确绿灯放行，串包红灯报警</p>
          ${sortResultHTML()}
        </div>
      </div>
      <div class="card">
        <div class="card-title">${icon('history', 16)}本次交接记录<span class="spacer"></span>
          ${s.length ? `<button class="btn btn-sm btn-ghost" data-so-clear>清空</button>` : ''}</div>
        ${s.length ? `<div class="tbl-wrap"><table class="tbl"><thead>
          <tr><th>时间</th><th>运单号</th><th>所属物流</th><th>结果</th></tr></thead><tbody>
          ${s.slice(0, 50).map(x => `<tr>
            <td class="muted small">${fmtDT(x.at).slice(6)}</td>
            <td class="mono">${esc(x.code)}</td>
            <td>${esc(x.oc || '—')}</td>
            <td>${SORT_RESULT_LABEL[x.result] || esc(x.result)}</td></tr>`).join('')}
        </tbody></table></div>` : `<p class="muted small" style="padding:12px 0">先在左侧选择物流公司，然后逐件扫包裹面单即可。</p>`}
      </div>
    </div>`;

  el.querySelectorAll('[data-so-carrier]').forEach(b => b.addEventListener('click', () => {
    sortState.carrier = b.dataset.soCarrier;
    sortState.last = null;
    render();
    focusSort();
  }));

  const input = el.querySelector('#sortInput');
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); handleSortScan(input.value); }
  });
  attachAutoScan(input, code => handleSortScan(code));
  if (sortState.carrier) setTimeout(() => input.focus(), 30);

  el.querySelector('[data-so-beep]').addEventListener('change', e => { DB.settings.beep = e.target.checked; save(); });
  el.querySelector('[data-so-clear]')?.addEventListener('click', () => {
    sortState.session = [];
    sortState.last = null;
    render();
  });
  el.querySelector('[data-so-xlsx]')?.addEventListener('click', exportSortXLSX);

  function sortFocusGuard(e) {
    if (document.querySelector('#modalRoot .modal-overlay')) return;
    if (e.target.closest('input, textarea, select, button, a, label, .picker-list')) return;
    setTimeout(focusSort, 0);
  }
  document.addEventListener('mousedown', sortFocusGuard);
  window._pageCleanup = () => document.removeEventListener('mousedown', sortFocusGuard);
}
