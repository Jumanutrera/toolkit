// Config: título, descripción y ruta del archivo .js real 13
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
    title: "COPY-CODE",
    desc: "Copia al portapapeles el texto formateado de la carga.",
    path: "./scripts/copy-code.js",
    btn: "COPY"
  },
  {
    key: "board-assistant",
    title: "BOARD-ASSISTANT",
    desc: "Acciones rápidas sobre el board: abrir cargas, marcar, exportar.",
    path: "./scripts/board-assistant.js",
    btn: "BASSIST"
  }
];

// Genera un bookmarklet "loader" que inyecta el script externo
function makeLoaderHref(absUrl) {
  // Nota: timestamp para evitar caché
  const code =
    "var d=document,s=d.createElement('script');" +
    "s.src='" + absUrl + (absUrl.includes('?') ? '&' : '?') + "v='+Date.now();" +
    "(d.body||d.documentElement).appendChild(s);";

  return "javascript:(function(){" + code + "})();";
}

const $grid = document.getElementById("grid");

function cardTemplate(item) {
  return `
    <section class="card" data-key="${item.key}">
      <h2 class="title">${item.title}</h2>
      <p class="desc">${item.desc}</p>
      <div class="row" style="align-items:center;">
        <a class="btn btn-primary" id="drag-${item.key}" href="#">${item.btn}</a>
        <span style="font-size:12px;color:var(--muted);">⬅ Arrástrame a tu barra de marcadores</span>
      </div>
      <div class="row" style="margin-top:10px;">
        <button class="btn" data-copy="${item.key}">Copiar</button>
        <button class="btn" data-refresh="${item.key}">Refrescar</button>
        <span class="ok" id="ok-${item.key}"></span>
      </div>
    </section>
  `;
}

function render() {
  $grid.innerHTML = BOOKMARKLETS.map(cardTemplate).join("");
  document.querySelectorAll("[data-copy]").forEach(btn => {
    btn.addEventListener("click", () => copyBookmarklet(btn.getAttribute("data-copy")));
  });
  document.querySelectorAll("[data-refresh]").forEach(btn => {
    btn.addEventListener("click", () => refreshCode(btn.getAttribute("data-refresh")));
  });
}

function buildOne(item) {
  const ok = document.getElementById(`ok-${item.key}`);
  const drag = document.getElementById(`drag-${item.key}`);
  try {
    // URL absoluta del script (para que cargue sin depender de la ruta actual)
    const abs = new URL(item.path, location.href).href;
    const href = makeLoaderHref(abs);
    drag.setAttribute("href", href);
    drag.setAttribute("title", "Arrástrame a tu barra de marcadores");
    if (ok) ok.textContent = "✓ listo";
    return href;
  } catch (e) {
    if (ok) {
      ok.textContent = "⚠ error";
      ok.style.color = "#ff7b7b";
    }
  }
}

async function copyBookmarklet(key) {
  const item = BOOKMARKLETS.find(b => b.key === key);
  if (!item) return;
  const href = buildOne(item);
  if (!href) return;
  try {
    await navigator.clipboard.writeText(href);
    const ok = document.getElementById(`ok-${key}`);
    if (ok) ok.textContent = "✓ copiado";
  } catch (e) {
    alert("No se pudo copiar. Copia manualmente desde el botón.");
  }
}

async function refreshCode(key) {
  // En el modo "loader" refrescar básicamente regenera el href con timestamp cuando se ejecute
  const item = BOOKMARKLETS.find(b => b.key === key);
  if (!item) return;
  buildOne(item);
}

(function init() {
  render();
  BOOKMARKLETS.forEach(buildOne);
})();
