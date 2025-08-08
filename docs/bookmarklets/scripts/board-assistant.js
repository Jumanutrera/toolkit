(() => {
  // ============ Utils ============
  const $$  = (root, sel) => Array.from(root.querySelectorAll(sel));
  const txt = (el) => (el ? el.textContent.trim() : "");
  const byIdLike = (row, prefix) => row.querySelector(`[id^="${prefix}"]`);
  const norm = (s) => (s || "").toLowerCase();

  const isForza      = (s) => norm(s).includes("forza");
  const isValueTruck = (s) => norm(s).includes("value truck of az");
  const isRich       = (s) => norm(s).includes("rich logistics");

  const getStateAbbrev = (s) => {
    if (!s) return "";
    const m = s.match(/,\s*([A-Za-z]{2})\b/);
    return m ? m[1].toUpperCase() : s.trim().toUpperCase();
  };
  const getCityState = (s) => {
    if (!s) return { city: "", st: "" };
    const m = s.match(/^\s*([^,]+)\s*,\s*([A-Za-z]{2})\b/);
    return m
      ? { city: m[1].trim().replace(/\b\w/g, (c) => c.toUpperCase()), st: m[2].toUpperCase() }
      : { city: s.trim(), st: "" };
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
  function parseBoard() {
    const rows = $$(
      document,
      'tr[class*="arrive_Table__tableRow"], tr.arrive_Table__tableRow'
    );

    return rows.map((row) => {
      const loadA      = row.querySelector('a[id^="grid_load_loadNumber__"]');
      const loadNumber = txt(loadA);

      const puLoc   = byIdLike(row, "grid_load_pickUpLocation__");
      const dlLoc   = byIdLike(row, "grid_load_deliverLocation__");
      const pickup  = txt(puLoc);
      const deliver = txt(dlLoc);

      const carrierA = byIdLike(row, "grid_load_carrierCode__");
      const carrier  = txt(carrierA);

      const driverNameEl = byIdLike(row, "grid_load_driverName__");
      const driverName   = txt(driverNameEl);

      const truckCell = byIdLike(row, "grid_load_truckNumber__");
      const truckSpan = truckCell ? truckCell.querySelector("span") : null;
      let truck = txt(truckSpan);
      if (/^none$/i.test(truck)) truck = "";

      const pu = getCityState(pickup);
      const dl = getCityState(deliver);

      // Rich Logistics: PRO# = 7 dígitos en el *nombre del driver*
      let pro = null;
      if (isRich(carrier)) {
        const m = (driverName || "").match(/\b(\d{7})\b/);
        pro = m ? m[1] : null;
      }

      return {
        loadNumber,
        pickup, deliver,
        puCity: pu.city, puSt: pu.st,
        dlCity: dl.city, dlSt: dl.st,
        puStOnly: getStateAbbrev(pickup),
        dlStOnly: getStateAbbrev(deliver),
        carrier, truck, pro
      };
    }).filter(r => r.loadNumber && r.carrier);
  }

  // ============ Formatting rules ============
  async function formatLinesForCarrier(carrier, arr) {
    if (isForza(carrier)) {
      return arr.map(r => {
        const need = r.truck ? `truck# ${r.truck}` : "need DR info";
        const cityPart = [r.puCity, r.puSt].filter(Boolean).join(", ");
        return `L# ${r.loadNumber} - ${cityPart} - ${need}`;
      });
    }

    if (isValueTruck(carrier)) {
      const map = await getDispatcherMap(); // { truckNumber: "Dispatcher" }
      // Agrupar por dispatcher (o "NEED DR INFO" si no hay truck)
      const groups = {};
      for (const r of arr) {
        if (!r.truck) {
          (groups["NEED DR INFO"] ||= []).push(`L# ${r.loadNumber} - ${r.puStOnly} to ${r.dlStOnly} - need DR info`);
          continue;
        }
        const disp = (map[r.truck] || "UNKNOWN").toUpperCase();
        (groups[disp] ||= []).push(`L# ${r.loadNumber} - ${r.puStOnly} to ${r.dlStOnly} - truck# ${r.truck} - ${disp}`);
      }
      // Orden alfabético, con NEED DR INFO al final
      const keys = Object.keys(groups).sort((a,b) => {
        if (a === "NEED DR INFO") return 1;
        if (b === "NEED DR INFO") return -1;
        return a.localeCompare(b);
      });
      // Unir grupos con línea en blanco
      const chunks = keys.map(k => groups[k].join("\n"));
      return chunks.join("\n\n").split("\n");
    }

    if (isRich(carrier)) {
      return arr.map(r => {
        const need = r.truck ? `truck# ${r.truck}` : "need DR info";
        const proPart = r.pro ? ` - PRO: ${r.pro}` : " - NO PRO";
        return `L# ${r.loadNumber} - ${r.puStOnly} to ${r.dlStOnly} - ${need}${proPart}`;
      });
    }

    // Default
    return arr.map(r => {
      const need = r.truck ? `truck# ${r.truck}` : "need DR info";
      return `L# ${r.loadNumber} - ${r.puStOnly} to ${r.dlStOnly} - ${need}`;
    });
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
        padding:12px; width:420px; max-height:70vh; overflow:auto;
        opacity:0; transform: translateY(-4px); pointer-events:none;
        transition:opacity .15s ease, transform .15s ease;
      }
      #__ba_panel.__show { opacity:1; transform: translateY(0); pointer-events:auto; }

      #__ba_header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
      #__ba_title  { font-weight:900; letter-spacing:.2px; }
      #__ba_info   { color:#94a3b8; margin:6px 0 10px; }

      #__ba_close {
        background:#1f2937; color:#e5e7eb; border:1px solid #374151; border-radius:10px;
        padding:6px 8px; font-weight:700; cursor:pointer;
      }
      #__ba_list { display:block; }
      .__ba_item {
        display:flex; align-items:center; justify-content:space-between;
        background:#111827; border:1px solid #1f2937; border-radius:12px;
        padding:10px 12px; margin-bottom:8px; cursor:pointer;
        transition: background .15s ease, transform .05s ease;
      }
      .__ba_item:hover { background:#162033; }
      .__ba_item:active{ transform: translateY(1px); }
      .__ba_name { font-weight:800; }
      .__ba_count {
        font-size:12px; color:#cbd5e1; background:#0b1220; border:1px solid #1f2937;
        border-radius:999px; padding:3px 8px; margin-left:8px;
      }
      .__chev {
        width:0; height:0; border-left:5px solid transparent; border-right:5px solid transparent;
        border-top:6px solid #ffffff; transition:transform .12s ease;
      }
    `;
    const style = document.createElement("style");
    style.id = ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function findSaveSearchButton() {
    // Botón exacto con texto "Save Search"
    const all = $$(
      document,
      'button, .arrive_Button__buttonText, .arrive_Button__button'
    );
    return all.find((b) => /save search/i.test(b.textContent || ""));
  }

  function createDockUI() {
    injectStylesOnce();

    // limpiar instancias previas
    document.getElementById("__ba_dock")?.remove();
    document.getElementById("__ba_panel")?.remove();

    const anchor = findSaveSearchButton();
    if (!anchor || !anchor.parentElement) return null;

    // insertar botón literal a la derecha de "Save Search"
    const dock = document.createElement("span");
    dock.id = "__ba_dock";
    dock.style.cssText = "display:inline-flex; align-items:center; gap:8px; margin-left:10px;";
    anchor.insertAdjacentElement("afterend", dock);

    const toggle = document.createElement("button");
    toggle.id = "__ba_toggle";
    toggle.innerHTML = `<span>Board Assistant</span><i class="__chev"></i>`;
    dock.appendChild(toggle);

    // panel
    const panel = document.createElement("div");
    panel.id = "__ba_panel";
    panel.innerHTML = `
      <div id="__ba_header">
        <div id="__ba_title">Carriers</div>
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
    // Cerrar al mover la rueda del mouse (en cualquier parte)
    const wheelClose = () => { if (panel.classList.contains("__show")) close(); };
    window.addEventListener("wheel", wheelClose, { passive: true });

    return { list: panel.querySelector("#__ba_list"), info: panel.querySelector("#__ba_info") };
  }

  async function renderCarrierList(ui, groups) {
    ui.list.innerHTML = "";
    const entries = Object.entries(groups).sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])
    );

    for (const [carrier, arr] of entries) {
      const item = document.createElement("div");
      item.className = "__ba_item";
      item.innerHTML = `
        <div class="__ba_name">${carrier}</div>
        <div class="__ba_count">${arr.length}</div>
      `;
      item.addEventListener("click", async () => {
        const lines = await formatLinesForCarrier(carrier, arr);
        await copyText(Array.isArray(lines) ? lines.join("\n") : lines.join("\n"));
        ui.info.textContent = `✓ Copiado ${arr.length} líneas de ${carrier}`;
        setTimeout(() => {
          const total = entries.reduce((n,[,v]) => n + v.length, 0);
          ui.info.textContent = `${total} cargas · ${entries.length} carriers`;
        }, 1500);
      });
      ui.list.appendChild(item);
    }
  }

  // ============ Run ============
  (async function run(){
    const rows = parseBoard();
    const groups = rows.reduce((acc, r) => {
      (acc[r.carrier] ||= []).push(r);
      return acc;
    }, {});
    const ui = createDockUI();
    if (!ui) return;
    ui.info.textContent = `${rows.length} cargas · ${Object.keys(groups).length} carriers`;
    await renderCarrierList(ui, groups);
  })();
})();
