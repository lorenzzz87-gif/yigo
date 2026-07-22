const PRODUCT_KEY = "kuan-products-v2";
const SESSION_KEY = "kuan-session-v2";
const $ = (s) => document.querySelector(s);
let products = read(PRODUCT_KEY, []);
let session = read(SESSION_KEY, null);

function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save() { localStorage.setItem(PRODUCT_KEY, JSON.stringify(products)); session ? localStorage.setItem(SESSION_KEY, JSON.stringify(session)) : localStorage.removeItem(SESSION_KEY); }
function fmt(iso) { return iso ? new Date(iso).toLocaleString("zh-CN", { hour12: false }) : "—"; }
function esc(v) { return String(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function toast(message) { const el=$("#toast"); el.textContent=message; el.classList.add("show"); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),2200); }

function render() {
  const lines = session?.lines || [];
  const active = session?.status === "active";
  const finished = session?.status === "finished";
  $("#productCount").textContent = products.length.toLocaleString("zh-CN");
  $("#importStatus").textContent = products.length ? `已导入 ${products.length} 款产品` : "尚未导入产品";
  $("#packTotal").textContent = lines.reduce((s,x)=>s+x.packCount,0).toLocaleString("zh-CN");
  $("#qtyTotal").textContent = lines.reduce((s,x)=>s+x.packCount*x.unitsPerPack,0).toLocaleString("zh-CN");
  $("#recordBadge").textContent = `${lines.length} 款`;
  $("#startButton").disabled = active || !products.length;
  $("#finishButton").disabled = !active;
  $("#scanInput").disabled = !active;
  $("#manualScan").disabled = !active;
  $("#exportButton").disabled = !finished || !lines.length;
  $("#productFile").disabled = active;
  $("#clearProducts").disabled = active || !products.length;
  if (active) { $("#sessionTitle").textContent="正在刷单"; $("#sessionMeta").textContent=`开始时间：${fmt(session.startedAt)}`; }
  else if (finished) { $("#sessionTitle").textContent="本次刷单已结束"; $("#sessionMeta").textContent=`${fmt(session.startedAt)} — ${fmt(session.finishedAt)}`; }
  else { $("#sessionTitle").textContent="等待开始刷单"; $("#sessionMeta").textContent="导入产品后，点击右侧按钮开始一张新出库单。"; }
  $("#emptyState").hidden = lines.length > 0;
  $("#recordBody").innerHTML = lines.map((x,i)=>`<tr><td class="code">${String(i+1).padStart(2,"0")}</td><td class="code">${esc(x.sku)}</td><td class="code">${esc(x.barcode)}</td><td>${esc(x.name)}</td><td class="num">${x.unitsPerPack}</td><td class="num"><strong>${x.packCount}</strong></td><td class="num"><strong>${x.packCount*x.unitsPerPack}</strong></td><td class="code">${fmt(x.lastScannedAt)}</td><td class="actions">${active?`<button class="qty-button" data-action="minus" data-barcode="${esc(x.barcode)}">−</button><button class="qty-button" data-action="plus" data-barcode="${esc(x.barcode)}">＋</button>`:"—"}</td></tr>`).join("");
  document.querySelectorAll(".step-nav span").forEach((el,i)=>el.classList.toggle("active", i === (active?1:finished?2:0)));
}

function normalizeKey(key) { return String(key).replace(/\s/g,"").toLowerCase(); }
function pick(row, names) { const map=Object.fromEntries(Object.entries(row).map(([k,v])=>[normalizeKey(k),v])); for(const n of names){ if(map[normalizeKey(n)]!==undefined) return map[normalizeKey(n)]; } return ""; }

$("#productFile").addEventListener("change", async (event) => {
  const file=event.target.files[0]; if(!file) return;
  try {
    let rows;
    if(file.name.toLowerCase().endsWith(".csv")) rows=XLSX.utils.sheet_to_json(XLSX.read(await file.text(),{type:"string"}).Sheets.Sheet1,{defval:""});
    else { const wb=XLSX.read(await file.arrayBuffer(),{type:"array",raw:false}); rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:"",raw:false}); }
    const parsed=rows.map(row=>({sku:String(pick(row,["SKU","sku"])).trim(),barcode:String(pick(row,["条码","barcode","商品条码"])).trim(),name:String(pick(row,["品名","产品名称","商品名称"])).trim(),unitsPerPack:Number(pick(row,["每中包数量","中包数量","每包数量"]))})).filter(x=>x.sku&&x.barcode&&x.name&&Number.isFinite(x.unitsPerPack)&&x.unitsPerPack>0);
    if(!parsed.length) throw new Error("未识别到有效产品，请检查列名和数据。");
    const unique=new Map(parsed.map(x=>[x.barcode,x])); products=[...unique.values()]; save(); render(); toast(`成功导入 ${products.length} 款产品`);
  } catch(err) { alert(err.message || "产品文件读取失败"); }
  event.target.value="";
});

