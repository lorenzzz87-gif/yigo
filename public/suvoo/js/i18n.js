/* ============================================================
   SUVOO 进销存 — 多语言（中文默认 / English / Italiano）
   源语言为中文。译文机制：
   ① translateDOM：渲染后翻译 DOM 里的静态中文（数字归一化为 {}）
   ② t(zh, vars)：动态消息（含商品名/单号）按参数替换
   数据类字符串（商品名、渠道名、规格）不进词典 → 各语言保持原样。
   ============================================================ */
const LANG_KEY = 'suvoo_lang';
const LANGS = [['zh', '中文'], ['en', 'English'], ['it', 'Italiano']];
let LANG = localStorage.getItem(LANG_KEY) || 'zh';

function setLang(l) {
  LANG = l;
  localStorage.setItem(LANG_KEY, l);
  document.documentElement.lang = l;
  const sel = document.getElementById('langSel');
  if (sel) sel.value = l;
  if (typeof render === 'function') render();
}

// 动态字符串翻译（带命名参数 {x}）
function t(zh, vars) {
  let s = (LANG === 'zh') ? zh : ((I18N[LANG] && I18N[LANG][zh]) || zh);
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

const ZH_RE = /[一-鿿]/;
function _translateText(text) {
  const dict = I18N[LANG];
  if (!dict) return null;
  const key = text.trim().replace(/\d[\d.,]*/g, '{}');
  const tpl = dict[key];
  if (tpl === undefined) return null;
  const nums = text.trim().match(/\d[\d.,]*/g) || [];
  let i = 0;
  const body = tpl.replace(/\{\}/g, () => (nums[i++] ?? ''));
  const lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0];
  return lead + body + trail;
}

// 翻译一棵 DOM 子树里的静态中文（文本节点 + placeholder/title/aria-label）
function translateDOM(root) {
  if (LANG === 'zh' || !root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const jobs = []; let n;
  while ((n = w.nextNode())) {
    if (ZH_RE.test(n.textContent)) {
      const r = _translateText(n.textContent);
      if (r !== null) jobs.push([n, r]);
    }
  }
  for (const [node, val] of jobs) node.textContent = val;
  root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => {
    for (const a of ['placeholder', 'title', 'aria-label']) {
      const v = el.getAttribute(a);
      if (v && ZH_RE.test(v)) { const r = _translateText(v); if (r !== null) el.setAttribute(a, r); }
    }
  });
}

/* ============================================================
   词典
   ============================================================ */
