// Lista de bookmarklets 12
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

// Minificador seguro (solo elimina comentarios)
const MINIFY = (src) => {
  try {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, "") // /* ... */
      .replace(/(^|\s)\/\/.*$/gm, "")   // // ...
      .trim();
  } catch (e) {
    return src.trim();
  }
};

// Envuelve el código como bookmarklet escapando los backticks
const asBookmarklet = (code) => {
  const safeCode = code.replace(/`/g, "\\`");
  return "javascript:(function(){" + safeCode + "})();";
};

const $grid = document.getElementById("grid");

function cardTemplate(item) {
  return `
    <section class="card" data-key="${item.key}">
      <h2 class="title">${item.title}</h2>
      <p class="desc">${item.desc}</p>
      <div class="row" style="align-items: center;">
        <a class="btn btn-primary" id="drag-${item.key}" href="#">${item.btn}</a>
        <span style="font-size:12px; color:var(--muted);">⬅ Arrástrame a tu barra de marcadores</span>
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

async function loadAndBuild(item) {
  const ok = document.getElementById(`ok-${item.key}`);
  const drag = document.getElementById(`drag-${item.key}`);

  try {
    const res = await fetch(item.path + "?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();

    const finalCode = asBookmarklet(MINIFY(raw));
    drag.setAttribute("href", finalCode);
    drag.setAttribute("title", "Arrástrame a tu barra de marcadores");

    // Log para depuración
    console.log(`=== ${item.key} bookmarklet generado ===\n`, finalCode);

    if (ok) ok.textContent = "✓ listo";
    return finalCode;
  } catch (err) {
    if (ok) {
      ok.textContent = "⚠ error";
      ok.style.color = "#ff7b7b";
    }
  }
}

async function copyBookmarklet(key) {
  const item = BOOKMARKLETS.find(b => b.key === key);
  if (!item) return;
  const href = await loadAndBuild(item);
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
  const item = BOOKMARKLETS.find(b => b.key === key);
  if (!item) return;
  await loadAndBuild(item);
}

(async function init() {
  render();
  for (const item of BOOKMARKLETS) {
    await loadAndBuild(item);
  }
})();


