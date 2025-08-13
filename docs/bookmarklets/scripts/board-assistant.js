(() => {
  // ============ Utils ============
  const $$  = (root, sel) => Array.from(root.querySelectorAll(sel));
  const txt = (el) => (el ? el.textContent.trim() : "");
  const byIdLike = (row, prefix) => row.querySelector(`[id^="${prefix}"]`);
  const norm = (s) => (s || "").toLowerCase();
  const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));
  const debounce = (fn, ms=350)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

  const isForza      = (s) => norm(s).includes("forza");
  const isValueTruck = (s) => norm(s).includes("value truck of az");
  const isRich       = (s) => norm(s).includes("rich logistics");

  // Title Case para nombres y carriers
  function toTitleCase(s){
    if (!s) return "";
    const lower = s.toLowerCase().replace(/\s+/g," ").trim();
    const parts = lower.split(/(\s+|\/|-)/
    );
    return parts.map((w,i)=>{
      if (!w.trim() || /\s+|\/|-/.test(w)) return w;
      if (/^(llc|l\.l\.c\.?)$/i.test(w)) return "LLC";
      if (/^(inc|inc\.)$/i.test(w)) return "Inc.";
      if (i>0 && /^(de|del|la|las|los|y|and|of|the)$/i.test(w)) return w.toLowerCase();
      return w.replace(/^\p{L}/u, c=>c.toUpperCase());
    }).join("");
  }
  function normalizePhone(s){
    if (!s) return "";
    const digits = (s.match(/\d/g)||[]).join("");
    if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits[0]==="1") return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
    return s.trim();
  }

  const getStateAbbrev = (s) => {
    if (!s) return "";
    const m = s.match(/,\s*([A-Za-z]{2})\b/);
    return m ? m[1].toUpperCase() : s.trim().toUpperCase();
  };
  const getCityState = (s) => {
    if (!s) return { city: "", st: "" };
    const m = s.match(/^\s*([^,]+)\s*,\s*([A-Za-z]{2})\b/);
    return m
      ? { city: toTitleCase(m[1].trim()), st: m[2].toUpperCase() }
      : { city: toTitleCase(s.trim()), st: "" };
  };
  async function copyText(s) {
    try { await navigator.clipboard.writeText(s); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = s; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
  }

  // ============ Dispatcher map (Value Truck) ============
  const MAP_URL = "https://script.google.com/macros/s/AKfycbw8Hntjp_caYWVjPEGdFPyjmf0LGz1f9qlaRVOnEyN7xL29_Mt0aDmgTfVY7U6cbTBHCw/exec";
  const MAP_KEY = "__dispatcherMap";
  const MAP_TS  = "__dispatcherMapTS";
  const DAY     = 86400000;
  async function getDispatcherMap() {
    const now = Date.now();
    try {
      const saved = localStorage.getItem(MAP_KEY);
      const ts    = Number(localStorage.getItem(MAP_TS) || 0);
      if (saved && now - ts < DAY) return JSON.parse(saved);
      const res = await fetch(MAP_URL);
      const data = await res.json();
      localStorage.setItem(MAP_KEY, JSON.stringify(data));
      localStorage.setItem(MAP_TS, String(now));
      return data;
    } catch { return {}; }
  }

  // ============ Parse board ============
  function grabRows() {
    return $$(
      document,
      'tr[class*="arrive_Table__tableRow"], tr.arrive_Table__tableRow'
    );
  }
  function isRowHighRisk(row){
    return !!row.querySelector(`
      [class*="hrHv"],
      [class*="HRHV"],
      svg[class*="diamondIconHighRisk"],
      svg[class*="diamondiconhighrisk"],
      svg[class*="diamondIconHrHv"],
      svg[class*="diamondiconhrhv"],
      [data-testid*="hrhv"],
      [aria-label*="High Risk"]
    `);
  }

  function parseBoard() {
    const rows = grabRows();

    return rows.map((row) => {
      const loadA      = row.querySelector('a[id^="grid_load_loadNumber__"]');
      const loadNumber = txt(loadA);

      const puLoc   = byIdLike(row, "grid_load_pickUpLocation__");
      const dlLoc   = byIdLike(row, "grid_load_deliverLocation__");
      const pickup  = txt(puLoc);
      const deliver = txt(dlLoc);

      const carrierA = byIdLike(row, "grid_load_carrierCode__");
      const carrier  = toTitleCase(txt(carrierA));

      const driverNameEl = byIdLike(row, "grid_load_driverName__");
      const driverName   = toTitleCase(txt(driverNameEl));

      const truckCell = byIdLike(row, "grid_load_truckNumber__");
      const truckSpan = truckCell ? truckCell.querySelector("span") : null;
      let truck = txt(truckSpan);
      if (/^none$/i.test(truck)) truck = "";

      const phoneEl = byIdLike(row, "grid_load_driverPhone__");
      let driverPhone = normalizePhone(txt(phoneEl));
      if (!driverPhone) {
        const m = (row.innerText || "").match(/\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
        if (m) driverPhone = normalizePhone(m[0]);
      }

      const pu = getCityState(pickup);
      const dl = getCityState(deliver);

      let pro = null;
      if (isRich(carrier)) {
        const m = (driverName || "").match(/\b(\d{7})\b/);
        pro = m ? m[1] : null;
      }

      const isHighRisk = isRowHighRisk(row);

      return {
        loadNumber,
        pickup, deliver,
        puCity: pu.city, puSt: pu.st,
        dlCity: dl.city, dlSt: dl.st,
        puStOnly: getStateAbbrev(pickup),
        dlStOnly: getStateAbbrev(deliver),
        carrier, truck, pro,
        driverName, driverPhone,
        isHighRisk
      };
    }).filter(r => r.loadNumber && r.carrier);
  }

  async function waitForStableRows({min=0, settleMs=150, timeoutMs=3000} = {}){
    const start = Date.now();
    let lastCount = -1, stableFor = 0;
    while (Date.now() - start < timeoutMs) {
      const n = grabRows().length;
      if (n >= min) {
        if (n === lastCount) {
          stableFor += settleMs;
          if (stableFor >= settleMs) break;
        } else {
          stableFor = 0;
        }
        lastCount = n;
      }
      await sleep(settleMs);
    }
  }

  // ============ Formatting rules ============
  const addRisk = (line, r) => r.isHighRisk ? `${line} - HIGH RISK` : line;

  async function formatLinesForCarrier(carrier, arr) {
    if (isForza(carrier)) {
      return arr.map(r => {
        const need = r.truck ? `truck# ${r.truck}` : "need DR info";
        const cityPart = [r.puCity, r.puSt].filter(Boolean).join(", ");
        return addRisk(`L# ${r.loadNumber} - ${cityPart} - ${need}`, r);
      });
    }

    if (isValueTruck(carrier)) {
      const map = await getDispatcherMap();
      const groups = {};
      for (const r of arr) {
        if (!r.truck) {
          const base = `L# ${r.loadNumber} - ${r.puStOnly} to ${r.dlStOnly} - need DR info`;
          (groups["NEED DR INFO"] ||= []).push(addRisk(base, r));
          continue;
        }
        const disp = (map[r.truck] || "UNKNOWN").toUpperCase();
        const base = `L# ${r.loadNumber} - ${r.puStOnly} to ${r.dlStOnly} - truck# ${r.truck} - ${disp}`;
        (groups[disp] ||= []).push(addRisk(base, r));
      }
      const keys = Object.keys(groups).sort((a,b) => {
        if (a === "NEED DR INFO") return 1;
        if (b === "NEED DR INFO") return -1;
        return a.localeCompare(b);
      });
      const chunks = keys.map(k => groups[k].join("\n"));
      return chunks.join("\n\n").split("\n");
    }

    if (isRich(carrier)) {
      return arr.map(r => {
        const need = r.truck ? `truck# ${r.truck}` : "need DR info";
        const proPart = r.pro ? ` - PRO: ${r.pro}` : " - NO PRO";
        return addRisk(`L# ${r.loadNumber} - ${r.puStOnly} to ${r.dlStOnly} - ${need}${proPart}`, r);
      });
    }

    return arr.map(r => {
      const need = r.truck ? `truck# ${r.truck}` : "need DR info";
      return addRisk(`L# ${r.loadNumber} - ${r.puStOnly} to ${r.dlStOnly} - ${need}`, r);
    });
  }

  // ============ Reach-out store ============
  const REACH_KEY = "__ba_reachMap";
  function loadReachMap(){
    try { return JSON.parse(localStorage.getItem(REACH_KEY) || "{}"); }
    catch { return {}; }
  }
  function saveReachMap(map){
    try { localStorage.setItem(REACH_KEY, JSON.stringify(map)); } catch {}
  }

  // ============ UI (junto a "Save Search") ============
  function injectStylesOnce() {
    const ID = "__ba_styles";
    if (document.getElementById(ID)) return;
    const css = `
      #__ba_toggle {
        background:#0077c8; color:#ffffff; border:1px solid #0a5e97;
        border-radius:10px; padding:6px 12px; font-weight:800; cursor:pointer;
        display:inline-flex; align-items:center; gap:8px;
        box-shadow:0 6px 14px rgba(0,0,0,.25);
        transition: background .15s ease, transform .12s ease;
      }
      #__ba_toggle:hover { background:#0063a3; }
      #__ba_toggle.__open .__chev { transform: rotate(180deg); }

      #__ba_panel {
        position:absolute; z-index:999999; margin-top:8px;
        background:#0f172a; color:#e5e7eb; border:1px solid #173154;
        border-radius:14px; box-shadow:0 18px 40px rgba(0,0,0,.45);
        padding:12px; width:460px; max-height:70vh; overflow:auto;
        opacity:0; transform: translateY(-4px); pointer-events:none;
        transition:opacity .15s ease, transform .15s ease;
      }
      #__ba_panel.__show { opacity:1; transform: translateY(0); pointer-events:auto; }

      #__ba_header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; gap:8px; }
      #__ba_title  { font-weight:900; letter-spacing:.2px; }
      #__ba_info   { color:#94a3b8; margin:6px 0 10px; }

      #__ba_close, #__ba_refresh {
        background:#1f2937; color:#e5e7eb; border:1px solid #374151; border-radius:10px;
        padding:6px 8px; font-weight:700; cursor:pointer;
      }
      #__ba_refresh[disabled] { opacity:.6; cursor:default; }

      #__ba_list { display:block; }
      .__ba_item {
        display:flex; align-items:center; justify-content:space-between;
        background:#111827; border:1px solid #1f2937; border-radius:12px;
        padding:10px 12px; margin-bottom:8px; cursor:pointer;
        transition: background .15s ease, transform .05s ease;
      }
      .__ba_item:hover { background:#162033; }
      .__ba_item:active{ transform: translateY(1px); }
      .__ba_name { font-weight:800; display:flex; align-items:center; gap:10px; }
      .__ba_count {
        font-size:12px; color:#cbd5e1; background:#0b1220; border:1px solid #1f2937;
        border-radius:999px; padding:3px 8px; margin-left:8px;
      }
      .__chev { width:0; height:0; border-left:5px solid transparent; border-right:5px solid transparent; border-top:6px solid #ffffff; transition:transform .12s ease; }
      .__ba_chk { transform:translateY(1px); }
      .__ba_chk + span.__lbl { opacity:.95; }
      .__ba_item.__done .__lbl { text-decoration: line-through; opacity:.6; }

      /* ====== Sidecar ====== */
      #__ba_sidecar{
        position:fixed; top:0; left:0; width:320px;
        z-index:1000005;
        background:#0b1220; color:#e5e7eb; border:1px solid #1b2b4a;
        border-radius:14px; box-shadow:0 18px 40px rgba(0,0,0,.45);
        padding:12px; display:none; visibility:hidden;
      }
      #__ba_sidecar.__show{ display:block; }
      #__ba_sidecar h4{ margin:0 0 8px; font-size:16px; font-weight:900; letter-spacing:.2px; color:#fff; display:flex; align-items:center; gap:8px; }
      #__ba_sidecar .sc-row{ display:flex; align-items:center; gap:10px; margin:7px 0; }
      #__ba_sidecar .sc-label{ font-size:12px; color:#9fb3d1; min-width:72px; text-transform:uppercase; letter-spacing:.3px; }
      #__ba_sidecar .sc-val{ font-weight:800; color:#e6edf7; }
      #__ba_sidecar .sc-badge{
        display:inline-block; font-size:11px; padding:3px 8px; border-radius:999px;
        border:1px solid #ef4444; color:#ffe4e6; background:#7f1d1d;
      }
      #__ba_sidecar .sc-copy{
        margin-left:auto; border:1px solid #2b3f66; background:#13203a; color:#e5e7eb;
        border-radius:10px; padding:4px 8px; font-weight:800; cursor:pointer;
      }
      #__ba_sidecar .sc-copy:hover{ background:#0f1a2f; }
      #__ba_sidecar .sc-muted{ color:#94a3b8; }
    `;
    const style = document.createElement("style");
    style.id = ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function findSaveSearchButton() {
    const all = $$(document, 'button, .arrive_Button__buttonText, .arrive_Button__button');
    return all.find((b) => /save search/i.test(b.textContent || ""));
  }

  function createDockUI() {
    injectStylesOnce();

    document.getElementById("__ba_dock")?.remove();
    document.getElementById("__ba_panel")?.remove();

    const anchor = findSaveSearchButton();
    if (!anchor || !anchor.parentElement) return null;

    const dock = document.createElement("span");
    dock.id = "__ba_dock";
    dock.style.cssText = "display:inline-flex; align-items:center; gap:8px; margin-left:10px;";
    anchor.insertAdjacentElement("afterend", dock);

    const toggle = document.createElement("button");
    toggle.id = "__ba_toggle";
    toggle.innerHTML = `<span>Board Assistant</span><i class="__chev"></i>`;
    dock.appendChild(toggle);

    const panel = document.createElement("div");
    panel.id = "__ba_panel";
    panel.innerHTML = `
      <div id="__ba_header">
        <div style="display:flex; align-items:center; gap:8px;">
          <div id="__ba_title">Carriers</div>
          <button id="__ba_refresh" title="Actualizar lista">Actualizar</button>
        </div>
        <button id="__ba_close">Cerrar</button>
      </div>
      <div id="__ba_info">Cargando…</div>
      <div id="__ba_list"></div>
    `;
    document.body.appendChild(panel);

    function positionPanel() {
      const r = toggle.getBoundingClientRect();
      panel.style.left = `${r.left}px`;
      panel.style.top  = `${r.bottom + 6 + window.scrollY}px`;
    }
    const open  = () => { positionPanel(); panel.classList.add("__show"); toggle.classList.add("__open"); };
    const close = () => { panel.classList.remove("__show"); toggle.classList.remove("__open"); };

    toggle.addEventListener("click", () => panel.classList.contains("__show") ? close() : open());
    panel.querySelector("#__ba_close").addEventListener("click", close);
    window.addEventListener("resize", () => { if (panel.classList.contains("__show")) positionPanel(); });
    window.addEventListener("scroll", () => { if (panel.classList.contains("__show")) positionPanel(); });
    window.addEventListener("wheel", () => { if (panel.classList.contains("__show")) close(); }, { passive: true });

    const refreshBtn = panel.querySelector("#__ba_refresh");
    refreshBtn.addEventListener("click", async () => {
      if (refreshBtn.disabled) return;
      refreshBtn.disabled = true;
      const prev = ui.info.textContent;
      ui.info.textContent = "Actualizando…";
      try {
        await refreshBoard();
      } finally {
        setTimeout(() => { refreshBtn.disabled = false; }, 700);
        setTimeout(() => { if (ui.info.textContent === "Actualizando…") ui.info.textContent = prev; }, 1200);
      }
    });

    const ui = { list: panel.querySelector("#__ba_list"), info: panel.querySelector("#__ba_info") };
    return ui;
  }

  // ============ Render (alfabético + checkbox reach-out) ============
  async function renderCarrierList(ui, groups) {
    ui.list.innerHTML = "";
    const entries = Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0]));
    const reachMap = loadReachMap();

    for (const [carrier, arr] of entries) {
      const item = document.createElement("div");
      item.className = "__ba_item" + (reachMap[carrier] ? " __done" : "");
      item.innerHTML = `
        <div class="__ba_name">
          <input class="__ba_chk" type="checkbox" ${reachMap[carrier] ? "checked": ""} />
          <span class="__lbl">${carrier}</span>
        </div>
        <div class="__ba_count">${arr.length}</div>
      `;

      const chk = item.querySelector("input.__ba_chk");
      chk.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const newVal = chk.checked;
        const map = loadReachMap();
        map[carrier] = newVal;
        saveReachMap(map);
        item.classList.toggle("__done", !!newVal);
      });

      item.addEventListener("click", async () => {
        const lines = await formatLinesForCarrier(carrier, arr);
        await copyText(Array.isArray(lines) ? lines.join("\n") : lines.join("\n"));
        ui.info.textContent = `✓ Copiado ${arr.length} líneas de ${carrier}`;
        setTimeout(() => {
          const total = Object.values(groups).reduce((n,v) => n + v.length, 0);
          ui.info.textContent = `${total} cargas · ${Object.keys(groups).length} carriers`;
        }, 1500);
      });

      ui.list.appendChild(item);
    }
  }

  // ============ Índice por loadNumber ============
  let LOAD_INDEX = new Map();
  function buildIndex(rows){
    const m = new Map();
    for (const r of rows) m.set(String(r.loadNumber).trim(), r);
    LOAD_INDEX = m;
  }

  // ============ Sidecar ============
  function ensureSidecar(){
    let sc = document.getElementById("__ba_sidecar");
    if (!sc){
      sc = document.createElement("div");
      sc.id = "__ba_sidecar";
      document.body.appendChild(sc);
    }
    return sc;
  }
  const getModal = () => document.querySelector(".arrive_SideModal__modal");

  function getModalLoadNumber(modal){
    const h = modal.querySelector(".arrive_SideModal__headerBar h3");
    if (h) {
      const m = (h.textContent || "").match(/#\s*(\d+)/);
      if (m) return m[1];
    }
    const a = modal.querySelector('[class*="styles__loadNumber__link"]');
    if (a) return (a.textContent || "").replace(/\D+/g, "");
    return null;
  }

  function positionLeftOf(modal, el, {gap=16, offsetY=12} = {}){
    if (!el || !modal) return;
    const r = modal.getBoundingClientRect();
    const w = el.offsetWidth || 320;
    const left = Math.max(8, r.left - w - gap);
    const top  = Math.max(8, r.top + offsetY);
    el.style.left = `${left}px`;
    el.style.top  = `${top}px`;
  }

  function renderSidecarIfOpen(){
    const modal = getModal();
    if (!modal) { document.getElementById("__ba_sidecar")?.remove(); return; }

    const sc = ensureSidecar();
    const loadNum = getModalLoadNumber(modal);
    if (!loadNum){
      sc.classList.remove("__show"); sc.innerHTML = ""; return;
    }
    const r = LOAD_INDEX.get(String(loadNum).trim());

    // Cabecera con badge y botón Copy
    function headerHTML(row){
      const badge = row?.isHighRisk ? `<span class="sc-badge">HIGH RISK</span>` : "";
      return `<h4>Load #${row ? row.loadNumber : loadNum} ${badge}<button class="sc-copy" id="__ba_sc_copy">Copy</button></h4>`;
    }

    if (!r){
      sc.innerHTML = `
        ${headerHTML(null)}
        <div class="sc-row"><span class="sc-label">Carrier</span><span class="sc-val sc-muted">Not on current page</span></div>
        <div class="sc-row"><span class="sc-label">Driver</span><span class="sc-val sc-muted">—</span></div>
        <div class="sc-row"><span class="sc-label">Phone</span><span class="sc-val sc-muted">—</span></div>
        <div class="sc-row"><span class="sc-label">Truck</span><span class="sc-val sc-muted">—</span></div>
        <div class="sc-row"><span class="sc-label">Route</span><span class="sc-val sc-muted">—</span></div>
      `;
    } else {
      sc.innerHTML = `
        ${headerHTML(r)}
        <div class="sc-row"><span class="sc-label">Carrier</span><span class="sc-val">${r.carrier || "-"}</span></div>
        <div class="sc-row"><span class="sc-label">Driver</span><span class="sc-val">${r.driverName || "-"}</span></div>
        <div class="sc-row"><span class="sc-label">Phone</span><span class="sc-val">${r.driverPhone || "-"}</span></div>
        <div class="sc-row"><span class="sc-label">Truck</span><span class="sc-val">${r.truck || "-"}</span></div>
        <div class="sc-row"><span class="sc-label">Route</span><span class="sc-val">${r.puStOnly} → ${r.dlStOnly}</span></div>
      `;

      // Acción Copy (1 sola línea, con HIGH RISK si aplica)
      const copyBtn = sc.querySelector("#__ba_sc_copy");
      if (copyBtn){
        copyBtn.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          const lineArr = await formatLinesForCarrier(r.carrier, [r]);
          const line = Array.isArray(lineArr) ? lineArr[0] : String(lineArr);
          await copyText(line);
          copyBtn.textContent = "Copied!";
          setTimeout(()=> copyBtn.textContent = "Copy", 900);
        });
      }
    }

    // Mostrar SIN solaparse: medir primero, posicionar, luego hacer visible
    sc.classList.add("__show");
    sc.style.visibility = "hidden";
    // Forzar layout y posicionar antes de mostrar
    requestAnimationFrame(() => {
      positionLeftOf(modal, sc);
      requestAnimationFrame(() => {
        positionLeftOf(modal, sc);
        sc.style.visibility = "visible";
      });
    });
  }

  function hookSideModal(){
    const attach = () => {
      const modal = getModal();
      if (!modal) return;

      renderSidecarIfOpen();

      const headerH3 = modal.querySelector(".arrive_SideModal__headerBar h3");
      const body     = modal.querySelector(".arrive_SideModal__modalBody");

      try {
        if (headerH3){
          const moH = new MutationObserver(debounce(renderSidecarIfOpen, 120));
          moH.observe(headerH3, { characterData:true, subtree:true, childList:true });
          modal.__ba_moH = moH;
        }
        if (body){
          const moB = new MutationObserver(debounce(renderSidecarIfOpen, 120));
          moB.observe(body, { childList:true, subtree:true });
          modal.__ba_moB = moB;
        }
      } catch {}

      const onMove = debounce(()=>{
        const m = getModal();
        const sc = document.getElementById("__ba_sidecar");
        if (m && sc) positionLeftOf(m, sc);
      }, 60);
      window.addEventListener("resize", onMove);
      window.addEventListener("scroll", onMove, { passive:true });

      modal.querySelector(".arrive_SideModal__closeButton")?.addEventListener("click", () => {
        document.getElementById("__ba_sidecar")?.remove();
        window.removeEventListener("resize", onMove);
        window.removeEventListener("scroll", onMove);
      }, { once:true });
    };

    const watch = new MutationObserver(() => {
      const modal = getModal();
      if (modal && !modal.__ba_sc_attached){
        modal.__ba_sc_attached = true;
        attach();
      }
      if (!modal) document.getElementById("__ba_sidecar")?.remove();
    });
    try { watch.observe(document.body, { childList:true, subtree:true }); } catch {}

    setTimeout(attach, 200);
  }

  // ============ Refresh robusto ============
  async function refreshBoard(){
    await waitForStableRows({ settleMs: 150, timeoutMs: 3000 });
    const rows = parseBoard();
    buildIndex(rows);
    const groups = rows.reduce((acc, r) => { (acc[r.carrier] ||= []).push(r); return acc; }, {});
    ensureUI();
    ui.info.textContent = `${rows.length} cargas · ${Object.keys(groups).length} carriers`;
    await renderCarrierList(ui, groups);
    renderSidecarIfOpen();
  }

  // ============ Triggers externos ============
  const debouncedExternalRefresh = debounce(() => refreshBoard(), 400);

  function hookExternalTriggers(){
    document.addEventListener("click", (e) => {
      const el = e.target;
      if (el.closest && el.closest('button[title="Refresh"]')) {
        debouncedExternalRefresh();
        return;
      }
      const pagBtnSel = '.arrive_Pagination__container [data-testid="pagination-previous-page"], .arrive_Pagination__container [data-testid="pagination-next-page"], .arrive_Pagination__container [data-testid^="pagination-page-"]';
      if (el.closest && el.closest(pagBtnSel)) {
        debouncedExternalRefresh();
        return;
      }
    }, true);

    const attachInfoObserver = () => {
      const info = document.querySelector(".arrive_Pagination__infoText");
      if (!info) return;
      try {
        const mo = new MutationObserver(debouncedExternalRefresh);
        mo.observe(info, { characterData:true, subtree:true, childList:true });
      } catch {}
    };
    attachInfoObserver();

    const tryTimer = setInterval(() => {
      if (document.querySelector(".arrive_Pagination__infoText")) {
        attachInfoObserver();
        clearInterval(tryTimer);
      }
    }, 800);
    setTimeout(()=>clearInterval(tryTimer), 10000);
  }

  // ============ Resiliencia SPA ============
  function ensureUI(){
    if (!ui || !document.getElementById("__ba_panel")) {
      ui = createDockUI();
    }
  }

  // ============ Run ============
  let ui = null;
  (async function run(){
    ensureUI();
    await refreshBoard();
    hookExternalTriggers();
    hookSideModal();
    const globalMO = new MutationObserver(debounce(()=>ensureUI(), 200));
    try { globalMO.observe(document.body, { childList:true, subtree:true }); } catch {}
  })();
})();
