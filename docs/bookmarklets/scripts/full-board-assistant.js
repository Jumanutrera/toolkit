(() => {
  // ============ Utils ============
  const $$  = (root, sel) => Array.from(root.querySelectorAll(sel));
  const txt = (el) => (el ? el.textContent.trim() : "");
  const byIdLike = (row, prefix) => row.querySelector(`[id^="${prefix}"]`);
  const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));
  const debounce = (fn, ms=350)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

  function toTitleCase(s){
    if (!s) return "";
    const lower = s.toLowerCase().replace(/\s+/g," ").trim();
    return lower.split(/(\s+|\/|-) /).map((w,i)=>{
      if (!w || /^\s+|\/|-$/.test(w)) return w;
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

  // ============ Appointment parsing ============
  const TZ_ABBR = "(?:ACDT|ACST|ADT|AEDT|AEST|AKDT|AKST|AST|AWST|BST|CDT|CEST|CET|CST|EDT|EEST|EET|EST|GMT|HDT|HST|IST|JST|MDT|MST|NDT|NST|PDT|PET|PETT|PST|UTC|WET|WEST)";
  const MONTHS = {jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12"};

  function parseApptWindow(raw){
    if (!raw) return null;
    const s = raw.replace(/\s+/g," ").trim();

    // C) Rango multi-día MM/DD ... - MM/DD ...
    let re = new RegExp(
      `\\b(\\d{1,2})\\/(\\d{1,2})\\b[^\\d]*?(\\d{1,2}):(\\d{2})\\s*-\\s*(?:[A-Za-z]{3},\\s*)?(\\d{1,2})\\/(\\d{1,2})\\b[^\\d]*?(\\d{1,2}):(\\d{2})\\s*(${TZ_ABBR})?\\b`,
      "i"
    );
    let m = s.match(re);
    if (m){
      const MM1 = String(Number(m[1])).padStart(2,"0");
      const DD1 = String(Number(m[2])).padStart(2,"0");
      const sh  = String(Number(m[3])).padStart(2,"0");
      const sm  = String(Number(m[4])).padStart(2,"0");
      const MM2 = String(Number(m[5])).padStart(2,"0");
      const DD2 = String(Number(m[6])).padStart(2,"0");
      const eh  = String(Number(m[7])).padStart(2,"0");
      const em  = String(Number(m[8])).padStart(2,"0");
      const tz  = (m[9]||"").toUpperCase();
      return { mm:MM1, dd:DD1, timeStart:`${sh}${sm}`, tz, end:{ mm:MM2, dd:DD2, timeEnd:`${eh}${em}` } };
    }

    // A) Ventana mismo día MM/DD ...
    re = new RegExp(
      `\\b(\\d{1,2})\\/(\\d{1,2})\\b[^\\d]*?(\\d{1,2}):(\\d{2})\\s*-\\s*(\\d{1,2}):(\\d{2})\\s*(${TZ_ABBR})?\\b`,
      "i"
    );
    m = s.match(re);
    if (m){
      const MM = String(Number(m[1])).padStart(2,"0");
      const DD = String(Number(m[2])).padStart(2,"0");
      const sh = String(Number(m[3])).padStart(2,"0");
      const sm = String(Number(m[4])).padStart(2,"0");
      const eh = String(Number(m[5])).padStart(2,"0");
      const em = String(Number(m[6])).padStart(2,"0");
      const tz = (m[7]||"").toUpperCase();
      return { mm:MM, dd:DD, timeStart:`${sh}${sm}`, timeEnd:`${eh}${em}`, tz };
    }

    // B) Única hora MM/DD ...
    re = new RegExp(
      `\\b(\\d{1,2})\\/(\\d{1,2})\\b[^\\d]*?(\\d{1,2}):(\\d{2})\\s*(${TZ_ABBR})?\\b`,
      "i"
    );
    m = s.match(re);
    if (m){
      const MM = String(Number(m[1])).padStart(2,"0");
      const DD = String(Number(m[2])).padStart(2,"0");
      const sh = String(Number(m[3])).padStart(2,"0");
      const sm = String(Number(m[4])).padStart(2,"0");
      const tz = (m[5]||"").toUpperCase();
      return { mm:MM, dd:DD, timeStart:`${sh}${sm}`, tz };
    }

    // === Nuevos formatos con mes en texto ===
    // Multi-día: Aug 14 at 16:00 - Aug 15 at 10:00 CDT
    re = new RegExp(
      `\\b(?:[A-Za-z]{3},\\s*)?([A-Za-z]{3})\\s+(\\d{1,2})\\b[^\\d]*?(\\d{1,2}):(\\d{2})\\s*-\\s*(?:[A-Za-z]{3},\\s*)?([A-Za-z]{3})\\s+(\\d{1,2})\\b[^\\d]*?(\\d{1,2}):(\\d{2})\\s*(${TZ_ABBR})?\\b`,
      "i"
    );
    m = s.match(re);
    if (m){
      const MM1 = MONTHS[m[1].toLowerCase()] || "";
      const DD1 = String(Number(m[2])).padStart(2,"0");
      const sh  = String(Number(m[3])).padStart(2,"0");
      const sm  = String(Number(m[4])).padStart(2,"0");
      const MM2 = MONTHS[m[5].toLowerCase()] || "";
      const DD2 = String(Number(m[6])).padStart(2,"0");
      const eh  = String(Number(m[7])).padStart(2,"0");
      const em  = String(Number(m[8])).padStart(2,"0");
      const tz  = (m[9]||"").toUpperCase();
      return { mm:MM1, dd:DD1, timeStart:`${sh}${sm}`, tz, end:{ mm:MM2, dd:DD2, timeEnd:`${eh}${em}` } };
    }
    // Mismo día con rango: Aug 15 at 07:30 - 15:00 EDT
    re = new RegExp(
      `\\b(?:[A-Za-z]{3},\\s*)?([A-Za-z]{3})\\s+(\\d{1,2})\\b[^\\d]*?(\\d{1,2}):(\\d{2})\\s*-\\s*(\\d{1,2}):(\\d{2})\\s*(${TZ_ABBR})?\\b`,
      "i"
    );
    m = s.match(re);
    if (m){
      const MM = MONTHS[m[1].toLowerCase()] || "";
      const DD = String(Number(m[2])).padStart(2,"0");
      const sh = String(Number(m[3])).padStart(2,"0");
      const sm = String(Number(m[4])).padStart(2,"0");
      const eh = String(Number(m[5])).padStart(2,"0");
      const em = String(Number(m[6])).padStart(2,"0");
      const tz = (m[7]||"").toUpperCase();
      return { mm:MM, dd:DD, timeStart:`${sh}${sm}`, timeEnd:`${eh}${em}`, tz };
    }
    // Única hora: Aug 15 at 07:00 CDT
    re = new RegExp(
      `\\b(?:[A-Za-z]{3},\\s*)?([A-Za-z]{3})\\s+(\\d{1,2})\\b[^\\d]*?(\\d{1,2}):(\\d{2})\\s*(${TZ_ABBR})?\\b`,
      "i"
    );
    m = s.match(re);
    if (m){
      const MM = MONTHS[m[1].toLowerCase()] || "";
      const DD = String(Number(m[2])).padStart(2,"0");
      const sh = String(Number(m[3])).padStart(2,"0");
      const sm = String(Number(m[4])).padStart(2,"0");
      const tz = (m[5]||"").toUpperCase();
      return { mm:MM, dd:DD, timeStart:`${sh}${sm}`, tz };
    }

    return null;
  }
  function fmtAppt(a){
    if (!a) return "";
    if (a.end && (a.end.mm !== a.mm || a.end.dd !== a.dd)) {
      const tz = a.tz ? ` ${a.tz}` : "";
      return `APPT ${a.mm}/${a.dd} @ ${a.timeStart} - ${a.end.mm}/${a.end.dd} @ ${a.end.timeEnd}${tz}`.trim();
    }
    if (a.timeEnd){
      const tz = a.tz ? ` ${a.tz}` : "";
      return `APPT ${a.mm}/${a.dd} @ ${a.timeStart} - ${a.timeEnd}${tz}`.trim();
    }
    return `APPT ${a.mm}/${a.dd} @ ${a.timeStart}${a.tz ? " "+a.tz : ""}`.trim();
  }

  // ============ Parse board ============
  function grabRows() {
    return $$(document,'tr[class*="arrive_Table__tableRow"], tr.arrive_Table__tableRow');
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
  const getPUApptCell = (row) =>
    byIdLike(row, "grid_load_pickUpDate__") ||
    row.querySelector('[id^="grid_load_pickUpDate__"]');
  const getDELApptCell = (row) =>
    byIdLike(row, "grid_load_deliverDate__") ||
    row.querySelector('[id^="grid_load_deliverDate__"]');

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

      const puApptRaw  = txt(getPUApptCell(row));
      const delApptRaw = txt(getDELApptCell(row));
      const puAppt  = parseApptWindow(puApptRaw);
      const delAppt = parseApptWindow(delApptRaw);

      return {
        loadNumber,
        pickup, deliver,
        puCity: pu.city, puSt: pu.st,
        dlCity: dl.city, dlSt: dl.st,
        puStOnly: getStateAbbrev(pickup),
        dlStOnly: getStateAbbrev(deliver),
        carrier, truck: truck || "", trailer: "", // trailer not used now
        driverName, driverPhone,
        isHighRisk: isRowHighRisk(row),
        puAppt,
        delAppt
      };
    }).filter(r => r.loadNumber && r.carrier);
  }

  async function waitForStableRows({min=0, settleMs=150, timeoutMs=4000} = {}){
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

  // ============ Reach-out store ============
  const REACH_KEY = "__ba_reachMap";
  function loadReachMap(){
    try { return JSON.parse(localStorage.getItem(REACH_KEY) || "{}"); }
    catch { return {}; }
  }
  function saveReachMap(map){
    try { localStorage.setItem(REACH_KEY, JSON.stringify(map)); } catch {}
  }

  // ============ Settings ============
  const FMT_KEY       = "__ba_copyFormat"; // "1"|"2"|"3"|"4"|"6"
  const APPT_SRC_KEY  = "__ba_apptSrc";    // "PU"|"DEL"
  const CITY_MODE_KEY = "__ba_cityMode";   // "PU"|"DEL"
  const HRHV_KEY      = "__ba_includeHRHV"; // "1"|"0"

  function loadCopyFormat(){ const v = localStorage.getItem(FMT_KEY); return v && ["1","2","3","4","6"].includes(v) ? v : "1"; }
  function saveCopyFormat(v){ try { localStorage.setItem(FMT_KEY, String(v)); } catch {} }

  function loadApptSrc(){ const v = localStorage.getItem(APPT_SRC_KEY); return (v==="DEL") ? "DEL" : "PU"; }
  function saveApptSrc(v){ try { localStorage.setItem(APPT_SRC_KEY, v==="DEL"?"DEL":"PU"); } catch {} }

  function loadCityMode(){ const v = localStorage.getItem(CITY_MODE_KEY); return (v==="DEL") ? "DEL" : "PU"; }
  function saveCityMode(v){ try { localStorage.setItem(CITY_MODE_KEY, v==="DEL"?"DEL":"PU"); } catch {} }

  function loadHRHV(){ const v = localStorage.getItem(HRHV_KEY); return v==="1"; }
  function saveHRHV(val){ try { localStorage.setItem(HRHV_KEY, val ? "1" : "0"); } catch {} }

  // ============ Formatter ============
  function formatLine(r, {fmtId, apptSrc, cityMode, includeHRHV}){
    const lane = `${r.puStOnly || ""} to ${r.dlStOnly || ""}`.trim();
    const withTruck = r.truck ? `truck# ${r.truck}` : "need DR info";
    const appt = (apptSrc==="DEL") ? r.delAppt : r.puAppt;
    const apptStr = appt ? ` - ${fmtAppt(appt)}` : "";
    let out;
    switch(String(fmtId)){
      case "1": out = `L# ${r.loadNumber} - ${lane} - ${withTruck}`; break;
      case "2": out = `L# ${r.loadNumber} - ${lane}`; break;
      case "3": out = `L# ${r.loadNumber} - ${lane} - ${withTruck}${apptStr}`; break;
      case "4": {
        const city = (cityMode==="DEL")
          ? [r.dlCity, r.dlSt].filter(Boolean).join(", ")
          : [r.puCity, r.puSt].filter(Boolean).join(", ");
        const label = (cityMode==="DEL") ? "Delivery in" : "Pick Up in";
        out = `L# ${r.loadNumber} - ${label} ${city}`;
        break;
      }
      case "5": out = `${r.loadNumber} // ${lane} //`; break; // email
      case "6": out = `L# ${r.loadNumber} - ${lane}${apptStr}`; break; // appt only
      default : out = `L# ${r.loadNumber} - ${lane}`;
    }
    if (includeHRHV && r.isHighRisk) out += " - HIGH RISK";
    return out;
  }

  // ============ UI & styles (compact) ============
  function injectStylesOnce() {
    const ID = "__ba_styles";
    if (document.getElementById(ID)) return;
    const css = `
      :root{
        --ba-bg:#0f172a; --ba-surface:#0b1220; --ba-ink:#e5e7eb; --ba-ink-dim:#cbd5e1;
        --ba-border:#173154; --ba-border-2:#1f2937; --ba-shadow:0 16px 36px rgba(0,0,0,.45);
      }
      #__ba_toggle{
        background:linear-gradient(180deg,#22d3ee,#38bdf8);
        color:#0b1220; border:1px solid #0ea5e9; border-radius:12px; padding:6px 12px;
        font-weight:900; cursor:pointer; display:inline-flex; align-items:center; gap:8px;
        box-shadow:0 6px 14px rgba(14,165,233,.30); letter-spacing:.2px;
      }
      #__ba_toggle .__chev{ width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:7px solid currentColor; transition:transform .12s ease; }
      #__ba_toggle.__open .__chev{ transform:rotate(180deg); }

      #__ba_panel{
        position:absolute; z-index:999999; margin-top:6px;
        background:var(--ba-bg); color:var(--ba-ink); border:1px solid var(--ba-border);
        border-radius:14px; box-shadow:var(--ba-shadow);
        padding:8px; width:min(520px, 88vw); max-height:70vh; overflow:auto;
        opacity:0; transform:translateY(-3px); pointer-events:none; transition:opacity .12s ease, transform .12s ease;
      }
      #__ba_panel.__show{ opacity:1; transform:translateY(0); pointer-events:auto; }

      #__ba_header{ display:flex; align-items:center; justify-content:flex-end; gap:6px; margin-bottom:6px; }
      .ba-btn{ background:#0b1220; color:#e5e7eb; border:1px solid var(--ba-border-2); border-radius:10px; padding:6px 10px; font-weight:900; cursor:pointer; font-size:12px; }
      .ba-btn:hover{ filter:brightness(1.06); }

      #__ba_controls{ display:flex; flex-direction:column; gap:8px; font-size:12px; color:var(--ba-ink-dim); margin:6px 0; }
      #__ba_controls .grp{ display:flex; flex-direction:column; gap:8px; padding:8px; border:1px solid var(--ba-border-2); border-radius:10px; background:linear-gradient(180deg,#0b1220,#0c1526); }
      #__ba_controls .grp strong{ color:#fff; font-size:12px; letter-spacing:.2px; }

      .ba-select select{ width:100%; background:#0b1220; color:#e5e7eb; border:1px solid var(--ba-border-2); border-radius:10px; padding:8px 10px; font-weight:800; font-size:13px; outline:none; }
      .pill-row{ display:flex; flex-wrap:wrap; gap:6px; }
      .pill-row label{ display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border:1px solid var(--ba-border-2); border-radius:999px; background:#0b1220; cursor:pointer; color:#e5e7eb; font-weight:800; font-size:12px; }
      .pill-row input{ accent-color:#38bdf8; }

      #__ba_info{ color:var(--ba-ink-dim); margin:6px 0 6px; font-size:12px; }

      #__ba_list{ display:block; }
      .__ba_item{ display:flex; align-items:center; justify-content:space-between; background:linear-gradient(180deg,#0b1220,#0d1628); border:1px solid var(--ba-border-2); border-radius:10px; padding:8px 10px; margin-bottom:6px; cursor:pointer; transition:border-color .12s ease; }
      .__ba_item:hover{ border-color:#2b3f66; }
      .__ba_name{ font-weight:800; display:flex; align-items:center; gap:8px; font-size:13px; }
      .__ba_count{ font-size:11px; color:var(--ba-ink-dim); background:#0b1220; border:1px solid var(--ba-border-2); border-radius:999px; padding:2px 7px; margin-left:8px; }

      /* Sidecar */
      #__ba_sidecar{ position:fixed; top:0; left:0; width:min(340px, 94vw); z-index:1000005; background:#0b1220; color:#e5e7eb; border:1px solid var(--ba-border); border-radius:14px; box-shadow:var(--ba-shadow); padding:10px; display:none; visibility:hidden; }
      #__ba_sidecar.__show{ display:block; }
      #__ba_sidecar h4{ margin:0 0 6px; font-size:15px; font-weight:900; display:flex; align-items:center; gap:6px; color:#fff; }
      #__ba_sidecar .sc-id{ color:#fff; font-weight:900; }
      #__ba_sidecar .sc-row{ display:flex; align-items:center; gap:8px; margin:6px 0; }
      #__ba_sidecar .sc-label{ font-size:11px; color:#9fb3d1; min-width:72px; text-transform:uppercase; }
      #__ba_sidecar .sc-val{ font-weight:800; color:#e6edf7; word-break:break-word; }
      #__ba_sidecar .sc-badge{ display:inline-block; font-size:10px; padding:2px 6px; border-radius:999px; border:1px solid #ef4444; color:#ffe4e6; background:#7f1d1d; }

      #__ba_sidecar .sc-btnbar{ margin-left:auto; display:inline-flex; gap:0; position:relative; }
      #__ba_sidecar .sc-copy, #__ba_sidecar .sc-dd{ border:1px solid #2b3f66; background:#13203a; color:#e5e7eb; font-weight:900; cursor:pointer; padding:6px 10px; font-size:12px; }
      #__ba_sidecar .sc-copy{ border-radius:10px 0 0 10px; }
      #__ba_sidecar .sc-dd{ border-left:0; border-radius:0 10px 10px 0; width:30px; display:flex; align-items:center; justify-content:center; }
      #__ba_sc_menu{ position:fixed; min-width:260px; background:#0e162a; border:1px solid #223459; border-radius:10px; box-shadow:0 12px 26px rgba(0,0,0,.48); display:none; z-index:1000006; overflow:hidden; }
      #__ba_sc_menu.__show{ display:block; }
      #__ba_sc_menu .hdr{ padding:8px 10px; font-weight:900; color:#b7c9e9; border-bottom:1px solid #223459; font-size:11px; }
      #__ba_sc_menu button{ display:block; width:100%; text-align:left; padding:8px 10px; background:transparent; color:#e5e7eb; border:0; cursor:pointer; font-weight:800; font-size:12px; }
      #__ba_sc_menu button:hover{ background:#162033; }
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

  // ============ Fallback: scrape modal when row not present ============
  const getModal = () => document.querySelector(".arrive_SideModal__modal");
  function getModalLoadNumber(modal){
    const h = modal?.querySelector(".arrive_SideModal__headerBar h3");
    if (h) {
      const m = (h.textContent || "").match(/#\s*(\d+)/);
      if (m) return m[1];
    }
    const a = modal?.querySelector('[class*="styles__loadNumber__link"]');
    if (a) return (a.textContent || "").replace(/\D+/g, "");
    return null;
  }
  function scrapeModalRow(modal){
    if (!modal) return null;
    const loadNumber = getModalLoadNumber(modal);
    if (!loadNumber) return null;

    const text = modal.innerText || "";

    // Try to find City, ST pairs (e.g., "McKinney, TX")
    const pairs = [...text.matchAll(/\b([A-Za-z][A-Za-z .'-]+),\s*([A-Z]{2})\b/g)].map(m=>({city:toTitleCase(m[1]), st:m[2]}));
    const puPair = pairs[0] || {city:"", st:""};
    const dlPair = pairs[1] || {city:"", st:""};

    // Try appointment from any text inside modal
    const appt = parseApptWindow(text);

    return {
      loadNumber,
      pickup: "", deliver: "",
      puCity: puPair.city, puSt: puPair.st,
      dlCity: dlPair.city, dlSt: dlPair.st,
      puStOnly: puPair.st, dlStOnly: dlPair.st,
      carrier: "", truck: "", trailer: "",
      driverName:"", driverPhone:"",
      isHighRisk: /HIGH RISK/i.test(text),
      // We don't know if appt is PU or DEL; put it in both so whichever source is selected works
      puAppt: appt, delAppt: appt
    };
  }

  // ============ UI ============
  function createDockUI() {
    injectStylesOnce();
    document.getElementById("__ba_dock")?.remove();
    document.getElementById("__ba_panel")?.remove();

    const anchor = findSaveSearchButton();
    if (!anchor || !anchor.parentElement) return null;

    const dock = document.createElement("span");
    dock.id = "__ba_dock";
    dock.style.cssText = "display:inline-flex; align-items:center; gap:6px; margin-left:8px;";
    anchor.insertAdjacentElement("afterend", dock);

    const toggle = document.createElement("button");
    toggle.id = "__ba_toggle";
    toggle.innerHTML = `<span>Board Assistant</span><i class="__chev"></i>`;
    dock.appendChild(toggle);

    const panel = document.createElement("div");
    panel.id = "__ba_panel";
    panel.innerHTML = `
      <div id="__ba_header">
        <button id="__ba_refresh" class="ba-btn" title="Refresh the loads on this page">Refresh Loads</button>
        <button id="__ba_clear"   class="ba-btn" title="Uncheck all carriers">Clear Checks</button>
        <button id="__ba_close"   class="ba-btn" title="Close panel">Close</button>
      </div>

      <div id="__ba_controls">
        <div class="grp">
          <strong>Copy format</strong>
          <div class="ba-select">
            <select id="__ba_fmt_select">
              <option value="1">L# - ST to ST - truck#</option>
              <option value="2">L# - ST to ST</option>
              <option value="3">L# - ST to ST - truck# - APPT</option>
              <option value="4">L# - Pick Up / Delivery city</option>
              <option value="6">L# - ST to ST - APPT</option>
            </select>
          </div>
        </div>

        <div class="grp">
          <strong>Appointment source</strong>
          <div class="pill-row">
            <label><input type="radio" name="__ba_appt" value="PU"> Pickup</label>
            <label><input type="radio" name="__ba_appt" value="DEL"> Delivery</label>
          </div>
        </div>

        <div class="grp">
          <strong>City in used in format</strong>
          <div class="pill-row">
            <label><input type="radio" name="__ba_city" value="PU"> Pick Up city</label>
            <label><input type="radio" name="__ba_city" value="DEL"> Delivery city</label>
          </div>
        </div>

        <div class="grp">
          <div class="pill-row">
            <label><input type="checkbox" id="__ba_hrhv"> Include "- HIGH RISK" in format</label>
          </div>
        </div>
      </div>

      <div id="__ba_info">Loading…</div>
      <div id="__ba_list"></div>
    `;
    document.body.appendChild(panel);

    function positionPanel() {
      const r = toggle.getBoundingClientRect();
      panel.style.left = `${Math.max(6, Math.min(window.innerWidth-20, r.left))}px`;
      panel.style.top  = `${r.bottom + 6 + window.scrollY}px`;
    }
    const open  = () => { positionPanel(); panel.classList.add("__show"); toggle.classList.add("__open"); };
    const close = () => { panel.classList.remove("__show"); toggle.classList.remove("__open"); };

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      panel.classList.contains("__show") ? close() : open();
    });
    panel.querySelector("#__ba_close").addEventListener("click", close);
    window.addEventListener("resize", () => { if (panel.classList.contains("__show")) positionPanel(); });
    window.addEventListener("scroll", () => { if (panel.classList.contains("__show")) positionPanel(); });

    // Cerrar al hacer click/rueda fuera
    window.addEventListener("wheel", (e) => {
      if (!panel.classList.contains("__show")) return;
      const t = e.target;
      const inside = t && (t.closest && (t.closest("#__ba_panel") || t.closest("#__ba_toggle")));
      if (!inside) close();
    }, { passive: true });
    document.addEventListener("click", (e) => {
      if (!panel.classList.contains("__show")) return;
      const t = e.target;
      const inside = t && (t.closest && (t.closest("#__ba_panel") || t.closest("#__ba_toggle")));
      if (!inside) close();
    });

    // Header actions
    const refreshBtn = panel.querySelector("#__ba_refresh");
    refreshBtn.addEventListener("click", async () => {
      if (refreshBtn.disabled) return;
      refreshBtn.disabled = true;
      const prev = ui.info.textContent;
      ui.info.textContent = "Refreshing…";
      try {
        await refreshBoard(true /* fromButton */);
      } finally {
        setTimeout(() => { refreshBtn.disabled = false; }, 500);
        setTimeout(() => { if (ui.info.textContent === "Refreshing…") ui.info.textContent = prev; }, 900);
      }
    });

    const clearBtn = panel.querySelector("#__ba_clear");
    clearBtn.addEventListener("click", () => {
      try { localStorage.removeItem(REACH_KEY); } catch {}
      ui.list.querySelectorAll(".__ba_item").forEach(item => {
        item.classList.remove("__done");
        const chk = item.querySelector("input.__ba_chk");
        if (chk) chk.checked = false;
      });
      ui.info.textContent = "Cleared.";
      setTimeout(() => {
        const totalCarriers = ui.list.querySelectorAll(".__ba_item").length;
        const totalLoads = Array.from(ui.list.querySelectorAll(".__ba_item .__ba_count"))
          .map(s => Number(s.textContent||"0")).reduce((a,b)=>a+b, 0);
        ui.info.textContent = `${totalLoads} loads · ${totalCarriers} carriers`;
      }, 700);
    });

    // Persisted controls
    const fmtSelect = panel.querySelector('#__ba_fmt_select');
    const radiosAppt = panel.querySelectorAll('input[name="__ba_appt"]');
    const radiosCity = panel.querySelectorAll('input[name="__ba_city"]');
    const hrhvChk    = panel.querySelector('#__ba_hrhv');

    fmtSelect.value = loadCopyFormat();
    radiosAppt.forEach(r => { r.checked = (r.value === loadApptSrc()); });
    radiosCity.forEach(r => { r.checked = (r.value === loadCityMode()); });
    hrhvChk.checked = loadHRHV();

    fmtSelect.addEventListener("change", (e)=> saveCopyFormat(e.target.value));
    radiosAppt.forEach(r => r.addEventListener("change", (e)=> saveApptSrc(e.target.value)));
    radiosCity.forEach(r => r.addEventListener("change", (e)=> saveCityMode(e.target.value)));
    hrhvChk.addEventListener("change", (e)=> saveHRHV(e.target.checked));

    const ui = { list: panel.querySelector("#__ba_list"), info: panel.querySelector("#__ba_info") };
    return ui;
  }

  // ============ Carrier list render ============
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
        const fmtId      = loadCopyFormat();
        const apptSrc    = loadApptSrc();
        const cityMode   = loadCityMode();
        const includeHRHV= loadHRHV();
        const lines = arr.map(r => formatLine(r, {fmtId, apptSrc, cityMode, includeHRHV}));
        await copyText(lines.join("\n"));
        ui.info.textContent = `✓ Copied ${arr.length} lines from ${carrier}`;
        setTimeout(() => {
          const total = Object.values(groups).reduce((n,v) => n + v.length, 0);
          ui.info.textContent = `${total} loads · ${Object.keys(groups).length} carriers`;
        }, 900);
      });

      ui.list.appendChild(item);
    }
  }

  // ============ Index ============
  let LOAD_INDEX = new Map();
  function buildIndex(rows){
    const m = new Map();
    for (const r of rows) m.set(String(r.loadNumber).trim(), r);
    LOAD_INDEX = m;
  }

  // ============ Sidecar ============
  function positionLeftOf(modal, el, {gap=14, offsetY=10} = {}){
    if (!el || !modal) return;
    const r = modal.getBoundingClientRect();
    const w = el.offsetWidth || 340;
    const left = Math.max(6, r.left - w - gap);
    const top  = Math.max(6, r.top + offsetY);
    el.style.left = `${left}px`;
    el.style.top  = `${top}px`;
  }
  function positionMenuUnderButton(menuEl, btnEl){
    const r = btnEl.getBoundingClientRect();
    menuEl.style.left = `${r.left}px`;
    menuEl.style.top  = `${r.bottom + 6}px`;
  }

  function ensureSidecar(){
    let sc = document.getElementById("__ba_sidecar");
    if (!sc){
      sc = document.createElement("div");
      sc.id = "__ba_sidecar";
      document.body.appendChild(sc);
    }
    return sc;
  }

  function renderSidecarIfOpen(){
    const modal = getModal();
    const sc = document.getElementById("__ba_sidecar");
    if (!modal) { sc?.remove(); return; }

    const scEl = ensureSidecar();
    const loadNum = getModalLoadNumber(modal);
    if (!loadNum){ scEl.classList.remove("__show"); scEl.innerHTML = ""; return; }

    // Use board index if available; otherwise scrape modal as fallback
    const r = LOAD_INDEX.get(String(loadNum).trim()) || scrapeModalRow(modal);

    const header = (row)=> {
      const badge = row?.isHighRisk ? `<span class="sc-badge">HIGH RISK</span>` : "";
      const idHtml = `<span class="sc-id">L# ${row ? row.loadNumber : loadNum}</span>`;
      return `<h4>${idHtml} ${badge}
        <span class="sc-btnbar">
          <button class="sc-copy" id="__ba_sc_copy">Copy</button>
          <button class="sc-dd"   id="__ba_sc_dd">▾</button>
        </span>
      </h4>`;
    };

    if (!r){
      scEl.innerHTML = `
        ${header(null)}
        <div class="sc-row"><span class="sc-label">Carrier</span><span class="sc-val sc-muted">—</span></div>
        <div class="sc-row"><span class="sc-label">Driver</span><span class="sc-val sc-muted">—</span></div>
        <div class="sc-row"><span class="sc-label">Phone</span><span class="sc-val sc-muted">—</span></div>
        <div class="sc-row"><span class="sc-label">Truck</span><span class="sc-val sc-muted">—</span></div>
        <div class="sc-row"><span class="sc-label">Trailer</span><span class="sc-val">-</span></div>
        <div class="sc-row"><span class="sc-label">Route</span><span class="sc-val sc-muted">—</span></div>
      `;
    } else {
      const trailerDisplay = r.trailer && !/^none$/i.test(r.trailer) ? r.trailer : "-";
      scEl.innerHTML = `
        ${header(r)}
        <div class="sc-row"><span class="sc-label">Carrier</span><span class="sc-val">${r.carrier || "-"}</span></div>
        <div class="sc-row"><span class="sc-label">Driver</span><span class="sc-val">${r.driverName || "-"}</span></div>
        <div class="sc-row"><span class="sc-label">Phone</span><span class="sc-val">${r.driverPhone || "-"}</span></div>
        <div class="sc-row"><span class="sc-label">Truck</span><span class="sc-val">${r.truck || "-"}</span></div>
        <div class="sc-row"><span class="sc-label">Trailer</span><span class="sc-val">${trailerDisplay}</span></div>
        <div class="sc-row"><span class="sc-label">Route</span><span class="sc-val">${(r.puStOnly||"?")} → ${(r.dlStOnly||"?")}</span></div>

        <div id="__ba_sc_menu">
          <div class="hdr">Copy as…</div>
          <button data-f="1">L# - ST to ST - truck#</button>
          <button data-f="2">L# - ST to ST</button>
          <button data-f="3PU">L# - ST to ST - truck# - APPT (PU)</button>
          <button data-f="3DEL">L# - ST to ST - truck# - APPT (DEL)</button>
          <button data-f="4PU">L# - Pick Up in City, ST</button>
          <button data-f="4DEL">L# - Delivery in City, ST</button>
          <button data-f="6PU">L# - ST to ST - APPT (PU)</button>
          <button data-f="6DEL">L# - ST to ST - APPT (DEL)</button>
          <button data-f="5">LOAD // ST to ST //</button>
        </div>
      `;

      const copyBtn = scEl.querySelector("#__ba_sc_copy");
      const ddBtn   = scEl.querySelector("#__ba_sc_dd");
      const menu    = scEl.querySelector("#__ba_sc_menu");

      copyBtn.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const apptSrc    = loadApptSrc();
        const cityMode   = loadCityMode();
        const includeHRHV= loadHRHV();
        const line = formatLine(r, {fmtId:"1", apptSrc, cityMode, includeHRHV});
        await copyText(line);
        copyBtn.textContent = "Copied!";
        setTimeout(()=> copyBtn.textContent = "Copy", 900);
      });

      ddBtn.addEventListener("click", (e)=>{
        e.stopPropagation();
        positionMenuUnderButton(menu, copyBtn);
        menu.classList.toggle("__show");
      });

      menu.addEventListener("click", async (e)=>{
        const b = e.target.closest("button[data-f]");
        if (!b) return;
        const key = b.getAttribute("data-f");
        let fmtId="1", apptSrc="PU", cityMode="PU";
        if (key==="1") { fmtId="1"; }
        if (key==="2") { fmtId="2"; }
        if (key==="3PU"){ fmtId="3"; apptSrc="PU"; }
        if (key==="3DEL"){ fmtId="3"; apptSrc="DEL"; }
        if (key==="4PU"){ fmtId="4"; cityMode="PU"; }
        if (key==="4DEL"){ fmtId="4"; cityMode="DEL"; }
        if (key==="6PU"){ fmtId="6"; apptSrc="PU"; }
        if (key==="6DEL"){ fmtId="6"; apptSrc="DEL"; }
        if (key==="5"){ fmtId="5"; }
        const includeHRHV = loadHRHV();
        const line = formatLine(r, {fmtId, apptSrc, cityMode, includeHRHV});
        await copyText(line);
        menu.classList.remove("__show");
        copyBtn.textContent = "Copied!";
        setTimeout(()=> copyBtn.textContent = "Copy", 900);
      });

      const repositionIfOpen = () => { if (menu.classList.contains("__show")) positionMenuUnderButton(menu, copyBtn); };
      window.addEventListener("resize", repositionIfOpen);
      window.addEventListener("scroll", repositionIfOpen, { passive:true });
      document.addEventListener("click", (e)=>{
        if (!menu.classList.contains("__show")) return;
        const inside = e.target.closest && (e.target.closest("#__ba_sc_menu") || e.target.closest("#__ba_sc_dd") || e.target.closest("#__ba_sc_copy"));
        if (!inside) menu.classList.remove("__show");
      });
    }

    scEl.classList.add("__show");
    scEl.style.visibility = "hidden";
    requestAnimationFrame(() => {
      positionLeftOf(modal, scEl);
      requestAnimationFrame(() => {
        positionLeftOf(modal, scEl);
        scEl.style.visibility = "visible";
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
          moB.observe(body, { childList:true, subtree:true, characterData:true });
          modal.__ba_moB = moB;
        }
      } catch {}

      const onMove = debounce(()=>{ const m = getModal(); const sc = document.getElementById("__ba_sidecar"); if (m && sc) positionLeftOf(m, sc); }, 60);
      window.addEventListener("resize", onMove);
      window.addEventListener("scroll", onMove, { passive:true });

      modal.querySelector(".arrive_SideModal__closeButton")?.addEventListener("click", () => {
        document.getElementById("__ba_sidecar")?.remove();
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

  // ============ Refresh ============
  async function refreshBoard(fromButton=false){
    await waitForStableRows({ settleMs: 200, timeoutMs: 5000 });
    const rows = parseBoard();
    buildIndex(rows);

    const groups = rows.reduce((acc, r) => { (acc[r.carrier] ||= []).push(r); return acc; }, {});
    ensureUI();
    ui.info.textContent = `${rows.length} loads · ${Object.keys(groups).length} carriers`;
    await renderCarrierList(ui, groups);

    // Always re-hydrate sidecar (from table or modal fallback) after refresh
    renderSidecarIfOpen();

    // If refresh came from the button and table was still settling, do a short retry to catch delayed DOM
    if (fromButton) {
      setTimeout(renderSidecarIfOpen, 300);
      setTimeout(renderSidecarIfOpen, 800);
    }
  }

  // ============ External triggers ============
  const debouncedExternalRefresh = debounce(() => refreshBoard(), 400);
  function hookExternalTriggers(){
    document.addEventListener("click", (e) => {
      const el = e.target;
      if (el.closest && el.closest('button[title="Refresh"]')) { debouncedExternalRefresh(); return; }
      const pagBtnSel = '.arrive_Pagination__container [data-testid="pagination-previous-page"], .arrive_Pagination__container [data-testid="pagination-next-page"], .arrive_Pagination__container [data-testid^="pagination-page-"]';
      if (el.closest && el.closest(pagBtnSel)) { debouncedExternalRefresh(); return; }
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

  // ============ SPA resilience ============
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
