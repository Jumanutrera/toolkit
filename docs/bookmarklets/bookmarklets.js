// ==============================
// Configuración de bookmarklets V 1.0
// ==============================
const BOOKMARKLETS = [
  {
    key: "check-code",
    title: "CHECK-CODE",
    desc: "Valida datos en la página de carga y muestra si es trackeable.",
    path: "./scripts/check-code.js",
    btn: "CHECK"
  },
  {
    key: "copy-code",
    title: "COPY-CODE (RJONES)",
    desc: "Copia al portapapeles el texto formateado de la carga.",
    path: "./scripts/copy-code.js",
    btn: "COPY"
  },
  {
    key: "board-assistant",
    title: "BOARD-ASSISTANT (RJONES)",
    desc: "Copia al portapapeles a gran escala desde el Tracking Board, copia por carrier.",
    path: "./scripts/board-assistant.js",
    btn: "BASSIST"
  }
];

// ==============================
// Utilidades
// ==============================

// Genera un bookmarklet que inyecta el .js externo como <script type="module">
function makeLoaderHref(key, absUrl) {
  const code =
    "var d=document,id='bm-"+key+"',old=d.getElementById(id);"
  + "if(old) old.remove();" // quita script previo del mismo bookmarklet
  + "var s=d.createElement('script');"
  + "s.src='"+absUrl+(absUrl.includes('?')?'&':'?')+"v='+Date.now();" // rompe caché cada ejecución
  + "s.id=id;"
  + "s.type='module';"
  + "(d.body||d.documentElement).appendChild(s);";
  return "javascript:(function(){"+code+"})();";
}

// Chequea si el archivo .js no está vacío (texto con .trim().length > 0)
async function isScriptNonEmpty(path) {
  try {
    const url = path + (path.includes("?") ? "&" : "?") + "v=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const txt = await res.text();
    return txt.trim().length > 0;
  } catch (e) {
    // si no podemos leer, tratamos como error (no vacío)
    throw e;
  }
}

// ==============================
// Render
// ==============================
const $grid = document.getElementById("grid");

function cardTemplate(item) {
  return `
    <section class="card" data-key="${item.key}">
      <h2 class="title">${item.title}</h2>
      <p class="desc">${item.desc}</p>

      <div class="row" style="align-items:center;">
        <a class="btn btn-primary" id="drag-${item.key}" href="#" style="user-select:none;">${item.btn}</a>
        <span style="font-size:12px; color:var(--muted);">⬅ Arrástrame</span>
        <span id="status-${item.key}" class="ok" style="margin-left:8px;"></span>
      </div>
    </section>
  `;
}

function render() {
  $grid.innerHTML = BOOKMARKLETS.map(cardTemplate).join("");
}

// ==============================
// Lógica de armado por card
// ==============================
function setDisabledButton(btnEl, reasonText) {
  if (!btnEl) return;
  btnEl.setAttribute("href", "javascript:void(0)");
  btnEl.setAttribute("title", reasonText || "Archivo vacío");
  btnEl.style.opacity = "0.6";
  btnEl.style.cursor = "not-allowed";
  // Evitar click/drag por error (igual el user puede arrastrar, pero no servirá)
  btnEl.addEventListener("click", (e) => e.preventDefault());
}

function setEnabledButton(btnEl, href) {
  if (!btnEl) return;
  btnEl.setAttribute("href", href);
  btnEl.setAttribute("title", "Arrástrame a tu barra de marcadores");
  btnEl.style.opacity = "";
  btnEl.style.cursor = "grab";
}

async function buildOne(item) {
  const status = document.getElementById(`status-${item.key}`);
  const drag   = document.getElementById(`drag-${item.key}`);

  try {
    // URL absoluta del script
    const abs = new URL(item.path, location.href).href;

    // Chequeo de archivo vacío
    const hasCode = await isScriptNonEmpty(item.path);

    if (!hasCode) {
      setDisabledButton(drag, "Archivo vacío");
      if (status) {
        status.textContent = "✖ vacío";
        status.style.color = "#ff7b7b";
      }
      return;
    }

    // Generar href loader y habilitar
    const href = makeLoaderHref(item.key, abs);
    setEnabledButton(drag, href);

    if (status) {
      status.textContent = "✓ listo";
      status.style.color = "#78f3a2";
    }
  } catch (e) {
    // Error al leer archivo o construir
    setDisabledButton(drag, "Error al cargar");
    if (status) {
      status.textContent = "⚠ error";
      status.style.color = "#ff7b7b";
    }
  }
}

// ==============================
// Init
// ==============================
(async function init() {
  render();
  for (const item of BOOKMARKLETS) {
    await buildOne(item);
  }
})();