const I18N = {
  en: {
    // —— 侧栏 / 导航 ——
    '进销存 · 面单核对': 'Inventory · Waybill Check',
    '概览': 'Overview', '扫码打包': 'Pack & Scan', '扫描核对': 'Reconcile',
    '订单管理': 'Orders', '商品库存': 'Products', '入库': 'Inbound',
    '出入流水': 'Stock Log', '设置': 'Settings',
    '数据保存在本机浏览器': 'Data stored in this browser',
    '请定期在「设置」中导出备份': 'Export backups regularly in Settings',
    '登录云同步或定期在「设置」导出备份': 'Log in to cloud sync, or export backups in Settings',
    '云同步：待登录': 'Cloud sync: not signed in',
    '云同步中…': 'Syncing…', '已同步 {}:{}': 'Synced {}:{}',
    '同步失败，自动重试中': 'Sync failed, retrying', '云同步未启用': 'Cloud sync off',
    '⚠ 建议去「设置」导出备份': '⚠ Consider exporting a backup in Settings',
    // —— 通用按钮 / 词 ——
    '保存': 'Save', '取消': 'Cancel', '确定': 'Confirm', '确认': 'Confirm',
    '删除': 'Delete', '编辑': 'Edit', '调整': 'Adjust', '核对': 'Check',
    '导出 CSV': 'Export CSV', '全部': 'All', '开启': 'On',
    '请确认操作': 'Please confirm', '全部订单': 'All orders', '查看全部': 'View all',
    '全部渠道': 'All channels', '关于': 'About', '数量': 'Qty', '类型': 'Type',
    '时间': 'Time', '名称': 'Name', '规格': 'Spec', '成本': 'Cost', '库存': 'Stock',
    '条码': 'Barcode', '备注': 'Note', '事由': 'Reason', '操作': 'Actions',
    '状态': 'Status', '渠道': 'Channel', '订单号': 'Order No.', '运单号': 'Tracking No.',
    '收件人': 'Recipient', '商品': 'Item', '件数': 'Pcs', '进度': 'Progress',
    '创建': 'Created', '关联单号': 'Ref. No.', '安全库存': 'Safety stock', '安全线': 'Safety',
    '订单数': 'Orders', '核对时间': 'Checked at', '开始日期': 'Start date', '结束日期': 'End date',
    '入': 'In', '出': 'Out', '单': '', '个': '',
    // —— 概览 ——
    '今天是 {}-{}-{}': 'Today is {}-{}-{}', '去扫描核对': 'Go reconcile',
    '待核对订单': 'Pending orders', '今日已核对': 'Checked today',
    '库存预警商品': 'Low-stock items', '在库商品种类': 'Product SKUs',
    '各渠道待发货': 'Pending by channel', '库存预警': 'Low-stock alert',
    '最近动态': 'Recent activity', '全部流水': 'Full log',
    '欢迎使用 SUVOO 进销存 · 面单核对': 'Welcome to SUVOO Inventory · Waybill Check',
    '载入示例数据': 'Load demo data', '载入示例数据体验': 'Load demo data',
    '新增商品': 'Add product', '导入订单': 'Import orders',
    // —— 商品库存 ——
    '共 {} 个商品，{} 个低于安全库存': '{} products · {} below safety stock',
    '导入商品': 'Import products', '搜索 SKU / 条码 / 名称 / 规格': 'Search SKU / barcode / name / spec',
    '仅看库存预警': 'Low-stock only', '调整库存': 'Adjust stock',
    // —— 入库 ——
    '收货时扫商品条码连续入库，或手动单笔录入': 'Scan product barcodes to receive stock, or add one manually',
    '扫码连续入库': 'Continuous scan-in', '扫描商品条码 / 输入 SKU 后回车': 'Scan barcode / type SKU then Enter',
    '同一商品重复扫码自动累加数量': 'Re-scanning the same item adds quantity',
    '尚未扫入商品': 'No items scanned yet', '单笔入库': 'Single entry',
    '商品（输入 SKU / 条码 / 名称搜索）': 'Product (search SKU / barcode / name)',
    '搜索选择商品': 'Search & pick a product', '最近入库记录': 'Recent inbound',
    '采购入库': 'Purchase in', '退货入库': 'Return in', '盘盈': 'Surplus',
    // —— 订单管理 ——
    '导入各渠道订单，扫描面单核对出库': 'Import orders from all channels, scan labels to ship out',
    '导出待核对': 'Export pending', '清理已核对': 'Clear checked', '手动新增': 'Add manually',
    '待核对': 'Pending', '待核对 {}': 'Pending {}', '已核对 {}': 'Checked {}',
    '全部 {}': 'All {}', '搜索订单号 / 运单号 / 收件人 / 商品': 'Search order / tracking / recipient / item',
    '点击展开明细': 'Click to expand', '待核对列表': 'Pending list',
    // —— 扫描核对台 ——
    '扫描核对台': 'Reconcile Station',
    '扫描枪对准面单条码，回车自动核对出库': 'Aim the scanner at the label barcode; Enter ships it out automatically',
    '导出核对 Excel': 'Export check Excel', '本次成功': 'Success', '异常': 'Errors', '重复': 'Duplicate',
    '扫描或输入运单号 / 订单号': 'Scan or type tracking / order number',
    '支持运单号或订单号 · 扫码自动确认（无需回车） · 手动输入按': 'Tracking or order no. · scans auto-confirm (no Enter needed) · or type then press',
    '扫描商品条码（自动确认）/ 输入 SKU 回车': 'Scan barcode (auto-confirm) / type SKU + Enter',
    '未找到商品「{code}」，请先在商品库添加': 'Product "{code}" not found — add it in Products first',
    '· 点击页面空白处自动回到输入框': ' · click any blank area to refocus',
    '等待扫描…': 'Waiting for scan…', '本次扫描记录': 'This session',
    '还没有扫描记录。将光标放在左侧输入框，直接用扫描枪扫面单即可。': 'No scans yet. Put the cursor in the box on the left and scan a label.',
    '核对成功，已出库': 'Matched — shipped out', '重复扫描！': 'Duplicate scan!',
    '未找到该单号': 'Number not found', '订单': 'Order', '运单': 'Tracking', '收件': 'To',
    '扫描内容：': 'Scanned: ', '快速登记此订单': 'Quick-register this order', '忽略': 'Ignore',
    '✓ 核对': '✓ Checked', '未找到': 'Not found',
    // —— 扫码打包台 ——
    '扫码打包台': 'Pack & Scan Station',
    '扫面单开包裹 → 逐件扫商品装箱 → 装齐自动出库；单件订单扫面单直发':
      'Scan label to open a box → scan each item → auto-ship when complete; single-item orders ship on label scan',
    '提示音': 'Sound', '待打包 {} 单': 'To pack: {}', '进行中': 'In progress',
    '导出打包 Excel': 'Export packing Excel', '待打包': 'To pack', '本次完成': 'Done',
    '扫描面单开始打包': 'Scan a label to start packing',
    '扫运单号或订单号 · 单件订单直接出库 · 多件订单进入装箱核对':
      'Scan tracking/order no. · single-item ships directly · multi-item enters pack check',
    '扫描商品条码 / SKU · 无条码商品点行内 +1 · 装齐自动完成出库':
      'Scan product barcode / SKU · tap +1 for no-barcode items · auto-ships when complete',
    '包裹尺寸/重量': 'Package size / weight', '（选填，出库时记入订单）': '(optional, saved on ship-out)',
    '长 cm': 'L cm', '宽 cm': 'W cm', '厚 cm': 'H cm', '重 kg': 'kg',
    '等待扫描面单…': 'Waiting for label scan…', '打包队列': 'Pack queue',
    '本次打包记录': 'This session',
    '还没有记录。把光标放在左侧输入框，扫面单即可开始。': 'No records yet. Put the cursor in the box and scan a label.',
    '完成打包出库': 'Complete & ship', '暂停 / 换单': 'Pause / switch', '清除进度': 'Clear progress',
    '单件直发': 'Direct ship', '打包中 {}/{}': 'Packing {}/{}',
    '✓ 单件直发': '✓ Direct', '✓ 完成': '✓ Done', '强制完成': 'Forced', '装错商品': 'Wrong item',
    '未知码': 'Unknown', '已出库': 'Shipped', '已撤销': 'Undone',
    // —— 打包动态消息 ——
    '收件': 'To', '备注：': 'Note: ',
    '未找到该单号：{code}（订单可能未导入）': 'Number not found: {code} (order may not be imported)',
    '该单已于 {time} 出库，请勿重复发货！': 'Already shipped at {time} — do not re-ship!',
    '单件订单，已直接完成出库：{no}': 'Single-item order shipped: {no}',
    '继续打包（此前已装 {done}/{total} 件），请扫商品条码': 'Resume packing (packed {done}/{total}) — scan product barcodes',
    '开始打包，共 {total} 件，请逐件扫商品条码装箱': 'Start packing, {total} pcs — scan each product barcode',
    '当前包裹正在打包中，请扫商品条码': 'Package in progress — scan product barcodes',
    '【{name}】已装满 {qty} 件，请勿多装！': '{name} already full ({qty}) — do not over-pack!',
    '已装 {name}（{n}/{qty}）': 'Packed {name} ({n}/{qty})',
    '装错了！【{name}】不在本单，请取出': 'Wrong item! {name} is not in this order — remove it',
    '这是另一张面单。请先完成或暂停当前包裹，再扫新面单': 'That is another label. Finish or pause the current package first.',
    '未知条码：{code}（不在本单，也不在商品库）': 'Unknown barcode: {code} (not in order or product list)',
    '打包完成，已出库：{no}（缺件强制完成）': 'Packed & shipped: {no} (forced, items missing)',
    '打包完成，已出库：{no}': 'Packed & shipped: {no}',
    '单件直发 {no} · 请装入：': 'Direct ship {no} — pack this:',
    '已出库 {no} · 包裹内容：': 'Shipped {no} — package contents:',
    '（无商品明细）': '(no item details)',
    '已回退 1 件': 'Removed 1 item', '已暂停，进度已保存（云同步后其他设备可继续）': 'Paused — progress saved (resume on another device after sync)',
    '已清除进度': 'Progress cleared', '请先完成或暂停当前包裹': 'Finish or pause the current package first',
    '该订单已不可撤销': 'This order can no longer be undone', '已撤销出库，库存已回补': 'Shipment undone, stock restored',
    // —— 出入流水 ——
    '每一次库存变动都有据可查': 'Every stock change is traceable',
    '搜索 SKU / 名称 / 单号': 'Search SKU / name / no.', '出库': 'Out', '入库 ': 'In',
    // —— 设置 ——
    '云同步、渠道、偏好与数据备份': 'Cloud sync, channels, preferences & backup',
    '销售渠道': 'Sales channels', '新渠道名，回车添加': 'New channel name, Enter to add',
    '偏好': 'Preferences', '扫描提示音': 'Scan sounds',
    '核对成功 / 重复 / 异常时播放不同提示音': 'Different beeps for success / duplicate / error',
    '核对时自动扣减库存': 'Auto-deduct stock on check',
    '扫描核对订单时按商品明细自动出库；撤销核对自动回补': 'Ships out by item lines when checking; undo restores stock',
    '单件订单扫面单直发': 'Single-item direct ship',
    '扫码打包页：只有 {} 件商品的订单扫面单直接出库，无需再扫商品':
      'Pack page: orders with only {} item ship on label scan, no item scan needed',
    '数据备份': 'Data backup', '导出备份（JSON）': 'Export backup (JSON)',
    '导入备份恢复': 'Restore from backup', '清空全部数据': 'Wipe all data',
    '从未备份': 'never', '云同步（多设备共享）': 'Cloud sync (multi-device)',
    'Supabase 地址': 'Supabase URL', 'anon 公钥': 'anon key',
    '同步服务地址（一般不用改）': 'Sync server URL (rarely changed)',
    '管理员提供的账号': 'Account from your admin',
    '请填写同步服务地址': 'Enter the sync server URL',
    '请填写登录邮箱和密码': 'Enter email and password',
    '登录已过期，请重新登录': 'Session expired — log in again',
    '登录后，商品 / 订单 / 流水在多设备之间自动同步（改动后约 {} 秒推送，每 {} 秒增量拉取；库存按流水汇总计算，多台设备同时扫单不会互相覆盖）。使用管理员提供的账号密码登录即可。':
      'After login, products / orders / logs sync across devices (pushed ~{}s after changes, incremental pull every {}s; stock is computed from the log). Just log in with the account from your admin.',
    '登录邮箱': 'Login email', '密码': 'Password', '在 Supabase 后台创建的账号': 'Account created in Supabase',
    '登录并开始同步': 'Log in & sync', '立即同步': 'Sync now', '退出登录': 'Log out',
    // —— 补充：流水事由 / 标签 / 设置页长句 ——
    '订单核对出库': 'Order check-out', '盘亏': 'Shortage', '损耗报废': 'Damage/scrap',
    '样品赠送': 'Sample/gift', '手动修正': 'Manual fix', '撤销核对回补': 'Undo restock',
    '库存基线校准': 'Stock baseline', '历史流水结转': 'History rollup', '导入覆盖库存': 'Import overwrite',
    '期初库存': 'Opening stock',
    '收件人：': 'Recipient: ', '包裹：': 'Package: ', '上次备份：': 'Last backup: ',
    '（当前库存 {}）': '(stock {})', '点击开始/继续打包': 'Click to start/continue packing',
    '误扫回退': 'Undo mis-scan', '无条码商品手动装箱': 'Pack manually (no barcode)',
    '登录后，商品 / 订单 / 流水在多设备之间自动同步（改动后约 {} 秒推送，每 {} 秒拉取合并；库存按流水汇总计算，多台设备同时扫单不会互相覆盖）。':
      'After login, products / orders / logs sync across devices (pushed ~{}s after changes, merged every {}s; stock is computed from the log, so concurrent scanning never overwrites).',
    '首次使用：': 'First-time setup: ',
    '①在 Supabase SQL 编辑器执行项目根目录的': '① run the project\'s',
    '；②在 Supabase 后台 Authentication → Users 创建登录账号（邮箱需在白名单内）。': ' in the Supabase SQL editor; ② create a login user in Supabase Authentication → Users (email must be whitelisted).',
    '所有数据仅保存在本机浏览器（localStorage）。清除浏览器数据会导致丢失，': 'All data lives in this browser (localStorage). Clearing browser data will lose it — ',
    '请定期导出备份': 'export backups regularly', '。': '.',
    'SUVOO 进销存 · 面单核对 v{} — 轻量级本地进销存工具，适合小团队多渠道电商出库核对。':
      'SUVOO Inventory · Waybill Check v{} — a lightweight local inventory tool for small multi-channel e-commerce teams.',
    '当前数据：{} 个商品 · {} 个订单 · {} 条流水 · 占用 {} KB': 'Current data: {} products · {} orders · {} log entries · {} KB used',
    '扫面单 / 订单号 / 商品条码均可 · 单件直发 · 多件进入装箱核对': 'Scan label / order no. / product barcode · single-item ships directly · multi-item enters pack check',
    '商品【{name}】没有待发订单': 'No pending orders contain {name}',
    '（该商品有 {n} 个待发订单，已按最早优先）': ' ({n} pending orders have this item — oldest first)',
    '扫商品匹配订单 {no}，已直接出库': 'Product matched order {no} — shipped',
    '扫商品打开订单 {no}，已装 {name}（{n}/{qty}）': 'Product opened order {no} — packed {name} ({n}/{qty})',
    '已打开订单 {no}，请扫商品条码装箱': 'Opened order {no} — scan product barcodes to pack',
    '面单打印助手': 'Label print agent',
    '启用（仅本工位）': 'Enable (this station only)',
    '扫到运单号 / 开始打包时自动打印面单': 'Auto-print the label when a tracking no. is scanned / packing starts',
    '测试连接': 'Test connection',
    '打印助手已连接：{files} 个 PDF / {pages} 页面单': 'Agent connected: {files} PDFs / {pages} label pages',
    '打印助手响应异常': 'Agent responded abnormally',
    '连不上打印助手，请确认打包电脑上 start.bat 正在运行': "Can't reach the print agent — make sure start.bat is running on the packing PC",
    '面单已发送打印：{no}': 'Label sent to printer: {no}',
    '打印助手：面单文件夹里没找到 {no}': 'Print agent: label {no} not found in the folder',
    '面单打印失败:{msg}': 'Label print failed: {msg}',
    '打印助手未运行或无法连接，请在打包电脑启动 start.bat': 'Print agent not running — start start.bat on the packing PC',
    '重打面单': 'Reprint label',
    '在打包电脑运行打印助手后，扫码打包页扫到运单号会自动从面单文件夹的 PDF 中找到对应页并打印。安装方法见项目': 'With the agent running on the packing PC, scanning a tracking no. auto-finds the label page in your PDF folder and prints it. Setup guide in the',
    '文件夹（或下载': 'folder (or download',
    '语言': 'Language',
  },
  it: {
    // —— 侧栏 / 导航 ——
    '进销存 · 面单核对': 'Magazzino · Verifica',
    '概览': 'Panoramica', '扫码打包': 'Imballa', '扫描核对': 'Verifica',
    '订单管理': 'Ordini', '商品库存': 'Prodotti', '入库': 'Carico',
    '出入流水': 'Movimenti', '设置': 'Impostazioni',
    '数据保存在本机浏览器': 'Dati salvati in questo browser',
    '请定期在「设置」中导出备份': 'Esporta backup regolarmente in Impostazioni',
    '登录云同步或定期在「设置」导出备份': 'Accedi al cloud o esporta backup in Impostazioni',
    '云同步：待登录': 'Cloud: non connesso',
    '云同步中…': 'Sincronizzazione…', '已同步 {}:{}': 'Sincr. {}:{}',
    '同步失败，自动重试中': 'Sincr. fallita, riprovo', '云同步未启用': 'Cloud disattivato',
    '⚠ 建议去「设置」导出备份': '⚠ Esporta un backup in Impostazioni',
    // —— 通用 ——
    '保存': 'Salva', '取消': 'Annulla', '确定': 'Conferma', '确认': 'Conferma',
    '删除': 'Elimina', '编辑': 'Modifica', '调整': 'Rettifica', '核对': 'Verifica',
    '导出 CSV': 'Esporta CSV', '全部': 'Tutti', '开启': 'Attivo',
    '请确认操作': 'Conferma operazione', '全部订单': 'Tutti gli ordini', '查看全部': 'Vedi tutti',
    '全部渠道': 'Tutti i canali', '关于': 'Info', '数量': 'Qtà', '类型': 'Tipo',
    '时间': 'Ora', '名称': 'Nome', '规格': 'Specifica', '成本': 'Costo', '库存': 'Stock',
    '条码': 'Barcode', '备注': 'Note', '事由': 'Causale', '操作': 'Azioni',
    '状态': 'Stato', '渠道': 'Canale', '订单号': 'N. ordine', '运单号': 'N. spedizione',
    '收件人': 'Destinatario', '商品': 'Articolo', '件数': 'Pz', '进度': 'Avanz.',
    '创建': 'Creato', '关联单号': 'Rif.', '安全库存': 'Scorta min.', '安全线': 'Min.',
    '订单数': 'Ordini', '核对时间': 'Verificato', '开始日期': 'Data inizio', '结束日期': 'Data fine',
    '入': 'Ent.', '出': 'Usc.', '单': '', '个': '',
    // —— 概览 ——
    '今天是 {}-{}-{}': 'Oggi è {}-{}-{}', '去扫描核对': 'Vai a verifica',
    '待核对订单': 'Ordini da evadere', '今日已核对': 'Evasi oggi',
    '库存预警商品': 'Sotto scorta', '在库商品种类': 'SKU a magazzino',
    '各渠道待发货': 'Da spedire per canale', '库存预警': 'Avviso scorta',
    '最近动态': 'Attività recente', '全部流水': 'Tutti i movimenti',
    '欢迎使用 SUVOO 进销存 · 面单核对': 'Benvenuto in SUVOO Magazzino · Verifica',
    '载入示例数据': 'Carica dati demo', '载入示例数据体验': 'Carica dati demo',
    '新增商品': 'Nuovo prodotto', '导入订单': 'Importa ordini',
    // —— 商品 ——
    '共 {} 个商品，{} 个低于安全库存': '{} prodotti · {} sotto scorta',
    '导入商品': 'Importa prodotti', '搜索 SKU / 条码 / 名称 / 规格': 'Cerca SKU / barcode / nome / spec.',
    '仅看库存预警': 'Solo sotto scorta', '调整库存': 'Rettifica stock',
    // —— 入库 ——
    '收货时扫商品条码连续入库，或手动单笔录入': 'Scansiona i barcode per il carico, o inserisci a mano',
    '扫码连续入库': 'Carico continuo', '扫描商品条码 / 输入 SKU 后回车': 'Scansiona barcode / SKU poi Invio',
    '同一商品重复扫码自动累加数量': 'Riscansionare lo stesso articolo aumenta la quantità',
    '尚未扫入商品': 'Nessun articolo scansionato', '单笔入库': 'Carico singolo',
    '商品（输入 SKU / 条码 / 名称搜索）': 'Prodotto (cerca SKU / barcode / nome)',
    '搜索选择商品': 'Cerca e scegli un prodotto', '最近入库记录': 'Carichi recenti',
    '采购入库': 'Acquisto', '退货入库': 'Reso', '盘盈': 'Eccedenza',
    // —— 订单 ——
    '导入各渠道订单，扫描面单核对出库': 'Importa ordini dai canali, scansiona le etichette per spedire',
    '导出待核对': 'Esporta da evadere', '清理已核对': 'Pulisci evasi', '手动新增': 'Aggiungi a mano',
    '待核对': 'Da evadere', '待核对 {}': 'Da evadere {}', '已核对 {}': 'Evasi {}',
    '全部 {}': 'Tutti {}', '搜索订单号 / 运单号 / 收件人 / 商品': 'Cerca ordine / spedizione / destinatario / articolo',
    '点击展开明细': 'Clicca per espandere', '待核对列表': 'Da evadere',
    // —— 扫描核对 ——
    '扫描核对台': 'Stazione Verifica',
    '扫描枪对准面单条码，回车自动核对出库': 'Punta lo scanner sul barcode; Invio spedisce automaticamente',
    '导出核对 Excel': 'Esporta Excel', '本次成功': 'Riusciti', '异常': 'Errori', '重复': 'Doppioni',
    '扫描或输入运单号 / 订单号': 'Scansiona o digita spedizione / ordine',
    '支持运单号或订单号 · 扫码自动确认（无需回车） · 手动输入按': 'N. spedizione o ordine · conferma automatica (senza Invio) · o digita e premi',
    '扫描商品条码（自动确认）/ 输入 SKU 回车': 'Scansiona barcode (conferma automatica) / digita SKU + Invio',
    '未找到商品「{code}」，请先在商品库添加': 'Prodotto "{code}" non trovato — aggiungilo prima in Prodotti',
    '· 点击页面空白处自动回到输入框': ' · clicca su un\'area vuota per rifocalizzare',
    '等待扫描…': 'In attesa…', '本次扫描记录': 'Questa sessione',
    '还没有扫描记录。将光标放在左侧输入框，直接用扫描枪扫面单即可。': 'Nessuna scansione. Metti il cursore nel campo a sinistra e scansiona un\'etichetta.',
    '核对成功，已出库': 'Verificato — spedito', '重复扫描！': 'Scansione doppia!',
    '未找到该单号': 'Numero non trovato', '订单': 'Ordine', '运单': 'Spedizione', '收件': 'A',
    '扫描内容：': 'Scansionato: ', '快速登记此订单': 'Registra questo ordine', '忽略': 'Ignora',
    '✓ 核对': '✓ Verificato', '未找到': 'Non trovato',
    // —— 扫码打包 ——
    '扫码打包台': 'Stazione Imballaggio',
    '扫面单开包裹 → 逐件扫商品装箱 → 装齐自动出库；单件订单扫面单直发':
      'Scansiona etichetta → scansiona ogni articolo → spedizione automatica; ordini singoli spediti alla scansione',
    '提示音': 'Suono', '待打包 {} 单': 'Da imballare: {}', '进行中': 'In corso',
    '导出打包 Excel': 'Esporta Excel', '待打包': 'Da imballare', '本次完成': 'Completati',
    '扫描面单开始打包': 'Scansiona un\'etichetta per iniziare',
    '扫运单号或订单号 · 单件订单直接出库 · 多件订单进入装箱核对':
      'Scansiona spedizione/ordine · articolo singolo spedito · multi-articolo entra in verifica',
    '扫描商品条码 / SKU · 无条码商品点行内 +1 · 装齐自动完成出库':
      'Scansiona barcode / SKU · tocca +1 senza barcode · spedizione automatica al completamento',
    '包裹尺寸/重量': 'Dimensioni / peso', '（选填，出库时记入订单）': '(facoltativo, salvato alla spedizione)',
    '长 cm': 'L cm', '宽 cm': 'P cm', '厚 cm': 'H cm', '重 kg': 'kg',
    '等待扫描面单…': 'In attesa dell\'etichetta…', '打包队列': 'Coda imballaggio',
    '本次打包记录': 'Questa sessione',
    '还没有记录。把光标放在左侧输入框，扫面单即可开始。': 'Nessun record. Metti il cursore nel campo e scansiona un\'etichetta.',
    '完成打包出库': 'Completa e spedisci', '暂停 / 换单': 'Pausa / cambia', '清除进度': 'Azzera',
    '单件直发': 'Spedizione diretta', '打包中 {}/{}': 'Imballaggio {}/{}',
    '✓ 单件直发': '✓ Diretta', '✓ 完成': '✓ Fatto', '强制完成': 'Forzato', '装错商品': 'Errato',
    '未知码': 'Sconosciuto', '已出库': 'Spedito', '已撤销': 'Annullato',
    // —— 打包动态消息 ——
    '收件': 'A', '备注：': 'Note: ',
    '未找到该单号：{code}（订单可能未导入）': 'Numero non trovato: {code} (ordine non importato?)',
    '该单已于 {time} 出库，请勿重复发货！': 'Già spedito il {time} — non rispedire!',
    '单件订单，已直接完成出库：{no}': 'Ordine singolo spedito: {no}',
    '继续打包（此前已装 {done}/{total} 件），请扫商品条码': 'Riprendi imballaggio (già {done}/{total}) — scansiona i barcode',
    '开始打包，共 {total} 件，请逐件扫商品条码装箱': 'Inizio imballaggio, {total} pz — scansiona ogni barcode',
    '当前包裹正在打包中，请扫商品条码': 'Pacco in corso — scansiona i barcode',
    '【{name}】已装满 {qty} 件，请勿多装！': '{name} già completo ({qty}) — non aggiungere altro!',
    '已装 {name}（{n}/{qty}）': 'Inserito {name} ({n}/{qty})',
    '装错了！【{name}】不在本单，请取出': 'Errato! {name} non è in questo ordine — rimuovilo',
    '这是另一张面单。请先完成或暂停当前包裹，再扫新面单': 'È un\'altra etichetta. Completa o metti in pausa il pacco corrente.',
    '未知条码：{code}（不在本单，也不在商品库）': 'Barcode sconosciuto: {code} (non nell\'ordine né nei prodotti)',
    '打包完成，已出库：{no}（缺件强制完成）': 'Imballato e spedito: {no} (forzato, mancano articoli)',
    '打包完成，已出库：{no}': 'Imballato e spedito: {no}',
    '单件直发 {no} · 请装入：': 'Spedizione diretta {no} — inserisci:',
    '已出库 {no} · 包裹内容：': 'Spedito {no} — contenuto del pacco:',
    '（无商品明细）': '(nessun dettaglio articoli)',
    '已回退 1 件': 'Rimosso 1 articolo', '已暂停，进度已保存（云同步后其他设备可继续）': 'In pausa — avanzamento salvato (riprendi su altro dispositivo)',
    '已清除进度': 'Avanzamento azzerato', '请先完成或暂停当前包裹': 'Completa o metti in pausa il pacco corrente',
    '该订单已不可撤销': 'Questo ordine non è più annullabile', '已撤销出库，库存已回补': 'Spedizione annullata, stock ripristinato',
    // —— 流水 ——
    '每一次库存变动都有据可查': 'Ogni movimento è tracciabile',
    '搜索 SKU / 名称 / 单号': 'Cerca SKU / nome / n.', '出库': 'Uscita', '入库 ': 'Entrata',
    // —— 设置 ——
    '云同步、渠道、偏好与数据备份': 'Cloud, canali, preferenze e backup',
    '销售渠道': 'Canali di vendita', '新渠道名，回车添加': 'Nuovo canale, Invio per aggiungere',
    '偏好': 'Preferenze', '扫描提示音': 'Suoni scansione',
    '核对成功 / 重复 / 异常时播放不同提示音': 'Suoni diversi per successo / doppione / errore',
    '核对时自动扣减库存': 'Scarico stock automatico',
    '扫描核对订单时按商品明细自动出库；撤销核对自动回补': 'Scarica per righe alla verifica; annulla ripristina',
    '单件订单扫面单直发': 'Spedizione diretta articolo singolo',
    '扫码打包页：只有 {} 件商品的订单扫面单直接出库，无需再扫商品':
      'Imballaggio: ordini con {} articolo spediti alla scansione, senza scansionare articoli',
    '数据备份': 'Backup dati', '导出备份（JSON）': 'Esporta backup (JSON)',
    '导入备份恢复': 'Ripristina backup', '清空全部数据': 'Cancella tutto',
    '从未备份': 'mai', '云同步（多设备共享）': 'Cloud (multi-dispositivo)',
    'Supabase 地址': 'URL Supabase', 'anon 公钥': 'chiave anon',
    '同步服务地址（一般不用改）': 'URL server (di solito non cambia)',
    '管理员提供的账号': "Account fornito dall'amministratore",
    '请填写同步服务地址': "Inserisci l'URL del server",
    '请填写登录邮箱和密码': 'Inserisci email e password',
    '登录已过期，请重新登录': 'Sessione scaduta — accedi di nuovo',
    '登录后，商品 / 订单 / 流水在多设备之间自动同步（改动后约 {} 秒推送，每 {} 秒增量拉取；库存按流水汇总计算，多台设备同时扫单不会互相覆盖）。使用管理员提供的账号密码登录即可。':
      "Dopo l'accesso, prodotti / ordini / movimenti si sincronizzano tra dispositivi (invio ~{}s dopo le modifiche, pull incrementale ogni {}s). Accedi con l'account fornito dall'amministratore.",
    '登录邮箱': 'Email', '密码': 'Password', '在 Supabase 后台创建的账号': 'Account creato in Supabase',
    '登录并开始同步': 'Accedi e sincronizza', '立即同步': 'Sincronizza ora', '退出登录': 'Esci',
    // —— 补充：流水事由 / 标签 / 设置页长句 ——
    '订单核对出库': 'Uscita ordine', '盘亏': 'Ammanco', '损耗报废': 'Danno/scarto',
    '样品赠送': 'Campione/omaggio', '手动修正': 'Correzione manuale', '撤销核对回补': 'Annullo ripristino',
    '库存基线校准': 'Baseline stock', '历史流水结转': 'Riporto storico', '导入覆盖库存': 'Sovrascrittura import',
    '期初库存': 'Stock iniziale',
    '收件人：': 'Destinatario: ', '包裹：': 'Pacco: ', '上次备份：': 'Ultimo backup: ',
    '（当前库存 {}）': '(stock {})', '点击开始/继续打包': 'Clicca per iniziare/continuare',
    '误扫回退': 'Annulla scansione', '无条码商品手动装箱': 'Inserisci a mano (senza barcode)',
    '登录后，商品 / 订单 / 流水在多设备之间自动同步（改动后约 {} 秒推送，每 {} 秒拉取合并；库存按流水汇总计算，多台设备同时扫单不会互相覆盖）。':
      'Dopo l\'accesso, prodotti / ordini / movimenti si sincronizzano tra dispositivi (invio ~{}s dopo le modifiche, merge ogni {}s; lo stock è calcolato dai movimenti).',
    '首次使用：': 'Primo utilizzo: ',
    '①在 Supabase SQL 编辑器执行项目根目录的': '① esegui',
    '；②在 Supabase 后台 Authentication → Users 创建登录账号（邮箱需在白名单内）。': ' nell\'editor SQL di Supabase; ② crea un utente in Authentication → Users (email in whitelist).',
    '所有数据仅保存在本机浏览器（localStorage）。清除浏览器数据会导致丢失，': 'Tutti i dati vivono in questo browser (localStorage). Cancellare i dati del browser li perde — ',
    '请定期导出备份': 'esporta backup regolarmente', '。': '.',
    'SUVOO 进销存 · 面单核对 v{} — 轻量级本地进销存工具，适合小团队多渠道电商出库核对。':
      'SUVOO Magazzino · Verifica v{} — strumento leggero di magazzino per piccoli team e-commerce multicanale.',
    '当前数据：{} 个商品 · {} 个订单 · {} 条流水 · 占用 {} KB': 'Dati attuali: {} prodotti · {} ordini · {} movimenti · {} KB',
    '扫面单 / 订单号 / 商品条码均可 · 单件直发 · 多件进入装箱核对': 'Scansiona etichetta / ordine / barcode prodotto · singolo spedito subito · multi in verifica',
    '商品【{name}】没有待发订单': 'Nessun ordine da evadere contiene {name}',
    '（该商品有 {n} 个待发订单，已按最早优先）': ' ({n} ordini con questo articolo — il più vecchio per primo)',
    '扫商品匹配订单 {no}，已直接出库': 'Prodotto abbinato allordine {no} — spedito',
    '扫商品打开订单 {no}，已装 {name}（{n}/{qty}）': 'Prodotto ha aperto lordine {no} — inserito {name} ({n}/{qty})',
    '已打开订单 {no}，请扫商品条码装箱': 'Aperto ordine {no} — scansiona i barcode',
    '面单打印助手': 'Agente di stampa etichette',
    '启用（仅本工位）': 'Attiva (solo questa postazione)',
    '扫到运单号 / 开始打包时自动打印面单': "Stampa automatica dell'etichetta alla scansione del n. spedizione",
    '测试连接': 'Prova connessione',
    '打印助手已连接：{files} 个 PDF / {pages} 页面单': 'Agente connesso: {files} PDF / {pages} pagine etichette',
    '打印助手响应异常': 'Risposta anomala dallo agente',
    '连不上打印助手，请确认打包电脑上 start.bat 正在运行': 'Agente non raggiungibile — verifica che start.bat sia in esecuzione sul PC',
    '面单已发送打印：{no}': 'Etichetta inviata alla stampante: {no}',
    '打印助手：面单文件夹里没找到 {no}': 'Agente: etichetta {no} non trovata nella cartella',
    '面单打印失败:{msg}': 'Stampa etichetta fallita: {msg}',
    '打印助手未运行或无法连接，请在打包电脑启动 start.bat': 'Agente non attivo — avvia start.bat sul PC di imballaggio',
    '重打面单': 'Ristampa etichetta',
    '在打包电脑运行打印助手后，扫码打包页扫到运单号会自动从面单文件夹的 PDF 中找到对应页并打印。安装方法见项目': "Con l'agente attivo sul PC, la scansione del n. spedizione trova la pagina dell'etichetta nel PDF e la stampa. Guida nella cartella",
    '文件夹（或下载': 'cartella (o scarica',
    '语言': 'Lingua',
  }
};

// 初始化：设置 <html lang> 和侧栏语言选择器
document.documentElement.lang = LANG;
(function initLangSel() {
  const sel = document.getElementById('langSel');
  if (sel) sel.value = LANG;
})();