$("#downloadTemplate").addEventListener("click",()=>{
  const ws=XLSX.utils.json_to_sheet([{SKU:"WINE-001",条码:"800000000001",品名:"示例商品",每中包数量:6}]);
  ws["!cols"]=[{wch:16},{wch:20},{wch:28},{wch:14}]; const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"产品资料"); XLSX.writeFile(wb,"产品资料导入模板.xlsx");
});

$("#clearProducts").addEventListener("click",()=>{ if(confirm(`确定清空 ${products.length} 款产品资料吗？`)){products=[];save();render();toast("产品资料已清空");} });
$("#startButton").addEventListener("click",()=>{ if(session?.status==="finished"&&!confirm("开始新出库单后，当前已结束的明细将从页面移除。请确认已导出 Excel。"))return; session={id:`OUT-${Date.now()}`,status:"active",startedAt:new Date().toISOString(),finishedAt:null,lines:[]}; save();render();$("#scanInput").focus();toast("已开始刷单"); });

function scan() {
  if(session?.status!=="active") return;
  const input=$("#scanInput"), code=input.value.trim(); input.value=""; input.focus(); if(!code)return;
  const product=products.find(x=>x.barcode===code); if(!product){$("#scanFeedback").textContent=`未找到条码：${code}`;$("#scanFeedback").className="error";toast("产品库中没有这个条码");return;}
  const line=session.lines.find(x=>x.barcode===code); const now=new Date().toISOString();
  if(line){line.packCount+=1;line.lastScannedAt=now;} else session.lines.unshift({...product,packCount:1,lastScannedAt:now});
  $("#scanFeedback").textContent=`已添加：${product.name} ＋1 中包（${product.unitsPerPack} 件）`;$("#scanFeedback").className="success";save();render();
}
$("#scanInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();scan();}}); $("#manualScan").addEventListener("click",scan);
$("#recordBody").addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(!b||session?.status!=="active")return;const line=session.lines.find(x=>x.barcode===b.dataset.barcode);if(!line)return;line.packCount+=b.dataset.action==="plus"?1:-1;if(line.packCount<=0)session.lines=session.lines.filter(x=>x!==line);save();render();$("#scanInput").focus();});

$("#finishButton").addEventListener("click",()=>{if(!session.lines.length){alert("本次还没有扫码，不能结束刷单。");return;}if(!confirm("确定结束本次刷单吗？结束后数量将锁定。"))return;session.status="finished";session.finishedAt=new Date().toISOString();save();render();toast("本次刷单已结束，可以导出 Excel");});

$("#exportButton").addEventListener("click",()=>{
  if(session?.status!=="finished")return;
  const info=[["出库单号",session.id],["开始时间",fmt(session.startedAt)],["结束时间",fmt(session.finishedAt)],["中包合计",session.lines.reduce((s,x)=>s+x.packCount,0)],["出库总数量",session.lines.reduce((s,x)=>s+x.packCount*x.unitsPerPack,0)],[]];
  const detail=session.lines.map((x,i)=>({序号:i+1,SKU:x.sku,条码:x.barcode,品名:x.name,每中包数量:x.unitsPerPack,中包数:x.packCount,出库总数量:x.unitsPerPack*x.packCount,最后扫码时间:fmt(x.lastScannedAt)}));
  const ws=XLSX.utils.aoa_to_sheet(info); XLSX.utils.sheet_add_json(ws,detail,{origin:"A7"}); ws["!cols"]=[{wch:13},{wch:20},{wch:20},{wch:28},{wch:14},{wch:12},{wch:15},{wch:22}];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"出库明细");XLSX.writeFile(wb,`${session.id}_出库单.xlsx`);toast("本次出库 Excel 已导出");
});

function clock(){const n=new Date();$("#today").textContent=n.toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"short"});$("#clock").textContent=n.toLocaleTimeString("zh-CN",{hour12:false});}clock();setInterval(clock,1000);render();
